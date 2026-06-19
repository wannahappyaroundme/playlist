import { describe, it, expect } from 'vitest';
import { cycleRepeatMode } from './PlaybackContext';

describe('cycleRepeatMode', () => {
  it('cycles off -> all -> one -> off', () => {
    expect(cycleRepeatMode('off')).toBe('all');
    expect(cycleRepeatMode('all')).toBe('one');
    expect(cycleRepeatMode('one')).toBe('off');
  });
});
