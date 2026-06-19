import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from './colors';
import { rgbToHsl, hslToRgb } from './colors';
import { relativeLuminance, contrastRatio } from './colors';
import { clampLightness } from './colors';

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

describe('rgbToHsl', () => {
  it('pure red -> h=0 s=1 l=0.5', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 5);
    expect(s).toBeCloseTo(1, 5);
    expect(l).toBeCloseTo(0.5, 5);
  });
  it('pure green -> h=120', () => {
    expect(rgbToHsl(0, 255, 0)[0]).toBeCloseTo(120, 5);
  });
  it('pure blue -> h=240', () => {
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240, 5);
  });
  it('gray is achromatic: s=0', () => {
    const [, s, l] = rgbToHsl(128, 128, 128);
    expect(s).toBeCloseTo(0, 5);
    expect(l).toBeCloseTo(128 / 255, 5);
  });
});

describe('hslToRgb', () => {
  it('h=0 s=1 l=0.5 -> pure red', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
  });
  it('s=0 -> gray regardless of hue', () => {
    expect(hslToRgb(200, 0, 0.5)).toEqual([128, 128, 128]);
  });
});

describe('hsl round-trip', () => {
  it('rgb -> hsl -> rgb is stable for sample colors', () => {
    for (const c of [[18, 194, 163], [255, 136, 0], [60, 20, 90]] as const) {
      const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
      const back = hslToRgb(h, s, l);
      expect(back[0]).toBeCloseTo(c[0], -0.5);
      expect(back[1]).toBeCloseTo(c[1], -0.5);
      expect(back[2]).toBeCloseTo(c[2], -0.5);
    }
  });
});

describe('relativeLuminance', () => {
  it('white is 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
  it('black is 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });
  it('mid gray (#777) approx 0.183', () => {
    expect(relativeLuminance('#777777')).toBeCloseTo(0.183, 2);
  });
});

describe('contrastRatio', () => {
  it('white vs black is 21', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
  it('is symmetric', () => {
    const a = contrastRatio('#123456', '#ffffff');
    const b = contrastRatio('#ffffff', '#123456');
    expect(a).toBeCloseTo(b, 6);
  });
  it('same color is 1', () => {
    expect(contrastRatio('#abcdef', '#abcdef')).toBeCloseTo(1, 5);
  });
});

describe('clampLightness', () => {
  it('darkens a too-bright color down to maxL', () => {
    const out = clampLightness('#ffffff', 0.1, 0.4); // white l=1 -> clamp to 0.4
    const [, , l] = rgbToHsl(...hexToRgb(out));
    expect(l).toBeLessThanOrEqual(0.41);
    expect(l).toBeGreaterThanOrEqual(0.39);
  });
  it('lightens a too-dark color up to minL', () => {
    const out = clampLightness('#000000', 0.2, 0.9); // black l=0 -> clamp to 0.2
    const [, , l] = rgbToHsl(...hexToRgb(out));
    expect(l).toBeGreaterThanOrEqual(0.19);
    expect(l).toBeLessThanOrEqual(0.21);
  });
  it('leaves in-range lightness unchanged (hue/sat preserved)', () => {
    const src = '#3a7fbf';
    const [h0, s0, l0] = rgbToHsl(...hexToRgb(src));
    const out = clampLightness(src, 0.1, 0.9);
    const [h1, s1, l1] = rgbToHsl(...hexToRgb(out));
    expect(l1).toBeCloseTo(l0, 1);
    expect(h1).toBeCloseTo(h0, 0);
    expect(s1).toBeCloseTo(s0, 1);
  });
});
