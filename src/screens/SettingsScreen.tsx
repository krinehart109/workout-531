import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, patchSettings, type WorkoutLog } from '../db';
import { exportJSON, importJSON } from '../backup';
import {
  baseTrainingMax,
  epley1RM,
  minRepsForWeek,
  trainingMaxForCycle,
  type LiftKey,
} from '../lib/program';
import { buildWorkoutPlan } from '../lib/plan';
import { liftForDay, positionId, weekdayOf, type ProgramPosition } from '../lib/schedule';
import type { AppSettings } from '../lib/seed';

const LIFT_KEYS: LiftKey[] = ['press', 'bench', 'squat', 'deadlift'];

function NumberField({
  label,
  value,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        value={text ?? String(value)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text === null) return;
          const v = parseFloat(text);
          if (Number.isFinite(v)) onCommit(v);
          setText(null);
        }}
      />
    </label>
  );
}

function LiftEditor({ settings }: { settings: AppSettings }) {
  const patchLift = (key: LiftKey, patch: Partial<AppSettings['lifts'][LiftKey]>) =>
    void patchSettings({ lifts: { ...settings.lifts, [key]: { ...settings.lifts[key], ...patch } } });

  return (
    <section className="card">
      <div className="block-head">
        <h2>Lifts</h2>
        <span className="muted">TM = 1RM × TM%, nearest 5</span>
      </div>
      {LIFT_KEYS.map((key) => {
        const lift = settings.lifts[key];
        return (
          <div key={key} className="lift-editor">
            <div className="lift-editor-head">
              <b>{lift.name}</b>
              <span className="badge">TM {baseTrainingMax(lift)}</span>
            </div>
            <div className="field-row">
              <NumberField label="1RM" value={lift.oneRepMax} onCommit={(v) => patchLift(key, { oneRepMax: v })} />
              <NumberField
                label="TM %"
                value={Math.round(lift.tmPercent * 100)}
                onCommit={(v) => patchLift(key, { tmPercent: v / 100 })}
              />
              <NumberField label="+/cycle" value={lift.increment} step={5} onCommit={(v) => patchLift(key, { increment: v })} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ScheduleEditor({ settings }: { settings: AppSettings }) {
  const setStart = (i: number, value: string) => {
    const next = [...settings.cycleStarts];
    next[i] = value;
    void patchSettings({ cycleStarts: next });
  };
  return (
    <section className="card">
      <div className="block-head">
        <h2>Schedule</h2>
      </div>
      <label className="toggle-row">
        <span>
          Rolling 3-day mode
          <span className="muted field-hint">Workouts proceed in order on Mon/Wed/Fri — nothing is skipped</span>
        </span>
        <input
          type="checkbox"
          checked={settings.rollingMode}
          onChange={(e) => void patchSettings({ rollingMode: e.target.checked })}
        />
      </label>
      {settings.cycleStarts.map((d, i) => (
        <label key={i} className="field field-wide">
          <span className="field-label">Cycle {i + 1} start</span>
          <input type="date" value={d} onChange={(e) => setStart(i, e.target.value)} />
          {weekdayOf(d) !== 1 && <span className="warn-inline">should be a Monday</span>}
        </label>
      ))}
      <div className="field-row">
        <NumberField
          label="Main rest (s)"
          value={settings.rest.main}
          step={15}
          onCommit={(v) => void patchSettings({ rest: { ...settings.rest, main: v } })}
        />
        <NumberField
          label="BBB rest (s)"
          value={settings.rest.bbb}
          step={15}
          onCommit={(v) => void patchSettings({ rest: { ...settings.rest, bbb: v } })}
        />
        <NumberField
          label="Assist rest (s)"
          value={settings.rest.assistance}
          step={15}
          onCommit={(v) => void patchSettings({ rest: { ...settings.rest, assistance: v } })}
        />
      </div>
    </section>
  );
}

function PlateEditor({ settings }: { settings: AppSettings }) {
  const [newSize, setNewSize] = useState('');
  const setPairs = (i: number, pairs: number) => {
    const next = settings.plates.map((p, idx) => (idx === i ? { ...p, pairs: Math.max(0, pairs) } : p));
    void patchSettings({ plates: next });
  };
  const remove = (i: number) => void patchSettings({ plates: settings.plates.filter((_, idx) => idx !== i) });
  const add = () => {
    const size = parseFloat(newSize);
    if (!Number.isFinite(size) || size <= 0) return;
    const next = [...settings.plates, { size, pairs: 1 }].sort((a, b) => b.size - a.size);
    void patchSettings({ plates: next });
    setNewSize('');
  };
  return (
    <section className="card">
      <div className="block-head">
        <h2>Plates</h2>
        <span className="muted">counted in pairs</span>
      </div>
      <NumberField label="Bar weight" value={settings.barWeight} step={5} onCommit={(v) => void patchSettings({ barWeight: v })} />
      {settings.plates.map((p, i) => (
        <div key={`${p.size}-${i}`} className="plate-row">
          <span className="num plate-size">{p.size} lb</span>
          <div className="pair-stepper">
            <button className="step-btn num" onClick={() => setPairs(i, p.pairs - 1)}>
              −
            </button>
            <span className="num pair-count">{p.pairs}</span>
            <button className="step-btn num" onClick={() => setPairs(i, p.pairs + 1)}>
              +
            </button>
          </div>
          <button className="del-btn" onClick={() => remove(i)} aria-label={`Remove ${p.size} lb plates`}>
            ✕
          </button>
        </div>
      ))}
      <div className="bw-form">
        <input
          type="number"
          inputMode="decimal"
          placeholder="plate size (lb)"
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
        />
        <button className="btn-secondary" onClick={add}>
          Add
        </button>
      </div>
    </section>
  );
}

/** End-of-cycle review: shows next TMs, flags missed AMRAP minimums, lets you hold. */
function CycleReview({ settings, logs }: { settings: AppSettings; logs: WorkoutLog[] }) {
  const [after, setAfter] = useState(1);
  const byId = new Map(logs.map((l) => [l.id, l]));

  const toggleHold = (lift: LiftKey) => {
    const cur = settings.holds[lift] ?? [];
    const next = cur.includes(after) ? cur.filter((c) => c !== after) : [...cur, after];
    void patchSettings({ holds: { ...settings.holds, [lift]: next } });
  };

  return (
    <section className="card">
      <div className="block-head">
        <h2>End-of-Cycle Review</h2>
      </div>
      <div className="chip-row">
        {[1, 2].map((c) => (
          <button key={c} className={`chip ${after === c ? 'chip-active' : ''}`} onClick={() => setAfter(c)}>
            After Cycle {c}
          </button>
        ))}
      </div>
      {LIFT_KEYS.map((key) => {
        const lift = settings.lifts[key];
        const holds = settings.holds[key] ?? [];
        const held = holds.includes(after);
        const current = trainingMaxForCycle(lift, after, holds);
        const next = trainingMaxForCycle(lift, after + 1, holds);

        const day = ([1, 2, 3, 4] as const).find((d) => liftForDay(d) === key) ?? 1;
        const results = [1, 2, 3].map((week) => {
          const pos: ProgramPosition = { cycle: after, week, day };
          const top = byId.get(positionId(pos))?.sets['m3'];
          if (!top?.completed) return { week, reps: null as number | null, min: minRepsForWeek(week) };
          return { week, reps: top.reps ?? minRepsForWeek(week), min: minRepsForWeek(week) };
        });
        const missed = results.some((r) => r.reps !== null && r.reps < r.min);

        return (
          <div key={key} className="review-row">
            <div className="review-head">
              <b>{lift.short}</b>
              <span className="num review-tm">
                {current} → {next}
                {held && <span className="badge"> held</span>}
              </span>
            </div>
            <div className="review-detail">
              <span className="muted">
                {results.map((r) => (r.reps === null ? '·' : `W${r.week} ${r.reps}${r.reps >= r.min ? '✓' : '✗'}`)).join('  ')}
              </span>
              {missed && !held && <span className="warn-inline">missed minimum — consider holding</span>}
            </div>
            <label className="toggle-row toggle-compact">
              <span>Hold TM next cycle</span>
              <input type="checkbox" checked={held} onChange={() => toggleHold(key)} />
            </label>
          </div>
        );
      })}
    </section>
  );
}

function ProgramEndSummary({ settings, logs }: { settings: AppSettings; logs: WorkoutLog[] }) {
  const byId = new Map(logs.map((l) => [l.id, l]));
  const done = logs.filter((l) => l.completedAt).length;
  if (done < 48) return null;
  return (
    <section className="card">
      <div className="block-head">
        <h2>Program Complete</h2>
      </div>
      {LIFT_KEYS.map((key) => {
        const lift = settings.lifts[key];
        const day = ([1, 2, 3, 4] as const).find((d) => liftForDay(d) === key) ?? 1;
        let best = lift.oneRepMax;
        for (const cycle of [1, 2, 3])
          for (const week of [1, 2, 3]) {
            const pos = { cycle, week, day };
            const top = byId.get(positionId(pos))?.sets['m3'];
            if (!top?.completed) continue;
            const plan = buildWorkoutPlan(pos, settings);
            const e = epley1RM(plan.topSetWeight ?? 0, top.reps ?? minRepsForWeek(week));
            if (e > best) best = e;
          }
        return (
          <div key={key} className="review-head">
            <b>{lift.short}</b>
            <span className="num">
              best e1RM {Math.round(best)} <span className="muted">(started {lift.oneRepMax})</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const onImportFile = async (file: File) => {
    if (!window.confirm('Importing replaces ALL current data. Continue?')) return;
    try {
      await importJSON(await file.text());
      setMsg('Import complete.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  return (
    <section className="card">
      <div className="block-head">
        <h2>Data</h2>
        <span className="muted">local only — back up regularly</span>
      </div>
      <div className="note-actions">
        <button className="btn-primary" onClick={() => void exportJSON()}>
          Export JSON
        </button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = '';
        }}
      />
      {msg && <p className="muted">{msg}</p>}
      <button
        className="btn-danger"
        onClick={() => {
          if (!window.confirm('Delete ALL data and reset to seed values? Export a backup first.')) return;
          void db.delete().then(() => window.location.reload());
        }}
      >
        Reset everything
      </button>
    </section>
  );
}

export default function SettingsScreen({ settings }: { settings: AppSettings }) {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  if (!logs) return null;
  return (
    <div>
      <h1 className="screen-title num">Settings</h1>
      <LiftEditor settings={settings} />
      <ScheduleEditor settings={settings} />
      <PlateEditor settings={settings} />
      <CycleReview settings={settings} logs={logs} />
      <ProgramEndSummary settings={settings} logs={logs} />
      <DataSection />
    </div>
  );
}
