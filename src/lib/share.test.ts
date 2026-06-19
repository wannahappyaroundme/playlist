import { describe, expect, it } from 'vitest';
import type { SharedPlaylist } from '../types';
import { encodePlaylist } from './share';

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
