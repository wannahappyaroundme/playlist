# Yejin Playlist — 설계 문서 (Phase 0)

- 문서 버전: v1
- 작성일: 2026-06-20
- 상태: 설계 합의용 (구현 계획 작성 전 검토 대상)
- 제품명(가명): **Yejin Playlist** — 언제든 변경 가능

---

## 1. 한 줄 정의

> **YouTube 링크를 홈페이지에 붙여넣으면 만들어지는, QR로 건네는 LP 가사 비주얼라이저.**
> 좌측엔 앨범커버+LP가 맞물려 돌고, 우측엔 싱크 가사가 흰색/회색으로 흐르며, 배경은 그 곡의 색으로 물든다.
> 백엔드 없이 GitHub Pages에 0원 배포. 곡 추가·플레이리스트 구성·공유까지 전부 브라우저 안에서.

---

## 2. 핵심 결정 (확정)

| # | 결정 | 근거 |
|---|---|---|
| 1 | **음원 = YouTube IFrame Player(숨김 재생)** | 다운로드 안 함(약관 준수), 무료, 재생은 Data API 쿼터 미소모 |
| 2 | **모든 데이터 = 런타임 브라우저에서 처리** | 곡 추가를 홈페이지에서 직접 하기 위함. 서버/빌드 불필요 |
| 3 | **곡 추가 = 홈페이지 입력칸에 링크 붙여넣기** | 터미널·재배포 없음. PM 핵심 요구 |
| 4 | **저장 = localStorage(이 브라우저)** | 백엔드 0. 개인 큐레이션용 |
| 5 | **공유 = 플레이리스트를 URL에 인코딩한 링크/QR** | 받는 사람이 링크만 열면 복원·재생. 백엔드 0 |
| 6 | **가사 = LRCLIB 런타임 fetch** | 무료·키 불필요·CORS 열림(실측 확인). 없으면 우아하게 폴백 |
| 7 | **대표색 = 썸네일 canvas 추출 + 명도 클램프** | 흰 가사 가독성 보장 위해 어둡게 보정 |
| 8 | **자동재생 대신 '첫 탭 게이트'** | 모바일 무음 정책 → 큰 ▶ 버튼 1개로 흡수 |
| 9 | **스택 = Vite + React + TS + Tailwind 정적 SPA** | 단일 인터랙티브 앱, GitHub Pages 적합도 최상 |
| 10 | **시작 화면 타이틀 = "Yejin Playlist"** | 플레이리스트 갤러리 홈의 브랜드 |
| 11 | **모션 = 은은하게** | LP는 돌되 배경·글로우는 절제. 추후 quiet 모드 여지 |
| 12 | **대상 = 개인·지인 / 백그라운드 재생 한계 수용** | 모바일 화면 끄면 멈춤(데스크탑 백그라운드 탭은 유지) |
| 13 | **재생 모드 = 전체재생 / 한곡재생 / 반복(전체·한곡)** | 표준 플레이어 컨트롤. 곡 추가 중에도 현재 재생은 끊기지 않고 유지 |

### 명시적으로 채택하지 않은 것 (그리고 이유)
- ❌ 빌드타임 `npm run add` 스크립트 / repo JSON에 굽기 → 홈페이지 직접 추가로 대체
- ❌ 클라우드 DB(Supabase/Firebase) → 개인용엔 과함, 백엔드 0 유지
- ❌ 로그인/회원 → QR/링크로 충분
- ❌ 오디오 다운로드/추출 → 약관 위반(절대 금지)

---

## 3. 아키텍처 개요

정적 사이트는 **"앱 껍데기"만** GitHub Pages에 배포된다. 모든 콘텐츠(곡·플레이리스트·가사·색)는 **방문자 브라우저 안에서 런타임 생성**되고 localStorage에 캐시된다. 서버·DB·API 키가 전혀 없다.

```
[ 곡 추가 — 홈페이지에서 직접 ]                  [ 저장 & 공유 ]
 입력칸에 YouTube 링크 붙여넣기                    플레이리스트 → localStorage(이 브라우저)
        │                                          "공유 QR 만들기" → 내용을 링크에 통째로 인코딩
        ▼ (브라우저가 즉시 resolve)                       │
 ┌──────────────────────────────┐                        ▼
 │ • 영상ID 파싱                │                  받는 사람이 QR/링크 열기
 │ • 제목/아티스트 ← getVideoData│                        │
 │ • 커버 ← 썸네일 URL          │                        ▼ (링크에서 플레이리스트 복원)
 │ • 대표색 ← canvas 추출       │                  곡들을 실시간 재생 + 가사·색 재구성
 │ • 싱크가사 ← LRCLIB fetch    │                  (원하면 "내 보관함에 저장")
 │ → localStorage 곡 풀에 캐시  │
 └──────────────────────────────┘
        ▼
 플레이리스트에 곡 추가 (여러 개 가능)
```

