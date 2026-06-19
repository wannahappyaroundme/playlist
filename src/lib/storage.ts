import type { Playlist, Song } from '../types';

export const SONGS_KEY = 'yejin.songs.v1';
export const PLAYLISTS_KEY = 'yejin.playlists.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSongs(): Record<string, Song> {
  const data = readJson<Record<string, Song>>(SONGS_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

export function getSong(id: string): Song | undefined {
  return loadSongs()[id];
}

export function saveSong(song: Song): void {
  const songs = loadSongs();
  songs[song.id] = song;
  writeJson(SONGS_KEY, songs);
}

export function loadPlaylists(): Playlist[] {
  const data = readJson<Playlist[]>(PLAYLISTS_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function getPlaylist(id: string): Playlist | undefined {
  return loadPlaylists().find((p) => p.id === id);
}

export function savePlaylist(p: Playlist): void {
  const all = loadPlaylists();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    all[idx] = p;
  } else {
    all.push(p);
  }
  writeJson(PLAYLISTS_KEY, all);
}

export function deletePlaylist(id: string): void {
  const all = loadPlaylists().filter((p) => p.id !== id);
  writeJson(PLAYLISTS_KEY, all);
}

function randSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function makeSlug(title: string, rand: () => string = randSuffix): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '') // keep ascii alnum, Hangul, space, hyphen
      .replace(/[\s-]+/g, '-') // collapse spaces/hyphens to single hyphen
      .replace(/^-+|-+$/g, '') || // trim edge hyphens
    'list';
  return `${stem}-${rand()}`;
}

export function createPlaylist(
  title: string,
  opts: { now?: () => string; rand?: () => string } = {},
): Playlist {
  return {
    id: makeSlug(title, opts.rand),
    title,
    songIds: [],
    createdAt: opts.now ? opts.now() : new Date().toISOString(),
  };
}
