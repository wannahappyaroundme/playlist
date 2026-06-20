export interface LrclibResponse {
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export interface FetchLyricsParams {
  artist: string;
  track: string;
  album?: string;
  durationSec?: number;
}

const BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = {
  'Lrclib-Client': 'Yejin Playlist (https://github.com/wannahappyaroundme/playlist)',
};

function toResponse(raw: { syncedLyrics?: unknown; plainLyrics?: unknown }): LrclibResponse {
  return {
    syncedLyrics: typeof raw.syncedLyrics === 'string' ? raw.syncedLyrics : null,
    plainLyrics: typeof raw.plainLyrics === 'string' ? raw.plainLyrics : null,
  };
}

function hasLyrics(r: LrclibResponse): boolean {
  return !!(r.syncedLyrics || r.plainLyrics);
}

interface SearchCandidate {
  syncedLyrics?: unknown;
  plainLyrics?: unknown;
  duration?: unknown;
}

// Score a /api/search candidate. Higher is better.
// - strong bonus for having syncedLyrics (dominates duration penalty)
// - if durationSec is known, bonus for a close duration match, penalty for a large gap
export function scoreSearchCandidate(c: SearchCandidate, durationSec?: number): number {
  let score = 0;
  if (typeof c.syncedLyrics === 'string' && c.syncedLyrics) score += 100;
  else if (typeof c.plainLyrics === 'string' && c.plainLyrics) score += 10;

  if (typeof durationSec === 'number' && typeof c.duration === 'number') {
    const diff = Math.abs(c.duration - durationSec);
    if (diff <= 2) score += 30;
    else score -= diff; // farther = larger penalty (stays below the synced bonus for sane gaps)
  }
  return score;
}

// Pick the best candidate from a /api/search list. Tie-break by array order (earlier wins).
export function pickBestCandidate(
  list: SearchCandidate[],
  durationSec?: number,
): SearchCandidate | undefined {
  let best: SearchCandidate | undefined;
  let bestScore = -Infinity;
  for (const c of list) {
    const s = scoreSearchCandidate(c, durationSec);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

export async function fetchLyrics(
  p: FetchLyricsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<LrclibResponse | null> {
  // 1) /api/get
  try {
    const getUrl = new URL(`${BASE}/get`);
    getUrl.searchParams.set('artist_name', p.artist);
    getUrl.searchParams.set('track_name', p.track);
    if (p.album) getUrl.searchParams.set('album_name', p.album);
    if (typeof p.durationSec === 'number') {
      getUrl.searchParams.set('duration', String(Math.round(p.durationSec)));
    }
    const getRes = await fetchImpl(getUrl.toString(), { headers: { ...CLIENT_HEADER } });
    if (getRes.ok) {
      const body = await getRes.json();
      const r = toResponse(body ?? {});
      // Fix 9: a 200 record can have both lyrics null/empty; only return if it
      // actually carries lyrics, otherwise fall through to the search fallback.
      if (hasLyrics(r)) return r;
    }
    // any non-ok (404 etc.) or empty-lyrics 200 -> fall through to search
  } catch {
    // network error on /api/get -> still try search
  }

  // 2) /api/search (first candidate)
  try {
    const searchUrl = new URL(`${BASE}/search`);
    searchUrl.searchParams.set('track_name', p.track);
    searchUrl.searchParams.set('artist_name', p.artist);
    const searchRes = await fetchImpl(searchUrl.toString(), { headers: { ...CLIENT_HEADER } });
    if (!searchRes.ok) return null;
    const list = await searchRes.json();
    if (Array.isArray(list) && list.length > 0) {
      // Fix 10: score candidates (synced + duration proximity) instead of list[0].
      const best = pickBestCandidate(list as SearchCandidate[], p.durationSec);
      const r = toResponse(best ?? {});
      return hasLyrics(r) ? r : null;
    }
    return null;
  } catch {
    return null;
  }
}