### 런타임 데이터 출처 (전부 브라우저, 서버 0)
| 데이터 | 출처 | 키 필요 | 비고 |
|---|---|---|---|
| 재생 | YouTube IFrame Player API | ❌ | 숨김 재생, 오디오만 사용 |
| 제목/아티스트 | `player.getVideoData()` | ❌ | iframe 브리지로 전달(CORS 무관). 반정식 메서드지만 안정적 |
| 영상 길이 | `player.getDuration()` | ❌ | 가사 매칭·시크바용 |
| 앨범커버 | `https://i.ytimg.com/vi/{id}/{quality}.jpg` | ❌ | maxres→sd→hq→mq 폴백, placeholder(약 1KB) 걸러내기 |
| 대표색 | 썸네일 → canvas 픽셀 추출 | ❌ | ytimg CORS는 Phase 1에서 1회 검증(아래 리스크) |
| 싱크 가사 | `https://lrclib.net/api/get` (+ `/api/search`) | ❌ | CORS 열림 실측 확인. `Lrclib-Client` 헤더 매너상 첨부 |

---

## 4. 데이터 모델 (localStorage + URL 인코딩)

곡의 무거운 데이터(가사·색)는 **곡 풀**에 videoId로 캐시해 재사용하고, **플레이리스트**는 가벼운 큐레이션(순서·제목·메시지)만 담는다.

```ts
// 곡 풀: videoId → 해석된 곡 데이터 (localStorage 'yejin.songs', 재해석 가능한 캐시)
interface Song {
  id: string;                 // youtube videoId (고유키)
  title: string;
  artist: string;
  durationSec: number;
  cover: string;              // 썸네일 URL (또는 dataURL 캐시)
  colors: {                   // 명도 클램프 적용 hex (흰 가사 대비 보장)
    gradientFrom: string;
    gradientTo: string;
    accent?: string;
  };
  lyrics: {
    type: 'synced' | 'plain' | 'none';
    synced?: { time: number; text: string }[];   // time = 초(float)
    plain?: string;
    source: 'lrclib' | 'manual' | 'none';
    offsetMs?: number;        // 싱크 미세 보정(수동)
  };
  resolvedAt: string;         // ISO, 캐시 신선도 판단용
}

// 플레이리스트: 큐레이션 (localStorage 'yejin.playlists')
interface Playlist {
  id: string;                 // slug (URL용)
  title: string;
  message?: string;           // 받는이에게 보내는 한 줄 (선택)
  coverVideoId?: string;      // 대표곡 썸네일
  songIds: string[];          // 곡 순서
  createdAt: string;
}
```

### 공유 링크 인코딩
- "공유 QR 만들기" → `{title, message, songs: [{id, title?}]}` 를 압축해 URL 해시에 인코딩
  예: `https://<user>.github.io/yejin-playlist/#/s/<base64url(JSON)>`
- 받는 사람이 링크 열기 → 앱이 해시에서 플레이리스트 복원 → 곡별 커버·색·가사를 런타임 재해석 → 재생
- videoId는 11자라 곡 20개라도 URL 길이 문제 없음(제목 포함 시 약간 길어짐 → 제목 생략 옵션)
- 받는 사람은 "내 보관함에 저장" 시 자신의 localStorage로 복사 가능

---

## 5. 화면 구성 & 라우팅

해시 라우팅 사용(GitHub Pages 새로고침 404 회피).

| 경로 | 화면 | 설명 |
|---|---|---|
| `#/` | **갤러리 (홈, "Yejin Playlist")** | 내 플레이리스트 카드 목록 + "새 플레이리스트" |
| `#/p/:playlistId` | **플레이어** | 첫 곡부터 재생, 좌 LP / 우 가사 |
| `#/p/:playlistId/:songId` | **플레이어(딥링크)** | 특정 곡으로 바로 진입 |
| `#/edit/:playlistId` | **편집기** | 링크 붙여넣기로 곡 추가/삭제/순서변경, 제목·메시지 편집, "공유 QR 만들기" |
| `#/s/:encoded` | **공유 보기** | 링크에 인코딩된 플레이리스트 복원·재생(view 우선) |

---

## 6. UX 플로우

