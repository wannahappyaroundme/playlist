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
