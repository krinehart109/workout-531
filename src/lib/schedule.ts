// Date → program-position mapping. All dates are 'YYYY-MM-DD' strings,
// with math done in UTC so local timezones can't shift a day.

import type { LiftKey } from './program';

export interface ProgramPosition {
  cycle: number; // 1..3
  week: number; // 1..4
  day: number; // 1..4
}

export const CYCLES = 3;
export const WEEKS_PER_CYCLE = 4;
export const DAYS_PER_WEEK = 4;

/** Day slot (1..4) → lift trained that day. */
export const DAY_LIFT: LiftKey[] = ['press', 'deadlift', 'bench', 'squat'];

export function liftForDay(day: number): LiftKey {
  const lift = DAY_LIFT[day - 1];
  if (!lift) throw new Error(`invalid day: ${day}`);
  return lift;
}

const DAY_MS = 86_400_000;

function toUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUTC(toIso) - toUTC(fromIso)) / DAY_MS);
}

/** 0=Sun … 6=Sat */
export function weekdayOf(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

/** Today's date in the LOCAL timezone as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string): string {
  return new Date(toUTC(iso)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function positionId(pos: ProgramPosition): string {
  return `c${pos.cycle}w${pos.week}d${pos.day}`;
}

/** Every position in program order: c1w1d1 … c3w4d4 (48 workouts). */
export function allPositions(): ProgramPosition[] {
  const out: ProgramPosition[] = [];
  for (let cycle = 1; cycle <= CYCLES; cycle++)
    for (let week = 1; week <= WEEKS_PER_CYCLE; week++)
      for (let day = 1; day <= DAYS_PER_WEEK; day++) out.push({ cycle, week, day });
  return out;
}

// ---- Fixed schedule: Mon=Press, Tue=Deadlift, Thu=Bench, Fri=Squat ----

const FIXED_WEEKDAY_TO_DAY: Record<number, number> = { 1: 1, 2: 2, 4: 3, 5: 4 };
/** Offset in days from the week's Monday for day slots 1..4. */
const FIXED_DAY_OFFSET = [0, 1, 3, 4];

/**
 * The workout scheduled on a given date under the fixed weekly schedule,
 * or null if it's a rest day / outside the program. Cycle starts are Mondays.
 */
export function positionForDate(iso: string, cycleStarts: string[]): ProgramPosition | null {
  for (let c = 0; c < cycleStarts.length; c++) {
    const start = cycleStarts[c];
    if (start === undefined) continue;
    const d = daysBetween(start, iso);
    if (d >= 0 && d < WEEKS_PER_CYCLE * 7) {
      const day = FIXED_WEEKDAY_TO_DAY[weekdayOf(iso)];
      if (!day) return null;
      return { cycle: c + 1, week: Math.floor(d / 7) + 1, day };
    }
  }
  return null;
}

/** Calendar date of a position under the fixed schedule. */
export function dateForPosition(pos: ProgramPosition, cycleStarts: string[]): string {
  const start = cycleStarts[pos.cycle - 1];
  if (start === undefined) throw new Error(`no start date for cycle ${pos.cycle}`);
  const offset = FIXED_DAY_OFFSET[pos.day - 1];
  if (offset === undefined) throw new Error(`invalid day: ${pos.day}`);
  return addDays(start, (pos.week - 1) * 7 + offset);
}

/** First workout on/after a date under the fixed schedule (null if program is over). */
export function nextFixedWorkout(
  fromIso: string,
  cycleStarts: string[],
): { pos: ProgramPosition; date: string } | null {
  for (const pos of allPositions()) {
    const date = dateForPosition(pos, cycleStarts);
    if (date >= fromIso) return { pos, date };
  }
  return null;
}

// ---- Rolling 3-day mode: workouts proceed in order on Mon/Wed/Fri ----

const ROLLING_WEEKDAYS = new Set([1, 3, 5]);

/** The first `count` Mon/Wed/Fri dates on or after `startIso`. */
export function rollingSlotDates(startIso: string, count: number): string[] {
  const out: string[] = [];
  let d = startIso;
  while (out.length < count) {
    if (ROLLING_WEEKDAYS.has(weekdayOf(d))) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Next Mon/Wed/Fri on or after a date. */
export function nextRollingSlot(fromIso: string): string {
  let d = fromIso;
  while (!ROLLING_WEEKDAYS.has(weekdayOf(d))) d = addDays(d, 1);
  return d;
}
