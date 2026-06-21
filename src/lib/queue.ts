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

/**
 * 셔플용 다음 인덱스. length>1이면 current와 다른 [0,length) 임의 인덱스를 반환한다.
 * length<=1이면 current(또는 0), current가 범위를 벗어나면 유효 인덱스를 보장한다.
 * rand는 [0,1) 난수 주입(테스트 결정성). current를 건너뛰기 위해 [0,length-1)에서
 * 뽑은 뒤 current 이상이면 +1 한다(균등 분포 유지).
 */
export function nextShuffleIndex(
  current: number,
  length: number,
  rand: () => number,
): number {
  if (length <= 0) return 0;
  if (length === 1) return 0;
  // current가 범위를 벗어나면 단순히 [0,length) 임의 인덱스를 반환(건너뛸 current가 없음).
  if (current < 0 || current >= length) {
    return Math.min(length - 1, Math.floor(rand() * length));
  }
  // [0,length-1)에서 뽑고 current 이상이면 +1 → current를 건너뛴 균등 분포.
  let pick = Math.floor(rand() * (length - 1));
  if (pick >= length - 1) pick = length - 2; // rand()가 1에 근접한 경우의 가드
  if (pick >= current) pick += 1;
  return pick;
}
