import { describe, it, expect, vi } from 'vitest';
import { fetchLyrics } from './lrclib';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// no-op sleep so retry/backoff tests don't actually wait
const noSleep = async () => {};

// an error shaped like a fetch AbortError (what AbortController triggers on timeout)
function abortError(): Error {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
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

    // inject no-op sleep so retry/backoff doesn't actually wait
    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: async () => {} });
    expect(res).toBeNull();
  });
});

describe('fetchLyrics /api/get 200 but empty lyrics -> /api/search fallback (Fix 9)', () => {
  it('falls through to /api/search when /api/get returns 200 with both lyrics null', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 1, syncedLyrics: null, plainLyrics: null })) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([{ syncedLyrics: '[00:01.00] found', plainLyrics: 'found' }]),
      ) as unknown as typeof fetch; // /api/search

    const res = await fetchLyrics({ artist: 'Daft Punk', track: 'Aerodynamic' }, fetchImpl);

    expect(res).toEqual({ syncedLyrics: '[00:01.00] found', plainLyrics: 'found' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain('/api/get');
    expect(String(calls[1][0])).toContain('/api/search');
  });

  it('still returns a 200 get result when it has only plainLyrics (no search call)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ syncedLyrics: null, plainLyrics: 'has plain' }),
    ) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toEqual({ syncedLyrics: null, plainLyrics: 'has plain' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the empty get-record if /api/search also yields nothing usable', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ syncedLyrics: null, plainLyrics: null }))
      .mockResolvedValueOnce(jsonResponse([])) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    // empty array -> search returns null, so the final result is null
    expect(res).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('fetchLyrics /api/search scoring (Fix 10)', () => {
  it('prefers a synced candidate over a plain-only first candidate', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: null, plainLyrics: 'plain only', duration: 200 }, // list[0], unsynced
          { syncedLyrics: '[00:01.00] synced', plainLyrics: 'synced', duration: 200 },
        ]),
      ) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res?.syncedLyrics).toBe('[00:01.00] synced');
  });

  it('prefers a synced+right-duration candidate over synced+wrong-duration', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: '[00:01.00] wrong', plainLyrics: 'w', duration: 400 }, // synced but far duration
          { syncedLyrics: '[00:01.00] right', plainLyrics: 'r', duration: 201 }, // synced + ~right duration
        ]),
      ) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B', durationSec: 200 }, fetchImpl);
    expect(res?.syncedLyrics).toBe('[00:01.00] right');
  });

  it('a synced-but-wrong-duration still beats an unsynced-right-duration', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: null, plainLyrics: 'exact', duration: 200 }, // unsynced, exact duration
          { syncedLyrics: '[00:01.00] synced', plainLyrics: 's', duration: 230 }, // synced, off duration
        ]),
      ) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B', durationSec: 200 }, fetchImpl);
    // synced bonus dominates duration penalty
    expect(res?.syncedLyrics).toBe('[00:01.00] synced');
  });

  it('breaks ties by array order when scores are equal', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: '[00:01.00] first', plainLyrics: 'a', duration: 200 },
          { syncedLyrics: '[00:01.00] second', plainLyrics: 'b', duration: 200 },
        ]),
      ) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B', durationSec: 200 }, fetchImpl);
    expect(res?.syncedLyrics).toBe('[00:01.00] first');
  });
});

describe('fetchLyrics resilience: retry/backoff/timeout (transient only)', () => {
  it('retries /api/get on HTTP 5xx then succeeds (no search fallback)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503)) // get attempt 1 -> retry
      .mockResolvedValueOnce(jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' })) // get attempt 2
      .mockRejectedValue(new Error('search should not be called')) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2); // 5xx + success, no search
  });

  it('retries /api/get on HTTP 429 (rate limit) then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate' }, 429)) // retry
      .mockResolvedValueOnce(jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' }))
      .mockRejectedValue(new Error('search should not be called')) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries on a thrown network error then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET')) // network error -> retry
      .mockResolvedValueOnce(jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' }))
      .mockRejectedValue(new Error('search should not be called')) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries on a timeout (AbortError) then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(abortError()) // timeout -> retry
      .mockResolvedValueOnce(jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' }))
      .mockRejectedValue(new Error('search should not be called')) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry /api/get on 404 (definitive) and falls straight to search', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // get: no retry
      .mockResolvedValueOnce(
        jsonResponse([{ syncedLyrics: '[00:01.00] s', plainLyrics: 's' }]),
      ) as unknown as typeof fetch; // search

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] s');
    // exactly one get (no retry on 404) + one search
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain('/api/get');
    expect(String(calls[1][0])).toContain('/api/search');
  });

  it('does NOT retry on 400/401/403 (definitive client errors)', async () => {
    for (const status of [400, 401, 403]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: 'no' }, status)) // get -> fall to search, no retry
        .mockResolvedValueOnce(
          jsonResponse({ error: 'no' }, status),
        ) as unknown as typeof fetch; // search -> no retry, null

      const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
      expect(res).toBeNull();
      // one get + one search, neither retried
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it('gives up after 3 attempts of persistent 5xx on both endpoints -> null', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'down' }, 500)) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res).toBeNull();
    // 3 attempts on /api/get + 3 attempts on /api/search
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('gives up after 3 attempts of persistent timeouts -> null', async () => {
    const fetchImpl = vi.fn(async () => {
      throw abortError();
    }) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    expect(res).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(6); // 3 get + 3 search
  });

  it('uses exponential backoff delays 1s -> 2s between retries (injectable sleep observed)', async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => { delays.push(ms); });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500)) // get attempt 1
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500)) // get attempt 2
      .mockResolvedValueOnce(
        jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' }),
      ) as unknown as typeof fetch; // get 3 ok

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep });
    expect(res?.syncedLyrics).toBe('[00:01.00] ok');
    expect(delays).toEqual([1000, 2000]);
  });

  it('passes an AbortSignal to fetch for timeout enforcement', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ syncedLyrics: '[00:01.00] ok', plainLyrics: 'ok' }),
    ) as unknown as typeof fetch;

    await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl, { sleep: noSleep });
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
