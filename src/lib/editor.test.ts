import { describe, expect, it } from 'vitest';
import type { Song } from '../types';
import { filterSongs, reorder } from './editor';

const song = (id: string, title: string, artist: string): Song => ({
  id,
  title,
  artist,
  durationSec: 100,
  cover: 'c',
  colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 },
  resolvedAt: '2026-06-20',
});

describe('filterSongs', () => {
  const songs = [
    song('a', 'Spring Day', 'BTS'),
    song('b', '봄날', '방탄소년단'),
    song('c', 'Dynamite', 'BTS'),
  ];

  it('returns the full list (identity) for an empty query', () => {
    expect(filterSongs(songs, '')).toBe(songs);
  });

  it('returns the full list for a whitespace-only query', () => {
    expect(filterSongs(songs, '   ')).toBe(songs);
  });

  it('matches on title (case-insensitive substring)', () => {
    expect(filterSongs(songs, 'spring').map((s) => s.id)).toEqual(['a']);
    expect(filterSongs(songs, 'DYN').map((s) => s.id)).toEqual(['c']);
  });

  it('matches on artist', () => {
    expect(filterSongs(songs, 'bts').map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('matches Korean title/artist substrings', () => {
    expect(filterSongs(songs, '봄').map((s) => s.id)).toEqual(['b']);
    expect(filterSongs(songs, '방탄').map((s) => s.id)).toEqual(['b']);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(filterSongs(songs, '  bts  ').map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterSongs(songs, 'zzz')).toEqual([]);
  });
});

describe('reorder', () => {
  const ids = ['x', 'y', 'z', 'w'];

  it('moves an item down', () => {
    expect(reorder(ids, 0, 2)).toEqual(['y', 'z', 'x', 'w']);
  });

  it('moves an item up', () => {
    expect(reorder(ids, 3, 1)).toEqual(['x', 'w', 'y', 'z']);
  });

  it('moves an adjacent item (one step)', () => {
    expect(reorder(ids, 1, 2)).toEqual(['x', 'z', 'y', 'w']);
  });

  it('is a no-op when from === to (returns original reference)', () => {
    expect(reorder(ids, 2, 2)).toBe(ids);
  });

  it('returns the original reference when from is out of range', () => {
    expect(reorder(ids, -1, 1)).toBe(ids);
    expect(reorder(ids, 4, 1)).toBe(ids);
  });

  it('returns the original reference when to is out of range', () => {
    expect(reorder(ids, 0, -1)).toBe(ids);
    expect(reorder(ids, 0, 4)).toBe(ids);
  });

  it('does not mutate the input array', () => {
    const copy = [...ids];
    reorder(ids, 0, 3);
    expect(ids).toEqual(copy);
  });
});
