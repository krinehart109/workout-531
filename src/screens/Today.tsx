import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, patchSettings, type WorkoutLog } from '../db';
import { epley1RM, round5, WEEK_NAMES } from '../lib/program';
import { buildWorkoutPlan } from '../lib/plan';
import {
  cardioId,
  DAY_LIFT,
  formatDate,
  nextFixedWorkout,
  nextIncompletePosition,
  positionForDate,
  positionId,
  todayISO,
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
  const topWeight = buildWorkoutPlan({ cycle: 1, week: 1, day: 1 }, settings).topSetWeight ?? settings.barWeight;
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

/** Flexible week: the next incomplete workout opens by default; pick any of
 * the week's 4 lifts + cardio, in any order, on any days. */
function FlexWeek({
  cycle,
  week,
  nextDay,
  settings,
  logs,
}: {
  cycle: number;
  week: number;
  /** Day slot of the next incomplete workout in program order */
  nextDay: number;
  settings: AppSettings;
  logs: WorkoutLog[];
}) {
  // Anchor the view at mount so finishing sets never yanks the screen to the
  // next workout mid-session; each fresh app open re-anchors to what's next.
  const [anchor] = useState(() => ({ cycle, week, nextDay }));
  const byId = new Map(logs.map((l) => [l.id, l]));
  const today = todayISO();
  const dayLogs = [1, 2, 3, 4].map((d) =>
    byId.get(positionId({ cycle: anchor.cycle, week: anchor.week, day: d })),
  );
  const [selectedDay, setSelectedDay] = useState(anchor.nextDay);

  const pos: ProgramPosition = { cycle: anchor.cycle, week: anchor.week, day: selectedDay };

  return (
    <>
      <section className="card week-card">
        <div className="block-head">
          <h2>
            Week {anchor.week} · {WEEK_NAMES[anchor.week]}
          </h2>
          <span className="muted">Cycle {anchor.cycle} · any order, any days</span>
        </div>
        <div className="week-menu">
          {[1, 2, 3, 4].map((d) => {
            const log = dayLogs[d - 1];
            const done = Boolean(log?.completedAt);
            const plan = buildWorkoutPlan({ cycle: anchor.cycle, week: anchor.week, day: d }, settings);
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
        <CardioCard cycle={anchor.cycle} week={anchor.week} count={settings.cardioPerWeek ?? 3} />
      </section>
      <WorkoutView
        pos={pos}
        date={today}
        settings={settings}
        badge={selectedDay === anchor.nextDay ? 'Up next' : undefined}
      />
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

  // Flexible mode: the calendar is irrelevant — open the first incomplete
  // workout in program order.
  const completedIds = new Set(logs.filter((l) => l.completedAt).map((l) => l.id));
  const next = nextIncompletePosition(completedIds);
  if (!next) return doneState;

  return (
    <>
      <PressRecalibration settings={settings} logs={logs} />
      <FlexWeek cycle={next.cycle} week={next.week} nextDay={next.day} settings={settings} logs={logs} />
    </>
  );
}