### (A) 곡 추가 — 홈페이지에서 직접 (핵심)
1. 갤러리에서 플레이리스트 생성/선택 → 편집기 진입
2. 입력칸에 YouTube 링크 붙여넣기(여러 줄 한 번에 가능)
3. 브라우저가 즉시: videoId 파싱 → 숨김 플레이어에 cue → `getVideoData()`로 제목/아티스트, `getDuration()`으로 길이 → 썸네일 색 추출 → LRCLIB 가사 조회
4. 편집기에 **곡 프리뷰 카드**(커버·제목·아티스트·"싱크가사 있음/없음" 배지) 표시, 제목/아티스트는 수정 가능
5. 확인 → 곡 풀에 캐시 + 플레이리스트에 순서대로 추가
6. 실패 항목(가사 없음/메타 실패)도 곡은 추가되되 배지로 표시(graceful)

### (B) 감상 — QR 진입
1. QR 스캔 → 공유 링크(`#/s/...`) 또는 사이트 진입
2. 첫 화면: 곡 대표색 그라데이션이 깔린 채 등장 + (있으면)보낸이 메시지 + LP 중앙에 박동하는 ▶ 1개
3. ▶ 탭(첫 제스처) → 재생 시작: LP 회전 + 가사 첫 줄 흰색으로 등장
4. 감상: LP 회전 + 추출색 배경 + 싱크 가사(현재 흰색 / 전후 회색, 위로 밀림)
5. 곡 끝/넘김 → 다음 곡 자동 전환(배경색 크로스페이드)

### (C) 공유
1. 편집기에서 "공유 QR 만들기" → 플레이리스트를 링크에 인코딩 → QR 이미지 생성(클라이언트 `qrcode`)
2. Web Share API(`navigator.share`)로 카톡/문자/DM 공유 또는 QR 이미지 저장
3. 받는 사람: 링크 열기 → 복원·재생 → (선택) 내 보관함에 저장

### (D) 재생 제어 (재생 모드)
- **재생 컨트롤**: 재생/일시정지, 이전곡/다음곡, 진행바(시크)
- **반복 모드 토글** (3단계 순환): `반복 끄기` → `전체 반복(🔁)` → `한곡 반복(🔂)`
  - 반복 끄기: 플레이리스트 끝까지 순차 재생 후 정지
  - 전체 반복: 마지막 곡 끝 → 첫 곡으로 루프
  - 한곡 반복: 현재 곡이 끝나면 같은 곡 다시 재생
- **한곡 재생**: 공유 링크가 한 곡이거나, 한 곡만 선택해 들을 때 그 곡만 재생(반복 모드와 조합 가능)
- **곡 추가 중 재생 유지**: 편집기에서 링크를 붙여넣어 곡을 추가하는 동안에도 현재 재생 중인 곡은 끊기지 않는다(플레이어 인스턴스는 편집기/플레이어 전환과 무관하게 유지). 새로 추가한 곡은 플레이리스트 끝에 붙고, 사용자가 선택하기 전까지 현재 재생을 방해하지 않는다.

---

## 7. 디자인 명세 (은은한 톤)

무드: **'심야의 LP 라운지'** — 어두운 배경 위 곡의 색이 번지고 가사가 빛처럼 떠 있음. 화려함보다 몰입·가독성.

### 좌측 LP + 앨범커버
- 커버(정사각)와 LP(원형) **같은 지름**, LP를 커버 위로 **40~45% 슬라이드 오버랩**(슬리브에서 판 빼낸 메타포)
- LP: 검정 비닐 그루브 텍스처(`repeating-radial-gradient`) + 중앙 커버 라벨(지름 32%) + 광택 띠(`conic-gradient`)
- 회전: 등속 `linear`, 1회전 ≈ 5초. 재생/정지는 Web Animations API `playbackRate` 0↔1을 0.7~0.9s ease로 보간(관성 스핀업/다운)
- `animation-play-state`만 토글하면 뚝 끊기므로 금지

### 우측 싱크 가사
- 현재 줄을 **수직 중앙 고정**, 가사 컨테이너 전체를 `translateY`로 밀어 올림(개별 줄 아님 → 성능·유지보수 유리), `transition` 한 번만
- 단계적 명도: 현재 흰색(1.0) → ±1(.55) → ±2(.28) → 그 외(.14), 양끝 `mask-image` 페이드
- 활성 줄: 크기↑(scale/font) + 추출색(`accent`) 섞은 은은한 글로우(곡마다 다른 빛)
- 랩/속사포 대비: 전환시간을 다음 줄까지 남은 시간으로 클램프 `dur = min(550ms, gap*0.8)`
- 간주/무가사: 미니멀 펄스 인디케이터(♪)

