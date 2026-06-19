import { describe, it, expect } from 'vitest';
import { findActiveIndex, parseLrc } from './lrc';
import type { LyricLine } from '../types';

describe('findActiveIndex', () => {
  const lines: LyricLine[] = [
    { time: 0, text: 'a' },
    { time: 5, text: 'b' },
    { time: 10, text: 'c' },
    { time: 15, text: 'd' },
  ];

  it('빈 배열이면 -1', () => {
    expect(findActiveIndex([], 3)).toBe(-1);
  });

  it('첫 줄 시각보다 이전이면 -1', () => {
    expect(findActiveIndex(lines, -0.5)).toBe(-1);
  });

  it('정확히 첫 줄 시각이면 0', () => {
    expect(findActiveIndex(lines, 0)).toBe(0);
  });

  it('두 타임태그 사이(중간 시각)면 더 작은 쪽 인덱스', () => {
    expect(findActiveIndex(lines, 7.3)).toBe(1); // 5 <= 7.3 < 10
  });

  it('정확히 타임태그와 일치하면 그 인덱스', () => {
    expect(findActiveIndex(lines, 10)).toBe(2);
  });

  it('마지막 줄 시각 이후면 마지막 인덱스', () => {
    expect(findActiveIndex(lines, 999)).toBe(3);
  });

  it('마지막 줄 시각과 정확히 일치하면 마지막 인덱스', () => {
    expect(findActiveIndex(lines, 15)).toBe(3);
  });
});

describe('parseLrc — 기본 파싱', () => {
  it('[mm:ss.xx] 타임태그를 초(float)로 변환한다', () => {
    const raw = '[00:12.50]hello';
    const { lines } = parseLrc(raw);
    expect(lines).toHaveLength(1);
    expect(lines[0].time).toBeCloseTo(12.5, 5);
    expect(lines[0].text).toBe('hello');
  });

  it('분과 초를 합산한다 [01:05.00] = 65초', () => {
    const { lines } = parseLrc('[01:05.00]minute line');
    expect(lines[0].time).toBeCloseTo(65, 5);
  });

  it('밀리초 3자리 [00:01.234] 도 환산한다', () => {
    const { lines } = parseLrc('[00:01.234]ms');
    expect(lines[0].time).toBeCloseTo(1.234, 5);
  });

  it('소수부 없는 [00:30] 도 허용한다', () => {
    const { lines } = parseLrc('[00:30]no decimals');
    expect(lines[0].time).toBeCloseTo(30, 5);
  });

  it('여러 줄을 time 오름차순으로 정렬한다(입력이 뒤섞여도)', () => {
    const raw = ['[00:10.00]second', '[00:02.00]first', '[00:20.00]third'].join('\n');
    const { lines } = parseLrc(raw);
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third']);
    expect(lines.map((l) => l.time)).toEqual([2, 10, 20]);
  });

  it('빈 텍스트(공백만)는 ♪ 로 치환한다', () => {
    const { lines } = parseLrc('[00:05.00]   ');
    expect(lines[0].text).toBe('♪');
  });

  it('타임태그 없는 줄과 빈 raw는 무시한다(라인 0개)', () => {
    expect(parseLrc('').lines).toEqual([]);
    expect(parseLrc('just text without tags').lines).toEqual([]);
  });

  it('offset 메타태그가 없으면 offsetMs=0', () => {
    expect(parseLrc('[00:01.00]x').offsetMs).toBe(0);
  });

  it('실제 LRC 샘플(여러 줄, 메타 혼재)을 정상 파싱한다', () => {
    const raw = [
      '[ar:Some Artist]',
      '[ti:Some Title]',
      '[al:Some Album]',
      '[length:03:21]',
      '',
      '[00:00.00]First line',
      '[00:04.20]Second line',
      '[00:09.80]Third line',
    ].join('\n');
    const { lines } = parseLrc(raw);
    expect(lines.map((l) => l.text)).toEqual(['First line', 'Second line', 'Third line']);
    expect(lines[1].time).toBeCloseTo(4.2, 5);
    expect(lines[2].time).toBeCloseTo(9.8, 5);
  });
});

describe('parseLrc — 멀티 타임태그 & offset', () => {
  it('한 줄의 멀티 타임태그를 각 시각마다 별도 라인으로 전개한다', () => {
    const raw = '[00:01.00][00:05.00][00:09.00]repeat hook';
    const { lines } = parseLrc(raw);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.time)).toEqual([1, 5, 9]);
    expect(lines.every((l) => l.text === 'repeat hook')).toBe(true);
  });

  it('멀티 타임태그가 다른 줄과 섞여도 전체를 time순으로 정렬한다', () => {
    const raw = [
      '[00:08.00]later',
      '[00:01.00][00:05.00]hook',
      '[00:03.00]mid',
    ].join('\n');
    const { lines } = parseLrc(raw);
    expect(lines.map((l) => l.time)).toEqual([1, 3, 5, 8]);
    expect(lines.map((l) => l.text)).toEqual(['hook', 'mid', 'hook', 'later']);
  });

  it('[offset:+250] 양수 메타태그를 offsetMs=250으로 반환한다', () => {
    const raw = ['[offset:+250]', '[00:00.00]x'].join('\n');
    expect(parseLrc(raw).offsetMs).toBe(250);
  });

  it('[offset:-120] 음수 메타태그를 offsetMs=-120으로 반환한다', () => {
    const raw = ['[offset:-120]', '[00:00.00]x'].join('\n');
    expect(parseLrc(raw).offsetMs).toBe(-120);
  });

  it('offset 메타태그는 라인 time에 영향을 주지 않는다(소비측에서 반영)', () => {
    const raw = ['[offset:+500]', '[00:10.00]ten'].join('\n');
    const { lines, offsetMs } = parseLrc(raw);
    expect(offsetMs).toBe(500);
    expect(lines[0].time).toBeCloseTo(10, 5); // 10초 그대로, 10.5 아님
  });
});
