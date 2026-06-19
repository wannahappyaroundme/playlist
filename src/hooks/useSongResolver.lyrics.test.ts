import { describe, it, expect } from 'vitest';
import { buildSongLyrics } from './useSongResolver';

describe('buildSongLyrics', () => {
  it('builds synced lyrics from syncedLyrics via parseLrc', () => {
    const res = {
      syncedLyrics: '[offset:+500]\n[00:01.00]hello\n[00:03.50]world',
      plainLyrics: 'hello\nworld',
    };
    const out = buildSongLyrics(res);
    expect(out.type).toBe('synced');
    expect(out.source).toBe('lrclib');
    expect(out.synced).toBeDefined();
    expect(out.synced!.length).toBe(2);
    expect(out.synced![0]).toEqual({ time: 1, text: 'hello' });
    expect(out.synced![1]).toEqual({ time: 3.5, text: 'world' });
    expect(out.offsetMs).toBe(500);
  });

  it('falls back to plain lyrics when no synced lyrics', () => {
    const out = buildSongLyrics({ syncedLyrics: null, plainLyrics: 'just text' });
    expect(out.type).toBe('plain');
    expect(out.plain).toBe('just text');
    expect(out.source).toBe('lrclib');
    expect(out.offsetMs).toBe(0);
  });

  it('returns none when response is null', () => {
    const out = buildSongLyrics(null);
    expect(out.type).toBe('none');
    expect(out.source).toBe('none');
    expect(out.offsetMs).toBe(0);
  });

  it('returns none when both fields are empty', () => {
    const out = buildSongLyrics({ syncedLyrics: null, plainLyrics: null });
    expect(out.type).toBe('none');
    expect(out.source).toBe('none');
  });
});
