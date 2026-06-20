import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// fake probe player whose metadata is ready immediately so getMeta's poll finishes fast
const destroySpy = vi.fn();
function makeFakePlayer() {
  return {
    loadVideoById: vi.fn(),
    cueVideoById: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 200,
    getVideoData: () => ({ video_id: 'abc12345678', title: 'A - B', author: 'Chan' }),
    getPlayerState: () => 5,
    destroy: destroySpy,
  };
}

vi.mock('../lib/ytPlayer', () => ({
  YT_STATE: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  createYtPlayer: vi.fn(async () => makeFakePlayer()),
}));
// keep cover/palette/lyrics cheap & synchronous
vi.mock('../lib/youtube', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, resolveBestThumbnail: vi.fn(async () => 'https://i.ytimg.com/vi/abc12345678/sddefault.jpg') };
});
vi.mock('../lib/colors', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, extractPalette: vi.fn(async () => ({ vibrant: '#7c5cff' })) };
});
vi.mock('../lib/lrclib', () => ({ fetchLyrics: vi.fn(async () => null) }));
vi.mock('../lib/storage', () => ({ saveSong: vi.fn() }));

import { useSongResolver } from './useSongResolver';
import { saveSong } from '../lib/storage';

const PROBE_ID = 'yejin-probe';

describe('useSongResolver cleanup on unmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.getElementById(PROBE_ID)?.remove();
  });

  it('destroys the probe player and removes the hidden node on unmount', async () => {
    const { result, unmount } = renderHook(() => useSongResolver());

    // create the probe by resolving a song
    await act(async () => {
      await result.current.resolve('abc12345678');
    });
    expect(document.getElementById(PROBE_ID)).not.toBeNull();

    unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(document.getElementById(PROBE_ID)).toBeNull();
  });
});

describe('useSongResolver.reResolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.getElementById(PROBE_ID)?.remove();
  });

  it('runs the full pipeline and overwrites via saveSong (ignores cache)', async () => {
    const { result } = renderHook(() => useSongResolver());

    let song: Awaited<ReturnType<typeof result.current.reResolve>> | undefined;
    await act(async () => {
      song = await result.current.reResolve('abc12345678');
    });

    // full pipeline ran: meta resolved into a Song and persisted via saveSong
    expect(song?.id).toBe('abc12345678');
    expect(saveSong).toHaveBeenCalledTimes(1);
    expect((saveSong as any).mock.calls[0][0].id).toBe('abc12345678');
  });
});
