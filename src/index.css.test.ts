import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// NOTE: vitest is configured with `css: true`, which makes the bundler resolve
// `new URL('./index.css', import.meta.url)` to an http://localhost dev-server URL
// (with the configured base path), so fileURLToPath() throws ERR_INVALID_URL_SCHEME.
// We read the file from the project root (process.cwd()) instead — this is a text
// regression check on the CSS source, not a module import.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');

describe('index.css design tokens', () => {
  it('declares Tailwind layer directives', () => {
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
  });

  it('declares all required design tokens', () => {
    const tokens = [
      '--c1',
      '--c2',
      '--c3',
      '--line-active',
      '--line-near',
      '--line-far',
      '--line-faint',
      '--ease-soft',
      '--dur-line',
      '--dur-bg',
      '--spin-dur',
      '--lp-overlap',
    ];
    for (const t of tokens) {
      expect(css, `missing token ${t}`).toContain(`${t}:`);
    }
  });
});
