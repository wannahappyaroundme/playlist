import { beforeEach, describe, expect, it } from 'vitest';
import type { Playlist, Song } from '../types';
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  getSong,
  loadSongs,
  saveSong,
} from './storage';

// --- shared fixtures (reused by later tasks in this file) ---
export function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'abc12345678',
    title: 'Test Title',
    artist: 'Test Artist',
    durationSec: 200,
    cover: 'https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg',
    colors: { gradientFrom: '#101522', gradientTo: '#070912', accent: '#7c5cff' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 'my-list-ab12',
    title: 'My List',
    message: undefined,
    coverVideoId: undefined,
    songIds: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('storage keys', () => {
  it('uses versioned localStorage keys', () => {
    expect(SONGS_KEY).toBe('yejin.songs.v1');
    expect(PLAYLISTS_KEY).toBe('yejin.playlists.v1');
  });
});

describe('song pool CRUD', () => {
  it('returns empty record when nothing stored', () => {
    expect(loadSongs()).toEqual({});
  });

  it('returns empty record when stored JSON is corrupt', () => {
    localStorage.setItem(SONGS_KEY, '{not-json');
    expect(loadSongs()).toEqual({});
  });

  it('saveSong persists keyed by song id and getSong reads it back', () => {
    const song = makeSong({ id: 'xyz98765432', title: 'Saved' });
    saveSong(song);
    expect(getSong('xyz98765432')).toEqual(song);
    expect(loadSongs()).toEqual({ xyz98765432: song });
  });

  it('saveSong with same id overwrites previous entry', () => {
    saveSong(makeSong({ id: 'dup00000000', title: 'First' }));
    saveSong(makeSong({ id: 'dup00000000', title: 'Second' }));
    expect(getSong('dup00000000')?.title).toBe('Second');
    expect(Object.keys(loadSongs())).toHaveLength(1);
  });

  it('getSong returns undefined for unknown id', () => {
    expect(getSong('nope0000000')).toBeUndefined();
  });
});
