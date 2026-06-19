import { beforeEach, describe, expect, it } from 'vitest';
import type { Playlist, Song } from '../types';
import { PLAYLISTS_KEY, SONGS_KEY } from './storage';

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
