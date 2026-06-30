import type { SharedPlaylist } from '../types';
import { isVideoId } from './youtube';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

// 공유 링크 포맷(앞 마커로 구분, 모두 HashRouter 경로에서 안전):
//   '~~' + base64url(바이너리)  → compact: 곡 ID를 날 8바이트로 패킹(가장 짧음, 기본)
//   '~'  + lz-string             → 압축 JSON (compact 불가한 비정상 ID일 때 폴백)
//   그 외(base64url JSON)         → 레거시: 아주 옛 링크 호환
// 마커 우선순위상 '~~'를 먼저 검사한다(lz payload는 '~'로 시작하지 않으므로 '~~'와 겹치지 않음).
const COMPACT_MARKER = '~~';
const LZ_MARKER = '~';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 유튜브 영상 ID(11자 base64url) → 정확히 8바이트(64비트). 실제 유튜브 ID는 64비트 값을
// base64url한 것이라 마지막 글자의 하위 2비트가 항상 0 → 8바이트로 무손실 왕복한다.
// 비정상(왕복 안 되는) ID면 null을 돌려 호출부가 compact를 포기하고 lz로 폴백하게 한다.
function idToBytes(id: string): Uint8Array | null {
  if (!isVideoId(id)) return null;
  const bytes = base64UrlToBytes(id);
  if (bytes.length !== 8) return null;
  if (bytesToBase64Url(bytes) !== id) return null; // 무손실 왕복 보장
  return bytes;
}

function bytesToId(bytes: Uint8Array): string {
  return bytesToBase64Url(bytes);
}

// compact 메타(JSON)는 키를 1글자로 줄여 바이트를 아낀다: t=title, m=message, f=from, c=color.
function encodeCompact(p: SharedPlaylist): string | null {
  const n = p.songs.length;
  if (n > 0xffff) return null; // 2바이트 카운트 한도(현실적으로 도달 불가)
  const idChunks: Uint8Array[] = [];
  for (const s of p.songs) {
    const b = idToBytes(s.id);
    if (!b) return null; // 왕복 불가 ID → compact 포기(상위에서 lz 폴백)
    idChunks.push(b);
  }
  const meta: Record<string, string> = { t: p.title };
  if (p.message) meta.m = p.message;
  if (p.from) meta.f = p.from;
  if (p.color) meta.c = p.color;
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));

  const buf = new Uint8Array(2 + n * 8 + metaBytes.length);
  buf[0] = (n >> 8) & 0xff;
  buf[1] = n & 0xff;
  let off = 2;
  for (const chunk of idChunks) {
    buf.set(chunk, off);
    off += 8;
  }
  buf.set(metaBytes, off);
  return COMPACT_MARKER + bytesToBase64Url(buf);
}

function decodeCompact(payload: string): SharedPlaylist | null {
  const buf = base64UrlToBytes(payload);
  if (buf.length < 2) return null;
  const n = (buf[0] << 8) | buf[1];
  const idsEnd = 2 + n * 8;
  if (buf.length < idsEnd) return null;
  const songs: { id: string }[] = [];
  for (let i = 0; i < n; i++) {
    const id = bytesToId(buf.subarray(2 + i * 8, 2 + i * 8 + 8));
    if (!isVideoId(id)) return null;
    songs.push({ id });
  }
  const meta = JSON.parse(new TextDecoder().decode(buf.subarray(idsEnd))) as Record<string, unknown>;
  if (typeof meta.t !== 'string') return null;
  const result: SharedPlaylist = { title: meta.t, songs };
  if (meta.m !== undefined) {
    if (typeof meta.m !== 'string') return null;
    result.message = meta.m;
  }
  if (meta.f !== undefined) {
    if (typeof meta.f !== 'string') return null;
    result.from = meta.f;
  }
  if (meta.c !== undefined) {
    if (typeof meta.c !== 'string') return null;
    result.color = meta.c;
  }
  return result;
}

export function encodePlaylist(p: SharedPlaylist): string {
  const compact = encodeCompact(p);
  if (compact) return compact;
  // 폴백: 왕복 불가 ID 등 → lz 압축 JSON
  return LZ_MARKER + compressToEncodedURIComponent(JSON.stringify(p));
}

// Conservative cap for a comfortably shareable encoded payload (messenger/QR).
export const SHARE_ENCODED_MAX = 1800;

export interface BuildSharePayloadResult {
  encoded: string;
  /** 호환용 필드 — compact 포맷은 곡 제목을 URL에 넣지 않으므로 항상 false. */
  titlesDropped: boolean;
  /** true면 id만으로도 maxEncoded를 넘김(링크가 QR/메신저에서 깨질 수 있음). */
  tooLong: boolean;
}

/**
 * 공유 페이로드를 만든다. compact 포맷은 곡 제목을 URL에 담지 않는다 — 받는 사람이 링크를
 * 열면 곡을 유튜브로 다시 해석하면서 제목/가사/색을 가져오므로 제목은 URL에 불필요하다.
 * 덕분에 링크가 곡 수만큼만 늘어나고(곡당 ~8바이트) 훨씬 짧다.
 */
export function buildSharePayload(
  meta: { title: string; message?: string; from?: string; color?: string },
  songs: { id: string }[],
  maxEncoded: number = SHARE_ENCODED_MAX,
): BuildSharePayloadResult {
  const encoded = encodePlaylist({
    title: meta.title,
    message: meta.message,
    from: meta.from,
    color: meta.color,
    songs: songs.map((s) => ({ id: s.id })),
  });
  return { encoded, titlesDropped: false, tooLong: encoded.length > maxEncoded };
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
    // compact('~~')를 lz('~')보다 먼저 검사한다.
    if (encoded.startsWith(COMPACT_MARKER)) {
      const parsed = decodeCompact(encoded.slice(COMPACT_MARKER.length));
      return parsed && isSharedPlaylist(parsed) ? parsed : null;
    }
    let json: string;
    if (encoded[0] === LZ_MARKER) {
      json = decompressFromEncodedURIComponent(encoded.slice(1)) ?? '';
      if (!json) return null;
    } else {
      // 레거시: base64url(UTF-8 JSON) — 아주 옛 링크 호환
      json = new TextDecoder().decode(base64UrlToBytes(encoded));
    }
    const parsed = JSON.parse(json);
    return isSharedPlaylist(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
