import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';
import { nextIndex, prevIndex } from '../lib/queue';
import type { Song, RepeatMode } from '../types';

/** 반복 모드 순환: off → all → one → off. */
export function cycleRepeatMode(r: RepeatMode): RepeatMode {
  if (r === 'off') return 'all';
  if (r === 'all') return 'one';
  return 'off';
}

export type EndedAction =
  | { kind: 'replay' }
  | { kind: 'play'; index: number }
  | { kind: 'stop' };

/**
 * 곡 종료 시 다음 동작 결정. one=같은 곡 replay, 그 외는 queue.nextIndex 재사용:
 * number→해당 인덱스 재생, null(off 마지막)→정지.
 */
export function endedAction(
  current: number,
  length: number,
  repeat: RepeatMode,
): EndedAction {
  if (repeat === 'one') return { kind: 'replay' };
  const idx = nextIndex(current, length, repeat);
  if (idx === null) return { kind: 'stop' };
  return { kind: 'play', index: idx };
}

export interface PlaybackApi {
  queue: Song[];
  currentIndex: number;
  current: Song | null;
  isPlaying: boolean;
  repeat: RepeatMode;
  progress: number;
  duration: number;
  started: boolean;
  playQueue(songs: Song[], startIndex?: number): void;
  start(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  cycleRepeat(): void;
  setRepeat(r: RepeatMode): void;
  getCurrentTime(): number;
}

const PLAYER_ELEMENT_ID = 'yt-player';
const PlaybackContext = createContext<PlaybackApi | null>(null);

export function PlaybackProvider(props: { children: React.ReactNode }): JSX.Element {
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);

  const playerRef = useRef<YtPlayer | null>(null);
  // refs mirror state for use inside the (stable) onStateChange callback
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  const goTo = useCallback((index: number) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    indexRef.current = index;
    setCurrentIndex(index);
    playerRef.current?.loadVideoById(q[index].id);
  }, []);

  // create the single hidden player once
  useEffect(() => {
    let alive = true;
    createYtPlayer(PLAYER_ELEMENT_ID, {
      onStateChange: (state) => {
        if (state === YT_STATE.PLAYING) setIsPlaying(true);
        else if (state === YT_STATE.PAUSED || state === YT_STATE.BUFFERING) setIsPlaying(false);
        else if (state === YT_STATE.ENDED) {
          const action = endedAction(indexRef.current, queueRef.current.length, repeatRef.current);
          if (action.kind === 'replay') {
            playerRef.current?.seekTo(0);
            playerRef.current?.playVideo();
          } else if (action.kind === 'play') {
            goTo(action.index);
          } else {
            setIsPlaying(false);
          }
        }
      },
    })
      .then((p) => {
        if (alive) playerRef.current = p;
        else p.destroy();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [goTo]);

  // 250ms progress sampling while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setProgress(p.getCurrentTime());
      setDuration(p.getDuration());
    }, 250);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  // 큐를 준비(cue)만 한다. 자동재생/게이트 해제는 하지 않음 — 첫 제스처(start)가 소유한다.
  const playQueue = useCallback((songs: Song[], startIndex = 0) => {
    setQueue(songs);
    queueRef.current = songs;
    setCurrentIndex(startIndex);
    indexRef.current = startIndex;
    const target = songs[startIndex];
    if (target) playerRef.current?.cueVideoById(target.id);
  }, []);

  // 첫 사용자 제스처: 게이트를 열고 현재 곡을 재생한다.
  const start = useCallback(() => {
    setStarted(true);
    playerRef.current?.playVideo();
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo();
    else p.playVideo();
  }, []);

  const next = useCallback(() => {
    const idx = nextIndex(indexRef.current, queueRef.current.length, repeatRef.current);
    if (idx === null) {
      setIsPlaying(false);
      playerRef.current?.pauseVideo();
      return;
    }
    goTo(idx);
  }, [goTo]);

  const prev = useCallback(() => {
    goTo(prevIndex(indexRef.current, queueRef.current.length, repeatRef.current));
  }, [goTo]);

  const seek = useCallback((sec: number) => {
    playerRef.current?.seekTo(sec);
    setProgress(sec);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatState((r) => cycleRepeatMode(r));
  }, []);

  const setRepeat = useCallback((r: RepeatMode) => setRepeatState(r), []);

  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);

  const current = queue[currentIndex] ?? null;

  const api = useMemo<PlaybackApi>(
    () => ({
      queue,
      currentIndex,
      current,
      isPlaying,
      repeat,
      progress,
      duration,
      started,
      playQueue,
      start,
      togglePlay,
      next,
      prev,
      seek,
      cycleRepeat,
      setRepeat,
      getCurrentTime,
    }),
    [
      queue, currentIndex, current, isPlaying, repeat, progress, duration, started,
      playQueue, start, togglePlay, next, prev, seek, cycleRepeat, setRepeat, getCurrentTime,
    ],
  );

  return (
    <PlaybackContext.Provider value={api}>
      <div
        id={PLAYER_ELEMENT_ID}
        style={{ position: 'absolute', width: 1, height: 1, left: -9999, pointerEvents: 'none' }}
        aria-hidden="true"
      />
      {props.children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackApi {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider');
  return ctx;
}
