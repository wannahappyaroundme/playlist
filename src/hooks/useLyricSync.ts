import { useEffect, useRef, useState } from 'react';
import { estimateTime, type TimeSample } from '../lib/time';
import { findActiveIndex } from '../lib/lrc';
import type { LyricLine } from '../types';

// 추정 시각이 마지막 줄 시각 + 이 여유(초)를 넘으면 '이전 곡의 잔여 위치'로 간주(stale).
const STALE_GRACE_SEC = 2;

/**
 * 보간된 재생 시각으로 활성 가사 인덱스를 계산하는 순수 헬퍼.
 * estimateTime(sample, now, playing)로 현재 재생초를 추정하고,
 * offsetMs/1000을 더해 보정한 뒤 findActiveIndex로 인덱스를 찾는다.
 * 첫 줄 전이면 -1, 빈 lines면 -1.
 * 곡 전환 직후 stale 샘플(마지막 줄 시각 + 2s 초과)이면 -1로 둬 끝줄로 튀는 것을 막는다.
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
  const lastLineTime = lines[lines.length - 1].time;
  // 이전 곡 위치로 추정되는 stale 샘플: 시간이 정상 범위로 돌아올 때까지 활성 인덱스 보류.
  if (t > lastLineTime + STALE_GRACE_SEC) return -1;
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
  // 광고/메타로딩 등으로 '진짜 곡'이 아직 재생 전이면 false를 반환. 그동안 가사 시계를 멈추고
  // 첫 줄을 유지하다가, 곡이 시작(true)되면 그 시점 getCurrentTime(보통 ~0)부터 재동기화한다.
  contentReady?: () => boolean,
): number {
  const [activeIndex, setActiveIndex] = useState(-1);
  const sampleRef = useRef<TimeSample>({ time: 0, at: 0 });
  const lastSampledAtRef = useRef(0);
  const indexRef = useRef(-1);
  const primedRef = useRef(false);

  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    primedRef.current = false;

    const prime = (now: number) => {
      sampleRef.current = { time: getCurrentTime(), at: now };
      lastSampledAtRef.current = now;
      primedRef.current = true;
    };

    const tick = (now: number) => {
      // 콘텐츠 미준비(광고/로딩): 가사 시계 정지 + 첫 줄 유지, 준비되면 그때부터 prime.
      if (contentReady && !contentReady()) {
        if (indexRef.current !== -1) {
          indexRef.current = -1;
          setActiveIndex(-1);
        }
        primedRef.current = false;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!primedRef.current) prime(now); // 진입/재개 시 현재 재생초로 정렬

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
  }, [getCurrentTime, isPlaying, lines, offsetMs, contentReady]);

  return activeIndex;
}
