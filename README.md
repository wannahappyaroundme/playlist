# Yejin Playlist

A small, personal "send someone a playlist" web app. The sender builds a short
playlist from YouTube links, optionally writes a message, and shares a single
link. The recipient opens it to a play gate (cover + message), then watches each
song play with a spinning LP disc and time-synced lyrics. Everything lives
client-side (localStorage + a self-contained share link) — there is no backend.

## Local development

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server (hot reload)
npm test         # run the full Vitest suite once
npm run build    # type-check (tsc) + production build into dist/
```

`npm run build` also copies `dist/index.html` to `dist/404.html` so client-side
routes survive a hard refresh on GitHub Pages.

## Deploy (GitHub Pages)

The app is served from a sub-path, so the Vite `base` **must** match the path
the site is served from, or every asset 404s.

1. **Set the base.** `base` defaults to `/yejin-playlist/` and is overridable via
   the `VITE_BASE` env var (see `vite.config.ts`). Keep the default if the repo
   is named `yejin-playlist`. Otherwise set `VITE_BASE` to your repo path:
   - Different repo name → `VITE_BASE=/your-repo-name/`
   - Custom domain or root deployment → `VITE_BASE=/`
2. **Enable Pages.** Repo Settings → Pages → Build and deployment → **Source =
   GitHub Actions**.
3. **Push to `main`.** The workflow in `.github/workflows/deploy.yml` runs the
   tests, builds, and publishes `dist/`. Broken tests block the deploy.

If assets 404 after deploy, the `base` does not match the served path — fix
`VITE_BASE` (or the repo name) so they line up.

## E2E smoke test (real browser)

Unit tests (`npm test`) run in jsdom and cannot exercise the YouTube IFrame /
LRCLIB / canvas color path. To verify the real runtime end-to-end:

```bash
npm run build
npm run preview -- --port 4173 --strictPort &
npm run e2e   # drives a headless browser: paste link -> resolve -> play -> lyrics
```