### 배경 그라데이션
- 다중 `radial-gradient` 겹친 메시 그라데이션(단색 리니어 금지)
- 곡 전환: CSS 변수 보간(탁해짐) 대신 **배경 레이어 2장 크로스페이드**(1.2s)
- 가독성: 가사 영역 어둠막 오버레이 + 보수적 `backdrop-filter` blur(2~4px)
- 명도 가드: 추출색이 너무 밝으면 `color-mix`로 자동 어둡게 → 흰 가사 WCAG 대비 확보

### 반응형
- `≥900px`: 좌우 분할(LP 46% / 가사 54%)
- `<900px`: 상하 스택(LP 40% / 가사 50% / 컨트롤 하단 sticky, `env(safe-area-inset-bottom)`)
- CSS Grid template 교체, LP 스케일/겹침은 컨테이너 쿼리

### 타이포 & 접근성
- 폰트: **Pretendard**(한글 가변, 무료), `font-display:swap`, 가중치 서브셋
- 진행시간 `tabular-nums`
- 컨트롤: 절제된 글래스모피즘(backdrop blur), 진행바는 accent색. 재생/일시정지·이전·다음 + **반복 모드 토글(끄기/전체🔁/한곡🔂)**, 현재 모드는 아이콘 강조로 표시
- `prefers-reduced-motion: reduce` → 회전·배경 drift·줄 scale 정지, 색 전환만 유지

---

## 8. 폴더 구조

```
yejin-playlist/
├─ index.html
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ pages/{Gallery, Player, Editor, SharedView}.tsx
│  ├─ components/{LpDisc, AlbumCover, LyricsView, GradientBg, PlayGate, Controls, SongCard, PasteInput, QrShare}.tsx
│  ├─ hooks/{useYouTubePlayer, useLyricSync, usePlaylists, useSongResolver}.ts
│  ├─ lib/
│  │  ├─ youtube.ts        # videoId 파싱, getVideoData, 썸네일 폴백
│  │  ├─ lrclib.ts         # /api/get, /api/search
│  │  ├─ colors.ts         # canvas 추출 + 명도 클램프 + 폴백
│  │  ├─ lrc.ts            # LRC 파싱 + 이진탐색
│  │  ├─ time.ts           # getCurrentTime 보간
│  │  ├─ storage.ts        # localStorage 곡 풀/플레이리스트
│  │  └─ share.ts          # 플레이리스트 ↔ URL 인코딩/디코딩
│  └─ types.ts
├─ .github/workflows/deploy.yml
├─ vite.config.ts          # base: '/yejin-playlist/'
└─ docs/superpowers/specs/  # 이 문서
```

---

## 9. 핵심 기술 메커니즘

### 재생 ↔ LP/가사 동기화
- `onStateChange`를 단일 진실 공급원으로: PLAYING(1)→회전·가사루프 시작, PAUSED(2)/BUFFERING(3)→정지, ENDED(0)→재생 모드에 따라 분기
- **ENDED 분기(재생 모드)**: 한곡 반복 → `seekTo(0)+playVideo` 또는 `loadVideoById(같은 곡)` / 전체 반복 → 다음 곡(마지막이면 첫 곡) / 반복 끄기 → 다음 곡, 마지막 곡이면 정지(▶ 노출). 플레이어 인스턴스 1개를 재사용하며 곡 전환은 `loadVideoById`
- iOS: 플레이어 인스턴스 1개 재사용 + `playsinline:1`, `controls:0`, `origin` 지정. 첫 제스처 이후 후속 자동전환 허용

### 가사 싱크 엔진
- rAF 루프에서 `getCurrentTime()` **250ms마다 샘플링** + `performance.now()` 델타로 보간 → 60fps 부드러움 + 폴링 비용 최소
- 활성 줄: 이진탐색(또는 직전 인덱스 인접 캐시 탐색), 인덱스 변경 시에만 setState
- LRC 파싱: `[mm:ss.xx]` → 초(float) 변환, 멀티 타임태그/`offset` 태그 처리

### 곡 추가 resolve 파이프라인 (런타임)
1. videoId 파싱 → 2. 숨김 플레이어 cue → `getVideoData`/`getDuration` → 3. 제목에서 "Artist - Title" 휴리스틱(편집 가능) → 4. 썸네일 폴백 체인 + canvas 색 추출(클램프) → 5. LRCLIB `/api/get`(artist/title/duration ±2초), 실패 시 `/api/search` → 6. 곡 풀 캐시 + 플레이리스트 append

