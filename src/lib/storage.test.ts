import { beforeEach, describe, expect, it } from 'vitest';
import type { Playlist, Song } from '../types';
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getSong,
  loadPlaylists,
  loadSongs,
  makeSlug,
  savePlaylist,
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

describe('playlist CRUD', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadPlaylists()).toEqual([]);
  });

  it('returns empty array when stored JSON is corrupt', () => {
    localStorage.setItem(PLAYLISTS_KEY, 'broken[');
    expect(loadPlaylists()).toEqual([]);
  });

  it('savePlaylist appends a new playlist', () => {
    const p = makePlaylist({ id: 'a-1111' });
    savePlaylist(p);
    expect(loadPlaylists()).toEqual([p]);
  });

  it('savePlaylist replaces an existing playlist with same id in place', () => {
    savePlaylist(makePlaylist({ id: 'a-1111', title: 'One' }));
    savePlaylist(makePlaylist({ id: 'b-2222', title: 'Two' }));
    savePlaylist(makePlaylist({ id: 'a-1111', title: 'One v2' }));
    const all = loadPlaylists();
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('One v2'); // replaced in original position
    expect(all[1].title).toBe('Two');
  });

  it('getPlaylist returns the matching playlist or undefined', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    expect(getPlaylist('a-1111')?.id).toBe('a-1111');
    expect(getPlaylist('missing')).toBeUndefined();
  });

  it('deletePlaylist removes only the matching playlist', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    savePlaylist(makePlaylist({ id: 'b-2222' }));
    deletePlaylist('a-1111');
    const all = loadPlaylists();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('b-2222');
  });

  it('deletePlaylist on unknown id is a no-op', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    deletePlaylist('nope');
    expect(loadPlaylists()).toHaveLength(1);
  });
});

describe('makeSlug', () => {
  const rand = () => 'wxyz';

  it('lowercases ascii and joins words with hyphens, appending rand suffix', () => {
    expect(makeSlug('My Cool Mix', rand)).toBe('my-cool-mix-wxyz');
  });

  it('keeps Korean characters and collapses spaces', () => {
    expect(makeSlug('예진 플레이리스트', rand)).toBe('예진-플레이리스트-wxyz');
  });

  it('strips punctuation and other symbols', () => {
    expect(makeSlug('Hello, World! (2026)', rand)).toBe('hello-world-2026-wxyz');
  });

  it('collapses repeated and trims edge separators', () => {
    expect(makeSlug('  ---night   lounge---  ', rand)).toBe('night-lounge-wxyz');
  });

  it('falls back to "list" stem when nothing usable remains', () => {
    expect(makeSlug('!!!', rand)).toBe('list-wxyz');
    expect(makeSlug('', rand)).toBe('list-wxyz');
  });

  it('default rand produces a 4-char alnum suffix', () => {
    const slug = makeSlug('abc');
    expect(slug).toMatch(/^abc-[a-z0-9]{4}$/);
  });
});

describe('createPlaylist', () => {
  it('builds a deterministic playlist from injected now/rand', () => {
    const p = createPlaylist('Night Lounge', {
      now: () => '2026-06-20T12:00:00.000Z',
      rand: () => 'abcd',
    });
    expect(p).toEqual({
      id: 'night-lounge-abcd',
      title: 'Night Lounge',
      songIds: [],
      createdAt: '2026-06-20T12:00:00.000Z',
    });
  });

  it('uses current ISO time when now is not injected', () => {
    const before = Date.now();
    const p = createPlaylist('x', { rand: () => 'rrrr' });
    const created = Date.parse(p.createdAt);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(p.id).toBe('x-rrrr');
    expect(p.songIds).toEqual([]);
  });

  it('does not persist by itself (loadPlaylists stays empty)', () => {
    createPlaylist('y', { rand: () => 'zzzz' });
    expect(loadPlaylists()).toEqual([]);
  });
});
