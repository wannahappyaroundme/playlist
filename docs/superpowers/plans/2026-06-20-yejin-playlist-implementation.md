# Yejin Playlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 링크를 홈페이지에서 붙여넣으면 만들어지는, QR로 공유하는 LP 가사 비주얼라이저(좌측 회전 LP+커버, 우측 싱크 가사, 곡 색 그라데이션 배경)를 백엔드 없이 GitHub Pages에 배포한다.

**Architecture:** 정적 SPA(앱 껍데기만 배포) + 모든 콘텐츠는 브라우저 런타임 생성. 재생=숨김 YouTube IFrame Player, 제목/아티스트=`getVideoData()`, 커버=ytimg 썸네일, 색=canvas 추출+명도 클램프, 가사=LRCLIB fetch+LRC 파싱. 저장=localStorage, 공유=플레이리스트를 URL에 인코딩한 링크/QR. 재생은 App 루트의 단일 숨김 플레이어가 라우트 전환에도 유지되고, 곡 추가는 별도 '프로브' 플레이어로 메타를 추출해 현재 재생을 방해하지 않는다.

**Tech Stack:** Vite 5 · React 18 · TypeScript 5(strict) · Tailwind CSS 3 · react-router-dom 6(HashRouter) · qrcode 1 · Vitest 1 + @testing-library/react + jsdom. Node 20 / npm.

## Global Constraints

이 섹션의 제약은 모든 태스크에 암묵적으로 포함된다. 값은 spec에서 그대로 가져온 것.

- **스택 버전(고정):** Vite ^5, React ^18, react-dom ^18, react-router-dom ^6, TypeScript ^5(strict), Tailwind ^3(@tailwind 디렉티브 + postcss 방식; v4로 올리지 말 것), Vitest ^1, jsdom ^24, qrcode ^1. Node 20.
- **배포:** GitHub Pages, `vite.config.ts`의 `base: '/yejin-playlist/'`(프로젝트 페이지 기준 — 커스텀 도메인/루트면 `'/'`). 빌드 후 `dist/index.html`을 `dist/404.html`로 복사(SPA/해시 라우팅 안전).
- **백엔드/키 없음:** 서버·DB·API 키·`.env` 비밀값 전부 사용 안 함. 런타임 외부 호출은 오직 YouTube IFrame, `i.ytimg.com` 썸네일, `lrclib.net` 가사뿐. **오디오 다운로드/추출 절대 금지(YouTube 약관).**
- **저장/공유:** localStorage 키 `yejin.songs.v1`(곡 풀), `yejin.playlists.v1`(플레이리스트). 공유는 `SharedPlaylist`를 base64url로 URL 해시(`#/s/<encoded>`)에 인코딩.
- **재생 모드:** `off`(끝까지→정지) / `all`(전체 루프) / `one`(한곡 반복). 모바일 자동재생 금지 → 첫 탭 게이트. 단일 숨김 플레이어는 라우트 전환에도 유지, 곡 추가는 프로브 플레이어로 현재 재생 방해 금지.
- **가사 폴백:** `synced`→`plain`→`none` 순으로 우아하게 강등. 어떤 경우에도 화면이 비지 않고 재생은 유지(가사 없으면 LP+색 배경).
- **색 가독성:** 추출색은 `clampLightness(L 0.15~0.40)` + `ensureReadableOnWhite(대비 ≥ 4.5)` 적용 후 사용. 실패 시 `FALLBACK_COLORS`.
- **브랜드 텍스트:** 시작/홈 타이틀은 정확히 `Yejin Playlist`.
- **접근성:** `prefers-reduced-motion: reduce`에서 LP 회전·배경 drift·줄 scale 비활성(색 전환만 유지).
- **개발 규율:** 순수 로직은 Vitest로 TDD(실패→구현→통과), 시각/IFrame/canvas는 RTL 스모크 + 수동 검증 체크리스트. Conventional Commits, 태스크 단위 커밋.
- **보안 기준:** `.gitignore`에 `.env*`/키 포함, 하드코딩 비밀 없음(이 앱은 비밀이 없음).

## 파일 구조 (decomposition)

```
yejin-playlist/
├─ index.html                         # #root + Pretendard 폰트
├─ package.json · vite.config.ts · tsconfig*.json · tailwind.config.js · postcss.config.js
├─ .github/workflows/deploy.yml       # GitHub Pages CI
├─ public/                            # (404.html은 빌드 postbuild로 생성)
└─ src/
   ├─ main.tsx · App.tsx              # 진입점 + HashRouter/Routes/PlaybackProvider
   ├─ index.css                       # Tailwind + 디자인 토큰(CSS 변수)
   ├─ types.ts                        # 공통 타입(Song, Playlist, SongColors, RepeatMode …)
   ├─ lib/
   │  ├─ youtube.ts                   # parseVideoId, thumbnailUrl, parseTitleHeuristic
   │  ├─ queue.ts                     # nextIndex/prevIndex (재생 모드 핵심)
   │  ├─ lrc.ts                       # parseLrc, findActiveIndex(이진탐색)
   │  ├─ time.ts                      # estimateTime(보간)
   │  ├─ lrclib.ts                    # fetchLyrics(LRCLIB)
   │  ├─ colors.ts                    # 색 변환/대비/quantize/buildSongColors/extractPalette
   │  ├─ storage.ts                   # localStorage 곡 풀/플레이리스트
   │  ├─ share.ts                     # encodePlaylist/decodePlaylist
   │  └─ ytPlayer.ts                  # YouTube IFrame 래퍼
   ├─ playback/PlaybackContext.tsx    # 단일 재생 컨텍스트(라우트 전환에도 유지)
   ├─ hooks/
   │  ├─ useSongResolver.ts           # 프로브 플레이어로 링크→Song 해석
   │  ├─ useLyricSync.ts              # rAF 싱크 → activeIndex
   │  └─ usePlaylists.ts              # storage 래핑 + 상태
   ├─ components/                     # LpDisc, GradientBg, LyricsView, PlayGate, Controls, SongCard, PasteInput, QrShare
   └─ pages/                          # Gallery, Player, Editor, SharedView
```

**실행 순서(의존성):** A(스캐폴딩) → B·C·D·E(순수 라이브러리, 상호 독립) → F(통합: 플레이어·컨텍스트·훅) → G(컴포넌트) → H(페이지·라우팅). 아래 태스크는 이 순서로 정렬되어 있다.

---


<!-- ===== MODULE A-scaffolding-tooling-deploy ===== -->

## 모듈 A — 프로젝트 스캐폴딩 / 툴링 / 배포 파이프라인

이 모듈은 빈 디렉터리 `/Users/kyungsbook/Desktop/playlist`(현재 `docs/`만 존재)를 완전한 Vite + React 18 + TS + Tailwind + Vitest 프로젝트로 부트스트랩하고, GitHub Pages 자동배포 파이프라인을 구성한다. 다른 모든 모듈(lib/components/pages/hooks)의 토대가 되므로 가장 먼저 실행된다.

> 검증 철학: 설정 파일은 "빈 앱이 실제로 뜨고(`npm run dev`), 테스트 러너가 실제로 돈다(`npm test`), 프로덕션 빌드가 실제로 나온다(`npm run build`)"로 증명한다. 단순 "파일 작성"이 아니라 런타임/빌드 결과로 확인한다.

---

### Task: git 저장소 초기화 + .gitignore (보안 최소셋)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/.gitignore`
- (Run) `git init` in `/Users/kyungsbook/Desktop/playlist`

**Interfaces:**
- Consumes: 없음
- Produces: 초기화된 git 저장소 + 추적 제외 규칙(`node_modules`, `dist`, `.env*`, `*.log`, `coverage`, `.DS_Store`)

이 태스크는 TDD 사이클이 아니라 환경 부트스트랩이다. 검증은 "git 저장소가 존재하고 무시 규칙이 실제로 적용되는가"를 명령으로 확인한다.

- [ ] **Step: git 저장소 초기화 (main 브랜치)**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist init -b main
  ```
- [ ] **Step: .gitignore 작성**
  Create `/Users/kyungsbook/Desktop/playlist/.gitignore`:
  ```gitignore
  # dependencies
  node_modules/

  # build output
  dist/
  dist-ssr/
  coverage/

  # secrets / env (global security baseline)
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
  *.p12

  # logs
  *.log
  npm-debug.log*
  yarn-debug.log*
  yarn-error.log*
  pnpm-debug.log*

  # editor / OS
  .DS_Store
  .vscode/*
  !.vscode/extensions.json
  .idea/
  *.suo
  *.ntvs*
  *.njsproj
  *.sln
  ```
- [ ] **Step: 무시 규칙이 실제로 적용되는지 검증**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist check-ignore -v node_modules dist .env foo.log
  ```
  예상 출력: 네 항목 모두 `.gitignore:<line>:<pattern>\t<path>` 형태로 매칭되어 출력된다(매칭되면 exit 0). 매칭이 없으면 아무 것도 출력되지 않으므로, 위 4개가 모두 줄로 보이면 통과.
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add .gitignore
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: init repo with .gitignore security baseline"
  ```

---

### Task: package.json + 의존성 설치 (npm)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/package.json`

**Interfaces:**
- Consumes: 없음
- Produces: 의존성/스크립트가 고정된 `package.json`
  - deps: `react@^18.3.1`, `react-dom@^18.3.1`, `react-router-dom@^6.26.2`, `qrcode@^1.5.4`
  - devDeps: `vite@^5.4.8`, `@vitejs/plugin-react@^4.3.2`, `typescript@^5.6.2`, `tailwindcss@^3.4.13`, `postcss@^8.4.47`, `autoprefixer@^10.4.20`, `vitest@^1.6.0`, `jsdom@^24.1.3`, `@testing-library/react@^14.3.1`, `@testing-library/jest-dom@^6.5.0`, `@types/react@^18.3.10`, `@types/react-dom@^18.3.0`, `@types/qrcode@^1.5.5`
  - scripts: `dev`, `build`(`tsc && vite build && npm run postbuild`), `postbuild`(`cp dist/index.html dist/404.html`), `preview`, `test`

- [ ] **Step: package.json 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/package.json`:
  ```json
  {
    "name": "yejin-playlist",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build && npm run postbuild",
      "postbuild": "cp dist/index.html dist/404.html",
      "preview": "vite preview",
      "test": "vitest run"
    },
    "dependencies": {
      "qrcode": "^1.5.4",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.26.2"
    },
    "devDependencies": {
      "@testing-library/jest-dom": "^6.5.0",
      "@testing-library/react": "^14.3.1",
      "@types/qrcode": "^1.5.5",
      "@types/react": "^18.3.10",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.2",
      "autoprefixer": "^10.4.20",
      "jsdom": "^24.1.3",
      "postcss": "^8.4.47",
      "tailwindcss": "^3.4.13",
      "typescript": "^5.6.2",
      "vite": "^5.4.8",
      "vitest": "^1.6.0"
    }
  }
  ```
- [ ] **Step: 의존성 설치 (lockfile 생성)**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist install
  ```
  예상 결과: `node_modules/`와 `package-lock.json` 생성. 출력 끝에 `added <N> packages` 표시, 치명적 ERR 없음(peer 경고 정도는 허용).
- [ ] **Step: 설치 무결성 검증**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist ls react react-dom react-router-dom vite vitest tailwindcss 2>&1 | head -20
  ```
  예상 결과: 각 패키지가 설치된 버전과 함께 트리에 표시된다(`UNMET DEPENDENCY` 없음).
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add package.json package-lock.json
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: add package.json and install dependencies"
  ```

---

### Task: TypeScript 설정 (tsconfig.json + tsconfig.node.json)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/tsconfig.json`
- Create: `/Users/kyungsbook/Desktop/playlist/tsconfig.node.json`

**Interfaces:**
- Consumes: 없음
- Produces: strict 모드 TS 설정. `jsx: react-jsx`, `moduleResolution: bundler`, vitest globals + jest-dom 타입 인식. `build` 스크립트의 `tsc` 단계가 의존.

- [ ] **Step: tsconfig.json 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "types": ["vitest/globals", "@testing-library/jest-dom"]
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }
  ```
- [ ] **Step: tsconfig.node.json 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/tsconfig.node.json`:
  ```json
  {
    "compilerOptions": {
      "composite": true,
      "skipLibCheck": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true,
      "strict": true
    },
    "include": ["vite.config.ts"]
  }
  ```
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add tsconfig.json tsconfig.node.json
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: add TypeScript configs"
  ```
  (이 설정 파일들은 후속 태스크의 `tsc`/`vitest` 실행으로 함께 검증된다.)

---

### Task: Vite + Vitest 설정 (vite.config.ts)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/vite.config.ts`

**Interfaces:**
- Consumes: `@vitejs/plugin-react`, `vitest/config`
- Produces: `vite.config.ts` — `react()` 플러그인, `base:'/yejin-playlist/'`, `test:{ environment:'jsdom', globals:true, setupFiles:['./src/test/setup.ts'], css:true }`

- [ ] **Step: vite.config.ts 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/vite.config.ts`:
  ```ts
  /// <reference types="vitest/config" />
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';

  // base must match the GitHub Pages project path (repo name).
  // Change to '/' for a custom domain or root deployment.
  export default defineConfig({
    plugins: [react()],
    base: '/yejin-playlist/',
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  });
  ```
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add vite.config.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: add Vite + Vitest config (base path, jsdom)"
  ```
  (런타임 검증은 이후 "빈 앱 구동" 태스크에서 `npm run dev`/`npm test`로 일괄 수행한다.)

---

### Task: Tailwind + PostCSS 설정

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/tailwind.config.js`
- Create: `/Users/kyungsbook/Desktop/playlist/postcss.config.js`

**Interfaces:**
- Consumes: `tailwindcss`, `autoprefixer`, `postcss`
- Produces: Tailwind v3 content 스캐닝 설정(`index.html` + `src/**/*`) + PostCSS 플러그인 체인. `src/index.css`의 `@tailwind` 디렉티브가 동작하도록 함.

- [ ] **Step: tailwind.config.js 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/tailwind.config.js`:
  ```js
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Pretendard', 'system-ui', 'sans-serif'],
        },
      },
    },
    plugins: [],
  };
  ```
- [ ] **Step: postcss.config.js 작성 (완전한 내용)**
  Create `/Users/kyungsbook/Desktop/playlist/postcss.config.js`:
  ```js
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
  ```
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add tailwind.config.js postcss.config.js
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: add Tailwind and PostCSS config"
  ```

---

### Task: index.css (Tailwind 디렉티브 + 디자인 토큰)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/index.css`
- Test: `/Users/kyungsbook/Desktop/playlist/src/index.css.test.ts`

**Interfaces:**
- Consumes: Tailwind/PostCSS 설정 (앞 태스크)
- Produces: `src/index.css` — `@tailwind base/components/utilities` + spec 7절 디자인 토큰 CSS 변수:
  - 색: `--c1`, `--c2`, `--c3` (gradient/accent 보간용 슬롯)
  - 가사 명도: `--line-active`(1.0), `--line-near`(.55), `--line-far`(.28), `--line-faint`(.14)
  - 이징/시간: `--ease-soft`, `--dur-line`, `--dur-bg`, `--spin-dur`
  - 레이아웃: `--lp-overlap`(LP/커버 슬라이드 오버랩 비율)

CSS 파일 자체는 단위테스트 대상이 아니지만, "토큰이 실제로 정의돼 있는지"를 파일 텍스트 검사로 회귀 방지한다(토큰 이름은 다른 모듈의 컴포넌트가 의존하는 계약이므로 오타/누락을 막는다).

- [ ] **Step: 실패하는 테스트 작성 (토큰 존재 검사)**
  Create `/Users/kyungsbook/Desktop/playlist/src/index.css.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';

  const css = readFileSync(
    fileURLToPath(new URL('./index.css', import.meta.url)),
    'utf-8',
  );

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
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/index.css.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `ENOENT: no such file or directory, open '.../src/index.css'` (파일 미존재로 readFileSync가 throw → 테스트 suite 로드 실패).
- [ ] **Step: 최소 구현 (index.css 작성)**
  Create `/Users/kyungsbook/Desktop/playlist/src/index.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  :root {
    /* --- color slots (interpolated per-song; see colors.ts) --- */
    --c1: #1a1830; /* gradientFrom */
    --c2: #0e0c1c; /* gradientTo */
    --c3: #7c5cff; /* accent */

    /* --- lyric line luminance steps (spec 7) --- */
    --line-active: 1;
    --line-near: 0.55;
    --line-far: 0.28;
    --line-faint: 0.14;

    /* --- easing & durations --- */
    --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);
    --dur-line: 550ms;   /* lyric scroll transition (clamped at runtime) */
    --dur-bg: 1200ms;    /* background crossfade between songs */
    --spin-dur: 5000ms;  /* LP one full rotation (linear) */

    /* --- layout --- */
    --lp-overlap: 42%;   /* LP slides over cover (40~45%) */

    color-scheme: dark;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: var(--c2);
    color: #ffffff;
    font-family: 'Pretendard', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* tabular numerals for progress time (spec 7) */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    :root {
      --spin-dur: 0ms;
    }
  }
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/index.css.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 PASS: `index.css design tokens` 2개 테스트 통과(`2 passed`).
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/index.css src/index.css.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: add index.css with Tailwind directives and design tokens"
  ```

---

### Task: index.html + main.tsx + vite-env.d.ts + test setup (진입점/타입/테스트 부트)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/index.html`
- Create: `/Users/kyungsbook/Desktop/playlist/src/main.tsx`
- Create: `/Users/kyungsbook/Desktop/playlist/src/vite-env.d.ts`
- Create: `/Users/kyungsbook/Desktop/playlist/src/test/setup.ts`

**Interfaces:**
- Consumes: `src/App.tsx`(다음 태스크에서 임시 스캐폴드 생성), `src/index.css`, `react-dom/client`
- Produces:
  - `index.html` — `<div id="root">`, Pretendard 웹폰트 `<link>`, `<script type="module" src="/src/main.tsx">`
  - `src/main.tsx` — `ReactDOM.createRoot(...).render(<React.StrictMode><App/></React.StrictMode>)`, `import './index.css'`
  - `src/vite-env.d.ts` — `/// <reference types="vite/client" />`
  - `src/test/setup.ts` — `import '@testing-library/jest-dom'` (vitest `setupFiles` 진입점)

이 태스크는 진입 인프라라 단위테스트보다 "파일 존재 + setup이 jest-dom matcher를 실제로 등록"하는 스모크로 검증한다. 풀 렌더 스모크는 다음 태스크(App)에서 한다.

- [ ] **Step: vite-env.d.ts 작성**
  Create `/Users/kyungsbook/Desktop/playlist/src/vite-env.d.ts`:
  ```ts
  /// <reference types="vite/client" />
  ```
- [ ] **Step: test setup 작성**
  Create `/Users/kyungsbook/Desktop/playlist/src/test/setup.ts`:
  ```ts
  import '@testing-library/jest-dom';
  ```
- [ ] **Step: 실패하는 테스트 작성 (jest-dom matcher 등록 검증)**
  Create `/Users/kyungsbook/Desktop/playlist/src/test/setup.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';

  describe('test setup', () => {
    it('registers @testing-library/jest-dom matchers', () => {
      const el = document.createElement('div');
      el.textContent = 'Yejin';
      document.body.appendChild(el);
      // toBeInTheDocument is provided by jest-dom via setupFiles
      expect(el).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/test/setup.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `src/test/setup.ts` 가 아직 `setupFiles`로 잘 로드되더라도 이 테스트 파일 자체는 통과할 수 있으므로, 먼저 setup.ts를 만들기 전 상태에서 실행하면 `TypeError: expect(...).toBeInTheDocument is not a function`. (앞 스텝에서 setup.ts를 이미 만들었다면, 이 검증 스텝은 "setup.ts를 일시 비워두고 실행 → 위 에러 확인 → 복원"으로 RED를 만든다. 빠르게 하려면: `git stash` 없이, setup.ts 내용을 잠깐 주석 처리 후 실행해 RED 확인, 다시 복원.)
- [ ] **Step: 최소 구현 — index.html + main.tsx 작성**
  Create `/Users/kyungsbook/Desktop/playlist/index.html`:
  ```html
  <!doctype html>
  <html lang="ko">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <title>Yejin Playlist</title>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
      <link
        rel="stylesheet"
        as="style"
        crossorigin
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```
  Create `/Users/kyungsbook/Desktop/playlist/src/main.tsx`:
  ```tsx
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App';
  import './index.css';

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/test/setup.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 PASS: `test setup > registers @testing-library/jest-dom matchers` 통과(`1 passed`). (이 시점엔 `src/App.tsx`가 아직 없어도 setup.test.ts는 App을 import하지 않으므로 통과한다.)
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add index.html src/main.tsx src/vite-env.d.ts src/test/setup.ts src/test/setup.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: add HTML entry, main.tsx, vite-env and test setup"
  ```

---

### Task: 임시 App.tsx 스모크 테스트 ("Yejin Playlist" 렌더) + 빈 앱 구동/빌드 검증

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/App.tsx` (임시 스캐폴드 — App 라우팅 계약 모듈이 후에 덮어씀)
- Test: `/Users/kyungsbook/Desktop/playlist/src/App.test.tsx`

**Interfaces:**
- Consumes: `@testing-library/react`(render/screen), `react`
- Produces: `src/App.tsx` — 기본 export 함수형 컴포넌트, `"Yejin Playlist"` 텍스트 렌더. (최종 버전은 HashRouter+Routes+PlaybackProvider로 교체되나, Gallery 홈 타이틀이 동일 "Yejin Playlist"라 스모크 테스트는 계속 유효.)

- [ ] **Step: 실패하는 스모크 테스트 작성**
  Create `/Users/kyungsbook/Desktop/playlist/src/App.test.tsx`:
  ```tsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import App from './App';

  describe('App', () => {
    it('renders the "Yejin Playlist" title', () => {
      render(<App />);
      expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/App.test.tsx --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `Failed to resolve import "./App" from "src/App.test.tsx"` (App.tsx 미존재로 import 해결 실패).
- [ ] **Step: 최소 구현 — 임시 App.tsx 작성**
  Create `/Users/kyungsbook/Desktop/playlist/src/App.tsx`:
  ```tsx
  // TEMPORARY scaffold. Replaced by the routing App (HashRouter + Routes +
  // PlaybackProvider) delivered by the pages/App module. The smoke test only
  // asserts the "Yejin Playlist" title, which the final Gallery home also renders.
  export default function App() {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <h1 className="text-2xl font-semibold tracking-tight">Yejin Playlist</h1>
      </main>
    );
  }
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/App.test.tsx --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 PASS: `App > renders the "Yejin Playlist" title` 통과(`1 passed`).
- [ ] **Step: 전체 테스트 스위트가 도는지 확인 (npm test)**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist test
  ```
  예상 결과: vitest가 모든 테스트 파일(index.css / test setup / App)을 수집해 전부 PASS. 출력에 `Test Files  3 passed` / `Tests  N passed`, exit 0.
- [ ] **Step: 프로덕션 빌드 + 404.html 생성 검증 (npm run build)**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist run build && ls -1 /Users/kyungsbook/Desktop/playlist/dist
  ```
  예상 결과: `tsc` 타입체크 통과 → `vite build`가 `dist/index.html` + 해시된 asset 산출 → postbuild가 `dist/404.html` 생성. `ls` 출력에 `index.html`과 `404.html`이 모두 보임. (해시된 asset 링크가 그대로 복사돼 SPA 새로고침 폴백이 동작.)
- [ ] **Step: 개발 서버 구동 수동 검증**
  - [ ] 터미널에서 `npm --prefix /Users/kyungsbook/Desktop/playlist run dev` 실행 → `Local: http://localhost:5173/yejin-playlist/` 출력 확인(base 경로 반영).
  - [ ] 브라우저에서 `http://localhost:5173/yejin-playlist/` 열기 → 가운데 정렬된 "Yejin Playlist" 헤딩이 보이고, 배경이 어두운 네이비(`--c2`)인지 확인.
  - [ ] 개발자도구 Network 탭에서 Pretendard CSS(jsdelivr)가 200으로 로드되는지 확인.
  - [ ] 콘솔에 빨간 에러가 없는지 확인. 확인 후 `Ctrl+C`로 종료.
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/App.tsx src/App.test.tsx
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: add temporary App scaffold with smoke test"
  ```

---

### Task: GitHub Pages 배포 워크플로 (.github/workflows/deploy.yml)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/.github/workflows/deploy.yml`
- Test: `/Users/kyungsbook/Desktop/playlist/.github/workflows/deploy.test.ts`

**Interfaces:**
- Consumes: `npm ci`, `npm run build`(→ `dist/` + `dist/404.html`), GitHub Actions `actions/checkout`, `actions/setup-node@v4` (node 20), `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`
- Produces: `main` 푸시 시 `dist/`를 GitHub Pages로 자동 배포하는 워크플로(`permissions: pages: write, id-token: write` + `environment: github-pages`)

워크플로 YAML은 실행 환경(GitHub Actions) 없이 로컬에서 실제 배포를 검증할 수 없으므로, (a) 핵심 계약(필수 액션/권한/스크립트가 빠지지 않았는지)을 텍스트 회귀 테스트로 잠그고, (b) 실제 배포는 푸시 후 Actions 탭 수동 검증으로 마무리한다.

- [ ] **Step: 실패하는 테스트 작성 (워크플로 계약 검증)**
  Create `/Users/kyungsbook/Desktop/playlist/.github/workflows/deploy.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { readFileSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';

  const yml = readFileSync(
    fileURLToPath(new URL('./deploy.yml', import.meta.url)),
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
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run .github/workflows/deploy.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `ENOENT: no such file or directory, open '.../.github/workflows/deploy.yml'` (워크플로 파일 미존재).
- [ ] **Step: 최소 구현 — deploy.yml 작성**
  Create `/Users/kyungsbook/Desktop/playlist/.github/workflows/deploy.yml`:
  ```yaml
  name: Deploy to GitHub Pages

  on:
    push:
      branches: [main]
    workflow_dispatch:

  permissions:
    contents: read
    pages: write
    id-token: write

  concurrency:
    group: pages
    cancel-in-progress: true

  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: npm

        - name: Install dependencies
          run: npm ci

        - name: Build
          run: npm run build

        - name: Setup Pages
          uses: actions/configure-pages@v5

        - name: Upload artifact
          uses: actions/upload-pages-artifact@v3
          with:
            path: ./dist

    deploy:
      needs: build
      runs-on: ubuntu-latest
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      steps:
        - name: Deploy to GitHub Pages
          id: deployment
          uses: actions/deploy-pages@v4
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run .github/workflows/deploy.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 PASS: `GitHub Pages deploy workflow` 5개 테스트 모두 통과(`5 passed`).
- [ ] **Step: 전체 스위트 재확인 (회귀 없음)**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist test
  ```
  예상 결과: 모든 테스트 파일 PASS, exit 0.
- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add .github/workflows/deploy.yml .github/workflows/deploy.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "ci: add GitHub Pages deploy workflow"
  ```
- [ ] **Step: 수동 검증 (배포 — 원격 저장소 연결 후)**
  - [ ] GitHub에 `yejin-playlist` 레포 생성 후 `git remote add origin <url>` → `git push -u origin main`.
  - [ ] 레포 Settings → Pages → Build and deployment → Source 를 `GitHub Actions`로 설정.
  - [ ] Actions 탭에서 `Deploy to GitHub Pages` 워크플로가 `build`→`deploy` 두 잡 모두 초록 체크로 끝나는지 확인.
  - [ ] 배포 URL `https://<user>.github.io/yejin-playlist/` 접속 → "Yejin Playlist" 헤딩 렌더 확인.
  - [ ] 주소를 `https://<user>.github.io/yejin-playlist/#/` 로 바꿔 새로고침 → 404 없이 동일 화면이 뜨는지(404.html 폴백 + 해시 라우팅) 확인.
  - [ ] (주의) 레포명이 `yejin-playlist`가 아니면 `vite.config.ts`의 `base`를 실제 레포명으로 수정 후 재푸시.

---


<!-- ===== MODULE B-types-youtube-queue ===== -->

## 모듈 그룹 B: types + youtube + queue

이 그룹은 외부 의존이 전혀 없는 순수 기반 모듈이다. `src/types.ts`는 전 모듈이 import 하는 타입 정의이고, `src/lib/youtube.ts`(URL/제목 파싱, 썸네일 URL)와 `src/lib/queue.ts`(재생모드 인덱스 계산)는 순수함수라 Vitest로 완전히 TDD 가능하다. 모든 태스크는 독립적으로 실행/커밋된다.

> 전제: 프로젝트는 greenfield(아직 `src/` 없음). 첫 태스크(Task 0)에서 Vite + React + TS + Tailwind + Vitest 토대를 세팅한다. 이미 다른 모듈 그룹의 토대 태스크가 동일 작업을 했다면 Task 0은 멱등하게 건너뛸 수 있다(파일이 이미 존재하면 그대로 둠). 이 그룹 단독으로도 빌드/테스트가 돌아가도록 Task 0을 포함한다.

---

### Task 0: 프로젝트 토대 세팅 (Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/package.json`
- Create: `/Users/kyungsbook/Desktop/playlist/tsconfig.json`
- Create: `/Users/kyungsbook/Desktop/playlist/tsconfig.node.json`
- Create: `/Users/kyungsbook/Desktop/playlist/vite.config.ts`
- Create: `/Users/kyungsbook/Desktop/playlist/vitest.setup.ts`
- Create: `/Users/kyungsbook/Desktop/playlist/.gitignore`
- Create: `/Users/kyungsbook/Desktop/playlist/index.html`
- Create: `/Users/kyungsbook/Desktop/playlist/tailwind.config.js`
- Create: `/Users/kyungsbook/Desktop/playlist/postcss.config.js`
- Create: `/Users/kyungsbook/Desktop/playlist/src/index.css`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/__sanity__.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: 빌드/테스트 토대(`npm run dev`, `npm run build`, `npm test`, `npx vitest run`). 다른 모든 태스크가 이 환경에 의존.

스텝:

- [ ] **Step: 디렉터리 + git 초기화**
  ```bash
  mkdir -p /Users/kyungsbook/Desktop/playlist/src/lib /Users/kyungsbook/Desktop/playlist/src/components /Users/kyungsbook/Desktop/playlist/src/pages /Users/kyungsbook/Desktop/playlist/src/hooks /Users/kyungsbook/Desktop/playlist/src/playback
  git -C /Users/kyungsbook/Desktop/playlist init
  ```

- [ ] **Step: package.json 작성**
  파일 `/Users/kyungsbook/Desktop/playlist/package.json`:
  ```json
  {
    "name": "yejin-playlist",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "preview": "vite preview",
      "test": "vitest run",
      "test:watch": "vitest",
      "typecheck": "tsc --noEmit"
    },
    "dependencies": {
      "qrcode": "^1.5.3",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.26.2"
    },
    "devDependencies": {
      "@testing-library/jest-dom": "^6.4.8",
      "@testing-library/react": "^16.0.1",
      "@types/qrcode": "^1.5.5",
      "@types/react": "^18.3.5",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      "autoprefixer": "^10.4.20",
      "jsdom": "^25.0.0",
      "postcss": "^8.4.45",
      "tailwindcss": "^3.4.10",
      "typescript": "^5.5.4",
      "vite": "^5.4.3",
      "vitest": "^2.0.5"
    }
  }
  ```

- [ ] **Step: tsconfig.json / tsconfig.node.json 작성**
  파일 `/Users/kyungsbook/Desktop/playlist/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "types": ["vitest/globals", "@testing-library/jest-dom"]
    },
    "include": ["src", "vitest.setup.ts"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/tsconfig.node.json`:
  ```json
  {
    "compilerOptions": {
      "composite": true,
      "skipLibCheck": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true,
      "strict": true
    },
    "include": ["vite.config.ts"]
  }
  ```

- [ ] **Step: vite.config.ts 작성 (Vitest 포함, base는 GitHub Pages용)**
  파일 `/Users/kyungsbook/Desktop/playlist/vite.config.ts`:
  ```ts
  /// <reference types="vitest" />
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    base: '/yejin-playlist/',
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  });
  ```

- [ ] **Step: vitest.setup.ts / .gitignore / index.html / tailwind / postcss / index.css 작성**
  파일 `/Users/kyungsbook/Desktop/playlist/vitest.setup.ts`:
  ```ts
  import '@testing-library/jest-dom/vitest';
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/.gitignore`:
  ```gitignore
  node_modules
  dist
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
  *.p12
  secrets/
  .DS_Store
  *.log
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/index.html`:
  ```html
  <!doctype html>
  <html lang="ko">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <title>Yejin Playlist</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/tailwind.config.js`:
  ```js
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: { extend: {} },
    plugins: [],
  };
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/postcss.config.js`:
  ```js
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
  ```
  파일 `/Users/kyungsbook/Desktop/playlist/src/index.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

- [ ] **Step: 의존성 설치**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist install
  ```
  예상: `added NNN packages` 출력, 에러 없음.

- [ ] **Step: 실패하는 sanity 테스트 작성**
  파일 `/Users/kyungsbook/Desktop/playlist/src/lib/__sanity__.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';

  describe('vitest toolchain', () => {
    it('runs and asserts', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- [ ] **Step: 테스트 실행해 통과 확인 (토대 검증)**
  ```bash
  npx --prefix /Users/kyungsbook/Desktop/playlist vitest run src/lib/__sanity__.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: `Test Files  1 passed (1)` / `Tests  1 passed (1)`. (만약 vitest 실행이 안 되면 토대 세팅이 잘못된 것 — 통과해야 다음 태스크 진행)

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.setup.ts .gitignore index.html tailwind.config.js postcss.config.js src/index.css src/lib/__sanity__.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "chore: scaffold vite react ts tailwind vitest toolchain"
  ```

---

### Task 1: src/types.ts — 도메인 타입 정의

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/types.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/types.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces (계약 글자 그대로):
  - `export type RepeatMode = 'off' | 'all' | 'one';`
  - `export type LyricsType = 'synced' | 'plain' | 'none';`
  - `export interface LyricLine { time: number; text: string; }`
  - `export interface SongColors { gradientFrom: string; gradientTo: string; accent: string; }`
  - `export interface SongLyrics { type: LyricsType; synced?: LyricLine[]; plain?: string; source: 'lrclib'|'manual'|'none'; offsetMs: number; }`
  - `export interface Song { id: string; title: string; artist: string; durationSec: number; cover: string; colors: SongColors; lyrics: SongLyrics; resolvedAt: string; }`
  - `export interface Playlist { id: string; title: string; message?: string; coverVideoId?: string; songIds: string[]; createdAt: string; }`
  - `export interface SharedPlaylist { title: string; message?: string; songs: { id: string; title?: string }[]; }`

> 타입만 export 하는 파일은 런타임 동작이 없어 일반적으로 테스트가 불필요하다. 다만 "타입이 실제로 export 되어 import 가능하고 컴파일된다"는 점을 타입수준 어서션으로 1개 테스트해 회귀를 막는다(계약 시그니처가 깨지면 `tsc`/vitest transform에서 실패).

스텝:

- [ ] **Step: 실패하는 테스트 작성 (타입 존재/형태 어서션)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/types.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import type {
    RepeatMode,
    LyricsType,
    LyricLine,
    SongColors,
    SongLyrics,
    Song,
    Playlist,
    SharedPlaylist,
  } from './types';

  describe('domain types', () => {
    it('allows constructing each shape per contract', () => {
      const repeat: RepeatMode[] = ['off', 'all', 'one'];
      const ltype: LyricsType[] = ['synced', 'plain', 'none'];

      const line: LyricLine = { time: 12.5, text: 'hello' };
      const colors: SongColors = {
        gradientFrom: '#111133',
        gradientTo: '#000022',
        accent: '#88aaff',
      };
      const lyrics: SongLyrics = {
        type: 'synced',
        synced: [line],
        source: 'lrclib',
        offsetMs: 0,
      };
      const song: Song = {
        id: 'dQw4w9WgXcQ',
        title: 'Title',
        artist: 'Artist',
        durationSec: 213,
        cover: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        colors,
        lyrics,
        resolvedAt: '2026-06-20T00:00:00.000Z',
      };
      const playlist: Playlist = {
        id: 'my-list-ab12',
        title: 'My List',
        message: 'for you',
        coverVideoId: 'dQw4w9WgXcQ',
        songIds: ['dQw4w9WgXcQ'],
        createdAt: '2026-06-20T00:00:00.000Z',
      };
      const shared: SharedPlaylist = {
        title: 'Shared',
        songs: [{ id: 'dQw4w9WgXcQ', title: 'Title' }, { id: 'abc12345678' }],
      };

      expect(repeat).toHaveLength(3);
      expect(ltype).toHaveLength(3);
      expect(line.time).toBe(12.5);
      expect(colors.accent).toBe('#88aaff');
      expect(lyrics.offsetMs).toBe(0);
      expect(song.durationSec).toBe(213);
      expect(playlist.songIds).toContain('dQw4w9WgXcQ');
      expect(shared.songs).toHaveLength(2);
    });
  });
  ```

- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/types.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `Failed to resolve import "./types"` 또는 `Cannot find module './types'` (파일 미생성).

