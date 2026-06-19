import type { RepeatMode } from '../types';

export function nextIndex(
  current: number,
  length: number,
  repeat: RepeatMode,
): number | null {
  if (length <= 0) return null;
  switch (repeat) {
    case 'one':
      return current;
    case 'all':
      return (current + 1) % length;
    case 'off':
    default:
      return current + 1 < length ? current + 1 : null;
  }
}

export function prevIndex(
  current: number,
  length: number,
  repeat: RepeatMode,
): number {
  if (length <= 0) return 0;
  if (repeat === 'all') {
    return (current - 1 + length) % length;
  }
  return Math.max(0, current - 1);
}
