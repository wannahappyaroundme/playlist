import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// By default createYtPlayer never resolves (player stays null), controls are safe no-ops.
// A test can opt into a resolving fake player + captured handlers via installFakePlayer().
let capturedHandlers: { onStateChange?: (s: number) => void; onError?: () => void } = {};
let fakePlayer: any = null;

vi.mock('../lib/ytPlayer', () => ({
  YT_STATE: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  createYtPlayer: vi.fn((_id: string, handlers: any) => {
    capturedHandlers = handlers;
    if (fakePlayer) return Promise.resolve(fakePlayer);
    return new Promise(() => {}); // never resolves
  }),
}));
const { StorageWriteErrorMock } = vi.hoisted(() => ({ StorageWriteErrorMock: class extends Error {} }));
vi.mock('../lib/storage', () => ({ saveSong: vi.fn(), StorageWriteError: StorageWriteErrorMock }));

import { PlaybackProvider, usePlayback } from './PlaybackContext';
import { saveSong } from '../lib/storage';
import type { Song } from '../types';

function installFakePlayer() {
  fakePlayer = {
    loadVideoById: vi.fn(),
    cueVideoById: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getPlayerState: vi.fn(() => 1),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    destroy: vi.fn(),
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(PlaybackProvider, null, children);

function song(id: string): Song {
  return {
    id,
    title: id,
    artist: 'a',
    durationSec: 100,
    cover: 'c',
    colors: { gradientFrom: '#101820', gradientTo: '#05080c', accent: '#7c5cff' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedHandlers = {};
  fakePlayer = null;
});

describe('usePlayback state machine (smoke)', () => {
  it('starts with empty queue and off repeat', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.queue).toEqual([]);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.current).toBeNull();
    expect(result.current.repeat).toBe('off');
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.started).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  it('records lastError (skipped song title) when a player error skips a track', async () => {
    installFakePlayer();
    const { result } = renderHook(() => usePlayback(), { wrapper });
    // wait for the fake player to be installed + onError captured
    await waitFor(() => expect(capturedHandlers.onError).toBeTypeOf('function'));
    act(() => result.current.playQueue([song('a1'), song('b2')], 0));
    expect(result.current.lastError).toBeNull();
    // simulate YouTube onError on the current (broken) track at index 0
    act(() => capturedHandlers.onError!());
    expect(result.current.lastError?.title).toBe('a1');
    expect(typeof result.current.lastError?.at).toBe('number');
    // and it skipped forward to the next playable track
    expect(result.current.currentIndex).toBe(1);
  });

  it('cycleRepeat cycles off -> all -> one -> off', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('all');
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('one');
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('off');
  });

  it('setRepeat sets an explicit mode', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.setRepeat('one'));
    expect(result.current.repeat).toBe('one');
  });

  it('shuffle defaults off and toggleShuffle flips it (independent of repeat)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.shuffle).toBe(false);
    act(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(true);
    // shuffle + repeat-all coexist (separate axes)
    act(() => result.current.setRepeat('all'));
    expect(result.current.shuffle).toBe(true);
    expect(result.current.repeat).toBe('all');
    act(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(false);
  });

  it('next() with shuffle on jumps to a non-current index (never stops)', async () => {
    installFakePlayer();
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic
    try {
      const { result } = renderHook(() => usePlayback(), { wrapper });
      await waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));
      // last track in off mode would normally stop; shuffle must still advance
      act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 2));
      act(() => result.current.toggleShuffle());
      act(() => result.current.next());
      // rand=0 from current=2, length=3 → pick 0 (0<2) → index 0
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentIndex).not.toBe(2);
    } finally {
      randSpy.mockRestore();
    }
  });

  it('ENDED with shuffle on auto-advances to a non-current index (off would stop)', async () => {
    installFakePlayer();
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const { result } = renderHook(() => usePlayback(), { wrapper });
      await waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));
      act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 0));
      act(() => result.current.toggleShuffle());
      // song ends; repeat is off (would stop) but shuffle takes over
      act(() => capturedHandlers.onStateChange!(0 /* ENDED */));
      // rand≈1 from current=0, length=3 → floor(0.99*2)=1, 1>=0 → +1 → index 2
      expect(result.current.currentIndex).toBe(2);
      expect(result.current.currentIndex).not.toBe(0);
    } finally {
      randSpy.mockRestore();
    }
  });

  it("ENDED with repeat 'one' replays even when shuffle is on (one wins)", async () => {
    installFakePlayer();
    try {
      const { result } = renderHook(() => usePlayback(), { wrapper });
      await waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));
      act(() => result.current.playQueue([song('a1'), song('b2')], 0));
      act(() => result.current.toggleShuffle());
      act(() => result.current.setRepeat('one'));
      act(() => capturedHandlers.onStateChange!(0 /* ENDED */));
      // index unchanged (replayed same song), player seeked to 0 + replayed
      expect(result.current.currentIndex).toBe(0);
      expect(fakePlayer.seekTo).toHaveBeenCalledWith(0);
      expect(fakePlayer.playVideo).toHaveBeenCalled();
    } finally {
      // no spy to restore
    }
  });

  it('playQueue populates queue/current WITHOUT marking started (no auto-play)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 1));
    expect(result.current.queue.map((s) => s.id)).toEqual(['a1', 'b2', 'c3']);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.current?.id).toBe('b2');
    // gate must remain closed until a user gesture calls start()
    expect(result.current.started).toBe(false);
  });

  it('start() marks started (first user gesture owns playback start)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2')], 0));
    expect(result.current.started).toBe(false);
    act(() => result.current.start());
    expect(result.current.started).toBe(true);
  });

  it('next/prev move the current index respecting bounds (off)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 0));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(1);
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(0); // clamped at 0 when off
  });

  it('next() at the last track in off mode does nothing (symmetric with prev clamp)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2')], 1)); // start at last
    act(() => result.current.next());
    // index unchanged and playback not forcibly paused
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isPlaying).toBe(false); // unchanged from initial (no live player)
  });

  it('getCurrentTime returns 0 when no live player', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.getCurrentTime()).toBe(0);
  });

  it('appendToQueue appends in order without disturbing currentIndex/current', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1')], 0));
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.appendToQueue([song('b2'), song('c3')]));
    expect(result.current.queue.map((s) => s.id)).toEqual(['a1', 'b2', 'c3']);
    // current playback position is untouched by appends
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.current?.id).toBe('a1');
    // a second append keeps appending at the end, preserving order
    act(() => result.current.appendToQueue([song('d4')]));
    expect(result.current.queue.map((s) => s.id)).toEqual(['a1', 'b2', 'c3', 'd4']);
    expect(result.current.currentIndex).toBe(0);
  });

  it('appendToQueue with an empty array is a no-op', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1')], 0));
    act(() => result.current.appendToQueue([]));
    expect(result.current.queue.map((s) => s.id)).toEqual(['a1']);
  });
});

