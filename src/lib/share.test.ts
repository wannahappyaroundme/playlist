import { describe, expect, it } from 'vitest';
import type { SharedPlaylist } from '../types';
import { decodePlaylist, encodePlaylist } from './share';

const sample: SharedPlaylist = {
  title: '심야의 라운지',
  message: 'for you',
  songs: [{ id: 'abc12345678', title: 'Track A' }, { id: 'def98765432' }],
};

describe('encodePlaylist', () => {
  it('produces a URL-safe base64url string (no +, /, or =)', () => {
    const enc = encodePlaylist(sample);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(enc).not.toMatch(/[+/=]/);
  });

  it('round-trips back to the same JSON via the same base64url scheme', () => {
    const enc = encodePlaylist(sample);
    // reverse the transform manually to assert the scheme, independent of decode()
    const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    expect(JSON.parse(json)).toEqual(sample);
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
