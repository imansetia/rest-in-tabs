import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { layoutRows, plotJitter, ROWS } from './layout.js';

const counts = (rows: ReturnType<typeof layoutRows>) => rows.map((r) => r.count);

describe('layoutRows — capacities', () => {
  it('front row holds floor((width − 40) / 202), and row i holds max(front, floor(front / s) + i)', () => {
    // 1280 px: front = floor(1240 / 202) = 6; then 8, 11, 15, 18, rest.
    const rows = layoutRows(6 + 8 + 11 + 15 + 18 + 30, 1280, 900);
    expect(counts(rows)).toEqual([6, 8, 11, 15, 18, 30]);
  });

  it('the front row holds at least 2 on a narrow scene', () => {
    expect(layoutRows(2, 360, 900)).toHaveLength(1); // floor(320 / 202) = 1 → 2
    expect(counts(layoutRows(5, 360, 900))).toEqual([2, 3]); // row 1: max(2, floor(2 / 0.78) + 1) = 3
  });

  it('returns no rows when there are no graves', () => {
    expect(layoutRows(0, 1280, 900)).toEqual([]);
  });
});

describe('layoutRows — the 80% stop', () => {
  it('900 px tall: all six rows fit', () => {
    const rows = layoutRows(500, 1280, 900);
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('540 px tall: row 2 would pass 80% (352.1 + 80.5 > 432), so row 1 holds the rest', () => {
    const rows = layoutRows(500, 1280, 540);
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
    expect(counts(rows)).toEqual([6, 494]);
  });

  it('places rows at 58 px and then 236 × s × 0.7 higher each', () => {
    const rows = layoutRows(500, 1280, 900);
    expect(rows[0].bottom).toBe(58);
    expect(rows[1].bottom).toBeCloseTo(58 + 236 * 0.7, 6);
    expect(rows[2].bottom).toBeCloseTo(58 + 236 * 0.7 + 236 * 0.78 * 0.7, 6);
  });
});

describe('layoutRows — a short last row', () => {
  it('7 graves at 1250 px: front row 5, back row 2 (the front row never grows wider than the scene)', () => {
    // front = floor(1210 / 202) = 5; joining would make 7 > 5.
    expect(counts(layoutRows(7, 1250, 900))).toEqual([5, 2]);
  });

  it('stays its own row when the row in front is full', () => {
    expect(counts(layoutRows(6 + 2, 1280, 900))).toEqual([6, 2]);
    expect(counts(layoutRows(6 + 8 + 1, 1280, 900))).toEqual([6, 8, 1]);
  });

  it('a last row with 3 or more stays', () => {
    expect(counts(layoutRows(6 + 3, 1280, 900))).toEqual([6, 3]);
  });

  it('a single row is never folded away', () => {
    expect(counts(layoutRows(1, 1280, 900))).toEqual([1]);
  });
});

describe('ROWS', () => {
  it('uses the steering row scales and fog veils', () => {
    expect(ROWS.map((r) => r.scale)).toEqual([1, 0.78, 0.62, 0.5, 0.41, 0.34]);
    expect(ROWS.map((r) => r.veil)).toEqual([0, 0.18, 0.35, 0.48, 0.56, 0.6]);
  });
});

describe('layoutRows — invariants', () => {
  it('places every grave once, front row first, using the steering scales and veils', () => {
    let multiRow = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 360, max: 2560 }),
        fc.integer({ min: 540, max: 900 }),
        (n, width, height) => {
          const rows = layoutRows(n, width, height);
          expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(n);
          rows.forEach((row, i) => {
            expect(row.index).toBe(i);
            expect(row.count).toBeGreaterThan(0);
            expect({ scale: row.scale, veil: row.veil }).toEqual(ROWS[i]);
            if (i > 0) expect(row.bottom).toBeGreaterThan(rows[i - 1].bottom);
          });
          if (rows.length > 0) expect(rows[0].veil).toBe(0); // the front row is always clear
          // At 540 px or taller at least two rows fit, so the front row has a finite capacity
          // and never holds more than fits across the scene.
          const front = Math.max(2, Math.floor((width - 40) / 202));
          if (rows.length > 0) expect(rows[0].count).toBeLessThanOrEqual(front);
          // Every row but the last is full; only the last row may be short.
          rows.slice(0, -1).forEach((row) => {
            expect(row.count).toBe(Math.max(front, Math.floor(front / row.scale) + row.index));
          });
          if (rows.length > 1) multiRow++;
        },
      ),
      { numRuns: 300 },
    );
    expect(multiRow).toBeGreaterThan(0);
  });
});

describe('plotJitter', () => {
  it('matches the mockup hash for a known id', () => {
    // "1": h = (7 × 31 + 49) mod 9973 = 266 → tilt (266 mod 7) − 3 = −3, offset (266 mod 5) × 3 = 3, 266 mod 3 = 2.
    expect(plotJitter('1')).toEqual({ tiltDeg: -3, offsetPx: 3, hasCrow: false, hasCross: false });
  });

  it('is stable, in range, and never gives both a crow and a cross', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const j = plotJitter(id);
        expect(plotJitter(id)).toEqual(j);
        expect([-3, -2, -1, 1, 2, 3]).toContain(j.tiltDeg);
        expect([0, 3, 6, 9, 12]).toContain(j.offsetPx);
        expect(j.hasCrow && j.hasCross).toBe(false);
      }),
      { numRuns: 300 },
    );
  });
});
