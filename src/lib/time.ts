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
