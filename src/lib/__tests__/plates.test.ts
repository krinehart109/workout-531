import { describe, expect, it } from 'vitest';
import { normalizePlates, perSideCount } from '../plates';

describe('perSideCount', () => {
  it('halves the owned count, dropping the odd plate out', () => {
    expect(perSideCount(4)).toBe(2);
    expect(perSideCount(3)).toBe(1);
    expect(perSideCount(1)).toBe(0);
    expect(perSideCount(0)).toBe(0);
  });
});

describe('normalizePlates', () => {
  it('passes current-shape entries through, sorted big to small', () => {
    expect(
      normalizePlates([
        { size: 10, count: 4 },
        { size: 45, count: 4 },
      ]),
    ).toEqual([
      { size: 45, count: 4 },
      { size: 10, count: 4 },
    ]);
  });

  it('migrates legacy pairs to individual counts (pairs × 2)', () => {
    expect(
      normalizePlates([
        { size: 45, pairs: 2 },
        { size: 25, pairs: 1 },
        { size: 2.5, pairs: 1 },
      ]),
    ).toEqual([
      { size: 45, count: 4 },
      { size: 25, count: 2 },
      { size: 2.5, count: 2 },
    ]);
  });

  it('drops malformed entries and clamps negatives', () => {
    expect(
      normalizePlates([
        { size: 45, count: -3 },
        { size: 0, count: 4 },
        { size: 'x', count: 2 },
        null,
        'junk',
        { size: 10 },
      ]),
    ).toEqual([
      { size: 45, count: 0 },
      { size: 10, count: 0 },
    ]);
  });

  it('returns [] for non-arrays', () => {
    expect(normalizePlates(undefined)).toEqual([]);
    expect(normalizePlates({ size: 45, count: 2 })).toEqual([]);
  });
});
