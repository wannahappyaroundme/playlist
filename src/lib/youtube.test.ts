import { describe, it, expect } from 'vitest';
import {
  parseVideoId,
  thumbnailUrl,
  THUMB_FALLBACK,
  parseTitleHeuristic,
} from './youtube';

describe('parseVideoId', () => {
  const ID = 'dQw4w9WgXcQ'; // valid 11-char id

  it('parses standard watch URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseVideoId(`http://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('parses watch URLs with extra query params in any order', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?list=PL123&v=${ID}&t=10s`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}&feature=share`)).toBe(ID);
  });

  it('parses youtu.be short links', () => {
    expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://youtu.be/${ID}?t=42`)).toBe(ID);
  });

  it('parses embed URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}?rel=0`)).toBe(ID);
  });

  it('parses shorts URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://youtube.com/shorts/${ID}?feature=share`)).toBe(ID);
  });

  it('accepts a raw 11-char id', () => {
    expect(parseVideoId(ID)).toBe(ID);
    expect(parseVideoId('_-aBcDeF120')).toBe('_-aBcDeF120');
  });

  it('trims surrounding whitespace', () => {
    expect(parseVideoId(`  https://youtu.be/${ID}  `)).toBe(ID);
    expect(parseVideoId(`\n${ID}\n`)).toBe(ID);
  });

  it('returns null for invalid or unrelated input', () => {
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('not a url')).toBeNull();
    expect(parseVideoId('https://vimeo.com/123456')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull(); // too short
    expect(parseVideoId('https://www.youtube.com/watch?v=waytoolongid12345')).toBeNull();
    expect(parseVideoId('abcdefghij')).toBeNull(); // 10 chars
    expect(parseVideoId('abcdefghij!!')).toBeNull(); // invalid chars
  });
});

describe('thumbnailUrl', () => {
  const ID = 'dQw4w9WgXcQ';

  it('defaults to maxresdefault', () => {
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`);
  });

  it('builds url for each explicit quality', () => {
    expect(thumbnailUrl(ID, 'sddefault')).toBe(`https://i.ytimg.com/vi/${ID}/sddefault.jpg`);
    expect(thumbnailUrl(ID, 'hqdefault')).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(thumbnailUrl(ID, 'mqdefault')).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
  });
});

describe('THUMB_FALLBACK', () => {
  it('lists qualities best-first', () => {
    expect(THUMB_FALLBACK).toEqual(['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']);
  });

  it('every entry produces a valid url', () => {
    const ID = 'dQw4w9WgXcQ';
    for (const q of THUMB_FALLBACK) {
      expect(thumbnailUrl(ID, q)).toBe(`https://i.ytimg.com/vi/${ID}/${q}.jpg`);
    }
  });
});

describe('parseTitleHeuristic', () => {
  it('splits "Artist - Title" on " - "', () => {
    expect(parseTitleHeuristic('IU - Blueming', 'IU Official')).toEqual({
      artist: 'IU',
      title: 'Blueming',
    });
  });

  it('strips (Official Video) and similar markers', () => {
    expect(parseTitleHeuristic('NewJeans - Ditto (Official Music Video)', 'HYBE LABELS')).toEqual({
      artist: 'NewJeans',
      title: 'Ditto',
    });
    expect(parseTitleHeuristic('aespa - Spicy (Official MV)', 'SMTOWN')).toEqual({
      artist: 'aespa',
      title: 'Spicy',
    });
  });

  it('strips bracketed markers like [MV], [Lyrics], [4K]', () => {
    expect(parseTitleHeuristic('BTS - Dynamite [MV]', 'HYBE LABELS')).toEqual({
      artist: 'BTS',
      title: 'Dynamite',
    });
    expect(parseTitleHeuristic('Adele - Hello [Official Audio]', 'AdeleVEVO')).toEqual({
      artist: 'Adele',
      title: 'Hello',
    });
  });

  it('uses only the first " - " as the split point', () => {
    expect(parseTitleHeuristic('A - B - C', 'Chan')).toEqual({
      artist: 'A',
      title: 'B - C',
    });
  });

  it('handles en-dash / em-dash separators', () => {
    expect(parseTitleHeuristic('Artist – Title', 'Chan')).toEqual({
      artist: 'Artist',
      title: 'Title',
    });
    expect(parseTitleHeuristic('Artist — Title', 'Chan')).toEqual({
      artist: 'Artist',
      title: 'Title',
    });
  });

  it('falls back to author when there is no separator', () => {
    expect(parseTitleHeuristic('Blueming (Official Video)', 'IU Official')).toEqual({
      artist: 'IU Official',
      title: 'Blueming',
    });
  });

  it('falls back to author when split would leave an empty side', () => {
    expect(parseTitleHeuristic(' - Title', 'Chan')).toEqual({
      artist: 'Chan',
      title: 'Title',
    });
    expect(parseTitleHeuristic('Artist - ', 'Chan')).toEqual({
      artist: 'Chan',
      title: 'Artist',
    });
  });

  it('trims whitespace on both sides', () => {
    expect(parseTitleHeuristic('  IU   -   Blueming  ', 'IU Official')).toEqual({
      artist: 'IU',
      title: 'Blueming',
    });
  });

  it('keeps a clean raw title when no markers and no separator', () => {
    expect(parseTitleHeuristic('Just A Song', 'Some Channel')).toEqual({
      artist: 'Some Channel',
      title: 'Just A Song',
    });
  });
});
