import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import type { SharedPlaylist } from '../types';
import { buildSharePayload, decodePlaylist, encodePlaylist } from './share';

// 실제 유튜브 ID(64비트 → 11자 base64url, 마지막 글자 하위 2비트=0)라 8바이트로 무손실 왕복된다.
const RID = ['x9upuovB5Yk', 'dQw4w9WgXcQ', 'Qvh9vLfWTR8', 'TBk11KmfrZY', '9bZkp7q19f0', 'kJQP7kiw5Fk'];

const sample: SharedPlaylist = {
  title: '심야의 라운지',
  message: 'for you',
  from: '예진',
  songs: [{ id: RID[0] }, { id: RID[1] }],
};

// 아주 옛 링크(압축 전): base64url(UTF-8 JSON).
function legacyEncode(p: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('encodePlaylist (compact byte-packed)', () => {
  it('tags compact payloads with the ~~ marker and round-trips', () => {
    const enc = encodePlaylist(sample);
    expect(enc.startsWith('~~')).toBe(true);
    expect(decodePlaylist(enc)).toEqual(sample);
  });

  it('is shorter than both the lz and the legacy base64url encodings', () => {
    const big: SharedPlaylist = {
      title: '너에게 보내는 새벽 감성 플레이리스트 — 끝까지 들어줘',
      message: '오늘 하루도 고생 많았어. 이 노래 들으며 푹 쉬어',
      from: '예진',
      songs: Array.from({ length: 20 }, (_, i) => ({ id: RID[i % RID.length] })),
    };
    const compact = encodePlaylist(big);
    const lz = '~' + compressToEncodedURIComponent(JSON.stringify(big));
    const legacy = legacyEncode(big);
    expect(compact.length).toBeLessThan(lz.length);
    expect(compact.length).toBeLessThan(legacy.length);
  });

  it('falls back to the lz (~) format for an id that cannot byte-pack losslessly', () => {
    // 'aaaaaaaaaaa' ends in a char whose low 2 bits are non-zero → not 8-byte round-trippable
    const p: SharedPlaylist = { title: 'x', songs: [{ id: 'aaaaaaaaaaa' }] };
    const enc = encodePlaylist(p);
    expect(enc.startsWith('~~')).toBe(false);
    expect(enc[0]).toBe('~');
    expect(decodePlaylist(enc)).toEqual(p);
  });
});

describe('decodePlaylist round-trips', () => {
  it('round-trips a full playlist (title, message, from, color)', () => {
    const p: SharedPlaylist = {
      title: '제목',
      message: '메시지',
      from: '예진',
      color: '#a855f7',
      songs: [{ id: RID[2] }, { id: RID[3] }],
    };
    expect(decodePlaylist(encodePlaylist(p))).toEqual(p);
  });

  it('round-trips a minimal playlist (title + one id)', () => {
    const p: SharedPlaylist = { title: 'x', songs: [{ id: RID[0] }] };
    expect(decodePlaylist(encodePlaylist(p))).toEqual(p);
  });

  it('omits per-song titles from the URL (recovered when the link is opened)', () => {
    const p = { title: 'x', songs: [{ id: RID[0], title: 'Track A' }] } as SharedPlaylist;
    const decoded = decodePlaylist(encodePlaylist(p));
    expect(decoded?.songs[0].id).toBe(RID[0]);
    expect(decoded?.songs[0].title).toBeUndefined();
  });
});

describe('decodePlaylist backward-compat', () => {
  it('decodes a legacy (uncompressed base64url) link', () => {
    const legacy: SharedPlaylist = { title: '심야', message: 'hi', songs: [{ id: RID[0] }, { id: RID[1] }] };
    expect(decodePlaylist(legacyEncode(legacy))).toEqual(legacy);
  });

  it('decodes an lz (~) link from the previous format', () => {
    const p: SharedPlaylist = { title: '심야', from: '예진', songs: [{ id: RID[0] }] };
    const lz = '~' + compressToEncodedURIComponent(JSON.stringify(p));
    expect(decodePlaylist(lz)).toEqual(p);
  });
});

describe('buildSharePayload', () => {
  const songs = [{ id: RID[0] }, { id: RID[1] }];

  it('encodes id-only and round-trips the ids in order (no titles in URL)', () => {
    const r = buildSharePayload({ title: 'L', message: 'm' }, songs);
    expect(r.titlesDropped).toBe(false);
    const decoded = decodePlaylist(r.encoded);
    expect(decoded?.songs.map((s) => s.id)).toEqual([RID[0], RID[1]]);
    expect(decoded?.songs.every((s) => s.title === undefined)).toBe(true);
  });

  it('single-song share encodes exactly one song (이 곡만 보내기)', () => {
    const { encoded } = buildSharePayload({ title: 'Track A' }, [{ id: RID[0] }]);
    const decoded = decodePlaylist(encoded);
    expect(decoded?.songs).toHaveLength(1);
    expect(decoded?.songs[0].id).toBe(RID[0]);
  });

  it('carries from/color/message into the encoded payload', () => {
    const { encoded } = buildSharePayload(
      { title: 'L', message: 'm', from: '보낸이', color: '#3b82f6' },
      [{ id: RID[0] }],
    );
    const d = decodePlaylist(encoded);
    expect(d?.from).toBe('보낸이');
    expect(d?.color).toBe('#3b82f6');
    expect(d?.message).toBe('m');
  });

  it('tooLong is false for a small playlist', () => {
    expect(buildSharePayload({ title: 'L' }, songs).tooLong).toBe(false);
  });

  it('tooLong reflects whether the encoded payload exceeds maxEncoded', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: RID[i % RID.length] }));
    const len = buildSharePayload({ title: 'L' }, many).encoded.length;
    expect(buildSharePayload({ title: 'L' }, many, len - 1).tooLong).toBe(true);
    expect(buildSharePayload({ title: 'L' }, many, len + 1).tooLong).toBe(false);
  });
});

