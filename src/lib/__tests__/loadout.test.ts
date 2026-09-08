import { describe, expect, it } from 'vitest';
import { chainLoadouts, loadableWeight } from '../loadout';
import type { Plate } from '../plates';

// Seed inventory (individual plates owned): 4× 45, 2× 25, 4× 10, 2× 5, 2× 2.5
const INV: Plate[] = [
  { size: 45, count: 4 },
  { size: 25, count: 2 },
  { size: 10, count: 4 },
  { size: 5, count: 2 },
  { size: 2.5, count: 2 },
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
    const noQuarters: Plate[] = [
      { size: 45, count: 2 },
      { size: 25, count: 2 },
      { size: 10, count: 4 },
      { size: 5, count: 2 },
    ];
    expect(loadableWeight(220, 45, noQuarters)).toBe(215);
    // Only 45s: anything under 135 collapses to the bar
    expect(loadableWeight(90, 45, [{ size: 45, count: 4 }])).toBe(45);
    expect(loadableWeight(150, 45, [{ size: 45, count: 4 }])).toBe(135);
  });

  it('uses floor(count/2) per side — an odd plate out never loads', () => {
    // Three 45s owned = only ONE per side; 235 needs 95/side → 45+25+10+10+5 = 95 exact
    const odd: Plate[] = [
      { size: 45, count: 3 },
      { size: 25, count: 2 },
      { size: 10, count: 4 },
      { size: 5, count: 2 },
    ];
    expect(loadableWeight(235, 45, odd)).toBe(235);
    // 275 would need two 45s/side (115) — best without them: 45+25+10+10+5 = 95 → 235
    expect(loadableWeight(275, 45, odd)).toBe(235);
    // A single plate of a size contributes nothing
    expect(loadableWeight(55, 45, [{ size: 5, count: 1 }])).toBe(45);
  });

  it('beats greedy loading when it matters', () => {
    // 105 → 30/side. Greedy grabs the 25 and dead-ends at 25; 10+10+10 is exact.
    expect(
      loadableWeight(105, 45, [
        { size: 25, count: 2 },
        { size: 10, count: 6 },
      ]),
    ).toBe(105);
  });

  it('covers every barbell weight in the 12-week program with the seed shelf', () => {
    // Heaviest programmed: deadlift C3 TM 250 @ 95% = 240
    for (let w = 45; w <= 240; w += 5) {
      expect(loadableWeight(w, 45, INV), `weight ${w}`).toBe(w);
    }
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
