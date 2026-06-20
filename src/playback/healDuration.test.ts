import { describe, it, expect } from 'vitest';
import { shouldHealDuration } from './PlaybackContext';

describe('shouldHealDuration', () => {
  it('returns false when live is not a sane value (<=0)', () => {
    expect(shouldHealDuration(0, 215)).toBe(false);
    expect(shouldHealDuration(-5, 215)).toBe(false);
  });

  it('returns false when stored is missing (<=0) — nothing to compare', () => {
    expect(shouldHealDuration(215, 0)).toBe(false);
  });

  it('returns false for small drift within tolerance (<=5% and/or <=3s)', () => {
    // 215 vs 217 -> 2s diff, < 3s and < 5% -> no heal
    expect(shouldHealDuration(217, 215)).toBe(false);
    // 100 vs 104 -> 4s but only 4% -> still within 5% -> no heal
    expect(shouldHealDuration(104, 100)).toBe(false);
    // 100 vs 102 -> 2% and 2s -> no heal
    expect(shouldHealDuration(102, 100)).toBe(false);
  });

  it('heals a genuine re-encode drift: >3s AND >5%, within sane band', () => {
    // 215 stored, live 230 -> 15s and ~7% -> heal
    expect(shouldHealDuration(230, 215)).toBe(true);
    // shorter re-encode: 215 -> 190 (25s, ~12%) -> heal
    expect(shouldHealDuration(190, 215)).toBe(true);
  });

  it('does NOT heal an ad (live much shorter than stored) — ad poisoning guard', () => {
    // 15s ad vs 215s song -> outside sane band (live < stored*0.5) -> no heal
    expect(shouldHealDuration(15, 215)).toBe(false);
    // 30s pre-roll vs 240s song -> still way below half -> no heal
    expect(shouldHealDuration(30, 240)).toBe(false);
  });

  it('does NOT heal an implausibly long live value (> 2x stored)', () => {
    // 600 live vs 215 stored -> outside sane band -> no heal
    expect(shouldHealDuration(600, 215)).toBe(false);
  });

  it('heals at the edges of the sane band', () => {
    // exactly half: 100 vs 200 -> in band (>= stored*0.5), 100s/50% diff -> heal
    expect(shouldHealDuration(100, 200)).toBe(true);
    // exactly double: 400 vs 200 -> in band (<= stored*2) -> heal
    expect(shouldHealDuration(400, 200)).toBe(true);
  });
});
