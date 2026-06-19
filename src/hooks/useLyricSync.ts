import { useEffect, useRef, useState } from 'react';
import { estimateTime, type TimeSample } from '../lib/time';
import { findActiveIndex } from '../lib/lrc';
import type { LyricLine } from '../types';

/**
 * 보간된 재생 시각으로 활성 가사 인덱스를 계산하는 순수 헬퍼.
 * estimateTime(sample, now, playing)로 현재 재생초를 추정하고,
 * offsetMs/1000을 더해 보정한 뒤 findActiveIndex로 인덱스를 찾는다.
 * 첫 줄 전이면 -1, 빈 lines면 -1.
 */
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

const SAMPLE_INTERVAL_MS = 250;
// 보간값과 실제 getCurrentTime이 이만큼(초) 이상 벌어지면 즉시 재동기화(seek/드리프트 대응).
const RESYNC_THRESHOLD_SEC = 0.4;

/**
 * 재생 중에는 rAF 루프로 250ms마다 getCurrentTime을 샘플링하고
 * 매 프레임 computeActiveIndex로 보간해 활성 가사 인덱스를 반환한다.
 * 인덱스가 바뀔 때만 setState하며, isPlaying=false면 루프를 정지한다.
 */
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
      const intervalElapsed = now - lastSampledAtRef.current >= SAMPLE_INTERVAL_MS;
      // 보간 추정치가 실제 재생 위치에서 크게 벗어났으면(seek/일시정지 복귀) 즉시 재샘플.
      const estimated = estimateTime(sampleRef.current, now, true);
      const drifted = Math.abs(getCurrentTime() - estimated) >= RESYNC_THRESHOLD_SEC;
      if (intervalElapsed || drifted) {
        sampleRef.current = { time: getCurrentTime(), at: now };
        lastSampledAtRef.current = now;
      }
      const next = computeActiveIndex(sampleRef.current, now, true, lines, offsetMs);
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
