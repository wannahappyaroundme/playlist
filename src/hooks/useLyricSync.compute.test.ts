import { describe, it, expect } from 'vitest';
import { computeActiveIndex } from './useLyricSync';
import type { LyricLine } from '../types';

const lines: LyricLine[] = [
  { time: 0, text: 'a' },
  { time: 5, text: 'b' },
  { time: 10, text: 'c' },
];

describe('computeActiveIndex', () => {
  it('returns -1 before the first line when playing', () => {
    // sample.time=0 at=1000; now=1000 → t=0 → findActiveIndex returns 0 (time<=0)
    const idx = computeActiveIndex({ time: 0, at: 1000 }, 1000, true, lines, 0);
    expect(idx).toBe(0);
  });

  it('interpolates elapsed time while playing', () => {
    // sample.time=4 at=1000; now=2000 → +1s → t=5 → index 1
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 2000, true, lines, 0);
    expect(idx).toBe(1);
  });

  it('does not interpolate when paused', () => {
    // paused → t = sample.time = 4 → index 0 (time<=4 last is line 0)
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 9999, false, lines, 0);
    expect(idx).toBe(0);
  });

  it('applies positive offsetMs by shifting compared time forward', () => {
    // sample.time=4 paused, offset +1000ms → t=5 → index 1
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 0, false, lines, 1000);
    expect(idx).toBe(1);
  });

  it('returns -1 for empty lines', () => {
    const idx = computeActiveIndex({ time: 99, at: 0 }, 0, true, [], 0);
    expect(idx).toBe(-1);
  });

  it('returns -1 when the time is stale (beyond last line + 2s) — song-change guard', () => {
    // last line time = 10; sample at 200s = previous song's leftover position
    const idx = computeActiveIndex({ time: 200, at: 1000 }, 1000, false, lines, 0);
    expect(idx).toBe(-1);
  });

  it('stays valid right up to the 2s grace beyond the last line', () => {
    // last line = 10; t=12 is within +2s grace → still the last index, not stale
    const idx = computeActiveIndex({ time: 12, at: 1000 }, 1000, false, lines, 0);
    expect(idx).toBe(2);
  });
});
