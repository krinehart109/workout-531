import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutLog } from '../db';
import { epley1RM, minRepsForWeek, trainingMaxForCycle, type LiftKey } from '../lib/program';
import { buildWorkoutPlan } from '../lib/plan';
import { assistanceFor, type AssistSlot } from '../lib/assistance';
import { exerciseById } from '../lib/exercises';
import { allPositions, dateForPosition, formatDate, liftForDay, positionId, todayISO } from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import LineChart, { type ChartPoint } from '../components/LineChart';

const LIFT_KEYS: LiftKey[] = ['press', 'deadlift', 'bench', 'squat'];
const ASSIST_SLOTS: AssistSlot[] = ['a1', 'a2', 'optional'];

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

interface LoadPoint {
  dateMs: number;
  weight: number;
  cycle: number;
  week: number;
}

/** Logged accessory loads grouped by movement name (movements rotate per cycle). */
function accessoryHistory(settings: AppSettings, logs: WorkoutLog[]): Map<string, LoadPoint[]> {
  const map = new Map<string, LoadPoint[]>();
  for (const log of logs) {
    if (!log.weights) continue;
    for (const slot of ASSIST_SLOTS) {
      const weight = log.weights[slot];
      if (!weight) continue;
      // A swapped exercise charts under its own name, not the programmed one
      const overrideId = log.overrides?.[slot];
      let name: string;
      if (overrideId) {
        const ex = exerciseById(overrideId);
        if (!ex) continue;
        name = ex.name;
      } else {
        try {
          name = assistanceFor(log.day, log.cycle, slot).name;
        } catch {
          continue;
        }
      }
      const date = log.date ?? dateForPosition({ cycle: log.cycle, week: log.week, day: log.day }, settings.cycleStarts);
      const point: LoadPoint = { dateMs: Date.parse(`${date}T00:00:00Z`), weight, cycle: log.cycle, week: log.week };
      const arr = map.get(name);
      if (arr) arr.push(point);
      else map.set(name, [point]);
    }
  }
  for (const arr of map.values()) arr.sort((a, b) => a.dateMs - b.dateMs);
  return map;
}

function AccessoryLoads({
  settings,
  logs,
  fmtDate,
}: {
  settings: AppSettings;
  logs: WorkoutLog[];
  fmtDate: (ms: number) => string;
}) {
  const history = useMemo(() => accessoryHistory(settings, logs), [settings, logs]);
  const names = useMemo(() => [...history.keys()].sort(), [history]);
  const [selected, setSelected] = useState<string | null>(null);

  if (names.length === 0) {
    return (
      <section className="card">
        <div className="block-head">
          <h2>Accessory Loads</h2>
        </div>
        <p className="muted">Log a weight on any dumbbell or barbell accessory and it charts here.</p>
      </section>
    );
  }

  const active = selected && history.has(selected) ? selected : names[0];
  const entries = history.get(active) ?? [];
  const points: ChartPoint[] = entries.map((e) => ({ x: e.dateMs, y: e.weight }));

  return (
    <section className="card">
      <div className="block-head">
        <h2>Accessory Loads</h2>
        <span className="muted">actual weight logged</span>
      </div>
      <div className="chip-row">
        {names.map((n) => (
          <button
            key={n}
            className={`chip chip-sm ${active === n ? 'chip-active' : ''}`}
            onClick={() => setSelected(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <LineChart points={points} formatX={fmtDate} formatY={(v) => v.toFixed(0)} />
      {[...entries].reverse().map((e, i) => (
        <div key={i} className="bw-row">
          <span className="muted">
            C{e.cycle} · W{e.week}
          </span>
          <span className="num load-hist-val">{e.weight} lb</span>
        </div>
      ))}
    </section>
  );
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

      <AccessoryLoads settings={settings} logs={logs} fmtDate={fmtDate} />

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
