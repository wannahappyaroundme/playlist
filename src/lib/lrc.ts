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
