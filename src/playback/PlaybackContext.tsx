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
import { saveSong } from '../lib/storage';
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

/**
 * 플레이어 에러(영상 삭제/비공개/임베드 불가 등) 시 다음 동작.
 * 깨진 트랙을 다시 재생하면 에러가 반복되므로 'one'이어도 replay하지 않고 다음으로 넘긴다.
 * 'all'은 wrap, 그 외(off/one)는 단방향 전진 후 끝에서 정지.
 */
export function errorAction(
  current: number,
  length: number,
  repeat: RepeatMode,
): EndedAction {
  const effective: RepeatMode = repeat === 'all' ? 'all' : 'off';
  const idx = nextIndex(current, length, effective);
  if (idx === null) return { kind: 'stop' };
  return { kind: 'play', index: idx };
}

/**
 * 플레이어 상태 → isPlaying 매핑(순수). PLAYING/PAUSED/ENDED만 확정값을 주고,
 * BUFFERING/UNSTARTED/CUED는 null(변경 없음)을 반환해 곡 전환·버퍼링마다
 * 진행바/LP/가사가 멈췄다 재시작하는 깜빡임을 막는다.
 */
export function isPlayingFromState(state: number): boolean | null {
  if (state === YT_STATE.PLAYING) return true;
  if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) return false;
  return null; // BUFFERING / UNSTARTED / CUED → no change
}

// durationSec 자가치유 판단의 임계값.
const HEAL_MIN_DIFF_SEC = 3; // 최소 절대 차이(초): 잡음/반올림은 무시
const HEAL_MIN_DIFF_RATIO = 0.05; // 최소 상대 차이(5%)
const HEAL_SANE_LOW = 0.5; // live가 stored의 절반 미만이면 광고로 보고 치유 안 함
const HEAL_SANE_HIGH = 2; // live가 stored의 2배 초과면 비정상으로 보고 치유 안 함

/**
 * 라이브 getDuration()으로 저장된 durationSec를 자가치유할지 결정하는 순수 헬퍼.
 * 치유 조건(모두 충족):
 *  - live > 0 (정상값), stored > 0 (비교 대상 존재)
 *  - 차이가 충분히 큼: |live-stored| > 3s AND > stored의 5%
 *  - live가 stored의 합리적 재인코딩 밴드(0.5x~2x) 안 — 선광고(짧음)/이상값(긺)으로 인한
 *    잘못된 치유를 막는다. 광고는 보통 곡보다 훨씬 짧아 이 밴드 밖이라 걸러진다.
 */
export function shouldHealDuration(live: number, stored: number): boolean {
  if (!(live > 0) || !(stored > 0)) return false;
  const diff = Math.abs(live - stored);
  if (diff <= HEAL_MIN_DIFF_SEC) return false;
  if (diff <= stored * HEAL_MIN_DIFF_RATIO) return false;
  // 광고/이상값 가드: live가 stored의 0.5x~2x 밖이면 같은 콘텐츠가 아니라고 보고 치유 안 함.
  if (live < stored * HEAL_SANE_LOW || live > stored * HEAL_SANE_HIGH) return false;
  return true;
}

