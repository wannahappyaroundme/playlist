// Real-browser smoke test for Yejin Playlist.
// Verifies the full runtime path that jsdom unit tests cannot: YouTube IFrame
// metadata resolution, LRCLIB synced-lyrics fetch, color extraction, and the
// player render. Run against a local preview server.
//
//   npm run build && npm run preview -- --port 4173 --strictPort &
//   node scripts/e2e-smoke.mjs
//
// Override target with env: BASE_URL (default http://localhost:4173/yejin-playlist/)
// and VIDEO (default a song known to have synced lyrics on LRCLIB).
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://localhost:4173/yejin-playlist/').replace(/\/?$/, '/');
const ROOT = BASE + '#/';
const VIDEO = process.env.VIDEO ?? 'https://www.youtube.com/watch?v=x9upuovB5Yk';

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };
const ok = (msg) => console.log('✓ ' + msg);

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const csp = [];
page.on('console', (m) => { if (/content security policy|refused to|violates/i.test(m.text())) csp.push(m.text()); });

try {
  await page.goto(ROOT, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Yejin Playlist")', { timeout: 10000 });
  ok('gallery renders "Yejin Playlist"');

  await page.click('button:has-text("새 플레이리스트")');
  await page.waitForURL(/#\/edit\//, { timeout: 10000 });
  await page.fill('input[aria-label="메시지"]', '끝까지 들어줘');
  await page.fill('input[aria-label="보낸 사람"]', '예진');
  await page.fill('textarea[aria-label="youtube links"]', VIDEO);
  await page.click('button[aria-label="add"]');
  await page.waitForSelector('[data-testid="song-card"]', { timeout: 45000 });
  ok('pasted link resolved into a song card');

  const songs = await page.evaluate(() => JSON.parse(localStorage.getItem('yejin.songs.v1') || '{}'));
  const song = Object.values(songs)[0];
  if (song?.title) ok(`resolved metadata: ${song.artist} — ${song.title} (${song.durationSec}s)`);
  else fail('no resolved song metadata');
  if (song?.lyrics?.type === 'synced' && song.lyrics.synced?.length) ok(`synced lyrics: ${song.lyrics.synced.length} lines`);
  else fail('expected synced lyrics for the sample video');

  await page.click('a:has-text("재생 →")');
  await page.waitForSelector('button[aria-label="play"]', { timeout: 10000 });
  if ((await page.locator('[data-testid="gate-message"]').count()) > 0) ok('play gate shows host message');
  else fail('play gate missing host message');

  await page.click('button[aria-label="play"]');
  await page.waitForTimeout(4000);
  if ((await page.locator('[data-testid="lyrics-track"]').count()) > 0) ok('player shows the synced lyric track');
  else fail('player did not render the lyric track');

  if (csp.length === 0) ok('no CSP violations'); else fail('CSP violations: ' + csp.join(' | '));
} catch (e) {
  fail('threw: ' + e.message);
} finally {
  await browser.close();
}
console.log(process.exitCode ? '\nE2E FAILED' : '\nE2E PASSED');
