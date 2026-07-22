import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setBlockWeight, updateSetLog } from '../db';
import { buildWorkoutPlan, requiredSetIds, type PlannedSet, type WorkoutBlock } from '../lib/plan';
import { epley1RM, WEEK_NAMES } from '../lib/program';
import { formatDate, positionId, type ProgramPosition } from '../lib/schedule';
import type { AppSettings } from '../lib/seed';
import { primeAudio } from '../lib/cue';
import PlateSheet from './PlateSheet';
import RestTimer from './RestTimer';

interface Props {
  pos: ProgramPosition;
  /** Scheduled/display date for this workout (YYYY-MM-DD) */
  date: string;
  settings: AppSettings;
  badge?: string;
  onBack?: () => void;
}

interface TimerState {
  total: number;
  startedAt: number;
}

/** Editable per-movement load for accessory work: ±5 steppers plus direct entry. */
function LoadControl({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value !== undefined ? String(value) : '');
  const commit = (raw: string) => {
    const v = parseFloat(raw);
    onChange(Number.isFinite(v) && v > 0 ? v : undefined);
  };
  const bump = (delta: number) => {
    const next = Math.max(0, (value ?? 0) + delta);
    onChange(next > 0 ? next : undefined);
    setText(null);
  };
  return (
    <div className="load-row">
      <span className="load-label muted">Load</span>
      <button className="wstep num" onClick={() => bump(-5)} aria-label="Decrease load 5 lb">
        −
      </button>
      <input
        className="wval num"
        type="number"
        inputMode="decimal"
        placeholder="—"
        value={shown}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(null)}
        aria-label="Logged load in pounds"
      />
      <span className="load-unit muted">lb</span>
      <button className="wstep num" onClick={() => bump(5)} aria-label="Increase load 5 lb">
        +
      </button>
    </div>
  );
}

export default function WorkoutView({ pos, date, settings, badge, onBack }: Props) {
  const logId = positionId(pos);
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId]);
  const plan = useMemo(() => buildWorkoutPlan(pos, settings), [pos, settings]);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [plateWeight, setPlateWeight] = useState<number | null>(null);

  const sets = log?.sets ?? {};
  const required = requiredSetIds(plan);

  const toggleSet = (block: WorkoutBlock, set: PlannedSet) => {
    primeAudio();
    const willComplete = !sets[set.id]?.completed;
    void updateSetLog(pos, logId, date, required, (s) => {
      const cur = s[set.id] ?? { completed: false };
      cur.completed = !cur.completed;
      if (cur.completed && set.amrap && cur.reps === undefined) cur.reps = set.minReps;
      s[set.id] = cur;
    });
    if (willComplete && block.rest) {
      setTimer({ total: settings.rest[block.rest], startedAt: Date.now() });
    }
  };

  const setReps = (set: PlannedSet, reps: number) => {
    void updateSetLog(pos, logId, date, required, (s) => {
      const cur = s[set.id] ?? { completed: false };
      cur.reps = Math.max(0, reps);
      s[set.id] = cur;
    });
  };

  const weekName = WEEK_NAMES[pos.week];
  const isDeload = pos.week === 4;

  return (
    <div className="workout">
      <header className="wk-header">
        {onBack && (
          <button className="back-btn" onClick={onBack} aria-label="Back">
            ‹
          </button>
        )}
        <div className="wk-badges">
          {badge && <span className="badge badge-accent">{badge}</span>}
          <span className="badge">{formatDate(date)}</span>
          <span className="badge">
            C{pos.cycle} · W{pos.week} · {weekName}
          </span>
        </div>
        <h1 className="wk-lift num">{plan.lift.name}</h1>
        <div className="wk-topset">
          {plan.topSetWeight !== undefined ? (
            <>
              <span className="wk-topnum num">{plan.topSetWeight}</span>
              <span className="wk-topreps num">× {plan.blocks.find((b) => b.kind === 'main')?.sets.at(-1)?.reps}</span>
            </>
          ) : (
            <span className="wk-topnum num deload-label">Deload</span>
          )}
          <span className="badge tm-badge">TM {plan.tm}</span>
        </div>
      </header>

      {plan.liftKey === 'squat' && (
        <div className="note note-warn">
          <b>Groin caution:</b> TM is set at 85% on purpose. Do the full hip prep, stop any set that
          pinches, and don't chase AMRAP reps at the expense of depth or position.
        </div>
      )}
      {plan.liftKey === 'press' && pos.cycle === 1 && pos.week === 1 && (
        <div className="note">
          <b>OHP max is estimated</b> (never barbell pressed). If today's 5+ set gives 8+ reps or
          fewer than 5, you'll get a prompt to recalibrate the training max.
        </div>
      )}

      {plan.blocks.map((block) => (
        <section key={block.kind} className={`card block-${block.kind}`}>
          <div className="block-head">
            <h2>{block.title}</h2>
            {block.subtitle && <span className="muted">{block.subtitle}</span>}
          </div>
          {block.logWeight && (
            <LoadControl
              value={log?.weights?.[block.kind]}
              onChange={(w) => void setBlockWeight(pos, logId, block.kind, w)}
            />
          )}
          {block.sets.map((set, i) => {
            const state = sets[set.id];
            const done = state?.completed ?? false;
            const isWeighted = set.weight !== undefined;
            return (
              <div key={set.id}>
                <div
                  className={`setrow ${done ? 'done' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSet(block, set)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleSet(block, set);
                  }}
                >
                  {isWeighted ? (
                    <>
                      <span className="set-pct muted">{set.pct !== undefined ? `${Math.round(set.pct * 100)}%` : ''}</span>
                      <button
                        className="set-weight num"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlateWeight(set.weight ?? null);
                        }}
                        aria-label={`Plate calculator for ${set.weight} lb`}
                      >
                        {set.isBar ? 'Bar' : set.weight}
                        <span className="set-x"> × {set.reps}</span>
                      </button>
                    </>
                  ) : (
                    <span className="set-label">
                      {block.kind === 'hipprep' ? set.reps : `Set ${i + 1} · ${set.reps}`}
                    </span>
                  )}
                  <span className="check" aria-hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M4 12.5 9.5 18 20 6.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                {set.amrap && set.weight !== undefined && (
                  <div className="amrap-row">
                    <button className="step-btn num" onClick={() => setReps(set, (state?.reps ?? set.minReps ?? 0) - 1)}>
                      −
                    </button>
                    <div className="amrap-reps">
                      <span className="num amrap-count">{state?.reps ?? set.minReps}</span>
                      <span className="muted">reps</span>
                    </div>
                    <button className="step-btn num" onClick={() => setReps(set, (state?.reps ?? set.minReps ?? 0) + 1)}>
                      +
                    </button>
                    <div className="e1rm-chip">
                      <span className="muted">e1RM</span>
                      <span className="num">{Math.round(epley1RM(set.weight, state?.reps ?? set.minReps ?? 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      {isDeload && (
        <div className="note center muted">Deload — easy work, no AMRAP. Leave feeling fresh.</div>
      )}

      {plateWeight !== null && (
        <PlateSheet weight={plateWeight} settings={settings} onClose={() => setPlateWeight(null)} />
      )}
      {timer && (
        <RestTimer
          key={timer.startedAt}
          total={timer.total}
          startedAt={timer.startedAt}
          onClose={() => setTimer(null)}
        />
      )}
    </div>
  );
}
