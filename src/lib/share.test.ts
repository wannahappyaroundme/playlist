import { describe, expect, it } from 'vitest';
import { decompressFromEncodedURIComponent } from 'lz-string';
import type { SharedPlaylist } from '../types';
import { buildSharePayload, decodePlaylist, encodePlaylist } from './share';

const sample: SharedPlaylist = {
  title: '심야의 라운지',
  message: 'for you',
  songs: [{ id: 'abc12345678', title: 'Track A' }, { id: 'def98765432' }],
};

// 구버전(압축 전) 공유 링크를 만드는 헬퍼 — base64url(UTF-8 JSON).
function legacyEncode(p: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('encodePlaylist', () => {
  it('produces a compressed payload tagged with the ~ marker', () => {
    const enc = encodePlaylist(sample);
    expect(enc[0]).toBe('~');
    // lz-string URI-safe 알파벳(마커 제외): A-Za-z0-9+-$
    expect(enc.slice(1)).toMatch(/^[A-Za-z0-9+\-$]+$/);
  });

  it('round-trips back to the same JSON via the lz-string scheme', () => {
    const enc = encodePlaylist(sample);
    const json = decompressFromEncodedURIComponent(enc.slice(1));
    expect(JSON.parse(json!)).toEqual(sample);
  });

  it('compresses a long Korean payload shorter than the legacy base64url', () => {
    const big: SharedPlaylist = {
      title: '너에게 보내는 새벽 감성 플레이리스트 — 끝까지 들어줘',
      message: '오늘 하루도 고생 많았어. 이 노래들 들으면서 푹 쉬어. 사랑해 정말로 많이많이',
      from: '예진',
      songs: Array.from({ length: 20 }, (_, i) => ({
        id: 'aaaaaaaaaa' + i.toString().padStart(1, '0').slice(0, 1),
        title: `정말 좋아하는 노래 제목 ${i} 번째 트랙입니다`,
      })),
    };
    const compressed = encodePlaylist(big);
    const legacy = legacyEncode(big);
    expect(compressed.length).toBeLessThan(legacy.length);
  });
});

describe('decodePlaylist backward-compat', () => {
  it('still decodes a legacy (uncompressed base64url) link', () => {
    expect(decodePlaylist(legacyEncode(sample))).toEqual(sample);
  });
});

describe('buildSharePayload (Fix 17+18)', () => {
  const songs = [
    { id: 'aaaaaaaaaaa', title: '아주 긴 한글 제목입니다 정말로 길어요' },
    { id: 'bbbbbbbbbbb', title: '또 다른 매우 긴 한글 제목 텍스트' },
  ];

  it('keeps titles when the encoding stays under the threshold', () => {
    const r = buildSharePayload({ title: 'L', message: 'm' }, songs, 100000);
    expect(r.titlesDropped).toBe(false);
    const decoded = decodePlaylist(r.encoded);
    expect(decoded?.songs[0].title).toBe(songs[0].title);
  });

  it('drops titles (id-only) when the title-rich encoding exceeds the threshold', () => {
    // tiny threshold forces the slim path
    const r = buildSharePayload({ title: 'L', message: 'm' }, songs, 10);
    expect(r.titlesDropped).toBe(true);
    const decoded = decodePlaylist(r.encoded);
    expect(decoded?.songs.map((s) => s.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(decoded?.songs.every((s) => s.title === undefined)).toBe(true);
  });

  it('id-only encoding is strictly shorter than the title-rich one', () => {
    const full = buildSharePayload({ title: 'L' }, songs, 100000).encoded;
    const slim = buildSharePayload({ title: 'L' }, songs, 1).encoded;
    expect(slim.length).toBeLessThan(full.length);
  });

  it('single-song share encodes exactly one song (이 곡만 보내기)', () => {
    const { encoded } = buildSharePayload(
      { title: 'Track A' },
      [{ id: 'aaaaaaaaaaa', title: 'Track A' }],
    );
    const decoded = decodePlaylist(encoded);
    expect(decoded?.songs).toHaveLength(1);
    expect(decoded?.songs[0].id).toBe('aaaaaaaaaaa');
  });

  it('tooLong is false for a small playlist', () => {
    const r = buildSharePayload({ title: 'L' }, songs);
    expect(r.tooLong).toBe(false);
  });

  it('tooLong is true when even the id-only payload exceeds the threshold', () => {
    // distinct ids so compression can't collapse them; threshold set just below the
    // actual id-only compressed length so the assertion is robust to the codec.
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: ('id' + i.toString(36)).padEnd(11, 'z').slice(0, 11),
      title: 'x',
    }));
    const idOnlyLen = buildSharePayload({ title: 'L' }, many, 1).encoded.length;
    const r = buildSharePayload({ title: 'L' }, many, idOnlyLen - 1);
    expect(r.tooLong).toBe(true);
    // titlesDropped is also true (titles were dropped trying to fit)
    expect(r.titlesDropped).toBe(true);
  });

  it('tooLong stays false when titles are dropped but the id-only payload fits', () => {
    // threshold sits between the id-only length and the title-rich length:
    // titles get dropped, but the slim (id-only) encoding still fits → not tooLong
    const idOnly = buildSharePayload({ title: 'L' }, songs, 1).encoded; // forces slim
    const full = buildSharePayload({ title: 'L' }, songs, 100000).encoded; // title-rich
    const between = Math.floor((idOnly.length + full.length) / 2);
    expect(between).toBeGreaterThan(idOnly.length);
    expect(between).toBeLessThan(full.length);
    const r = buildSharePayload({ title: 'L' }, songs, between);
    expect(r.titlesDropped).toBe(true); // title-rich didn't fit
    expect(r.tooLong).toBe(false); // but id-only does
  });
});

