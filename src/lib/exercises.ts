// Exercise library: known-good movements for the home garage setup
// (power rack + bar + pull-up bar, DBs to 80 lb, swiss ball, ab wheel).
// Any accessory slot (A1/A2/Optional) can be swapped to one of these per
// workout; BBB can be swapped between barbell lifts, each tied to the TM
// it should be computed from.

import type { LiftKey } from './program';

export type ExerciseGroup = 'Pull' | 'Push' | 'Legs' | 'Core' | 'Shoulders & Arms' | 'Carry';

export const EXERCISE_GROUPS: ExerciseGroup[] = ['Pull', 'Push', 'Legs', 'Core', 'Shoulders & Arms', 'Carry'];

export interface Exercise {
  id: string;
  name: string;
  /** Default rep target as displayed */
  reps: string;
  /** Takes external load — show the weight-logging control */
  weighted: boolean;
  group: ExerciseGroup;
}

export const EXERCISE_LIBRARY: Exercise[] = [
  // Pull
  { id: 'db-row-1arm', name: '1-Arm DB Row', reps: '10/side', weighted: true, group: 'Pull' },
  { id: 'bb-row', name: 'Bent-Over BB Row', reps: '10', weighted: true, group: 'Pull' },
  { id: 'bb-row-underhand', name: 'Underhand BB Row', reps: '10', weighted: true, group: 'Pull' },
  { id: 'db-row-2', name: '2-DB Bent-Over Row', reps: '10/side', weighted: true, group: 'Pull' },
  { id: 'chin-ups', name: 'Chin-Ups', reps: 'AMRAP −1', weighted: false, group: 'Pull' },
  { id: 'pull-ups', name: 'Pull-Ups', reps: 'AMRAP −1', weighted: false, group: 'Pull' },
  { id: 'inverted-row', name: 'Inverted Row (bar in rack)', reps: '10–12', weighted: false, group: 'Pull' },
  // Push
  { id: 'db-bench', name: 'DB Bench Press', reps: '12', weighted: true, group: 'Push' },
  { id: 'db-bench-alt', name: 'Alternating DB Bench', reps: '10/side', weighted: true, group: 'Push' },
  { id: 'push-ups', name: 'Push-Ups', reps: 'AMRAP −2', weighted: false, group: 'Push' },
  { id: 'db-ohp', name: 'Seated DB Press', reps: '10', weighted: true, group: 'Push' },
  { id: 'db-fly', name: 'DB Chest Fly', reps: '10–12', weighted: true, group: 'Push' },
  // Legs
  { id: 'db-split-squat', name: 'DB Split Squat', reps: '10/side', weighted: true, group: 'Legs' },
  { id: 'db-step-up', name: 'DB Step-Up', reps: '10/side', weighted: true, group: 'Legs' },
  { id: 'goblet-squat', name: 'Goblet Squat', reps: '12', weighted: true, group: 'Legs' },
  { id: 'db-rdl', name: 'DB RDL', reps: '10', weighted: true, group: 'Legs' },
  { id: 'db-lunge', name: 'DB Walking Lunge', reps: '10/side', weighted: true, group: 'Legs' },
  { id: 'sb-leg-curl', name: 'Swiss Ball Leg Curl', reps: '10–12', weighted: false, group: 'Legs' },
  { id: 'sl-glute-bridge', name: 'Single-Leg Glute Bridge', reps: '10/side', weighted: false, group: 'Legs' },
  // Core
  { id: 'ab-wheel', name: 'Ab Wheel', reps: '10', weighted: false, group: 'Core' },
  { id: 'stir-pot', name: 'Swiss Ball Stir-the-Pot', reps: '10/dir', weighted: false, group: 'Core' },
  { id: 'side-plank', name: 'Side Plank', reps: '30 s/side', weighted: false, group: 'Core' },
  { id: 'plank', name: 'Plank', reps: '45–60 s', weighted: false, group: 'Core' },
  { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', reps: '10–12', weighted: false, group: 'Core' },
  // Shoulders & Arms
  { id: 'lateral-raise', name: 'Lateral Raises', reps: '12–15', weighted: true, group: 'Shoulders & Arms' },
  { id: 'db-curl', name: 'DB Curls', reps: '10–12', weighted: true, group: 'Shoulders & Arms' },
  { id: 'oh-triceps', name: 'OH Triceps Extension', reps: '10–12', weighted: true, group: 'Shoulders & Arms' },
  { id: 'rear-delt-fly', name: 'Rear-Delt Fly', reps: '12–15', weighted: true, group: 'Shoulders & Arms' },
  // Carry
  { id: 'farmer-carry', name: 'DB Farmer Carry', reps: '40 steps', weighted: true, group: 'Carry' },
];

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

// ---- BBB movement options ----

export interface BBBOption {
  id: string;
  name: string;
  /** Which lift's training max the BBB percentage applies to */
  tmSource: LiftKey;
}

export const BBB_OPTIONS: BBBOption[] = [
  { id: 'ohp', name: 'Overhead Press', tmSource: 'press' },
  { id: 'bench', name: 'Bench Press', tmSource: 'bench' },
  { id: 'cg-bench', name: 'Close-Grip Bench', tmSource: 'bench' },
  { id: 'squat', name: 'Back Squat', tmSource: 'squat' },
  { id: 'deadlift', name: 'Deadlift', tmSource: 'deadlift' },
  { id: 'rdl', name: 'Barbell RDL', tmSource: 'deadlift' },
];

const BBB_BY_ID = new Map(BBB_OPTIONS.map((o) => [o.id, o]));

export function bbbOptionById(id: string): BBBOption | undefined {
  return BBB_BY_ID.get(id);
}
