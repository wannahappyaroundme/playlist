export const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(id: string | null | undefined): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

function isValidId(id: string | null | undefined): id is string {
  return isVideoId(id);
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

// Lower-quality fallback that ytimg serves for nearly every video.
const COVER_FALLBACK_QUALITY: ThumbQuality = 'hqdefault';

/**
 * One-shot <img onError> fallback for cover thumbnails. On the first failure it
 * downgrades a ytimg thumbnail to hqdefault (almost always present); subsequent
 * failures are ignored (guarded by a data-fallback flag) so it never loops.
 */
export function fallbackCoverSrc(el: HTMLImageElement): void {
  if (el.dataset.coverFallback === 'done') return;
  el.dataset.coverFallback = 'done';
  // rewrite the ytimg quality segment to hqdefault; if it's not a recognizable
  // ytimg thumbnail, leave the src as-is (already flagged so we won't retry).
  const m = el.src.match(/^(https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/)[^/]+\.jpg$/);
  if (m) el.src = `${m[1]}${COVER_FALLBACK_QUALITY}.jpg`;
}

// ytimg placeholder('찾을 수 없음')는 120x90. naturalWidth가 이 이하면 무효로 간주.
const PLACEHOLDER_MAX_WIDTH = 120;

function defaultThumbLoader(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`thumbnail load failed: ${url}`));
    img.src = url;
  });
}

/**
 * THUMB_FALLBACK(maxres→sd→hq→mq) 순서로 시도해 처음으로 '진짜' 이미지가 로드되는
 * quality URL을 반환한다. 로드 실패(404) 또는 placeholder(naturalWidth ≤ 120)는 실패로 보고
 * 다음 품질로 넘어간다. 전부 실패하면 거의 항상 존재하는 hqdefault를 최후 보루로 반환.
 * 커버 표시와 색추출 양쪽에서 같은 URL을 쓰기 위한 순수 선택 로직(로더 주입 가능).
 */
export async function resolveBestThumbnail(
  videoId: string,
  load: (url: string) => Promise<HTMLImageElement> = defaultThumbLoader,
): Promise<string> {
  for (const q of THUMB_FALLBACK) {
    const url = thumbnailUrl(videoId, q);
    try {
      const img = await load(url);
      if ((img.naturalWidth || 0) > PLACEHOLDER_MAX_WIDTH) return url;
    } catch {
      /* try next quality */
    }
  }
  return thumbnailUrl(videoId, 'hqdefault');
}

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

// 파이프(`|` 또는 fullwidth `ㅣ` U+3163) 뒤에 붙는 가사영상 꼬리표 토큰.
// 예) "...ㅣLyrics/가사", "... | Official", "...ㅣ뮤직비디오"
const PIPE_SUFFIX_MARKERS = [
  'official\\s*music\\s*video',
  'official\\s*video',
  'official\\s*audio',
  'official\\s*lyric[s]?\\s*video',
  'official',
  'lyric[s]?\\s*video',
  'lyric[s]?',
  '가사',
  'audio',
  'visualizer',
  'm\\s*/?\\s*v',
  'mv',
  '뮤직비디오',
  '4k',
  'hd',
  'hq',
];

// `|` 또는 `ㅣ`(U+3163) 이후가 노이즈 토큰(슬래시로 여러 개 연결 포함)으로만 이뤄진 꼬리표를 끝까지 제거.
const PIPE_NOISE_SUFFIX_RE = new RegExp(
  `\\s*[|\\u3163]\\s*(?:${PIPE_SUFFIX_MARKERS.join('|')})(?:\\s*[/／]\\s*(?:${PIPE_SUFFIX_MARKERS.join('|')}))*\\s*$`,
  'gi',
);

// (...) 또는 [...] 안에 노이즈 마커가 들어있으면 통째로 제거
const NOISE_GROUP_RE = new RegExp(
  `[\\(\\[]\\s*(?:${NOISE_MARKERS.join('|')})\\s*[\\)\\]]`,
  'gi',
);

