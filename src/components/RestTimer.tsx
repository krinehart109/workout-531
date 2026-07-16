import { useEffect, useRef, useState } from 'react';
import { cueRestDone } from '../lib/cue';

interface Props {
  /** Total duration in seconds */
  total: number;
  /** Epoch ms when the timer started (also used as a reset key) */
  startedAt: number;
  onClose: () => void;
}

export default function RestTimer({ total, startedAt, onClose }: Props) {
  const [now, setNow] = useState(Date.now());
  const [bonus, setBonus] = useState(0);
  const firedRef = useRef(false);

  const endsAt = startedAt + (total + bonus) * 1000;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = remaining <= 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      cueRestDone();
    }
    if (!done) firedRef.current = false;
  }, [done]);

  // Auto-dismiss a while after finishing so the bar doesn't linger
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  const frac = Math.min(1, Math.max(0, (endsAt - now) / ((total + bonus) * 1000)));

  return (
    <div className={`timerbar ${done ? 'timer-done' : ''}`} onClick={done ? onClose : undefined}>
      <div className="timer-fill" style={{ transform: `scaleX(${done ? 1 : frac})` }} />
      <div className="timer-content">
        <span className="timer-label">{done ? 'GO' : 'REST'}</span>
        <span className="timer-time num">{done ? 'Next set' : `${mm}:${ss}`}</span>
        {!done && (
          <span className="timer-actions">
            <button
              className="timer-btn"
              onClick={(e) => {
                e.stopPropagation();
                setBonus((b) => b + 30);
              }}
            >
              +30s
            </button>
            <button
              className="timer-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              Skip
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
