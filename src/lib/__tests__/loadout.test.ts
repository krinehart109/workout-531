import { describe, expect, it } from 'vitest';
import { chainLoadouts, loadableWeight } from '../loadout';
import type { PlatePair } from '../plates';

// Seed inventory: pairs of 45×2, 25, 10×2, 5, 2.5
const INV: PlatePair[] = [
  { size: 45, pairs: 2 },
  { size: 25, pairs: 1 },
  { size: 10, pairs: 2 },
  { size: 5, pairs: 1 },
  { size: 2.5, pairs: 1 },
];

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

describe('loadableWeight', () => {
  it('returns the target when the shelf can build it exactly', () => {
    expect(loadableWeight(220, 45, INV)).toBe(220);
    expect(loadableWeight(90, 45, INV)).toBe(90);
    expect(loadableWeight(45, 45, INV)).toBe(45);
  });

  it('snaps down to the closest loadable weight otherwise', () => {
    // No 2.5s: 220 needs 87.5/side → best is 45+25+10+5 = 85 → 215
    const noQuarters: PlatePair[] = [
      { size: 45, pairs: 1 },
      { size: 25, pairs: 1 },
      { size: 10, pairs: 2 },
      { size: 5, pairs: 1 },
    ];
    expect(loadableWeight(220, 45, noQuarters)).toBe(215);
    // Only 45s: anything under 135 collapses to the bar
    expect(loadableWeight(90, 45, [{ size: 45, pairs: 2 }])).toBe(45);
    expect(loadableWeight(150, 45, [{ size: 45, pairs: 2 }])).toBe(135);
  });

  it('beats greedy loading when it matters', () => {
    // 105 → 30/side. Greedy grabs the 25 and dead-ends at 25; 10+10+10 is exact.
    expect(loadableWeight(105, 45, [{ size: 25, pairs: 1 }, { size: 10, pairs: 3 }])).toBe(105);
  });
});

describe('chainLoadouts', () => {
  // Deadlift C1W1 session: warm-ups 90/115/140, main 150/175/195, BBB (RDL) 115
  const SESSION = [
    { id: 'wu1', weight: 90 },
    { id: 'wu2', weight: 115 },
    { id: 'wu3', weight: 140 },
    { id: 'm1', weight: 150 },
    { id: 'm2', weight: 175 },
    { id: 'm3', weight: 195 },
    { id: 'b1', weight: 115 },
  ];

  it('every step is exact and stack sums match the weight', () => {
    const steps = chainLoadouts(SESSION, 45, INV);
    for (const [i, step] of steps.entries()) {
      expect(step.exact, step.setId).toBe(true);
      expect(step.achieved).toBe(SESSION[i].weight);
      expect(45 + 2 * sum(step.stack)).toBe(step.achieved);
      // keep + add compose the stack; keep is a prefix of the previous stack
      expect([...step.keep, ...step.add]).toEqual(step.stack);
    }
  });

  it('adds on top of the existing load when weights simply climb', () => {
    const steps = chainLoadouts(SESSION, 45, INV);
    // 140 → 150 is just +5/side on top of everything already there
    const m1 = steps[3];
    expect(m1.remove).toEqual([]);
    expect(m1.add).toEqual([5]);
  });

  it('keeps the deepest usable plates when the small ones run out', () => {
    const steps = chainLoadouts(SESSION, 45, INV);
    // 150 [10,25,10,2.5,5] → 175: keeps the inner 10, stacks 45+10 outside it
    // (6 plate moves instead of the 8 a full restrip would take)
    const m2 = steps[4];
    expect(m2.keep).toEqual([10]);
    expect(m2.remove).toEqual([5, 2.5, 10, 25]);
    expect(m2.add).toEqual([45, 10]);
    expect(m2.stack).toEqual([10, 45, 10]);
    // 175 → 195: no prefix of [10,45,10] extends to 75/side → full restack
    const m3 = steps[5];
    expect(m3.keep).toEqual([]);
    expect(m3.remove).toEqual([10, 45, 10]);
    expect(m3.stack).toEqual([45, 25, 5]);
  });

  it('strips down for the BBB back-off set', () => {
    const steps = chainLoadouts(SESSION, 45, INV);
    const b1 = steps[6];
    expect(b1.prevAchieved).toBe(195);
    expect(b1.achieved).toBe(115);
    expect(45 + 2 * sum(b1.stack)).toBe(115);
  });

  it('first set loads from an empty bar', () => {
    const steps = chainLoadouts(SESSION, 45, INV);
    expect(steps[0].prevAchieved).toBeUndefined();
    expect(steps[0].keep).toEqual([]);
    expect(steps[0].remove).toEqual([]);
  });

  it('bar-weight sets have empty stacks', () => {
    const steps = chainLoadouts([{ id: 'x', weight: 45 }], 45, INV);
    expect(steps[0].stack).toEqual([]);
    expect(steps[0].achieved).toBe(45);
  });

  it('reports unloadable targets as closest-below', () => {
    const steps = chainLoadouts([{ id: 'x', weight: 92 }], 45, INV);
    expect(steps[0].exact).toBe(false);
    expect(steps[0].achieved).toBe(90);
  });
});
