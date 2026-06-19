import { describe, it, expect } from 'vitest';
import { nextIndex, prevIndex } from './queue';

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
