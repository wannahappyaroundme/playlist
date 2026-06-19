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
  'Lrclib-Client': 'Yejin Playlist (https://github.com/yejin-playlist)',
};

function toResponse(raw: { syncedLyrics?: unknown; plainLyrics?: unknown }): LrclibResponse {
  return {
    syncedLyrics: typeof raw.syncedLyrics === 'string' ? raw.syncedLyrics : null,
    plainLyrics: typeof raw.plainLyrics === 'string' ? raw.plainLyrics : null,
  };
}

export async function fetchLyrics(
  p: FetchLyricsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<LrclibResponse | null> {
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
    return toResponse(body ?? {});
  }
  return null;
}
