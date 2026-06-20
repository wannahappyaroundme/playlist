import { useCallback, useEffect, useRef, useState } from 'react';
import { parseLrc } from '../lib/lrc';
import { parseTitleHeuristic, resolveBestThumbnail } from '../lib/youtube';
import { buildSongColors, FALLBACK_COLORS, extractPalette, type RawPalette } from '../lib/colors';
import { fetchLyrics } from '../lib/lrclib';
import { saveSong } from '../lib/storage';
import { createYtPlayer, type YtPlayer } from '../lib/ytPlayer';
import type { LrclibResponse } from '../lib/lrclib';
import type { Song, SongColors, SongLyrics } from '../types';

/**
 * LRCLIB 응답을 SongLyrics로 변환한다.
 * synced 우선(parseLrc로 lines/offset 산출), 없으면 plain, 둘 다 없으면 none.
 */
export function buildSongLyrics(res: LrclibResponse | null): SongLyrics {
  if (res && res.syncedLyrics) {
    const { lines, offsetMs } = parseLrc(res.syncedLyrics);
    return { type: 'synced', synced: lines, source: 'lrclib', offsetMs };
  }
  if (res && res.plainLyrics) {
    return { type: 'plain', plain: res.plainLyrics, source: 'lrclib', offsetMs: 0 };
  }
  return { type: 'none', source: 'none', offsetMs: 0 };
}

export interface AssembleSongInput {
  videoId: string;
  rawTitle: string;
  author: string;
  durationSec: number;
  cover: string;
  colors: SongColors;
  lyrics: SongLyrics;
  now?: () => string;
}

/**
 * 메타/색/가사/커버를 받아 완성된 Song을 합성한다.
 * 제목/아티스트는 parseTitleHeuristic으로 산출, id=videoId, resolvedAt=now()||ISO.
 */
export function assembleSong(input: AssembleSongInput): Song {
  const { artist, title } = parseTitleHeuristic(input.rawTitle, input.author);
  return {
    id: input.videoId,
    title,
    artist,
    durationSec: input.durationSec,
    cover: input.cover,
    colors: input.colors,
    lyrics: input.lyrics,
    resolvedAt: input.now?.() ?? new Date().toISOString(),
  };
}

export interface ProbeMeta {
  video_id: string;
  title: string;
  author: string;
  durationSec: number;
  /**
   * true면 video_id/title/duration이 모두 채워진 신뢰 가능한 메타다.
   * false면 8s 타임아웃까지 title/duration을 받지 못한 것 → 빈 메타로 캐시 고착을 막기 위해
   * resolveSongWith가 저장하지 않고 throw한다. (undefined = 레거시/주입 테스트, 신뢰 처리)
   */
  metaReady?: boolean;
  /**
   * metaReady=false의 원인 구분. true면 프로브 onError(재생 불가/차단 영상),
   * false/undefined면 타임아웃(메타를 못 읽음). PasteInput이 서로 다른 안내 문구로 매핑한다.
   */
  probeErrored?: boolean;
}

/** resolveSongWith가 던지는 에러의 원인 코드. */
export type ResolveErrorCode = 'meta' | 'unplayable';

/** code 필드를 가진 Error. PasteInput이 .code로 안내 문구를 분기한다. */
export interface ResolveError extends Error {
  code: ResolveErrorCode;
}

function resolveError(code: ResolveErrorCode, message: string): ResolveError {
  return Object.assign(new Error(message), { code });
}

/**
 * 프로브 폴링 종료 조건(순수). title까지 채워지고 **video_id가 요청한 곡과 일치**해야 finish한다.
 * (프로브 플레이어를 재사용하면 새 영상 로드 전 직전 영상 데이터가 잠깐 반환되므로,
 *  video_id 일치를 확인하지 않으면 직전 곡 제목을 새 곡에 잘못 저장하게 된다.)
 * CUED 상태 단독으로는 끝내지 않으며, 타임아웃(elapsed > timeoutMs)이면 메타가 비어도 종료해 행을 막는다.
 */
