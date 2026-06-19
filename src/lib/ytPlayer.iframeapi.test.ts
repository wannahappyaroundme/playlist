import { describe, it, expect, beforeEach } from 'vitest';
import { IFRAME_API_SRC, ensureIframeApiScript } from './ytPlayer';

describe('ensureIframeApiScript', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('injects the IFrame API script tag once', () => {
    const inserted = ensureIframeApiScript(document);
    expect(inserted).toBe(true);
    const tags = document.querySelectorAll(`script[src="${IFRAME_API_SRC}"]`);
    expect(tags.length).toBe(1);
  });

  it('is idempotent: does not inject a second tag', () => {
    ensureIframeApiScript(document);
    const second = ensureIframeApiScript(document);
    expect(second).toBe(false);
    const tags = document.querySelectorAll(`script[src="${IFRAME_API_SRC}"]`);
    expect(tags.length).toBe(1);
  });
});
