import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLyricSync } from './useLyricSync';
import type { LyricLine } from '../types';

const lines: LyricLine[] = [
  { time: 0, text: 'a' },
  { time: 5, text: 'b' },
  { time: 10, text: 'c' },
];

let rafCbs: FrameRequestCallback[] = [];
let nowMs = 0;

function flushFrame(advanceMs: number) {
  nowMs += advanceMs;
  const cbs = rafCbs;
  rafCbs = [];
  act(() => {
    cbs.forEach((cb) => cb(nowMs));
  });
}

beforeEach(() => {
  rafCbs = [];
  nowMs = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCbs.push(cb);
    return rafCbs.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLyricSync', () => {
  it('updates activeIndex as playback time advances while playing', () => {
    let t = 0;
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, true, lines, 0));

    // first frame: t=0 → index 0
    flushFrame(16);
    expect(result.current).toBe(0);

    // advance playback to 5s, drive frames
    t = 5;
    flushFrame(16);
    flushFrame(16);
    expect(result.current).toBe(1);

    t = 10;
    flushFrame(16);
    flushFrame(16);
    expect(result.current).toBe(2);
  });

  it('stops the loop and does not advance when not playing', () => {
    let t = 0;
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, false, lines, 0));
    // no frames are scheduled while paused
    expect(rafCbs.length).toBe(0);
    t = 10;
    expect(result.current).toBe(-1);
  });

  it('ignores a single odd backward-jump sample (live-stream glitch) then recovers', () => {
    let t = 10; // settled at last line (index 2)
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, true, lines, 0));

    flushFrame(16);
    flushFrame(300); // cross the 250ms interval to lock the sample at t=10
    expect(result.current).toBe(2);

    // one glitchy frame: getCurrentTime briefly returns a huge backward value
    t = -5; // negative/odd value (would otherwise compute index -1/0)
    flushFrame(300);
    // the bad sample is ignored — index does not lurch off the last line
    expect(result.current).toBe(2);

    // value recovers to normal; sync continues normally
    t = 10;
    flushFrame(300);
    expect(result.current).toBe(2);
  });

  it('accepts a real backward seek that persists across ticks', () => {
    let t = 10;
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, true, lines, 0));

    flushFrame(16);
    flushFrame(300);
    expect(result.current).toBe(2);

    // user seeks back to the start; value is sane and persists
    t = 0;
    flushFrame(300); // first tick after a >? backward — here 10->0 is only 10s, within 30s band -> accepted
    flushFrame(300);
    expect(result.current).toBe(0);
  });
});