export function metaPollDone(
  data: { video_id?: string; title?: string } | null | undefined,
  dur: number,
  elapsed: number,
  timeoutMs: number,
  expectedId?: string,
): boolean {
  if (elapsed > timeoutMs) return true;
  if (!(data && data.video_id && data.title && dur > 0)) return false;
  return !expectedId || data.video_id === expectedId;
}

export interface ResolveDeps {
  getMeta(videoId: string): Promise<ProbeMeta>;
  /** THUMB_FALLBACK 체인으로 실제 로드되는 커버 URL을 고른다. 미주입 시 resolveBestThumbnail 사용. */
  resolveCover?(videoId: string): Promise<string>;
  extractPalette(coverUrl: string): Promise<RawPalette>;
  fetchLyrics(p: { artist: string; track: string; durationSec: number }): Promise<LrclibResponse | null>;
  saveSong(song: Song): void;
  now?: () => string;
}

/**
 * 전체 resolve 파이프라인을 모든 외부 의존을 주입받아 수행하는 순수 오케스트레이터.
 * cue→메타→커버→색추출(실패 시 FALLBACK)→가사 fetch→합성→저장.
 */
export async function resolveSongWith(videoId: string, deps: ResolveDeps): Promise<Song> {
  const meta = await deps.getMeta(videoId);
  // 빈 메타(타임아웃까지 title/duration 미수신)는 캐시에 고착시키지 않는다.
  if (meta.metaReady === false) {
    // 원인 구분: 프로브 onError면 재생 불가/차단(unplayable), 아니면 타임아웃(meta).
    if (meta.probeErrored) {
      throw resolveError('unplayable', `video ${videoId} is unplayable or blocked`);
    }
    throw resolveError('meta', `metadata unavailable for video ${videoId}`);
  }
  // 커버는 폴백 체인으로 '실제 로드되는' quality를 고른다 (maxres 부재 영상 대응).
  const cover = await (deps.resolveCover ?? resolveBestThumbnail)(videoId);

  let colors: SongColors;
  try {
    const palette = await deps.extractPalette(cover);
    colors = buildSongColors(palette);
  } catch {
    colors = FALLBACK_COLORS;
  }

  const { artist, title } = parseTitleHeuristic(meta.title, meta.author);
  const lrc = await deps.fetchLyrics({ artist, track: title, durationSec: meta.durationSec });
  const lyrics = buildSongLyrics(lrc);

  const song = assembleSong({
    videoId,
    rawTitle: meta.title,
    author: meta.author,
    durationSec: meta.durationSec,
    cover,
    colors,
    lyrics,
    now: deps.now,
  });
  deps.saveSong(song);
  return song;
}

export interface SongResolver {
  resolve(videoId: string): Promise<Song>;
  /**
   * 캐시를 무시하고 전체 resolve 파이프라인을 강제로 다시 실행해 storage.saveSong으로 덮어쓴다.
   * lyrics.type==='none'이거나 메타가 틀린 곡의 '가사/메타 다시 찾기' 버튼이 사용한다.
   * resolve()와 달리 어떤 캐시 단축도 하지 않는다.
   */
  reResolve(videoId: string): Promise<Song>;
  resolving: boolean;
}

const PROBE_ELEMENT_ID = 'yejin-probe';
const META_TIMEOUT_MS = 8000;

/**
 * 메인 재생과 분리된 프로브 YtPlayer 1개로 메타를 읽어 곡을 resolve한다.
 * 프로브는 화면 밖 숨김 노드에 lazy 생성되며, 곡 추가가 메인 재생을 끊지 않게 한다.
 */