describe('usePlayback durationSec self-heal', () => {
  it('heals a stale durationSec (once) in queue + storage when live duration drifts', async () => {
    vi.useFakeTimers();
    try {
      installFakePlayer();
      // live duration drifts from stored 100 -> 130 (sane band, >3s & >5%)
      fakePlayer.getDuration = vi.fn(() => 130);
      fakePlayer.getCurrentTime = vi.fn(() => 5);

      const { result } = renderHook(() => usePlayback(), { wrapper });
      // wait for the fake player to be installed + handlers captured
      await vi.waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));

      act(() => result.current.playQueue([song('a1')], 0)); // song('a1').durationSec === 100
      // drive isPlaying=true so the 250ms sampler effect starts
      act(() => capturedHandlers.onStateChange!(1 /* PLAYING */));

      // advance two sampler ticks (async so the interval's setState flushes)
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });

      // queue durationSec healed to live value
      expect(result.current.queue[0].durationSec).toBe(130);
      // persisted once (loop guard: only once per song load)
      expect((saveSong as any).mock.calls.length).toBe(1);
      expect((saveSong as any).mock.calls[0][0]).toMatchObject({ id: 'a1', durationSec: 130 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('P0-4: a quota error from the self-heal saveSong does not kill the sampler', async () => {
    vi.useFakeTimers();
    try {
      installFakePlayer();
      fakePlayer.getDuration = vi.fn(() => 130);
      fakePlayer.getCurrentTime = vi.fn(() => 5);
      (saveSong as any).mockImplementation(() => { throw new StorageWriteErrorMock('full'); });

      const { result } = renderHook(() => usePlayback(), { wrapper });
      await vi.waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));
      act(() => result.current.playQueue([song('a1')], 0));
      act(() => capturedHandlers.onStateChange!(1));

      // sampler must keep running past the throwing saveSong (no unhandled crash)
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });

      // in-memory queue still healed even though persistence threw
      expect(result.current.queue[0].durationSec).toBe(130);
      // progress kept sampling (current time read after the throw)
      expect(result.current.progress).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT heal during an ad (live much shorter than stored)', async () => {
    vi.useFakeTimers();
    try {
      installFakePlayer();
      // 12s pre-roll ad vs stored 100s song -> outside sane band -> no heal
      fakePlayer.getDuration = vi.fn(() => 12);
      fakePlayer.getCurrentTime = vi.fn(() => 3);

      const { result } = renderHook(() => usePlayback(), { wrapper });
      await vi.waitFor(() => expect(capturedHandlers.onStateChange).toBeTypeOf('function'));

      act(() => result.current.playQueue([song('a1')], 0));
      act(() => capturedHandlers.onStateChange!(1));
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });

      expect(result.current.queue[0].durationSec).toBe(100); // unchanged
      expect((saveSong as any).mock.calls.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
