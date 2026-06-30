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

// Per-request timeout (AbortController) so a slow/hung LRCLIB never blocks adds for long.
const REQUEST_TIMEOUT_MS = 8000;
// Up to 3 attempts total for TRANSIENT failures, with 1s -> 2s backoff between them.
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000];

export interface FetchLyricsOptions {
  /** 백오프 대기 함수(주입 가능). 테스트는 no-op을 넘겨 실제로 기다리지 않는다. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP 상태가 일시적(재시도 가치 있음)인가: 5xx 또는 429(rate limit). */
export function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * 타임아웃(AbortController) + 일시적 실패 재시도/백오프를 적용해 한 엔드포인트를 호출한다.
 * - 5xx/429/네트워크 에러/타임아웃: 최대 3회, 1s→2s 백오프 후 재시도.
 * - 4xx(400/401/403/404 등): 확정 실패 → 재시도 없이 그 응답을 그대로 반환.
 * 최종 실패(모든 재시도 소진/네트워크 다운)는 null을 반환한다.
 */
async function requestWithRetry(
  url: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<Response | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, {
        headers: { ...CLIENT_HEADER },
        signal: controller.signal,
      });
      // 4xx 등 확정 응답은 그대로 반환(재시도 금지). 호출부가 ok/상태로 분기한다.
      if (res.ok || !isTransientStatus(res.status)) return res;
      // 5xx/429: 일시적 → 재시도(마지막 시도면 그 응답을 반환해 호출부가 처리).
      if (attempt === MAX_ATTEMPTS - 1) return res;
    } catch {
      // 네트워크 에러/타임아웃(AbortError): 일시적 → 재시도. 마지막 시도면 포기(null).
      if (attempt === MAX_ATTEMPTS - 1) return null;
    } finally {
      clearTimeout(timer);
    }
    await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]);
  }
  return null;
}

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
  opts: FetchLyricsOptions = {},
): Promise<LrclibResponse | null> {
  const sleep = opts.sleep ?? defaultSleep;

  // 1) /api/get (타임아웃 + 일시적 실패 재시도). 4xx는 재시도 없이 search로 폴스루.
  const getUrl = new URL(`${BASE}/get`);
  getUrl.searchParams.set('artist_name', p.artist);
  getUrl.searchParams.set('track_name', p.track);
  if (p.album) getUrl.searchParams.set('album_name', p.album);
  // duration=0(길이 미상)을 보내면 LRCLIB가 400을 돌려준다 — 0/음수면 아예 생략한다
  // (이 경우 /get은 정확매칭 대신 일반 조회가 되고, 못 찾으면 search로 폴백).
  if (typeof p.durationSec === 'number' && p.durationSec > 0) {
    getUrl.searchParams.set('duration', String(Math.round(p.durationSec)));
  }
  const getRes = await requestWithRetry(getUrl.toString(), fetchImpl, sleep);
  if (getRes && getRes.ok) {
    try {
      const body = await getRes.json();
      const r = toResponse(body ?? {});
      // Fix 9: a 200 record can have both lyrics null/empty; only return if it
      // actually carries lyrics, otherwise fall through to the search fallback.
      if (hasLyrics(r)) return r;
    } catch {
      // 본문 파싱 실패 -> search 폴백
    }
  }
  // null(네트워크/재시도 소진), non-ok(404/5xx 등), empty-lyrics 200 -> search 폴백

  // 2) /api/search (best candidate)
  const searchUrl = new URL(`${BASE}/search`);
  searchUrl.searchParams.set('track_name', p.track);
  searchUrl.searchParams.set('artist_name', p.artist);
  const searchRes = await requestWithRetry(searchUrl.toString(), fetchImpl, sleep);
  if (!searchRes || !searchRes.ok) return null;
  try {
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
