import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { decodePlaylist } from '../lib/share';
import { getSong, createPlaylist, savePlaylist } from '../lib/storage';
import { useSongResolver } from '../hooks/useSongResolver';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import GradientBg from '../components/GradientBg';
import LpDisc from '../components/LpDisc';
import LyricsView from '../components/LyricsView';
import Controls from '../components/Controls';
import PlayGate from '../components/PlayGate';
import SkipToast from '../components/SkipToast';
import type { Song, SharedPlaylist } from '../types';

// 백그라운드 resolve 동시성 한도(받는 사람 기기/네트워크 부담 + 순서 보장 단순화).
const RESOLVE_CONCURRENCY = 3;

export default function SharedView() {
  const { encoded } = useParams();
  const navigate = useNavigate();
  const playback = usePlayback();
  const { resolve } = useSongResolver();

  const shared = useMemo<SharedPlaylist | null>(
    () => (encoded ? decodePlaylist(encoded) : null),
    [encoded],
  );

  // 보관함 저장용으로 지금까지 큐에 들어간 곡들을 추적한다(첫 곡 + 백그라운드로 이어붙인 곡).
  const [songs, setSongs] = useState<Song[]>([]);
  // 첫 곡을 확보하기 전까지만 막는다(전체 대기 → 첫 곡 대기로 축소).
  const [loadingFirst, setLoadingFirst] = useState(true);
  // 백그라운드 진행 표시: 큐에 들어간 곡 수 / 전체 곡 수.
  const [readyCount, setReadyCount] = useState(0);

  const resolveOne = useCallback(
    async (id: string): Promise<Song | null> => {
      const cached = getSong(id);
      if (cached) return cached;
      try {
        return await resolve(id);
      } catch {
        return null; // skip unresolvable song (graceful)
      }
    },
    [resolve],
  );

  useEffect(() => {
    let cancelled = false;
    if (!shared) { setLoadingFirst(false); return; }
    const entries = shared.songs;
    const total = entries.length;
    setLoadingFirst(true);
    setReadyCount(0);
    setSongs([]);

    (async () => {
      if (total === 0) { if (!cancelled) setLoadingFirst(false); return; }

      // 1) 첫 곡을 먼저 확보해 즉시 재생 게이트를 연다(전체를 기다리지 않음).
      const first = await resolveOne(entries[0].id);
      if (cancelled) return;
      if (first) {
        playback.playQueue([first], 0);
        setSongs([first]);
      }
      setReadyCount(1); // 첫 곡 해석 성공/실패 모두 진행도에는 반영
      setLoadingFirst(false);

      // 2) 나머지 곡을 동시성 한도로 해석하되, 원래 순서대로 큐에 이어붙인다.
      const rest = entries.slice(1);
      if (rest.length === 0) return;
      const results: (Song | null)[] = new Array(rest.length).fill(null);
      const resolvedFlags: boolean[] = new Array(rest.length).fill(false);
      let nextAppendIdx = 0; // 다음에 append할 (rest 기준) 인덱스 — 순서 보장
      let cursor = 0; // 다음에 resolve를 시작할 (rest 기준) 인덱스

      const flushInOrder = () => {
        // 앞에서부터 해석이 끝난 곡들만 순서대로 append한다(동시 해석이어도 순서 유지).
        while (nextAppendIdx < rest.length && resolvedFlags[nextAppendIdx]) {
          const song = results[nextAppendIdx];
          if (song) {
            playback.appendToQueue([song]);
            setSongs((prev) => [...prev, song]);
          }
          setReadyCount((c) => c + 1);
          nextAppendIdx += 1;
        }
      };

      const worker = async () => {
        while (!cancelled) {
          const idx = cursor;
          if (idx >= rest.length) return;
          cursor += 1;
          const song = await resolveOne(rest[idx].id);
          if (cancelled) return;
          results[idx] = song;
          resolvedFlags[idx] = true;
          flushInOrder();
        }
      };

      const workers = Array.from(
        { length: Math.min(RESOLVE_CONCURRENCY, rest.length) },
        () => worker(),
      );
      await Promise.all(workers);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  const current = playback.current;
  const { getDuration } = playback;
  const expectedDur = current?.durationSec ?? 0;
  // 광고/로딩 동안 가사 시계를 멈추고 진짜 곡 시작 시 0초부터 맞춘다(Player와 동일).
  const contentReady = useCallback(() => {
    if (expectedDur <= 0) return true;
    return Math.abs(getDuration() - expectedDur) <= Math.max(6, expectedDur * 0.05);
  }, [getDuration, expectedDur]);
  const activeIndex = useLyricSync(
    playback.getCurrentTime,
    playback.isPlaying,
    current?.lyrics.synced ?? [],
    current?.lyrics.offsetMs ?? 0,
    contentReady,
  );

  const saveToLibrary = () => {
    if (!shared) return;
    const p = createPlaylist(shared.title);
    const withSongs = {
      ...p,
      message: shared.message,
      from: shared.from,
      color: shared.color,
      songIds: songs.map((s) => s.id),
    };
    savePlaylist(withSongs);
    navigate(`/edit/${p.id}`);
  };

  if (!shared) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>링크를 읽을 수 없어요. (잘못된 공유 링크)</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const colors = current?.colors ?? { gradientFrom: '#0b1020', gradientTo: '#05070f', accent: '#6b7cff' };
  const total = shared.songs.length;
  // 첫 곡은 떴지만 백그라운드로 나머지를 받는 중이면 작은 진행 표시를 띄운다.
  const showProgress = !loadingFirst && total > 1 && readyCount < total;

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <GradientBg colors={colors} />
      <SkipToast error={playback.lastError} />

      {showProgress ? (
        <div className="fixed left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-xs text-white/80 backdrop-blur">
          불러오는 중 {readyCount}/{total}
        </div>
      ) : null}

      {loadingFirst ? (
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white/70">
          불러오는 중…
        </div>
      ) : !playback.started || !current ? (
        <PlayGate cover={current?.cover ?? ''} colors={colors} message={shared.message} from={shared.from} onPlay={playback.start} />
      ) : (
        <div className="relative z-10 grid min-h-screen grid-rows-[1fr_auto] gap-6 px-6 py-8 lg:grid-cols-[46%_54%] lg:grid-rows-1">
          <div className="flex items-center justify-center">
            <LpDisc cover={current.cover} spinning={playback.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex items-center justify-center">
            <LyricsView lyrics={current.lyrics} activeIndex={activeIndex} accent={colors.accent} />
          </div>
          <div className="lg:col-span-2">
            <Controls
              isPlaying={playback.isPlaying}
              repeat={playback.repeat}
              progress={playback.progress}
              duration={playback.duration}
              onToggle={playback.togglePlay}
              onNext={playback.next}
              onPrev={playback.prev}
              onSeek={playback.seek}
              onCycleRepeat={playback.cycleRepeat}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={saveToLibrary}
        className="fixed right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25"
      >
        내 보관함에 저장
      </button>
    </div>
  );
}
