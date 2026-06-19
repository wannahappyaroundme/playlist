import { describe, it, expect, vi } from 'vitest';
import { fetchLyrics } from './lrclib';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchLyrics /api/get success', () => {
  it('hits /api/get with query params and Lrclib-Client header, returns lyrics', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi' }),
    ) as unknown as typeof fetch;

    const res = await fetchLyrics(
      { artist: 'Adele', track: 'Hello', album: '25', durationSec: 295 },
      fetchImpl,
    );

    expect(res).toEqual({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const u = String(url);
    expect(u).toContain('https://lrclib.net/api/get');
    expect(u).toContain('artist_name=Adele');
    expect(u).toContain('track_name=Hello');
    expect(u).toContain('album_name=25');
    expect(u).toContain('duration=295');

    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers['Lrclib-Client']).toBeTruthy();
  });
});

describe('fetchLyrics /api/get 404 -> /api/search fallback', () => {
  it('falls back to /api/search and returns the first candidate', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404, message: 'Not Found' }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: '[00:02.00] first', plainLyrics: 'first' },
          { syncedLyrics: '[00:03.00] second', plainLyrics: 'second' },
        ]),
      ) as unknown as typeof fetch; // /api/search

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);

    expect(res).toEqual({ syncedLyrics: '[00:02.00] first', plainLyrics: 'first' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain('/api/get');
    const searchUrl = String(calls[1][0]);
    expect(searchUrl).toContain('/api/search');
    expect(searchUrl).toContain('track_name=B');
    expect(searchUrl).toContain('artist_name=A');
    const searchHeaders = (calls[1][1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(searchHeaders['Lrclib-Client']).toBeTruthy();
  });

  it('returns null when /api/get 404 and /api/search is empty array', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse([])) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });

  it('returns null when /api/get 404 and /api/search also fails (non-ok)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500)) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });

  it('returns null when fetch throws on both calls', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });
});
