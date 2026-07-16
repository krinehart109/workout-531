// Core 5/3/1 math. Pure functions only — no I/O, no dates, no storage.

export type LiftKey = 'press' | 'deadlift' | 'bench' | 'squat';

export interface LiftConfig {
  key: LiftKey;
  name: string;
  short: string;
  oneRepMax: number;
  /** Fraction of 1RM used for the training max, e.g. 0.9 */
  tmPercent: number;
  /** Pounds added to the TM after each completed cycle */
  increment: number;
}

export interface SetScheme {
  pct: number;
  reps: number;
  amrap: boolean;
}

export const BAR_WEIGHT_DEFAULT = 45;

/** Round to the nearest 5 lb. */
export function round5(weight: number): number {
  return Math.round(weight / 5) * 5;
}

/** TM for cycle 1: 1RM × TM%, rounded to nearest 5. */
export function baseTrainingMax(lift: Pick<LiftConfig, 'oneRepMax' | 'tmPercent'>): number {
  return round5(lift.oneRepMax * lift.tmPercent);
}

/**
 * TM for a given cycle (1-based). The TM increments after each cycle unless
 * that cycle appears in `holds` (cycles after which the TM was held).
 */
export function trainingMaxForCycle(lift: LiftConfig, cycle: number, holds: number[] = []): number {
  let tm = baseTrainingMax(lift);
  for (let c = 1; c < cycle; c++) {
    if (!holds.includes(c)) tm += lift.increment;
  }
  return tm;
}

/** Epley estimated 1RM: weight × (1 + reps/30). */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export const WEEK_NAMES: Record<number, string> = { 1: '5s', 2: '3s', 3: '5/3/1', 4: 'Deload' };

const MAIN_SCHEMES: Record<number, SetScheme[]> = {
  1: [
    { pct: 0.65, reps: 5, amrap: false },
    { pct: 0.75, reps: 5, amrap: false },
    { pct: 0.85, reps: 5, amrap: true },
  ],
  2: [
    { pct: 0.7, reps: 3, amrap: false },
    { pct: 0.8, reps: 3, amrap: false },
    { pct: 0.9, reps: 3, amrap: true },
  ],
  3: [
    { pct: 0.75, reps: 5, amrap: false },
    { pct: 0.85, reps: 3, amrap: false },
    { pct: 0.95, reps: 1, amrap: true },
  ],
  4: [
    { pct: 0.4, reps: 5, amrap: false },
    { pct: 0.5, reps: 5, amrap: false },
    { pct: 0.6, reps: 5, amrap: false },
  ],
};

/** The three working sets for a week (1–4). Last set is AMRAP except deload. */
export function mainSets(week: number): SetScheme[] {
  const scheme = MAIN_SCHEMES[week];
  if (!scheme) throw new Error(`invalid week: ${week}`);
  return scheme;
}

/** Warm-up scheme before working sets: 40%×5, 50%×5, 60%×3. */
export function warmupSets(): SetScheme[] {
  return [
    { pct: 0.4, reps: 5, amrap: false },
    { pct: 0.5, reps: 5, amrap: false },
    { pct: 0.6, reps: 3, amrap: false },
  ];
}

/** Minimum reps required on the top set for a week (deload has no AMRAP). */
export function minRepsForWeek(week: number): number {
  return mainSets(week)[mainSets(week).length - 1].reps;
}

/**
 * Working weight: % of TM rounded to nearest 5, never below the empty bar
 * (a barbell can't weigh less than the bar).
 */
export function workingWeight(tm: number, pct: number, barWeight = BAR_WEIGHT_DEFAULT): number {
  return Math.max(round5(tm * pct), barWeight);
}

// ---- Boring But Big ----

const BBB_SETS_BY_WEEK = [3, 4, 5, 2];
const BBB_PCT_BY_CYCLE = [0.5, 0.55, 0.6];

export const BBB_REPS = 10;

/** BBB set count for a week (1–4): 3, 4, 5, then 2 on deload. */
export function bbbSetCount(week: number): number {
  const n = BBB_SETS_BY_WEEK[week - 1];
  if (n === undefined) throw new Error(`invalid week: ${week}`);
  return n;
}

/** BBB percentage of TM: 50/55/60% by cycle, always 40% on the deload week. */
export function bbbPercent(cycle: number, week: number): number {
  if (week === 4) return 0.4;
  const pct = BBB_PCT_BY_CYCLE[cycle - 1];
  if (pct === undefined) throw new Error(`invalid cycle: ${cycle}`);
  return pct;
}
