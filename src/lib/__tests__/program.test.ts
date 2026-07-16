import { describe, expect, it } from 'vitest';
import {
  baseTrainingMax,
  bbbPercent,
  bbbSetCount,
  epley1RM,
  mainSets,
  minRepsForWeek,
  round5,
  trainingMaxForCycle,
  warmupSets,
  workingWeight,
  type LiftConfig,
} from '../program';

const press: LiftConfig = { key: 'press', name: 'Overhead Press', short: 'OHP', oneRepMax: 85, tmPercent: 0.9, increment: 5 };
const bench: LiftConfig = { key: 'bench', name: 'Bench Press', short: 'Bench', oneRepMax: 138, tmPercent: 0.9, increment: 5 };
const squat: LiftConfig = { key: 'squat', name: 'Back Squat', short: 'Squat', oneRepMax: 180, tmPercent: 0.85, increment: 10 };
const deadlift: LiftConfig = { key: 'deadlift', name: 'Deadlift', short: 'DL', oneRepMax: 255, tmPercent: 0.9, increment: 10 };

describe('round5', () => {
  it('rounds to the nearest 5 lb', () => {
    expect(round5(63.75)).toBe(65);
    expect(round5(62.4)).toBe(60);
    expect(round5(153)).toBe(155);
    expect(round5(229.5)).toBe(230);
    expect(round5(0)).toBe(0);
    expect(round5(5)).toBe(5);
  });
});

describe('training max', () => {
  it('matches the seed table (1RM × TM%, nearest 5)', () => {
    expect(baseTrainingMax(press)).toBe(75);
    expect(baseTrainingMax(bench)).toBe(125);
    expect(baseTrainingMax(squat)).toBe(155);
    expect(baseTrainingMax(deadlift)).toBe(230);
  });

  it('increments per cycle: +5 upper, +10 lower', () => {
    expect(trainingMaxForCycle(press, 1)).toBe(75);
    expect(trainingMaxForCycle(press, 2)).toBe(80);
    expect(trainingMaxForCycle(press, 3)).toBe(85);
    expect(trainingMaxForCycle(deadlift, 2)).toBe(240);
    expect(trainingMaxForCycle(deadlift, 3)).toBe(250);
    expect(trainingMaxForCycle(squat, 3)).toBe(175);
  });

  it('holding a cycle skips that increment only', () => {
    expect(trainingMaxForCycle(press, 2, [1])).toBe(75);
    expect(trainingMaxForCycle(press, 3, [1])).toBe(80);
    expect(trainingMaxForCycle(deadlift, 3, [2])).toBe(240);
    expect(trainingMaxForCycle(deadlift, 3, [1, 2])).toBe(230);
  });
});

describe('estimated 1RM (Epley)', () => {
  it('matches the numbers the program was seeded from', () => {
    expect(epley1RM(115, 6)).toBeCloseTo(138, 5);
    expect(epley1RM(150, 6)).toBeCloseTo(180, 5);
    expect(epley1RM(225, 4)).toBeCloseTo(255, 5);
  });

  it('handles 1 rep and guards zero', () => {
    expect(epley1RM(100, 1)).toBeCloseTo(103.33, 1);
    expect(epley1RM(100, 0)).toBe(0);
  });
});

describe('weekly main-lift schemes', () => {
  it('week 1: 65/75/85 ×5, last set AMRAP', () => {
    expect(mainSets(1)).toEqual([
      { pct: 0.65, reps: 5, amrap: false },
      { pct: 0.75, reps: 5, amrap: false },
      { pct: 0.85, reps: 5, amrap: true },
    ]);
  });

  it('week 2: 70/80/90 ×3, last set AMRAP', () => {
    expect(mainSets(2).map((s) => s.pct)).toEqual([0.7, 0.8, 0.9]);
    expect(mainSets(2).map((s) => s.reps)).toEqual([3, 3, 3]);
    expect(mainSets(2)[2].amrap).toBe(true);
  });

  it('week 3: 75×5, 85×3, 95×1+', () => {
    expect(mainSets(3)).toEqual([
      { pct: 0.75, reps: 5, amrap: false },
      { pct: 0.85, reps: 3, amrap: false },
      { pct: 0.95, reps: 1, amrap: true },
    ]);
  });

  it('week 4 (deload): 40/50/60 ×5, no AMRAP anywhere', () => {
    expect(mainSets(4).map((s) => s.pct)).toEqual([0.4, 0.5, 0.6]);
    expect(mainSets(4).every((s) => !s.amrap && s.reps === 5)).toBe(true);
  });

  it('min reps on the top set: 5 / 3 / 1', () => {
    expect(minRepsForWeek(1)).toBe(5);
    expect(minRepsForWeek(2)).toBe(3);
    expect(minRepsForWeek(3)).toBe(1);
  });

  it('rejects invalid weeks', () => {
    expect(() => mainSets(5)).toThrow();
    expect(() => mainSets(0)).toThrow();
  });
});

describe('warm-up scheme', () => {
  it('is 40%×5, 50%×5, 60%×3', () => {
    expect(warmupSets()).toEqual([
      { pct: 0.4, reps: 5, amrap: false },
      { pct: 0.5, reps: 5, amrap: false },
      { pct: 0.6, reps: 3, amrap: false },
    ]);
  });
});

describe('working weight', () => {
  it('is % of TM rounded to nearest 5', () => {
    expect(workingWeight(230, 0.95)).toBe(220); // 218.5
    expect(workingWeight(155, 0.85)).toBe(130); // 131.75
    expect(workingWeight(125, 0.65)).toBe(80); // 81.25
  });

  it('never drops below the empty bar (press warm-ups)', () => {
    expect(workingWeight(75, 0.4)).toBe(45); // 30 → bar
    expect(workingWeight(75, 0.5)).toBe(45); // 37.5 → bar
    expect(workingWeight(75, 0.6)).toBe(45); // 45 exactly
    expect(workingWeight(75, 0.65)).toBe(50);
  });
});

describe('Boring But Big', () => {
  it('sets ramp 3/4/5 then 2 on deload, always ×10', () => {
    expect([1, 2, 3, 4].map(bbbSetCount)).toEqual([3, 4, 5, 2]);
  });

  it('percent rises per cycle: 50/55/60', () => {
    expect(bbbPercent(1, 1)).toBe(0.5);
    expect(bbbPercent(2, 2)).toBe(0.55);
    expect(bbbPercent(3, 3)).toBe(0.6);
  });

  it('deload week is always 40% regardless of cycle', () => {
    expect(bbbPercent(1, 4)).toBe(0.4);
    expect(bbbPercent(2, 4)).toBe(0.4);
    expect(bbbPercent(3, 4)).toBe(0.4);
  });
});
