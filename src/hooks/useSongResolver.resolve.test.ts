import { describe, it, expect, vi } from 'vitest';
import { resolveSongWith, type ResolveDeps } from './useSongResolver';
import type { RawPalette } from '../lib/colors';

function makeDeps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    getMeta: vi.fn(async () => ({
      video_id: 'abc12345678',
      title: 'IU - Through the Night (Official MV)',
      author: 'IU Official',
      durationSec: 215,
    })),
    resolveCover: vi.fn(async (id: string) => `https://i.ytimg.com/vi/${id}/sddefault.jpg`),
    extractPalette: vi.fn(async (): Promise<RawPalette> => ({
      vibrant: '#7c5cff',
      darkVibrant: '#2a1f55',
      muted: '#445566',
    })),
    fetchLyrics: vi.fn(async () => ({
      syncedLyrics: '[00:01.00]hello\n[00:03.50]world',
      plainLyrics: 'hello\nworld',
    })),
    saveSong: vi.fn(),
    now: () => '2026-06-20T00:00:00.000Z',
    ...over,
  };
}

describe('resolveSongWith', () => {
  it('resolves a full Song through the pipeline and saves it', async () => {
    const deps = makeDeps();
    const song = await resolveSongWith('abc12345678', deps);

    expect(deps.getMeta).toHaveBeenCalledWith('abc12345678');
    // cover URL is the best-available thumbnail for the id (fallback chain)
    expect(song.cover).toContain('abc12345678');
    expect(song.id).toBe('abc12345678');
    expect(song.artist).toBe('IU');
    expect(song.title).toBe('Through the Night');
    expect(song.durationSec).toBe(215);
    expect(song.lyrics.type).toBe('synced');
    expect(song.lyrics.synced!.length).toBe(2);
    // colors came from buildSongColors (accent should reflect vibrant family, non-fallback)
    expect(song.colors.accent).toBeTruthy();
    // fetchLyrics called with parsed artist/track + duration
    expect(deps.fetchLyrics).toHaveBeenCalledWith({
      artist: 'IU',
      track: 'Through the Night',
      durationSec: 215,
    });
    expect(deps.saveSong).toHaveBeenCalledTimes(1);
    expect((deps.saveSong as any).mock.calls[0][0].id).toBe('abc12345678');
  });

  it('falls back to FALLBACK_COLORS when palette extraction throws', async () => {
    const { FALLBACK_COLORS } = await import('../lib/colors');
    const deps = makeDeps({
      extractPalette: vi.fn(async () => {
        throw new Error('CORS taint');
      }),
    });
    const song = await resolveSongWith('abc12345678', deps);
    expect(song.colors).toEqual(FALLBACK_COLORS);
  });

  it('produces lyrics type none when fetchLyrics returns null', async () => {
    const deps = makeDeps({ fetchLyrics: vi.fn(async () => null) });
    const song = await resolveSongWith('abc12345678', deps);
    expect(song.lyrics.type).toBe('none');
    expect(song.lyrics.source).toBe('none');
  });
});
