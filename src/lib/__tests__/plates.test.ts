import { describe, expect, it } from 'vitest';
import { platesFor, type PlatePair } from '../plates';

// Seed inventory: pairs of 45×2, 25, 10×2, 5, 2.5
const INV: PlatePair[] = [
  { size: 45, pairs: 2 },
  { size: 25, pairs: 1 },
  { size: 10, pairs: 2 },
  { size: 5, pairs: 1 },
  { size: 2.5, pairs: 1 },
];

describe('platesFor', () => {
  it('loads deadlift day 1 (230): two 45s + 2.5 per side', () => {
    const r = platesFor(230, 45, INV);
    expect(r.perSide).toEqual([45, 45, 2.5]);
    expect(r.exact).toBe(true);
    expect(r.achieved).toBe(230);
  });

  it('loads 220 with one of everything', () => {
    const r = platesFor(220, 45, INV);
    expect(r.perSide).toEqual([45, 25, 10, 5, 2.5]);
    expect(r.exact).toBe(true);
  });

  it('loads the 85-lb press top set with two 10s', () => {
    const r = platesFor(85, 45, INV);
    expect(r.perSide).toEqual([10, 10]);
    expect(r.exact).toBe(true);
  });

  it('empty bar when target equals the bar', () => {
    const r = platesFor(45, 45, INV);
    expect(r.perSide).toEqual([]);
    expect(r.barOnly).toBe(true);
    expect(r.exact).toBe(true);
  });

  it('target below the bar is still bar-only', () => {
    const r = platesFor(30, 45, INV);
    expect(r.barOnly).toBe(true);
    expect(r.achieved).toBe(45);
  });

  it('returns the closest lower load when not exactly achievable', () => {
    // 92: per side 23.5 → best is 10+10+2.5 = 22.5 → 90
    const r = platesFor(92, 45, INV);
    expect(r.exact).toBe(false);
    expect(r.achieved).toBe(90);
    expect(r.perSide).toEqual([10, 10, 2.5]);
  });

  it('respects pair counts (only two 45 pairs)', () => {
    // 335 needs 145/side; the whole rack is 45+45+25+10+10+5+2.5 = 142.5 → 330
    const r = platesFor(335, 45, INV);
    expect(r.exact).toBe(false);
    expect(r.achieved).toBe(330);
  });

  it('covers every barbell weight in the 12-week program', () => {
    // Heaviest possible: deadlift cycle 3 TM 250 @ 95% = 240
    for (let w = 45; w <= 240; w += 5) {
      const r = platesFor(w, 45, INV);
      expect(r.exact, `weight ${w} should be loadable`).toBe(true);
    }
  });
});
