// Assembles the complete plan for one workout (warm-up, main, BBB,
// assistance) from a program position + settings. Pure.

import {
  BBB_REPS,
  bbbPercent,
  bbbSetCount,
  mainSets,
  minRepsForWeek,
  trainingMaxForCycle,
  warmupSets,
  workingWeight,
  type LiftConfig,
  type LiftKey,
} from './program';
import { assistanceFor, assistSetCount, HIP_PREP, isWeightedMovement, type AssistSlot } from './assistance';
import { bbbOptionById, exerciseById } from './exercises';
import { liftForDay, type ProgramPosition } from './schedule';
import type { AppSettings } from './seed';

export type BlockKind = 'hipprep' | 'warmup' | 'main' | 'bbb' | 'a1' | 'a2' | 'optional';
export type RestKind = keyof AppSettings['rest'];

/** Per-workout exercise swaps, keyed by block kind (bbb/a1/a2/optional) → exercise id */
export type ExerciseOverrides = Record<string, string>;

export interface PlannedSet {
  /** Stable id used as the key in the workout log, e.g. "m2", "b4" */
  id: string;
  /** Barbell weight in lb; undefined for DB/bodyweight work */
  weight?: number;
  pct?: number;
  /** Display reps, e.g. "5", "10/side" */
  reps: string;
  amrap?: boolean;
  /** Minimum reps to count the AMRAP top set as made */
  minReps?: number;
  /** True when the computed weight collapsed to the empty bar */
  isBar?: boolean;
}

export interface WorkoutBlock {
  kind: BlockKind;
  title: string;
  subtitle?: string;
  /** Which rest timer to auto-start after a set; null = no timer */
  rest: RestKind | null;
  sets: PlannedSet[];
  /** Accessory movement that takes external load — show a weight-logging control */
  logWeight?: boolean;
  /** Present when the block's exercise can be swapped from the library */
  swap?: {
    /** Name of the movement currently in effect */
    name: string;
    /** Name of the programmed default */
    defaultName: string;
    /** Selected override exercise id, if any */
    selectedId?: string;
  };
}

export interface WorkoutPlan {
  pos: ProgramPosition;
  liftKey: LiftKey;
  lift: LiftConfig;
  tm: number;
  blocks: WorkoutBlock[];
  /** id of the AMRAP top set, if this week has one */
  topSetId?: string;
  /** Weight of the AMRAP top set */
  topSetWeight?: number;
}

/** BBB movement name for a day. Deadlift day alternates RDL / DL / RDL by cycle. */
export function bbbLiftName(day: number, cycle: number, lifts: Record<LiftKey, LiftConfig>): string {
  const key = liftForDay(day);
  if (key === 'deadlift') return cycle === 2 ? 'Deadlift' : 'Barbell RDL';
  return lifts[key].name;
}

export function buildWorkoutPlan(
  pos: ProgramPosition,
  settings: AppSettings,
  overrides: ExerciseOverrides = {},
): WorkoutPlan {
  const { cycle, week, day } = pos;
  const liftKey = liftForDay(day);
  const lift = settings.lifts[liftKey];
  const tm = trainingMaxForCycle(lift, cycle, settings.holds[liftKey] ?? []);
  const bar = settings.barWeight;
  const blocks: WorkoutBlock[] = [];

  if (liftKey === 'squat' || liftKey === 'deadlift') {
    blocks.push({
      kind: 'hipprep',
      title: 'Hip Prep',
      subtitle: 'Before touching the bar',
      rest: null,
      sets: HIP_PREP.map((m, i) => ({ id: `hp${i + 1}`, reps: `${m.name} · ${m.reps}` })),
    });
  }

  blocks.push({
    kind: 'warmup',
    title: 'Warm-Up',
    rest: null,
    sets: warmupSets().map((s, i) => {
      const weight = workingWeight(tm, s.pct, bar);
      return { id: `wu${i + 1}`, weight, pct: s.pct, reps: String(s.reps), isBar: weight === bar };
    }),
  });

  const main = mainSets(week);
  let topSetId: string | undefined;
  let topSetWeight: number | undefined;
  blocks.push({
    kind: 'main',
    title: lift.name,
    subtitle: `TM ${tm}`,
    rest: 'main',
    sets: main.map((s, i) => {
      const id = `m${i + 1}`;
      const weight = workingWeight(tm, s.pct, bar);
      if (s.amrap) {
        topSetId = id;
        topSetWeight = weight;
      }
      return {
        id,
        weight,
        pct: s.pct,
        reps: s.amrap ? `${s.reps}+` : String(s.reps),
        amrap: s.amrap,
        minReps: s.amrap ? s.reps : undefined,
        isBar: weight === bar,
      };
    }),
  });

  // BBB: same-lift by default (deadlift day alternates RDL/DL/RDL); a swap
  // computes the weight from the selected movement's own TM source.
  const bbbDefaultName = bbbLiftName(day, cycle, settings.lifts);
  const bbbOpt = overrides['bbb'] ? bbbOptionById(overrides['bbb']) : undefined;
  const bbbName = bbbOpt?.name ?? bbbDefaultName;
  const bbbTm = bbbOpt
    ? trainingMaxForCycle(settings.lifts[bbbOpt.tmSource], cycle, settings.holds[bbbOpt.tmSource] ?? [])
    : tm;
  const bbbPct = bbbPercent(cycle, week);
  const bbbWeight = workingWeight(bbbTm, bbbPct, bar);
  blocks.push({
    kind: 'bbb',
    title: 'BBB',
    subtitle: `${Math.round(bbbPct * 100)}% · TM ${bbbTm}`,
    rest: 'bbb',
    sets: Array.from({ length: bbbSetCount(week) }, (_, i) => ({
      id: `b${i + 1}`,
      weight: bbbWeight,
      pct: bbbPct,
      reps: String(BBB_REPS),
      isBar: bbbWeight === bar,
    })),
    swap: { name: bbbName, defaultName: bbbDefaultName, selectedId: bbbOpt?.id },
  });

  const slots: { slot: AssistSlot; kind: BlockKind; label: string }[] = [
    { slot: 'a1', kind: 'a1', label: 'A1' },
    { slot: 'a2', kind: 'a2', label: 'A2' },
    { slot: 'optional', kind: 'optional', label: 'Optional' },
  ];
  for (const { slot, kind, label } of slots) {
    const count = assistSetCount(slot, week);
    if (count === 0) continue;
    const programmed = assistanceFor(day, cycle, slot);
    const swapped = overrides[kind] ? exerciseById(overrides[kind]) : undefined;
    const move = swapped ? { name: swapped.name, reps: swapped.reps } : programmed;
    blocks.push({
      kind,
      title: label,
      subtitle: slot === 'optional' ? 'Finisher — skip if short on time' : 'Superset · 60–90 s rest',
      rest: 'assistance',
      sets: Array.from({ length: count }, (_, i) => ({ id: `${slot}s${i + 1}`, reps: move.reps })),
      logWeight: swapped ? swapped.weighted : isWeightedMovement(programmed.name),
      swap: { name: move.name, defaultName: programmed.name, selectedId: swapped?.id },
    });
  }

  return { pos, liftKey, lift, tm, blocks, topSetId, topSetWeight };
}

/** Sets that must be completed for the workout to count as done (main work only). */
export function requiredSetIds(plan: WorkoutPlan): string[] {
  return plan.blocks.filter((b) => b.kind === 'main').flatMap((b) => b.sets.map((s) => s.id));
}

export function amrapMinReps(week: number): number {
  return minRepsForWeek(week);
}
