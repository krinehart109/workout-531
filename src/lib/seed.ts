// Default settings seeded into IndexedDB on first run. Everything here is
// editable later in Settings.

import type { LiftConfig, LiftKey } from './program';
import type { PlatePair } from './plates';

export interface RestSettings {
  main: number;
  bbb: number;
  assistance: number;
}

export interface AppSettings {
  id: number;
  lifts: Record<LiftKey, LiftConfig>;
  barWeight: number;
  plates: PlatePair[];
  rollingMode: boolean;
  /** Monday start date of each cycle, YYYY-MM-DD */
  cycleStarts: string[];
  /** Per lift: cycles AFTER which the TM increment is held (skipped) */
  holds: Partial<Record<LiftKey, number[]>>;
  /** Rest timer durations in seconds */
  rest: RestSettings;
  /** One-off UI flags (dismissed prompts etc.) */
  flags: Record<string, boolean>;
}

export function defaultSettings(): AppSettings {
  const lifts: Record<LiftKey, LiftConfig> = {
    press: {
      key: 'press',
      name: 'Overhead Press',
      short: 'OHP',
      oneRepMax: 85, // estimated — never barbell pressed; recalibrate after week 1
      tmPercent: 0.9,
      increment: 5,
    },
    bench: {
      key: 'bench',
      name: 'Bench Press',
      short: 'Bench',
      oneRepMax: 138, // from 115×6
      tmPercent: 0.9,
      increment: 5,
    },
    squat: {
      key: 'squat',
      name: 'Back Squat',
      short: 'Squat',
      oneRepMax: 180, // from 150×6
      tmPercent: 0.85, // groin caution — conservative TM
      increment: 10,
    },
    deadlift: {
      key: 'deadlift',
      name: 'Deadlift',
      short: 'DL',
      oneRepMax: 255, // from 225×4
      tmPercent: 0.9,
      increment: 10,
    },
  };

  return {
    id: 1,
    lifts,
    barWeight: 45,
    plates: [
      { size: 45, pairs: 2 },
      { size: 25, pairs: 1 },
      { size: 10, pairs: 2 },
      { size: 5, pairs: 1 },
      { size: 2.5, pairs: 1 },
    ],
    rollingMode: false,
    cycleStarts: ['2026-07-20', '2026-08-17', '2026-09-14'],
    holds: {},
    rest: { main: 180, bbb: 90, assistance: 75 },
    flags: {},
  };
}
