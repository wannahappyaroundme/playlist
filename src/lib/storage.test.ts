import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Playlist, Song } from '../types';
import {
  BackupParseError,
  PLAYLISTS_KEY,
  SONGS_KEY,
  StorageWriteError,
  createPlaylist,
  deletePlaylist,
  exportAll,
  getPlaylist,
  getSong,
  importAll,
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

describe('backup export / import', () => {
  it('exportAll round-trips songs + playlists through importAll (replace)', () => {
    const s = makeSong({ id: 'song0000001', title: 'Backed Up' });
    const p = makePlaylist({ id: 'pl-aaaa', title: 'List A', songIds: ['song0000001'] });
    saveSong(s);
    savePlaylist(p);

    const json = exportAll();
    // wipe storage, then import back with merge:false (replace)
    localStorage.clear();
    expect(loadSongs()).toEqual({});
    expect(loadPlaylists()).toEqual([]);

    const counts = importAll(json, { merge: false });
    expect(counts).toEqual({ songs: 1, playlists: 1 });
    expect(getSong('song0000001')).toEqual(s);
    expect(getPlaylist('pl-aaaa')).toEqual(p);
  });

  it('exportAll serializes the current pool + playlists with version 1', () => {
    saveSong(makeSong({ id: 'song0000001' }));
    savePlaylist(makePlaylist({ id: 'pl-aaaa' }));
    const parsed = JSON.parse(exportAll());
    expect(parsed.version).toBe(1);
    expect(parsed.songs).toHaveProperty('song0000001');
    expect(parsed.playlists).toHaveLength(1);
  });

  it('importAll merges songs by id (imported value wins) by default', () => {
    saveSong(makeSong({ id: 'keep0000001', title: 'Existing Keep' }));
    saveSong(makeSong({ id: 'over0000001', title: 'Old Value' }));
    const json = JSON.stringify({
      version: 1,
      songs: {
        over0000001: makeSong({ id: 'over0000001', title: 'New Value' }),
        new00000001: makeSong({ id: 'new00000001', title: 'Fresh' }),
      },
      playlists: [],
    });
    const counts = importAll(json); // merge defaults to true
    expect(counts.songs).toBe(2);
    expect(getSong('keep0000001')?.title).toBe('Existing Keep'); // untouched
    expect(getSong('over0000001')?.title).toBe('New Value'); // overwritten
    expect(getSong('new00000001')?.title).toBe('Fresh'); // added
  });

  it('importAll merge appends playlists, re-slugging on id collision', () => {
    savePlaylist(makePlaylist({ id: 'pl-aaaa', title: 'Original' }));
    const json = JSON.stringify({
      version: 1,
      songs: {},
      playlists: [makePlaylist({ id: 'pl-aaaa', title: 'Imported Same Id' })],
    });
    const counts = importAll(json);
    expect(counts.playlists).toBe(1);
    const all = loadPlaylists();
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('Original');
    expect(all[0].id).toBe('pl-aaaa');
    // appended one kept its data but got a fresh, non-colliding id
    const imported = all[1];
    expect(imported.title).toBe('Imported Same Id');
    expect(imported.id).not.toBe('pl-aaaa');
  });

  it('importAll throws BackupParseError on malformed JSON', () => {
    expect(() => importAll('{not json')).toThrow(BackupParseError);
  });

  it('importAll throws BackupParseError on wrong shape', () => {
    expect(() => importAll(JSON.stringify({ version: 1 }))).toThrow(BackupParseError);
    expect(() => importAll(JSON.stringify({ songs: [], playlists: [] }))).toThrow(BackupParseError);
    expect(() => importAll(JSON.stringify({ songs: {}, playlists: {} }))).toThrow(BackupParseError);
  });

  it('writeJson surfaces QuotaExceededError as StorageWriteError', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      expect(() => saveSong(makeSong())).toThrow(StorageWriteError);
    } finally {
      spy.mockRestore();
    }
  });
});
