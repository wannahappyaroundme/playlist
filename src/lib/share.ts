import type { SharedPlaylist } from '../types';
import { isVideoId } from './youtube';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

// 새 공유 링크는 lz-string으로 압축한다(한글 제목/메시지의 긴 UTF-8 base64를 보통 50~70%
// 줄인다). 압축 결과 앞에 '~' 마커를 붙이는데, 이 문자는 lz-string의 URI-safe 알파벳
// (A-Za-z0-9+-$)에도, 구버전 base64url(A-Za-z0-9-_)에도 없어서 decode가 새/구 포맷을
// 모호함 없이 구분한다 → 이미 만들어 보낸 구버전 링크도 계속 열린다.
const COMPRESS_MARKER = '~';

export function encodePlaylist(p: SharedPlaylist): string {
  return COMPRESS_MARKER + compressToEncodedURIComponent(JSON.stringify(p));
}

// Conservative cap for a comfortably shareable encoded payload (messenger/QR).
export const SHARE_ENCODED_MAX = 1800;

export interface BuildSharePayloadResult {
  encoded: string;
  /** true when titles were dropped (id-only) to stay under SHARE_ENCODED_MAX */
  titlesDropped: boolean;
  /** true when even the id-only payload exceeds maxEncoded (link likely breaks in QR/messengers) */
  tooLong: boolean;
}

/**
 * Fix 17+18: build the encoded share payload, preferring to include song titles
 * for nicer previews, but dropping them (id-only) when the title-rich encoding
 * exceeds SHARE_ENCODED_MAX. Decoder already treats title as optional.
 */
export function buildSharePayload(
  meta: { title: string; message?: string; from?: string; color?: string },
  songs: { id: string; title: string }[],
  maxEncoded: number = SHARE_ENCODED_MAX,
): BuildSharePayloadResult {
  const withTitles: SharedPlaylist = {
    title: meta.title,
    message: meta.message,
    from: meta.from,
    color: meta.color,
    songs: songs.map((s) => ({ id: s.id, title: s.title })),
  };
  const full = encodePlaylist(withTitles);
  if (full.length <= maxEncoded) {
    return { encoded: full, titlesDropped: false, tooLong: false };
  }
  const slim: SharedPlaylist = {
    title: meta.title,
    message: meta.message,
    from: meta.from,
    color: meta.color,
    songs: songs.map((s) => ({ id: s.id })),
  };
  const slimEncoded = encodePlaylist(slim);
  // tooLong: even the leanest (id-only) encoding can't fit — the share link is
  // likely to break in QR codes / messenger previews.
  return { encoded: slimEncoded, titlesDropped: true, tooLong: slimEncoded.length > maxEncoded };
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function isSharedPlaylist(v: unknown): v is SharedPlaylist {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== 'string') return false;
  if (o.message !== undefined && typeof o.message !== 'string') return false;
  if (o.from !== undefined && typeof o.from !== 'string') return false;
  if (o.color !== undefined && typeof o.color !== 'string') return false;
  if (!Array.isArray(o.songs)) return false;
  return o.songs.every((s) => {
    if (typeof s !== 'object' || s === null) return false;
    const so = s as Record<string, unknown>;
    // Fix 15+20: shared links are untrusted input — reject ids that aren't a
    // valid 11-char YouTube id so junk never reaches cueVideoById/thumbnailUrl
    // (avoids 8s probe timeouts + polluted song saves).
    if (typeof so.id !== 'string' || !isVideoId(so.id)) return false;
    if (so.title !== undefined && typeof so.title !== 'string') return false;
    return true;
  });
}

export function decodePlaylist(encoded: string): SharedPlaylist | null {
  if (!encoded) return null;
  try {
    let json: string;
    if (encoded[0] === COMPRESS_MARKER) {
      // 새 포맷: lz-string 압축
      json = decompressFromEncodedURIComponent(encoded.slice(1)) ?? '';
      if (!json) return null;
    } else {
      // 구버전 포맷: base64url(UTF-8 JSON) — 이전에 공유된 링크 호환
      const bytes = base64UrlToBytes(encoded);
      json = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(json);
    return isSharedPlaylist(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
