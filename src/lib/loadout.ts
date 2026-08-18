// Session plate-loading math. Treats the bar as a physical stack (inner →
// outer, per side) and chains sets so each one reuses as much of the previous
// load as possible: keep an inner prefix, strip the rest, add the difference.
// All weights are constrained to what the plate inventory can actually build.

import type { PlatePair } from './plates';

export interface LoadoutStep {
  setId: string;
  /** Desired total bar weight */
  target: number;
  /** Loadable total bar weight (≤ target) */
  achieved: number;
  exact: boolean;
  /** Plates on one side after loading, inner → outer */
  stack: number[];
  /** Prefix kept from the previous set's stack */
  keep: number[];
  /** Plates pulled off the previous stack, outermost first */
  remove: number[];
  /** Plates added, in the order they go on */
  add: number[];
  /** Previous set's achieved bar weight (undefined for the first set) */
  prevAchieved?: number;
}

const EPS = 1e-9;

function prepInventory(inventory: PlatePair[]): { sizes: number[]; counts: Map<number, number> } {
  const usable = inventory.filter((p) => p.pairs > 0 && p.size > 0);
  const sizes = [...new Set(usable.map((p) => p.size))].sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const p of usable) counts.set(p.size, (counts.get(p.size) ?? 0) + p.pairs);
  return { sizes, counts };
}

/** Exact per-side combination summing to target, largest plates first; null if impossible. */
function exactCombo(target: number, sizes: number[], counts: Map<number, number>, idx = 0): number[] | null {
  if (Math.abs(target) < EPS) return [];
  if (target < -EPS || idx >= sizes.length) return null;
  const size = sizes[idx];
  if (size === undefined) return null;
  const avail = counts.get(size) ?? 0;
  const maxUse = Math.min(avail, Math.floor((target + EPS) / size));
  for (let use = maxUse; use >= 0; use--) {
    const rest = exactCombo(target - use * size, sizes, counts, idx + 1);
    if (rest) return [...(Array(use).fill(size) as number[]), ...rest];
  }
  return null;
}

/** Largest per-side sum ≤ target buildable from the inventory. */
function maxAchievable(target: number, sizes: number[], counts: Map<number, number>): number {
  let best = 0;
  const total = sizes.reduce((a, s) => a + s * (counts.get(s) ?? 0), 0);
  const rec = (idx: number, sum: number, remaining: number): void => {
    if (sum > best) best = sum;
    if (best >= target - EPS || idx >= sizes.length || sum + remaining <= best + EPS) return;
    const size = sizes[idx];
    if (size === undefined) return;
    const avail = counts.get(size) ?? 0;
    const rest = remaining - avail * size;
    for (let use = Math.min(avail, Math.floor((target - sum + EPS) / size)); use >= 0; use--) {
      rec(idx + 1, sum + use * size, rest);
      if (best >= target - EPS) return;
    }
  };
  rec(0, 0, total);
  return best;
}

/** Largest loadable total bar weight ≤ target given the inventory (min: the bar). */
export function loadableWeight(target: number, barWeight: number, inventory: PlatePair[]): number {
  if (target <= barWeight) return barWeight;
  const { sizes, counts } = prepInventory(inventory);
  return barWeight + 2 * maxAchievable((target - barWeight) / 2, sizes, counts);
}

/**
 * Plate plan for a sequence of barbell sets done on the same bar. Each step
 * keeps the longest inner prefix of the previous stack that still leads to an
 * exact load, then strips and adds the rest.
 */
export function chainLoadouts(
  sets: { id: string; weight: number }[],
  barWeight: number,
  inventory: PlatePair[],
): LoadoutStep[] {
  const { sizes, counts: baseCounts } = prepInventory(inventory);
  const steps: LoadoutStep[] = [];
  let prev: number[] = [];
  let prevAchieved: number | undefined;

  for (const set of sets) {
    const perSideTarget = Math.max(0, (set.weight - barWeight) / 2);
    const perSide = maxAchievable(perSideTarget, sizes, baseCounts);

    let keep: number[] = [];
    let add: number[] = [];
    for (let k = prev.length; k >= 0; k--) {
      const prefix = prev.slice(0, k);
      const sumPrefix = prefix.reduce((a, b) => a + b, 0);
      if (sumPrefix > perSide + EPS) continue;
      const remaining = new Map(baseCounts);
      for (const p of prefix) remaining.set(p, (remaining.get(p) ?? 0) - 1);
      const combo = exactCombo(perSide - sumPrefix, sizes, remaining);
      if (combo) {
        keep = prefix;
        add = combo;
        break;
      }
    }

    const stack = [...keep, ...add];
    const achieved = barWeight + 2 * perSide;
    steps.push({
      setId: set.id,
      target: set.weight,
      achieved,
      exact: Math.abs(perSide - perSideTarget) < EPS,
      stack,
      keep,
      remove: prev.slice(keep.length).reverse(),
      add,
      prevAchieved,
    });
    prev = stack;
    prevAchieved = achieved;
  }
  return steps;
}
