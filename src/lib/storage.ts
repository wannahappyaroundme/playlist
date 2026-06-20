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

/** writeJson 실패(주로 localStorage 용량 초과)를 UI가 잡을 수 있게 던지는 타입드 에러. */
export class StorageWriteError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageWriteError';
    this.cause = cause;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // QuotaExceededError 등 setItem 실패를 조용히 삼키지 않고 타입드 에러로 표면화한다.
    throw new StorageWriteError(
      '저장 공간이 부족하거나 저장에 실패했어요. (브라우저 저장 용량 초과)',
      err,
    );
  }
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

// --- Backup: export / import -------------------------------------------------
// 모든 데이터는 기기별 localStorage에 있어 캐시 삭제/기기 변경/iOS ITP로 사라질 수 있다.
// 백업 파일(JSON)로 내보내고 다시 가져와 복구한다.

export const BACKUP_VERSION = 1 as const;

export interface BackupPayload {
  version: typeof BACKUP_VERSION;
  songs: Record<string, Song>;
  playlists: Playlist[];
}

/** 현재 풀(songs) + 플레이리스트 전체를 백업용 JSON 문자열로 직렬화한다. */
export function exportAll(): string {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    songs: loadSongs(),
    playlists: loadPlaylists(),
  };
  return JSON.stringify(payload);
}

/** importAll이 던지는, 모양/JSON이 잘못된 백업 파일 에러. */
export class BackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupParseError';
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateBackup(data: unknown): BackupPayload {
  if (!isPlainObject(data)) {
    throw new BackupParseError('백업 파일 형식이 올바르지 않아요.');
  }
  const { songs, playlists } = data as { songs?: unknown; playlists?: unknown };
  if (!isPlainObject(songs)) {
    throw new BackupParseError('백업 파일에 곡 정보(songs)가 없거나 형식이 잘못됐어요.');
  }
  if (!Array.isArray(playlists)) {
    throw new BackupParseError('백업 파일에 플레이리스트 정보(playlists)가 없거나 형식이 잘못됐어요.');
  }
  return {
    version: BACKUP_VERSION,
    songs: songs as Record<string, Song>,
    playlists: playlists as Playlist[],
  };
}

/**
 * 백업 JSON을 파싱·검증해 storage에 기록한다.
 * - merge(기본): songs는 id로 합치고(가져온 값 우선), playlists는 id 충돌을 피해 새 slug로 덧붙인다.
 * - merge:false: 기존 songs/playlists를 전부 대체한다.
 * 잘못된 JSON/모양은 BackupParseError로, 저장 실패는 StorageWriteError로 던진다.
 */
export function importAll(
  json: string,
  opts: { merge?: boolean } = {},
): { songs: number; playlists: number } {
  const merge = opts.merge ?? true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupParseError('파일을 읽을 수 없어요. (올바른 JSON 백업 파일이 아니에요)');
  }
  const backup = validateBackup(parsed);

  if (!merge) {
    writeJson(SONGS_KEY, backup.songs);
    writeJson(PLAYLISTS_KEY, backup.playlists);
    return {
      songs: Object.keys(backup.songs).length,
      playlists: backup.playlists.length,
    };
  }

  // songs: id 기준 합집합 — 가져온 값이 기존 값을 덮어쓴다.
  const mergedSongs = { ...loadSongs(), ...backup.songs };

  // playlists: id 충돌이면 새 slug를 붙여 덧붙인다(기존 것을 잃지 않게).
  const existing = loadPlaylists();
  const usedIds = new Set(existing.map((p) => p.id));
  const appended: Playlist[] = [];
  for (const p of backup.playlists) {
    let id = p.id;
    while (!id || usedIds.has(id)) {
      id = makeSlug(p.title || 'list');
    }
    usedIds.add(id);
    appended.push({ ...p, id });
  }
  const mergedPlaylists = [...existing, ...appended];

  writeJson(SONGS_KEY, mergedSongs);
  writeJson(PLAYLISTS_KEY, mergedPlaylists);
  return {
    songs: Object.keys(backup.songs).length,
    playlists: appended.length,
  };
}