describe('decodePlaylist', () => {
  it('round-trips an encoded playlist back to an equal object', () => {
    expect(decodePlaylist(encodePlaylist(sample))).toEqual(sample);
  });

  it('round-trips a minimal playlist (no message, no song titles)', () => {
    const minimal: SharedPlaylist = { title: 'x', songs: [{ id: 'aaaaaaaaaaa' }] };
    expect(decodePlaylist(encodePlaylist(minimal))).toEqual(minimal);
  });

  it('round-trips the optional sender name (from) through encode/decode', () => {
    const withFrom: SharedPlaylist = {
      title: 'x',
      message: 'hi',
      from: '예진',
      songs: [{ id: 'aaaaaaaaaaa' }],
    };
    expect(decodePlaylist(encodePlaylist(withFrom))).toEqual(withFrom);
  });

  it('buildSharePayload carries from into the encoded payload', () => {
    const { encoded } = buildSharePayload(
      { title: 'L', message: 'm', from: '보낸이' },
      [{ id: 'aaaaaaaaaaa', title: 'A' }],
    );
    expect(decodePlaylist(encoded)?.from).toBe('보낸이');
  });

  it('rejects a payload whose from is not a string', () => {
    const enc = (obj: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    expect(decodePlaylist(enc({ title: 'x', from: 123, songs: [{ id: 'aaaaaaaaaaa' }] }))).toBeNull();
  });

  it('returns null for invalid base64url input', () => {
    expect(decodePlaylist('!!!not base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON is not valid JSON', () => {
    // "{" encoded as base64url -> not a complete object
    const b64 = btoa('{').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    expect(decodePlaylist(b64)).toBeNull();
  });

  it('returns null when shape is not a SharedPlaylist', () => {
    const enc = (obj: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    expect(decodePlaylist(enc({ foo: 'bar' }))).toBeNull(); // no title/songs
    expect(decodePlaylist(enc({ title: 'x', songs: 'nope' }))).toBeNull(); // songs not array
    expect(decodePlaylist(enc({ title: 1, songs: [] }))).toBeNull(); // title not string
    expect(decodePlaylist(enc(['array']))).toBeNull(); // not an object
    expect(decodePlaylist(enc(null))).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodePlaylist('')).toBeNull();
  });

  it('rejects a payload whose song id is not a valid 11-char YouTube id (Fix 15+20)', () => {
    const enc = (obj: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    // too short
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abc' }] }))).toBeNull();
    // empty string id
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: '' }] }))).toBeNull();
    // 12 chars (too long)
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abcdefghijkl' }] }))).toBeNull();
    // illegal char (space) but right length
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abc 1234567' }] }))).toBeNull();
    // one good + one bad -> whole playlist rejected (every() guard)
    expect(
      decodePlaylist(enc({ title: 'x', songs: [{ id: 'aaaaaaaaaaa' }, { id: 'bad' }] })),
    ).toBeNull();
  });

  it('decodes a title-dropped (id-only) payload built by buildSharePayload', () => {
    const songs = [{ id: 'aaaaaaaaaaa', title: 'A' }, { id: 'bbbbbbbbbbb', title: 'B' }];
    const { encoded } = buildSharePayload({ title: 'L', message: 'm' }, songs, 1);
    const decoded = decodePlaylist(encoded);
    expect(decoded?.songs.map((s) => s.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(decoded?.songs.every((s) => s.title === undefined)).toBe(true);
  });

  it('accepts a payload with all valid 11-char ids', () => {
    const enc = (obj: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    const ok = { title: 'x', songs: [{ id: 'aaaaaaaaaaa' }, { id: 'b_c-d123456' }] };
    expect(decodePlaylist(enc(ok))).toEqual(ok);
  });
});
