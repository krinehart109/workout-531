import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildWorkoutPlan } from '../lib/plan';
import { WEEK_NAMES } from '../lib/program';
import {
  allPositions,
  dateForPosition,
  formatDate,
  positionId,
  rollingSlotDates,
  type ProgramPosition,
} from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import WorkoutView from '../components/WorkoutView';

const DAY_HEADS = ['OHP', 'DL', 'Bench', 'Squat'];

export default function Program({ settings }: { settings: AppSettings }) {
  const [selected, setSelected] = useState<ProgramPosition | null>(null);
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  if (!logs) return null;
  const byId = new Map(logs.map((l) => [l.id, l]));

  const all = allPositions();
  const slots = settings.rollingMode ? rollingSlotDates(settings.cycleStarts[0] ?? '2026-07-20', all.length) : null;

  const dateFor = (pos: ProgramPosition): string => {
    if (slots) {
      const idx = all.findIndex((p) => positionId(p) === positionId(pos));
      return slots[idx] ?? dateForPosition(pos, settings.cycleStarts);
    }
    return dateForPosition(pos, settings.cycleStarts);
  };

  if (selected) {
    return (
      <WorkoutView
        pos={selected}
        date={byId.get(positionId(selected))?.date ?? dateFor(selected)}
        settings={settings}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <h1 className="screen-title num">Program</h1>
      {[1, 2, 3].map((cycle) => (
        <section key={cycle} className="card">
          <div className="block-head">
            <h2>Cycle {cycle}</h2>
            <span className="muted">{formatDate(settings.cycleStarts[cycle - 1] ?? '2026-07-20')}</span>
          </div>
          <div className="pgrid">
            <div className="pgrid-row pgrid-head">
              <span />
              {DAY_HEADS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {[1, 2, 3, 4].map((week) => (
              <div key={week} className="pgrid-row">
                <span className="pgrid-week muted">{WEEK_NAMES[week]}</span>
                {[1, 2, 3, 4].map((day) => {
                  const pos = { cycle, week, day };
                  const log = byId.get(positionId(pos));
                  const plan = buildWorkoutPlan(pos, settings);
                  const done = Boolean(log?.completedAt);
                  const started = !done && Object.values(log?.sets ?? {}).some((s) => s.completed);
                  return (
                    <button
                      key={day}
                      className={`pcell ${done ? 'pcell-done' : ''} ${started ? 'pcell-started' : ''}`}
                      onClick={() => setSelected(pos)}
                    >
                      <span className="num pcell-weight">
                        {plan.topSetWeight ?? plan.blocks.find((b) => b.kind === 'main')?.sets.at(-1)?.weight}
                      </span>
                      {done && <span className="pcell-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="muted center">Tap any day to view or edit its log — including past weeks.</p>
    </div>
  );
}
