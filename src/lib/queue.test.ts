import { describe, it, expect } from 'vitest';
import { nextIndex, prevIndex, nextShuffleIndex } from './queue';

describe('nextIndex', () => {
  describe("repeat 'one'", () => {
    it('returns the same index (replay same song)', () => {
      expect(nextIndex(0, 3, 'one')).toBe(0);
      expect(nextIndex(2, 3, 'one')).toBe(2);
      expect(nextIndex(0, 1, 'one')).toBe(0);
    });
  });

  describe("repeat 'all'", () => {
    it('advances and wraps around to first after last', () => {
      expect(nextIndex(0, 3, 'all')).toBe(1);
      expect(nextIndex(1, 3, 'all')).toBe(2);
      expect(nextIndex(2, 3, 'all')).toBe(0); // wrap
    });
    it('stays on 0 when length is 1', () => {
      expect(nextIndex(0, 1, 'all')).toBe(0);
    });
  });

  describe("repeat 'off'", () => {
    it('advances while not at the last song', () => {
      expect(nextIndex(0, 3, 'off')).toBe(1);
      expect(nextIndex(1, 3, 'off')).toBe(2);
    });
    it('returns null at the last song (stop)', () => {
      expect(nextIndex(2, 3, 'off')).toBeNull();
      expect(nextIndex(0, 1, 'off')).toBeNull();
    });
  });

  it('returns null for empty queue regardless of mode', () => {
    expect(nextIndex(0, 0, 'off')).toBeNull();
    expect(nextIndex(0, 0, 'all')).toBeNull();
    expect(nextIndex(0, 0, 'one')).toBeNull();
  });
});

describe('prevIndex', () => {
  describe("repeat 'all'", () => {
    it('goes back and wraps to last from first', () => {
      expect(prevIndex(2, 3, 'all')).toBe(1);
      expect(prevIndex(1, 3, 'all')).toBe(0);
      expect(prevIndex(0, 3, 'all')).toBe(2); // wrap to last
    });
    it('stays on 0 when length is 1', () => {
      expect(prevIndex(0, 1, 'all')).toBe(0);
    });
  });

  describe("repeat 'off' / 'one'", () => {
    it('decrements but clamps at 0', () => {
      expect(prevIndex(2, 3, 'off')).toBe(1);
      expect(prevIndex(1, 3, 'off')).toBe(0);
      expect(prevIndex(0, 3, 'off')).toBe(0); // clamp
      expect(prevIndex(0, 3, 'one')).toBe(0); // clamp
      expect(prevIndex(2, 3, 'one')).toBe(1);
    });
  });

  it('returns 0 for empty queue', () => {
    expect(prevIndex(0, 0, 'all')).toBe(0);
    expect(prevIndex(0, 0, 'off')).toBe(0);
  });
});

describe('nextShuffleIndex', () => {
  it('returns 0 when length is 1 (only song)', () => {
    expect(nextShuffleIndex(0, 1, () => 0)).toBe(0);
    expect(nextShuffleIndex(0, 1, () => 0.99)).toBe(0);
  });

  it('returns 0 when length is 0 (empty)', () => {
    expect(nextShuffleIndex(0, 0, () => 0.5)).toBe(0);
  });

  it('never returns the current index when length > 1', () => {
    // rand=0 → lowest pick; rand→1 → highest pick. Both must skip current.
    for (let current = 0; current < 4; current++) {
      expect(nextShuffleIndex(current, 4, () => 0)).not.toBe(current);
      expect(nextShuffleIndex(current, 4, () => 0.99)).not.toBe(current);
    }
  });

  it('is deterministic for a fixed rand (rand=0 skips current)', () => {
    // length 3, current 0: pick from [0,2) → floor(0*2)=0, 0>=0 so +1 → 1
    expect(nextShuffleIndex(0, 3, () => 0)).toBe(1);
    // current 1: floor(0*2)=0, 0<1 → stays 0
    expect(nextShuffleIndex(1, 3, () => 0)).toBe(0);
    // current 2: floor(0*2)=0, 0<2 → stays 0
    expect(nextShuffleIndex(2, 3, () => 0)).toBe(0);
  });

  it('is deterministic for rand≈1 (highest non-current index)', () => {
    // length 3, current 0: floor(0.99*2)=1, 1>=0 → +1 → 2
    expect(nextShuffleIndex(0, 3, () => 0.99)).toBe(2);
    // current 2: floor(0.99*2)=1, 1<2 → stays 1
    expect(nextShuffleIndex(2, 3, () => 0.99)).toBe(1);
  });

  it('always returns a valid in-range index', () => {
    for (let r = 0; r < 1; r += 0.07) {
      for (let length = 2; length <= 6; length++) {
        for (let current = 0; current < length; current++) {
          const idx = nextShuffleIndex(current, length, () => r);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(length);
          expect(idx).not.toBe(current);
        }
      }
    }
  });

  it('returns a valid in-range index when current is out of range', () => {
    expect(nextShuffleIndex(-1, 3, () => 0)).toBe(0);
    expect(nextShuffleIndex(99, 3, () => 0.99)).toBe(2);
    const idx = nextShuffleIndex(99, 3, () => 0.5);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });
});
