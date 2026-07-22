import { describe, expect, it } from 'vitest';
import { bbbLiftName, buildWorkoutPlan, requiredSetIds } from '../plan';
import { defaultSettings } from '../seed';

const settings = defaultSettings();

function block(plan: ReturnType<typeof buildWorkoutPlan>, kind: string) {
  const b = plan.blocks.find((b) => b.kind === kind);
  if (!b) throw new Error(`no ${kind} block`);
  return b;
}

describe('buildWorkoutPlan', () => {
  it('cycle 1 week 1 press day: TM 75, top set 65×5+', () => {
    const plan = buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings);
    expect(plan.liftKey).toBe('press');
    expect(plan.tm).toBe(75);
    const main = block(plan, 'main');
    expect(main.sets.map((s) => s.weight)).toEqual([50, 55, 65]);
    expect(plan.topSetId).toBe('m3');
    expect(plan.topSetWeight).toBe(65);
    expect(main.sets[2].reps).toBe('5+');
    expect(main.sets[2].minReps).toBe(5);
  });

  it('press warm-ups collapse to the empty bar', () => {
    const plan = buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings);
    const wu = block(plan, 'warmup');
    expect(wu.sets.map((s) => s.weight)).toEqual([45, 45, 45]);
    expect(wu.sets.every((s) => s.isBar)).toBe(true);
  });

  it('cycle 1 week 3 deadlift: 175×5, 195×3, 220×1+', () => {
    const plan = buildWorkoutPlan({ cycle: 1, week: 3, day: 2 }, settings);
    expect(plan.tm).toBe(230);
    expect(block(plan, 'main').sets.map((s) => s.weight)).toEqual([175, 195, 220]);
    expect(block(plan, 'main').sets[2].reps).toBe('1+');
  });

  it('deload week has no AMRAP top set', () => {
    const plan = buildWorkoutPlan({ cycle: 1, week: 4, day: 4 }, settings);
    expect(plan.topSetId).toBeUndefined();
    expect(block(plan, 'main').sets.every((s) => !s.amrap)).toBe(true);
  });

  it('BBB: 3×10 @ 50% in c1w1, 5×10 in week 3, 2×10 @ 40% on deload', () => {
    const w1 = block(buildWorkoutPlan({ cycle: 1, week: 1, day: 4 }, settings), 'bbb');
    expect(w1.sets).toHaveLength(3);
    expect(w1.sets[0].weight).toBe(80); // 50% of 155 = 77.5 → 80
    const w3 = block(buildWorkoutPlan({ cycle: 1, week: 3, day: 4 }, settings), 'bbb');
    expect(w3.sets).toHaveLength(5);
    const w4 = block(buildWorkoutPlan({ cycle: 2, week: 4, day: 4 }, settings), 'bbb');
    expect(w4.sets).toHaveLength(2);
    expect(w4.sets[0].pct).toBe(0.4);
  });

  it('deadlift-day BBB alternates RDL / Deadlift / RDL by cycle', () => {
    expect(bbbLiftName(2, 1, settings.lifts)).toBe('Barbell RDL');
    expect(bbbLiftName(2, 2, settings.lifts)).toBe('Deadlift');
    expect(bbbLiftName(2, 3, settings.lifts)).toBe('Barbell RDL');
    expect(bbbLiftName(1, 1, settings.lifts)).toBe('Overhead Press');
  });

  it('hip prep appears on squat and deadlift days only', () => {
    expect(buildWorkoutPlan({ cycle: 1, week: 1, day: 2 }, settings).blocks[0].kind).toBe('hipprep');
    expect(buildWorkoutPlan({ cycle: 1, week: 1, day: 4 }, settings).blocks[0].kind).toBe('hipprep');
    expect(buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings).blocks[0].kind).toBe('warmup');
    expect(buildWorkoutPlan({ cycle: 1, week: 1, day: 3 }, settings).blocks[0].kind).toBe('warmup');
  });

  it('assistance sets ramp by week: A1 2/3/4/2, A2 2/2/3/2, optional skipped on deload', () => {
    const w1 = buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings);
    expect(block(w1, 'a1').sets).toHaveLength(2);
    expect(block(w1, 'a2').sets).toHaveLength(2);
    expect(block(w1, 'optional').sets).toHaveLength(2);
    const w3 = buildWorkoutPlan({ cycle: 1, week: 3, day: 1 }, settings);
    expect(block(w3, 'a1').sets).toHaveLength(4);
    expect(block(w3, 'a2').sets).toHaveLength(3);
    const w4 = buildWorkoutPlan({ cycle: 1, week: 4, day: 1 }, settings);
    expect(block(w4, 'a1').sets).toHaveLength(2);
    expect(w4.blocks.find((b) => b.kind === 'optional')).toBeUndefined();
  });

  it('flags loaded accessory movements for weight logging, not bodyweight ones', () => {
    // Press day C1: A1 = 1-Arm DB Row (loaded), A2 = Ab Wheel (bodyweight)
    const press = buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings);
    expect(block(press, 'a1').logWeight).toBe(true);
    expect(block(press, 'a2').logWeight).toBe(false);
    expect(block(press, 'optional').logWeight).toBe(true); // Lateral Raises
    // Deadlift day C1: A1 = DB Bench (loaded), A2 = Swiss Ball Leg Curl (bodyweight)
    const dl = buildWorkoutPlan({ cycle: 1, week: 1, day: 2 }, settings);
    expect(block(dl, 'a1').logWeight).toBe(true);
    expect(block(dl, 'a2').logWeight).toBe(false);
    // Squat day C1: A2 = Ab Wheel (bodyweight), C2 A2 = Side Plank (bodyweight)
    expect(block(buildWorkoutPlan({ cycle: 2, week: 1, day: 4 }, settings), 'a2').logWeight).toBe(false);
    // BBB and main blocks never carry the accessory load control
    expect(block(press, 'bbb').logWeight).toBeFalsy();
    expect(block(press, 'main').logWeight).toBeFalsy();
  });

  it('assistance rotates by cycle (press day A1)', () => {
    expect(block(buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings), 'a1').title).toContain('1-Arm DB Row');
    expect(block(buildWorkoutPlan({ cycle: 2, week: 1, day: 1 }, settings), 'a1').title).toContain('Underhand BB Row');
    expect(block(buildWorkoutPlan({ cycle: 3, week: 1, day: 1 }, settings), 'a1').title).toContain('2-DB Bent-Over Row');
  });

  it('required sets are exactly the three main working sets', () => {
    const plan = buildWorkoutPlan({ cycle: 1, week: 2, day: 3 }, settings);
    expect(requiredSetIds(plan)).toEqual(['m1', 'm2', 'm3']);
  });

  it('TM holds flow through to weights', () => {
    const held = { ...settings, holds: { press: [1] } };
    expect(buildWorkoutPlan({ cycle: 2, week: 1, day: 1 }, held).tm).toBe(75);
    expect(buildWorkoutPlan({ cycle: 2, week: 1, day: 1 }, settings).tm).toBe(80);
  });
});