export function useSongResolver(): SongResolver {
  const [resolving, setResolving] = useState(false);
  const probeRef = useRef<YtPlayer | null>(null);
  // 현재 진행 중인 getMeta 폴링 동안 프로브에서 onError가 발생했는지.
  const probeErroredRef = useRef(false);
  // 라우트 전환 언마운트 가드: createYtPlayer가 늦게 resolve돼도 누수되지 않게 한다.
  const aliveRef = useRef(true);

  // 언마운트 시 프로브 player/노드를 정리(라우트별 컴포넌트라 필수) + race 가드.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      probeRef.current?.destroy();
      probeRef.current = null;
      document.getElementById(PROBE_ELEMENT_ID)?.remove();
    };
  }, []);

  const ensureProbe = useCallback(async (): Promise<YtPlayer> => {
    if (probeRef.current) return probeRef.current;
    // ensure a hidden mount node exists for the probe iframe
    if (!document.getElementById(PROBE_ELEMENT_ID)) {
      const el = document.createElement('div');
      el.id = PROBE_ELEMENT_ID;
      el.style.position = 'absolute';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.left = '-9999px';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
    }
    const player = await createYtPlayer(PROBE_ELEMENT_ID, {
      // 재생 불가 영상: 폴링이 빈 메타로 곡을 캐시 고착시키지 않도록 에러를 표시한다.
      onError: () => { probeErroredRef.current = true; },
    });
    // ready 전에 언마운트됐다면 즉시 파기(영구 누수/경쟁조건 방지).
    if (!aliveRef.current) {
      player.destroy();
      document.getElementById(PROBE_ELEMENT_ID)?.remove();
      throw new Error('probe unmounted before ready');
    }
    probeRef.current = player;
    return player;
  }, []);

  const getMeta = useCallback(
    async (videoId: string) => {
      const probe = await ensureProbe();
      probeErroredRef.current = false;
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        // poll until metadata is populated after cue (CUED alone is NOT done)
        probe.cueVideoById(videoId);
        const start = Date.now();
        const poll = () => {
          if (probeErroredRef.current) { finish(); return; }
          const data = probe.getVideoData();
          const dur = probe.getDuration();
          if (metaPollDone(data, dur, Date.now() - start, META_TIMEOUT_MS, videoId)) {
            finish();
          } else {
            setTimeout(poll, 100);
          }
        };
        poll();
      });
      const data = probe.getVideoData();
      const dur = probe.getDuration() || 0;
      // video_id가 요청한 곡과 일치할 때만 신뢰(스테일/직전 곡 데이터 거부).
      const idMatches = data.video_id === videoId;
      const title = idMatches ? data.title || '' : '';
      // metaReady: 에러 없이 '요청한 곡'의 title + duration까지 받았는지(타임아웃/에러/스테일 식별용)
      const probeErrored = probeErroredRef.current;
      const metaReady = !probeErrored && idMatches && !!(data.video_id && title && dur > 0);
      return {
        video_id: videoId,
        title,
        author: data.author || '',
        durationSec: dur,
        metaReady,
        probeErrored,
      };
    },
    [ensureProbe],
  );

  // resolve와 reResolve가 공유하는 전체 파이프라인 실행. resolveSongWith는 캐시를 보지 않고
  // 항상 풀 파이프라인을 돌려 saveSong으로 덮어쓴다(= reResolve의 '강제 갱신' 의미를 그대로 만족).
  const runFullResolve = useCallback(
    async (videoId: string): Promise<Song> => {
      setResolving(true);
      try {
        return await resolveSongWith(videoId, {
          getMeta,
          extractPalette: (coverUrl) => extractPalette(coverUrl),
          fetchLyrics: ({ artist, track, durationSec }) =>
            fetchLyrics({ artist, track, durationSec }),
          saveSong,
        });
      } finally {
        setResolving(false);
      }
    },
    [getMeta],
  );

  const resolve = useCallback(
    (videoId: string): Promise<Song> => runFullResolve(videoId),
    [runFullResolve],
  );

  // 캐시된 곡(가사 none/잘못된 메타)을 강제로 다시 찾는다. resolve와 동일한 풀 파이프라인을
  // 거치되, 어떤 캐시 단축도 하지 않음을 시그니처로 보장한다(UI '다시 찾기' 버튼용).
  const reResolve = useCallback(
    (videoId: string): Promise<Song> => runFullResolve(videoId),
    [runFullResolve],
  );

  return { resolve, reResolve, resolving };
}
