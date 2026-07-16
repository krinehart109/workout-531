// Per-side plate loading math.

export interface PlatePair {
  /** Plate weight in lb */
  size: number;
  /** Number of PAIRS owned */
  pairs: number;
}

export interface PlateResult {
  /** Plates on ONE side, heaviest first */
  perSide: number[];
  /** Total bar weight actually achievable with those plates */
  achieved: number;
  /** True if achieved === target */
  exact: boolean;
  /** True if the target is the empty bar (or below it) */
  barOnly: boolean;
}

/**
 * Greedy per-side loading from a plate inventory (counted in pairs).
 * If the target isn't exactly loadable, returns the closest weight below it.
 */
export function platesFor(target: number, barWeight: number, inventory: PlatePair[]): PlateResult {
  if (target <= barWeight) {
    return { perSide: [], achieved: barWeight, exact: target === barWeight, barOnly: true };
  }
  const sorted = [...inventory].filter((p) => p.pairs > 0 && p.size > 0).sort((a, b) => b.size - a.size);
  let remaining = (target - barWeight) / 2;
  const perSide: number[] = [];
  for (const { size, pairs } of sorted) {
    let available = pairs;
    while (available > 0 && size <= remaining + 1e-9) {
      perSide.push(size);
      remaining -= size;
      available--;
    }
  }
  const achieved = target - 2 * remaining;
  return {
    perSide,
    achieved: Math.round(achieved * 100) / 100,
    exact: Math.abs(remaining) < 1e-9,
    barOnly: false,
  };
}