// 모든 괄호류 묶음: [...], (...), 【...】 (중첩 없는 단일 레벨)
const BRACKET_GROUP_RE = /[[(【][^\][)】]*[\])】]/g;

function stripNoise(s: string): string {
  return (s ?? '')
    // 1) 파이프(`|`/`ㅣ`) 뒤 가사영상 꼬리표 제거 (반복 적용으로 다중 꼬리표 대응)
    .replace(PIPE_NOISE_SUFFIX_RE, ' ')
    .replace(PIPE_NOISE_SUFFIX_RE, ' ')
    // 2) 키워드 노이즈 괄호 제거 (호환 유지)
    .replace(NOISE_GROUP_RE, ' ')
    // 3) 남은 모든 괄호/대괄호/【】 묶음 제거 (중복·꼬리 세그먼트 정리)
    .replace(BRACKET_GROUP_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 공백-구분자-공백: hyphen/en-dash/em-dash + underscore(_)/middle-dot(·) 첫 등장
// (유튜브 제목은 "아티스트 _ 제목", "아티스트 · 제목"도 흔하다)
const SEP_RE = /\s[-–—_·]\s/;

// 폴백 title에서 매달린 구분자(앞/뒤 ` - `, ` _ `, ` · ` 등)를 제거
function stripDanglingSeparator(s: string): string {
  return s
    .replace(/^[\s\-–—_·]+/, '')
    .replace(/[\s\-–—_·]+$/, '')
    .trim();
}

// 'Artist - Topic' 자동생성 채널, 'VEVO' 접미사를 제거해 순수 아티스트명만 남긴다.
export function cleanAuthor(author: string): string {
  return (author ?? '')
    .replace(/\s*[-–—]\s*Topic\s*$/i, '')
    .replace(/\s*[-–—]\s*토픽\s*$/i, '')
    .replace(/VEVO\s*$/i, '')
    .trim();
}

export function parseTitleHeuristic(rawTitle: string, author: string): ParsedTitle {
  const cleaned = stripNoise(rawTitle ?? '');
  const authorClean = cleanAuthor(author) || 'Unknown';
  const fallbackTitle =
    stripDanglingSeparator(cleaned) || (rawTitle ?? '').trim() || 'Untitled';
  const fallback: ParsedTitle = {
    artist: authorClean,
    title: fallbackTitle,
  };

  const m = SEP_RE.exec(cleaned);
  if (!m) return fallback;

  const idx = m.index;
  const left = cleaned.slice(0, idx).trim();
  const right = cleaned.slice(idx + m[0].length).trim();

  if (!left || !right) return fallback;

  return { artist: left, title: right };
}

export interface YoutubeMeta {
  title: string;
  author: string;
  /** oEmbed 401/403/404 등으로 정보를 못 가져옴(임베드 불가/비공개/삭제 추정). */
  unavailable: boolean;
}

export function oembedUrl(videoId: string): string {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
}

export function parseOembedMeta(
  json: { title?: unknown; author_name?: unknown } | null,
): { title: string; author: string } {
  const title = json && typeof json.title === 'string' ? json.title : '';
  const author = json && typeof json.author_name === 'string' ? json.author_name : '';
  return { title, author };
}

/**
 * 링크(영상 ID)로 YouTube oEmbed에서 제목/아티스트를 직접 가져온다.
 * 플레이어 getVideoData(반정식·타이밍 불안정 → '직전 곡 제목 오염') 대신 사용한다.
 * youtube.com/oembed는 브라우저 CORS 허용(실측). 401/403/404 → 임베드불가/비공개/삭제로 unavailable.
 */
export async function fetchYoutubeMeta(
  videoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<YoutubeMeta> {
  try {
    const res = await fetchImpl(oembedUrl(videoId), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const unavailable = res.status === 401 || res.status === 403 || res.status === 404;
      return { title: '', author: '', unavailable };
    }
    const json = await res.json().catch(() => null);
    const { title, author } = parseOembedMeta(json);
    return { title, author, unavailable: !title };
  } catch {
    return { title: '', author: '', unavailable: false };
  }
}
