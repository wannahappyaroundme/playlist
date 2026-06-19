import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from './colors';
import { rgbToHsl, hslToRgb } from './colors';
import { relativeLuminance, contrastRatio } from './colors';
import { clampLightness } from './colors';
import { ensureReadableOnWhite } from './colors';
import { quantize } from './colors';
import { buildSongColors, FALLBACK_COLORS } from './colors';
import { extractPalette } from './colors';

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

describe('ensureReadableOnWhite', () => {
  it('darkens a bright color until white text contrast >= 4.5', () => {
    const out = ensureReadableOnWhite('#ffd400'); // bright yellow, very low contrast vs white
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('respects a custom higher minRatio', () => {
    const out = ensureReadableOnWhite('#33aa55', 7);
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(7);
  });
  it('leaves already-dark color unchanged enough to keep contrast', () => {
    const out = ensureReadableOnWhite('#101820');
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('returns a valid hex string', () => {
    expect(ensureReadableOnWhite('#abcdef')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// helper: build RGBA Uint8ClampedArray from list of [r,g,b] repeated `count` times
function pixelsFrom(spec: Array<[number, number, number, number]>): Uint8ClampedArray {
  const total = spec.reduce((n, s) => n + s[3], 0);
  const arr = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [r, g, b, count] of spec) {
    for (let c = 0; c < count; c++) {
      arr[i++] = r; arr[i++] = g; arr[i++] = b; arr[i++] = 255;
    }
  }
  return arr;
}

describe('quantize', () => {
  it('returns an object (RawPalette) for non-empty pixels', () => {
    const px = pixelsFrom([[200, 30, 30, 50]]);
    const pal = quantize(px, 1);
    expect(typeof pal).toBe('object');
  });

  it('picks a saturated dominant color as vibrant', () => {
    // mostly vivid red, plus some gray noise
    const px = pixelsFrom([[220, 20, 20, 200], [128, 128, 128, 30]]);
    const pal = quantize(px, 1);
    expect(pal.vibrant).toBeDefined();
    const [h, s] = rgbToHsl(...hexToRgb(pal.vibrant!));
    expect(s).toBeGreaterThan(0.4);       // vibrant must be saturated
    // hue near red: either >330 or <30 (pure red maps to 0)
    expect(h > 330 || h < 30).toBe(true);
  });

  it('classifies a dark saturated color as darkVibrant', () => {
    const px = pixelsFrom([[40, 8, 8, 300]]); // dark red
    const pal = quantize(px, 1);
    expect(pal.darkVibrant).toBeDefined();
    const [, , l] = rgbToHsl(...hexToRgb(pal.darkVibrant!));
    expect(l).toBeLessThan(0.4);
  });

  it('classifies a low-saturation mid color as muted', () => {
    const px = pixelsFrom([[120, 110, 100, 300]]); // grayish
    const pal = quantize(px, 1);
    expect(pal.muted).toBeDefined();
    const [, s] = rgbToHsl(...hexToRgb(pal.muted!));
    expect(s).toBeLessThan(0.4);
  });

  it('returns empty palette for empty pixels', () => {
    const pal = quantize(new Uint8ClampedArray(0), 1);
    expect(pal).toEqual({});
  });
});

const HEX = /^#[0-9a-f]{6}$/;

describe('FALLBACK_COLORS', () => {
  it('has three valid hex fields', () => {
    expect(FALLBACK_COLORS.gradientFrom).toMatch(HEX);
    expect(FALLBACK_COLORS.gradientTo).toMatch(HEX);
    expect(FALLBACK_COLORS.accent).toMatch(HEX);
  });
  it('gradient base is dark enough for white text', () => {
    expect(contrastRatio(FALLBACK_COLORS.gradientFrom, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('buildSongColors', () => {
  it('returns three valid hex fields', () => {
    const out = buildSongColors({ vibrant: '#22c2a3', darkVibrant: '#0d4f43', muted: '#5a6a66' });
    expect(out.gradientFrom).toMatch(HEX);
    expect(out.gradientTo).toMatch(HEX);
    expect(out.accent).toMatch(HEX);
  });
  it('gradientFrom is readable under white text (contrast >= 4.5)', () => {
    const out = buildSongColors({ vibrant: '#ffd400', lightVibrant: '#fff6b0' }); // very bright source
    expect(contrastRatio(out.gradientFrom, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('gradientTo is darker than (or equal to) gradientFrom', () => {
    const out = buildSongColors({ vibrant: '#3a7fbf', darkVibrant: '#16314a' });
    const lFrom = rgbToHsl(...hexToRgb(out.gradientFrom))[2];
    const lTo = rgbToHsl(...hexToRgb(out.gradientTo))[2];
    expect(lTo).toBeLessThanOrEqual(lFrom + 0.001);
  });
  it('accent prefers vibrant when present', () => {
    const out = buildSongColors({ vibrant: '#e91e63', darkVibrant: '#222' });
    expect(out.accent).toBe('#e91e63');
  });
  it('falls back to FALLBACK_COLORS when palette is empty', () => {
    expect(buildSongColors({})).toEqual(FALLBACK_COLORS);
  });
});

describe('extractPalette (injected loadImage)', () => {
  it('throws when loadImage rejects (load failure)', async () => {
    const failingLoad = async () => { throw new Error('load failed'); };
    await expect(extractPalette('http://example.com/x.jpg', failingLoad)).rejects.toThrow();
  });

  it('throws when canvas 2D context / pixel read is unavailable (jsdom)', async () => {
    // fake image; in jsdom getContext('2d') returns null or getImageData throws -> extractPalette must throw
    const fakeImg = { width: 10, height: 10, naturalWidth: 10, naturalHeight: 10 } as unknown as HTMLImageElement;
    const fakeLoad = async () => fakeImg;
    await expect(extractPalette('http://example.com/x.jpg', fakeLoad)).rejects.toThrow();
  });
});
