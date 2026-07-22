import Dexie, { type EntityTable } from 'dexie';
import { defaultSettings, type AppSettings } from './lib/seed';
import type { ProgramPosition } from './lib/schedule';

export interface SetLog {
  completed: boolean;
  /** Actual reps performed (used for AMRAP sets) */
  reps?: number;
}

export interface WorkoutLog {
  /** Position id, e.g. "c1w2d3" */
  id: string;
  cycle: number;
  week: number;
  day: number;
  /** Date the workout was actually performed */
  date?: string;
  sets: Record<string, SetLog>;
  /** Actual load logged per accessory block (keyed by block kind: a1/a2/optional), in lb */
  weights?: Record<string, number>;
  /** Set when all main working sets are complete */
  completedAt?: string;
}

export interface BodyweightEntry {
  date: string;
  weight: number;
}

export const db = new Dexie('workout531') as Dexie & {
  settings: EntityTable<AppSettings, 'id'>;
  workoutLogs: EntityTable<WorkoutLog, 'id'>;
  bodyweight: EntityTable<BodyweightEntry, 'date'>;
};

db.version(1).stores({
  settings: 'id',
  workoutLogs: 'id, date',
  bodyweight: 'date',
});

db.on('populate', () => {
  void db.settings.add(defaultSettings());
});

/** Merge a partial patch into the settings singleton. */
export async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  await db.settings.update(1, patch);
}

/**
 * Apply a mutation to a workout log's sets, creating the log if needed and
 * maintaining `date` and `completedAt`.
 */
export async function updateSetLog(
  pos: ProgramPosition,
  logId: string,
  workoutDate: string,
  requiredSetIds: string[],
  mutate: (sets: Record<string, SetLog>) => void,
): Promise<void> {
  await db.transaction('rw', db.workoutLogs, async () => {
    const log: WorkoutLog = (await db.workoutLogs.get(logId)) ?? {
      id: logId,
      cycle: pos.cycle,
      week: pos.week,
      day: pos.day,
      sets: {},
    };
    mutate(log.sets);
    const anyDone = Object.values(log.sets).some((s) => s.completed);
    const allMainDone = requiredSetIds.every((id) => log.sets[id]?.completed);
    log.date = anyDone ? (log.date ?? workoutDate) : undefined;
    log.completedAt = allMainDone ? (log.completedAt ?? new Date().toISOString()) : undefined;
    await db.workoutLogs.put(log);
  });
}

/**
 * Set (or clear, when weight is falsy/≤0) the logged load for an accessory block,
 * creating the log if needed without touching completion state.
 */
export async function setBlockWeight(
  pos: ProgramPosition,
  logId: string,
  blockKind: string,
  weight: number | undefined,
): Promise<void> {
  await db.transaction('rw', db.workoutLogs, async () => {
    const log: WorkoutLog = (await db.workoutLogs.get(logId)) ?? {
      id: logId,
      cycle: pos.cycle,
      week: pos.week,
      day: pos.day,
      sets: {},
    };
    const weights = { ...(log.weights ?? {}) };
    if (weight && Number.isFinite(weight) && weight > 0) {
      weights[blockKind] = weight;
    } else {
      delete weights[blockKind];
    }
    log.weights = weights;
    await db.workoutLogs.put(log);
  });
}
