import { describe, it, expect, vi } from 'vitest';
import { metaPollDone, resolveSongWith, type ResolveDeps } from './useSongResolver';
import type { RawPalette } from '../lib/colors';

describe('metaPollDone (probe poll exit condition)', () => {
  const data = (over: Partial<{ video_id: string; title: string }> = {}) => ({
    video_id: 'abc12345678',
    title: 'Some Title',
    author: 'Chan',
    ...over,
  });

  it('finishes only when video_id + title + dur>0 are all present', () => {
    expect(metaPollDone(data(), 200, 100, 8000)).toBe(true);
  });

  it('does NOT finish when title is still empty (even with video_id + dur)', () => {
    expect(metaPollDone(data({ title: '' }), 200, 100, 8000)).toBe(false);
  });

  it('does NOT finish on CUED-like state when dur is 0', () => {
    expect(metaPollDone(data(), 0, 100, 8000)).toBe(false);
  });

  it('does NOT finish when video_id missing', () => {
    expect(metaPollDone(data({ video_id: '' }), 200, 100, 8000)).toBe(false);
  });

  it('finishes on timeout regardless of metadata (so it never hangs)', () => {
    expect(metaPollDone(data({ title: '' }), 0, 8001, 8000)).toBe(true);
  });

  it('handles null data without throwing', () => {
    expect(metaPollDone(null, 200, 100, 8000)).toBe(false);
  });
});

function makeDeps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    getMeta: vi.fn(async () => ({
      video_id: 'abc12345678',
      title: 'IU - Through the Night',
      author: 'IU Official',
      durationSec: 215,
      metaReady: true,
    })),
    extractPalette: vi.fn(async (): Promise<RawPalette> => ({ vibrant: '#7c5cff' })),
    fetchLyrics: vi.fn(async () => null),
    saveSong: vi.fn(),
    now: () => '2026-06-20T00:00:00.000Z',
    ...over,
  };
}

describe('resolveSongWith metaReady guard', () => {
  it('throws and does NOT save when metaReady is false (empty meta)', async () => {
    const deps = makeDeps({
      getMeta: vi.fn(async () => ({
        video_id: 'abc12345678',
        title: '',
        author: '',
        durationSec: 0,
        metaReady: false,
      })),
    });
    await expect(resolveSongWith('abc12345678', deps)).rejects.toThrow();
    expect(deps.saveSong).not.toHaveBeenCalled();
  });

  it('saves normally when metaReady is true', async () => {
    const deps = makeDeps();
    const song = await resolveSongWith('abc12345678', deps);
    expect(song.id).toBe('abc12345678');
    expect(deps.saveSong).toHaveBeenCalledTimes(1);
  });
});
