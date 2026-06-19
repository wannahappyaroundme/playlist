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
