import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutLog } from '../db';
import { epley1RM, minRepsForWeek, trainingMaxForCycle, type LiftKey } from '../lib/program';
import { buildWorkoutPlan } from '../lib/plan';
import { allPositions, dateForPosition, formatDate, liftForDay, positionId, todayISO } from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import LineChart, { type ChartPoint } from '../components/LineChart';

const LIFT_KEYS: LiftKey[] = ['press', 'deadlift', 'bench', 'squat'];

interface AmrapEntry {
  cycle: number;
  week: number;
  weight: number;
  reps: number;
  min: number;
  e1rm: number;
  dateMs: number;
}

function amrapHistory(lift: LiftKey, settings: AppSettings, logs: WorkoutLog[]): AmrapEntry[] {
  const byId = new Map(logs.map((l) => [l.id, l]));
  const out: AmrapEntry[] = [];
  for (const pos of allPositions()) {
    if (liftForDay(pos.day) !== lift || pos.week === 4) continue;
    const log = byId.get(positionId(pos));
    const top = log?.sets['m3'];
    if (!top?.completed) continue;
    const plan = buildWorkoutPlan(pos, settings);
    const weight = plan.topSetWeight;
    if (weight === undefined) continue;
    const reps = top.reps ?? minRepsForWeek(pos.week);
    if (reps <= 0) continue;
    const date = log?.date ?? dateForPosition(pos, settings.cycleStarts);
    out.push({
      cycle: pos.cycle,
      week: pos.week,
      weight,
      reps,
      min: minRepsForWeek(pos.week),
      e1rm: epley1RM(weight, reps),
      dateMs: Date.parse(`${date}T00:00:00Z`),
    });
  }
  return out;
}

export default function Progress({ settings }: { settings: AppSettings }) {
  const [lift, setLift] = useState<LiftKey>('press');
  const [bwInput, setBwInput] = useState('');
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  const bodyweight = useLiveQuery(() => db.bodyweight.orderBy('date').toArray(), []);
  if (!logs || !bodyweight) return null;

  const cfg = settings.lifts[lift];
  const history = amrapHistory(lift, settings, logs);

  const startMs = Date.parse(`${settings.cycleStarts[0] ?? todayISO()}T00:00:00Z`);
  const e1rmPoints: ChartPoint[] = [
    { x: startMs, y: cfg.oneRepMax },
    ...history.map((h) => ({ x: h.dateMs, y: h.e1rm })),
  ];

  const bwPoints: ChartPoint[] = bodyweight.map((b) => ({
    x: Date.parse(`${b.date}T00:00:00Z`),
    y: b.weight,
  }));

  const fmtDate = (ms: number) => formatDate(new Date(ms).toISOString().slice(0, 10));

  const addBodyweight = () => {
    const w = parseFloat(bwInput);
    if (!Number.isFinite(w) || w <= 0) return;
    void db.bodyweight.put({ date: todayISO(), weight: w });
    setBwInput('');
  };

  return (
    <div>
      <h1 className="screen-title num">Progress</h1>

      <div className="chip-row">
        {LIFT_KEYS.map((k) => (
          <button key={k} className={`chip ${lift === k ? 'chip-active' : ''}`} onClick={() => setLift(k)}>
            {settings.lifts[k].short}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="block-head">
          <h2>Estimated 1RM</h2>
          <span className="muted">{cfg.name}</span>
        </div>
        <LineChart points={e1rmPoints} formatX={fmtDate} />
      </section>

      <section className="card">
        <div className="block-head">
          <h2>Training Max</h2>
        </div>
        <div className="tm-row">
          {[1, 2, 3].map((c) => (
            <div key={c} className="tm-cell">
              <span className="muted">C{c}</span>
              <span className="num tm-val">{trainingMaxForCycle(cfg, c, settings.holds[lift] ?? [])}</span>
              {(settings.holds[lift] ?? []).includes(c - 1) && c > 1 && <span className="badge">held</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="block-head">
          <h2>AMRAP History</h2>
        </div>
        {history.length === 0 && <p className="muted">No AMRAP sets logged yet.</p>}
        {[...history].reverse().map((h, i) => (
          <div key={i} className="amrap-hist-row">
            <span className="muted">
              C{h.cycle} · W{h.week}
            </span>
            <span className="num">
              {h.weight} × {h.reps}
            </span>
            <span className={h.reps >= h.min ? 'made' : 'missed'}>{h.reps >= h.min ? 'made' : 'missed'}</span>
            <span className="num e1rm-val">{Math.round(h.e1rm)}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="block-head">
          <h2>Bodyweight</h2>
        </div>
        <div className="bw-form">
          <input
            type="number"
            inputMode="decimal"
            placeholder="lb"
            value={bwInput}
            onChange={(e) => setBwInput(e.target.value)}
          />
          <button className="btn-primary" onClick={addBodyweight}>
            Log today
          </button>
        </div>
        <LineChart points={bwPoints} color="var(--green)" formatX={fmtDate} formatY={(v) => v.toFixed(0)} />
        {[...bodyweight].reverse().slice(0, 10).map((b) => (
          <div key={b.date} className="bw-row">
            <span className="muted">{formatDate(b.date)}</span>
            <span className="num">{b.weight} lb</span>
            <button className="del-btn" onClick={() => void db.bodyweight.delete(b.date)} aria-label="Delete entry">
              ✕
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
