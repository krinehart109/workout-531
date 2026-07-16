// Assistance work: two supersetted exercises + an optional finisher per day,
// rotating each cycle. Static program data, not user-editable state.

export interface AssistMovement {
  name: string;
  /** Rep target as displayed, e.g. "10/side", "AMRAP −2", "40 steps · 60–70 lb/hand" */
  reps: string;
}

interface DayAssistance {
  /** Indexed by cycle − 1 */
  a1: AssistMovement[];
  a2: AssistMovement[];
  optional: AssistMovement[];
}

/** Sets per week (index = week − 1) for each assistance slot. 0 = skip. */
export const ASSIST_SETS_BY_WEEK = {
  a1: [2, 3, 4, 2],
  a2: [2, 2, 3, 2],
  optional: [2, 3, 3, 0],
} as const;

export type AssistSlot = keyof typeof ASSIST_SETS_BY_WEEK;

/** Keyed by day slot 1..4 (Press, Deadlift, Bench, Squat). */
const ASSISTANCE: Record<number, DayAssistance> = {
  1: {
    a1: [
      { name: '1-Arm DB Row', reps: '10/side' },
      { name: 'Underhand BB Row', reps: '10' },
      { name: '2-DB Bent-Over Row', reps: '10/side' },
    ],
    a2: [
      { name: 'Ab Wheel', reps: '10' },
      { name: 'Swiss Ball Stir-the-Pot', reps: '10/dir' },
      { name: 'Ab Wheel', reps: '10' },
    ],
    optional: [
      { name: 'Lateral Raises', reps: '12–15' },
      { name: 'DB Curls', reps: '10–12' },
      { name: 'Lateral Raises', reps: '12–15' },
    ],
  },
  2: {
    a1: [
      { name: 'DB Bench Press', reps: '12' },
      { name: 'Push-Ups', reps: 'AMRAP −2' },
      { name: 'Alternating DB Bench', reps: '10/side' },
    ],
    a2: [
      { name: 'Swiss Ball Leg Curl', reps: '10–12' },
      { name: 'Single-Leg Glute Bridge', reps: '10/side' },
      { name: 'Swiss Ball Leg Curl', reps: '10–12' },
    ],
    optional: [
      { name: 'DB Farmer Carry', reps: '40 steps · 60–70 lb/hand' },
      { name: 'DB Farmer Carry', reps: '40 steps · 65–75 lb/hand' },
      { name: 'DB Farmer Carry', reps: '40 steps · 70–80 lb/hand' },
    ],
  },
  3: {
    a1: [
      { name: 'Bent-Over BB Row', reps: '10' },
      { name: '1-Arm DB Row', reps: '8/side' },
      { name: 'Bent-Over BB Row', reps: '10' },
    ],
    a2: [
      { name: 'Swiss Ball Stir-the-Pot', reps: '10/dir' },
      { name: 'Ab Wheel', reps: '10' },
      { name: 'Swiss Ball Stir-the-Pot', reps: '10/dir' },
    ],
    optional: [
      { name: 'OH Triceps Extension', reps: '10–12' },
      { name: 'DB Chest Fly', reps: '10–12' },
      { name: 'OH Triceps Extension', reps: '10–12' },
    ],
  },
  4: {
    a1: [
      { name: 'DB Split Squat', reps: '10/side' },
      { name: 'DB Step-Up', reps: '10/side' },
      { name: 'Goblet Squat', reps: '12' },
    ],
    a2: [
      { name: 'Ab Wheel', reps: '10' },
      { name: 'Side Plank', reps: '30 s/side' },
      { name: 'Ab Wheel', reps: '10' },
    ],
    optional: [
      { name: 'Swiss Ball Leg Curl', reps: '10–12' },
      { name: 'DB Curls', reps: '10–12' },
      { name: 'Lateral Raises', reps: '12–15' },
    ],
  },
};

export function assistanceFor(day: number, cycle: number, slot: AssistSlot): AssistMovement {
  const dayData = ASSISTANCE[day];
  const movement = dayData?.[slot][cycle - 1];
  if (!movement) throw new Error(`no assistance for day ${day} cycle ${cycle} ${slot}`);
  return movement;
}

export function assistSetCount(slot: AssistSlot, week: number): number {
  const n = ASSIST_SETS_BY_WEEK[slot][week - 1];
  if (n === undefined) throw new Error(`invalid week: ${week}`);
  return n;
}

/** Hip-prep warm-up checklist shown on squat and deadlift days. */
export const HIP_PREP: AssistMovement[] = [
  { name: 'Glute Bridges', reps: '12' },
  { name: 'Side-Lying Leg Lifts', reps: '10/side' },
  { name: 'Copenhagen Hold', reps: '2 × 10–15 s/side' },
  { name: 'Light Goblet Squats', reps: '8' },
];
