// Plate inventory model. Counts are INDIVIDUAL plates owned (what's on the
// shelf), not pairs — a bar side can use floor(count / 2) of each size.

export interface Plate {
  /** Plate weight in lb */
  size: number;
  /** Total number of plates of this size owned */
  count: number;
}

/**
 * Normalize a stored/imported plate list to the current shape. Older versions
 * stored `{ size, pairs }`; those convert as count = pairs × 2. Malformed
 * entries are dropped.
 */
export function normalizePlates(raw: unknown): Plate[] {
  if (!Array.isArray(raw)) return [];
  const out: Plate[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as { size?: unknown; count?: unknown; pairs?: unknown };
    const size = typeof rec.size === 'number' ? rec.size : NaN;
    if (!Number.isFinite(size) || size <= 0) continue;
    const count =
      typeof rec.count === 'number' ? rec.count : typeof rec.pairs === 'number' ? rec.pairs * 2 : 0;
    if (!Number.isFinite(count)) continue;
    out.push({ size, count: Math.max(0, Math.round(count)) });
  }
  return out.sort((a, b) => b.size - a.size);
}

/** Plates of a size usable on ONE side of the bar. */
export function perSideCount(count: number): number {
  return Math.floor(count / 2);
}
