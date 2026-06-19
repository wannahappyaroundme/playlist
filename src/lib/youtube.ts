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

// 공백-구분자-공백 (hyphen, en-dash, em-dash) 첫 등장
const SEP_RE = /\s[-–—]\s/;

// 폴백 title에서 매달린 구분자(앞/뒤 ` - `, ` – `, ` — `, 또는 경계의 dash)를 제거
function stripDanglingSeparator(s: string): string {
  return s
    .replace(/^[\s-–—]+/, '')
    .replace(/[\s-–—]+$/, '')
    .trim();
}

export function parseTitleHeuristic(rawTitle: string, author: string): ParsedTitle {
  const cleaned = stripNoise(rawTitle ?? '');
  const authorClean = (author ?? '').trim() || 'Unknown';
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
