import { describe, it, expect } from 'vitest';
import { YT_STATE, buildPlayerVars } from './ytPlayer';

describe('YT_STATE', () => {
  it('exposes the YouTube IFrame player state codes', () => {
    expect(YT_STATE).toEqual({
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    });
  });
});

describe('buildPlayerVars', () => {
  it('enforces inline, no-controls, no-related, modest branding and origin', () => {
    const vars = buildPlayerVars('https://example.github.io');
    expect(vars).toEqual({
      playsinline: 1,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      origin: 'https://example.github.io',
    });
  });

  it('passes the given origin through verbatim', () => {
    expect(buildPlayerVars('http://localhost:5173').origin).toBe('http://localhost:5173');
  });
});
