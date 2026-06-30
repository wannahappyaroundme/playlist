import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaSession } from './useMediaSession';
import type { Song } from '../types';

const song = (): Song => ({
  id: 'x9upuovB5Yk',
  title: 'T',
  artist: 'A',
  durationSec: 100,
  cover: 'c.jpg',
  colors: { gradientFrom: '#000', gradientTo: '#111', accent: '#222' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 },
  resolvedAt: '2026-06-21',
});

describe('useMediaSession', () => {
  let handlers: Record<string, () => void>;
  // 느슨한 타입 — 실제 MediaSession 타입과 맞출 필요 없이 런타임 동작만 검증한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ms: any;

  beforeEach(() => {
    handlers = {};
    ms = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn((a: string, h: (() => void) | null) => {
        if (h) handlers[a] = h;
        else delete handlers[a];
      }),
    };
    Object.defineProperty(navigator, 'mediaSession', { value: ms, configurable: true });
    (window as unknown as { MediaMetadata: unknown }).MediaMetadata = class {
      init: unknown;
      constructor(init: unknown) {
        this.init = init;
      }
    };
  });
  afterEach(() => {
    delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
    delete (window as unknown as { MediaMetadata?: unknown }).MediaMetadata;
    vi.restoreAllMocks();
  });

  const noop = { onPlay: vi.fn(), onPause: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() };

  it('sets metadata (title/artist) from the current song', () => {
    renderHook(() => useMediaSession(song(), true, { ...noop }));
    expect(ms.metadata).toBeTruthy();
    expect((ms.metadata as { init: { title: string; artist: string } }).init.title).toBe('T');
    expect((ms.metadata as { init: { title: string; artist: string } }).init.artist).toBe('A');
  });

  it('registers play/pause/prev/next handlers that call back', () => {
    const onPlay = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    renderHook(() => useMediaSession(song(), true, { onPlay, onPause: vi.fn(), onNext, onPrev }));
    expect(ms.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    handlers.play();
    handlers.nexttrack();
    handlers.previoustrack();
    expect(onPlay).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
    expect(onPrev).toHaveBeenCalled();
  });

  it('reflects playback state', () => {
    renderHook(() => useMediaSession(song(), true, { ...noop }));
    expect(ms.playbackState).toBe('playing');
  });

  it('no-ops (no throw) when navigator.mediaSession is unavailable', () => {
    delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
    expect(() => renderHook(() => useMediaSession(song(), true, { ...noop }))).not.toThrow();
  });
});
