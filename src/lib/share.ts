import type { SharedPlaylist } from '../types';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function encodePlaylist(p: SharedPlaylist): string {
  const json = JSON.stringify(p);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}
