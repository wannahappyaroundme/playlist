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

import { PlaybackProvider, usePlayback } from './PlaybackContext';
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
});
