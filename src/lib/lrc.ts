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
