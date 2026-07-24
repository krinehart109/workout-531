import { describe, expect, it } from 'vitest';
import {
  allPositions,
  cardioId,
  dateForPosition,
  daysBetween,
  liftForDay,
  nextFixedWorkout,
  positionForDate,
  positionId,
  weekdayOf,
  weekForDate,
} from '../schedule';

const STARTS = ['2026-07-20', '2026-08-17', '2026-09-14'];

describe('date helpers', () => {
  it('cycle starts are Mondays', () => {
    for (const s of STARTS) expect(weekdayOf(s)).toBe(1);
  });

  it('cycles are 28 days apart', () => {
    expect(daysBetween(STARTS[0], STARTS[1])).toBe(28);
    expect(daysBetween(STARTS[1], STARTS[2])).toBe(28);
  });
});

describe('fixed schedule (Mon Press / Tue DL / Thu Bench / Fri Squat)', () => {
  it('maps program start to cycle 1 week 1 press day', () => {
    expect(positionForDate('2026-07-20', STARTS)).toEqual({ cycle: 1, week: 1, day: 1 });
    expect(liftForDay(1)).toBe('press');
  });

  it('maps the rest of week 1', () => {
    expect(positionForDate('2026-07-21', STARTS)).toEqual({ cycle: 1, week: 1, day: 2 }); // Tue DL
    expect(positionForDate('2026-07-23', STARTS)).toEqual({ cycle: 1, week: 1, day: 3 }); // Thu bench
    expect(positionForDate('2026-07-24', STARTS)).toEqual({ cycle: 1, week: 1, day: 4 }); // Fri squat
  });

  it('rest days and off-program dates return null', () => {
    expect(positionForDate('2026-07-22', STARTS)).toBeNull(); // Wed
    expect(positionForDate('2026-07-25', STARTS)).toBeNull(); // Sat
    expect(positionForDate('2026-07-19', STARTS)).toBeNull(); // day before start
    expect(positionForDate('2026-10-15', STARTS)).toBeNull(); // after program
  });

  it('advances weeks and cycles', () => {
    expect(positionForDate('2026-07-28', STARTS)).toEqual({ cycle: 1, week: 2, day: 2 });
    expect(positionForDate('2026-08-14', STARTS)).toEqual({ cycle: 1, week: 4, day: 4 });
    expect(positionForDate('2026-08-17', STARTS)).toEqual({ cycle: 2, week: 1, day: 1 });
    expect(positionForDate('2026-09-14', STARTS)).toEqual({ cycle: 3, week: 1, day: 1 });
  });

  it('round-trips position → date → position', () => {
    for (const pos of allPositions()) {
      const date = dateForPosition(pos, STARTS);
      expect(positionForDate(date, STARTS)).toEqual(pos);
    }
  });

  it('finds the next workout from a rest day', () => {
    const next = nextFixedWorkout('2026-07-22', STARTS); // Wed of week 1
    expect(next?.pos).toEqual({ cycle: 1, week: 1, day: 3 });
    expect(next?.date).toBe('2026-07-23');
  });

  it('finds the first workout before the program starts', () => {
    const next = nextFixedWorkout('2026-07-15', STARTS);
    expect(next?.pos).toEqual({ cycle: 1, week: 1, day: 1 });
    expect(next?.date).toBe('2026-07-20');
  });

  it('returns null after the program ends', () => {
    expect(nextFixedWorkout('2026-10-12', STARTS)).toBeNull();
  });
});

describe('program enumeration', () => {
  it('has 48 workouts in order', () => {
    const all = allPositions();
    expect(all).toHaveLength(48);
    expect(positionId(all[0])).toBe('c1w1d1');
    expect(positionId(all[47])).toBe('c3w4d4');
    expect(positionId(all[4])).toBe('c1w2d1');
  });
});

describe('flexible mode (weekForDate)', () => {
  it('maps any weekday — including rest days and weekends — to its week', () => {
    expect(weekForDate('2026-07-20', STARTS)).toEqual({ cycle: 1, week: 1 }); // Mon
    expect(weekForDate('2026-07-22', STARTS)).toEqual({ cycle: 1, week: 1 }); // Wed
    expect(weekForDate('2026-07-26', STARTS)).toEqual({ cycle: 1, week: 1 }); // Sun
    expect(weekForDate('2026-07-27', STARTS)).toEqual({ cycle: 1, week: 2 });
  });

  it('advances cycles and caps at the end', () => {
    expect(weekForDate('2026-08-16', STARTS)).toEqual({ cycle: 1, week: 4 }); // last Sunday of C1
    expect(weekForDate('2026-08-17', STARTS)).toEqual({ cycle: 2, week: 1 });
    expect(weekForDate('2026-10-11', STARTS)).toEqual({ cycle: 3, week: 4 }); // day 27 of C3
    expect(weekForDate('2026-10-12', STARTS)).toBeNull(); // program over
    expect(weekForDate('2026-07-19', STARTS)).toBeNull(); // before start
  });

  it('cardio ids are per cycle/week/slot', () => {
    expect(cardioId(1, 2, 3)).toBe('c1w2k3');
  });
});
