import { describe, it, expect } from 'vitest';
import { isPlayingFromState } from './PlaybackContext';
import { YT_STATE } from '../lib/ytPlayer';

describe('isPlayingFromState', () => {
  it('PLAYING -> true', () => {
    expect(isPlayingFromState(YT_STATE.PLAYING)).toBe(true);
  });

  it('PAUSED -> false', () => {
    expect(isPlayingFromState(YT_STATE.PAUSED)).toBe(false);
  });

  it('ENDED -> false', () => {
    expect(isPlayingFromState(YT_STATE.ENDED)).toBe(false);
  });

  it('BUFFERING -> null (no change, avoids flicker on transitions)', () => {
    expect(isPlayingFromState(YT_STATE.BUFFERING)).toBeNull();
  });

  it('UNSTARTED -> null (no change)', () => {
    expect(isPlayingFromState(YT_STATE.UNSTARTED)).toBeNull();
  });

  it('CUED -> null (no change)', () => {
    expect(isPlayingFromState(YT_STATE.CUED)).toBeNull();
  });
});