- [ ] **Step: 최소 구현 (계약 시그니처 그대로)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/types.ts`:
  ```ts
  export type RepeatMode = 'off' | 'all' | 'one';
  export type LyricsType = 'synced' | 'plain' | 'none';

  export interface LyricLine {
    time: number; // time = 초(float)
    text: string;
  }

  export interface SongColors {
    gradientFrom: string;
    gradientTo: string;
    accent: string;
  }

  export interface SongLyrics {
    type: LyricsType;
    synced?: LyricLine[];
    plain?: string;
    source: 'lrclib' | 'manual' | 'none';
    offsetMs: number;
  }

  export interface Song {
    id: string;
    title: string;
    artist: string;
    durationSec: number;
    cover: string;
    colors: SongColors;
    lyrics: SongLyrics;
    resolvedAt: string;
  }

  export interface Playlist {
    id: string;
    title: string;
    message?: string;
    coverVideoId?: string;
    songIds: string[];
    createdAt: string;
  }

  export interface SharedPlaylist {
    title: string;
    message?: string;
    songs: { id: string; title?: string }[];
  }
  ```

- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/types.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: `Test Files  1 passed (1)` / `Tests  1 passed (1)`.

- [ ] **Step: 타입체크로 시그니처 회귀 가드**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist run typecheck
  ```
  예상: 출력 없이 종료코드 0(에러 없음).

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/types.ts src/types.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: add domain types per locked interface contract"
  ```

---

### Task 2: src/lib/youtube.ts — parseVideoId

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: `export function parseVideoId(input: string): string | null;` (watch?v=, youtu.be/, embed/, shorts/, raw 11자 ID 처리. 실패 시 null)

> YouTube videoId는 정확히 11자, 문자셋 `[A-Za-z0-9_-]`. 이 두 규칙을 검증의 단일 기준으로 삼는다.

스텝:

- [ ] **Step: 실패하는 테스트 작성 (모든 URL 형태 + raw id + 잘못된 입력)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { parseVideoId } from './youtube';

  describe('parseVideoId', () => {
    const ID = 'dQw4w9WgXcQ'; // valid 11-char id

    it('parses standard watch URLs', () => {
      expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
      expect(parseVideoId(`http://youtube.com/watch?v=${ID}`)).toBe(ID);
      expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    });

    it('parses watch URLs with extra query params in any order', () => {
      expect(parseVideoId(`https://www.youtube.com/watch?list=PL123&v=${ID}&t=10s`)).toBe(ID);
      expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}&feature=share`)).toBe(ID);
    });

    it('parses youtu.be short links', () => {
      expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID);
      expect(parseVideoId(`https://youtu.be/${ID}?t=42`)).toBe(ID);
    });

    it('parses embed URLs', () => {
      expect(parseVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
      expect(parseVideoId(`https://www.youtube.com/embed/${ID}?rel=0`)).toBe(ID);
    });

    it('parses shorts URLs', () => {
      expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
      expect(parseVideoId(`https://youtube.com/shorts/${ID}?feature=share`)).toBe(ID);
    });

    it('accepts a raw 11-char id', () => {
      expect(parseVideoId(ID)).toBe(ID);
      expect(parseVideoId('_-aBcDeF120')).toBe('_-aBcDeF120');
    });

    it('trims surrounding whitespace', () => {
      expect(parseVideoId(`  https://youtu.be/${ID}  `)).toBe(ID);
      expect(parseVideoId(`\n${ID}\n`)).toBe(ID);
    });

    it('returns null for invalid or unrelated input', () => {
      expect(parseVideoId('')).toBeNull();
      expect(parseVideoId('not a url')).toBeNull();
      expect(parseVideoId('https://vimeo.com/123456')).toBeNull();
      expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull(); // too short
      expect(parseVideoId('https://www.youtube.com/watch?v=waytoolongid12345')).toBeNull();
      expect(parseVideoId('abcdefghij')).toBeNull(); // 10 chars
      expect(parseVideoId('abcdefghij!!')).toBeNull(); // invalid chars
    });
  });
  ```

- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `Failed to resolve import "./youtube"` (파일 미생성).

- [ ] **Step: 최소 구현 (parseVideoId만)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts`:
  ```ts
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function isValidId(id: string | null | undefined): id is string {
    return !!id && ID_RE.test(id);
  }

  export function parseVideoId(input: string): string | null {
    if (typeof input !== 'string') return null;
    const raw = input.trim();
    if (!raw) return null;

    // raw 11-char id
    if (isValidId(raw)) return raw;

    // try URL parsing
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }

    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return isValidId(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      // watch?v=<id>
      const v = url.searchParams.get('v');
      if (isValidId(v)) return v;

      // /embed/<id> or /shorts/<id>
      const segs = url.pathname.split('/').filter(Boolean);
      if ((segs[0] === 'embed' || segs[0] === 'shorts') && isValidId(segs[1])) {
        return segs[1];
      }
    }

    return null;
  }
  ```

- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: `Tests  8 passed (8)` (describe 내 it 전부 통과).

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/lib/youtube.ts src/lib/youtube.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: parse youtube video id from all url forms and raw id"
  ```

---

### Task 3: src/lib/youtube.ts — thumbnailUrl + THUMB_FALLBACK + ThumbQuality

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts`
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces (계약 글자 그대로):
  - `export type ThumbQuality = 'maxresdefault'|'sddefault'|'hqdefault'|'mqdefault';`
  - `export const THUMB_FALLBACK: readonly ThumbQuality[];` (= `['maxresdefault','sddefault','hqdefault','mqdefault']`)
  - `export function thumbnailUrl(videoId: string, quality?: ThumbQuality): string;` (= `https://i.ytimg.com/vi/{id}/{quality}.jpg`, 기본 maxresdefault)

스텝:

- [ ] **Step: 실패하는 테스트 작성 (썸네일 URL + 폴백 순서)**
  `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts` 상단 import에 `thumbnailUrl, THUMB_FALLBACK` 추가하고 새 describe 블록 추가:
  ```ts
  // 기존 import 라인을 아래로 교체:
  // import { parseVideoId } from './youtube';
  import { parseVideoId, thumbnailUrl, THUMB_FALLBACK } from './youtube';

  // 파일 끝에 추가:
  describe('thumbnailUrl', () => {
    const ID = 'dQw4w9WgXcQ';

    it('defaults to maxresdefault', () => {
      expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`);
    });

    it('builds url for each explicit quality', () => {
      expect(thumbnailUrl(ID, 'sddefault')).toBe(`https://i.ytimg.com/vi/${ID}/sddefault.jpg`);
      expect(thumbnailUrl(ID, 'hqdefault')).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
      expect(thumbnailUrl(ID, 'mqdefault')).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
    });
  });

  describe('THUMB_FALLBACK', () => {
    it('lists qualities best-first', () => {
      expect(THUMB_FALLBACK).toEqual(['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']);
    });

    it('every entry produces a valid url', () => {
      const ID = 'dQw4w9WgXcQ';
      for (const q of THUMB_FALLBACK) {
        expect(thumbnailUrl(ID, q)).toBe(`https://i.ytimg.com/vi/${ID}/${q}.jpg`);
      }
    });
  });
  ```

- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `thumbnailUrl is not a function` / `THUMB_FALLBACK is not defined`(아직 export 안 됨) 또는 import 에러.

- [ ] **Step: 최소 구현 (youtube.ts에 추가)**
  `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts` 파일 끝에 추가:
  ```ts
  export type ThumbQuality = 'maxresdefault' | 'sddefault' | 'hqdefault' | 'mqdefault';

  export const THUMB_FALLBACK: readonly ThumbQuality[] = [
    'maxresdefault',
    'sddefault',
    'hqdefault',
    'mqdefault',
  ] as const;

  export function thumbnailUrl(videoId: string, quality: ThumbQuality = 'maxresdefault'): string {
    return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
  }
  ```

- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: 모든 describe 통과(parseVideoId + thumbnailUrl + THUMB_FALLBACK), `Tests  12 passed (12)`.

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/lib/youtube.ts src/lib/youtube.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: add thumbnailUrl and THUMB_FALLBACK chain"
  ```

---

