import { platesFor } from '../lib/plates';
import type { AppSettings } from '../lib/seed';

interface Props {
  weight: number;
  settings: AppSettings;
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

export default function PlateSheet({ weight, settings, onClose }: Props) {
  const result = platesFor(weight, settings.barWeight, settings.plates);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-weight num">{weight}</div>
        <div className="muted center">{settings.barWeight} lb bar</div>
        {result.barOnly ? (
          <div className="bar-only">Empty bar</div>
        ) : (
          <>
            <div className="plates-row">
              <div className="bar-stub" />
              {result.perSide.map((p, i) => (
                <div key={i} className="plate num" style={{ height: plateHeight(p) }}>
                  {p}
                </div>
              ))}
            </div>
            <div className="muted center">per side</div>
            {!result.exact && (
              <div className="warn-note">
                Not exactly loadable — closest is <b className="num">{result.achieved} lb</b>
              </div>
            )}
          </>
        )}
        <button className="btn-secondary sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
