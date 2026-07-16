export interface ChartPoint {
  x: number;
  y: number;
}

interface Props {
  points: ChartPoint[];
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  formatX?: (v: number) => string;
}

const W = 340;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 20;

export default function LineChart({
  points,
  color = 'var(--accent)',
  height = 170,
  formatY = (v) => String(Math.round(v)),
  formatX,
}: Props) {
  if (points.length === 0) {
    return <div className="chart-empty muted">No data yet</div>;
  }
  const H = height;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMinRaw = Math.min(...ys);
  const yMaxRaw = Math.max(...ys);
  const spread = Math.max(yMaxRaw - yMinRaw, 10);
  const yMin = yMinRaw - spread * 0.15;
  const yMax = yMaxRaw + spread * 0.15;

  const px = (x: number) =>
    xMax === xMin ? (PAD_L + W - PAD_R) / 2 : PAD_L + ((x - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R);
  const py = (y: number) => PAD_T + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  const gridYs = [yMinRaw, (yMinRaw + yMaxRaw) / 2, yMaxRaw];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {gridYs.map((gy, i) => (
        <g key={i}>
          <line x1={PAD_L} x2={W - PAD_R} y1={py(gy)} y2={py(gy)} className="chart-grid" />
          <text x={PAD_L - 6} y={py(gy) + 3.5} className="chart-label" textAnchor="end">
            {formatY(gy)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={3.5} fill={color} />
      ))}
      {formatX && (
        <>
          <text x={PAD_L} y={H - 5} className="chart-label" textAnchor="start">
            {formatX(xMin)}
          </text>
          {xMax !== xMin && (
            <text x={W - PAD_R} y={H - 5} className="chart-label" textAnchor="end">
              {formatX(xMax)}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
