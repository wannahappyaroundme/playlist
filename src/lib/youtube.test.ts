import { describe, it, expect } from 'vitest';
import { parseVideoId } from './youtube';

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
