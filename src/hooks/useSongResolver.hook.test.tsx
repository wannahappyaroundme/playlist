import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// prevent the real IFrame API/createYtPlayer from running in jsdom
vi.mock('../lib/ytPlayer', () => ({
  YT_STATE: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  createYtPlayer: vi.fn(),
}));
vi.mock('../lib/colors', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, extractPalette: vi.fn(async () => ({ vibrant: '#7c5cff' })) };
});
vi.mock('../lib/lrclib', () => ({ fetchLyrics: vi.fn(async () => null) }));
vi.mock('../lib/storage', () => ({ saveSong: vi.fn() }));

import { useSongResolver } from './useSongResolver';

describe('useSongResolver (smoke)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mounts and exposes resolve + resolving=false', () => {
    const { result } = renderHook(() => useSongResolver());
    expect(typeof result.current.resolve).toBe('function');
    expect(result.current.resolving).toBe(false);
  });
});
