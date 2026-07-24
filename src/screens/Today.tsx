import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, patchSettings, type WorkoutLog } from '../db';
import { epley1RM, round5, trainingMaxForCycle, WEEK_NAMES } from '../lib/program';
import { buildWorkoutPlan } from '../lib/plan';
import {
  cardioId,
  DAY_LIFT,
  formatDate,
  nextFixedWorkout,
  positionForDate,
  positionId,
  todayISO,
  weekForDate,
  type ProgramPosition,
} from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import WorkoutView from '../components/WorkoutView';

/** Recalibration prompt for the estimated OHP max, after the C1W1 5+ set. */
function PressRecalibration({ settings, logs }: { settings: AppSettings; logs: WorkoutLog[] }) {
  if (settings.flags.pressRecalDone) return null;
  const log = logs.find((l) => l.id === 'c1w1d1');
  const top = log?.sets['m3'];
  if (!top?.completed) return null;
  const reps = top.reps ?? 5;
  if (reps >= 5 && reps < 8) return null;

  const press = settings.lifts.press;
  const tm = trainingMaxForCycle(press, 1, settings.holds.press ?? []);
  const topWeight = Math.max(round5(tm * 0.85), settings.barWeight);
  const newMax = Math.round(epley1RM(topWeight, reps));
  const newTM = round5(newMax * press.tmPercent);
  const dismiss = () => void patchSettings({ flags: { ...settings.flags, pressRecalDone: true } });

  return (
    <div className="note note-accent">
      <b>Recalibrate OHP?</b> Your week-1 AMRAP was {topWeight} × {reps}
      {reps >= 8 ? ' — stronger than the estimate.' : ' — the estimate was too high.'} That puts
      your e1RM at <b className="num">{newMax}</b> (new TM would be <b className="num">{newTM}</b>).
      <div className="note-actions">
        <button
          className="btn-primary"
          onClick={() => {
            void patchSettings({
              lifts: { ...settings.lifts, press: { ...press, oneRepMax: newMax } },
              flags: { ...settings.flags, pressRecalDone: true },
            });
          }}
        >
          Set 1RM to {newMax}
        </button>
        <button className="btn-secondary" onClick={dismiss}>
          Keep {press.oneRepMax}
        </button>
      </div>
    </div>
  );
}

/** The week's cardio sessions — tap to check off, any days you like. */
function CardioCard({ cycle, week, count }: { cycle: number; week: number; count: number }) {
  const sessions = useLiveQuery(
    () => db.cardioLogs.bulkGet(Array.from({ length: count }, (_, i) => cardioId(cycle, week, i + 1))),
    [cycle, week, count],
  );
  if (!sessions) return null;

  const toggle = (slot: number) => {
    const id = cardioId(cycle, week, slot);
    const existing = sessions[slot - 1];
    if (existing) void db.cardioLogs.delete(id);
    else void db.cardioLogs.put({ id, cycle, week, slot, date: todayISO() });
  };

  return (
    <div className="cardio-row">
      <span className="cardio-label muted">Cardio</span>
      {Array.from({ length: count }, (_, i) => {
        const s = sessions[i];
        return (
          <button
            key={i}
            className={`cardio-pill ${s ? 'cardio-done' : ''}`}
            onClick={() => toggle(i + 1)}
            aria-label={`Cardio session ${i + 1}${s ? ' (done)' : ''}`}
          >
            {s ? formatDate(s.date).split(',')[0] : i + 1}
          </button>
        );
      })}
    </div>
  );
}

/** Flexible week: pick any of the week's 4 lifts + cardio, in any order. */
function FlexWeek({
  cycle,
  week,
  settings,
  logs,
  preStartBadge,
}: {
  cycle: number;
  week: number;
  settings: AppSettings;
  logs: WorkoutLog[];
  preStartBadge?: string;
}) {
  const byId = new Map(logs.map((l) => [l.id, l]));
  const today = todayISO();
  const dayLogs = [1, 2, 3, 4].map((d) => byId.get(positionId({ cycle, week, day: d })));

  const doneToday = dayLogs.findIndex((l) => l?.date === today && l.completedAt);
  const firstIncomplete = dayLogs.findIndex((l) => !l?.completedAt);
  const defaultDay = doneToday >= 0 ? doneToday + 1 : firstIncomplete >= 0 ? firstIncomplete + 1 : 4;
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  const pos: ProgramPosition = { cycle, week, day: selectedDay };

  return (
    <>
      <section className="card week-card">
        <div className="block-head">
          <h2>
            Week {week} · {WEEK_NAMES[week]}
          </h2>
          <span className="muted">Cycle {cycle} · any order, any days</span>
        </div>
        <div className="week-menu">
          {[1, 2, 3, 4].map((d) => {
            const log = dayLogs[d - 1];
            const done = Boolean(log?.completedAt);
            const plan = buildWorkoutPlan({ cycle, week, day: d }, settings);
            const top = plan.topSetWeight ?? plan.blocks.find((b) => b.kind === 'main')?.sets.at(-1)?.weight;
            return (
              <button
                key={d}
                className={`wm-chip ${selectedDay === d ? 'wm-active' : ''} ${done ? 'wm-done' : ''}`}
                onClick={() => setSelectedDay(d)}
              >
                <span className="wm-lift">{settings.lifts[DAY_LIFT[d - 1]].short}</span>
                <span className="num wm-weight">{done ? '✓' : top}</span>
              </button>
            );
          })}
        </div>
        <CardioCard cycle={cycle} week={week} count={settings.cardioPerWeek ?? 3} />
      </section>
      <WorkoutView pos={pos} date={today} settings={settings} badge={preStartBadge} />
    </>
  );
}

export default function Today({ settings }: { settings: AppSettings }) {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  if (!logs) return null;

  const today = todayISO();
  const mode = settings.scheduleMode ?? 'flex';
  const starts = settings.cycleStarts;

  const doneState = (
    <div className="empty-state">
      <div className="bignum num">DONE</div>
      <p>All 3 cycles complete. 12 weeks in the books.</p>
      <p className="muted">Check Progress for the damage, then set up the next run in Settings.</p>
    </div>
  );

  if (mode === 'fixed') {
    const pos = positionForDate(today, starts);
    const next = pos ? null : nextFixedWorkout(today, starts);
    if (!pos && !next) return doneState;
    const resolved = pos
      ? { pos, date: today, badge: 'Today' }
      : {
          pos: next!.pos,
          date: next!.date,
          badge:
            today < (starts[0] ?? '') ? `Starts ${formatDate(next!.date)}` : `Next · ${formatDate(next!.date)}`,
        };
    return (
      <>
        <PressRecalibration settings={settings} logs={logs} />
        <WorkoutView pos={resolved.pos} date={resolved.date} settings={settings} badge={resolved.badge} />
      </>
    );
  }

  // Flexible mode
  const wk = weekForDate(today, starts);
  const beforeStart = !wk && today < (starts[0] ?? '');
  if (!wk && !beforeStart) return doneState;
  const cycle = wk?.cycle ?? 1;
  const week = wk?.week ?? 1;

  return (
    <>
      <PressRecalibration settings={settings} logs={logs} />
      <FlexWeek
        key={`c${cycle}w${week}`}
        cycle={cycle}
        week={week}
        settings={settings}
        logs={logs}
        preStartBadge={beforeStart ? `Starts ${formatDate(starts[0] ?? today)}` : undefined}
      />
    </>
  );
}
