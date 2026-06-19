import { describe, it, expect } from 'vitest';
import { assembleSong } from './useSongResolver';
import type { SongColors, SongLyrics } from '../types';

const colors: SongColors = { gradientFrom: '#101820', gradientTo: '#05080c', accent: '#7c5cff' };
const lyrics: SongLyrics = { type: 'none', source: 'none', offsetMs: 0 };

describe('assembleSong', () => {
  it('assembles a Song using parseTitleHeuristic and injected now', () => {
    const song = assembleSong({
      videoId: 'abc12345678',
      rawTitle: 'IU - Through the Night (Official MV)',
      author: 'IU Official',
      durationSec: 215,
      cover: 'https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg',
      colors,
      lyrics,
      now: () => '2026-06-20T00:00:00.000Z',
    });
    expect(song.id).toBe('abc12345678');
    // heuristic splits "Artist - Title (...)" → artist=IU, title=Through the Night
    expect(song.artist).toBe('IU');
    expect(song.title).toBe('Through the Night');
    expect(song.durationSec).toBe(215);
    expect(song.cover).toBe('https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg');
    expect(song.colors).toEqual(colors);
    expect(song.lyrics).toEqual(lyrics);
    expect(song.resolvedAt).toBe('2026-06-20T00:00:00.000Z');
  });

  it('falls back to ISO now when no now() injected', () => {
    const song = assembleSong({
      videoId: 'xyz98765432',
      rawTitle: 'some random clip',
      author: 'Some Channel',
      durationSec: 100,
      cover: 'c',
      colors,
      lyrics,
    });
    // no " - " → artist = author, title = cleaned rawTitle
    expect(song.artist).toBe('Some Channel');
    expect(song.title).toBe('some random clip');
    expect(typeof song.resolvedAt).toBe('string');
    expect(song.resolvedAt.length).toBeGreaterThan(0);
  });
});
