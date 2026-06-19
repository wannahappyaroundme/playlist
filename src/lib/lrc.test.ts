import { describe, it, expect } from 'vitest';
import { findActiveIndex } from './lrc';
import type { LyricLine } from '../types';

describe('findActiveIndex', () => {
  const lines: LyricLine[] = [
    { time: 0, text: 'a' },
    { time: 5, text: 'b' },
    { time: 10, text: 'c' },
    { time: 15, text: 'd' },
  ];

  it('빈 배열이면 -1', () => {
    expect(findActiveIndex([], 3)).toBe(-1);
  });

  it('첫 줄 시각보다 이전이면 -1', () => {
    expect(findActiveIndex(lines, -0.5)).toBe(-1);
  });

  it('정확히 첫 줄 시각이면 0', () => {
    expect(findActiveIndex(lines, 0)).toBe(0);
  });

  it('두 타임태그 사이(중간 시각)면 더 작은 쪽 인덱스', () => {
    expect(findActiveIndex(lines, 7.3)).toBe(1); // 5 <= 7.3 < 10
  });

  it('정확히 타임태그와 일치하면 그 인덱스', () => {
    expect(findActiveIndex(lines, 10)).toBe(2);
  });

  it('마지막 줄 시각 이후면 마지막 인덱스', () => {
    expect(findActiveIndex(lines, 999)).toBe(3);
  });

  it('마지막 줄 시각과 정확히 일치하면 마지막 인덱스', () => {
    expect(findActiveIndex(lines, 15)).toBe(3);
  });
});