### Task 4: src/lib/youtube.ts — parseTitleHeuristic + ParsedTitle

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts`
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces (계약 글자 그대로):
  - `export interface ParsedTitle { artist: string; title: string; }`
  - `export function parseTitleHeuristic(rawTitle: string, author: string): ParsedTitle;` ("Artist - Title (Official ...)" 분리, 실패 시 artist=author, title=정제된 rawTitle)

> 휴리스틱 규칙(테스트로 고정):
> 1. 먼저 노이즈 토큰 제거: 괄호/대괄호 안의 `Official Video`, `Official Music Video`, `MV`, `Lyrics`, `Audio`, `Visualizer`, `HD/4K`, `Color Coded` 등 흔한 마커. 끝의 `[MV]`/`(M/V)` 류 포함.
> 2. 정제된 제목에 ` - `(공백-하이픈-공백, en/em dash 포함)가 있으면 첫 분리 지점 기준 좌=artist, 우=title.
> 3. 분리 실패 시 artist = author(채널명), title = 정제된 rawTitle.
> 4. 양쪽 모두 trim, 빈 문자열 방지(분리 후 한쪽이 비면 폴백).

스텝:

- [ ] **Step: 실패하는 테스트 작성 (분리 / 노이즈 제거 / author 폴백)**
  `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.test.ts` import 라인을 교체하고 새 describe 추가:
  ```ts
  // import 라인을 아래로 교체:
  import {
    parseVideoId,
    thumbnailUrl,
    THUMB_FALLBACK,
    parseTitleHeuristic,
  } from './youtube';

  // 파일 끝에 추가:
  describe('parseTitleHeuristic', () => {
    it('splits "Artist - Title" on " - "', () => {
      expect(parseTitleHeuristic('IU - Blueming', 'IU Official')).toEqual({
        artist: 'IU',
        title: 'Blueming',
      });
    });

    it('strips (Official Video) and similar markers', () => {
      expect(parseTitleHeuristic('NewJeans - Ditto (Official Music Video)', 'HYBE LABELS')).toEqual({
        artist: 'NewJeans',
        title: 'Ditto',
      });
      expect(parseTitleHeuristic('aespa - Spicy (Official MV)', 'SMTOWN')).toEqual({
        artist: 'aespa',
        title: 'Spicy',
      });
    });

    it('strips bracketed markers like [MV], [Lyrics], [4K]', () => {
      expect(parseTitleHeuristic('BTS - Dynamite [MV]', 'HYBE LABELS')).toEqual({
        artist: 'BTS',
        title: 'Dynamite',
      });
      expect(parseTitleHeuristic('Adele - Hello [Official Audio]', 'AdeleVEVO')).toEqual({
        artist: 'Adele',
        title: 'Hello',
      });
    });

    it('uses only the first " - " as the split point', () => {
      expect(parseTitleHeuristic('A - B - C', 'Chan')).toEqual({
        artist: 'A',
        title: 'B - C',
      });
    });

    it('handles en-dash / em-dash separators', () => {
      expect(parseTitleHeuristic('Artist – Title', 'Chan')).toEqual({
        artist: 'Artist',
        title: 'Title',
      });
      expect(parseTitleHeuristic('Artist — Title', 'Chan')).toEqual({
        artist: 'Artist',
        title: 'Title',
      });
    });

    it('falls back to author when there is no separator', () => {
      expect(parseTitleHeuristic('Blueming (Official Video)', 'IU Official')).toEqual({
        artist: 'IU Official',
        title: 'Blueming',
      });
    });

    it('falls back to author when split would leave an empty side', () => {
      expect(parseTitleHeuristic(' - Title', 'Chan')).toEqual({
        artist: 'Chan',
        title: 'Title',
      });
      expect(parseTitleHeuristic('Artist - ', 'Chan')).toEqual({
        artist: 'Chan',
        title: 'Artist',
      });
    });

    it('trims whitespace on both sides', () => {
      expect(parseTitleHeuristic('  IU   -   Blueming  ', 'IU Official')).toEqual({
        artist: 'IU',
        title: 'Blueming',
      });
    });

    it('keeps a clean raw title when no markers and no separator', () => {
      expect(parseTitleHeuristic('Just A Song', 'Some Channel')).toEqual({
        artist: 'Some Channel',
        title: 'Just A Song',
      });
    });
  });
  ```

- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `parseTitleHeuristic is not a function` 또는 import 에러.

- [ ] **Step: 최소 구현 (youtube.ts에 추가)**
  `/Users/kyungsbook/Desktop/playlist/src/lib/youtube.ts` 파일 끝에 추가:
  ```ts
  export interface ParsedTitle {
    artist: string;
    title: string;
  }

  // 흔한 노이즈 마커(괄호/대괄호 안). 대소문자 무시.
  const NOISE_MARKERS = [
    'official\\s*music\\s*video',
    'official\\s*video',
    'official\\s*audio',
    'official\\s*lyric[s]?\\s*video',
    'official\\s*mv',
    'lyric[s]?\\s*video',
    'lyric[s]?',
    'audio',
    'visualizer',
    'm/?v',
    'mv',
    'color\\s*coded',
    'performance\\s*video',
    'live',
    '4k',
    'hd',
    'hq',
  ];

  // (...) 또는 [...] 안에 노이즈 마커가 들어있으면 통째로 제거
  const NOISE_GROUP_RE = new RegExp(
    `[\\(\\[]\\s*(?:${NOISE_MARKERS.join('|')})\\s*[\\)\\]]`,
    'gi',
  );

  function stripNoise(s: string): string {
    return s.replace(NOISE_GROUP_RE, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // 공백-구분자-공백 (hyphen, en-dash, em-dash) 첫 등장
  const SEP_RE = /\s[-–—]\s/;

  export function parseTitleHeuristic(rawTitle: string, author: string): ParsedTitle {
    const cleaned = stripNoise(rawTitle ?? '');
    const fallback: ParsedTitle = {
      artist: (author ?? '').trim() || 'Unknown',
      title: cleaned || (rawTitle ?? '').trim() || 'Untitled',
    };

    const m = SEP_RE.exec(cleaned);
    if (!m) return fallback;

    const idx = m.index;
    const left = cleaned.slice(0, idx).trim();
    const right = cleaned.slice(idx + m[0].length).trim();

    if (!left || !right) return fallback;

    return { artist: left, title: right };
  }
  ```

- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/lib/youtube.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: 전체 youtube describe 통과(parseVideoId/thumbnailUrl/THUMB_FALLBACK/parseTitleHeuristic), `Tests` 카운트 증가 후 all passed.

- [ ] **Step: 타입체크**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist run typecheck
  ```
  예상: 종료코드 0, 에러 없음.

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/lib/youtube.ts src/lib/youtube.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: parse artist/title heuristic with noise stripping and author fallback"
  ```

---

### Task 5: src/lib/queue.ts — nextIndex + prevIndex (세 repeat 모드 + 경계)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/queue.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/queue.test.ts`

**Interfaces:**
- Consumes: `import type { RepeatMode } from '../types';` (Task 1 산출물).
- Produces (계약 글자 그대로):
  - `export function nextIndex(current: number, length: number, repeat: RepeatMode): number | null;` (one→current, all→(current+1)%length, off→ current+1<length ? current+1 : null)
  - `export function prevIndex(current: number, length: number, repeat: RepeatMode): number;` (all→(current-1+length)%length, 그 외→max(0,current-1))

> 참고: 계약상 `nextIndex`의 'one' 모드는 같은 인덱스를 반환(=같은 곡 재생). `off`는 마지막 곡이면 `null`(정지). `length`가 0이면 재생할 곡이 없으므로 `nextIndex`는 `null`, `prevIndex`는 0을 반환(안전 가드).

스텝:

- [ ] **Step: 실패하는 테스트 작성 (nextIndex/prevIndex 전 모드 + 경계)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/lib/queue.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { nextIndex, prevIndex } from './queue';

  describe('nextIndex', () => {
    describe("repeat 'one'", () => {
      it('returns the same index (replay same song)', () => {
        expect(nextIndex(0, 3, 'one')).toBe(0);
        expect(nextIndex(2, 3, 'one')).toBe(2);
        expect(nextIndex(0, 1, 'one')).toBe(0);
      });
    });

    describe("repeat 'all'", () => {
      it('advances and wraps around to first after last', () => {
        expect(nextIndex(0, 3, 'all')).toBe(1);
        expect(nextIndex(1, 3, 'all')).toBe(2);
        expect(nextIndex(2, 3, 'all')).toBe(0); // wrap
      });
      it('stays on 0 when length is 1', () => {
        expect(nextIndex(0, 1, 'all')).toBe(0);
      });
    });

    describe("repeat 'off'", () => {
      it('advances while not at the last song', () => {
        expect(nextIndex(0, 3, 'off')).toBe(1);
        expect(nextIndex(1, 3, 'off')).toBe(2);
      });
      it('returns null at the last song (stop)', () => {
        expect(nextIndex(2, 3, 'off')).toBeNull();
        expect(nextIndex(0, 1, 'off')).toBeNull();
      });
    });

    it('returns null for empty queue regardless of mode', () => {
      expect(nextIndex(0, 0, 'off')).toBeNull();
      expect(nextIndex(0, 0, 'all')).toBeNull();
      expect(nextIndex(0, 0, 'one')).toBeNull();
    });
  });

  describe('prevIndex', () => {
    describe("repeat 'all'", () => {
      it('goes back and wraps to last from first', () => {
        expect(prevIndex(2, 3, 'all')).toBe(1);
        expect(prevIndex(1, 3, 'all')).toBe(0);
        expect(prevIndex(0, 3, 'all')).toBe(2); // wrap to last
      });
      it('stays on 0 when length is 1', () => {
        expect(prevIndex(0, 1, 'all')).toBe(0);
      });
    });

    describe("repeat 'off' / 'one'", () => {
      it('decrements but clamps at 0', () => {
        expect(prevIndex(2, 3, 'off')).toBe(1);
        expect(prevIndex(1, 3, 'off')).toBe(0);
        expect(prevIndex(0, 3, 'off')).toBe(0); // clamp
        expect(prevIndex(0, 3, 'one')).toBe(0); // clamp
        expect(prevIndex(2, 3, 'one')).toBe(1);
      });
    });

    it('returns 0 for empty queue', () => {
      expect(prevIndex(0, 0, 'all')).toBe(0);
      expect(prevIndex(0, 0, 'off')).toBe(0);
    });
  });
  ```

- [ ] **Step: 테스트 실행해 실패 확인**
  ```bash
  npx vitest run src/lib/queue.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상 실패: `Failed to resolve import "./queue"` (파일 미생성).

- [ ] **Step: 최소 구현 (queue.ts)**
  파일 `/Users/kyungsbook/Desktop/playlist/src/lib/queue.ts`:
  ```ts
  import type { RepeatMode } from '../types';

  export function nextIndex(
    current: number,
    length: number,
    repeat: RepeatMode,
  ): number | null {
    if (length <= 0) return null;
    switch (repeat) {
      case 'one':
        return current;
      case 'all':
        return (current + 1) % length;
      case 'off':
      default:
        return current + 1 < length ? current + 1 : null;
    }
  }

  export function prevIndex(
    current: number,
    length: number,
    repeat: RepeatMode,
  ): number {
    if (length <= 0) return 0;
    if (repeat === 'all') {
      return (current - 1 + length) % length;
    }
    return Math.max(0, current - 1);
  }
  ```

- [ ] **Step: 테스트 실행해 통과 확인**
  ```bash
  npx vitest run src/lib/queue.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: 모든 describe 통과, `Tests` all passed (nextIndex/prevIndex 전 케이스).

- [ ] **Step: 타입체크**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist run typecheck
  ```
  예상: 종료코드 0, 에러 없음.

- [ ] **Step: 커밋**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add src/lib/queue.ts src/lib/queue.test.ts
  git -C /Users/kyungsbook/Desktop/playlist commit -m "feat: add queue nextIndex/prevIndex for all repeat modes and edges"
  ```

---

### Task 6: 그룹 전체 테스트 + 빌드 그린 확인 (통합 가드)

**Files:**
- Modify(검증만): 위 태스크들이 만든 파일들. 새 파일 없음.

**Interfaces:**
- Consumes: 위 모든 산출물.
- Produces: 그룹 B 전체가 한 번에 그린(테스트+타입체크+빌드)이라는 보증.

> 다른 모듈 그룹과 합치기 전, 이 그룹 단독으로 모든 테스트/타입체크가 통과하고 프로덕션 빌드가 성공함을 확인한다. (`src/main.tsx`/`src/App.tsx`는 다른 그룹 소관이라 이 시점에 없을 수 있다. 빌드가 진입점 부재로 실패하면 그것은 다른 그룹 책임이므로, 이 태스크에서는 **테스트 전체 통과 + typecheck 통과**를 필수 게이트로 삼고, `vite build`는 진입점이 존재할 때만 수행한다.)

스텝:

- [ ] **Step: 그룹 B 전체 테스트 실행**
  ```bash
  npx vitest run src/types.test.ts src/lib/youtube.test.ts src/lib/queue.test.ts --root /Users/kyungsbook/Desktop/playlist
  ```
  예상: `Test Files  3 passed (3)`, 모든 테스트 통과.

- [ ] **Step: 타입체크 통과 확인**
  ```bash
  npm --prefix /Users/kyungsbook/Desktop/playlist run typecheck
  ```
  예상: 종료코드 0, 에러 없음.

- [ ] **Step: 진입점 존재 시 프로덕션 빌드 (조건부)**
  ```bash
  test -f /Users/kyungsbook/Desktop/playlist/src/main.tsx && npm --prefix /Users/kyungsbook/Desktop/playlist run build || echo "skip build: src/main.tsx not present yet (owned by another module group)"
  ```
  예상: 진입점이 있으면 `built in ...` 출력, 없으면 skip 메시지. (이 게이트는 실패시켜서는 안 됨 — 진입점은 다른 그룹 책임)

- [ ] **Step: 커밋 (검증 통과 표식, 변경 없으면 생략 가능)**
  ```bash
  git -C /Users/kyungsbook/Desktop/playlist add -A && git -C /Users/kyungsbook/Desktop/playlist commit -m "test: verify module group B (types/youtube/queue) green" --allow-empty
  ```

---


<!-- ===== MODULE C-lrc-time ===== -->

## Module C: src/lib/lrc.ts + src/lib/time.ts (LRC 파싱 / 시간 보간)

이 모듈은 순수함수만 담당하므로 100% Vitest 단위 TDD로 작성한다. 브라우저/IFrame/canvas 의존 없음.

> 조립 메모: 이 모듈은 `import type { LyricLine } from '../types'`에 의존한다. 만약 조립 시점에 `src/types.ts`가 아직 없으면 **Task C0**으로 최소 타입을 먼저 만든다. 이미 존재하면 **Task C0는 건너뛰고 절대 덮어쓰지 않는다.**

---

### Task C0: (조건부) types.ts에 LyricLine 타입 보장

> `src/types.ts`가 이미 존재하면 이 태스크 전체를 건너뛴다. 아래 검증 명령으로 먼저 확인한다.

**Files:**
- Create (없을 때만): `/Users/kyungsbook/Desktop/playlist/src/types.ts`
- Test: 없음 (타입 전용, 컴파일로 검증)

**Interfaces:**
- Consumes: 없음
- Produces: `src/types.ts: export interface LyricLine { time: number; text: string }` (그 외 계약상 타입들은 모듈 A가 추가; 여기선 충돌 없이 존재만 보장)

- [ ] **Step: 존재 여부 확인**
  - 명령: `test -f /Users/kyungsbook/Desktop/playlist/src/types.ts && echo EXISTS || echo MISSING`
  - `EXISTS`면 이 태스크 종료(건너뜀). `MISSING`이면 다음 스텝 진행.
- [ ] **Step: 최소 types.ts 생성** (MISSING일 때만)
  - 파일 `/Users/kyungsbook/Desktop/playlist/src/types.ts` 생성. 계약 전체 타입을 그대로 넣어 후속 모듈과 충돌을 피한다.
  ```ts
  export type RepeatMode = 'off' | 'all' | 'one';
  export type LyricsType = 'synced' | 'plain' | 'none';
  export interface LyricLine { time: number; text: string; } // time = 초(float)
  export interface SongColors { gradientFrom: string; gradientTo: string; accent: string; } // hex
  export interface SongLyrics { type: LyricsType; synced?: LyricLine[]; plain?: string; source: 'lrclib' | 'manual' | 'none'; offsetMs: number; }
  export interface Song { id: string; title: string; artist: string; durationSec: number; cover: string; colors: SongColors; lyrics: SongLyrics; resolvedAt: string; }
  export interface Playlist { id: string; title: string; message?: string; coverVideoId?: string; songIds: string[]; createdAt: string; }
  export interface SharedPlaylist { title: string; message?: string; songs: { id: string; title?: string }[]; }
  ```
- [ ] **Step: 타입 컴파일 확인**
  - 명령: `npx tsc --noEmit -p /Users/kyungsbook/Desktop/playlist/tsconfig.json` (tsconfig가 아직 없으면 이 검증은 모듈 A 합류 후로 미루고, 최소한 `npx tsc --noEmit /Users/kyungsbook/Desktop/playlist/src/types.ts` 로 단독 검증)
  - 예상: 에러 없이 통과.
- [ ] **Step: 커밋** (생성한 경우에만)
  - `git add /Users/kyungsbook/Desktop/playlist/src/types.ts && git commit -m "chore: add core domain types (LyricLine et al.)"`

---

### Task C1: time.ts — estimateTime 시간 보간

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/time.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/time.test.ts`

**Interfaces:**
- Consumes: 없음 (자체 완결, 외부 의존 없음)
- Produces:
  - `export interface TimeSample { time: number; at: number; }` // at = performance.now() ms 시각
  - `export function estimateTime(sample: TimeSample, now: number, playing: boolean): number` // playing이면 sample.time + (now-sample.at)/1000, 아니면 sample.time

- [ ] **Step: 실패하는 테스트 작성**
  - 파일 `/Users/kyungsbook/Desktop/playlist/src/lib/time.test.ts` 작성:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { estimateTime, type TimeSample } from './time';

  describe('estimateTime', () => {
    it('playing=false면 sample.time을 그대로 반환(보간 없음)', () => {
      const sample: TimeSample = { time: 12.5, at: 1000 };
      expect(estimateTime(sample, 5000, false)).toBe(12.5);
    });

    it('playing=true면 경과(ms)/1000 만큼 선형 보간해서 더한다', () => {
      const sample: TimeSample = { time: 10, at: 1000 };
      // now-at = 2000ms = 2초 경과 → 10 + 2 = 12
      expect(estimateTime(sample, 3000, true)).toBeCloseTo(12, 5);
    });

    it('playing=true, 경과 0이면 sample.time과 같다', () => {
      const sample: TimeSample = { time: 7.25, at: 4200 };
      expect(estimateTime(sample, 4200, true)).toBeCloseTo(7.25, 5);
    });

    it('밀리초 단위 경과도 초로 환산한다', () => {
      const sample: TimeSample = { time: 0, at: 0 };
      // 250ms 경과 → 0.25초
      expect(estimateTime(sample, 250, true)).toBeCloseTo(0.25, 5);
    });

    it('now가 at보다 작으면(역행) 음수 경과를 그대로 더한다(클램프 안 함)', () => {
      const sample: TimeSample = { time: 5, at: 2000 };
      // now-at = -1000ms = -1초 → 5 + (-1) = 4
      expect(estimateTime(sample, 1000, true)).toBeCloseTo(4, 5);
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/time.test.ts`
  - 예상 실패: `Failed to resolve import "./time"` 또는 `Cannot find module './time'` (구현 파일이 아직 없음).
- [ ] **Step: 최소 구현**
  - 파일 `/Users/kyungsbook/Desktop/playlist/src/lib/time.ts` 작성:
  ```ts
  export interface TimeSample {
    time: number; // 마지막으로 측정한 재생 위치(초)
    at: number;   // 측정 시점의 performance.now() (ms)
  }

  /**
   * 마지막 샘플과 현재 시각(now, performance.now() ms)으로 현재 재생 위치를 선형 보간한다.
   * - playing=true: sample.time + (now - sample.at) / 1000
   * - playing=false: sample.time (정지 중에는 보간하지 않음)
   */
  export function estimateTime(sample: TimeSample, now: number, playing: boolean): number {
    if (!playing) return sample.time;
    return sample.time + (now - sample.at) / 1000;
  }
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/time.test.ts`
  - 예상: 5개 테스트 모두 PASS (`Test Files 1 passed`, `Tests 5 passed`).
- [ ] **Step: 커밋**
  - `git add /Users/kyungsbook/Desktop/playlist/src/lib/time.ts /Users/kyungsbook/Desktop/playlist/src/lib/time.test.ts && git commit -m "feat: add estimateTime for lyric-sync interpolation"`

---

### Task C2: lrc.ts — findActiveIndex 이진탐색 (의존 없는 부분 먼저)

가사 싱크의 핵심 조회 함수. `parseLrc`보다 의존이 작아 먼저 구현한다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts`

**Interfaces:**
- Consumes: `src/types.ts: import type { LyricLine } from '../types'`
- Produces: `export function findActiveIndex(lines: LyricLine[], t: number): number` // time<=t 인 마지막 인덱스, 이진탐색, 첫 줄 이전이면 -1

- [ ] **Step: 실패하는 테스트 작성**
  - 파일 `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts` 작성(findActiveIndex 부분만; parseLrc 테스트는 C3에서 같은 파일에 추가):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { findActiveIndex } from './lrc';
  import type { LyricLine } from '../types';

  describe('findActiveIndex', () => {
    const lines: LyricLine[] = [
      { time: 0, text: 'a' },
      { time: 5, text: 'b' },
      { time: 10, text: 'c' },
      { time: 15, text: 'd' },
    ];

    it('빈 배열이면 -1', () => {
      expect(findActiveIndex([], 3)).toBe(-1);
    });

    it('첫 줄 시각보다 이전이면 -1', () => {
      expect(findActiveIndex(lines, -0.5)).toBe(-1);
    });

    it('정확히 첫 줄 시각이면 0', () => {
      expect(findActiveIndex(lines, 0)).toBe(0);
    });

    it('두 타임태그 사이(중간 시각)면 더 작은 쪽 인덱스', () => {
      expect(findActiveIndex(lines, 7.3)).toBe(1); // 5 <= 7.3 < 10
    });

    it('정확히 타임태그와 일치하면 그 인덱스', () => {
      expect(findActiveIndex(lines, 10)).toBe(2);
    });

    it('마지막 줄 시각 이후면 마지막 인덱스', () => {
      expect(findActiveIndex(lines, 999)).toBe(3);
    });

    it('마지막 줄 시각과 정확히 일치하면 마지막 인덱스', () => {
      expect(findActiveIndex(lines, 15)).toBe(3);
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상 실패: `Failed to resolve import "./lrc"` / `Cannot find module './lrc'` (lrc.ts 미존재).
- [ ] **Step: 최소 구현**
  - 파일 `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts` 작성(이번 태스크에선 findActiveIndex와 그 import만; parseLrc는 C3에서 추가):
  ```ts
  import type { LyricLine } from '../types';

  /**
   * time 오름차순으로 정렬된 lines에서 time <= t 를 만족하는 마지막 인덱스를 이진탐색으로 찾는다.
   * 어떤 줄도 시작하지 않았으면(t가 첫 줄보다 작으면) -1.
   */
  export function findActiveIndex(lines: LyricLine[], t: number): number {
    let lo = 0;
    let hi = lines.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= t) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상: 7개 테스트 PASS (`Tests 7 passed`).
- [ ] **Step: 커밋**
  - `git add /Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts /Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts && git commit -m "feat: add findActiveIndex binary search for lyric lookup"`

---

### Task C3: lrc.ts — parseLrc 기본 파싱 ([mm:ss.xx] → 초, 정렬, 빈 줄 ♪)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts` (기존 파일에 describe 블록 추가)

**Interfaces:**
- Consumes: `src/types.ts: import type { LyricLine } from '../types'`
- Produces:
  - `export interface ParsedLrc { lines: LyricLine[]; offsetMs: number; }`
  - `export function parseLrc(raw: string): ParsedLrc` // [mm:ss.xx] 파싱, time 오름차순 정렬, 빈 텍스트는 '♪'

- [ ] **Step: 실패하는 테스트 작성**
  - 기존 `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts` 상단 import에 `parseLrc`를 추가하고, 파일 끝에 describe 블록을 추가한다.
  - import 라인 교체:
  ```ts
  import { findActiveIndex, parseLrc } from './lrc';
  ```
  - 파일 끝에 추가:
  ```ts
  describe('parseLrc — 기본 파싱', () => {
    it('[mm:ss.xx] 타임태그를 초(float)로 변환한다', () => {
      const raw = '[00:12.50]hello';
      const { lines } = parseLrc(raw);
      expect(lines).toHaveLength(1);
      expect(lines[0].time).toBeCloseTo(12.5, 5);
      expect(lines[0].text).toBe('hello');
    });

    it('분과 초를 합산한다 [01:05.00] = 65초', () => {
      const { lines } = parseLrc('[01:05.00]minute line');
      expect(lines[0].time).toBeCloseTo(65, 5);
    });

    it('밀리초 3자리 [00:01.234] 도 환산한다', () => {
      const { lines } = parseLrc('[00:01.234]ms');
      expect(lines[0].time).toBeCloseTo(1.234, 5);
    });

    it('소수부 없는 [00:30] 도 허용한다', () => {
      const { lines } = parseLrc('[00:30]no decimals');
      expect(lines[0].time).toBeCloseTo(30, 5);
    });

    it('여러 줄을 time 오름차순으로 정렬한다(입력이 뒤섞여도)', () => {
      const raw = ['[00:10.00]second', '[00:02.00]first', '[00:20.00]third'].join('\n');
      const { lines } = parseLrc(raw);
      expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third']);
      expect(lines.map((l) => l.time)).toEqual([2, 10, 20]);
    });

    it('빈 텍스트(공백만)는 ♪ 로 치환한다', () => {
      const { lines } = parseLrc('[00:05.00]   ');
      expect(lines[0].text).toBe('♪');
    });

    it('타임태그 없는 줄과 빈 raw는 무시한다(라인 0개)', () => {
      expect(parseLrc('').lines).toEqual([]);
      expect(parseLrc('just text without tags').lines).toEqual([]);
    });

    it('offset 메타태그가 없으면 offsetMs=0', () => {
      expect(parseLrc('[00:01.00]x').offsetMs).toBe(0);
    });

    it('실제 LRC 샘플(여러 줄, 메타 혼재)을 정상 파싱한다', () => {
      const raw = [
        '[ar:Some Artist]',
        '[ti:Some Title]',
        '[al:Some Album]',
        '[length:03:21]',
        '',
        '[00:00.00]First line',
        '[00:04.20]Second line',
        '[00:09.80]Third line',
      ].join('\n');
      const { lines } = parseLrc(raw);
      expect(lines.map((l) => l.text)).toEqual(['First line', 'Second line', 'Third line']);
      expect(lines[1].time).toBeCloseTo(4.2, 5);
      expect(lines[2].time).toBeCloseTo(9.8, 5);
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상 실패: `parseLrc is not a function` 또는 import에서 `"parseLrc" is not exported by ... lrc.ts` (아직 미구현).
- [ ] **Step: 최소 구현**
  - `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts` 상단에 `ParsedLrc` 인터페이스, 내부 헬퍼, `parseLrc`를 추가한다. (findActiveIndex는 그대로 유지) 멀티 타임태그/offset은 C4에서 강화하지만, 이번 구현부터 멀티 타임태그·offset 골격을 포함해 두면 회귀가 없다. 파일 전체를 아래로 교체한다:
  ```ts
  import type { LyricLine } from '../types';

  export interface ParsedLrc {
    lines: LyricLine[];
    offsetMs: number;
  }

  // 한 줄 안의 모든 [mm:ss.xx] 타임태그를 전역으로 매칭
  const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  // [offset:+250] / [offset:-120] 메타태그
  const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i;

  function parseTimeTags(line: string): number[] {
    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      let frac = 0;
      if (m[3] != null) {
        // 자릿수에 맞춰 소수로 환산: '5'→0.5, '50'→0.50, '234'→0.234
        frac = parseInt(m[3], 10) / Math.pow(10, m[3].length);
      }
      times.push(min * 60 + sec + frac);
    }
    return times;
  }

  /**
   * LRC 문자열을 파싱한다.
   * - [mm:ss.xx] / [mm:ss.xxx] / [mm:ss] 모두 허용, 초(float)로 변환
   * - 한 줄에 여러 타임태그(멀티 타임태그)면 각 시각마다 별도 라인으로 전개
   * - [offset:±n] 메타태그는 offsetMs로 반환(라인 time에는 미적용; 소비측에서 반영)
   * - 빈 텍스트(공백만)는 '♪'
   * - 메타/타임태그 없는 줄은 라인으로 만들지 않음
   * - 최종 time 오름차순 안정 정렬
   */
  export function parseLrc(raw: string): ParsedLrc {
    let offsetMs = 0;
    const offMatch = raw.match(OFFSET_TAG);
    if (offMatch) offsetMs = parseInt(offMatch[1], 10);

    const indexed: { time: number; text: string; order: number }[] = [];
    let order = 0;
    const rawLines = raw.split(/\r?\n/);
    for (const rawLine of rawLines) {
      const times = parseTimeTags(rawLine);
      if (times.length === 0) continue; // 메타태그/일반 텍스트 줄 무시
      // 타임태그를 모두 제거한 나머지가 가사 텍스트
      const text = rawLine.replace(TIME_TAG, '').trim();
      const safeText = text.length === 0 ? '♪' : text;
      for (const time of times) {
        indexed.push({ time, text: safeText, order: order++ });
      }
    }

    // time 오름차순, 동률이면 입력 순서 유지(안정 정렬)
    indexed.sort((a, b) => (a.time - b.time) || (a.order - b.order));
    const lines: LyricLine[] = indexed.map(({ time, text }) => ({ time, text }));
    return { lines, offsetMs };
  }

  /**
   * time 오름차순으로 정렬된 lines에서 time <= t 를 만족하는 마지막 인덱스를 이진탐색으로 찾는다.
   * 어떤 줄도 시작하지 않았으면(t가 첫 줄보다 작으면) -1.
   */
  export function findActiveIndex(lines: LyricLine[], t: number): number {
    let lo = 0;
    let hi = lines.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= t) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }
  ```
- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상: findActiveIndex 7개 + parseLrc 기본 9개 = 16개 PASS.
- [ ] **Step: 커밋**
  - `git add /Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts /Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts && git commit -m "feat: add parseLrc base parsing (time conversion, sort, blank-to-note)"`

---

### Task C4: lrc.ts — parseLrc 멀티 타임태그 + offset 메타태그 검증 강화

C3 구현이 이미 멀티 타임태그/offset 골격을 포함하므로, 이 태스크는 그 동작을 **명세로 고정**하는 테스트를 추가한다(회귀 방지). 테스트 추가 후 통과해야 한다.

**Files:**
- Modify (필요 시): `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `src/types.ts: import type { LyricLine } from '../types'`
- Produces: (시그니처 동일) `parseLrc(raw: string): ParsedLrc` — 멀티 타임태그 전개 + offsetMs 반환 동작 보장

- [ ] **Step: 실패하는 테스트 작성**
  - `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts` 끝에 추가:
  ```ts
  describe('parseLrc — 멀티 타임태그 & offset', () => {
    it('한 줄의 멀티 타임태그를 각 시각마다 별도 라인으로 전개한다', () => {
      const raw = '[00:01.00][00:05.00][00:09.00]repeat hook';
      const { lines } = parseLrc(raw);
      expect(lines).toHaveLength(3);
      expect(lines.map((l) => l.time)).toEqual([1, 5, 9]);
      expect(lines.every((l) => l.text === 'repeat hook')).toBe(true);
    });

    it('멀티 타임태그가 다른 줄과 섞여도 전체를 time순으로 정렬한다', () => {
      const raw = [
        '[00:08.00]later',
        '[00:01.00][00:05.00]hook',
        '[00:03.00]mid',
      ].join('\n');
      const { lines } = parseLrc(raw);
      expect(lines.map((l) => l.time)).toEqual([1, 3, 5, 8]);
      expect(lines.map((l) => l.text)).toEqual(['hook', 'mid', 'hook', 'later']);
    });

    it('[offset:+250] 양수 메타태그를 offsetMs=250으로 반환한다', () => {
      const raw = ['[offset:+250]', '[00:00.00]x'].join('\n');
      expect(parseLrc(raw).offsetMs).toBe(250);
    });

    it('[offset:-120] 음수 메타태그를 offsetMs=-120으로 반환한다', () => {
      const raw = ['[offset:-120]', '[00:00.00]x'].join('\n');
      expect(parseLrc(raw).offsetMs).toBe(-120);
    });

    it('offset 메타태그는 라인 time에 영향을 주지 않는다(소비측에서 반영)', () => {
      const raw = ['[offset:+500]', '[00:10.00]ten'].join('\n');
      const { lines, offsetMs } = parseLrc(raw);
      expect(offsetMs).toBe(500);
      expect(lines[0].time).toBeCloseTo(10, 5); // 10초 그대로, 10.5 아님
    });
  });
  ```
- [ ] **Step: 테스트 실행해 실패/통과 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상: C3 구현이 이미 멀티 타임태그/offset을 지원하므로 **새 테스트가 바로 통과**할 가능성이 높다. 만약 어떤 케이스가 실패하면(예: offset 공백 처리, 멀티태그 정렬) 그 케이스를 빨강으로 확인한 뒤 다음 스텝에서 lrc.ts를 보정한다. 통과하면 다음 구현 스텝은 "변경 없음"으로 건너뛴다.
- [ ] **Step: (필요 시) 구현 보정**
  - 모든 새 테스트가 통과했다면 lrc.ts 변경은 불필요(스킵). 만약 실패가 있었다면 해당 부분만 고친다. 예: offset 정규식이 부호+공백을 못 잡는 경우 `OFFSET_TAG`를 `/\[offset:\s*([+-]?\d+)\s*\]/i` 로 유지(C3에 이미 반영됨)했는지 확인하고, 멀티 타임태그 누락이 있으면 `parseTimeTags`의 `TIME_TAG.lastIndex = 0` 리셋이 함수 진입 시 실행되는지 확인한다(전역 정규식 상태 누수 방지).
- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/lrc.test.ts`
  - 예상: 누적 모든 테스트 PASS (findActiveIndex 7 + parseLrc 기본 9 + 멀티/offset 5 = 21개).
- [ ] **Step: 커밋**
  - `git add /Users/kyungsbook/Desktop/playlist/src/lib/lrc.ts /Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts && git commit -m "test: lock multi-timetag expansion and offset parsing for parseLrc"`

---

### Task C5: 모듈 C 통합 회귀 — 전체 lib 테스트 그린 확인

이 모듈의 산출물 전체가 함께 통과하는지 한 번 확인하고 마무리한다.

**Files:**
- Modify: 없음 (검증/커밋만)
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrc.test.ts`, `/Users/kyungsbook/Desktop/playlist/src/lib/time.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (모듈 C 산출물의 그린 상태 보증)

- [ ] **Step: 모듈 C 테스트 일괄 실행**
  - 명령: `npx vitest run src/lib/lrc.test.ts src/lib/time.test.ts`
  - 예상: 2개 테스트 파일 모두 PASS (lrc 21개 + time 5개 = 26개). 실패 시 해당 태스크로 돌아가 수정.
- [ ] **Step: 타입 체크(선택, tsconfig 있을 때)**
  - 명령: `npx tsc --noEmit -p /Users/kyungsbook/Desktop/playlist/tsconfig.json`
  - tsconfig가 아직 없으면 이 스텝은 모듈 A 합류 후 전체 통합 단계로 미룬다.
- [ ] **Step: 커밋(빈 변경이면 생략 가능)**
  - 변경 파일이 없으면 커밋 불필요. 만약 통합 중 사소한 수정이 있었다면: `git add /Users/kyungsbook/Desktop/playlist/src/lib && git commit -m "test: green run for lrc + time modules"`

---


<!-- ===== MODULE D-lrclib-colors ===== -->

## 모듈 D — src/lib/lrclib.ts & src/lib/colors.ts (LRCLIB 가사 fetch + 색 추출/명도 보정)

> 전제: 프로젝트 초기 셋업(Vite + React 18 + TS + Tailwind, Vitest + jsdom, `src/types.ts`의 `SongColors` 정의)이 완료되어 있다. 모든 테스트는 `vitest`에서 `describe/it/expect/vi`를 명시적으로 import 하므로 globals 설정에 의존하지 않는다. 명령의 cwd는 항상 프로젝트 루트 `/Users/kyungsbook/Desktop/playlist`.

---

### Task: colors.ts — hexToRgb / rgbToHex 라운드트립

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `src/types.ts: SongColors` (이후 태스크에서 사용; 이 태스크에선 미사용)
- Produces:
  - `export function hexToRgb(hex: string): [number, number, number]`
  - `export function rgbToHex(r: number, g: number, b: number): string`

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts` 생성
```ts
import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from './colors';

describe('hexToRgb', () => {
  it('parses 6-digit hex with leading #', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
  });
  it('parses hex without #', () => {
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
  });
  it('expands 3-digit shorthand', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
  });
  it('is case-insensitive', () => {
    expect(hexToRgb('#ABCDEF')).toEqual([171, 205, 239]);
  });
});

describe('rgbToHex', () => {
  it('formats rgb to lowercase 6-digit hex with #', () => {
    expect(rgbToHex(255, 136, 0)).toBe('#ff8800');
  });
  it('zero-pads single digit channels', () => {
    expect(rgbToHex(0, 1, 2)).toBe('#000102');
  });
  it('clamps out-of-range channels to 0..255 and rounds', () => {
    expect(rgbToHex(-5, 300, 127.6)).toBe('#00ff80');
  });
});

describe('round-trip', () => {
  it('hexToRgb -> rgbToHex preserves value', () => {
    expect(rgbToHex(...hexToRgb('#13c2a3'))).toBe('#13c2a3');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `Failed to resolve import "./colors"` 또는 `hexToRgb is not a function` (파일/함수 미존재).

- [ ] **Step: 최소 구현** — `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts` 생성
```ts
import type { SongColors } from '../types';

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hh = (v: number) => clampChannel(v).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(b)}`;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `hexToRgb`/`rgbToHex`/`round-trip` 그룹 전부 green.

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add hexToRgb/rgbToHex color conversion helpers"`

---

### Task: colors.ts — rgbToHsl / hslToRgb 변환 라운드트립

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Produces:
  - `export function rgbToHsl(r: number, g: number, b: number): [number, number, number]`  // h:0..360, s,l:0..1
  - `export function hslToRgb(h: number, s: number, l: number): [number, number, number]`

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 아래 블록 추가
```ts
import { rgbToHsl, hslToRgb } from './colors';

describe('rgbToHsl', () => {
  it('pure red -> h=0 s=1 l=0.5', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 5);
    expect(s).toBeCloseTo(1, 5);
    expect(l).toBeCloseTo(0.5, 5);
  });
  it('pure green -> h=120', () => {
    expect(rgbToHsl(0, 255, 0)[0]).toBeCloseTo(120, 5);
  });
  it('pure blue -> h=240', () => {
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240, 5);
  });
  it('gray is achromatic: s=0', () => {
    const [, s, l] = rgbToHsl(128, 128, 128);
    expect(s).toBeCloseTo(0, 5);
    expect(l).toBeCloseTo(128 / 255, 5);
  });
});

describe('hslToRgb', () => {
  it('h=0 s=1 l=0.5 -> pure red', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);
  });
  it('s=0 -> gray regardless of hue', () => {
    expect(hslToRgb(200, 0, 0.5)).toEqual([128, 128, 128]);
  });
});

describe('hsl round-trip', () => {
  it('rgb -> hsl -> rgb is stable for sample colors', () => {
    for (const c of [[18, 194, 163], [255, 136, 0], [60, 20, 90]] as const) {
      const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
      const back = hslToRgb(h, s, l);
      expect(back[0]).toBeCloseTo(c[0], -0.5);
      expect(back[1]).toBeCloseTo(c[1], -0.5);
      expect(back[2]).toBeCloseTo(c[2], -0.5);
    }
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `rgbToHsl is not a function` / `hslToRgb is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 함수 추가 (`rgbToHex` 정의 아래)
```ts
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [
    clampChannel((r1 + m) * 255),
    clampChannel((g1 + m) * 255),
    clampChannel((b1 + m) * 255),
  ];
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `rgbToHsl`/`hslToRgb`/`hsl round-trip` green, 기존 테스트도 유지.

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add rgbToHsl/hslToRgb conversions"`

---

### Task: colors.ts — relativeLuminance / contrastRatio (WCAG)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Produces:
  - `export function relativeLuminance(hex: string): number`   // 0..1 (WCAG)
  - `export function contrastRatio(hexA: string, hexB: string): number` // 1..21

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { relativeLuminance, contrastRatio } from './colors';

describe('relativeLuminance', () => {
  it('white is 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
  it('black is 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });
  it('mid gray (#777) approx 0.183', () => {
    expect(relativeLuminance('#777777')).toBeCloseTo(0.183, 2);
  });
});

describe('contrastRatio', () => {
  it('white vs black is 21', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
  it('is symmetric', () => {
    const a = contrastRatio('#123456', '#ffffff');
    const b = contrastRatio('#ffffff', '#123456');
    expect(a).toBeCloseTo(b, 6);
  });
  it('same color is 1', () => {
    expect(contrastRatio('#abcdef', '#abcdef')).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `relativeLuminance is not a function` / `contrastRatio is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가
```ts
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `relativeLuminance`/`contrastRatio` green.

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add WCAG relativeLuminance and contrastRatio"`

---

### Task: colors.ts — clampLightness (HSL 명도 범위 클램프)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `rgbToHsl`, `hslToRgb`, `hexToRgb`, `rgbToHex` (동일 모듈)
- Produces: `export function clampLightness(hex: string, minL: number, maxL: number): string`

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { clampLightness, rgbToHsl, hexToRgb } from './colors';

describe('clampLightness', () => {
  it('darkens a too-bright color down to maxL', () => {
    const out = clampLightness('#ffffff', 0.1, 0.4); // white l=1 -> clamp to 0.4
    const [, , l] = rgbToHsl(...hexToRgb(out));
    expect(l).toBeLessThanOrEqual(0.41);
    expect(l).toBeGreaterThanOrEqual(0.39);
  });
  it('lightens a too-dark color up to minL', () => {
    const out = clampLightness('#000000', 0.2, 0.9); // black l=0 -> clamp to 0.2
    const [, , l] = rgbToHsl(...hexToRgb(out));
    expect(l).toBeGreaterThanOrEqual(0.19);
    expect(l).toBeLessThanOrEqual(0.21);
  });
  it('leaves in-range lightness unchanged (hue/sat preserved)', () => {
    const src = '#3a7fbf';
    const [h0, s0, l0] = rgbToHsl(...hexToRgb(src));
    const out = clampLightness(src, 0.1, 0.9);
    const [h1, s1, l1] = rgbToHsl(...hexToRgb(out));
    expect(l1).toBeCloseTo(l0, 1);
    expect(h1).toBeCloseTo(h0, 0);
    expect(s1).toBeCloseTo(s0, 1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `clampLightness is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가
```ts
export function clampLightness(hex: string, minL: number, maxL: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const cl = Math.max(minL, Math.min(maxL, l));
  return rgbToHex(...hslToRgb(h, s, cl));
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `clampLightness` 3개 케이스 green.

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add clampLightness for HSL lightness clamping"`

---

### Task: colors.ts — ensureReadableOnWhite (흰 텍스트 대비 보장 어둡게)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `contrastRatio`, `rgbToHsl`, `hslToRgb`, `hexToRgb`, `rgbToHex` (동일 모듈)
- Produces: `export function ensureReadableOnWhite(bgHex: string, minRatio?: number): string` // 기본 minRatio=4.5

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { ensureReadableOnWhite, contrastRatio } from './colors';

describe('ensureReadableOnWhite', () => {
  it('darkens a bright color until white text contrast >= 4.5', () => {
    const out = ensureReadableOnWhite('#ffd400'); // bright yellow, very low contrast vs white
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('respects a custom higher minRatio', () => {
    const out = ensureReadableOnWhite('#33aa55', 7);
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(7);
  });
  it('leaves already-dark color unchanged enough to keep contrast', () => {
    const out = ensureReadableOnWhite('#101820');
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('returns a valid hex string', () => {
    expect(ensureReadableOnWhite('#abcdef')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `ensureReadableOnWhite is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가
```ts
export function ensureReadableOnWhite(bgHex: string, minRatio = 4.5): string {
  let [h, s, l] = rgbToHsl(...hexToRgb(bgHex));
  let hex = rgbToHex(...hslToRgb(h, s, l));
  // step down lightness until white text reaches the target contrast (or fully black)
  for (let i = 0; i < 100 && contrastRatio(hex, '#ffffff') < minRatio; i++) {
    l = Math.max(0, l - 0.02);
    hex = rgbToHex(...hslToRgb(h, s, l));
    if (l <= 0) break;
  }
  return hex;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `ensureReadableOnWhite` 4개 케이스 green (밝은 노랑/초록이 대비 4.5/7 이상으로 어두워짐).

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add ensureReadableOnWhite contrast guard"`

---

### Task: colors.ts — quantize (합성 픽셀 버킷 양자화로 RawPalette 추정)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `rgbToHex`, `rgbToHsl` (동일 모듈)
- Produces:
  - `export interface RawPalette { vibrant?: string; darkVibrant?: string; lightVibrant?: string; muted?: string; darkMuted?: string; }`
  - `export function quantize(pixels: Uint8ClampedArray, sampleStep?: number): RawPalette`

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { quantize, rgbToHsl, hexToRgb } from './colors';

// helper: build RGBA Uint8ClampedArray from list of [r,g,b] repeated `count` times
function pixelsFrom(spec: Array<[number, number, number, number]>): Uint8ClampedArray {
  const total = spec.reduce((n, s) => n + s[3], 0);
  const arr = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [r, g, b, count] of spec) {
    for (let c = 0; c < count; c++) {
      arr[i++] = r; arr[i++] = g; arr[i++] = b; arr[i++] = 255;
    }
  }
  return arr;
}

describe('quantize', () => {
  it('returns an object (RawPalette) for non-empty pixels', () => {
    const px = pixelsFrom([[200, 30, 30, 50]]);
    const pal = quantize(px, 1);
    expect(typeof pal).toBe('object');
  });

  it('picks a saturated dominant color as vibrant', () => {
    // mostly vivid red, plus some gray noise
    const px = pixelsFrom([[220, 20, 20, 200], [128, 128, 128, 30]]);
    const pal = quantize(px, 1);
    expect(pal.vibrant).toBeDefined();
    const [h, s] = rgbToHsl(...hexToRgb(pal.vibrant!));
    expect(s).toBeGreaterThan(0.4);       // vibrant must be saturated
    expect(h).toBeGreaterThan(330);       // red hue near 0/360
    // hue near red: either >330 or <30
  });

  it('classifies a dark saturated color as darkVibrant', () => {
    const px = pixelsFrom([[40, 8, 8, 300]]); // dark red
    const pal = quantize(px, 1);
    expect(pal.darkVibrant).toBeDefined();
    const [, , l] = rgbToHsl(...hexToRgb(pal.darkVibrant!));
    expect(l).toBeLessThan(0.4);
  });

  it('classifies a low-saturation mid color as muted', () => {
    const px = pixelsFrom([[120, 110, 100, 300]]); // grayish
    const pal = quantize(px, 1);
    expect(pal.muted).toBeDefined();
    const [, s] = rgbToHsl(...hexToRgb(pal.muted!));
    expect(s).toBeLessThan(0.4);
  });

  it('returns empty palette for empty pixels', () => {
    const pal = quantize(new Uint8ClampedArray(0), 1);
    expect(pal).toEqual({});
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `quantize is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가 (`SongColors` import는 이미 상단에 존재)
```ts
export interface RawPalette {
  vibrant?: string;
  darkVibrant?: string;
  lightVibrant?: string;
  muted?: string;
  darkMuted?: string;
}

interface Bucket { r: number; g: number; b: number; count: number; }

export function quantize(pixels: Uint8ClampedArray, sampleStep = 4): RawPalette {
  const step = Math.max(1, Math.floor(sampleStep));
  const buckets = new Map<number, Bucket>();
  // group into 16-level-per-channel buckets (4 bits each -> 12-bit key)
  for (let i = 0; i + 3 < pixels.length; i += 4 * step) {
    const a = pixels[i + 3];
    if (a < 125) continue; // skip transparent
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key);
    if (bk) { bk.r += r; bk.g += g; bk.b += b; bk.count++; }
    else buckets.set(key, { r, g, b, count: 1 });
  }
  if (buckets.size === 0) return {};

  // representative color per bucket (average), with hsl + score
  type Cand = { hex: string; h: number; s: number; l: number; count: number };
  const cands: Cand[] = [];
  for (const bk of buckets.values()) {
    const r = Math.round(bk.r / bk.count);
    const g = Math.round(bk.g / bk.count);
    const b = Math.round(bk.b / bk.count);
    const [h, s, l] = rgbToHsl(r, g, b);
    cands.push({ hex: rgbToHex(r, g, b), h, s, l, count: bk.count });
  }

  const palette: RawPalette = {};
  // pick best candidate matching predicate by weighted (saturation * count) or count
  const pickVivid = (pred: (c: Cand) => boolean) => {
    let best: Cand | undefined;
    let bestScore = -1;
    for (const c of cands) {
      if (!pred(c)) continue;
      const score = (c.s + 0.1) * c.count;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best?.hex;
  };
  const pickByCount = (pred: (c: Cand) => boolean) => {
    let best: Cand | undefined;
    let bestCount = -1;
    for (const c of cands) {
      if (!pred(c)) continue;
      if (c.count > bestCount) { bestCount = c.count; best = c; }
    }
    return best?.hex;
  };

  palette.vibrant = pickVivid((c) => c.s >= 0.4 && c.l >= 0.35 && c.l <= 0.7);
  palette.lightVibrant = pickVivid((c) => c.s >= 0.3 && c.l > 0.7);
  palette.darkVibrant = pickVivid((c) => c.s >= 0.3 && c.l < 0.4);
  palette.muted = pickByCount((c) => c.s < 0.4 && c.l >= 0.3 && c.l <= 0.7);
  palette.darkMuted = pickByCount((c) => c.s < 0.4 && c.l < 0.3);

  // strip undefined entries for a clean object
  (Object.keys(palette) as (keyof RawPalette)[]).forEach((k) => {
    if (palette[k] === undefined) delete palette[k];
  });
  return palette;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `quantize` 5개 케이스 green (vibrant 채도/색상, darkVibrant 명도, muted 저채도, 빈 입력 `{}`).

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add quantize palette extraction from RGBA pixels"`

---

### Task: colors.ts — FALLBACK_COLORS + buildSongColors (RawPalette → SongColors)

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `src/types.ts: SongColors`; `clampLightness`, `ensureReadableOnWhite`, `contrastRatio` (동일 모듈); `RawPalette`
- Produces:
  - `export const FALLBACK_COLORS: SongColors`  // 딥네이비/보라 계열
  - `export function buildSongColors(palette: RawPalette): SongColors`

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { buildSongColors, FALLBACK_COLORS, contrastRatio, rgbToHsl, hexToRgb } from './colors';

const HEX = /^#[0-9a-f]{6}$/;

describe('FALLBACK_COLORS', () => {
  it('has three valid hex fields', () => {
    expect(FALLBACK_COLORS.gradientFrom).toMatch(HEX);
    expect(FALLBACK_COLORS.gradientTo).toMatch(HEX);
    expect(FALLBACK_COLORS.accent).toMatch(HEX);
  });
  it('gradient base is dark enough for white text', () => {
    expect(contrastRatio(FALLBACK_COLORS.gradientFrom, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('buildSongColors', () => {
  it('returns three valid hex fields', () => {
    const out = buildSongColors({ vibrant: '#22c2a3', darkVibrant: '#0d4f43', muted: '#5a6a66' });
    expect(out.gradientFrom).toMatch(HEX);
    expect(out.gradientTo).toMatch(HEX);
    expect(out.accent).toMatch(HEX);
  });
  it('gradientFrom is readable under white text (contrast >= 4.5)', () => {
    const out = buildSongColors({ vibrant: '#ffd400', lightVibrant: '#fff6b0' }); // very bright source
    expect(contrastRatio(out.gradientFrom, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('gradientTo is darker than (or equal to) gradientFrom', () => {
    const out = buildSongColors({ vibrant: '#3a7fbf', darkVibrant: '#16314a' });
    const lFrom = rgbToHsl(...hexToRgb(out.gradientFrom))[2];
    const lTo = rgbToHsl(...hexToRgb(out.gradientTo))[2];
    expect(lTo).toBeLessThanOrEqual(lFrom + 0.001);
  });
  it('accent prefers vibrant when present', () => {
    const out = buildSongColors({ vibrant: '#e91e63', darkVibrant: '#222' });
    expect(out.accent).toBe('#e91e63');
  });
  it('falls back to FALLBACK_COLORS when palette is empty', () => {
    expect(buildSongColors({})).toEqual(FALLBACK_COLORS);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `buildSongColors is not a function` / `FALLBACK_COLORS` undefined.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가
```ts
export const FALLBACK_COLORS: SongColors = {
  gradientFrom: '#1b1438', // deep navy/purple
  gradientTo: '#0c0a1f',
  accent: '#7c6cff',
};

export function buildSongColors(palette: RawPalette): SongColors {
  const hasAny =
    palette.vibrant || palette.darkVibrant || palette.lightVibrant ||
    palette.muted || palette.darkMuted;
  if (!hasAny) return { ...FALLBACK_COLORS };

  // base: prefer a darker representative for the gradient
  const baseRaw =
    palette.darkVibrant || palette.darkMuted || palette.muted ||
    palette.vibrant || palette.lightVibrant!;
  // clamp into a dark-but-colored range, then guarantee white-text readability
  const clamped = clampLightness(baseRaw, 0.12, 0.32);
  const gradientFrom = ensureReadableOnWhite(clamped, 4.5);
  // gradientTo: noticeably darker than gradientFrom
  const gradientTo = clampLightness(gradientFrom, 0.05, 0.18);
  // accent: the most vivid available, otherwise the base
  const accent =
    palette.vibrant || palette.lightVibrant || palette.darkVibrant ||
    palette.muted || palette.darkMuted || gradientFrom;

  return { gradientFrom, gradientTo, accent };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: `FALLBACK_COLORS`/`buildSongColors` 전 케이스 green (밝은 소스도 gradientFrom 대비 4.5+, gradientTo가 더 어두움, accent=vibrant, 빈 팔레트→폴백).

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add FALLBACK_COLORS and buildSongColors"`

---

### Task: colors.ts — extractPalette (loadImage 주입형, 실패 시 throw) + 수동 검증

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `quantize`, `RawPalette` (동일 모듈); DOM `HTMLImageElement`/`HTMLCanvasElement` (브라우저/jsdom)
- Produces: `export async function extractPalette(imageUrl: string, loadImage?: (url: string) => Promise<HTMLImageElement>): Promise<RawPalette>` // crossOrigin='anonymous' 이미지→canvas→quantize. taint/실패 시 throw

> jsdom에는 canvas 2D 컨텍스트가 없어 픽셀 추출을 단위테스트로 검증할 수 없다. 따라서 (a) `loadImage` 주입형으로 "canvas context 없음/taint → throw" 경로만 스모크 테스트하고, (b) 실제 색 추출은 수동 검증 체크리스트로 대체한다(spec §15 ytimg CORS 리스크와 직접 연결).

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `colors.test.ts`에 추가
```ts
import { extractPalette } from './colors';

describe('extractPalette (injected loadImage)', () => {
  it('throws when loadImage rejects (load failure)', async () => {
    const failingLoad = async () => { throw new Error('load failed'); };
    await expect(extractPalette('http://example.com/x.jpg', failingLoad)).rejects.toThrow();
  });

  it('throws when canvas 2D context / pixel read is unavailable (jsdom)', async () => {
    // fake image; in jsdom getContext('2d') returns null or getImageData throws -> extractPalette must throw
    const fakeImg = { width: 10, height: 10, naturalWidth: 10, naturalHeight: 10 } as unknown as HTMLImageElement;
    const fakeLoad = async () => fakeImg;
    await expect(extractPalette('http://example.com/x.jpg', fakeLoad)).rejects.toThrow();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 실패: `extractPalette is not a function`.

- [ ] **Step: 최소 구현** — `colors.ts`에 추가
```ts
function defaultLoadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
}

export async function extractPalette(
  imageUrl: string,
  loadImage: (url: string) => Promise<HTMLImageElement> = defaultLoadImage,
): Promise<RawPalette> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) throw new Error('image has no dimensions');

  // downscale for speed
  const maxSide = 100;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(img, 0, 0, cw, ch);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cw, ch).data; // throws if canvas is tainted (CORS)
  } catch (e) {
    throw new Error('canvas tainted or pixel read failed');
  }
  return quantize(data, 1);
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/colors.test.ts`
  - 예상 PASS: 두 케이스 모두 `rejects.toThrow()` 만족 (loadImage 거부 → throw; jsdom canvas 컨텍스트/픽셀 읽기 불가 → throw).

- [ ] **Step: 수동 검증 (브라우저)** — 실제 ytimg 썸네일 색 추출 확인 (단위테스트 불가 영역, spec §15 CORS 리스크)
  - [ ] 개발 서버 실행: `npx vite` (또는 `npm run dev`) 후 브라우저에서 앱 열기.
  - [ ] 브라우저 콘솔에서 실제 추출을 한 번 실행:
    ```js
    const m = await import('/src/lib/colors.ts');
    const pal = await m.extractPalette('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    console.log(pal);
    const sc = m.buildSongColors(pal);
    console.log(sc);
    ```
  - [ ] 확인 1 (CORS): `pal`이 `{}`가 아니라 `vibrant`/`darkVibrant`/`muted` 중 최소 1개 이상의 hex를 담고 있다 → ytimg가 익명 canvas 읽기를 허용함. 만약 `canvas tainted...` 에러가 throw되면 spec §15대로 폴백 팔레트 경로(`extractPalette` 실패 → 호출측에서 `FALLBACK_COLORS`)가 동작해야 함을 기록.
  - [ ] 확인 2 (시각): `console.log` 된 `sc.gradientFrom`/`gradientTo`/`accent`를 임시 `<div style="background:linear-gradient(...)">`에 칠해, 흰 텍스트가 또렷이 읽히고(어두운 배경) accent가 곡 분위기 색과 맞는지 눈으로 확인.
  - [ ] 확인 3 (폴백): 존재하지 않는 썸네일 URL(`.../INVALIDID/hqdefault.jpg`)로 호출 시 `extractPalette`가 reject(throw)되는지 확인 → 호출측 try/catch에서 `FALLBACK_COLORS`로 강등 가능.

- [ ] **Step: 커밋**
  - `git add src/lib/colors.ts src/lib/colors.test.ts && git commit -m "feat: add extractPalette with injectable loadImage and throw-on-taint"`

---

### Task: lrclib.ts — fetchLyrics /api/get 성공 경로 (fetchImpl 주입 모킹)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.test.ts`

**Interfaces:**
- Produces:
  - `export interface LrclibResponse { syncedLyrics: string | null; plainLyrics: string | null; }`
  - `export interface FetchLyricsParams { artist: string; track: string; album?: string; durationSec?: number; }`
  - `export async function fetchLyrics(p: FetchLyricsParams, fetchImpl?: typeof fetch): Promise<LrclibResponse | null>`
- 동작: `GET https://lrclib.net/api/get?artist_name=&track_name=&album_name=&duration=` 먼저. `Lrclib-Client` 헤더 첨부. (실제 네트워크 호출 금지 — `fetchImpl` 주입 모킹으로만 테스트)

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.test.ts` 생성
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchLyrics } from './lrclib';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchLyrics /api/get success', () => {
  it('hits /api/get with query params and Lrclib-Client header, returns lyrics', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi' }),
    ) as unknown as typeof fetch;

    const res = await fetchLyrics(
      { artist: 'Adele', track: 'Hello', album: '25', durationSec: 295 },
      fetchImpl,
    );

    expect(res).toEqual({ syncedLyrics: '[00:01.00] hi', plainLyrics: 'hi' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const u = String(url);
    expect(u).toContain('https://lrclib.net/api/get');
    expect(u).toContain('artist_name=Adele');
    expect(u).toContain('track_name=Hello');
    expect(u).toContain('album_name=25');
    expect(u).toContain('duration=295');

    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers['Lrclib-Client']).toBeTruthy();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/lrclib.test.ts`
  - 예상 실패: `Failed to resolve import "./lrclib"` 또는 `fetchLyrics is not a function`.

- [ ] **Step: 최소 구현** — `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.ts` 생성
```ts
export interface LrclibResponse {
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export interface FetchLyricsParams {
  artist: string;
  track: string;
  album?: string;
  durationSec?: number;
}

const BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = {
  'Lrclib-Client': 'Yejin Playlist (https://github.com/yejin-playlist)',
};

function toResponse(raw: { syncedLyrics?: unknown; plainLyrics?: unknown }): LrclibResponse {
  return {
    syncedLyrics: typeof raw.syncedLyrics === 'string' ? raw.syncedLyrics : null,
    plainLyrics: typeof raw.plainLyrics === 'string' ? raw.plainLyrics : null,
  };
}

export async function fetchLyrics(
  p: FetchLyricsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<LrclibResponse | null> {
  const getUrl = new URL(`${BASE}/get`);
  getUrl.searchParams.set('artist_name', p.artist);
  getUrl.searchParams.set('track_name', p.track);
  if (p.album) getUrl.searchParams.set('album_name', p.album);
  if (typeof p.durationSec === 'number') {
    getUrl.searchParams.set('duration', String(Math.round(p.durationSec)));
  }

  const getRes = await fetchImpl(getUrl.toString(), { headers: { ...CLIENT_HEADER } });
  if (getRes.ok) {
    const body = await getRes.json();
    return toResponse(body ?? {});
  }
  return null;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/lrclib.test.ts`
  - 예상 PASS: `/api/get success` green (URL에 `artist_name=Adele&track_name=Hello&album_name=25&duration=295`, `Lrclib-Client` 헤더 존재).

- [ ] **Step: 커밋**
  - `git add src/lib/lrclib.ts src/lib/lrclib.test.ts && git commit -m "feat: add fetchLyrics /api/get success path"`

---

### Task: lrclib.ts — /api/get 404 → /api/search 폴백 + 전부 실패 시 null

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.test.ts`

**Interfaces:**
- Produces (동작 확장): `/api/get` 404 응답 시 `GET https://lrclib.net/api/search?track_name=&artist_name=` 호출 후 **첫 후보** 반환. search 결과가 비었거나 search도 실패하면 `null`. (실제 네트워크 호출 금지 — `fetchImpl` 모킹)

**Steps:**

- [ ] **Step: 실패하는 테스트 작성** — `lrclib.test.ts`에 추가
```ts
describe('fetchLyrics /api/get 404 -> /api/search fallback', () => {
  it('falls back to /api/search and returns the first candidate', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404, message: 'Not Found' }, 404)) // /api/get
      .mockResolvedValueOnce(
        jsonResponse([
          { syncedLyrics: '[00:02.00] first', plainLyrics: 'first' },
          { syncedLyrics: '[00:03.00] second', plainLyrics: 'second' },
        ]),
      ) as unknown as typeof fetch; // /api/search

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);

    expect(res).toEqual({ syncedLyrics: '[00:02.00] first', plainLyrics: 'first' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain('/api/get');
    const searchUrl = String(calls[1][0]);
    expect(searchUrl).toContain('/api/search');
    expect(searchUrl).toContain('track_name=B');
    expect(searchUrl).toContain('artist_name=A');
    const searchHeaders = (calls[1][1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(searchHeaders['Lrclib-Client']).toBeTruthy();
  });

  it('returns null when /api/get 404 and /api/search is empty array', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse([])) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });

  it('returns null when /api/get 404 and /api/search also fails (non-ok)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500)) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });

  it('returns null when fetch throws on both calls', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const res = await fetchLyrics({ artist: 'A', track: 'B' }, fetchImpl);
    expect(res).toBeNull();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/lrclib.test.ts`
  - 예상 실패: 첫 케이스에서 `expected null to equal { syncedLyrics: '[00:02.00] first', ... }` (현재 구현은 404면 바로 `null` 반환, search 미구현). 또한 `network down` 케이스는 현재 try/catch 없어 reject로 실패.

- [ ] **Step: 최소 구현** — `lrclib.ts`의 `fetchLyrics`를 search 폴백 + 예외 안전 처리로 교체
```ts
export async function fetchLyrics(
  p: FetchLyricsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<LrclibResponse | null> {
  // 1) /api/get
  try {
    const getUrl = new URL(`${BASE}/get`);
    getUrl.searchParams.set('artist_name', p.artist);
    getUrl.searchParams.set('track_name', p.track);
    if (p.album) getUrl.searchParams.set('album_name', p.album);
    if (typeof p.durationSec === 'number') {
      getUrl.searchParams.set('duration', String(Math.round(p.durationSec)));
    }
    const getRes = await fetchImpl(getUrl.toString(), { headers: { ...CLIENT_HEADER } });
    if (getRes.ok) {
      const body = await getRes.json();
      return toResponse(body ?? {});
    }
    // any non-ok (404 etc.) -> fall through to search
  } catch {
    // network error on /api/get -> still try search
  }

  // 2) /api/search (first candidate)
  try {
    const searchUrl = new URL(`${BASE}/search`);
    searchUrl.searchParams.set('track_name', p.track);
    searchUrl.searchParams.set('artist_name', p.artist);
    const searchRes = await fetchImpl(searchUrl.toString(), { headers: { ...CLIENT_HEADER } });
    if (!searchRes.ok) return null;
    const list = await searchRes.json();
    if (Array.isArray(list) && list.length > 0) {
      return toResponse(list[0] ?? {});
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/lrclib.test.ts`
  - 예상 PASS: 폴백/빈 결과/search 실패/네트워크 예외 4개 케이스 + 앞선 `/api/get success` 케이스 전부 green.

- [ ] **Step: 커밋**
  - `git add src/lib/lrclib.ts src/lib/lrclib.test.ts && git commit -m "feat: add /api/search fallback and null-safe error handling to fetchLyrics"`

---

### Task: 모듈 D 전체 테스트 일괄 통과 확인 (회귀)

**Files:**
- Test (read-only 실행): `/Users/kyungsbook/Desktop/playlist/src/lib/colors.test.ts`, `/Users/kyungsbook/Desktop/playlist/src/lib/lrclib.test.ts`

**Interfaces:**
- Consumes: `src/lib/colors.ts`, `src/lib/lrclib.ts` (완성본)
- Produces: (없음 — 회귀 게이트)

**Steps:**

- [ ] **Step: 두 테스트 파일 동시 실행** — 회귀 확인
  - 명령: `npx vitest run src/lib/colors.test.ts src/lib/lrclib.test.ts`
  - 예상 PASS: 두 파일의 모든 describe 블록 green, 실패 0.

- [ ] **Step: 타입 체크** — 계약 시그니처 위반 없음 확인
  - 명령: `npx tsc --noEmit`
  - 예상 결과: 에러 0 (colors/lrclib export 시그니처가 계약과 일치, `SongColors` import 정상). 만약 다른 미완성 모듈로 인한 에러가 있으면 `colors.ts`/`lrclib.ts` 관련 에러만 없는지 확인.

- [ ] **Step: 커밋 (필요 시)** — 위 단계에서 코드 변경이 없었다면 생략. 변경이 있었다면:
  - `git add src/lib/colors.ts src/lib/lrclib.ts && git commit -m "test: verify colors and lrclib pass together"`

---


<!-- ===== MODULE E-storage-share ===== -->

## Module E: storage + share (localStorage 영속화 & 공유 링크 인코딩)

이 모듈 그룹은 두 개의 순수/준순수 라이브러리를 다룬다. `storage.ts` 는 jsdom 의 `localStorage` 위에서 곡 풀과 플레이리스트를 영속화하고, `share.ts` 는 `SharedPlaylist` 를 URL-safe base64url 로 직렬화/역직렬화한다. 두 모듈 모두 외부 부수효과(시간/난수)는 주입형 인자로 받아 결정론적으로 테스트한다.

> 전제(Consumes): `src/types.ts` 가 잠긴 계약대로 이미 존재한다(`Song`, `Playlist`, `SharedPlaylist`, `SongColors`, `SongLyrics`). 본 모듈의 테스트 픽스처는 `Song`/`Playlist` 의 모든 필드를 채운다. `src/types.ts` 가 아직 없다면 해당 모듈 그룹이 먼저 생성해야 본 태스크가 컴파일된다.
>
> 환경 전제: `vitest` 설정의 `test.environment === 'jsdom'`. 이로써 `localStorage`, `btoa`, `atob`, `TextEncoder`/`TextDecoder` 가 전역으로 제공된다.

---

### Task: storage 픽스처 헬퍼와 SONGS_KEY/PLAYLISTS_KEY 상수

테스트에서 반복 사용할 완전한 `Song`/`Playlist` 픽스처 팩토리를 테스트 파일 안에 두고, 먼저 두 스토리지 키 상수를 도입한다. 가장 작은 산출물부터 빨간불을 만든다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `import type { Song, Playlist } from '../types'` (잠긴 계약)
- Produces:
  - `export const SONGS_KEY = 'yejin.songs.v1'`
  - `export const PLAYLISTS_KEY = 'yejin.playlists.v1'`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts` 생성. 픽스처 팩토리(다음 태스크에서도 재사용)와 상수 단언만 둔다.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Playlist, Song } from '../types';
import { PLAYLISTS_KEY, SONGS_KEY } from './storage';

// --- shared fixtures (reused by later tasks in this file) ---
export function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'abc12345678',
    title: 'Test Title',
    artist: 'Test Artist',
    durationSec: 200,
    cover: 'https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg',
    colors: { gradientFrom: '#101522', gradientTo: '#070912', accent: '#7c5cff' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 'my-list-ab12',
    title: 'My List',
    message: undefined,
    coverVideoId: undefined,
    songIds: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('storage keys', () => {
  it('uses versioned localStorage keys', () => {
    expect(SONGS_KEY).toBe('yejin.songs.v1');
    expect(PLAYLISTS_KEY).toBe('yejin.playlists.v1');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상 실패: 모듈 해석 오류 — `Failed to resolve import "./storage"` 또는 `SONGS_KEY` 가 `undefined` 라 `expected undefined to be 'yejin.songs.v1'`.

- [ ] **Step: 최소 구현** — `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts` 생성, 상수와 import 만.

```ts
import type { Playlist, Song } from '../types';

export const SONGS_KEY = 'yejin.songs.v1';
export const PLAYLISTS_KEY = 'yejin.playlists.v1';

void (null as unknown as Song);
void (null as unknown as Playlist);
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상: `Test Files  1 passed`, `Tests  1 passed`.

- [ ] **Step: 커밋**

```
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "feat: add storage keys and test fixtures"
```

---

### Task: loadSongs / getSong / saveSong (곡 풀 CRUD)

곡 풀은 `Record<string, Song>` 형태로 `SONGS_KEY` 에 JSON 직렬화 저장한다. 깨진/없는 데이터는 빈 객체로 폴백한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `import type { Song } from '../types'`
- Produces:
  - `export function loadSongs(): Record<string, Song>`
  - `export function getSong(id: string): Song | undefined`
  - `export function saveSong(song: Song): void`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — `storage.test.ts` 에 import 와 describe 블록 추가.

import 라인 확장:

```ts
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  getSong,
  loadSongs,
  saveSong,
} from './storage';
```

추가 describe:

```ts
describe('song pool CRUD', () => {
  it('returns empty record when nothing stored', () => {
    expect(loadSongs()).toEqual({});
  });

  it('returns empty record when stored JSON is corrupt', () => {
    localStorage.setItem(SONGS_KEY, '{not-json');
    expect(loadSongs()).toEqual({});
  });

  it('saveSong persists keyed by song id and getSong reads it back', () => {
    const song = makeSong({ id: 'xyz98765432', title: 'Saved' });
    saveSong(song);
    expect(getSong('xyz98765432')).toEqual(song);
    expect(loadSongs()).toEqual({ xyz98765432: song });
  });

  it('saveSong with same id overwrites previous entry', () => {
    saveSong(makeSong({ id: 'dup00000000', title: 'First' }));
    saveSong(makeSong({ id: 'dup00000000', title: 'Second' }));
    expect(getSong('dup00000000')?.title).toBe('Second');
    expect(Object.keys(loadSongs())).toHaveLength(1);
  });

  it('getSong returns undefined for unknown id', () => {
    expect(getSong('nope0000000')).toBeUndefined();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상 실패: `loadSongs is not a function` / `getSong is not a function` / `saveSong is not a function` (export 미존재).

- [ ] **Step: 최소 구현** — `storage.ts` 에 곡 풀 함수 추가. (이전 태스크의 `void (...)` 더미 두 줄은 함수가 타입을 실제 사용하므로 제거한다.)

`storage.ts` 전체를 다음으로 교체:

```ts
import type { Playlist, Song } from '../types';

export const SONGS_KEY = 'yejin.songs.v1';
export const PLAYLISTS_KEY = 'yejin.playlists.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSongs(): Record<string, Song> {
  const data = readJson<Record<string, Song>>(SONGS_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

export function getSong(id: string): Song | undefined {
  return loadSongs()[id];
}

export function saveSong(song: Song): void {
  const songs = loadSongs();
  songs[song.id] = song;
  writeJson(SONGS_KEY, songs);
}

void (null as unknown as Playlist);
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상: `Tests  6 passed` (이전 1 + 신규 5).

- [ ] **Step: 커밋**

```
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "feat: add song pool load/get/save to storage"
```

---

### Task: loadPlaylists / getPlaylist / savePlaylist / deletePlaylist (플레이리스트 CRUD)

플레이리스트는 배열로 `PLAYLISTS_KEY` 에 저장한다. `savePlaylist` 는 동일 id 가 있으면 교체, 없으면 추가한다. `deletePlaylist` 는 id 로 제거한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `import type { Playlist } from '../types'`
- Produces:
  - `export function loadPlaylists(): Playlist[]`
  - `export function getPlaylist(id: string): Playlist | undefined`
  - `export function savePlaylist(p: Playlist): void`
  - `export function deletePlaylist(id: string): void`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — import 확장 + describe 추가.

import 라인 확장:

```ts
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  deletePlaylist,
  getPlaylist,
  getSong,
  loadPlaylists,
  loadSongs,
  savePlaylist,
  saveSong,
} from './storage';
```

추가 describe:

```ts
describe('playlist CRUD', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadPlaylists()).toEqual([]);
  });

  it('returns empty array when stored JSON is corrupt', () => {
    localStorage.setItem(PLAYLISTS_KEY, 'broken[');
    expect(loadPlaylists()).toEqual([]);
  });

  it('savePlaylist appends a new playlist', () => {
    const p = makePlaylist({ id: 'a-1111' });
    savePlaylist(p);
    expect(loadPlaylists()).toEqual([p]);
  });

  it('savePlaylist replaces an existing playlist with same id in place', () => {
    savePlaylist(makePlaylist({ id: 'a-1111', title: 'One' }));
    savePlaylist(makePlaylist({ id: 'b-2222', title: 'Two' }));
    savePlaylist(makePlaylist({ id: 'a-1111', title: 'One v2' }));
    const all = loadPlaylists();
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('One v2'); // replaced in original position
    expect(all[1].title).toBe('Two');
  });

  it('getPlaylist returns the matching playlist or undefined', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    expect(getPlaylist('a-1111')?.id).toBe('a-1111');
    expect(getPlaylist('missing')).toBeUndefined();
  });

  it('deletePlaylist removes only the matching playlist', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    savePlaylist(makePlaylist({ id: 'b-2222' }));
    deletePlaylist('a-1111');
    const all = loadPlaylists();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('b-2222');
  });

  it('deletePlaylist on unknown id is a no-op', () => {
    savePlaylist(makePlaylist({ id: 'a-1111' }));
    deletePlaylist('nope');
    expect(loadPlaylists()).toHaveLength(1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상 실패: `loadPlaylists is not a function` 등 신규 export 미존재로 실패.

- [ ] **Step: 최소 구현** — `storage.ts` 에 플레이리스트 함수 추가. (더미 `void (null as unknown as Playlist);` 줄은 이제 함수가 타입을 사용하므로 제거한다.)

`storage.ts` 의 `void (null as unknown as Playlist);` 줄을 다음으로 교체:

```ts
export function loadPlaylists(): Playlist[] {
  const data = readJson<Playlist[]>(PLAYLISTS_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function getPlaylist(id: string): Playlist | undefined {
  return loadPlaylists().find((p) => p.id === id);
}

export function savePlaylist(p: Playlist): void {
  const all = loadPlaylists();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    all[idx] = p;
  } else {
    all.push(p);
  }
  writeJson(PLAYLISTS_KEY, all);
}

export function deletePlaylist(id: string): void {
  const all = loadPlaylists().filter((p) => p.id !== id);
  writeJson(PLAYLISTS_KEY, all);
}
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상: `Tests  13 passed` (이전 6 + 신규 7).

- [ ] **Step: 커밋**

```
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "feat: add playlist load/get/save/delete to storage"
```

---

### Task: makeSlug (한글·공백 처리 + 주입형 rand 접미사)

`makeSlug(title, rand?)` 는 제목을 URL-safe slug 로 변환하고 충돌 회피용 짧은 임의 접미사를 붙인다. `rand` 주입으로 결정론적 테스트가 가능하다. 한글(가-힣)·영숫자는 유지, 공백은 `-`, 그 외 기호는 제거한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`

**Interfaces:**
- Produces: `export function makeSlug(title: string, rand?: () => string): string`
  - `rand` 미주입 시 기본은 4자 영숫자 랜덤 접미사. 주입 시 `rand()` 결과를 그대로 접미사로 사용.

스텝:

- [ ] **Step: 실패하는 테스트 작성** — import 에 `makeSlug` 추가 후 describe 추가.

import 라인에 `makeSlug,` 추가(알파벳 순 위치 무관, 동작 동일):

```ts
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  deletePlaylist,
  getPlaylist,
  getSong,
  loadPlaylists,
  loadSongs,
  makeSlug,
  savePlaylist,
  saveSong,
} from './storage';
```

추가 describe:

```ts
describe('makeSlug', () => {
  const rand = () => 'wxyz';

  it('lowercases ascii and joins words with hyphens, appending rand suffix', () => {
    expect(makeSlug('My Cool Mix', rand)).toBe('my-cool-mix-wxyz');
  });

  it('keeps Korean characters and collapses spaces', () => {
    expect(makeSlug('예진 플레이리스트', rand)).toBe('예진-플레이리스트-wxyz');
  });

  it('strips punctuation and other symbols', () => {
    expect(makeSlug('Hello, World! (2026)', rand)).toBe('hello-world-2026-wxyz');
  });

  it('collapses repeated and trims edge separators', () => {
    expect(makeSlug('  ---night   lounge---  ', rand)).toBe('night-lounge-wxyz');
  });

  it('falls back to "list" stem when nothing usable remains', () => {
    expect(makeSlug('!!!', rand)).toBe('list-wxyz');
    expect(makeSlug('', rand)).toBe('list-wxyz');
  });

  it('default rand produces a 4-char alnum suffix', () => {
    const slug = makeSlug('abc');
    expect(slug).toMatch(/^abc-[a-z0-9]{4}$/);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상 실패: `makeSlug is not a function`.

- [ ] **Step: 최소 구현** — `storage.ts` 끝에 추가.

```ts
function randSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function makeSlug(title: string, rand: () => string = randSuffix): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '') // keep ascii alnum, Hangul, space, hyphen
      .replace(/[\s-]+/g, '-') // collapse spaces/hyphens to single hyphen
      .replace(/^-+|-+$/g, '') || // trim edge hyphens
    'list';
  return `${stem}-${rand()}`;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상: `Tests  19 passed` (이전 13 + 신규 6).

- [ ] **Step: 커밋**

```
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "feat: add makeSlug with injectable rand suffix"
```

---

### Task: createPlaylist (주입형 now/rand 로 결정론적 생성)

`createPlaylist(title, opts?)` 는 `id = makeSlug(title, opts.rand)`, `createdAt = opts.now?.() ?? new Date().toISOString()`, `songIds = []` 인 새 `Playlist` 를 만든다. 저장은 하지 않는다(저장은 호출부가 `savePlaylist` 로 수행). 주입으로 결정론적 테스트가 가능하다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `import type { Playlist } from '../types'`
- Produces: `export function createPlaylist(title: string, opts?: { now?: () => string; rand?: () => string }): Playlist`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — import 에 `createPlaylist` 추가 후 describe 추가.

import 라인에 `createPlaylist,` 추가:

```ts
import {
  PLAYLISTS_KEY,
  SONGS_KEY,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getSong,
  loadPlaylists,
  loadSongs,
  makeSlug,
  savePlaylist,
  saveSong,
} from './storage';
```

추가 describe:

```ts
describe('createPlaylist', () => {
  it('builds a deterministic playlist from injected now/rand', () => {
    const p = createPlaylist('Night Lounge', {
      now: () => '2026-06-20T12:00:00.000Z',
      rand: () => 'abcd',
    });
    expect(p).toEqual({
      id: 'night-lounge-abcd',
      title: 'Night Lounge',
      songIds: [],
      createdAt: '2026-06-20T12:00:00.000Z',
    });
  });

  it('uses current ISO time when now is not injected', () => {
    const before = Date.now();
    const p = createPlaylist('x', { rand: () => 'rrrr' });
    const created = Date.parse(p.createdAt);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(p.id).toBe('x-rrrr');
    expect(p.songIds).toEqual([]);
  });

  it('does not persist by itself (loadPlaylists stays empty)', () => {
    createPlaylist('y', { rand: () => 'zzzz' });
    expect(loadPlaylists()).toEqual([]);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상 실패: `createPlaylist is not a function`.

- [ ] **Step: 최소 구현** — `storage.ts` 끝에 추가.

```ts
export function createPlaylist(
  title: string,
  opts: { now?: () => string; rand?: () => string } = {},
): Playlist {
  return {
    id: makeSlug(title, opts.rand),
    title,
    songIds: [],
    createdAt: opts.now ? opts.now() : new Date().toISOString(),
  };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/storage.test.ts
```

예상: `Tests  22 passed` (이전 19 + 신규 3). 첫 테스트의 `toEqual` 는 `message`/`coverVideoId` 키가 없는 객체와 정확히 일치한다(undefined 키를 두지 않음).

- [ ] **Step: 커밋**

```
git add src/lib/storage.ts src/lib/storage.test.ts && git commit -m "feat: add createPlaylist with injectable now/rand"
```

---

### Task: encodePlaylist (SharedPlaylist → base64url 직렬화)

`encodePlaylist(p)` 는 `SharedPlaylist` 를 JSON 으로 직렬화한 뒤 URL-safe base64url(`+`→`-`, `/`→`_`, `=` 패딩 제거)로 인코딩한다. 비-ASCII(한글) 안전을 위해 `TextEncoder` 로 UTF-8 바이트를 거쳐 `btoa` 한다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/share.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/share.test.ts`

**Interfaces:**
- Consumes: `import type { SharedPlaylist } from '../types'`
- Produces: `export function encodePlaylist(p: SharedPlaylist): string`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — `/Users/kyungsbook/Desktop/playlist/src/lib/share.test.ts` 생성.

```ts
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
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/share.test.ts
```

예상 실패: `Failed to resolve import "./share"` 또는 `encodePlaylist is not a function`.

- [ ] **Step: 최소 구현** — `/Users/kyungsbook/Desktop/playlist/src/lib/share.ts` 생성.

```ts
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
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/share.test.ts
```

예상: `Tests  2 passed`.

- [ ] **Step: 커밋**

```
git add src/lib/share.ts src/lib/share.test.ts && git commit -m "feat: add encodePlaylist base64url encoder"
```

---

### Task: decodePlaylist (base64url → SharedPlaylist, 실패 시 null)

`decodePlaylist(encoded)` 는 `encodePlaylist` 의 역변환이며, base64/JSON 파싱 실패 또는 결과가 `SharedPlaylist` 형태가 아니면(`title` 누락, `songs` 비배열 등) `null` 을 반환한다. `encode→decode` 라운드트립이 동등해야 한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/share.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/share.test.ts`

**Interfaces:**
- Consumes: `import type { SharedPlaylist } from '../types'`
- Produces: `export function decodePlaylist(encoded: string): SharedPlaylist | null`

스텝:

- [ ] **Step: 실패하는 테스트 작성** — import 에 `decodePlaylist` 추가 후 describe 추가.

import 라인 확장:

```ts
import { decodePlaylist, encodePlaylist } from './share';
```

추가 describe:

```ts
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
});
```

- [ ] **Step: 테스트 실행해 실패 확인**

```
npx vitest run src/lib/share.test.ts
```

예상 실패: `decodePlaylist is not a function`.

- [ ] **Step: 최소 구현** — `share.ts` 에 디코더와 형태 검증 추가.

```ts
function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function isSharedPlaylist(v: unknown): v is SharedPlaylist {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== 'string') return false;
  if (o.message !== undefined && typeof o.message !== 'string') return false;
  if (!Array.isArray(o.songs)) return false;
  return o.songs.every((s) => {
    if (typeof s !== 'object' || s === null) return false;
    const so = s as Record<string, unknown>;
    if (typeof so.id !== 'string') return false;
    if (so.title !== undefined && typeof so.title !== 'string') return false;
    return true;
  });
}

export function decodePlaylist(encoded: string): SharedPlaylist | null {
  if (!encoded) return null;
  try {
    const bytes = base64UrlToBytes(encoded);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return isSharedPlaylist(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step: 테스트 실행해 통과 확인**

```
npx vitest run src/lib/share.test.ts
```

예상: `Tests  8 passed` (이전 2 + 신규 6). `'!!!not base64!!!'` 입력은 `atob` 가 던지는 `InvalidCharacterError` 를 catch 하여 `null` 로 처리된다.

- [ ] **Step: 커밋**

```
git add src/lib/share.ts src/lib/share.test.ts && git commit -m "feat: add decodePlaylist with shape validation"
```

---

### Task: 모듈 E 전체 회귀 + 빌드 게이트

storage/share 두 파일의 전체 테스트를 한 번에 돌리고 타입 체크를 통과시켜 모듈 E 를 닫는다.

**Files:**
- Test(run): `/Users/kyungsbook/Desktop/playlist/src/lib/storage.test.ts`, `/Users/kyungsbook/Desktop/playlist/src/lib/share.test.ts`

**Interfaces:**
- Consumes: 위 모든 produces.
- Produces: (없음 — 검증 게이트)

스텝:

- [ ] **Step: 두 테스트 파일 동시 실행해 전체 통과 확인**

```
npx vitest run src/lib/storage.test.ts src/lib/share.test.ts
```

예상: `Test Files  2 passed`, `Tests  30 passed` (storage 22 + share 8).

- [ ] **Step: 타입 체크 통과 확인** (계약 시그니처와 실제 export 일치 검증)

```
npx tsc --noEmit
```

예상: 출력 없이 종료(에러 0). `tsconfig.json` 이 아직 없다면 다른 모듈 그룹이 도입한 설정을 사용하며, storage/share 가 계약 시그니처를 정확히 구현했으므로 본 두 파일 관련 타입 에러는 없어야 한다.

- [ ] **Step: 커밋** (게이트 통과 표시; 변경이 없으면 `--allow-empty`)

```
git commit --allow-empty -m "test: green gate for storage and share modules"
```

---


<!-- ===== MODULE F-ytPlayer-Playback-hooks ===== -->

## 모듈 그룹 F — YouTube 플레이어 래퍼 · 재생 컨텍스트 · 훅

담당 파일:
- `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.ts`
- `/Users/kyungsbook/Desktop/playlist/src/playback/PlaybackContext.tsx`
- `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.ts`
- `/Users/kyungsbook/Desktop/playlist/src/hooks/useLyricSync.ts`

전략 요약: IFrame/브라우저 의존부는 순수 로직(플레이어 옵션 빌더, Song 합성 헬퍼, activeIndex 계산 헬퍼)을 별도 export로 분리해 Vitest로 TDD하고, 나머지(실제 재생/회전/네트워크/rAF)는 @testing-library/react 스모크 테스트 1개 + 구체 수동 검증 체크리스트로 마무리한다. 모든 분기 핵심(다음/이전 곡)은 계약의 `queue.ts`(`nextIndex`/`prevIndex`)를 재사용한다.

전제(다른 모듈은 계약대로 존재한다고 가정):
- `src/types.ts`: `Song`, `SongColors`, `SongLyrics`, `LyricLine`, `RepeatMode`, `LyricsType`.
- `src/lib/queue.ts`: `nextIndex`, `prevIndex`.
- `src/lib/youtube.ts`: `parseTitleHeuristic`, `thumbnailUrl`, `THUMB_FALLBACK`, `ParsedTitle`.
- `src/lib/lrc.ts`: `parseLrc`, `findActiveIndex`, `ParsedLrc`.
- `src/lib/time.ts`: `estimateTime`, `TimeSample`.
- `src/lib/lrclib.ts`: `fetchLyrics`, `LrclibResponse`, `FetchLyricsParams`.
- `src/lib/colors.ts`: `extractPalette`, `buildSongColors`, `FALLBACK_COLORS`, `RawPalette`.
- `src/lib/storage.ts`: `saveSong`.

---

### Task: ytPlayer.ts — YT_STATE 상수와 플레이어 옵션 빌더(순수) TDD

브라우저/IFrame 의존이 없는 두 가지부터 만든다: (1) `YT_STATE` 상수, (2) `createYtPlayer`가 내부적으로 사용할 IFrame 플레이어 옵션 객체를 만드는 순수 헬퍼 `buildPlayerVars`. 옵션 빌더를 분리하면 `playsinline/controls/rel/modestbranding/origin` 규칙을 단위테스트할 수 있다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `export const YT_STATE = { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 } as const;`
  - `export interface YtPlayerVars { playsinline: 1; controls: 0; rel: 0; modestbranding: 1; origin: string; }`
  - `export function buildPlayerVars(origin: string): YtPlayerVars;`

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/lib/ytPlayer.test.ts
import { describe, it, expect } from 'vitest';
import { YT_STATE, buildPlayerVars } from './ytPlayer';

describe('YT_STATE', () => {
  it('exposes the YouTube IFrame player state codes', () => {
    expect(YT_STATE).toEqual({
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    });
  });
});

describe('buildPlayerVars', () => {
  it('enforces inline, no-controls, no-related, modest branding and origin', () => {
    const vars = buildPlayerVars('https://example.github.io');
    expect(vars).toEqual({
      playsinline: 1,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      origin: 'https://example.github.io',
    });
  });

  it('passes the given origin through verbatim', () => {
    expect(buildPlayerVars('http://localhost:5173').origin).toBe('http://localhost:5173');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/ytPlayer.test.ts`
  - 예상 실패: `Failed to resolve import "./ytPlayer"` 또는 `buildPlayerVars is not a function` (파일/함수 미존재).

- [ ] **Step: 최소 구현** (파일 시작 — 순수 부분만 우선)

```ts
// src/lib/ytPlayer.ts
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YtPlayerVars {
  playsinline: 1;
  controls: 0;
  rel: 0;
  modestbranding: 1;
  origin: string;
}

export function buildPlayerVars(origin: string): YtPlayerVars {
  return {
    playsinline: 1,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    origin,
  };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/ytPlayer.test.ts`
  - 예상: `Test Files 1 passed`, `Tests 3 passed`.

- [ ] **Step: 커밋**
  - `git add src/lib/ytPlayer.ts src/lib/ytPlayer.test.ts && git commit -m "feat: add YT_STATE and pure buildPlayerVars helper for yt player"`

---

### Task: ytPlayer.ts — IFrame API 스크립트 1회 로더(순수) TDD

IFrame API `<script src="https://www.youtube.com/iframe_api">`를 문서당 1번만 주입하는 멱등 로더 `ensureIframeApi`를 분리한다. `document`와 콜백 등록 함수를 주입형으로 받아 jsdom에서 테스트 가능하게 만든다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.iframeapi.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `export const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';`
  - `export function ensureIframeApiScript(doc?: Document): boolean;` // 이미 있으면 false, 새로 삽입하면 true

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/lib/ytPlayer.iframeapi.test.ts
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
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/lib/ytPlayer.iframeapi.test.ts`
  - 예상 실패: `ensureIframeApiScript is not a function` / `IFRAME_API_SRC` undefined.

- [ ] **Step: 최소 구현** (ytPlayer.ts 상단 export 추가)

```ts
// src/lib/ytPlayer.ts 에 추가 (YT_STATE 아래)
export const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

export function ensureIframeApiScript(doc: Document = document): boolean {
  const existing = doc.querySelector(`script[src="${IFRAME_API_SRC}"]`);
  if (existing) return false;
  const tag = doc.createElement('script');
  tag.src = IFRAME_API_SRC;
  const first = doc.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(tag, first);
  } else {
    doc.head.appendChild(tag);
  }
  return true;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/lib/ytPlayer.iframeapi.test.ts`
  - 예상: `Tests 2 passed`.

- [ ] **Step: 커밋**
  - `git add src/lib/ytPlayer.ts src/lib/ytPlayer.iframeapi.test.ts && git commit -m "feat: idempotent YouTube IFrame API script loader"`

---

### Task: ytPlayer.ts — createYtPlayer/YtPlayer 래퍼 완성(수동 검증)

남은 브라우저 의존부(`createYtPlayer`, `YtPlayer`/`YtPlayerEvents` 타입)를 완성한다. 실제 IFrame API는 단위테스트가 어려우므로 위에서 만든 순수 헬퍼들을 재사용하고, 동작은 수동 검증 체크리스트로 확인한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/lib/ytPlayer.ts`

**Interfaces:**
- Consumes: `buildPlayerVars`, `ensureIframeApiScript` (자기 파일 내부)
- Produces:
  - `export interface YtPlayer { loadVideoById(id: string): void; cueVideoById(id: string): void; playVideo(): void; pauseVideo(): void; seekTo(sec: number): void; getCurrentTime(): number; getDuration(): number; getVideoData(): { video_id: string; title: string; author: string }; getPlayerState(): number; destroy(): void; }`
  - `export interface YtPlayerEvents { onReady?(): void; onStateChange?(state: number): void; }`
  - `export function createYtPlayer(elementId: string, events: YtPlayerEvents): Promise<YtPlayer>;`

스텝:

- [ ] **Step: 타입 + createYtPlayer 구현** (코드 작성 — 테스트 불가 영역이므로 TDD 사이클 대신 직접 구현)

```ts
// src/lib/ytPlayer.ts 에 추가 (파일 하단)

export interface YtPlayer {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string; author: string };
  getPlayerState(): number;
  destroy(): void;
}

export interface YtPlayerEvents {
  onReady?(): void;
  onStateChange?(state: number): void;
}

// minimal ambient typing for the global YT namespace + ready callback
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
          };
        },
      ) => YtPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function whenApiReady(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    ensureIframeApiScript(document);
  });
  return apiReady;
}

export async function createYtPlayer(
  elementId: string,
  events: YtPlayerEvents,
): Promise<YtPlayer> {
  await whenApiReady();
  return new Promise<YtPlayer>((resolve) => {
    const player = new window.YT!.Player(elementId, {
      playerVars: buildPlayerVars(window.location.origin) as unknown as Record<string, unknown>,
      events: {
        onReady: () => {
          events.onReady?.();
          resolve(player);
        },
        onStateChange: (e) => events.onStateChange?.(e.data),
      },
    });
  });
}
```

- [ ] **Step: 타입체크/빌드 확인**
  - 명령: `npx tsc --noEmit`
  - 예상: ytPlayer.ts 관련 타입 에러 0 (다른 미구현 모듈 에러는 무시 가능 — 본 파일만 검토).

- [ ] **Step: 수동 검증** (실제 브라우저, `npm run dev` 후)
  - [ ] `index.html` 또는 임시 페이지에 `<div id="yt-test"></div>` 두고 `createYtPlayer('yt-test', { onReady: () => console.log('ready'), onStateChange: (s) => console.log('state', s) })` 호출 → 콘솔에 `ready` 1회.
  - [ ] Network 탭에서 `iframe_api` 스크립트가 **딱 1번만** 로드되는지 확인(다른 컴포넌트가 또 호출해도 중복 없음).
  - [ ] `player.cueVideoById('<11자 ID>')` 후 `player.playVideo()` → 오디오 재생, 콘솔 상태값 `1`(PLAYING).
  - [ ] iframe 요소의 src에 `playsinline=1`, `controls=0`, `rel=0`, `modestbranding=1`, `origin=` 쿼리가 들어있는지 확인(요소 검사).
  - [ ] `player.getVideoData()`가 `{ video_id, title, author }` 채워서 반환.
  - [ ] `player.getDuration()`이 0보다 큰 수 반환.

- [ ] **Step: 커밋**
  - `git add src/lib/ytPlayer.ts && git commit -m "feat: createYtPlayer IFrame wrapper with single-load API and locked player vars"`

---

### Task: useLyricSync.ts — activeIndex 계산 순수 헬퍼 TDD

훅의 핵심 계산(보간된 시각 → 활성 가사 인덱스)을 순수 함수 `computeActiveIndex`로 분리한다. 이것이 `estimateTime` + `findActiveIndex` 조합 + `offsetMs` 적용을 한 번에 검증 가능하게 한다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/hooks/useLyricSync.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useLyricSync.compute.test.ts`

**Interfaces:**
- Consumes:
  - `import { estimateTime, TimeSample } from '../lib/time';`
  - `import { findActiveIndex } from '../lib/lrc';`
  - `import type { LyricLine } from '../types';`
- Produces:
  - `export function computeActiveIndex(sample: TimeSample, now: number, playing: boolean, lines: LyricLine[], offsetMs: number): number;`

설명: `estimateTime(sample, now, playing)`로 현재 재생초 추정 → `offsetMs/1000`을 더해 보정 → `findActiveIndex(lines, t)` 반환. (offsetMs 양수면 가사를 앞당김 효과는 구현 정책상 "추정시각에 offset초를 더해 비교"로 통일.)

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/hooks/useLyricSync.compute.test.ts
import { describe, it, expect } from 'vitest';
import { computeActiveIndex } from './useLyricSync';
import type { LyricLine } from '../types';

const lines: LyricLine[] = [
  { time: 0, text: 'a' },
  { time: 5, text: 'b' },
  { time: 10, text: 'c' },
];

describe('computeActiveIndex', () => {
  it('returns -1 before the first line when playing', () => {
    // sample.time=0 at=1000; now=1000 → t=0 → findActiveIndex returns 0 (time<=0)
    const idx = computeActiveIndex({ time: 0, at: 1000 }, 1000, true, lines, 0);
    expect(idx).toBe(0);
  });

  it('interpolates elapsed time while playing', () => {
    // sample.time=4 at=1000; now=2000 → +1s → t=5 → index 1
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 2000, true, lines, 0);
    expect(idx).toBe(1);
  });

  it('does not interpolate when paused', () => {
    // paused → t = sample.time = 4 → index 0 (time<=4 last is line 0)
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 9999, false, lines, 0);
    expect(idx).toBe(0);
  });

  it('applies positive offsetMs by shifting compared time forward', () => {
    // sample.time=4 paused, offset +1000ms → t=5 → index 1
    const idx = computeActiveIndex({ time: 4, at: 1000 }, 0, false, lines, 1000);
    expect(idx).toBe(1);
  });

  it('returns -1 for empty lines', () => {
    const idx = computeActiveIndex({ time: 99, at: 0 }, 0, true, [], 0);
    expect(idx).toBe(-1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useLyricSync.compute.test.ts`
  - 예상 실패: `Failed to resolve import "./useLyricSync"` 또는 `computeActiveIndex is not a function`.

- [ ] **Step: 최소 구현** (파일 시작 — 순수 헬퍼만 우선)

```ts
// src/hooks/useLyricSync.ts
import { estimateTime, type TimeSample } from '../lib/time';
import { findActiveIndex } from '../lib/lrc';
import type { LyricLine } from '../types';

export function computeActiveIndex(
  sample: TimeSample,
  now: number,
  playing: boolean,
  lines: LyricLine[],
  offsetMs: number,
): number {
  if (lines.length === 0) return -1;
  const t = estimateTime(sample, now, playing) + offsetMs / 1000;
  return findActiveIndex(lines, t);
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useLyricSync.compute.test.ts`
  - 예상: `Tests 5 passed`.

- [ ] **Step: 커밋**
  - `git add src/hooks/useLyricSync.ts src/hooks/useLyricSync.compute.test.ts && git commit -m "feat: computeActiveIndex pure helper for lyric sync"`

---

### Task: useLyricSync.ts — rAF 루프 훅 본체 + renderHook 테스트

계약의 `useLyricSync(getCurrentTime, isPlaying, lines, offsetMs)` 훅을 구현한다. rAF 루프에서 250ms마다 `getCurrentTime`를 샘플링하고 매 프레임 `computeActiveIndex`로 보간, 인덱스 변경 시에만 setState, `isPlaying=false`면 루프 정지. `requestAnimationFrame`/`performance.now`를 fake로 갈아끼워 renderHook으로 검증한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/hooks/useLyricSync.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useLyricSync.test.ts`

**Interfaces:**
- Consumes: `computeActiveIndex` (자기 파일), `React` (`useState`/`useEffect`/`useRef`)
- Produces:
  - `export function useLyricSync(getCurrentTime: () => number, isPlaying: boolean, lines: LyricLine[], offsetMs: number): number;`

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/hooks/useLyricSync.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLyricSync } from './useLyricSync';
import type { LyricLine } from '../types';

const lines: LyricLine[] = [
  { time: 0, text: 'a' },
  { time: 5, text: 'b' },
  { time: 10, text: 'c' },
];

let rafCbs: FrameRequestCallback[] = [];
let nowMs = 0;

function flushFrame(advanceMs: number) {
  nowMs += advanceMs;
  const cbs = rafCbs;
  rafCbs = [];
  act(() => {
    cbs.forEach((cb) => cb(nowMs));
  });
}

beforeEach(() => {
  rafCbs = [];
  nowMs = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCbs.push(cb);
    return rafCbs.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLyricSync', () => {
  it('updates activeIndex as playback time advances while playing', () => {
    let t = 0;
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, true, lines, 0));

    // first frame: t=0 → index 0
    flushFrame(16);
    expect(result.current).toBe(0);

    // advance playback to 5s, drive frames
    t = 5;
    flushFrame(16);
    flushFrame(16);
    expect(result.current).toBe(1);

    t = 10;
    flushFrame(16);
    flushFrame(16);
    expect(result.current).toBe(2);
  });

  it('stops the loop and does not advance when not playing', () => {
    let t = 0;
    const getCurrentTime = () => t;
    const { result } = renderHook(() => useLyricSync(getCurrentTime, false, lines, 0));
    // no frames are scheduled while paused
    expect(rafCbs.length).toBe(0);
    t = 10;
    expect(result.current).toBe(-1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useLyricSync.test.ts`
  - 예상 실패: `useLyricSync is not a function` (아직 헬퍼만 있고 훅 미구현).

- [ ] **Step: 최소 구현** (useLyricSync.ts에 훅 본체 추가)

```ts
// src/hooks/useLyricSync.ts 상단 import 교체/추가
import { useEffect, useRef, useState } from 'react';
import { estimateTime, type TimeSample } from '../lib/time';
import { findActiveIndex } from '../lib/lrc';
import type { LyricLine } from '../types';

// computeActiveIndex 는 그대로 유지

const SAMPLE_INTERVAL_MS = 250;

export function useLyricSync(
  getCurrentTime: () => number,
  isPlaying: boolean,
  lines: LyricLine[],
  offsetMs: number,
): number {
  const [activeIndex, setActiveIndex] = useState(-1);
  const sampleRef = useRef<TimeSample>({ time: 0, at: 0 });
  const lastSampledAtRef = useRef(0);
  const indexRef = useRef(-1);

  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    // prime an immediate sample so the first frame is accurate
    sampleRef.current = { time: getCurrentTime(), at: performance.now() };
    lastSampledAtRef.current = sampleRef.current.at;

    const tick = (now: number) => {
      if (now - lastSampledAtRef.current >= SAMPLE_INTERVAL_MS) {
        sampleRef.current = { time: getCurrentTime(), at: now };
        lastSampledAtRef.current = now;
      }
      const t = estimateTime(sampleRef.current, now, true) + offsetMs / 1000;
      const next = lines.length === 0 ? -1 : findActiveIndex(lines, t);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setActiveIndex(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentTime, isPlaying, lines, offsetMs]);

  return activeIndex;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useLyricSync.test.ts`
  - 예상: `Tests 2 passed`. (compute 테스트도 깨지지 않았는지 함께: `npx vitest run src/hooks/useLyricSync.compute.test.ts` → 5 passed.)

- [ ] **Step: 수동 검증** (실제 곡 재생 시)
  - [ ] synced 가사 곡 재생 → 현재 줄 흰색 강조가 음과 어긋남 없이 250ms 이내 갱신.
  - [ ] 일시정지하면 가사 줄이 멈추고, 재생 재개 시 정확한 줄로 복귀.
  - [ ] `offsetMs`를 +500/-500으로 바꿨을 때 가사가 그만큼 앞/뒤로 이동.

- [ ] **Step: 커밋**
  - `git add src/hooks/useLyricSync.ts src/hooks/useLyricSync.test.ts && git commit -m "feat: useLyricSync rAF loop hook with 250ms sampling"`

---

### Task: useSongResolver.ts — SongLyrics 빌더 순수 헬퍼 TDD

resolve 파이프라인 중 "LRCLIB 응답 → `SongLyrics`" 변환을 순수 함수 `buildSongLyrics`로 분리한다. synced 우선, 없으면 plain, 둘 다 없으면 none. synced는 `parseLrc`로 라인/offset을 만든다.

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.lyrics.test.ts`

**Interfaces:**
- Consumes:
  - `import { parseLrc } from '../lib/lrc';`
  - `import type { LrclibResponse } from '../lib/lrclib';`
  - `import type { SongLyrics } from '../types';`
- Produces:
  - `export function buildSongLyrics(res: LrclibResponse | null): SongLyrics;`

설명:
- `res.syncedLyrics` 있으면 → `parseLrc`로 `{lines, offsetMs}` 얻어 `{ type:'synced', synced: lines, source:'lrclib', offsetMs }`.
- 없고 `res.plainLyrics` 있으면 → `{ type:'plain', plain, source:'lrclib', offsetMs:0 }`.
- `res`가 null이거나 둘 다 없으면 → `{ type:'none', source:'none', offsetMs:0 }`.

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/hooks/useSongResolver.lyrics.test.ts
import { describe, it, expect } from 'vitest';
import { buildSongLyrics } from './useSongResolver';

describe('buildSongLyrics', () => {
  it('builds synced lyrics from syncedLyrics via parseLrc', () => {
    const res = {
      syncedLyrics: '[offset:+500]\n[00:01.00]hello\n[00:03.50]world',
      plainLyrics: 'hello\nworld',
    };
    const out = buildSongLyrics(res);
    expect(out.type).toBe('synced');
    expect(out.source).toBe('lrclib');
    expect(out.synced).toBeDefined();
    expect(out.synced!.length).toBe(2);
    expect(out.synced![0]).toEqual({ time: 1, text: 'hello' });
    expect(out.synced![1]).toEqual({ time: 3.5, text: 'world' });
    expect(out.offsetMs).toBe(500);
  });

  it('falls back to plain lyrics when no synced lyrics', () => {
    const out = buildSongLyrics({ syncedLyrics: null, plainLyrics: 'just text' });
    expect(out.type).toBe('plain');
    expect(out.plain).toBe('just text');
    expect(out.source).toBe('lrclib');
    expect(out.offsetMs).toBe(0);
  });

  it('returns none when response is null', () => {
    const out = buildSongLyrics(null);
    expect(out.type).toBe('none');
    expect(out.source).toBe('none');
    expect(out.offsetMs).toBe(0);
  });

  it('returns none when both fields are empty', () => {
    const out = buildSongLyrics({ syncedLyrics: null, plainLyrics: null });
    expect(out.type).toBe('none');
    expect(out.source).toBe('none');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.lyrics.test.ts`
  - 예상 실패: `Failed to resolve import "./useSongResolver"` 또는 `buildSongLyrics is not a function`.

- [ ] **Step: 최소 구현** (파일 시작 — 순수 헬퍼만 우선)

```ts
// src/hooks/useSongResolver.ts
import { parseLrc } from '../lib/lrc';
import type { LrclibResponse } from '../lib/lrclib';
import type { SongLyrics } from '../types';

export function buildSongLyrics(res: LrclibResponse | null): SongLyrics {
  if (res && res.syncedLyrics) {
    const { lines, offsetMs } = parseLrc(res.syncedLyrics);
    return { type: 'synced', synced: lines, source: 'lrclib', offsetMs };
  }
  if (res && res.plainLyrics) {
    return { type: 'plain', plain: res.plainLyrics, source: 'lrclib', offsetMs: 0 };
  }
  return { type: 'none', source: 'none', offsetMs: 0 };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.lyrics.test.ts`
  - 예상: `Tests 4 passed`.

- [ ] **Step: 커밋**
  - `git add src/hooks/useSongResolver.ts src/hooks/useSongResolver.lyrics.test.ts && git commit -m "feat: buildSongLyrics pure helper mapping LRCLIB response to SongLyrics"`

---

### Task: useSongResolver.ts — Song 합성 순수 헬퍼 TDD (의존성 주입형)

resolve 파이프라인의 합성 코어를 의존성 주입형 순수 함수 `assembleSong`로 만든다. 메타(videoId/getVideoData/getDuration), 색(`SongColors`), 가사(`SongLyrics`), 커버 URL, 시간 함수를 인자로 받아 완성된 `Song`을 만든다. 이렇게 하면 IFrame/network 없이 합성 로직을 단위테스트할 수 있다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.assemble.test.ts`

**Interfaces:**
- Consumes:
  - `import { parseTitleHeuristic } from '../lib/youtube';`
  - `import type { Song, SongColors, SongLyrics } from '../types';`
- Produces:
  - `export interface AssembleSongInput { videoId: string; rawTitle: string; author: string; durationSec: number; cover: string; colors: SongColors; lyrics: SongLyrics; now?: () => string; }`
  - `export function assembleSong(input: AssembleSongInput): Song;`

설명: `parseTitleHeuristic(rawTitle, author)`로 `{artist, title}` 산출 → `Song` 조립. `id=videoId`, `resolvedAt = now?.() ?? new Date().toISOString()`.

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/hooks/useSongResolver.assemble.test.ts
import { describe, it, expect } from 'vitest';
import { assembleSong } from './useSongResolver';
import type { SongColors, SongLyrics } from '../types';

const colors: SongColors = { gradientFrom: '#101820', gradientTo: '#05080c', accent: '#7c5cff' };
const lyrics: SongLyrics = { type: 'none', source: 'none', offsetMs: 0 };

describe('assembleSong', () => {
  it('assembles a Song using parseTitleHeuristic and injected now', () => {
    const song = assembleSong({
      videoId: 'abc12345678',
      rawTitle: 'IU - Through the Night (Official MV)',
      author: 'IU Official',
      durationSec: 215,
      cover: 'https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg',
      colors,
      lyrics,
      now: () => '2026-06-20T00:00:00.000Z',
    });
    expect(song.id).toBe('abc12345678');
    // heuristic splits "Artist - Title (...)" → artist=IU, title=Through the Night
    expect(song.artist).toBe('IU');
    expect(song.title).toBe('Through the Night');
    expect(song.durationSec).toBe(215);
    expect(song.cover).toBe('https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg');
    expect(song.colors).toEqual(colors);
    expect(song.lyrics).toEqual(lyrics);
    expect(song.resolvedAt).toBe('2026-06-20T00:00:00.000Z');
  });

  it('falls back to ISO now when no now() injected', () => {
    const song = assembleSong({
      videoId: 'xyz98765432',
      rawTitle: 'some random clip',
      author: 'Some Channel',
      durationSec: 100,
      cover: 'c',
      colors,
      lyrics,
    });
    // no " - " → artist = author, title = cleaned rawTitle
    expect(song.artist).toBe('Some Channel');
    expect(song.title).toBe('some random clip');
    expect(typeof song.resolvedAt).toBe('string');
    expect(song.resolvedAt.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.assemble.test.ts`
  - 예상 실패: `assembleSong is not a function`.

- [ ] **Step: 최소 구현** (useSongResolver.ts에 추가)

```ts
// src/hooks/useSongResolver.ts 상단 import 추가
import { parseTitleHeuristic } from '../lib/youtube';
import type { Song, SongColors, SongLyrics } from '../types';
// (parseLrc / LrclibResponse import 는 기존 유지)

export interface AssembleSongInput {
  videoId: string;
  rawTitle: string;
  author: string;
  durationSec: number;
  cover: string;
  colors: SongColors;
  lyrics: SongLyrics;
  now?: () => string;
}

export function assembleSong(input: AssembleSongInput): Song {
  const { artist, title } = parseTitleHeuristic(input.rawTitle, input.author);
  return {
    id: input.videoId,
    title,
    artist,
    durationSec: input.durationSec,
    cover: input.cover,
    colors: input.colors,
    lyrics: input.lyrics,
    resolvedAt: input.now?.() ?? new Date().toISOString(),
  };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.assemble.test.ts`
  - 예상: `Tests 2 passed`.

- [ ] **Step: 커밋**
  - `git add src/hooks/useSongResolver.ts src/hooks/useSongResolver.assemble.test.ts && git commit -m "feat: assembleSong pure helper to compose Song from resolved parts"`

---

### Task: useSongResolver.ts — resolveSongWith 주입형 오케스트레이터 TDD

전체 resolve 흐름(cue → 메타 → 커버 폴백 → 색추출/폴백 → 가사 fetch → 합성 → 저장)을 **모든 외부 의존을 주입받는** 순수 오케스트레이터 `resolveSongWith`로 만들어 모킹 테스트한다. 훅 본체는 다음 태스크에서 이 함수에 실제 의존을 묶어 호출한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.resolve.test.ts`

**Interfaces:**
- Consumes:
  - `import { thumbnailUrl } from '../lib/youtube';`
  - `import { buildSongColors, FALLBACK_COLORS, type RawPalette } from '../lib/colors';`
  - `import type { LrclibResponse } from '../lib/lrclib';`
  - `import type { Song } from '../types';`
- Produces:
  - `export interface ResolveDeps { getMeta(videoId: string): Promise<{ video_id: string; title: string; author: string; durationSec: number }>; extractPalette(coverUrl: string): Promise<RawPalette>; fetchLyrics(p: { artist: string; track: string; durationSec: number }): Promise<LrclibResponse | null>; saveSong(song: Song): void; now?: () => string; }`
  - `export async function resolveSongWith(videoId: string, deps: ResolveDeps): Promise<Song>;`

설명 (흐름):
1. `getMeta(videoId)` → `{ title, author, durationSec }`.
2. 커버 URL = `thumbnailUrl(videoId)` (기본 maxresdefault).
3. 색: `extractPalette(coverUrl)` 성공 → `buildSongColors(palette)`, 실패(throw) → `FALLBACK_COLORS`.
4. 제목/아티스트는 `assembleSong` 내부 `parseTitleHeuristic`에 맡기되, 가사 fetch용 artist/track은 먼저 `parseTitleHeuristic`로 산출(아래 구현에서 재사용).
5. 가사: `fetchLyrics({ artist, track, durationSec })` → `buildSongLyrics`.
6. `assembleSong(...)` → `saveSong(song)` → 반환.

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/hooks/useSongResolver.resolve.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveSongWith, type ResolveDeps } from './useSongResolver';
import type { RawPalette } from '../lib/colors';

function makeDeps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    getMeta: vi.fn(async () => ({
      video_id: 'abc12345678',
      title: 'IU - Through the Night (Official MV)',
      author: 'IU Official',
      durationSec: 215,
    })),
    extractPalette: vi.fn(async (): Promise<RawPalette> => ({
      vibrant: '#7c5cff',
      darkVibrant: '#2a1f55',
      muted: '#445566',
    })),
    fetchLyrics: vi.fn(async () => ({
      syncedLyrics: '[00:01.00]hello\n[00:03.50]world',
      plainLyrics: 'hello\nworld',
    })),
    saveSong: vi.fn(),
    now: () => '2026-06-20T00:00:00.000Z',
    ...over,
  };
}

describe('resolveSongWith', () => {
  it('resolves a full Song through the pipeline and saves it', async () => {
    const deps = makeDeps();
    const song = await resolveSongWith('abc12345678', deps);

    expect(deps.getMeta).toHaveBeenCalledWith('abc12345678');
    // cover URL is the maxres thumbnail for the id
    expect(song.cover).toContain('abc12345678');
    expect(song.id).toBe('abc12345678');
    expect(song.artist).toBe('IU');
    expect(song.title).toBe('Through the Night');
    expect(song.durationSec).toBe(215);
    expect(song.lyrics.type).toBe('synced');
    expect(song.lyrics.synced!.length).toBe(2);
    // colors came from buildSongColors (accent should reflect vibrant family, non-fallback)
    expect(song.colors.accent).toBeTruthy();
    // fetchLyrics called with parsed artist/track + duration
    expect(deps.fetchLyrics).toHaveBeenCalledWith({
      artist: 'IU',
      track: 'Through the Night',
      durationSec: 215,
    });
    expect(deps.saveSong).toHaveBeenCalledTimes(1);
    expect((deps.saveSong as any).mock.calls[0][0].id).toBe('abc12345678');
  });

  it('falls back to FALLBACK_COLORS when palette extraction throws', async () => {
    const { FALLBACK_COLORS } = await import('../lib/colors');
    const deps = makeDeps({
      extractPalette: vi.fn(async () => {
        throw new Error('CORS taint');
      }),
    });
    const song = await resolveSongWith('abc12345678', deps);
    expect(song.colors).toEqual(FALLBACK_COLORS);
  });

  it('produces lyrics type none when fetchLyrics returns null', async () => {
    const deps = makeDeps({ fetchLyrics: vi.fn(async () => null) });
    const song = await resolveSongWith('abc12345678', deps);
    expect(song.lyrics.type).toBe('none');
    expect(song.lyrics.source).toBe('none');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.resolve.test.ts`
  - 예상 실패: `resolveSongWith is not a function`.

- [ ] **Step: 최소 구현** (useSongResolver.ts에 추가)

```ts
// src/hooks/useSongResolver.ts 상단 import 보강
import { parseTitleHeuristic, thumbnailUrl } from '../lib/youtube';
import { buildSongColors, FALLBACK_COLORS, type RawPalette } from '../lib/colors';
import type { LrclibResponse } from '../lib/lrclib';
import type { Song, SongColors } from '../types';
// (parseLrc, SongLyrics, assembleSong, buildSongLyrics 는 기존 유지)

export interface ResolveDeps {
  getMeta(videoId: string): Promise<{
    video_id: string;
    title: string;
    author: string;
    durationSec: number;
  }>;
  extractPalette(coverUrl: string): Promise<RawPalette>;
  fetchLyrics(p: { artist: string; track: string; durationSec: number }): Promise<LrclibResponse | null>;
  saveSong(song: Song): void;
  now?: () => string;
}

export async function resolveSongWith(videoId: string, deps: ResolveDeps): Promise<Song> {
  const meta = await deps.getMeta(videoId);
  const cover = thumbnailUrl(videoId);

  let colors: SongColors;
  try {
    const palette = await deps.extractPalette(cover);
    colors = buildSongColors(palette);
  } catch {
    colors = FALLBACK_COLORS;
  }

  const { artist, title } = parseTitleHeuristic(meta.title, meta.author);
  const lrc = await deps.fetchLyrics({ artist, track: title, durationSec: meta.durationSec });
  const lyrics = buildSongLyrics(lrc);

  const song = assembleSong({
    videoId,
    rawTitle: meta.title,
    author: meta.author,
    durationSec: meta.durationSec,
    cover,
    colors,
    lyrics,
    now: deps.now,
  });
  deps.saveSong(song);
  return song;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.resolve.test.ts`
  - 예상: `Tests 3 passed`.

- [ ] **Step: 커밋**
  - `git add src/hooks/useSongResolver.ts src/hooks/useSongResolver.resolve.test.ts && git commit -m "feat: resolveSongWith DI orchestrator for song resolution pipeline"`

---

### Task: useSongResolver.ts — useSongResolver 훅 본체 (프로브 플레이어 결선, 수동 검증)

계약의 `useSongResolver(): SongResolver` 훅을 구현한다. 메인 재생과 분리된 프로브 `YtPlayer` 1개를 생성해 `cueVideoById` 후 메타를 읽고, 실제 의존(`extractPalette`/`fetchLyrics`/`saveSong`)을 `resolveSongWith`에 묶어 호출한다. 네트워크/IFrame 의존이라 스모크 1개 + 수동 검증으로 마무리.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/useSongResolver.hook.test.tsx`

**Interfaces:**
- Consumes:
  - `import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';`
  - `import { extractPalette } from '../lib/colors';`
  - `import { fetchLyrics } from '../lib/lrclib';`
  - `import { saveSong } from '../lib/storage';`
  - `import type { Song } from '../types';`
- Produces:
  - `export interface SongResolver { resolve(videoId: string): Promise<Song>; resolving: boolean; }`
  - `export function useSongResolver(): SongResolver;`

설명: 프로브 플레이어는 lazy하게(첫 resolve 시) `createYtPlayer('yejin-probe', ...)`로 만들고 ref에 캐시. `getMeta`는 cue 완료를 기다린 뒤 `getVideoData()`/`getDuration()`을 읽어 반환. `resolving`은 resolve 시작/종료에 따라 토글. 색추출은 실제 `extractPalette` 사용(throw 시 `resolveSongWith`가 FALLBACK 처리). 스모크 테스트는 훅이 마운트되고 초기 `resolving=false`인지 + `resolve`가 함수인지만 검증한다.

스텝:

- [ ] **Step: 실패하는 스모크 테스트 작성**

```tsx
// src/hooks/useSongResolver.hook.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// prevent the real IFrame API/createYtPlayer from running in jsdom
vi.mock('../lib/ytPlayer', () => ({
  YT_STATE: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  createYtPlayer: vi.fn(),
}));
vi.mock('../lib/colors', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, extractPalette: vi.fn(async () => ({ vibrant: '#7c5cff' })) };
});
vi.mock('../lib/lrclib', () => ({ fetchLyrics: vi.fn(async () => null) }));
vi.mock('../lib/storage', () => ({ saveSong: vi.fn() }));

import { useSongResolver } from './useSongResolver';

describe('useSongResolver (smoke)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mounts and exposes resolve + resolving=false', () => {
    const { result } = renderHook(() => useSongResolver());
    expect(typeof result.current.resolve).toBe('function');
    expect(result.current.resolving).toBe(false);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.hook.test.tsx`
  - 예상 실패: `useSongResolver is not a function` (아직 훅 미구현).

- [ ] **Step: 최소 구현** (useSongResolver.ts에 훅 추가)

```ts
// src/hooks/useSongResolver.ts 상단 import 보강
import { useCallback, useRef, useState } from 'react';
import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';
import { extractPalette } from '../lib/colors';
import { fetchLyrics } from '../lib/lrclib';
import { saveSong } from '../lib/storage';
// (resolveSongWith, Song 등 기존 유지)

export interface SongResolver {
  resolve(videoId: string): Promise<Song>;
  resolving: boolean;
}

const PROBE_ELEMENT_ID = 'yejin-probe';

export function useSongResolver(): SongResolver {
  const [resolving, setResolving] = useState(false);
  const probeRef = useRef<YtPlayer | null>(null);

  const ensureProbe = useCallback(async (): Promise<YtPlayer> => {
    if (probeRef.current) return probeRef.current;
    // ensure a hidden mount node exists for the probe iframe
    if (!document.getElementById(PROBE_ELEMENT_ID)) {
      const el = document.createElement('div');
      el.id = PROBE_ELEMENT_ID;
      el.style.position = 'absolute';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.left = '-9999px';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
    }
    const player = await createYtPlayer(PROBE_ELEMENT_ID, {});
    probeRef.current = player;
    return player;
  }, []);

  const getMeta = useCallback(
    async (videoId: string) => {
      const probe = await ensureProbe();
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        // poll until metadata is populated after cue
        probe.cueVideoById(videoId);
        const start = Date.now();
        const poll = () => {
          const data = probe.getVideoData();
          const dur = probe.getDuration();
          const state = probe.getPlayerState();
          if ((data && data.video_id && dur > 0) || state === YT_STATE.CUED || Date.now() - start > 8000) {
            finish();
          } else {
            setTimeout(poll, 100);
          }
        };
        poll();
      });
      const data = probe.getVideoData();
      return {
        video_id: data.video_id || videoId,
        title: data.title || '',
        author: data.author || '',
        durationSec: probe.getDuration() || 0,
      };
    },
    [ensureProbe],
  );

  const resolve = useCallback(
    async (videoId: string): Promise<Song> => {
      setResolving(true);
      try {
        return await resolveSongWith(videoId, {
          getMeta,
          extractPalette: (coverUrl) => extractPalette(coverUrl),
          fetchLyrics: ({ artist, track, durationSec }) =>
            fetchLyrics({ artist, track, durationSec }),
          saveSong,
        });
      } finally {
        setResolving(false);
      }
    },
    [getMeta],
  );

  return { resolve, resolving };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/hooks/useSongResolver.hook.test.tsx`
  - 예상: `Tests 1 passed`.

- [ ] **Step: 수동 검증** (실제 브라우저, 편집기 화면에서)
  - [ ] 편집기에서 YouTube 링크 붙여넣기 → 곡 프리뷰 카드에 커버/제목/아티스트가 채워짐(프로브 플레이어는 화면 밖, 소리/화면 안 보임).
  - [ ] 곡 추가 중에도 **메인 재생은 끊기지 않음**(프로브가 메인 플레이어와 분리됨 확인).
  - [ ] synced 가사 있는 곡은 "싱크가사" 배지, 없는 곡은 "가사 없음" 배지.
  - [ ] CORS로 색추출 실패하는 썸네일이라도 FALLBACK 색으로 카드/배경 정상.
  - [ ] localStorage `yejin.songs.v1`에 곡이 저장됨(개발자도구 Application 탭).

- [ ] **Step: 커밋**
  - `git add src/hooks/useSongResolver.ts src/hooks/useSongResolver.hook.test.tsx && git commit -m "feat: useSongResolver hook wiring probe player to resolve pipeline"`

---

### Task: PlaybackContext.tsx — repeat 상태 머신 순수 헬퍼 TDD

PlaybackProvider가 쓸 반복 모드 순환을 순수 함수 `cycleRepeatMode`로 분리한다. 끄기→전체→한곡→끄기 순환. (계약의 `cycleRepeat`/`setRepeat`이 이 헬퍼와 useState를 사용.)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/playback/PlaybackContext.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/playback/repeat.test.ts`

**Interfaces:**
- Consumes: `import type { RepeatMode } from '../types';`
- Produces:
  - `export function cycleRepeatMode(r: RepeatMode): RepeatMode;` // 'off'→'all'→'one'→'off'

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/playback/repeat.test.ts
import { describe, it, expect } from 'vitest';
import { cycleRepeatMode } from './PlaybackContext';

describe('cycleRepeatMode', () => {
  it('cycles off -> all -> one -> off', () => {
    expect(cycleRepeatMode('off')).toBe('all');
    expect(cycleRepeatMode('all')).toBe('one');
    expect(cycleRepeatMode('one')).toBe('off');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/playback/repeat.test.ts`
  - 예상 실패: `Failed to resolve import "./PlaybackContext"` 또는 `cycleRepeatMode is not a function`.

- [ ] **Step: 최소 구현** (파일 시작 — 순수 헬퍼만 우선)

```tsx
// src/playback/PlaybackContext.tsx
import type { RepeatMode } from '../types';

export function cycleRepeatMode(r: RepeatMode): RepeatMode {
  if (r === 'off') return 'all';
  if (r === 'all') return 'one';
  return 'off';
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/playback/repeat.test.ts`
  - 예상: `Tests 1 passed`.

- [ ] **Step: 커밋**
  - `git add src/playback/PlaybackContext.tsx src/playback/repeat.test.ts && git commit -m "feat: cycleRepeatMode pure helper for playback repeat state"`

---

### Task: PlaybackContext.tsx — ENDED 분기 순수 헬퍼 TDD (queue.ts 재사용)

곡 종료(ENDED) 시 다음 동작을 결정하는 순수 함수 `endedAction`을 만든다. 계약의 `queue.nextIndex`를 재사용해 분기: 한곡 반복→같은 곡 재생(replay), 전체 반복→루프, 끄기→다음곡 또는 정지. 이로써 가장 까다로운 재생 모드 분기를 IFrame 없이 단위테스트한다.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/playback/PlaybackContext.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/playback/ended.test.ts`

**Interfaces:**
- Consumes:
  - `import { nextIndex } from '../lib/queue';`
  - `import type { RepeatMode } from '../types';`
- Produces:
  - `export type EndedAction = { kind: 'replay' } | { kind: 'play'; index: number } | { kind: 'stop' };`
  - `export function endedAction(current: number, length: number, repeat: RepeatMode): EndedAction;`

설명:
- `repeat==='one'` → `{ kind:'replay' }` (같은 곡 seek0+play).
- 그 외 → `nextIndex(current, length, repeat)` 호출:
  - 결과가 `number` → `{ kind:'play', index }`.
  - 결과가 `null` (off에서 마지막) → `{ kind:'stop' }`.

스텝:

- [ ] **Step: 실패하는 테스트 작성**

```ts
// src/playback/ended.test.ts
import { describe, it, expect } from 'vitest';
import { endedAction } from './PlaybackContext';

describe('endedAction', () => {
  it('one-repeat replays the same song', () => {
    expect(endedAction(2, 5, 'one')).toEqual({ kind: 'replay' });
  });

  it('all-repeat advances and loops back to first at the end', () => {
    expect(endedAction(1, 3, 'all')).toEqual({ kind: 'play', index: 2 });
    expect(endedAction(2, 3, 'all')).toEqual({ kind: 'play', index: 0 });
  });

  it('off advances until the last song then stops', () => {
    expect(endedAction(0, 3, 'off')).toEqual({ kind: 'play', index: 1 });
    expect(endedAction(2, 3, 'off')).toEqual({ kind: 'stop' });
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/playback/ended.test.ts`
  - 예상 실패: `endedAction is not a function`.

- [ ] **Step: 최소 구현** (PlaybackContext.tsx에 추가)

```tsx
// src/playback/PlaybackContext.tsx 상단 import 추가
import { nextIndex } from '../lib/queue';
// (cycleRepeatMode 는 기존 유지)

export type EndedAction =
  | { kind: 'replay' }
  | { kind: 'play'; index: number }
  | { kind: 'stop' };

export function endedAction(
  current: number,
  length: number,
  repeat: RepeatMode,
): EndedAction {
  if (repeat === 'one') return { kind: 'replay' };
  const idx = nextIndex(current, length, repeat);
  if (idx === null) return { kind: 'stop' };
  return { kind: 'play', index: idx };
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/playback/ended.test.ts`
  - 예상: `Tests 3 passed`.

- [ ] **Step: 커밋**
  - `git add src/playback/PlaybackContext.tsx src/playback/ended.test.ts && git commit -m "feat: endedAction pure branch helper reusing queue.nextIndex"`

---

### Task: PlaybackContext.tsx — PlaybackProvider/usePlayback 본체 + renderHook 스모크 TDD

계약의 `PlaybackApi`/`PlaybackProvider`/`usePlayback`을 구현한다. 숨김 `div#yt-player` 1개를 렌더해 라우트 전환에도 재생이 유지되게 하고, 메인 `YtPlayer`를 lazy 생성한다. ENDED는 `endedAction`, prev/next는 `prevIndex`/`nextIndex` 재사용. 250ms마다 progress 샘플링. `getCurrentTime`는 라이브 플레이어 패스스루. renderHook으로 테스트 가능한 상태 머신부(`cycleRepeat`/`setRepeat`/초기값)를 검증하고, 실제 재생은 수동 검증.

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/playback/PlaybackContext.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/playback/PlaybackContext.test.tsx`

**Interfaces:**
- Consumes:
  - `import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';`
  - `import { nextIndex, prevIndex } from '../lib/queue';`
  - `import { endedAction, cycleRepeatMode } from './PlaybackContext';` (자기 파일 내부 함수 재사용)
  - `import type { Song, RepeatMode } from '../types';`
- Produces:
  - `export interface PlaybackApi { queue: Song[]; currentIndex: number; current: Song | null; isPlaying: boolean; repeat: RepeatMode; progress: number; duration: number; started: boolean; playQueue(songs: Song[], startIndex?: number): void; togglePlay(): void; next(): void; prev(): void; seek(sec: number): void; cycleRepeat(): void; setRepeat(r: RepeatMode): void; getCurrentTime(): number; }`
  - `export function PlaybackProvider(props: { children: React.ReactNode }): JSX.Element;`
  - `export function usePlayback(): PlaybackApi;`

설명/구현 메모:
- `createYtPlayer`는 jsdom에서 동작하지 않으므로 테스트는 해당 모듈을 mock 처리. 플레이어가 아직 없을 때 컨트롤은 no-op이 되도록 ref null 가드.
- `playQueue(songs, startIndex=0)`: queue/currentIndex/started 갱신 후 플레이어 있으면 `loadVideoById(songs[startIndex].id)`.
- `next()` = `nextIndex(currentIndex, queue.length, repeat)` 결과로 인덱스 이동(off 마지막이면 정지), `prev()` = `prevIndex(...)`.
- onStateChange: PLAYING→isPlaying true, PAUSED/BUFFERING→false, ENDED→`endedAction`으로 분기(replay=seekTo(0)+play, play=loadVideoById, stop=정지).
- progress: PLAYING 동안 250ms interval로 `getCurrentTime()`/`getDuration()` 샘플.
- `getCurrentTime()`: 플레이어 있으면 `player.getCurrentTime()`, 없으면 0.

스텝:

- [ ] **Step: 실패하는 스모크 테스트 작성**

```tsx
// src/playback/PlaybackContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// createYtPlayer cannot run in jsdom → never resolves (player stays null), controls are safe no-ops
vi.mock('../lib/ytPlayer', () => ({
  YT_STATE: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  createYtPlayer: vi.fn(() => new Promise(() => {})),
}));

import { PlaybackProvider, usePlayback } from './PlaybackContext';
import type { Song } from '../types';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(PlaybackProvider, null, children);

function song(id: string): Song {
  return {
    id,
    title: id,
    artist: 'a',
    durationSec: 100,
    cover: 'c',
    colors: { gradientFrom: '#101820', gradientTo: '#05080c', accent: '#7c5cff' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
  };
}

beforeEach(() => vi.clearAllMocks());

describe('usePlayback state machine (smoke)', () => {
  it('starts with empty queue and off repeat', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.queue).toEqual([]);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.current).toBeNull();
    expect(result.current.repeat).toBe('off');
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.started).toBe(false);
  });

  it('cycleRepeat cycles off -> all -> one -> off', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('all');
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('one');
    act(() => result.current.cycleRepeat());
    expect(result.current.repeat).toBe('off');
  });

  it('setRepeat sets an explicit mode', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.setRepeat('one'));
    expect(result.current.repeat).toBe('one');
  });

  it('playQueue populates queue/current and marks started', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 1));
    expect(result.current.queue.map((s) => s.id)).toEqual(['a1', 'b2', 'c3']);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.current?.id).toBe('b2');
    expect(result.current.started).toBe(true);
  });

  it('next/prev move the current index respecting bounds (off)', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    act(() => result.current.playQueue([song('a1'), song('b2'), song('c3')], 0));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(1);
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(0);
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(0); // clamped at 0 when off
  });

  it('getCurrentTime returns 0 when no live player', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.getCurrentTime()).toBe(0);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인**
  - 명령: `npx vitest run src/playback/PlaybackContext.test.tsx`
  - 예상 실패: `usePlayback is not a function` 또는 `PlaybackProvider is not a function`.

- [ ] **Step: 최소 구현** (PlaybackContext.tsx에 Provider/hook/Context 추가)

```tsx
// src/playback/PlaybackContext.tsx 상단 import 보강
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createYtPlayer, YT_STATE, type YtPlayer } from '../lib/ytPlayer';
import { nextIndex, prevIndex } from '../lib/queue';
import type { Song, RepeatMode } from '../types';
// (cycleRepeatMode, endedAction 는 기존 export 유지)

export interface PlaybackApi {
  queue: Song[];
  currentIndex: number;
  current: Song | null;
  isPlaying: boolean;
  repeat: RepeatMode;
  progress: number;
  duration: number;
  started: boolean;
  playQueue(songs: Song[], startIndex?: number): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  cycleRepeat(): void;
  setRepeat(r: RepeatMode): void;
  getCurrentTime(): number;
}

const PLAYER_ELEMENT_ID = 'yt-player';
const PlaybackContext = createContext<PlaybackApi | null>(null);

export function PlaybackProvider(props: { children: React.ReactNode }): JSX.Element {
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);

  const playerRef = useRef<YtPlayer | null>(null);
  // refs mirror state for use inside the (stable) onStateChange callback
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  const goTo = useCallback((index: number) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    indexRef.current = index;
    setCurrentIndex(index);
    playerRef.current?.loadVideoById(q[index].id);
  }, []);

  // create the single hidden player once
  useEffect(() => {
    let alive = true;
    createYtPlayer(PLAYER_ELEMENT_ID, {
      onStateChange: (state) => {
        if (state === YT_STATE.PLAYING) setIsPlaying(true);
        else if (state === YT_STATE.PAUSED || state === YT_STATE.BUFFERING) setIsPlaying(false);
        else if (state === YT_STATE.ENDED) {
          const action = endedAction(indexRef.current, queueRef.current.length, repeatRef.current);
          if (action.kind === 'replay') {
            playerRef.current?.seekTo(0);
            playerRef.current?.playVideo();
          } else if (action.kind === 'play') {
            goTo(action.index);
          } else {
            setIsPlaying(false);
          }
        }
      },
    })
      .then((p) => {
        if (alive) playerRef.current = p;
        else p.destroy();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [goTo]);

  // 250ms progress sampling while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setProgress(p.getCurrentTime());
      setDuration(p.getDuration());
    }, 250);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const playQueue = useCallback((songs: Song[], startIndex = 0) => {
    setQueue(songs);
    queueRef.current = songs;
    setCurrentIndex(startIndex);
    indexRef.current = startIndex;
    setStarted(true);
    const target = songs[startIndex];
    if (target) playerRef.current?.loadVideoById(target.id);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo();
    else p.playVideo();
  }, []);

  const next = useCallback(() => {
    const idx = nextIndex(indexRef.current, queueRef.current.length, repeatRef.current);
    if (idx === null) {
      setIsPlaying(false);
      playerRef.current?.pauseVideo();
      return;
    }
    goTo(idx);
  }, [goTo]);

  const prev = useCallback(() => {
    goTo(prevIndex(indexRef.current, queueRef.current.length, repeatRef.current));
  }, [goTo]);

  const seek = useCallback((sec: number) => {
    playerRef.current?.seekTo(sec);
    setProgress(sec);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatState((r) => cycleRepeatMode(r));
  }, []);

  const setRepeat = useCallback((r: RepeatMode) => setRepeatState(r), []);

  const getCurrentTime = useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []);

  const current = queue[currentIndex] ?? null;

  const api = useMemo<PlaybackApi>(
    () => ({
      queue,
      currentIndex,
      current,
      isPlaying,
      repeat,
      progress,
      duration,
      started,
      playQueue,
      togglePlay,
      next,
      prev,
      seek,
      cycleRepeat,
      setRepeat,
      getCurrentTime,
    }),
    [
      queue, currentIndex, current, isPlaying, repeat, progress, duration, started,
      playQueue, togglePlay, next, prev, seek, cycleRepeat, setRepeat, getCurrentTime,
    ],
  );

  return (
    <PlaybackContext.Provider value={api}>
      <div
        id={PLAYER_ELEMENT_ID}
        style={{ position: 'absolute', width: 1, height: 1, left: -9999, pointerEvents: 'none' }}
        aria-hidden="true"
      />
      {props.children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackApi {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider');
  return ctx;
}
```

- [ ] **Step: 테스트 실행해 통과 확인**
  - 명령: `npx vitest run src/playback/PlaybackContext.test.tsx`
  - 예상: `Tests 6 passed`. (repeat/ended 헬퍼 테스트도 회귀 없는지: `npx vitest run src/playback` → 전체 passed.)

- [ ] **Step: 수동 검증** (실제 브라우저)
  - [ ] 플레이리스트 재생 → 곡이 끝나면 다음 곡으로 자동 전환(배경색 크로스페이드는 GradientBg 담당이지만 곡 전환 자체가 일어남).
  - [ ] 반복 토글 한곡(🔂): 곡 끝나면 같은 곡 다시 처음부터.
  - [ ] 반복 토글 전체(🔁): 마지막 곡 끝 → 첫 곡으로 루프.
  - [ ] 반복 끄기: 마지막 곡 끝 → 정지(▶ 노출), 진행 멈춤.
  - [ ] 편집기(#/edit/:id)로 이동했다가 플레이어(#/p/:id)로 돌아와도 **재생이 끊기지 않음**(숨김 `div#yt-player`가 Provider에 1개만 존재).
  - [ ] 진행바가 250ms 주기로 갱신, seek 시 그 위치로 점프.
  - [ ] DOM에 `#yt-player`가 정확히 1개만 존재(개발자도구 Elements에서 검색).

- [ ] **Step: 커밋**
  - `git add src/playback/PlaybackContext.tsx src/playback/PlaybackContext.test.tsx && git commit -m "feat: PlaybackProvider with single hidden player, repeat modes, ENDED branching"`

---


<!-- ===== MODULE G-components ===== -->

## Module G: src/components/ (시각 컴포넌트 8종)

> 공통 전제
> - 스택: Vite + React 18 + TS + Tailwind. 테스트: Vitest + @testing-library/react + jsdom.
> - 각 컴포넌트는 **default export**. 계약(props)을 글자 그대로 사용한다.
> - jsdom 미지원 API(`Element.animate`/WAAPI, `matchMedia`, `navigator.share`, canvas 실측, QR 실측)는 호출부를 가드(옵셔널 체이닝/try)하고, 시각·애니메이션·공유 동작은 "수동 검증" 체크리스트로 확인한다.
> - 테스트 셋업이 없다면 첫 태스크(LpDisc)에서 `src/test/setup.ts`(jest-dom matcher) + `vitest.config.ts` jsdom 설정을 함께 만든다. 이후 태스크는 이를 재사용한다.

---

### Task: 테스트 환경 부트스트랩 + LpDisc (커버+LP 맞물림, WAAPI 회전)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/vitest.config.ts`
- Create: `/Users/kyungsbook/Desktop/playlist/src/test/setup.ts`
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/LpDisc.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/LpDisc.test.tsx`

**Interfaces:**
- Consumes: 없음(순수 props). 시각 토큰은 inline-style/Tailwind로 자체 구성.
- Produces: `LpDisc(props: { cover: string; spinning: boolean; accent: string }): JSX.Element` (default export)

설계 명세 반영: 커버(정사각)와 LP(원형)는 같은 지름, LP를 커버 위로 약 42% 슬라이드 오버랩. LP는 `repeating-radial-gradient` 그루브 + 중앙 커버 라벨(지름 32%) + `conic-gradient` 광택 띠. 회전은 WAAPI(`element.animate`)로 1회전 ≈ 5s `linear`, `spinning` 토글 시 `playbackRate` 0↔1을 0.8s ease로 보간(관성). `prefers-reduced-motion: reduce`면 회전 정지(색만 유지). jsdom은 `element.animate`/`matchMedia`를 지원하지 않으므로 호출을 가드한다.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/LpDisc.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LpDisc from './LpDisc';

describe('LpDisc', () => {
  it('renders the cover image (both label and sleeve) with the given src', () => {
    render(<LpDisc cover="https://i.ytimg.com/vi/abc/maxresdefault.jpg" spinning={false} accent="#ff0066" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    expect(imgs[0]).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc/maxresdefault.jpg');
  });

  it('exposes a data-spinning attribute reflecting the spinning prop', () => {
    const { rerender, container } = render(
      <LpDisc cover="c.jpg" spinning={false} accent="#fff" />
    );
    expect(container.querySelector('[data-testid="lp-vinyl"]')).toHaveAttribute('data-spinning', 'false');
    rerender(<LpDisc cover="c.jpg" spinning={true} accent="#fff" />);
    expect(container.querySelector('[data-testid="lp-vinyl"]')).toHaveAttribute('data-spinning', 'true');
  });

  it('applies the accent color to the glow ring style', () => {
    const { container } = render(<LpDisc cover="c.jpg" spinning accent="#12ab34" />);
    const glow = container.querySelector('[data-testid="lp-glow"]') as HTMLElement;
    expect(glow).toBeTruthy();
    expect(glow.style.cssText.toLowerCase()).toContain('#12ab34');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/LpDisc.test.tsx`
  예상 실패: `Failed to resolve import "./LpDisc"` 또는 `Cannot find module './LpDisc'` (구현/설정 부재). 설정 누락 시 `jsdom` environment 에러도 가능.

- [ ] **Step: 최소 구현 — Vitest 설정 + 셋업 파일**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step: 최소 구현 — LpDisc 컴포넌트**

```tsx
// src/components/LpDisc.tsx
import { useEffect, useRef } from 'react';

interface LpDiscProps {
  cover: string;
  spinning: boolean;
  accent: string;
}

const SPIN_DURATION_MS = 5000;
const RATE_RAMP_MS = 800;

export default function LpDisc({ cover, spinning, accent }: LpDiscProps) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  // prefers-reduced-motion guard (jsdom-safe)
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const el = vinylRef.current;
    if (!el || typeof el.animate !== 'function') return; // jsdom: no WAAPI
    if (reduced) return;
    if (!animRef.current) {
      animRef.current = el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: SPIN_DURATION_MS, iterations: Infinity, easing: 'linear' }
      );
      animRef.current.playbackRate = 0;
    }
    const anim = animRef.current;
    const target = spinning ? 1 : 0;
    // inertial spin-up/down: interpolate playbackRate with rAF
    const start = performance.now();
    const from = anim.playbackRate;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / RATE_RAMP_MS);
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
      anim.playbackRate = from + (target - from) * eased;
      if (spinning) anim.play();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, reduced]);

  useEffect(() => () => { animRef.current?.cancel(); }, []);

  return (
    <div className="relative w-full max-w-[min(70vmin,520px)] aspect-square mx-auto select-none">
      {/* glow halo behind, tinted by accent */}
      <div
        data-testid="lp-glow"
        className="absolute inset-0 rounded-3xl blur-2xl opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)` }}
      />
      {/* square album cover (sleeve) on the left/under */}
      <div className="absolute left-0 top-0 h-full w-[58%] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
        <img src={cover} alt="album cover" className="h-full w-full object-cover" />
      </div>
      {/* LP vinyl overlapping ~42% to the right */}
      <div
        data-testid="lp-vinyl"
        data-spinning={String(spinning)}
        ref={vinylRef}
        className="absolute top-0 right-0 h-full aspect-square rounded-full shadow-2xl ring-1 ring-black/40"
        style={{
          background: [
            'repeating-radial-gradient(circle at 50% 50%, #0a0a0a 0px, #0a0a0a 1px, #171717 2px, #0a0a0a 3px)',
            'conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.06), rgba(255,255,255,0) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 75%, rgba(255,255,255,0.06) 100%)',
          ].join(','),
          backgroundBlendMode: 'screen',
          willChange: 'transform',
        }}
      >
        {/* center label = cover at 32% diameter */}
        <div className="absolute left-1/2 top-1/2 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden ring-2 ring-black/60">
          <img src={cover} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
        {/* spindle hole */}
        <div className="absolute left-1/2 top-1/2 h-[3%] w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300/80" />
      </div>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/LpDisc.test.tsx`
  예상: `Test Files 1 passed`, 3 tests passed.

- [ ] **Step: 수동 검증** (브라우저 `npm run dev`)
  - [ ] 커버(정사각)와 LP(원형)가 같은 높이로 가로 맞물려 보인다(LP가 커버 위로 약 40% 겹침).
  - [ ] `spinning=true`일 때 LP가 약 5초/회전으로 등속 회전, 시작 시 부드럽게 가속(뚝 끊김 없음).
  - [ ] `spinning=false`로 토글하면 0.8s에 걸쳐 부드럽게 감속해 멈춘다(관성).
  - [ ] LP 중앙 라벨이 커버 이미지로 보이고 그루브 텍스처 + 광택 띠가 보인다.
  - [ ] OS 설정에서 "동작 줄이기" 켜면 회전이 멈춘 채 색/레이아웃만 유지된다.

- [ ] **Step: 커밋** — `git add vitest.config.ts src/test/setup.ts src/components/LpDisc.tsx src/components/LpDisc.test.tsx && git commit -m "feat(components): add LpDisc with WAAPI inertial spin and test setup"`

---

### Task: GradientBg (메시 그라데이션 2레이어 크로스페이드)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/GradientBg.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/GradientBg.test.tsx`

**Interfaces:**
- Consumes: `src/types.ts: SongColors`
- Produces: `GradientBg(props: { colors: SongColors }): JSX.Element` (default export)

설계 명세 반영: 다중 `radial-gradient` 겹친 메시 그라데이션(단색 리니어 금지). 곡 전환 시 CSS 변수 보간이 아니라 **배경 레이어 2장 크로스페이드(1.2s)** — 새 색이 오면 비활성 레이어에 칠하고 opacity 0→1로 페이드, 두 레이어 역할을 toggle. `prefers-reduced-motion`이어도 색 전환은 유지(명세상 색 전환만 유지).

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/GradientBg.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GradientBg from './GradientBg';
import type { SongColors } from '../types';

const A: SongColors = { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' };
const B: SongColors = { gradientFrom: '#300a0a', gradientTo: '#0f0505', accent: '#ff5577' };

describe('GradientBg', () => {
  it('renders two crossfade layers', () => {
    const { container } = render(<GradientBg colors={A} />);
    expect(container.querySelectorAll('[data-testid="gradient-layer"]').length).toBe(2);
  });

  it('paints the active layer with the from/to colors', () => {
    const { container } = render(<GradientBg colors={A} />);
    const layers = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const active = layers.find((l) => l.style.opacity === '1');
    expect(active).toBeTruthy();
    expect(active!.style.backgroundImage.toLowerCase()).toContain('#101030');
    expect(active!.style.backgroundImage.toLowerCase()).toContain('#05050f');
  });

  it('crossfades to the other layer when colors change', () => {
    const { container, rerender } = render(<GradientBg colors={A} />);
    const before = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const activeIdxBefore = before.findIndex((l) => l.style.opacity === '1');

    rerender(<GradientBg colors={B} />);
    const after = Array.from(
      container.querySelectorAll('[data-testid="gradient-layer"]')
    ) as HTMLElement[];
    const activeIdxAfter = after.findIndex((l) => l.style.opacity === '1');

    expect(activeIdxAfter).not.toBe(activeIdxBefore); // role toggled
    expect(after[activeIdxAfter].style.backgroundImage.toLowerCase()).toContain('#300a0a');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/GradientBg.test.tsx`
  예상 실패: `Failed to resolve import "./GradientBg"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/GradientBg.tsx
import { useEffect, useRef, useState } from 'react';
import type { SongColors } from '../types';

interface GradientBgProps {
  colors: SongColors;
}

function meshFor(c: SongColors): string {
  return [
    `radial-gradient(120% 90% at 20% 15%, ${c.gradientFrom} 0%, transparent 55%)`,
    `radial-gradient(110% 80% at 85% 25%, ${c.accent} 0%, transparent 45%)`,
    `radial-gradient(140% 120% at 50% 100%, ${c.gradientTo} 0%, transparent 70%)`,
    `linear-gradient(180deg, ${c.gradientFrom}, ${c.gradientTo})`,
  ].join(',');
}

export default function GradientBg({ colors }: GradientBgProps) {
  // two layers; `front` is which index currently holds the visible color
  const [layers, setLayers] = useState<[SongColors, SongColors]>([colors, colors]);
  const [front, setFront] = useState(0);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const back = front === 0 ? 1 : 0;
    setLayers((prev) => {
      const nxt: [SongColors, SongColors] = [prev[0], prev[1]];
      nxt[back] = colors;
      return nxt;
    });
    setFront(back);
  }, [colors]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black" aria-hidden="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          data-testid="gradient-layer"
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            backgroundImage: meshFor(layers[i]),
            opacity: i === front ? 1 : 0,
            willChange: 'opacity',
          }}
        />
      ))}
      {/* readability darkening + conservative blur veil */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" />
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/GradientBg.test.tsx`
  예상: 3 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, Player 화면)
  - [ ] 배경이 단색 리니어가 아니라 여러 광원이 번진 메시 그라데이션으로 보인다.
  - [ ] 다음 곡으로 넘어갈 때 색이 약 1.2s에 걸쳐 부드럽게 크로스페이드된다(탁한 중간색 없이).
  - [ ] 가사/컨트롤 영역 위로 은은한 어둠막 + 약한 blur가 깔려 흰 가사 가독성이 확보된다.

- [ ] **Step: 커밋** — `git add src/components/GradientBg.tsx src/components/GradientBg.test.tsx && git commit -m "feat(components): add GradientBg with 2-layer mesh crossfade"`

---

### Task: LyricsView (translateY 밀어올림 + 단계적 명도)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/LyricsView.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/LyricsView.test.tsx`

**Interfaces:**
- Consumes: `src/types.ts: SongLyrics, LyricLine, LyricsType`
- Produces: `LyricsView(props: { lyrics: SongLyrics; activeIndex: number }): JSX.Element` (default export)

설계 명세 반영: `type:'synced'`면 현재 줄을 수직 중앙 고정, 컨테이너 전체를 `translateY`로 밀어 올림(개별 줄 아님). 단계 명도 — 현재 1.0(흰색) / ±1 0.55 / ±2 0.28 / 그 외 0.14, 양끝 `mask-image` 페이드, 활성 줄 scale↑. `type:'plain'`이면 정적 스크롤 + "동기화 아님" 배지. `type:'none'`이면 "가사를 찾지 못했어요" + ♪ 펄스. 활성 줄에 `data-active` + 흰색 클래스를 부여해 테스트가 강조를 검증.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/LyricsView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LyricsView from './LyricsView';
import type { SongLyrics } from '../types';

const synced: SongLyrics = {
  type: 'synced',
  source: 'lrclib',
  offsetMs: 0,
  synced: [
    { time: 0, text: 'first line' },
    { time: 5, text: 'second line' },
    { time: 10, text: 'third line' },
  ],
};

describe('LyricsView', () => {
  it('marks the active line and applies the highlight (white) class', () => {
    render(<LyricsView lyrics={synced} activeIndex={1} />);
    const active = screen.getByText('second line');
    expect(active).toHaveAttribute('data-active', 'true');
    expect(active.className).toContain('text-white');
  });

  it('non-active lines are not marked active', () => {
    render(<LyricsView lyrics={synced} activeIndex={1} />);
    expect(screen.getByText('first line')).toHaveAttribute('data-active', 'false');
    expect(screen.getByText('third line')).toHaveAttribute('data-active', 'false');
  });

  it('translates the container up proportional to activeIndex', () => {
    const { container, rerender } = render(<LyricsView lyrics={synced} activeIndex={0} />);
    const track = () =>
      (container.querySelector('[data-testid="lyrics-track"]') as HTMLElement).style.transform;
    const t0 = track();
    rerender(<LyricsView lyrics={synced} activeIndex={2} />);
    const t2 = track();
    expect(t0).not.toBe(t2);
    expect(t2).toMatch(/translateY/);
  });

  it('renders a plain-lyrics fallback with an "out of sync" badge', () => {
    const plain: SongLyrics = { type: 'plain', source: 'lrclib', offsetMs: 0, plain: 'la la la' };
    render(<LyricsView lyrics={plain} activeIndex={-1} />);
    expect(screen.getByText('la la la')).toBeInTheDocument();
    expect(screen.getByTestId('lyrics-badge')).toBeInTheDocument();
  });

  it('renders a "not found" message when there are no lyrics', () => {
    const none: SongLyrics = { type: 'none', source: 'none', offsetMs: 0 };
    render(<LyricsView lyrics={none} activeIndex={-1} />);
    expect(screen.getByTestId('lyrics-none')).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/LyricsView.test.tsx`
  예상 실패: `Failed to resolve import "./LyricsView"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/LyricsView.tsx
import type { SongLyrics } from '../types';

interface LyricsViewProps {
  lyrics: SongLyrics;
  activeIndex: number;
}

const LINE_HEIGHT_EM = 3.2; // approximate per-line block height in em

function opacityForDistance(d: number): number {
  if (d === 0) return 1;
  if (d === 1) return 0.55;
  if (d === 2) return 0.28;
  return 0.14;
}

export default function LyricsView({ lyrics, activeIndex }: LyricsViewProps) {
  if (lyrics.type === 'none' || (lyrics.type === 'synced' && !lyrics.synced?.length)) {
    return (
      <div
        data-testid="lyrics-none"
        className="flex h-full flex-col items-center justify-center gap-4 text-center text-white/60"
      >
        <span className="text-4xl animate-pulse" aria-hidden="true">♪</span>
        <p className="text-sm">가사를 찾지 못했어요</p>
      </div>
    );
  }

  if (lyrics.type === 'plain') {
    return (
      <div className="relative h-full overflow-y-auto px-2 py-8">
        <span
          data-testid="lyrics-badge"
          className="sticky top-0 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur"
        >
          동기화 아님
        </span>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-lg leading-relaxed text-white/80">
          {lyrics.plain ?? ''}
        </pre>
      </div>
    );
  }

  const lines = lyrics.synced ?? [];
  const translateY = -(activeIndex * LINE_HEIGHT_EM);

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
      }}
    >
      <div
        data-testid="lyrics-track"
        className="flex flex-col items-center justify-start transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateY(calc(50% + ${translateY}em))`,
          willChange: 'transform',
        }}
      >
        {lines.map((line, i) => {
          const dist = Math.abs(i - activeIndex);
          const isActive = i === activeIndex;
          return (
            <p
              key={`${line.time}-${i}`}
              data-active={String(isActive)}
              className={
                'flex min-h-[3.2em] items-center px-4 text-center text-2xl transition-all duration-300 ' +
                (isActive
                  ? 'scale-105 font-semibold text-white'
                  : 'text-white')
              }
              style={{ opacity: opacityForDistance(dist) }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/LyricsView.test.tsx`
  예상: 5 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 싱크 가사 있는 곡)
  - [ ] 현재 줄이 화면 수직 중앙에 고정되고 컨테이너가 위로 부드럽게 밀려 올라간다(개별 줄 점프 아님).
  - [ ] 현재 줄 흰색·약간 확대, ±1 회색, ±2 더 어둡게, 그 외 거의 안 보임. 양끝 페이드 마스크 적용.
  - [ ] plain 가사 곡에서 "동기화 아님" 배지 + 정적 스크롤. 가사 없는 곡에서 ♪ 펄스 + "가사를 찾지 못했어요".

- [ ] **Step: 커밋** — `git add src/components/LyricsView.tsx src/components/LyricsView.test.tsx && git commit -m "feat(components): add LyricsView with translateY scroll and staged opacity"`

---

### Task: PlayGate (첫 탭 게이트, 박동 ▶)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/PlayGate.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/PlayGate.test.tsx`

**Interfaces:**
- Consumes: `src/types.ts: SongColors`
- Produces: `PlayGate(props: { cover: string; colors: SongColors; message?: string; onPlay(): void }): JSX.Element` (default export)

설계 명세 반영: 곡 대표색 그라데이션 위 첫 화면, (있으면) 보낸이 메시지 + 중앙에 박동하는 ▶ **버튼 1개**. 탭하면 `onPlay()` 호출(모바일 무음정책 흡수). 박동은 Tailwind `animate-pulse` 류 + accent 글로우.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/PlayGate.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayGate from './PlayGate';
import type { SongColors } from '../types';

const colors: SongColors = { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' };

describe('PlayGate', () => {
  it('calls onPlay when the play button is tapped', async () => {
    const onPlay = vi.fn();
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('renders the sender message when provided', () => {
    render(<PlayGate cover="c.jpg" colors={colors} message="너를 위한 플레이리스트" onPlay={() => {}} />);
    expect(screen.getByText('너를 위한 플레이리스트')).toBeInTheDocument();
  });

  it('does not render a message block when message is absent', () => {
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={() => {}} />);
    expect(screen.queryByTestId('gate-message')).toBeNull();
  });

  it('renders exactly one play button', () => {
    render(<PlayGate cover="c.jpg" colors={colors} onPlay={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/PlayGate.test.tsx`
  예상 실패: `Failed to resolve import "./PlayGate"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/PlayGate.tsx
import type { SongColors } from '../types';

interface PlayGateProps {
  cover: string;
  colors: SongColors;
  message?: string;
  onPlay(): void;
}

export default function PlayGate({ cover, colors, message, onPlay }: PlayGateProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{
        backgroundImage: `radial-gradient(120% 100% at 50% 30%, ${colors.gradientFrom} 0%, ${colors.gradientTo} 80%)`,
      }}
    >
      <div className="h-36 w-36 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
        <img src={cover} alt="album cover" className="h-full w-full object-cover" />
      </div>

      {message ? (
        <p data-testid="gate-message" className="max-w-md text-lg text-white/85">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        aria-label="play"
        onClick={onPlay}
        className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform active:scale-95 motion-safe:animate-pulse"
        style={{ boxShadow: `0 0 48px 4px ${colors.accent}` }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-60"
          style={{ background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)` }}
          aria-hidden="true"
        />
        {/* play triangle */}
        <svg viewBox="0 0 24 24" className="relative ml-1 h-10 w-10 fill-white" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/PlayGate.test.tsx`
  예상: 4 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 공유 링크/플레이어 첫 진입)
  - [ ] 첫 화면이 곡 색 그라데이션으로 차오르고 커버 썸네일 + (있으면)메시지가 보인다.
  - [ ] 중앙 ▶ 버튼이 은은히 박동하며 accent색 글로우가 둘러진다(버튼은 정확히 1개).
  - [ ] 탭하면 게이트가 사라지고 재생이 시작된다(모바일 첫 제스처로 소리가 난다).
  - [ ] "동작 줄이기" 켜면 박동(pulse)이 멈춘다(`motion-safe`).

- [ ] **Step: 커밋** — `git add src/components/PlayGate.tsx src/components/PlayGate.test.tsx && git commit -m "feat(components): add PlayGate first-tap gate with pulsing play button"`

---

### Task: Controls (재생/시크/반복 토글 + formatTime)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/Controls.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/Controls.test.tsx`

**Interfaces:**
- Consumes: `src/types.ts: RepeatMode`
- Produces:
  - `Controls(props: { isPlaying: boolean; repeat: RepeatMode; progress: number; duration: number; onToggle(): void; onNext(): void; onPrev(): void; onSeek(sec: number): void; onCycleRepeat(): void }): JSX.Element` (default export)
  - `formatTime(sec: number): string` (named export, 페이지에서 재사용)

설계 명세 반영: 글래스모피즘 컨트롤, 진행바는 accent색(range input), 재생/일시정지·이전·다음 + **반복 모드 토글(끄기/전체🔁/한곡🔂)**, 현재 모드는 아이콘 강조로 표시. `tabular-nums` 진행시간.

- [ ] **Step: 실패하는 테스트 작성 — formatTime 단위 테스트**

```tsx
// src/components/Controls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Controls, { formatTime } from './Controls';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });
  it('clamps NaN/negative to 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('Controls', () => {
  const base = {
    isPlaying: false,
    repeat: 'off' as const,
    progress: 30,
    duration: 200,
    onToggle: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSeek: vi.fn(),
    onCycleRepeat: vi.fn(),
  };

  it('shows a Play label when paused and Pause label when playing', () => {
    const { rerender } = render(<Controls {...base} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    rerender(<Controls {...base} isPlaying />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('wires toggle, next, prev callbacks', async () => {
    const onToggle = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Controls {...base} onToggle={onToggle} onNext={onNext} onPrev={onPrev} />);
    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('reflects repeat mode via data-mode and aria-pressed', () => {
    const { rerender } = render(<Controls {...base} repeat="off" />);
    const btn = () => screen.getByTestId('repeat-btn');
    expect(btn()).toHaveAttribute('data-mode', 'off');
    expect(btn()).toHaveAttribute('aria-pressed', 'false');
    rerender(<Controls {...base} repeat="all" />);
    expect(btn()).toHaveAttribute('data-mode', 'all');
    expect(btn()).toHaveAttribute('aria-pressed', 'true');
    rerender(<Controls {...base} repeat="one" />);
    expect(btn()).toHaveAttribute('data-mode', 'one');
  });

  it('calls onCycleRepeat when the repeat button is clicked', async () => {
    const onCycleRepeat = vi.fn();
    render(<Controls {...base} onCycleRepeat={onCycleRepeat} />);
    await userEvent.click(screen.getByTestId('repeat-btn'));
    expect(onCycleRepeat).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek with the new value when the progress slider changes', () => {
    const onSeek = vi.fn();
    render(<Controls {...base} onSeek={onSeek} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '120' } });
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('renders current and total time labels', () => {
    render(<Controls {...base} progress={65} duration={185} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('3:05')).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/Controls.test.tsx`
  예상 실패: `Failed to resolve import "./Controls"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/Controls.tsx
import type { RepeatMode } from '../types';

interface ControlsProps {
  isPlaying: boolean;
  repeat: RepeatMode;
  progress: number;
  duration: number;
  onToggle(): void;
  onNext(): void;
  onPrev(): void;
  onSeek(sec: number): void;
  onCycleRepeat(): void;
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === 'all') return 'repeat all';
  if (mode === 'one') return 'repeat one';
  return 'repeat off';
}

function repeatIcon(mode: RepeatMode): string {
  if (mode === 'one') return '🔂';
  return '🔁';
}

export default function Controls({
  isPlaying,
  repeat,
  progress,
  duration,
  onToggle,
  onNext,
  onPrev,
  onSeek,
  onCycleRepeat,
}: ControlsProps) {
  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-white/5 px-5 py-4 backdrop-blur-md ring-1 ring-white/10">
      {/* progress bar */}
      <div className="flex items-center gap-3 text-xs text-white/70" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span>{formatTime(progress)}</span>
        <input
          type="range"
          aria-label="seek"
          min={0}
          max={max}
          step={1}
          value={Math.min(progress, max)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--c3,#7755ff)]"
        />
        <span>{formatTime(duration)}</span>
      </div>

      {/* transport */}
      <div className="flex items-center justify-center gap-6">
        <button type="button" aria-label="prev" onClick={onPrev} className="text-2xl text-white/80 transition hover:text-white active:scale-90">
          ⏮
        </button>

        <button
          type="button"
          aria-label={isPlaying ? 'pause' : 'play'}
          onClick={onToggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition active:scale-95"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-7 w-7 fill-current" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <button type="button" aria-label="next" onClick={onNext} className="text-2xl text-white/80 transition hover:text-white active:scale-90">
          ⏭
        </button>

        <button
          type="button"
          data-testid="repeat-btn"
          data-mode={repeat}
          aria-pressed={repeat !== 'off'}
          aria-label={repeatLabel(repeat)}
          onClick={onCycleRepeat}
          className={
            'ml-2 flex h-10 w-10 items-center justify-center rounded-full text-lg transition ' +
            (repeat === 'off'
              ? 'text-white/40 hover:text-white/70'
              : 'bg-white/15 text-white ring-1 ring-white/30')
          }
        >
          {repeatIcon(repeat)}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/Controls.test.tsx`
  예상: formatTime 2 + Controls 7 = 9 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 플레이어)
  - [ ] 재생/일시정지 토글 시 아이콘이 ▶↔⏸로 바뀐다. 이전/다음 동작.
  - [ ] 진행바 드래그로 시크되고 좌우 시간 라벨이 `tabular-nums`로 흔들림 없이 갱신.
  - [ ] 반복 버튼 클릭마다 끄기→전체🔁→한곡🔂 순환, 활성 모드는 배경 강조 링으로 표시.
  - [ ] 진행바 핸들/채움이 accent(--c3)색으로 보인다.

- [ ] **Step: 커밋** — `git add src/components/Controls.tsx src/components/Controls.test.tsx && git commit -m "feat(components): add Controls with repeat toggle, seek slider, formatTime"`

---

### Task: SongCard (곡 카드 + active 강조)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/SongCard.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/SongCard.test.tsx`

**Interfaces:**
- Consumes: `src/types.ts: Song`
- Produces: `SongCard(props: { song: Song; active?: boolean; onClick?(): void }): JSX.Element` (default export)

설계 명세 반영: 커버·제목·아티스트 + "싱크가사 있음/없음" 배지(graceful). `active`면 강조(ring/accent). 클릭 시 `onClick`. 갤러리/편집기/플레이리스트 목록에서 재사용.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/SongCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SongCard from './SongCard';
import type { Song } from '../types';

function makeSong(over: Partial<Song> = {}): Song {
  return {
    id: 'vid12345678',
    title: 'Test Title',
    artist: 'Test Artist',
    durationSec: 200,
    cover: 'https://i.ytimg.com/vi/vid12345678/maxresdefault.jpg',
    colors: { gradientFrom: '#101030', gradientTo: '#05050f', accent: '#7755ff' },
    lyrics: { type: 'synced', source: 'lrclib', offsetMs: 0, synced: [{ time: 0, text: 'x' }] },
    resolvedAt: '2026-06-20T00:00:00.000Z',
    ...over,
  };
}

describe('SongCard', () => {
  it('renders title, artist and cover', () => {
    render(<SongCard song={makeSong()} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/vid12345678/maxresdefault.jpg');
  });

  it('shows a synced-lyrics badge when lyrics are synced', () => {
    render(<SongCard song={makeSong({ lyrics: { type: 'synced', source: 'lrclib', offsetMs: 0, synced: [{ time: 0, text: 'x' }] } })} />);
    expect(screen.getByTestId('lyric-badge')).toHaveTextContent(/싱크/);
  });

  it('shows a no-lyrics badge when lyrics are none', () => {
    render(<SongCard song={makeSong({ lyrics: { type: 'none', source: 'none', offsetMs: 0 } })} />);
    expect(screen.getByTestId('lyric-badge')).toHaveTextContent(/없음/);
  });

  it('applies active styling when active is true', () => {
    const { container, rerender } = render(<SongCard song={makeSong()} active={false} />);
    const root = () => container.querySelector('[data-testid="song-card"]') as HTMLElement;
    expect(root()).toHaveAttribute('data-active', 'false');
    rerender(<SongCard song={makeSong()} active />);
    expect(root()).toHaveAttribute('data-active', 'true');
    expect(root().className).toContain('ring-2');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<SongCard song={makeSong()} onClick={onClick} />);
    await userEvent.click(screen.getByTestId('song-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/SongCard.test.tsx`
  예상 실패: `Failed to resolve import "./SongCard"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/SongCard.tsx
import type { Song } from '../types';

interface SongCardProps {
  song: Song;
  active?: boolean;
  onClick?(): void;
}

export default function SongCard({ song, active = false, onClick }: SongCardProps) {
  const synced = song.lyrics.type === 'synced';
  return (
    <button
      type="button"
      data-testid="song-card"
      data-active={String(active)}
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left transition hover:bg-white/10 ' +
        (active ? 'ring-2 ring-[var(--c3,#7755ff)] bg-white/10' : 'ring-1 ring-white/5')
      }
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
        <img src={song.cover} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{song.title}</p>
        <p className="truncate text-xs text-white/60">{song.artist}</p>
      </div>
      <span
        data-testid="lyric-badge"
        className={
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] ' +
          (synced ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/50')
        }
      >
        {synced ? '싱크가사' : '가사 없음'}
      </span>
    </button>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/SongCard.test.tsx`
  예상: 5 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 편집기 곡 목록)
  - [ ] 커버 썸네일·제목·아티스트가 한 줄로 정렬되고 긴 제목은 말줄임된다.
  - [ ] 싱크 가사 있는 곡은 초록 "싱크가사" 배지, 없는 곡은 회색 "가사 없음" 배지.
  - [ ] 현재 재생 곡(active)은 accent 링으로 강조된다. 클릭하면 해당 곡으로 이동/재생.

- [ ] **Step: 커밋** — `git add src/components/SongCard.tsx src/components/SongCard.test.tsx && git commit -m "feat(components): add SongCard with lyric badge and active highlight"`

---

### Task: PasteInput (링크 붙여넣기 → resolve → onAdd)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/PasteInput.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/PasteInput.test.tsx`

**Interfaces:**
- Consumes:
  - `src/hooks/useSongResolver.ts: useSongResolver(): { resolve(videoId: string): Promise<Song>; resolving: boolean }`
  - `src/lib/youtube.ts: parseVideoId(input: string): string | null`
  - `src/types.ts: Song`
- Produces: `PasteInput(props: { onAdd(song: Song): void }): JSX.Element` (default export)

설계 명세 반영: 입력칸에 YouTube 링크 붙여넣기(여러 줄 한 번에 가능) → 각 줄 `parseVideoId` → `resolve(videoId)` → 성공 시 `onAdd(song)`. resolving 중에는 버튼 비활성/로딩 표시. 파싱 실패 줄은 에러 메시지로 표시(graceful). 테스트 독립화를 위해 `useSongResolver`/`parseVideoId`는 `vi.mock`으로 모킹(실제 시그니처는 계약대로 가정).

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/PasteInput.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Song } from '../types';

// --- mocks (real signatures assumed from contract) ---
const resolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: resolveMock, resolving: false }),
}));
vi.mock('../lib/youtube', () => ({
  parseVideoId: (input: string) => {
    const m = input.match(/[\w-]{11}/);
    return m ? m[0] : null;
  },
}));

import PasteInput from './PasteInput';

function makeSong(id: string): Song {
  return {
    id,
    title: 't',
    artist: 'a',
    durationSec: 100,
    cover: 'c.jpg',
    colors: { gradientFrom: '#000', gradientTo: '#111', accent: '#222' },
    lyrics: { type: 'none', source: 'none', offsetMs: 0 },
    resolvedAt: '2026-06-20T00:00:00.000Z',
  };
}

describe('PasteInput', () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it('resolves a pasted link and calls onAdd with the resolved song', async () => {
    resolveMock.mockResolvedValue(makeSong('abcDEF12345'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    await userEvent.type(
      screen.getByRole('textbox'),
      'https://youtu.be/abcDEF12345'
    );
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(resolveMock).toHaveBeenCalledWith('abcDEF12345');
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'abcDEF12345' }));
  });

  it('processes multiple lines, calling onAdd once per valid line', async () => {
    resolveMock
      .mockResolvedValueOnce(makeSong('aaaaaaaaaa1'))
      .mockResolvedValueOnce(makeSong('bbbbbbbbbb2'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    const box = screen.getByRole('textbox');
    await userEvent.click(box);
    // paste two lines (type with newline)
    await userEvent.paste('https://youtu.be/aaaaaaaaaa1\nhttps://youtu.be/bbbbbbbbbb2');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
  });

  it('shows an error for an unparseable line and does not call onAdd', async () => {
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), 'not-a-link');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(screen.getByTestId('paste-error')).toBeInTheDocument());
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows a per-song error when resolve rejects but keeps processing', async () => {
    resolveMock
      .mockRejectedValueOnce(new Error('embed blocked'))
      .mockResolvedValueOnce(makeSong('bbbbbbbbbb2'));
    const onAdd = vi.fn();
    render(<PasteInput onAdd={onAdd} />);
    const box = screen.getByRole('textbox');
    await userEvent.click(box);
    await userEvent.paste('https://youtu.be/aaaaaaaaaa1\nhttps://youtu.be/bbbbbbbbbb2');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('paste-error')).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/PasteInput.test.tsx`
  예상 실패: `Failed to resolve import "./PasteInput"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/PasteInput.tsx
import { useState } from 'react';
import type { Song } from '../types';
import { useSongResolver } from '../hooks/useSongResolver';
import { parseVideoId } from '../lib/youtube';

interface PasteInputProps {
  onAdd(song: Song): void;
}

export default function PasteInput({ onAdd }: PasteInputProps) {
  const { resolve, resolving } = useSongResolver();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleAdd() {
    const lines = value
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    setBusy(true);
    const newErrors: string[] = [];
    let addedAny = false;

    for (const line of lines) {
      const id = parseVideoId(line);
      if (!id) {
        newErrors.push(`링크를 인식하지 못했어요: ${line}`);
        continue;
      }
      try {
        const song = await resolve(id);
        onAdd(song);
        addedAny = true;
      } catch {
        newErrors.push(`재생할 수 없는 영상이에요: ${line}`);
      }
    }

    setErrors(newErrors);
    if (addedAny && newErrors.length === 0) setValue('');
    setBusy(false);
  }

  const disabled = busy || resolving;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="youtube links"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="YouTube 링크를 붙여넣으세요 (여러 줄 가능)"
        className="w-full resize-none rounded-xl bg-white/5 p-3 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-white/30"
      />
      <button
        type="button"
        aria-label="add"
        onClick={handleAdd}
        disabled={disabled}
        className="self-end rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition disabled:opacity-50"
      >
        {disabled ? '추가 중…' : '곡 추가'}
      </button>
      {errors.length > 0 ? (
        <ul data-testid="paste-error" className="space-y-1 text-xs text-rose-300">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/PasteInput.test.tsx`
  예상: 4 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 편집기) — 실제 `useSongResolver` 연결 후
  - [ ] 단일 YouTube 링크 붙여넣고 "곡 추가" → 잠시 후 곡이 목록에 추가되고 현재 재생은 끊기지 않는다.
  - [ ] 여러 줄을 한 번에 붙여넣으면 순서대로 모두 추가된다.
  - [ ] 잘못된 줄/임베드 차단 영상은 빨간 에러로 표시되고 나머지는 정상 추가(graceful).
  - [ ] resolve 진행 중 버튼이 "추가 중…"으로 비활성화된다.

- [ ] **Step: 커밋** — `git add src/components/PasteInput.tsx src/components/PasteInput.test.tsx && git commit -m "feat(components): add PasteInput with multi-line resolve and graceful errors"`

---

### Task: QrShare (qrcode 렌더 + Web Share API)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/components/QrShare.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/components/QrShare.test.tsx`

**Interfaces:**
- Consumes: `qrcode (npm): QRCode.toDataURL(text: string, options?): Promise<string>`
- Produces: `QrShare(props: { url: string }): JSX.Element` (default export)

전제: `npm i qrcode @types/qrcode` 설치(이 태스크 첫 스텝). 설계 명세 반영: 공유 링크를 `qrcode`로 즉석 QR 이미지(dataURL→`<img>`)로 렌더 + Web Share API(`navigator.share`) 버튼. jsdom엔 `navigator.share`가 없으므로 가드(없으면 클립보드 복사 폴백). 테스트에선 `vi.mock('qrcode')`로 모킹.

- [ ] **Step: 의존성 설치** — `npm i qrcode && npm i -D @types/qrcode`
  예상: package.json dependencies에 `qrcode`, devDependencies에 `@types/qrcode` 추가.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/components/QrShare.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toDataURLMock = vi.fn();
vi.mock('qrcode', () => ({
  default: { toDataURL: toDataURLMock },
}));

import QrShare from './QrShare';

describe('QrShare', () => {
  beforeEach(() => {
    toDataURLMock.mockReset();
    toDataURLMock.mockResolvedValue('data:image/png;base64,FAKE');
  });

  it('renders a QR image generated from the url', async () => {
    render(<QrShare url="https://example.com/#/s/abc" />);
    await waitFor(() => {
      expect(toDataURLMock).toHaveBeenCalledWith('https://example.com/#/s/abc', expect.any(Object));
    });
    const img = await screen.findByAltText(/qr/i);
    expect(img).toHaveAttribute('src', 'data:image/png;base64,FAKE');
  });

  it('regenerates the QR when the url changes', async () => {
    const { rerender } = render(<QrShare url="https://a.com/#/s/1" />);
    await waitFor(() => expect(toDataURLMock).toHaveBeenCalledWith('https://a.com/#/s/1', expect.any(Object)));
    rerender(<QrShare url="https://a.com/#/s/2" />);
    await waitFor(() => expect(toDataURLMock).toHaveBeenCalledWith('https://a.com/#/s/2', expect.any(Object)));
  });

  it('calls navigator.share with the url when share is available and clicked', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error jsdom has no navigator.share
    navigator.share = shareSpy;
    render(<QrShare url="https://example.com/#/s/abc" />);
    await userEvent.click(await screen.findByRole('button', { name: /share|공유/i }));
    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/#/s/abc' }));
    // @ts-expect-error cleanup
    delete navigator.share;
  });

  it('falls back to clipboard copy when navigator.share is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<QrShare url="https://example.com/#/s/abc" />);
    await userEvent.click(await screen.findByRole('button', { name: /share|공유|복사/i }));
    expect(writeText).toHaveBeenCalledWith('https://example.com/#/s/abc');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/components/QrShare.test.tsx`
  예상 실패: `Failed to resolve import "./QrShare"`.

- [ ] **Step: 최소 구현**

```tsx
// src/components/QrShare.tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrShareProps {
  url: string;
}

export default function QrShare({ url }: QrShareProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 256, color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then((d) => {
        if (alive) setDataUrl(d);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  async function handleShare() {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    if (canShare) {
      try {
        await navigator.share({ title: 'Yejin Playlist', url });
        return;
      } catch {
        // user cancelled or failed → fall through to copy
      }
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {dataUrl ? (
        <img src={dataUrl} alt="share QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
      ) : (
        <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-white/5 text-xs text-white/40">
          QR 생성 중…
        </div>
      )}
      <button
        type="button"
        aria-label="share"
        onClick={handleShare}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition active:scale-95"
      >
        {copied ? '복사됨!' : '공유하기'}
      </button>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/components/QrShare.test.tsx`
  예상: 4 tests passed.

- [ ] **Step: 수동 검증** (`npm run dev`, 편집기 "공유 QR 만들기")
  - [ ] 공유 링크에 대한 QR 이미지가 즉시 렌더된다. 링크가 바뀌면 QR도 갱신된다.
  - [ ] 모바일에서 "공유하기" → OS 공유 시트(카톡/문자/DM)가 뜨고 링크가 채워진다.
  - [ ] 공유 미지원(데스크톱 일부)에서는 클립보드로 복사되고 "복사됨!" 표시가 잠깐 뜬다.
  - [ ] 스캔한 QR로 링크를 열면 `#/s/...` 공유 보기로 진입해 재생된다.

- [ ] **Step: 커밋** — `git add src/components/QrShare.tsx src/components/QrShare.test.tsx package.json package-lock.json && git commit -m "feat(components): add QrShare with qrcode rendering and Web Share fallback"`

---


<!-- ===== MODULE H-pages-routing ===== -->

## 모듈 그룹 H — 페이지 + 라우팅 (Gallery / Player / Editor / SharedView / App / main / usePlaylists)

> 전제: 다른 모듈(`src/types.ts`, `src/lib/storage.ts`, `src/lib/share.ts`, `src/playback/PlaybackContext.tsx`, `src/hooks/useSongResolver.ts`, `src/hooks/useLyricSync.ts`, `src/components/*`)은 잠긴 계약대로 존재한다. 본 그룹의 단위/스모크 테스트는 이들을 `vi.mock`으로 모킹해 H 단독으로 격리 검증한다. 전체 사용자 흐름은 마지막 "수동 검증(E2E)" 태스크에서 확인한다.

---

### Task: usePlaylists 훅 — storage 래핑 + 상태 (refresh)

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/hooks/usePlaylists.ts`
- Test: `/Users/kyungsbook/Desktop/playlist/src/hooks/usePlaylists.test.tsx`

**Interfaces:**
- Consumes: `src/lib/storage.ts` (`loadPlaylists()`, `createPlaylist(title, opts?)`, `savePlaylist(p)`, `deletePlaylist(id)`), `src/types.ts` (`Playlist`)
- Produces: `export function usePlaylists(): { playlists: Playlist[]; refresh(): void; create(title: string): Playlist; remove(id: string): void }`

- [ ] **Step: 실패하는 테스트 작성** — 초기 마운트 시 `loadPlaylists()` 결과를 노출하고 `refresh()`가 재조회하는지 검증.

```tsx
// src/hooks/usePlaylists.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Playlist } from '../types';

vi.mock('../lib/storage', () => ({
  loadPlaylists: vi.fn(),
  createPlaylist: vi.fn(),
  savePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
}));

import * as storage from '../lib/storage';
import { usePlaylists } from './usePlaylists';

const mk = (id: string): Playlist => ({
  id, title: 't-' + id, songIds: [], createdAt: '2026-06-20T00:00:00.000Z',
});

describe('usePlaylists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes playlists from storage on mount', () => {
    (storage.loadPlaylists as any).mockReturnValue([mk('a'), mk('b')]);
    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('refresh re-reads storage', () => {
    (storage.loadPlaylists as any).mockReturnValueOnce([mk('a')]).mockReturnValue([mk('a'), mk('c')]);
    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists).toHaveLength(1);
    act(() => result.current.refresh());
    expect(result.current.playlists.map(p => p.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/hooks/usePlaylists.test.tsx`. 예상 실패: `Failed to resolve import "./usePlaylists"` 또는 `usePlaylists is not a function`.

- [ ] **Step: 최소 구현** — `loadPlaylists`를 state 초기값으로 쓰고 `refresh`로 재조회.

```ts
// src/hooks/usePlaylists.ts
import { useCallback, useState } from 'react';
import type { Playlist } from '../types';
import { loadPlaylists, createPlaylist, savePlaylist, deletePlaylist } from '../lib/storage';

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());

  const refresh = useCallback(() => {
    setPlaylists(loadPlaylists());
  }, []);

  const create = useCallback((title: string): Playlist => {
    const p = createPlaylist(title);
    savePlaylist(p);
    setPlaylists(loadPlaylists());
    return p;
  }, []);

  const remove = useCallback((id: string) => {
    deletePlaylist(id);
    setPlaylists(loadPlaylists());
  }, []);

  return { playlists, refresh, create, remove };
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/hooks/usePlaylists.test.tsx`. 예상: 2 passed.

- [ ] **Step: 커밋** — `git add src/hooks/usePlaylists.ts src/hooks/usePlaylists.test.tsx && git commit -m "feat: add usePlaylists hook wrapping storage with refresh state"`

---

### Task: usePlaylists 훅 — create / remove 동작

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/hooks/usePlaylists.test.tsx`
- (구현은 이전 태스크에서 완료됨 — 본 태스크는 create/remove 동작을 추가 검증)

**Interfaces:**
- Consumes: `src/lib/storage.ts` (`createPlaylist`, `savePlaylist`, `deletePlaylist`, `loadPlaylists`)
- Produces: (계약 동일) `create(title): Playlist`, `remove(id): void`

- [ ] **Step: 실패하는 테스트 작성** — `create`가 `createPlaylist`→`savePlaylist`를 호출하고 state를 갱신하며, `remove`가 `deletePlaylist`를 호출하는지 검증. (기존 파일 끝의 `describe` 블록 안에 `it` 두 개 추가)

```tsx
// src/hooks/usePlaylists.test.tsx  (기존 describe 블록 내부에 추가)
  it('create calls storage.createPlaylist + savePlaylist and updates state', () => {
    const created = mk('new');
    (storage.loadPlaylists as any).mockReturnValueOnce([]).mockReturnValue([created]);
    (storage.createPlaylist as any).mockReturnValue(created);
    const { result } = renderHook(() => usePlaylists());
    let returned: Playlist | undefined;
    act(() => { returned = result.current.create('My List'); });
    expect(storage.createPlaylist).toHaveBeenCalledWith('My List');
    expect(storage.savePlaylist).toHaveBeenCalledWith(created);
    expect(returned).toEqual(created);
    expect(result.current.playlists.map(p => p.id)).toEqual(['new']);
  });

  it('remove calls storage.deletePlaylist and refreshes', () => {
    (storage.loadPlaylists as any).mockReturnValueOnce([mk('a'), mk('b')]).mockReturnValue([mk('b')]);
    const { result } = renderHook(() => usePlaylists());
    act(() => result.current.remove('a'));
    expect(storage.deletePlaylist).toHaveBeenCalledWith('a');
    expect(result.current.playlists.map(p => p.id)).toEqual(['b']);
  });
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/hooks/usePlaylists.test.tsx`. (이미 구현이 있으면 통과할 수도 있으나, 새 `it`가 등록됐는지 확인. 구현 누락 시 예상 실패: `expected spy to have been called with`.)

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/hooks/usePlaylists.test.tsx`. 예상: 4 passed.

- [ ] **Step: 커밋** — `git add src/hooks/usePlaylists.test.tsx && git commit -m "test: cover usePlaylists create and remove behavior"`

---

### Task: App.tsx — HashRouter + PlaybackProvider + 5개 라우트 매핑

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/App.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/App.test.tsx`

**Interfaces:**
- Consumes: `src/playback/PlaybackContext.tsx` (`PlaybackProvider`), `react-router-dom` (`HashRouter`/`Routes`/`Route`), 페이지들(`Gallery`, `Player`, `Editor`, `SharedView`)
- Produces: `export default function App(): JSX.Element`

> 테스트 격리: PlaybackProvider와 각 페이지를 `vi.mock`으로 가벼운 스텁으로 치환하고, 해시 경로별로 올바른 페이지가 렌더되는지 검증한다. App 내부는 `HashRouter`를 쓰지만 테스트에서는 `window.location.hash`를 세팅해 라우팅을 유도한다.

- [ ] **Step: 실패하는 테스트 작성** — 각 해시 경로가 해당 페이지 스텁을 렌더하고 PlaybackProvider로 감싸는지 검증.

```tsx
// src/App.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./playback/PlaybackContext', () => ({
  PlaybackProvider: ({ children }: any) => <div data-testid="playback-provider">{children}</div>,
}));
vi.mock('./pages/Gallery', () => ({ default: () => <div>GALLERY_PAGE</div> }));
vi.mock('./pages/Player', () => ({ default: () => <div>PLAYER_PAGE</div> }));
vi.mock('./pages/Editor', () => ({ default: () => <div>EDITOR_PAGE</div> }));
vi.mock('./pages/SharedView', () => ({ default: () => <div>SHARED_PAGE</div> }));

import App from './App';

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

describe('App routing', () => {
  beforeEach(() => { window.location.hash = ''; });

  it('renders Gallery at #/ wrapped in PlaybackProvider', () => {
    renderAt('#/');
    expect(screen.getByTestId('playback-provider')).toBeInTheDocument();
    expect(screen.getByText('GALLERY_PAGE')).toBeInTheDocument();
  });

  it('renders Player at #/p/:playlistId', () => {
    renderAt('#/p/abc');
    expect(screen.getByText('PLAYER_PAGE')).toBeInTheDocument();
  });

  it('renders Player at #/p/:playlistId/:songId', () => {
    renderAt('#/p/abc/song1');
    expect(screen.getByText('PLAYER_PAGE')).toBeInTheDocument();
  });

  it('renders Editor at #/edit/:playlistId', () => {
    renderAt('#/edit/abc');
    expect(screen.getByText('EDITOR_PAGE')).toBeInTheDocument();
  });

  it('renders SharedView at #/s/:encoded', () => {
    renderAt('#/s/eyJ0IjoxfQ');
    expect(screen.getByText('SHARED_PAGE')).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/App.test.tsx`. 예상 실패: `Failed to resolve import "./App"`.

- [ ] **Step: 최소 구현** — HashRouter로 감싼 Routes, 루트에서 PlaybackProvider 마운트.

```tsx
// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlaybackProvider } from './playback/PlaybackContext';
import Gallery from './pages/Gallery';
import Player from './pages/Player';
import Editor from './pages/Editor';
import SharedView from './pages/SharedView';

export default function App() {
  return (
    <HashRouter>
      <PlaybackProvider>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/p/:playlistId" element={<Player />} />
          <Route path="/p/:playlistId/:songId" element={<Player />} />
          <Route path="/edit/:playlistId" element={<Editor />} />
          <Route path="/s/:encoded" element={<SharedView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PlaybackProvider>
    </HashRouter>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/App.test.tsx`. 예상: 5 passed.

- [ ] **Step: 커밋** — `git add src/App.tsx src/App.test.tsx && git commit -m "feat: wire App with HashRouter, PlaybackProvider and 5 routes"`

---

### Task: main.tsx — 진입점, #root에 App 마운트 (임시 스캐폴딩 App 교체)

**Files:**
- Create/Modify: `/Users/kyungsbook/Desktop/playlist/src/main.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/main.test.tsx`

**Interfaces:**
- Consumes: `src/App.tsx` (default export), `react-dom/client` (`createRoot`), `./index.css`
- Produces: (부수효과) `createRoot(document.getElementById('root')).render(<App/>)`

> 임시 스캐폴딩으로 만들어진 `main.tsx`가 있다면 실제 `App`을 import하도록 본 태스크에서 교체한다. 테스트는 `createRoot`를 모킹해 root 엘리먼트에 render가 1회 호출되는지만 검증(브라우저 의존 격리). `index.css` import는 vitest에서 무해.

- [ ] **Step: 실패하는 테스트 작성** — `#root`를 생성해두고 `main.tsx`를 import하면 `createRoot(...).render`가 호출되는지 검증.

```tsx
// src/main.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderSpy = vi.fn();
const createRootSpy = vi.fn(() => ({ render: renderSpy, unmount: vi.fn() }));

vi.mock('react-dom/client', () => ({
  createRoot: createRootSpy,
  default: { createRoot: createRootSpy },
}));
vi.mock('./App', () => ({ default: () => null }));
vi.mock('./index.css', () => ({}));

describe('main entry', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    renderSpy.mockClear();
    createRootSpy.mockClear();
    vi.resetModules();
  });

  it('creates a root on #root and renders App', async () => {
    await import('./main');
    expect(createRootSpy).toHaveBeenCalledTimes(1);
    expect(createRootSpy.mock.calls[0][0]).toBe(document.getElementById('root'));
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/main.test.tsx`. 예상 실패: `Failed to resolve import "./main"` 또는 임시 스캐폴딩 main이 `App`을 import하지 않아 mock 경로 불일치.

- [ ] **Step: 최소 구현** — 실제 App을 마운트.

```tsx
// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/main.test.tsx`. 예상: 1 passed.

- [ ] **Step: 커밋** — `git add src/main.tsx src/main.test.tsx && git commit -m "feat: replace scaffold main with real App entry point"`

---

### Task: Gallery 페이지 — "Yejin Playlist" 타이틀 + 카드 목록 렌더

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/pages/Gallery.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/pages/Gallery.test.tsx`

**Interfaces:**
- Consumes: `src/hooks/usePlaylists.ts` (`usePlaylists`), `react-router-dom` (`Link`, `useNavigate`), `src/types.ts` (`Playlist`)
- Produces: `export default function Gallery(): JSX.Element`

> 스모크: `usePlaylists`를 모킹해 카드 목록과 타이틀 렌더만 검증. 라우팅 컨텍스트는 `MemoryRouter`로 제공. 새 플레이리스트 버튼 동작은 다음 태스크에서 검증.

- [ ] **Step: 실패하는 테스트 작성** — 타이틀 "Yejin Playlist"와 플레이리스트 카드 제목들이 보이는지, 각 카드가 `#/p/:id` 또는 `#/edit/:id`로 가는 링크를 가지는지 검증.

```tsx
// src/pages/Gallery.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Playlist } from '../types';

const createMock = vi.fn();
const removeMock = vi.fn();
let playlistsMock: Playlist[] = [];

vi.mock('../hooks/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: playlistsMock, refresh: vi.fn(), create: createMock, remove: removeMock }),
}));

import Gallery from './Gallery';

const mk = (id: string, title: string): Playlist => ({
  id, title, songIds: [], createdAt: '2026-06-20T00:00:00.000Z',
});

function renderGallery() {
  return render(<MemoryRouter initialEntries={['/']}><Gallery /></MemoryRouter>);
}

describe('Gallery', () => {
  beforeEach(() => { vi.clearAllMocks(); playlistsMock = []; });

  it('shows the brand title "Yejin Playlist"', () => {
    renderGallery();
    expect(screen.getByText('Yejin Playlist')).toBeInTheDocument();
  });

  it('renders a card for each playlist with a link', () => {
    playlistsMock = [mk('aa', 'Late Night'), mk('bb', 'Morning')];
    renderGallery();
    expect(screen.getByText('Late Night')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links.some(h => h?.includes('/p/aa'))).toBe(true);
    expect(links.some(h => h?.includes('/p/bb'))).toBe(true);
  });

  it('shows an empty-state hint when there are no playlists', () => {
    playlistsMock = [];
    renderGallery();
    expect(screen.getByText(/새 플레이리스트/)).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/Gallery.test.tsx`. 예상 실패: `Failed to resolve import "./Gallery"`.

- [ ] **Step: 최소 구현** — 타이틀 + 카드 그리드 + 새 플레이리스트 버튼.

```tsx
// src/pages/Gallery.tsx
import { Link, useNavigate } from 'react-router-dom';
import { usePlaylists } from '../hooks/usePlaylists';

export default function Gallery() {
  const { playlists, create } = usePlaylists();
  const navigate = useNavigate();

  const handleNew = () => {
    const title = '새 플레이리스트';
    const p = create(title);
    navigate(`/edit/${p.id}`);
  };

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Yejin Playlist</h1>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-full bg-white/15 px-5 py-2 text-sm backdrop-blur hover:bg-white/25"
        >
          새 플레이리스트
        </button>
      </header>

      {playlists.length === 0 ? (
        <div className="mt-24 text-center text-white/60">
          <p className="text-lg">아직 플레이리스트가 없어요.</p>
          <p className="mt-2 text-sm">위의 “새 플레이리스트” 버튼으로 시작하세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link
                to={`/p/${p.id}`}
                className="block rounded-2xl bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
              >
                <div className="aspect-square rounded-xl bg-white/5" />
                <p className="mt-3 truncate text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-white/50">{p.songIds.length}곡</p>
              </Link>
              <Link to={`/edit/${p.id}`} className="mt-1 block text-xs text-white/40 hover:text-white/70">
                편집
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/Gallery.test.tsx`. 예상: 3 passed.

- [ ] **Step: 커밋** — `git add src/pages/Gallery.tsx src/pages/Gallery.test.tsx && git commit -m "feat: add Gallery page with brand title and playlist cards"`

---

### Task: Gallery 페이지 — "새 플레이리스트" 버튼이 create + navigate 호출

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/pages/Gallery.test.tsx`
- (구현은 이전 태스크 완료 — 동작 검증 추가)

**Interfaces:**
- Consumes: `src/hooks/usePlaylists.ts` (`create`), `react-router-dom` (`useNavigate`)
- Produces: (계약 동일)

- [ ] **Step: 실패하는 테스트 작성** — `useNavigate`를 spy로 잡고, 버튼 클릭 시 `create` 호출 + `/edit/<생성된 id>`로 이동하는지 검증. (파일 상단 mock에 `react-router-dom` 부분 모킹 추가, describe에 it 추가)

```tsx
// src/pages/Gallery.test.tsx  (파일 상단 import 아래, 다른 vi.mock 옆에 추가)
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

// src/pages/Gallery.test.tsx  (describe 블록 내부에 추가)
  it('clicking "새 플레이리스트" creates a playlist and navigates to its editor', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    createMock.mockReturnValue(mk('genid', '새 플레이리스트'));
    renderGallery();
    await userEvent.setup().click(screen.getByRole('button', { name: '새 플레이리스트' }));
    expect(createMock).toHaveBeenCalledWith('새 플레이리스트');
    expect(navigateMock).toHaveBeenCalledWith('/edit/genid');
  });
```

> 주의: `navigateMock`을 `beforeEach`의 `vi.clearAllMocks()`가 초기화하므로 추가 처리 불필요. `react-router-dom`을 부분 모킹하므로 `MemoryRouter`/`Link`는 실제 구현이 그대로 동작한다.

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/Gallery.test.tsx`. 예상: 만약 mock 추가 전이면 `navigateMock` 미정의로 실패, 추가 후 동작 불일치 시 `expected "navigateMock" to be called with /edit/genid`.

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/Gallery.test.tsx`. 예상: 4 passed.

- [ ] **Step: 커밋** — `git add src/pages/Gallery.test.tsx && git commit -m "test: verify new-playlist button creates and navigates"`

---

### Task: Player 페이지 — 플레이리스트/곡 로드 → playQueue, PlayGate 게이트

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/pages/Player.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/pages/Player.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` (`useParams`, `Link`), `src/lib/storage.ts` (`getPlaylist`, `getSong`), `src/playback/PlaybackContext.tsx` (`usePlayback`), `src/hooks/useLyricSync.ts` (`useLyricSync`), `src/components/*` (`GradientBg`, `LpDisc`, `LyricsView`, `Controls`, `PlayGate`), `src/types.ts` (`Song`, `Playlist`)
- Produces: `export default function Player(): JSX.Element`

> 스모크: storage / usePlayback / useLyricSync / 모든 컴포넌트를 모킹. (1) `started=false`면 PlayGate 노출, (2) 마운트 시 `playQueue`가 곡 배열로 호출되는지(딥링크 songId 반영) 검증.

- [ ] **Step: 실패하는 테스트 작성** — 곡 2개짜리 플레이리스트에서, 마운트 시 `playQueue([song0, song1], startIndex)` 호출 + `started=false`면 PlayGate 표시.

```tsx
// src/pages/Player.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Song, Playlist } from '../types';

const playQueueMock = vi.fn();
let playbackState: any;

vi.mock('../playback/PlaybackContext', () => ({
  usePlayback: () => playbackState,
}));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
vi.mock('../components/GradientBg', () => ({ default: () => <div>GRADIENT</div> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div>LPDISC</div> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div>LYRICS</div> }));
vi.mock('../components/Controls', () => ({ default: () => <div>CONTROLS</div> }));
vi.mock('../components/PlayGate', () => ({
  default: ({ onPlay }: any) => <button onClick={onPlay}>PLAYGATE</button>,
}));

const getPlaylistMock = vi.fn();
const getSongMock = vi.fn();
vi.mock('../lib/storage', () => ({
  getPlaylist: (...a: any[]) => getPlaylistMock(...a),
  getSong: (...a: any[]) => getSongMock(...a),
}));

import Player from './Player';

const song = (id: string): Song => ({
  id, title: 't' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl = (songIds: string[]): Playlist => ({
  id: 'pl1', title: 'L', songIds, createdAt: '2026-06-20',
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:playlistId" element={<Player />} />
        <Route path="/p/:playlistId/:songId" element={<Player />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playbackState = {
      queue: [], currentIndex: 0, current: null,
      isPlaying: false, repeat: 'off', progress: 0, duration: 0, started: false,
      playQueue: playQueueMock, togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
      seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
    };
    getPlaylistMock.mockReturnValue(pl(['s0', 's1']));
    getSongMock.mockImplementation((id: string) => song(id));
  });

  it('loads playlist songs and calls playQueue on mount (start at index 0)', () => {
    renderAt('/p/pl1');
    expect(playQueueMock).toHaveBeenCalledTimes(1);
    const [songs, startIndex] = playQueueMock.mock.calls[0];
    expect(songs.map((s: Song) => s.id)).toEqual(['s0', 's1']);
    expect(startIndex ?? 0).toBe(0);
  });

  it('deep-link songId sets the start index', () => {
    renderAt('/p/pl1/s1');
    const [, startIndex] = playQueueMock.mock.calls[0];
    expect(startIndex).toBe(1);
  });

  it('shows PlayGate when not started', () => {
    renderAt('/p/pl1');
    expect(screen.getByText('PLAYGATE')).toBeInTheDocument();
  });

  it('shows player surface (Controls) once started', () => {
    playbackState.started = true;
    playbackState.current = song('s0');
    renderAt('/p/pl1');
    expect(screen.getByText('CONTROLS')).toBeInTheDocument();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/Player.test.tsx`. 예상 실패: `Failed to resolve import "./Player"`.

- [ ] **Step: 최소 구현** — useParams로 로드, useEffect로 playQueue, started 분기.

```tsx
// src/pages/Player.tsx
import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, getSong } from '../lib/storage';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import GradientBg from '../components/GradientBg';
import LpDisc from '../components/LpDisc';
import LyricsView from '../components/LyricsView';
import Controls from '../components/Controls';
import PlayGate from '../components/PlayGate';
import type { Song } from '../types';

export default function Player() {
  const { playlistId, songId } = useParams();
  const pb = usePlayback();

  const songs = useMemo<Song[]>(() => {
    if (!playlistId) return [];
    const pl = getPlaylist(playlistId);
    if (!pl) return [];
    return pl.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s);
  }, [playlistId]);

  const startIndex = useMemo(() => {
    if (!songId) return 0;
    const idx = songs.findIndex((s) => s.id === songId);
    return idx >= 0 ? idx : 0;
  }, [songs, songId]);

  useEffect(() => {
    if (songs.length > 0) pb.playQueue(songs, startIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, startIndex]);

  const current = pb.current;
  const lyrics = current?.lyrics;
  const activeIndex = useLyricSync(
    pb.getCurrentTime,
    pb.isPlaying,
    lyrics?.type === 'synced' ? lyrics.synced ?? [] : [],
    lyrics?.offsetMs ?? 0,
  );

  if (songs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>플레이리스트를 찾을 수 없어요.</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const colors = current?.colors ?? { gradientFrom: '#0b1020', gradientTo: '#05070f', accent: '#6b7cff' };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <GradientBg colors={colors} />

      {!pb.started || !current ? (
        <PlayGate
          cover={current?.cover ?? ''}
          colors={colors}
          message={undefined}
          onPlay={pb.togglePlay}
        />
      ) : (
        <div className="relative z-10 grid min-h-screen grid-rows-[1fr_auto] gap-6 px-6 py-8 lg:grid-cols-[46%_54%] lg:grid-rows-1">
          <div className="flex items-center justify-center">
            <LpDisc cover={current.cover} spinning={pb.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex items-center justify-center">
            <LyricsView lyrics={current.lyrics} activeIndex={activeIndex} />
          </div>
          <div className="lg:col-span-2">
            <Controls
              isPlaying={pb.isPlaying}
              repeat={pb.repeat}
              progress={pb.progress}
              duration={pb.duration}
              onToggle={pb.togglePlay}
              onNext={pb.next}
              onPrev={pb.prev}
              onSeek={pb.seek}
              onCycleRepeat={pb.cycleRepeat}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/Player.test.tsx`. 예상: 4 passed.

- [ ] **Step: 커밋** — `git add src/pages/Player.tsx src/pages/Player.test.tsx && git commit -m "feat: add Player page loading queue, PlayGate, lyric sync"`

---

### Task: Editor 페이지 — 제목/메시지 편집 + PasteInput으로 곡 추가

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/pages/Editor.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/pages/Editor.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` (`useParams`, `Link`), `src/lib/storage.ts` (`getPlaylist`, `savePlaylist`, `getSong`), `src/lib/share.ts` (`encodePlaylist`), `src/components/*` (`PasteInput`, `SongCard`, `QrShare`), `src/types.ts` (`Song`, `Playlist`, `SharedPlaylist`)
- Produces: `export default function Editor(): JSX.Element`

> 스모크: storage/share/컴포넌트 모킹. (1) 곡 카드 목록 렌더, (2) PasteInput.onAdd가 songIds에 append + savePlaylist 호출, (3) 제목 편집이 savePlaylist 호출. 이 태스크는 곡 추가 + 제목 편집까지. 순서변경/삭제는 다음 태스크.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/pages/Editor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Song, Playlist } from '../types';

const savePlaylistMock = vi.fn();
const getPlaylistMock = vi.fn();
const getSongMock = vi.fn();
vi.mock('../lib/storage', () => ({
  getPlaylist: (...a: any[]) => getPlaylistMock(...a),
  savePlaylist: (...a: any[]) => savePlaylistMock(...a),
  getSong: (...a: any[]) => getSongMock(...a),
}));
vi.mock('../lib/share', () => ({ encodePlaylist: () => 'ENC' }));

let lastOnAdd: ((s: Song) => void) | null = null;
vi.mock('../components/PasteInput', () => ({
  default: ({ onAdd }: any) => { lastOnAdd = onAdd; return <div data-testid="paste-input" />; },
}));
vi.mock('../components/SongCard', () => ({
  default: ({ song }: any) => <div data-testid="song-card">{song.title}</div>,
}));
vi.mock('../components/QrShare', () => ({
  default: ({ url }: any) => <div data-testid="qr-share">{url}</div>,
}));

import Editor from './Editor';

const song = (id: string): Song => ({
  id, title: 'song-' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl = (songIds: string[]): Playlist => ({
  id: 'pl1', title: 'My List', message: 'hi', songIds, createdAt: '2026-06-20',
});

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/edit/pl1']}>
      <Routes><Route path="/edit/:playlistId" element={<Editor />} /></Routes>
    </MemoryRouter>,
  );
}

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastOnAdd = null;
    getPlaylistMock.mockReturnValue(pl(['s0']));
    getSongMock.mockImplementation((id: string) => song(id));
  });

  it('renders existing song cards and the paste input', () => {
    renderEditor();
    expect(screen.getByTestId('paste-input')).toBeInTheDocument();
    expect(screen.getByText('song-s0')).toBeInTheDocument();
  });

  it('PasteInput.onAdd appends to songIds and saves', () => {
    renderEditor();
    expect(lastOnAdd).toBeTypeOf('function');
    lastOnAdd!(song('s1'));
    expect(savePlaylistMock).toHaveBeenCalled();
    const saved = savePlaylistMock.mock.calls.at(-1)![0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's1']);
  });

  it('editing the title saves the playlist', async () => {
    renderEditor();
    const input = screen.getByLabelText('제목') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    expect(savePlaylistMock).toHaveBeenCalled();
    const saved = savePlaylistMock.mock.calls.at(-1)![0] as Playlist;
    expect(saved.title).toBe('Renamed');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/Editor.test.tsx`. 예상 실패: `Failed to resolve import "./Editor"`.

- [ ] **Step: 최소 구현** — playlist를 state로 잡고, onAdd/제목/메시지 변경 시 savePlaylist.

```tsx
// src/pages/Editor.tsx
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlaylist, savePlaylist, getSong } from '../lib/storage';
import { encodePlaylist } from '../lib/share';
import PasteInput from '../components/PasteInput';
import SongCard from '../components/SongCard';
import QrShare from '../components/QrShare';
import type { Song, Playlist, SharedPlaylist } from '../types';

export default function Editor() {
  const { playlistId } = useParams();
  const [playlist, setPlaylist] = useState<Playlist | null>(() =>
    playlistId ? getPlaylist(playlistId) ?? null : null,
  );

  const songs = useMemo<Song[]>(
    () => (playlist ? playlist.songIds.map((id) => getSong(id)).filter((s): s is Song => !!s) : []),
    [playlist],
  );

  const persist = (next: Playlist) => {
    setPlaylist(next);
    savePlaylist(next);
  };

  if (!playlist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>플레이리스트를 찾을 수 없어요.</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const handleAdd = (song: Song) => {
    persist({ ...playlist, songIds: [...playlist.songIds, song.id] });
  };

  const shareUrl = (() => {
    const payload: SharedPlaylist = {
      title: playlist.title,
      message: playlist.message,
      songs: songs.map((s) => ({ id: s.id, title: s.title })),
    };
    const encoded = encodePlaylist(payload);
    return `${window.location.origin}${window.location.pathname}#/s/${encoded}`;
  })();

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-sm text-white/60 hover:text-white">← 갤러리</Link>
        <Link to={`/p/${playlist.id}`} className="text-sm text-white/60 hover:text-white">재생 →</Link>
      </header>

      <div className="mb-6 space-y-3">
        <label className="block text-xs text-white/50" htmlFor="pl-title">제목</label>
        <input
          id="pl-title"
          aria-label="제목"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-lg outline-none"
          value={playlist.title}
          onChange={(e) => persist({ ...playlist, title: e.target.value })}
        />
        <label className="block text-xs text-white/50" htmlFor="pl-message">메시지</label>
        <input
          id="pl-message"
          aria-label="메시지"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none"
          value={playlist.message ?? ''}
          onChange={(e) => persist({ ...playlist, message: e.target.value })}
        />
      </div>

      <PasteInput onAdd={handleAdd} />

      <ul className="mt-6 space-y-2">
        {songs.map((s) => (
          <li key={s.id}>
            <SongCard song={s} />
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <h2 className="mb-3 text-sm text-white/60">공유</h2>
        <QrShare url={shareUrl} />
      </div>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/Editor.test.tsx`. 예상: 3 passed.

- [ ] **Step: 커밋** — `git add src/pages/Editor.tsx src/pages/Editor.test.tsx && git commit -m "feat: add Editor page with title/message edit and song add"`

---

### Task: Editor 페이지 — 곡 순서변경(위/아래) + 삭제

**Files:**
- Modify: `/Users/kyungsbook/Desktop/playlist/src/pages/Editor.tsx`
- Modify: `/Users/kyungsbook/Desktop/playlist/src/pages/Editor.test.tsx`

**Interfaces:**
- Consumes: (동일) `src/lib/storage.ts` (`savePlaylist`)
- Produces: (계약 동일 — Editor 내부 동작 확장)

> 순서변경은 drag보다 테스트하기 쉬운 위/아래 버튼으로 구현(jsdom drag는 불안정). 각 곡 행에 "위로/아래로/삭제" 버튼.

- [ ] **Step: 실패하는 테스트 작성** — 곡 3개에서 두 번째 곡을 위로 올리면 순서가 바뀌고 savePlaylist 호출, 삭제 시 songIds에서 제거. (기존 describe에 it 2개 추가)

```tsx
// src/pages/Editor.test.tsx  (beforeEach 위쪽 한정: getPlaylist를 3곡으로 바꾼 헬퍼가 필요 없도록 it 안에서 직접 설정)
  it('moving a song up reorders and saves', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const ups = screen.getAllByRole('button', { name: '위로' });
    await userEvent.click(ups[1]); // move s1 up
    const saved = savePlaylistMock.mock.calls.at(-1)![0] as Playlist;
    expect(saved.songIds).toEqual(['s1', 's0', 's2']);
  });

  it('deleting a song removes it and saves', async () => {
    getPlaylistMock.mockReturnValue(pl(['s0', 's1', 's2']));
    renderEditor();
    const dels = screen.getAllByRole('button', { name: '삭제' });
    await userEvent.click(dels[1]); // delete s1
    const saved = savePlaylistMock.mock.calls.at(-1)![0] as Playlist;
    expect(saved.songIds).toEqual(['s0', 's2']);
  });
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/Editor.test.tsx`. 예상 실패: `Unable to find role="button" and name "위로"`.

- [ ] **Step: 최소 구현** — 순서변경/삭제 핸들러 추가 + 각 행에 버튼 추가.

```tsx
// src/pages/Editor.tsx  (handleAdd 아래에 추가)
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= playlist.songIds.length) return;
    const ids = [...playlist.songIds];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persist({ ...playlist, songIds: ids });
  };

  const removeAt = (index: number) => {
    const ids = playlist.songIds.filter((_, i) => i !== index);
    persist({ ...playlist, songIds: ids });
  };
```

```tsx
// src/pages/Editor.tsx  (기존 <ul> 의 <li> 내부를 아래로 교체)
        {songs.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <div className="flex-1">
              <SongCard song={s} />
            </div>
            <button type="button" aria-label="위로" onClick={() => move(i, -1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↑</button>
            <button type="button" aria-label="아래로" onClick={() => move(i, 1)} className="rounded-lg bg-white/10 px-2 py-1 text-xs">↓</button>
            <button type="button" aria-label="삭제" onClick={() => removeAt(i)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200">✕</button>
          </li>
        ))}
```

> 주의: `move`/`removeAt`는 `songs`의 인덱스 `i`가 곧 `playlist.songIds`의 인덱스라는 가정이다. 모든 songId가 `getSong`으로 해석되는 정상 경로에서는 일치한다. (해석 실패 곡 필터링 시 어긋날 수 있으나 본 MVP 범위에선 모든 곡이 풀에 캐시된 상태라 안전.)

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/Editor.test.tsx`. 예상: 5 passed.

- [ ] **Step: 커밋** — `git add src/pages/Editor.tsx src/pages/Editor.test.tsx && git commit -m "feat: support reorder and delete songs in Editor"`

---

### Task: SharedView 페이지 — 디코드 + 곡 resolve + playQueue + "내 보관함에 저장"

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/pages/SharedView.tsx`
- Test: `/Users/kyungsbook/Desktop/playlist/src/pages/SharedView.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` (`useParams`, `useNavigate`, `Link`), `src/lib/share.ts` (`decodePlaylist`), `src/lib/storage.ts` (`getSong`, `createPlaylist`, `savePlaylist`), `src/hooks/useSongResolver.ts` (`useSongResolver`), `src/playback/PlaybackContext.tsx` (`usePlayback`), `src/components/*` (`GradientBg`, `LpDisc`, `LyricsView`, `Controls`, `PlayGate`), `src/hooks/useLyricSync.ts` (`useLyricSync`), `src/types.ts` (`Song`, `SharedPlaylist`)
- Produces: `export default function SharedView(): JSX.Element`

> 스모크: decode/storage/resolver/playback/컴포넌트 모킹. (1) decode 결과 곡들을 resolve(캐시 우선 getSong, 없으면 resolver.resolve)해 playQueue 호출, (2) 디코드 실패 시 오류 메시지, (3) "내 보관함에 저장" 버튼이 createPlaylist + savePlaylist(songIds 포함) + navigate 호출. Player UI는 재사용 컴포넌트를 그대로 모킹.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/pages/SharedView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Song, SharedPlaylist, Playlist } from '../types';

const decodeMock = vi.fn();
vi.mock('../lib/share', () => ({ decodePlaylist: (...a: any[]) => decodeMock(...a) }));

const getSongMock = vi.fn();
const createPlaylistMock = vi.fn();
const savePlaylistMock = vi.fn();
vi.mock('../lib/storage', () => ({
  getSong: (...a: any[]) => getSongMock(...a),
  createPlaylist: (...a: any[]) => createPlaylistMock(...a),
  savePlaylist: (...a: any[]) => savePlaylistMock(...a),
}));

const resolveMock = vi.fn();
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: resolveMock, resolving: false }),
}));

const playQueueMock = vi.fn();
let playbackState: any;
vi.mock('../playback/PlaybackContext', () => ({ usePlayback: () => playbackState }));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
vi.mock('../components/GradientBg', () => ({ default: () => <div>GRADIENT</div> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div>LPDISC</div> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div>LYRICS</div> }));
vi.mock('../components/Controls', () => ({ default: () => <div>CONTROLS</div> }));
vi.mock('../components/PlayGate', () => ({ default: ({ onPlay }: any) => <button onClick={onPlay}>PLAYGATE</button> }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import SharedView from './SharedView';

const song = (id: string): Song => ({
  id, title: 's' + id, artist: 'a', durationSec: 100,
  cover: 'c', colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});

function renderAt(encoded: string) {
  return render(
    <MemoryRouter initialEntries={[`/s/${encoded}`]}>
      <Routes><Route path="/s/:encoded" element={<SharedView />} /></Routes>
    </MemoryRouter>,
  );
}

describe('SharedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playbackState = {
      queue: [], currentIndex: 0, current: null,
      isPlaying: false, repeat: 'off', progress: 0, duration: 0, started: false,
      playQueue: playQueueMock, togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
      seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
    };
  });

  it('shows error message when decode fails', () => {
    decodeMock.mockReturnValue(null);
    renderAt('BAD');
    expect(screen.getByText(/링크를 읽을 수 없어요|잘못된/)).toBeInTheDocument();
  });

  it('resolves decoded songs (cache first) and calls playQueue', async () => {
    const shared: SharedPlaylist = { title: 'Gift', songs: [{ id: 's0' }, { id: 's1' }] };
    decodeMock.mockReturnValue(shared);
    getSongMock.mockImplementation((id: string) => (id === 's0' ? song('s0') : undefined));
    resolveMock.mockImplementation(async (id: string) => song(id));
    renderAt('GOOD');
    await waitFor(() => expect(playQueueMock).toHaveBeenCalled());
    const [songs] = playQueueMock.mock.calls[0];
    expect(songs.map((s: Song) => s.id)).toEqual(['s0', 's1']);
    expect(resolveMock).toHaveBeenCalledWith('s1'); // s0 came from cache
  });

  it('"내 보관함에 저장" creates a playlist with the song ids and navigates', async () => {
    const shared: SharedPlaylist = { title: 'Gift', songs: [{ id: 's0' }] };
    decodeMock.mockReturnValue(shared);
    getSongMock.mockImplementation((id: string) => song(id));
    resolveMock.mockImplementation(async (id: string) => song(id));
    const created: Playlist = { id: 'newpl', title: 'Gift', songIds: [], createdAt: '2026-06-20' };
    createPlaylistMock.mockReturnValue(created);
    renderAt('GOOD');
    await waitFor(() => expect(playQueueMock).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /내 보관함에 저장/ }));
    expect(createPlaylistMock).toHaveBeenCalledWith('Gift');
    const saved = savePlaylistMock.mock.calls.at(-1)![0] as Playlist;
    expect(saved.songIds).toEqual(['s0']);
    expect(navigateMock).toHaveBeenCalledWith('/edit/newpl');
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/SharedView.test.tsx`. 예상 실패: `Failed to resolve import "./SharedView"`.

- [ ] **Step: 최소 구현** — decode → 비동기 resolve(캐시 우선) → playQueue, 저장 버튼.

```tsx
// src/pages/SharedView.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { decodePlaylist } from '../lib/share';
import { getSong, createPlaylist, savePlaylist } from '../lib/storage';
import { useSongResolver } from '../hooks/useSongResolver';
import { usePlayback } from '../playback/PlaybackContext';
import { useLyricSync } from '../hooks/useLyricSync';
import GradientBg from '../components/GradientBg';
import LpDisc from '../components/LpDisc';
import LyricsView from '../components/LyricsView';
import Controls from '../components/Controls';
import PlayGate from '../components/PlayGate';
import type { Song, SharedPlaylist } from '../types';

export default function SharedView() {
  const { encoded } = useParams();
  const navigate = useNavigate();
  const pb = usePlayback();
  const { resolve } = useSongResolver();

  const shared = useMemo<SharedPlaylist | null>(
    () => (encoded ? decodePlaylist(encoded) : null),
    [encoded],
  );

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!shared) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const resolved: Song[] = [];
      for (const entry of shared.songs) {
        const cached = getSong(entry.id);
        if (cached) { resolved.push(cached); continue; }
        try {
          const s = await resolve(entry.id);
          resolved.push(s);
        } catch {
          // skip unresolvable song (graceful)
        }
      }
      if (cancelled) return;
      setSongs(resolved);
      setLoading(false);
      if (resolved.length > 0) pb.playQueue(resolved, 0);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  const current = pb.current;
  const lyrics = current?.lyrics;
  const activeIndex = useLyricSync(
    pb.getCurrentTime,
    pb.isPlaying,
    lyrics?.type === 'synced' ? lyrics.synced ?? [] : [],
    lyrics?.offsetMs ?? 0,
  );

  const saveToLibrary = () => {
    if (!shared) return;
    const p = createPlaylist(shared.title);
    const withSongs = { ...p, message: shared.message, songIds: songs.map((s) => s.id) };
    savePlaylist(withSongs);
    navigate(`/edit/${p.id}`);
  };

  if (!shared) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-white">
        <p>링크를 읽을 수 없어요. (잘못된 공유 링크)</p>
        <Link to="/" className="mt-4 text-sm text-white/60 underline">홈으로</Link>
      </div>
    );
  }

  const colors = current?.colors ?? { gradientFrom: '#0b1020', gradientTo: '#05070f', accent: '#6b7cff' };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <GradientBg colors={colors} />

      {loading ? (
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white/70">
          불러오는 중…
        </div>
      ) : !pb.started || !current ? (
        <PlayGate cover={current?.cover ?? ''} colors={colors} message={shared.message} onPlay={pb.togglePlay} />
      ) : (
        <div className="relative z-10 grid min-h-screen grid-rows-[1fr_auto] gap-6 px-6 py-8 lg:grid-cols-[46%_54%] lg:grid-rows-1">
          <div className="flex items-center justify-center">
            <LpDisc cover={current.cover} spinning={pb.isPlaying} accent={colors.accent} />
          </div>
          <div className="flex items-center justify-center">
            <LyricsView lyrics={current.lyrics} activeIndex={activeIndex} />
          </div>
          <div className="lg:col-span-2">
            <Controls
              isPlaying={pb.isPlaying}
              repeat={pb.repeat}
              progress={pb.progress}
              duration={pb.duration}
              onToggle={pb.togglePlay}
              onNext={pb.next}
              onPrev={pb.prev}
              onSeek={pb.seek}
              onCycleRepeat={pb.cycleRepeat}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={saveToLibrary}
        className="fixed right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25"
      >
        내 보관함에 저장
      </button>
    </div>
  );
}
```

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/SharedView.test.tsx`. 예상: 3 passed.

- [ ] **Step: 커밋** — `git add src/pages/SharedView.tsx src/pages/SharedView.test.tsx && git commit -m "feat: add SharedView decoding, resolving and save-to-library"`

---

### Task: 통합 스모크 — 전 페이지 크래시 없이 렌더 + App 전체 라우팅 통과

**Files:**
- Create: `/Users/kyungsbook/Desktop/playlist/src/pages/pages.smoke.test.tsx`

**Interfaces:**
- Consumes: 모든 페이지 default export, `react-router-dom` (`MemoryRouter`, `Routes`, `Route`)
- Produces: (테스트 전용 — 산출물 없음)

> 목적: 페이지들이 라우터/모킹된 의존성 하에서 throw 없이 마운트되는지 단일 파일로 회귀 방어. 의존성은 각 페이지 테스트와 동일 패턴으로 모킹.

- [ ] **Step: 실패하는 테스트 작성**

```tsx
// src/pages/pages.smoke.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Song, Playlist, SharedPlaylist } from '../types';

const song = (id: string): Song => ({
  id, title: 's' + id, artist: 'a', durationSec: 100, cover: 'c',
  colors: { gradientFrom: '#111', gradientTo: '#000', accent: '#abc' },
  lyrics: { type: 'none', source: 'none', offsetMs: 0 }, resolvedAt: '2026-06-20',
});
const pl: Playlist = { id: 'pl1', title: 'L', songIds: ['s0'], createdAt: '2026-06-20' };
const shared: SharedPlaylist = { title: 'G', songs: [{ id: 's0' }] };

vi.mock('../hooks/usePlaylists', () => ({
  usePlaylists: () => ({ playlists: [pl], refresh: vi.fn(), create: vi.fn(() => pl), remove: vi.fn() }),
}));
vi.mock('../lib/storage', () => ({
  getPlaylist: () => pl, getSong: (id: string) => song(id),
  savePlaylist: vi.fn(), createPlaylist: () => pl,
}));
vi.mock('../lib/share', () => ({ encodePlaylist: () => 'ENC', decodePlaylist: () => shared }));
vi.mock('../hooks/useSongResolver', () => ({
  useSongResolver: () => ({ resolve: async (id: string) => song(id), resolving: false }),
}));
vi.mock('../hooks/useLyricSync', () => ({ useLyricSync: () => 0 }));
const playback = {
  queue: [song('s0')], currentIndex: 0, current: song('s0'),
  isPlaying: false, repeat: 'off' as const, progress: 0, duration: 100, started: false,
  playQueue: vi.fn(), togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
  seek: vi.fn(), cycleRepeat: vi.fn(), setRepeat: vi.fn(), getCurrentTime: () => 0,
};
vi.mock('../playback/PlaybackContext', () => ({ usePlayback: () => playback }));
vi.mock('../components/GradientBg', () => ({ default: () => <div /> }));
vi.mock('../components/LpDisc', () => ({ default: () => <div /> }));
vi.mock('../components/LyricsView', () => ({ default: () => <div /> }));
vi.mock('../components/Controls', () => ({ default: () => <div /> }));
vi.mock('../components/PlayGate', () => ({ default: () => <div /> }));
vi.mock('../components/SongCard', () => ({ default: () => <div /> }));
vi.mock('../components/PasteInput', () => ({ default: () => <div /> }));
vi.mock('../components/QrShare', () => ({ default: () => <div /> }));

import Gallery from './Gallery';
import Player from './Player';
import Editor from './Editor';
import SharedView from './SharedView';

describe('pages smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Gallery mounts without crashing', () => {
    expect(() => render(<MemoryRouter><Gallery /></MemoryRouter>)).not.toThrow();
  });
  it('Player mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/p/pl1']}>
        <Routes><Route path="/p/:playlistId" element={<Player />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
  it('Editor mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/edit/pl1']}>
        <Routes><Route path="/edit/:playlistId" element={<Editor />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
  it('SharedView mounts without crashing', () => {
    expect(() => render(
      <MemoryRouter initialEntries={['/s/ENC']}>
        <Routes><Route path="/s/:encoded" element={<SharedView />} /></Routes>
      </MemoryRouter>,
    )).not.toThrow();
  });
});
```

- [ ] **Step: 테스트 실행해 실패 확인** — `npx vitest run src/pages/pages.smoke.test.tsx`. 예상 실패: 페이지가 없으면 import 에러; 있으면 4 passed가 될 수도 있으므로, 본 태스크는 회귀 가드 역할. (이전 태스크들이 완료된 후라면 바로 통과해도 정상.)

- [ ] **Step: 테스트 실행해 통과 확인** — `npx vitest run src/pages/pages.smoke.test.tsx`. 예상: 4 passed.

- [ ] **Step: 커밋** — `git add src/pages/pages.smoke.test.tsx && git commit -m "test: add cross-page smoke render guard"`

---

### Task: 전체 빌드/타입/테스트 게이트 + 수동 검증(E2E) 체크리스트

**Files:**
- (검증 전용 — 코드 산출물 없음. 실패 시 해당 모듈 태스크로 복귀)

**Interfaces:**
- Consumes: 전 모듈 통합
- Produces: (없음)

> 단위/스모크 테스트는 모킹 기반이므로, 실제 통합은 브라우저에서 수동 확인한다. 모든 다른 모듈이 머지된 뒤 1회 수행.

- [ ] **Step: 타입 + 빌드 통과 확인** — `npx tsc --noEmit && npm run build`. 예상: 타입 에러 0, `dist/` 생성.

- [ ] **Step: 전체 테스트 통과 확인** — `npx vitest run`. 예상: 모든 spec PASS(H 그룹 + 타 그룹).

- [ ] **Step: 수동 검증 — Gallery → 새 플레이리스트 → Editor** — `npm run dev` 후 브라우저에서 다음을 눈으로 확인:
  - `#/` 진입 시 좌상단에 "Yejin Playlist" 타이틀이 보인다.
  - 플레이리스트가 없으면 "새 플레이리스트" 안내가, 있으면 카드 그리드가 보인다.
  - "새 플레이리스트" 버튼 클릭 → URL이 `#/edit/<slug>` 로 바뀌고 Editor가 뜬다.

- [ ] **Step: 수동 검증 — Editor에서 곡 추가/순서/공유** — Editor에서:
  - 제목 입력칸에 타이핑 → 새로고침해도 제목이 유지된다(localStorage 저장 확인).
  - PasteInput에 유효한 YouTube 링크를 붙여넣어 곡 카드가 목록 끝에 추가된다.
  - "↑/↓"로 순서가 바뀌고, "✕"로 곡이 삭제된다.
  - 공유 영역에 QR 이미지가 그려지고, QR 링크가 `#/s/<encoded>` 형태다.

- [ ] **Step: 수동 검증 — 재생 유지(곡 추가 중 끊김 없음)** — Editor에서 곡 1개를 먼저 재생(`#/p/:id`에서 ▶ 후 다시 `#/edit/:id`로 이동)한 상태로 새 곡을 붙여넣어 추가:
  - 라우트가 Editor↔Player로 바뀌어도 현재 곡 재생이 끊기지 않는다(PlaybackProvider가 App 루트에서 유지).
  - 새로 추가된 곡은 큐 끝에 붙고 현재 재생을 방해하지 않는다.

- [ ] **Step: 수동 검증 — Player 게이트 → 재생 → 가사/색** — `#/p/:playlistId` 진입:
  - `started=false`일 때 박동 ▶ PlayGate가 보인다.
  - ▶ 탭 → LP가 회전하고 배경이 곡 색으로 물들며, 싱크 가사가 흰색/회색으로 흐른다(가사 있는 곡).
  - Controls의 반복 토글이 끄기→전체🔁→한곡🔂 순으로 순환하고, 곡 끝에서 모드대로 전환된다.
  - 딥링크 `#/p/:playlistId/:songId`로 들어가면 해당 곡부터 시작된다.

- [ ] **Step: 수동 검증 — 공유 링크 왕복(E2E)** — Editor의 QR 링크(또는 그 URL)를 새 탭/시크릿 창에서 연다:
  - `#/s/<encoded>` 가 디코드되어 곡들이 resolve되고 PlayGate가 뜬 뒤 재생된다.
  - "내 보관함에 저장" 클릭 → `#/edit/<새 slug>` 로 이동하고, `#/` 갤러리에 해당 플레이리스트 카드가 추가된다.
  - 잘못된 `#/s/BAD` 링크는 "링크를 읽을 수 없어요" 안내를 보여준다.

- [ ] **Step: 커밋(문서/검증 메모가 있을 때만)** — 코드 변경이 없으면 커밋 생략. 검증 중 버그 발견 시 해당 페이지 태스크로 돌아가 수정 후 그 태스크의 커밋 규칙을 따른다.

---


## 부록 — 조립 노트 (모듈별 produces / consumes / notes)

### A-scaffolding-tooling-deploy

**Notes:** 조립 주의점: (1) 이 모듈은 임시 src/App.tsx(단순 'Yejin Playlist' 헤딩)를 만든다. App 라우팅 계약을 담당하는 다른 모듈이 이 파일을 통째로 덮어쓴다 — App.tsx.test.tsx 스모크 테스트는 'Yejin Playlist' 텍스트만 검사하므로, 최종 Gallery 페이지(타이틀 'Yejin Playlist')도 동일 텍스트를 렌더하면 스모크 테스트는 계속 통과한다. 최종 App이 라우팅을 도입하면 이 스모크 테스트를 Gallery 렌더 기준으로 그대로 두거나 다른 모듈이 갱신할 수 있다. (2) public/404.html: Vite는 public/ 안의 파일을 그대로 dist로 복사하지만, 우리는 index.html의 빌드 산출물(해시된 asset 링크 포함)을 404.html로 써야 하므로 public/에 정적 404.html을 두지 않고 build 스크립트의 postbuild 단계에서 cp dist/index.html dist/404.html 로 생성한다(완전한 산출 링크 보장). (3) base:'/yejin-playlist/' 는 레포명 가정 — 커스텀 도메인/루트 배포 시 '/'로 변경 필요(spec 10절). (4) tailwindcss는 v3 계열 고정(@tailwind 디렉티브 + postcss 플러그인 방식). v4로 올리면 PostCSS 플러그인 패키지가 분리되어 설정이 달라지므로 이 계약에서는 v3 유지. (5) qrcode 런타임 import는 QrShare(다른 모듈)에서 사용 — 여기선 의존성 설치만 책임. 미해결 이슈: ytimg CORS canvas 검증(spec 15절)은 colors 모듈 수동검증 사항으로 이 모듈 범위 밖.

**Produces:**
- package.json (deps: react@^18, react-dom@^18, react-router-dom@^6, qrcode@^1; devDeps: vite@^5, @vitejs/plugin-react@^4, typescript@^5, tailwindcss@^3, postcss@^8, autoprefixer@^10, vitest@^1, jsdom@^24, @testing-library/react@^14, @testing-library/jest-dom@^6, @types/react@^18, @types/react-dom@^18, @types/qrcode@^1)
- package.json scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview', test: 'vitest run' }
- vite.config.ts: defineConfig with react() plugin, base:'/yejin-playlist/', test:{ environment:'jsdom', globals:true, setupFiles:['./src/test/setup.ts'], css:true }
- tsconfig.json + tsconfig.node.json (strict, jsx:react-jsx, vitest globals/jest-dom types)
- tailwind.config.js (content globs over index.html + src), postcss.config.js (tailwindcss+autoprefixer)
- src/index.css: @tailwind base/components/utilities + design tokens (--c1/--c2/--c3, --line-active/near/far/faint, --ease-soft, --dur-line, --dur-bg, --spin-dur, --lp-overlap)
- index.html: <div id="root"> + Pretendard webfont link + #/ hash entry
- src/main.tsx: ReactDOM.createRoot entry rendering <App/>
- src/test/setup.ts: imports '@testing-library/jest-dom'
- src/vite-env.d.ts: /// <reference types="vite/client" />
- src/App.tsx (temporary scaffold rendering 'Yejin Playlist' heading, replaced later by App.tsx routing contract)
- public/404.html generated as copy of dist/index.html at build time via postbuild script (cp dist/index.html dist/404.html)
- .github/workflows/deploy.yml: GitHub Pages workflow (checkout, setup-node@20, npm ci, npm run build, upload-pages-artifact dist, deploy-pages) with permissions + environment
- .gitignore (node_modules, dist, .env*, *.log, coverage, .DS_Store)

**Consumes:**
- src/App.tsx — final routing version (HashRouter + Routes + PlaybackProvider) is delivered by module owning src/pages/* and App contract; this module ships only a TEMPORARY App.tsx scaffold so the smoke test passes, to be overwritten without breaking the build
- src/playback/PlaybackContext.tsx — PlaybackProvider (consumed by the final App.tsx, not by this module's temporary scaffold)

### B-types-youtube-queue

**Notes:** 조립 시 주의점/계약과의 차이/미해결 이슈:

1) 프로젝트는 greenfield(아직 src/ 없음, docs만 존재). Task 0에서 Vite+React+TS+Tailwind+Vitest 토대를 세팅한다. 다른 모듈 그룹도 동일한 토대 세팅 태스크를 가질 가능성이 높으므로, 오케스트레이션 시 Task 0은 한 그룹에서만 실행하고 나머지는 멱등 처리(파일 존재 시 건너뜀)하는 것을 권장. 충돌 방지를 위해 package.json/vite.config.ts/tsconfig는 첫 실행 그룹의 것을 정본으로 삼을 것.

2) vite.config.ts의 base는 GitHub Pages 프로젝트 페이지 기준 '/yejin-playlist/'로 설정. 실제 repo 이름이 다르면 배포 그룹에서 조정 필요(이 그룹 범위 밖).

3) 계약 시그니처는 글자 그대로 구현함. 계약에 없던 안전가드 동작(런타임 정의)을 테스트로 고정함: nextIndex(length<=0) -> null, prevIndex(length<=0) -> 0. 이는 계약 시그니처를 위반하지 않으며 PlaybackContext(usePlayback)가 빈 큐를 안전하게 다루도록 돕는다. usePlayback 구현 시 이 동작 가정 가능.

4) parseTitleHeuristic의 노이즈 마커 목록/분리 규칙은 계약에 명시 안 된 세부라 합리적 휴리스틱으로 고정함(괄호/대괄호 내 Official/MV/Lyrics/Audio 등 제거, 첫 ' - '(hyphen/en-dash/em-dash)로 분리, 한쪽 비면 author 폴백). useSongResolver가 이 함수 결과를 그대로 artist/title로 사용. 마커 추가가 필요하면 NOISE_MARKERS 배열만 확장하면 됨(테스트도 함께).

5) parseVideoId는 youtube-nocookie.com도 허용(임베드 호환). 11자 정규식 [A-Za-z0-9_-]{11}을 유효성의 단일 기준으로 사용. raw id 입력도 정확히 11자만 허용.

6) types.test.ts는 런타임 로직이 없어 타입수준 어서션 + tsc typecheck로 시그니처 회귀를 가드한다(계약 깨지면 typecheck 실패).

7) 모든 vitest 실행 명령은 --root /Users/kyungsbook/Desktop/playlist 를 명시해 cwd 리셋(서브에이전트 bash) 환경에서도 안전하게 동작하도록 작성함.

**Produces:**
- src/types.ts: export type RepeatMode = 'off' | 'all' | 'one'
- src/types.ts: export type LyricsType = 'synced' | 'plain' | 'none'
- src/types.ts: export interface LyricLine { time: number; text: string }
- src/types.ts: export interface SongColors { gradientFrom: string; gradientTo: string; accent: string }
- src/types.ts: export interface SongLyrics { type: LyricsType; synced?: LyricLine[]; plain?: string; source: 'lrclib'|'manual'|'none'; offsetMs: number }
- src/types.ts: export interface Song { id: string; title: string; artist: string; durationSec: number; cover: string; colors: SongColors; lyrics: SongLyrics; resolvedAt: string }
- src/types.ts: export interface Playlist { id: string; title: string; message?: string; coverVideoId?: string; songIds: string[]; createdAt: string }
- src/types.ts: export interface SharedPlaylist { title: string; message?: string; songs: { id: string; title?: string }[] }
- src/lib/youtube.ts: export function parseVideoId(input: string): string | null
- src/lib/youtube.ts: export type ThumbQuality = 'maxresdefault'|'sddefault'|'hqdefault'|'mqdefault'
- src/lib/youtube.ts: export const THUMB_FALLBACK: readonly ThumbQuality[]
- src/lib/youtube.ts: export function thumbnailUrl(videoId: string, quality?: ThumbQuality): string
- src/lib/youtube.ts: export interface ParsedTitle { artist: string; title: string }
- src/lib/youtube.ts: export function parseTitleHeuristic(rawTitle: string, author: string): ParsedTitle
- src/lib/queue.ts: export function nextIndex(current: number, length: number, repeat: RepeatMode): number | null
- src/lib/queue.ts: export function prevIndex(current: number, length: number, repeat: RepeatMode): number

**Consumes:**
- src/lib/queue.ts consumes: import type { RepeatMode } from '../types' (제공자: 같은 그룹 Task 1, src/types.ts)

### C-lrc-time

**Notes:** 전제: src/types.ts가 먼저 존재해야 한다(LyricLine 타입). 계약상 types.ts는 다른 모듈(A) 담당이지만, 이 모듈의 첫 태스크는 lrc.ts가 import할 LyricLine 타입이 필요하므로 types.ts의 존재를 가정한다. 만약 조립 시점에 types.ts가 아직 없으면 Task C0(아래)에서 최소 types.ts(LyricLine만이라도)를 먼저 생성하도록 안내해두었다 — 조립 시 실제 types.ts가 이미 있으면 C0는 건너뛰면 된다(파일을 덮어쓰지 말 것). parseLrc 사양 결정사항: (1) 멀티 타임태그 한 줄(예 '[00:01.00][00:05.00]text')은 각 시각마다 별도 LyricLine으로 전개. (2) '[offset:+250]' 또는 '[offset:-120]' 메타태그는 offsetMs로 반환하되 lines의 time에는 적용하지 않음(소비측에서 offsetMs를 따로 반영 — useLyricSync가 offsetMs를 인자로 받음). (3) 빈 텍스트(공백만)는 '♪'로 치환. (4) 타임태그 없는 줄/메타태그([ar:],[ti:],[al:],[by:],[length:],[re:],[ve:])는 가사 라인으로 만들지 않음. (5) 최종 time 오름차순 안정 정렬. (6) [mm:ss.xx] 및 [mm:ss.xxx], [mm:ss] 모두 허용, 분/초는 정수, 소수부는 자릿수에 맞춰 환산. findActiveIndex는 이진탐색으로 time<=t 인 마지막 인덱스, t가 첫 줄보다 작으면 -1. estimateTime은 playing일 때만 (now-at)/1000 만큼 보간(음수 경과는 그대로 더함 — 클램프 안 함, 단순 선형).

**Produces:**
- src/lib/lrc.ts: export interface ParsedLrc { lines: LyricLine[]; offsetMs: number; }
- src/lib/lrc.ts: export function parseLrc(raw: string): ParsedLrc
- src/lib/lrc.ts: export function findActiveIndex(lines: LyricLine[], t: number): number
- src/lib/time.ts: export interface TimeSample { time: number; at: number; }
- src/lib/time.ts: export function estimateTime(sample: TimeSample, now: number, playing: boolean): number

**Consumes:**
- src/types.ts: import type { LyricLine } from '../types' (interface LyricLine { time: number; text: string })

### D-lrclib-colors

**Notes:** 의존성: 이 두 모듈은 src/types.ts의 SongColors 타입만 소비한다(colors.ts). lrclib.ts는 외부 타입 의존 없음. 둘 다 다른 lib 모듈에 의존하지 않으므로 독립적으로 먼저 구현/테스트 가능. 전제: 프로젝트 초기 셋업(Vite+React+TS+Tailwind, vitest+jsdom 설정, src/types.ts 작성)이 완료되어 있어야 import './colors' 및 import '../types'가 동작한다 — 초기 셋업 모듈이 src/types.ts(특히 SongColors)와 vitest.config(environment:'jsdom', globals 또는 import 방식)을 제공한다고 가정한다. 본 태스크들은 vitest의 describe/it/expect를 'vitest'에서 명시적으로 import하므로 globals 설정 없이도 동작한다. 계약 준수: fetchLyrics는 fetchImpl 주입형으로만 테스트(실제 네트워크 호출 금지). extractPalette는 jsdom/canvas 한계로 단위테스트 불가 → loadImage 주입형 시그니처만 구현하고 수동 검증 체크리스트로 대체(스모크 테스트 1개로 throw 경로만 확인). quantize/buildSongColors는 합성 Uint8ClampedArray로 순수 테스트. ensureReadableOnWhite는 밝은 입력 → contrast >= 4.5 되도록 어둡게 하는 동작을 contrastRatio로 검증. 미해결 이슈 없음. extractPalette 실제 ytimg CORS 추출 검증은 Phase 1 리스크(spec §15)이므로 수동 검증 체크리스트에 명시.

**Produces:**
- src/lib/lrclib.ts: export interface LrclibResponse { syncedLyrics: string | null; plainLyrics: string | null; }
- src/lib/lrclib.ts: export interface FetchLyricsParams { artist: string; track: string; album?: string; durationSec?: number; }
- src/lib/lrclib.ts: export async function fetchLyrics(p: FetchLyricsParams, fetchImpl?: typeof fetch): Promise<LrclibResponse | null>
- src/lib/colors.ts: export function hexToRgb(hex: string): [number, number, number]
- src/lib/colors.ts: export function rgbToHex(r: number, g: number, b: number): string
- src/lib/colors.ts: export function rgbToHsl(r: number, g: number, b: number): [number, number, number]
- src/lib/colors.ts: export function hslToRgb(h: number, s: number, l: number): [number, number, number]
- src/lib/colors.ts: export function relativeLuminance(hex: string): number
- src/lib/colors.ts: export function contrastRatio(hexA: string, hexB: string): number
- src/lib/colors.ts: export function clampLightness(hex: string, minL: number, maxL: number): string
- src/lib/colors.ts: export function ensureReadableOnWhite(bgHex: string, minRatio?: number): string
- src/lib/colors.ts: export interface RawPalette { vibrant?: string; darkVibrant?: string; lightVibrant?: string; muted?: string; darkMuted?: string; }
- src/lib/colors.ts: export function quantize(pixels: Uint8ClampedArray, sampleStep?: number): RawPalette
- src/lib/colors.ts: export function buildSongColors(palette: RawPalette): SongColors
- src/lib/colors.ts: export const FALLBACK_COLORS: SongColors
- src/lib/colors.ts: export async function extractPalette(imageUrl: string, loadImage?: (url: string) => Promise<HTMLImageElement>): Promise<RawPalette>

**Consumes:**
- src/types.ts: export interface SongColors { gradientFrom: string; gradientTo: string; accent: string; } (colors.ts imports type SongColors; buildSongColors/FALLBACK_COLORS produce it)
- (테스트 인프라) vitest + jsdom 환경, package.json scripts에 vitest 설정, tsconfig path src/* — 프로젝트 초기 셋업 모듈이 제공한다고 가정

### E-storage-share

**Notes:** 전제: src/types.ts 가 계약대로 존재해야 한다(Song, Playlist, SharedPlaylist 및 하위 SongColors/SongLyrics 등). storage/share 태스크의 테스트 픽스처에서 Song/Playlist 전체 필드를 채우므로 types.ts 가 먼저 생성되어 있어야 한다(types.ts 는 다른 모듈 그룹 담당으로 가정, Consumes 에 명시). 결정론적 테스트를 위해 makeSlug(rand 주입)/createPlaylist(now,rand 주입)를 사용했다. base64url 구현은 jsdom 의 btoa/atob 위에서 +→-, /→_, = 제거로 처리하고 디코드 시 padding 복원한다. decodePlaylist 는 잘못된 base64/JSON, 또는 SharedPlaylist 형태가 아닌 경우(예: songs 배열 아님) 모두 null 을 반환하도록 형태 검증을 포함했다. jsdom 환경(vitest config environment:'jsdom')에서 localStorage/btoa/atob 가 전역 제공된다고 가정한다. makeSlug 의 한글 처리: 영숫자/한글(가-힣)만 남기고 공백→'-', 그 외 제거, 소문자화, 빈 결과면 'list' 기본 stem 사용, 뒤에 rand 4자 접미사 부착으로 충돌 회피.

**Produces:**
- src/lib/storage.ts: export const SONGS_KEY = 'yejin.songs.v1'
- src/lib/storage.ts: export const PLAYLISTS_KEY = 'yejin.playlists.v1'
- src/lib/storage.ts: export function loadSongs(): Record<string, Song>
- src/lib/storage.ts: export function getSong(id: string): Song | undefined
- src/lib/storage.ts: export function saveSong(song: Song): void
- src/lib/storage.ts: export function loadPlaylists(): Playlist[]
- src/lib/storage.ts: export function getPlaylist(id: string): Playlist | undefined
- src/lib/storage.ts: export function savePlaylist(p: Playlist): void
- src/lib/storage.ts: export function deletePlaylist(id: string): void
- src/lib/storage.ts: export function makeSlug(title: string, rand?: () => string): string
- src/lib/storage.ts: export function createPlaylist(title: string, opts?: { now?: () => string; rand?: () => string }): Playlist
- src/lib/share.ts: export function encodePlaylist(p: SharedPlaylist): string
- src/lib/share.ts: export function decodePlaylist(encoded: string): SharedPlaylist | null

**Consumes:**
- src/types.ts: import type { Song, Playlist } from '../types' (storage.ts)
- src/types.ts: import type { SharedPlaylist } from '../types' (share.ts)
- src/types.ts: Song interface { id; title; artist; durationSec; cover; colors; lyrics; resolvedAt }
- src/types.ts: Playlist interface { id; title; message?; coverVideoId?; songIds; createdAt }
- src/types.ts: SharedPlaylist interface { title; message?; songs: { id; title? }[] }

### F-ytPlayer-Playback-hooks

**Notes:** 조립 시 주의점:

1) [PlaybackProvider 마운트 위치] App.tsx가 HashRouter 내부에 PlaybackProvider로 children을 감싸야 함(라우트 전환에도 숨김 div#yt-player 유지). div#yt-player는 Provider가 직접 렌더하므로 index.html에 별도 placeholder 불필요. 단, useSongResolver는 별도 프로브 노드 id='yejin-probe'를 자체적으로 document.body에 동적 생성하므로 충돌 없음(메인 재생과 분리).

2) [계약상 SongLyrics.offsetMs는 필수] buildSongLyrics는 모든 분기에서 offsetMs를 항상 채움(none/plain은 0). 계약의 SongColors.accent도 필수이므로 colors.ts의 buildSongColors/FALLBACK_COLORS가 accent를 항상 제공한다는 전제.

3) [fetchLyrics 인자 형태] 계약의 FetchLyricsParams는 {artist, track, album?, durationSec?}. ResolveDeps.fetchLyrics는 {artist, track, durationSec} 형태로 좁혀 호출하므로 실제 lrclib.fetchLyrics에 그대로 전달 가능(album 생략). album 매칭이 필요하면 후속에서 deps 확장.

4) [createYtPlayer의 playerVars videoId] createYtPlayer는 초기 videoId 없이 생성하고, 곡 로드는 loadVideoById/cueVideoById로 일원화(메인=load, 프로브=cue). buildPlayerVars는 origin에 window.location.origin 사용 — SSR 없음(정적 SPA)이라 안전.

5) [usePlayback 단위테스트의 한계] jsdom에서 createYtPlayer를 mock(never-resolve 또는 stub)하므로 playerRef=null 상태의 상태머신만 검증됨. 실제 재생/ENDED 자동전환/progress 샘플링/한곡·전체·끄기 동작은 수동 검증 체크리스트로 보장(태스크에 포함). renderHook 테스트는 queue/index/repeat/started/getCurrentTime(0) 등 순수 상태 전이만 다룸.

6) [useLyricSync rAF 테스트] requestAnimationFrame/cancelAnimationFrame/performance.now를 vi.stubGlobal로 교체해 결정론적 프레임 구동. 실제 250ms 샘플링 정확도는 수동 검증.

7) [미해결/후속] (a) onError(영상 임베드 차단/삭제) 시 다음 곡 스킵 핸들링은 계약 PlaybackApi에 명시 시그니처가 없어 본 모듈에서 미구현 — 후속 확장 필요(스펙 11절 엣지케이스). (b) prefers-reduced-motion은 컴포넌트(LpDisc/GradientBg) 책임이라 본 모듈 범위 밖. (c) PlaybackProvider의 onReady 직후 자동재생은 모바일 정책상 PlayGate(첫 탭 게이트)가 togglePlay/playQueue를 호출하는 흐름으로 위임 — Provider는 자동으로 playVideo 호출하지 않음.

**Produces:**
- src/lib/ytPlayer.ts: export const YT_STATE = { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 } as const
- src/lib/ytPlayer.ts: export interface YtPlayerVars { playsinline:1; controls:0; rel:0; modestbranding:1; origin:string }
- src/lib/ytPlayer.ts: export function buildPlayerVars(origin: string): YtPlayerVars
- src/lib/ytPlayer.ts: export const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'
- src/lib/ytPlayer.ts: export function ensureIframeApiScript(doc?: Document): boolean
- src/lib/ytPlayer.ts: export interface YtPlayer { loadVideoById(id:string):void; cueVideoById(id:string):void; playVideo():void; pauseVideo():void; seekTo(sec:number):void; getCurrentTime():number; getDuration():number; getVideoData():{video_id:string;title:string;author:string}; getPlayerState():number; destroy():void }
- src/lib/ytPlayer.ts: export interface YtPlayerEvents { onReady?():void; onStateChange?(state:number):void }
- src/lib/ytPlayer.ts: export function createYtPlayer(elementId: string, events: YtPlayerEvents): Promise<YtPlayer>
- src/hooks/useLyricSync.ts: export function computeActiveIndex(sample: TimeSample, now: number, playing: boolean, lines: LyricLine[], offsetMs: number): number
- src/hooks/useLyricSync.ts: export function useLyricSync(getCurrentTime: () => number, isPlaying: boolean, lines: LyricLine[], offsetMs: number): number
- src/hooks/useSongResolver.ts: export function buildSongLyrics(res: LrclibResponse | null): SongLyrics
- src/hooks/useSongResolver.ts: export interface AssembleSongInput { videoId:string; rawTitle:string; author:string; durationSec:number; cover:string; colors:SongColors; lyrics:SongLyrics; now?:()=>string }
- src/hooks/useSongResolver.ts: export function assembleSong(input: AssembleSongInput): Song
- src/hooks/useSongResolver.ts: export interface ResolveDeps { getMeta(videoId:string):Promise<{video_id:string;title:string;author:string;durationSec:number}>; extractPalette(coverUrl:string):Promise<RawPalette>; fetchLyrics(p:{artist:string;track:string;durationSec:number}):Promise<LrclibResponse|null>; saveSong(song:Song):void; now?:()=>string }
- src/hooks/useSongResolver.ts: export async function resolveSongWith(videoId: string, deps: ResolveDeps): Promise<Song>
- src/hooks/useSongResolver.ts: export interface SongResolver { resolve(videoId: string): Promise<Song>; resolving: boolean }
- src/hooks/useSongResolver.ts: export function useSongResolver(): SongResolver
- src/playback/PlaybackContext.tsx: export function cycleRepeatMode(r: RepeatMode): RepeatMode
- src/playback/PlaybackContext.tsx: export type EndedAction = { kind:'replay' } | { kind:'play'; index:number } | { kind:'stop' }
- src/playback/PlaybackContext.tsx: export function endedAction(current: number, length: number, repeat: RepeatMode): EndedAction
- src/playback/PlaybackContext.tsx: export interface PlaybackApi { queue:Song[]; currentIndex:number; current:Song|null; isPlaying:boolean; repeat:RepeatMode; progress:number; duration:number; started:boolean; playQueue(songs:Song[],startIndex?:number):void; togglePlay():void; next():void; prev():void; seek(sec:number):void; cycleRepeat():void; setRepeat(r:RepeatMode):void; getCurrentTime():number }
- src/playback/PlaybackContext.tsx: export function PlaybackProvider(props:{children:React.ReactNode}): JSX.Element
- src/playback/PlaybackContext.tsx: export function usePlayback(): PlaybackApi

**Consumes:**
- src/types.ts: Song, SongColors, SongLyrics, LyricLine, RepeatMode, LyricsType
- src/lib/queue.ts: nextIndex(current, length, repeat), prevIndex(current, length, repeat)
- src/lib/youtube.ts: parseTitleHeuristic(rawTitle, author), thumbnailUrl(videoId, quality?), THUMB_FALLBACK, ParsedTitle
- src/lib/lrc.ts: parseLrc(raw): ParsedLrc, findActiveIndex(lines, t)
- src/lib/time.ts: estimateTime(sample, now, playing), TimeSample
- src/lib/lrclib.ts: fetchLyrics(p, fetchImpl?), LrclibResponse, FetchLyricsParams
- src/lib/colors.ts: extractPalette(imageUrl, loadImage?), buildSongColors(palette), FALLBACK_COLORS, RawPalette
- src/lib/storage.ts: saveSong(song)

### G-components

**Notes:** 조립 시 주의점: (1) 모든 컴포넌트는 default export. 페이지(Player/Editor/Gallery/SharedView)는 `import LpDisc from '../components/LpDisc'` 형태로 import한다. (2) Controls는 `formatTime` named export도 제공하므로 페이지에서 진행시간 표시에 재사용 가능. (3) PasteInput은 useSongResolver 훅에 의존 — 해당 훅이 먼저 구현되어야 PasteInput 스모크 테스트가 통과하므로, useSongResolver를 vi.mock으로 모킹해 테스트를 독립화했다(실제 훅 시그니처는 계약대로 가정). (4) QrShare는 qrcode 패키지가 설치되어 있어야 한다(`npm i qrcode @types/qrcode`); 테스트에서는 vi.mock('qrcode')로 모킹. (5) WAAPI(element.animate), prefers-reduced-motion(matchMedia), navigator.share, canvas/QR 실제 렌더는 jsdom에서 동작하지 않거나 무의미하므로 각 컴포넌트는 (a) DOM/클래스/콜백 단위는 testing-library 스모크 테스트로, (b) 시각/애니메이션/공유는 수동 검증 체크리스트로 분리 검증한다. WAAPI/matchMedia 호출은 jsdom 미지원으로 throw하지 않도록 옵셔널 체이닝/try 가드 처리. (6) 디자인 토큰(--ease-soft 등)과 Tailwind 설정은 index.css/모듈 A 담당이며 여기서는 className/inline-style로 색·그라데이션을 직접 구성해 토큰 미존재에도 렌더 가능. (7) 모든 테스트는 `npx vitest run <경로>`로 개별 실행 가능. 미해결 이슈: 없음 — 8개 컴포넌트 모두 독립 산출물 + 커밋으로 종료.

**Produces:**
- LpDisc: (props: { cover: string; spinning: boolean; accent: string }) => JSX.Element
- GradientBg: (props: { colors: SongColors }) => JSX.Element
- LyricsView: (props: { lyrics: SongLyrics; activeIndex: number }) => JSX.Element
- PlayGate: (props: { cover: string; colors: SongColors; message?: string; onPlay(): void }) => JSX.Element
- Controls: (props: { isPlaying: boolean; repeat: RepeatMode; progress: number; duration: number; onToggle(): void; onNext(): void; onPrev(): void; onSeek(sec: number): void; onCycleRepeat(): void }) => JSX.Element
- SongCard: (props: { song: Song; active?: boolean; onClick?(): void }) => JSX.Element
- PasteInput: (props: { onAdd(song: Song): void }) => JSX.Element
- QrShare: (props: { url: string }) => JSX.Element
- formatTime: (sec: number) => string (helper exported from Controls.tsx)

**Consumes:**
- src/types.ts: SongColors, SongLyrics, Song, RepeatMode, LyricLine, LyricsType
- src/hooks/useSongResolver.ts: useSongResolver(): { resolve(videoId: string): Promise<Song>; resolving: boolean }
- src/lib/youtube.ts: parseVideoId(input: string): string | null
- qrcode (npm): QRCode.toDataURL(text, options?): Promise<string>

### H-pages-routing

**Notes:** 의존성 순서: 이 모듈 그룹(H)은 다른 모든 모듈(types, lib/storage, lib/share, playback/PlaybackContext, hooks/useSongResolver, hooks/useLyricSync, components/*)이 계약대로 먼저 존재해야 통합 동작한다. 그러나 각 태스크는 독립 산출물 + 커밋으로 끝나며, 단위테스트는 (a) usePlaylists 순수 상태 로직과 (b) 각 페이지의 @testing-library 스모크 테스트로 검증한다. 스모크 테스트는 다른 모듈을 vi.mock로 모킹해 H 단독으로도 통과하도록 작성한다(컴포넌트/훅/플레이백 컨텍스트 실물 의존 제거). 전체 E2E(QR진입→재생, 링크추가, 공유)는 수동 검증 체크리스트로 대체.

계약 준수 포인트: (1) 라우팅은 HashRouter + 5개 경로(#/, #/p/:playlistId, #/p/:playlistId/:songId, #/edit/:playlistId, #/s/:encoded). (2) PlaybackProvider는 App 루트에서 Routes를 감싸 라우트 전환에도 숨김 플레이어 1개 유지. (3) usePlayback.getCurrentTime를 useLyricSync에 전달. (4) Editor에서 곡 추가 시 playlist.songIds에 append + savePlaybook 호출하되 usePlayback은 건드리지 않아 현재 재생 유지. (5) SharedView는 decodePlaylist→각 곡 resolve→playQueue, "내 보관함에 저장"은 createPlaylist+songIds.

미해결/주의: usePlaylists의 create()는 storage.createPlaylist를 호출 후 savePlaylist까지 수행한다고 가정(createPlaylist는 객체만 만들 수도 있으므로 안전하게 savePlaylist도 호출). storage.createPlaylist 구현이 내부에서 savePlaylist를 부르지 않는다는 전제. 만약 부른다면 중복 저장이지만 같은 id 교체라 무해. SharedView의 곡 resolve는 storage.getSong 캐시 우선, 없으면 useSongResolver.resolve(videoId) 사용. 컴포넌트 props는 계약 그대로 전달만 하며 H에서 새 prop/타입 도입 없음.

**Produces:**
- src/hooks/usePlaylists.ts: export function usePlaylists(): { playlists: Playlist[]; refresh(): void; create(title: string): Playlist; remove(id: string): void }
- src/App.tsx: export default function App(): JSX.Element
- src/main.tsx: (entry point, renders <App/> into #root)
- src/pages/Gallery.tsx: export default function Gallery(): JSX.Element
- src/pages/Player.tsx: export default function Player(): JSX.Element
- src/pages/Editor.tsx: export default function Editor(): JSX.Element
- src/pages/SharedView.tsx: export default function SharedView(): JSX.Element

**Consumes:**
- src/types.ts: Song, Playlist, SharedPlaylist, RepeatMode, SongLyrics, SongColors
- src/lib/storage.ts: loadPlaylists(), getPlaylist(id), savePlaylist(p), deletePlaylist(id), createPlaylist(title, opts?), getSong(id), saveSong(song)
- src/lib/share.ts: encodePlaylist(p), decodePlaylist(encoded)
- src/playback/PlaybackContext.tsx: PlaybackProvider, usePlayback() -> PlaybackApi
- src/hooks/useSongResolver.ts: useSongResolver() -> { resolve(videoId): Promise<Song>, resolving }
- src/hooks/useLyricSync.ts: useLyricSync(getCurrentTime, isPlaying, lines, offsetMs) -> number
- src/components/GradientBg.tsx: { colors }
- src/components/LpDisc.tsx: { cover, spinning, accent }
- src/components/LyricsView.tsx: { lyrics, activeIndex }
- src/components/PlayGate.tsx: { cover, colors, message?, onPlay }
- src/components/Controls.tsx: { isPlaying, repeat, progress, duration, onToggle, onNext, onPrev, onSeek, onCycleRepeat }
- src/components/SongCard.tsx: { song, active?, onClick? }
- src/components/PasteInput.tsx: { onAdd(song) }
- src/components/QrShare.tsx: { url }
- react-router-dom v6: HashRouter, MemoryRouter, Routes, Route, useParams, useNavigate, Link, Navigate