/** 마지막으로 '재생 불가'로 건너뛴 곡 정보(토스트 표시용). at은 중복 갱신 식별자. */
export interface PlaybackError {
  title: string;
  at: number;
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
  lastError: PlaybackError | null;
  playQueue(songs: Song[], startIndex?: number): void;
  /** 현재 인덱스/재생을 건드리지 않고 큐 끝에 곡들을 덧붙인다(progressive 수신용). */
  appendToQueue(songs: Song[]): void;
  start(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  cycleRepeat(): void;
  setRepeat(r: RepeatMode): void;
  getCurrentTime(): number;
  /** 라이브 플레이어 길이(초). 광고 중에는 광고 길이를 반환하므로 곡 길이와 비교해 광고를 감지한다. */
  getDuration(): number;
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
  const [lastError, setLastError] = useState<PlaybackError | null>(null);

  const playerRef = useRef<YtPlayer | null>(null);
  // refs mirror state for use inside the (stable) onStateChange callback
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  // durationSec 자가치유 루프 가드: 곡 로드(현재 인덱스)당 한 번만 치유한다.
  const healedIndexRef = useRef(-1);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  // 곡이 바뀌면 다음 곡의 치유를 다시 1회 허용한다(곡별 1회 보장).
  useEffect(() => { healedIndexRef.current = -1; }, [currentIndex]);

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
        // BUFFERING/UNSTARTED/CUED는 isPlaying을 건드리지 않는다(곡 전환 깜빡임 방지).
        const playing = isPlayingFromState(state);
        if (playing !== null) setIsPlaying(playing);
        if (state === YT_STATE.ENDED) {
          const action = endedAction(indexRef.current, queueRef.current.length, repeatRef.current);
          if (action.kind === 'replay') {
            playerRef.current?.seekTo(0);
            playerRef.current?.playVideo();
          } else if (action.kind === 'play') {
            goTo(action.index);
          }
          // 'stop'은 위에서 이미 isPlaying=false 처리됨
        }
      },
      onError: () => {
        // 영상 재생 불가(삭제/비공개/임베드 차단 등): 다음 재생 가능 트랙으로 건너뛰거나 정지.
        // 건너뛴(=현재 깨진) 곡 제목을 토스트용으로 기록한다.
        const skipped = queueRef.current[indexRef.current];
        if (skipped) setLastError({ title: skipped.title, at: Date.now() });
        const action = errorAction(indexRef.current, queueRef.current.length, repeatRef.current);
        if (action.kind === 'play') {
          goTo(action.index);
        } else {
          setIsPlaying(false);
          playerRef.current?.pauseVideo();
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
      const live = p.getDuration();
      setDuration(live);
      // durationSec 자가치유: 재생 중 라이브 길이가 저장값과 (재인코딩 등으로) 크게 다르면
      // 곡당 1회 인메모리 큐 + 영속 풀(saveSong)을 갱신해 광고 게이트 오작동 고착을 막는다.
      const idx = indexRef.current;
      const cur = queueRef.current[idx];
      if (cur && healedIndexRef.current !== idx && shouldHealDuration(live, cur.durationSec)) {
        healedIndexRef.current = idx;
        const healed: Song = { ...cur, durationSec: live };
        // 인메모리 큐 갱신(불변 복사로 리렌더 유발 — 광고 게이트가 새 길이를 즉시 사용)
        setQueue((prev) => {
          if (prev[idx]?.id !== cur.id) return prev; // 곡이 이미 바뀌었으면 무시
          const copy = prev.slice();
          copy[idx] = healed;
          queueRef.current = copy;
          return copy;
        });
        // 영속 풀도 갱신
        saveSong(healed);
      }
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

  // 현재 인덱스/재생 상태를 건드리지 않고 큐 끝에 곡을 덧붙인다.
  // SharedView가 첫 곡 재생을 막지 않으면서 나머지 곡을 백그라운드로 받아 이어붙일 때 쓴다.
  const appendToQueue = useCallback((songs: Song[]) => {
    if (songs.length === 0) return;
    setQueue((prev) => {
      const next = [...prev, ...songs];
      queueRef.current = next; // onStateChange 콜백이 즉시 새 큐 길이를 보게 한다
      return next;
    });
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
    // off 마지막 트랙: prev의 0-클램프 무동작과 대칭 — 현재 곡을 끊지 않고 그대로 둔다.
    if (idx === null) return;
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
  const getDuration = useCallback(() => playerRef.current?.getDuration() ?? 0, []);

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
      lastError,
      playQueue,
      appendToQueue,
      start,
      togglePlay,
      next,
      prev,
      seek,
      cycleRepeat,
      setRepeat,
      getCurrentTime,
      getDuration,
    }),
    [
      queue, currentIndex, current, isPlaying, repeat, progress, duration, started, lastError,
      playQueue, appendToQueue, start, togglePlay, next, prev, seek, cycleRepeat, setRepeat, getCurrentTime, getDuration,
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