---

## 10. 배포 & QR

- `vite.config.ts` `base: '/<repo-name>/'` (프로젝트 페이지). 커스텀 도메인/루트면 `'/'`
- GitHub Actions: checkout → setup-node → `npm ci` → `npm run build` → `upload-pages-artifact` → `deploy-pages`
- SPA 404 대비: `dist/404.html`을 `index.html` 복사(해시 라우팅이라 대체로 불필요하나 안전장치)
- QR: 클라이언트 `qrcode` 라이브러리로 공유 링크를 즉석 생성(편집기 "공유 QR 만들기")

---

## 11. 엣지케이스 / Graceful Degradation

| 상황 | 처리 |
|---|---|
| 가사 매칭 실패/없음 | `type:none` → "가사를 찾지 못했어요" + LP·색 배경 정상(재생 유지) |
| 평문 가사 | `type:plain` → 정적 스크롤뷰 + "동기화 아님" 배지 |
| 영상↔가사 길이 불일치 | `offsetMs` 수동 보정, 가사 끝은 LRC 마지막 기준, 곡 종료는 `ENDED` |
| 모바일 자동재생 차단 | 첫 탭 게이트(표준 패턴), `onAutoplayBlocked`시 버튼 재노출 |
| 영상 임베드 차단/삭제 | `onError` → "재생 불가" 표시 + 다음 곡 스킵 |
| 썸네일 색추출 CORS 실패 | 폴백 팔레트(딥 네이비/보라)로 강등, 앱은 정상 |
| localStorage 비어있음(새 방문자) | 빈 갤러리 + "새 플레이리스트" 온보딩, 또는 공유 링크면 그 내용 표시 |

---

## 12. 비용 & 법적 안전선

- **비용: 0원, 카드 등록 불필요.** GitHub Pages·LRCLIB·YouTube 임베드 모두 무료, API 키 없음
- **넘지 말아야 할 선 4개:** ① 오디오 다운로드/추출 금지(절대선) ② 불특정 공개+수익화 금지 ③ 가사 대량 재배포 금지 ④ "무료 음악 듣기" 식 홍보 금지
- 개인·지인 비상업 범위에서 형사/소송 리스크 무시 가능. 실질 리스크는 '특정 영상 임베드 차단' 가용성 이슈

---

## 13. 로드맵 (총 4~6주, 집중 2주)

| Phase | 내용 | 소요 |
|---|---|---|
| **0 기획** | 이 설계서 확정 (현재) | 1~2일 |
| **1 코어** | IFrame 재생 + 재생 모드(전체/한곡/반복) + LP 회전 + 싱크 가사 엔진 + 추출색 배경 + 갤러리/플레이어 + 반응형 + 배포 | 1~2주 |
| **2 추가/공유** | 편집기(링크 붙여넣기 곡 추가) + localStorage + URL 인코딩 공유 + QR + LRCLIB 폴백 | 3~5일 |
| **3 폴리시** | 가사 없는 곡 UX, 로딩/에러, 타이포 디테일, 보낸이 메시지, quiet 모드 여지, README | 2~3일 |

⚠️ 일정 최대 함정: 'LP 맞물림 레이아웃' + '가사 싱크 스크롤 애니메이션' → 버퍼 +30%.

---

## 14. 성공 기준

1. 내가 좋아하는 곡 10~20개 추가 시 80%+ 싱크 가사 정상
2. 'LP 돌아가는 화면 + 추출색 배경'이 실제로 보기 좋아 다시 켜고 싶음
3. 비용 0 유지, 곡 추가가 홈페이지에서 몇 번 붙여넣기로 끝남
4. 지인에게 QR/링크 보냈을 때 그대로 열려 재생됨
5. 6개월 후에도 안 깨지고 살아 있음

---

## 15. 확인이 필요한 리스크 (Phase 1 초기 검증)

- **ytimg 썸네일 canvas CORS**: 익명 canvas 읽기 허용 여부 1회 검증. 막히면 폴백 팔레트 또는 무료 이미지 프록시(weserv 등) 검토(외부 의존 최소화 원칙)
- **`getVideoData()` 안정성**: 반정식 메서드 — 깨질 경우 제목 수동 입력 폴백
- **공유 URL 길이**: 곡 많을 때 제목 생략/압축 적용
- **LRCLIB 가용성**: 런타임 의존이므로 다운 시 그 세션 가사 미표시(graceful). 한 번 본 가사는 곡 풀 캐시로 유지
