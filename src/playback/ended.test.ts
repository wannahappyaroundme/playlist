import { describe, it, expect } from 'vitest';
import { endedAction, errorAction } from './PlaybackContext';

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

describe('errorAction (skip on YT player error)', () => {
  it('skips forward to the next playable track (off, mid-queue)', () => {
    expect(errorAction(0, 3, 'off')).toEqual({ kind: 'play', index: 1 });
  });

  it('stops gracefully when the errored track is the last (off)', () => {
    expect(errorAction(2, 3, 'off')).toEqual({ kind: 'stop' });
  });

  it('does NOT replay the same (broken) track on one-repeat — advances instead', () => {
    // replaying the failing video would loop the error; move on instead
    expect(errorAction(1, 3, 'one')).toEqual({ kind: 'play', index: 2 });
  });

  it('one-repeat on the last track stops instead of replaying the broken track', () => {
    expect(errorAction(2, 3, 'one')).toEqual({ kind: 'stop' });
  });

  it('wraps with all-repeat', () => {
    expect(errorAction(2, 3, 'all')).toEqual({ kind: 'play', index: 0 });
  });

  it('stops on an empty queue', () => {
    expect(errorAction(0, 0, 'off')).toEqual({ kind: 'stop' });
  });
});