describe('decodePlaylist rejects bad input', () => {
  // 옛 base64url(JSON) 링크를 흉내내는 헬퍼 — 레거시 디코드 경로를 탄다.
  const enc = (obj: unknown) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  it('rejects a payload whose from is not a string', () => {
    expect(decodePlaylist(enc({ title: 'x', from: 123, songs: [{ id: RID[0] }] }))).toBeNull();
  });

  it('returns null for invalid base64url input', () => {
    expect(decodePlaylist('!!!not base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON is not valid JSON', () => {
    const b64 = btoa('{').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    expect(decodePlaylist(b64)).toBeNull();
  });

  it('returns null when shape is not a SharedPlaylist', () => {
    expect(decodePlaylist(enc({ foo: 'bar' }))).toBeNull();
    expect(decodePlaylist(enc({ title: 'x', songs: 'nope' }))).toBeNull();
    expect(decodePlaylist(enc({ title: 1, songs: [] }))).toBeNull();
    expect(decodePlaylist(enc(['array']))).toBeNull();
    expect(decodePlaylist(enc(null))).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodePlaylist('')).toBeNull();
  });

  it('rejects a payload whose song id is not a valid 11-char YouTube id (Fix 15+20)', () => {
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abc' }] }))).toBeNull();
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: '' }] }))).toBeNull();
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abcdefghijkl' }] }))).toBeNull();
    expect(decodePlaylist(enc({ title: 'x', songs: [{ id: 'abc 1234567' }] }))).toBeNull();
    expect(
      decodePlaylist(enc({ title: 'x', songs: [{ id: RID[0] }, { id: 'bad' }] })),
    ).toBeNull();
  });

  it('accepts a legacy payload with all valid 11-char ids', () => {
    const ok = { title: 'x', songs: [{ id: 'aaaaaaaaaaa' }, { id: 'b_c-d123456' }] };
    expect(decodePlaylist(enc(ok))).toEqual(ok);
  });
});
