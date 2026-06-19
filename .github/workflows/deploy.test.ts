import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// NOTE: vitest is configured with `css: true`, which makes the bundler resolve
// `new URL('./deploy.yml', import.meta.url)` to an http://localhost dev-server URL
// (with the configured base path), so fileURLToPath() throws ERR_INVALID_URL_SCHEME.
// We read the file from the project root (process.cwd()) instead — this is a text
// regression check on the workflow source.
const yml = readFileSync(
  resolve(process.cwd(), '.github/workflows/deploy.yml'),
  'utf-8',
);

describe('GitHub Pages deploy workflow', () => {
  it('triggers on push to main', () => {
    expect(yml).toMatch(/on:\s*[\s\S]*push:/);
    expect(yml).toMatch(/branches:\s*\[\s*main\s*\]|-\s*main/);
  });

  it('grants Pages permissions', () => {
    expect(yml).toContain('pages: write');
    expect(yml).toContain('id-token: write');
  });

  it('uses the required actions', () => {
    expect(yml).toContain('actions/checkout@');
    expect(yml).toContain('actions/setup-node@');
    expect(yml).toContain('actions/configure-pages@');
    expect(yml).toContain('actions/upload-pages-artifact@');
    expect(yml).toContain('actions/deploy-pages@');
  });

  it('sets node 20 and runs ci + build', () => {
    expect(yml).toContain("node-version: '20'");
    expect(yml).toContain('npm ci');
    expect(yml).toContain('npm run build');
  });

  it('uploads the dist directory and targets the github-pages environment', () => {
    expect(yml).toContain('path: ./dist');
    expect(yml).toContain('environment:');
    expect(yml).toContain('github-pages');
  });
});
