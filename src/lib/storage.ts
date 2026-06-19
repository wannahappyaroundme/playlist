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

void (null as unknown as Playlist);
