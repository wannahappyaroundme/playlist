import { describe, it, expect, vi } from 'vitest';
import {
  parseVideoId,
  thumbnailUrl,
  THUMB_FALLBACK,
  parseTitleHeuristic,
  resolveBestThumbnail,
  fallbackCoverSrc,
  isVideoId,
  ID_RE,
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

describe('resolveBestThumbnail', () => {
  const ID = 'dQw4w9WgXcQ';
  // fake image loader: map URL -> naturalWidth, or reject (load error)
  const loader = (widths: Record<string, number>) =>
    vi.fn(async (url: string) => {
      const w = widths[url];
      if (w === undefined) throw new Error('404');
      return { naturalWidth: w, naturalHeight: Math.round((w * 9) / 16) } as HTMLImageElement;
    });

  it('returns the first quality that loads with a real image', async () => {
    const load = loader({
      [thumbnailUrl(ID, 'maxresdefault')]: 1280,
    });
    expect(await resolveBestThumbnail(ID, load)).toBe(thumbnailUrl(ID, 'maxresdefault'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('falls through on load error (404) to the next quality', async () => {
    const load = loader({
      // maxres + sd 404 (absent), hq exists
      [thumbnailUrl(ID, 'hqdefault')]: 480,
    });
    expect(await resolveBestThumbnail(ID, load)).toBe(thumbnailUrl(ID, 'hqdefault'));
  });

  it('treats a placeholder (naturalWidth <= 120) as failure and falls through', async () => {
    const load = loader({
      [thumbnailUrl(ID, 'maxresdefault')]: 120, // grey placeholder
      [thumbnailUrl(ID, 'sddefault')]: 640,
    });
    expect(await resolveBestThumbnail(ID, load)).toBe(thumbnailUrl(ID, 'sddefault'));
  });

  it('falls back to hqdefault when every quality fails', async () => {
    const load = loader({}); // all reject
    expect(await resolveBestThumbnail(ID, load)).toBe(thumbnailUrl(ID, 'hqdefault'));
  });

  it('tries qualities in THUMB_FALLBACK order', async () => {
    const seen: string[] = [];
    const load = vi.fn(async (url: string) => {
      seen.push(url);
      throw new Error('404');
    });
    await resolveBestThumbnail(ID, load);
    expect(seen).toEqual(THUMB_FALLBACK.map((q) => thumbnailUrl(ID, q)));
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

  it('parses real Korean lyric-video title with fullwidth pipe ㅣ + duplicated bracket', () => {
    expect(
      parseTitleHeuristic('빈첸 - FLYING HIGH WITH U [FLYING HIGH WITH U]ㅣLyrics/가사', '알파'),
    ).toEqual({ artist: '빈첸', title: 'FLYING HIGH WITH U' });
  });

  it('strips bracketed segments even when they are not keyword noise', () => {
    expect(parseTitleHeuristic('Artist - Song [Some Extra]', 'Chan')).toEqual({
      artist: 'Artist',
      title: 'Song',
    });
  });

  it('strips a trailing fullwidth-pipe lyrics suffix on a Korean title', () => {
    expect(parseTitleHeuristic('가수 - 노래 [노래]ㅣ가사', '채널')).toEqual({
      artist: '가수',
      title: '노래',
    });
  });

  it('handles "Song [MV]" with no artist separator (author fallback)', () => {
    expect(parseTitleHeuristic('Song [MV]', 'BandChannel')).toEqual({
      artist: 'BandChannel',
      title: 'Song',
    });
  });

  it('keeps a clean "A - B" intact', () => {
    expect(parseTitleHeuristic('A - B', 'Chan')).toEqual({ artist: 'A', title: 'B' });
  });

  it('falls back to author for a title with no separator', () => {
    expect(parseTitleHeuristic('JustOneName', 'TheAuthor')).toEqual({
      artist: 'TheAuthor',
      title: 'JustOneName',
    });
  });
});

describe('isVideoId / ID_RE', () => {
  it('ID_RE matches exactly 11 url-safe chars', () => {
    expect(ID_RE.test('dQw4w9WgXcQ')).toBe(true);
    expect(ID_RE.test('short')).toBe(false);
    expect(ID_RE.test('toolongtoolong')).toBe(false);
  });
  it('isVideoId rejects non-strings and bad shapes', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('b_c-d123456')).toBe(true);
    expect(isVideoId('')).toBe(false);
    expect(isVideoId(null)).toBe(false);
    expect(isVideoId(undefined)).toBe(false);
    expect(isVideoId('has space!!')).toBe(false);
  });
});

describe('fallbackCoverSrc', () => {
  function mkImg(src: string): HTMLImageElement {
    const img = document.createElement('img');
    img.src = src;
    return img;
  }

  it('downgrades a ytimg maxres thumbnail to hqdefault on first error', () => {
    const img = mkImg('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    fallbackCoverSrc(img);
    expect(img.src).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(img.dataset.coverFallback).toBe('done');
  });

  it('is a no-op on the second call (no infinite loop)', () => {
    const img = mkImg('https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg');
    fallbackCoverSrc(img);
    const after = img.src;
    fallbackCoverSrc(img);
    expect(img.src).toBe(after);
  });

  it('leaves a non-ytimg src untouched but still flags it (one-shot)', () => {
    const img = mkImg('https://example.com/cover.png');
    fallbackCoverSrc(img);
    expect(img.src).toBe('https://example.com/cover.png');
    expect(img.dataset.coverFallback).toBe('done');
  });
});
