import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from './colors';

describe('hexToRgb', () => {
  it('parses 6-digit hex with leading #', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
  });
  it('parses hex without #', () => {
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
  });
  it('expands 3-digit shorthand', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
  });
  it('is case-insensitive', () => {
    expect(hexToRgb('#ABCDEF')).toEqual([171, 205, 239]);
  });
});

describe('rgbToHex', () => {
  it('formats rgb to lowercase 6-digit hex with #', () => {
    expect(rgbToHex(255, 136, 0)).toBe('#ff8800');
  });
  it('zero-pads single digit channels', () => {
    expect(rgbToHex(0, 1, 2)).toBe('#000102');
  });
  it('clamps out-of-range channels to 0..255 and rounds', () => {
    expect(rgbToHex(-5, 300, 127.6)).toBe('#00ff80');
  });
});

describe('round-trip', () => {
  it('hexToRgb -> rgbToHex preserves value', () => {
    expect(rgbToHex(...hexToRgb('#13c2a3'))).toBe('#13c2a3');
  });
});
