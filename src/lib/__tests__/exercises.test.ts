import { describe, expect, it } from 'vitest';
import { BBB_OPTIONS, bbbOptionById, EXERCISE_GROUPS, EXERCISE_LIBRARY, exerciseById } from '../exercises';

describe('exercise library', () => {
  it('has unique ids across accessories and BBB options', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bbbIds = BBB_OPTIONS.map((o) => o.id);
    expect(new Set(bbbIds).size).toBe(bbbIds.length);
  });

  it('never uses the reserved "default" id', () => {
    expect(exerciseById('default')).toBeUndefined();
    expect(bbbOptionById('default')).toBeUndefined();
  });

  it('every exercise belongs to a rendered group', () => {
    for (const e of EXERCISE_LIBRARY) expect(EXERCISE_GROUPS).toContain(e.group);
  });

  it('looks up chin-ups as an unloaded pull movement', () => {
    const e = exerciseById('chin-ups');
    expect(e?.name).toBe('Chin-Ups');
    expect(e?.weighted).toBe(false);
    expect(e?.group).toBe('Pull');
  });

  it('every BBB option maps to a real lift TM', () => {
    for (const o of BBB_OPTIONS) expect(['press', 'bench', 'squat', 'deadlift']).toContain(o.tmSource);
  });
});
