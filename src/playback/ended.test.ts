import { describe, it, expect } from 'vitest';
import { endedAction } from './PlaybackContext';

describe('endedAction', () => {
  it('one-repeat replays the same song', () => {
    expect(endedAction(2, 5, 'one')).toEqual({ kind: 'replay' });
  });

  it('all-repeat advances and loops back to first at the end', () => {
    expect(endedAction(1, 3, 'all')).toEqual({ kind: 'play', index: 2 });
    expect(endedAction(2, 3, 'all')).toEqual({ kind: 'play', index: 0 });
  });

  it('off advances until the last song then stops', () => {
    expect(endedAction(0, 3, 'off')).toEqual({ kind: 'play', index: 1 });
    expect(endedAction(2, 3, 'off')).toEqual({ kind: 'stop' });
  });
});
