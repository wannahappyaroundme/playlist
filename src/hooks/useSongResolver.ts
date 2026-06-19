import { useCallback, useRef, useState } from 'react';
import { parseLrc } from '../lib/lrc';
import { parseTitleHeuristic, thumbnailUrl } from '../lib/youtube';
import { buildSongColors, FALLBACK_COLORS, extractPalette, type RawPalette } from '../lib/colors';
import { fetchLyrics } from '../lib/lrclib';
import { saveSong } from '../lib/storage';
import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';
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

export interface ResolveDeps {
  getMeta(videoId: string): Promise<{
    video_id: string;
    title: string;
    author: string;
    durationSec: number;
  }>;
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
  const cover = thumbnailUrl(videoId);

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
  resolving: boolean;
}

const PROBE_ELEMENT_ID = 'yejin-probe';

/**
 * 메인 재생과 분리된 프로브 YtPlayer 1개로 메타를 읽어 곡을 resolve한다.
 * 프로브는 화면 밖 숨김 노드에 lazy 생성되며, 곡 추가가 메인 재생을 끊지 않게 한다.
 */
export function useSongResolver(): SongResolver {
  const [resolving, setResolving] = useState(false);
  const probeRef = useRef<YtPlayer | null>(null);

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
    const player = await createYtPlayer(PROBE_ELEMENT_ID, {});
    probeRef.current = player;
    return player;
  }, []);

  const getMeta = useCallback(
    async (videoId: string) => {
      const probe = await ensureProbe();
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        // poll until metadata is populated after cue
        probe.cueVideoById(videoId);
        const start = Date.now();
        const poll = () => {
          const data = probe.getVideoData();
          const dur = probe.getDuration();
          const state = probe.getPlayerState();
          if ((data && data.video_id && dur > 0) || state === YT_STATE.CUED || Date.now() - start > 8000) {
            finish();
          } else {
            setTimeout(poll, 100);
          }
        };
        poll();
      });
      const data = probe.getVideoData();
      return {
        video_id: data.video_id || videoId,
        title: data.title || '',
        author: data.author || '',
        durationSec: probe.getDuration() || 0,
      };
    },
    [ensureProbe],
  );

  const resolve = useCallback(
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

  return { resolve, resolving };
}
