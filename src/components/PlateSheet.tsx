import type { LoadoutStep } from '../lib/loadout';

interface Props {
  step: LoadoutStep;
  barWeight: number;
  onClose: () => void;
}

function plateHeight(size: number): number {
  if (size >= 45) return 72;
  if (size >= 35) return 62;
  if (size >= 25) return 54;
  if (size >= 10) return 44;
  if (size >= 5) return 36;
  return 28;
}

export default function PlateSheet({ step, barWeight, onClose }: Props) {
  const barOnly = step.stack.length === 0;
  const changed = step.remove.length > 0 || step.add.length > 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-weight num">{step.achieved}</div>
        <div className="muted center">{barWeight} lb bar</div>

        {barOnly ? (
          <div className="bar-only">Empty bar</div>
        ) : (
          <>
            <div className="plates-row">
              <div className="bar-stub" />
              {step.stack.map((p, i) => (
                <div
                  key={i}
                  className={`plate num ${i >= step.keep.length ? 'plate-new' : ''}`}
                  style={{ height: plateHeight(p) }}
                >
                  {p}
                </div>
              ))}
            </div>
            <div className="muted center">per side · inner → outer</div>
          </>
        )}

        <div className="delta-box">
          <div className="delta-from muted">
            {step.prevAchieved === undefined ? 'Loading from empty bar' : `Bar is loaded at ${step.prevAchieved}`}
          </div>
          {step.prevAchieved !== undefined && !changed && <div className="delta-same">Same load — lift.</div>}
          {step.remove.length > 0 && (
            <div className="delta-row">
              <span className="delta-tag delta-tag-remove">Strip</span>
              {step.remove.map((p, i) => (
                <span key={i} className="dchip dchip-remove num">
                  {p}
                </span>
              ))}
            </div>
          )}
          {step.add.length > 0 && (
            <div className="delta-row">
              <span className="delta-tag delta-tag-add">Add</span>
              {step.add.map((p, i) => (
                <span key={i} className="dchip dchip-add num">
                  {p}
                </span>
              ))}
            </div>
          )}
          <div className="muted center delta-note">per side</div>
        </div>

        {!step.exact && (
          <div className="warn-note">
            {step.target} isn’t loadable from your plates — closest is <b className="num">{step.achieved} lb</b>
          </div>
        )}
        <button className="btn-secondary sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
