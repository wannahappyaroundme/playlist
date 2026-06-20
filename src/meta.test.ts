import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// NOTE: vitest runs with `css: true`, which makes `fileURLToPath(new URL(...))`
// throw under the dev-server base. These are plain text-regression checks on the
// shipped HTML/robots sources, so we read from process.cwd() instead.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf-8');

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
