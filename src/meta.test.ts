import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// NOTE: vitest runs with `css: true`, which makes `fileURLToPath(new URL(...))`
// throw under the dev-server base. These are plain text-regression checks on the
// shipped HTML/robots sources, so we read from process.cwd() instead.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf-8');

const OG_DESC = '누군가 당신에게 플레이리스트를 보냈어요 — 가사와 함께 흐르는 한 곡.';

describe('index.html privacy meta', () => {
  it('declares robots noindex, nofollow', () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});

describe('public/robots.txt', () => {
  it('disallows all crawlers', () => {
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /');
  });
});

describe('index.html Open Graph / Twitter meta', () => {
  it('has Open Graph tags for share previews', () => {
    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="Yejin Playlist"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain(OG_DESC);
    expect(html).toContain('property="og:type"');
    expect(html).toContain('content="website"');
    expect(html).toContain('property="og:image"');
    // absolute URL to the optimized jpg (crawlers often can't read relative OG images)
    expect(html).toContain('https://wannahappyaroundme.github.io/playlist/og.jpg');
  });

  it('mirrors a Twitter summary_large_image card', () => {
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
  });
});
