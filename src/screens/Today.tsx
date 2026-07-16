import { useLiveQuery } from 'dexie-react-hooks';
import { db, patchSettings, type WorkoutLog } from '../db';
import { epley1RM, round5, trainingMaxForCycle } from '../lib/program';
import {
  allPositions,
  formatDate,
  nextFixedWorkout,
  nextRollingSlot,
  positionForDate,
  positionId,
  rollingSlotDates,
  todayISO,
  type ProgramPosition,
} from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import WorkoutView from '../components/WorkoutView';

interface Resolved {
  pos: ProgramPosition;
  date: string;
  badge: string;
}

function resolveWorkout(today: string, settings: AppSettings, logs: WorkoutLog[]): Resolved | null {
  const byId = new Map(logs.map((l) => [l.id, l]));

  if (settings.rollingMode) {
    // Completed something today? Keep showing it.
    const doneToday = logs.find((l) => l.date === today);
    if (doneToday) {
      return {
        pos: { cycle: doneToday.cycle, week: doneToday.week, day: doneToday.day },
        date: today,
        badge: 'Today',
      };
    }
    const all = allPositions();
    const idx = all.findIndex((p) => !byId.get(positionId(p))?.completedAt);
    if (idx === -1) return null;
    const slots = rollingSlotDates(settings.cycleStarts[0] ?? today, all.length);
    const scheduled = slots[idx] ?? today;
    const date = scheduled < today ? nextRollingSlot(today) : scheduled;
    return {
      pos: all[idx],
      date,
      badge: date === today ? 'Today' : `Next · ${formatDate(date)}`,
    };
  }

  const pos = positionForDate(today, settings.cycleStarts);
  if (pos) return { pos, date: today, badge: 'Today' };
  const next = nextFixedWorkout(today, settings.cycleStarts);
  if (!next) return null;
  const beforeStart = today < (settings.cycleStarts[0] ?? '');
  return {
    pos: next.pos,
    date: next.date,
    badge: beforeStart ? `Starts ${formatDate(next.date)}` : `Next · ${formatDate(next.date)}`,
  };
}

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

export default function Today({ settings }: { settings: AppSettings }) {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  if (!logs) return null;

  const today = todayISO();
  const resolved = resolveWorkout(today, settings, logs);

  if (!resolved) {
    return (
      <div className="empty-state">
        <div className="bignum num">DONE</div>
        <p>All 3 cycles complete. 12 weeks in the books.</p>
        <p className="muted">Check Progress for the damage, then set up the next run in Settings.</p>
      </div>
    );
  }

  return (
    <>
      <PressRecalibration settings={settings} logs={logs} />
      <WorkoutView
        pos={resolved.pos}
        date={resolved.date}
        settings={settings}
        badge={resolved.badge}
      />
    </>
  );
}
