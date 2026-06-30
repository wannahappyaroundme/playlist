import { describe, it, expect } from 'vitest';
import { hasDisplayableLyrics } from './lyrics';
import type { SongLyrics } from '../types';

const L = (p: Partial<SongLyrics> & Pick<SongLyrics, 'type'>): SongLyrics => ({
  source: 'lrclib',
  offsetMs: 0,
  ...p,
});

describe('hasDisplayableLyrics', () => {
  it('true for synced with at least one line', () => {
    expect(hasDisplayableLyrics(L({ type: 'synced', synced: [{ time: 0, text: 'a' }] }))).toBe(true);
  });

  it('false for synced with no lines (empty or missing)', () => {
    expect(hasDisplayableLyrics(L({ type: 'synced', synced: [] }))).toBe(false);
    expect(hasDisplayableLyrics(L({ type: 'synced' }))).toBe(false);
  });

  it('true for plain with text, false for empty/whitespace/missing', () => {
    expect(hasDisplayableLyrics(L({ type: 'plain', plain: 'hi' }))).toBe(true);
    expect(hasDisplayableLyrics(L({ type: 'plain', plain: '   ' }))).toBe(false);
    expect(hasDisplayableLyrics(L({ type: 'plain' }))).toBe(false);
  });

  it('false for none', () => {
    expect(hasDisplayableLyrics(L({ type: 'none', source: 'none' }))).toBe(false);
  });
});
