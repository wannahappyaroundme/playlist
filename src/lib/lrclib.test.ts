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
