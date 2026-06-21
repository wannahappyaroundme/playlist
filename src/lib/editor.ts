import type { Song } from '../types';

/**
 * Case-insensitive substring filter over song title + artist.
 * Empty/whitespace-only query returns the original list (identity).
 */
export function filterSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
  );
}

/**
 * Return a new array with the item at `from` moved to `to`.
 * Out-of-range `from`/`to`, or `from === to`, return the original array unchanged.
 */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
