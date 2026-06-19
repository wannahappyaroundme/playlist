import { describe, it, expect } from 'vitest';
import type {
  RepeatMode,
  LyricsType,
  LyricLine,
  SongColors,
  SongLyrics,
  Song,
  Playlist,
  SharedPlaylist,
} from './types';

describe('domain types', () => {
  it('allows constructing each shape per contract', () => {
    const repeat: RepeatMode[] = ['off', 'all', 'one'];
    const ltype: LyricsType[] = ['synced', 'plain', 'none'];

    const line: LyricLine = { time: 12.5, text: 'hello' };
    const colors: SongColors = {
      gradientFrom: '#111133',
      gradientTo: '#000022',
      accent: '#88aaff',
    };
    const lyrics: SongLyrics = {
      type: 'synced',
      synced: [line],
      source: 'lrclib',
      offsetMs: 0,
    };
    const song: Song = {
      id: 'dQw4w9WgXcQ',
      title: 'Title',
      artist: 'Artist',
      durationSec: 213,
      cover: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      colors,
      lyrics,
      resolvedAt: '2026-06-20T00:00:00.000Z',
    };
    const playlist: Playlist = {
      id: 'my-list-ab12',
      title: 'My List',
      message: 'for you',
      coverVideoId: 'dQw4w9WgXcQ',
      songIds: ['dQw4w9WgXcQ'],
      createdAt: '2026-06-20T00:00:00.000Z',
    };
    const shared: SharedPlaylist = {
      title: 'Shared',
      songs: [{ id: 'dQw4w9WgXcQ', title: 'Title' }, { id: 'abc12345678' }],
    };

    expect(repeat).toHaveLength(3);
    expect(ltype).toHaveLength(3);
    expect(line.time).toBe(12.5);
    expect(colors.accent).toBe('#88aaff');
    expect(lyrics.offsetMs).toBe(0);
    expect(song.durationSec).toBe(213);
    expect(playlist.songIds).toContain('dQw4w9WgXcQ');
    expect(shared.songs).toHaveLength(2);
  });
});
