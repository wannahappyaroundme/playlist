import type { SongColors } from '../types';

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hh = (v: number) => clampChannel(v).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [
    clampChannel((r1 + m) * 255),
    clampChannel((g1 + m) * 255),
    clampChannel((b1 + m) * 255),
  ];
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function clampLightness(hex: string, minL: number, maxL: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const cl = Math.max(minL, Math.min(maxL, l));
  return rgbToHex(...hslToRgb(h, s, cl));
}

export function ensureReadableOnWhite(bgHex: string, minRatio = 4.5): string {
  const [h, s] = rgbToHsl(...hexToRgb(bgHex));
  let l = rgbToHsl(...hexToRgb(bgHex))[2];
  let hex = rgbToHex(...hslToRgb(h, s, l));
  // step down lightness until white text reaches the target contrast (or fully black)
  for (let i = 0; i < 100 && contrastRatio(hex, '#ffffff') < minRatio; i++) {
    l = Math.max(0, l - 0.02);
    hex = rgbToHex(...hslToRgb(h, s, l));
    if (l <= 0) break;
  }
  return hex;
}

export interface RawPalette {
  vibrant?: string;
  darkVibrant?: string;
  lightVibrant?: string;
  muted?: string;
  darkMuted?: string;
}

interface Bucket { r: number; g: number; b: number; count: number; }

export function quantize(pixels: Uint8ClampedArray, sampleStep = 4): RawPalette {
  const step = Math.max(1, Math.floor(sampleStep));
  const buckets = new Map<number, Bucket>();
  // group into 16-level-per-channel buckets (4 bits each -> 12-bit key)
  for (let i = 0; i + 3 < pixels.length; i += 4 * step) {
    const a = pixels[i + 3];
    if (a < 125) continue; // skip transparent
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key);
    if (bk) { bk.r += r; bk.g += g; bk.b += b; bk.count++; }
    else buckets.set(key, { r, g, b, count: 1 });
  }
  if (buckets.size === 0) return {};

  // representative color per bucket (average), with hsl + score
  type Cand = { hex: string; h: number; s: number; l: number; count: number };
  const cands: Cand[] = [];
  for (const bk of buckets.values()) {
    const r = Math.round(bk.r / bk.count);
    const g = Math.round(bk.g / bk.count);
    const b = Math.round(bk.b / bk.count);
    const [h, s, l] = rgbToHsl(r, g, b);
    cands.push({ hex: rgbToHex(r, g, b), h, s, l, count: bk.count });
  }

  const palette: RawPalette = {};
  // pick best candidate matching predicate by weighted (saturation * count) or count
  const pickVivid = (pred: (c: Cand) => boolean) => {
    let best: Cand | undefined;
    let bestScore = -1;
    for (const c of cands) {
      if (!pred(c)) continue;
      const score = (c.s + 0.1) * c.count;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best?.hex;
  };
  const pickByCount = (pred: (c: Cand) => boolean) => {
    let best: Cand | undefined;
    let bestCount = -1;
    for (const c of cands) {
      if (!pred(c)) continue;
      if (c.count > bestCount) { bestCount = c.count; best = c; }
    }
    return best?.hex;
  };

  palette.vibrant = pickVivid((c) => c.s >= 0.4 && c.l >= 0.35 && c.l <= 0.7);
  palette.lightVibrant = pickVivid((c) => c.s >= 0.3 && c.l > 0.7);
  palette.darkVibrant = pickVivid((c) => c.s >= 0.3 && c.l < 0.4);
  palette.muted = pickByCount((c) => c.s < 0.4 && c.l >= 0.3 && c.l <= 0.7);
  palette.darkMuted = pickByCount((c) => c.s < 0.4 && c.l < 0.3);

  // strip undefined entries for a clean object
  (Object.keys(palette) as (keyof RawPalette)[]).forEach((k) => {
    if (palette[k] === undefined) delete palette[k];
  });
  return palette;
}
