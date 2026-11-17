import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { layoutRows, graveRows, plotJitter, rowPitch, crowdedStep, ROWS } from './layout.js';

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

  it('540 px tall: p = 0.556, so a third row fits; row 3 would pass 80% (372.9 + 64.9 > 432)', () => {
    const rows = layoutRows(500, 1280, 540);
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(counts(rows)).toEqual([6, 8, 486]);
  });

  it('a 460 to 480 px scene fits 3 rows (it fitted 2 with the fixed pitch of 0.7)', () => {
    for (const h of [460, 470, 478, 480]) expect(layoutRows(30, 1280, h).map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('places rows at 58 px and then 236 × s × p higher each (p = 0.7 at 900 px)', () => {
    const rows = layoutRows(500, 1280, 900);
    expect(rows[0].bottom).toBe(58);
    expect(rows[1].bottom).toBeCloseTo(58 + 236 * 0.7, 6);
    expect(rows[2].bottom).toBeCloseTo(58 + 236 * 0.7 + 236 * 0.78 * 0.7, 6);
  });

  it('uses the scene\'s pitch for every row (460 px: p = 0.7 × 460 / 680)', () => {
    const p = (0.7 * 460) / 680;
    const rows = layoutRows(30, 1280, 460);
    expect(rows[1].bottom).toBeCloseTo(58 + 236 * p, 6);
    expect(rows[2].bottom).toBeCloseTo(58 + 236 * p + 236 * 0.78 * p, 6);
  });
});

describe('rowPitch', () => {
  it('0.7 at 680 px and taller, 0.7 × h / 680 below, never under 0.45', () => {
    expect(rowPitch(680)).toBe(0.7);
    expect(rowPitch(900)).toBe(0.7);
    expect(rowPitch(340)).toBeCloseTo(0.45, 10); // 0.35 → floor 0.45
    expect(rowPitch(0)).toBe(0.45);
    expect(rowPitch(Number.NaN)).toBe(0.45);
  });

  it('follows p = max(0.45, 0.7 × min(1, h / 680)) for any height', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), (h) => {
        expect(rowPitch(h)).toBeCloseTo(Math.max(0.45, 0.7 * Math.min(1, h / 680)), 12);
        if (h >= 680) expect(rowPitch(h)).toBe(0.7);
        expect(rowPitch(h)).toBeGreaterThanOrEqual(0.45);
        expect(rowPitch(h)).toBeLessThanOrEqual(0.7);
      }),
      { numRuns: 300 },
    );
  });
});

describe('crowded last row', () => {
  /** Plot centres of the last row, as the page places them: centred, at its step or at normal spacing. */
  function lastRowCentres(n: number, width: number, height: number): { centres: number[]; scale: number; step?: number } {
    const rows = layoutRows(n, width, height);
    const last = rows[rows.length - 1];
    const step = last.step ?? (172 + 30) * last.scale;
    const span = (last.count - 1) * step;
    return { centres: Array.from({ length: last.count }, (_, i) => width / 2 - span / 2 + i * step), scale: last.scale, step: last.step };
  }

  it('30 graves at 1280 x 460: the 16-stone back row stands closer, inside the scene', () => {
    const rows = layoutRows(30, 1280, 460);
    expect(counts(rows)).toEqual([6, 8, 16]);
    const last = rows[2];
    expect(last.step).toBeDefined();
    expect(last.step!).toBeLessThan(202 * last.scale); // overlapping or closer than normal
    const { centres } = lastRowCentres(30, 1280, 460);
    expect(Math.min(...centres) - (172 * last.scale) / 2).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(Math.max(...centres) + (172 * last.scale) / 2).toBeLessThanOrEqual(1260 + 1e-9);
  });

  it('a last row that fits keeps its normal spacing (no step), and no other row gets one', () => {
    const rows = layoutRows(20, 1280, 900);
    expect(rows.every((r) => r.step === undefined)).toBe(true);
    expect(crowdedStep(1, 1, 300)).toBeUndefined();
  });

  it('for any grave count and scene size, every stone centre in the last row lies inside the scene', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 360, max: 3840 }), fc.integer({ min: 460, max: 900 }), (n, width, height) => {
        const rows = layoutRows(n, width, height);
        rows.slice(0, -1).forEach((r) => expect(r.step).toBeUndefined());
        // The centres are evenly spaced, so the outermost two decide (one expect each, not one per stone).
        const { centres } = lastRowCentres(n, width, height);
        expect(centres[0]).toBeGreaterThan(0);
        expect(centres[centres.length - 1]).toBeLessThan(width);
      }),
      { numRuns: 400 },
    );
  });
});

describe('layoutRows — a short last row', () => {
  it('7 graves at 1250 px: front row 5, back row 2 (the front row never grows wider than the scene)', () => {
    // front = floor(1210 / 202) = 5; joining would make 7 > 5.
    expect(counts(layoutRows(7, 1250, 900))).toEqual([5, 2]);
  });

  it('stays its own row when the front row is full', () => {
    expect(counts(layoutRows(6 + 2, 1280, 900))).toEqual([6, 2]);
  });

  it('joins a back row even past its capacity, so no lone stone floats on the horizon', () => {
    // 1440 px: front = floor(1400 / 202) = 6; rows hold 6, 8, 11, then 1 left over.
    expect(counts(layoutRows(26, 1440, 900))).toEqual([6, 8, 12]);
    expect(counts(layoutRows(6 + 8 + 1, 1280, 900))).toEqual([6, 9]);
  });

  it('a last row with 3 or more stays', () => {
    expect(counts(layoutRows(6 + 3, 1280, 900))).toEqual([6, 3]);
  });

  it('a single row is never folded away', () => {
    expect(counts(layoutRows(1, 1280, 900))).toEqual([1]);
  });
});

describe('graveRows (page order)', () => {
  it('front row first with the newest graves, so Tab reaches the newest first', () => {
    const ids = Array.from({ length: 16 }, (_, i) => `n${i}`); // newest first
    const placed = graveRows(ids, layoutRows(ids.length, 1280, 900));
    expect(placed.map((r) => r.row.index)).toEqual([0, 1]);
    expect(placed[0].graves).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
    expect(placed[1].graves[0]).toBe('n6');
  });

  it('the page order is exactly newest first, every grave once', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 360, max: 2560 }), fc.integer({ min: 540, max: 900 }), (n, width, height) => {
        const ids = Array.from({ length: n }, (_, i) => i);
        const rows = layoutRows(n, width, height);
        const placed = graveRows(ids, rows);
        expect(placed.flatMap((r) => r.graves)).toEqual(ids);
        placed.forEach((r, i) => {
          expect(r.row.index).toBe(i); // front row first
          expect(r.graves).toHaveLength(r.row.count);
        });
      }),
      { numRuns: 200 },
    );
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
          const capacity = (row: { scale: number; index: number }) => Math.max(front, Math.floor(front / row.scale) + row.index);
          // Every row but the last is exactly full.
          rows.slice(0, -1).forEach((row) => expect(row.count).toBe(capacity(row)));
          if (rows.length > 1) {
            multiRow++;
            // A short last row (fewer than 3) only stands alone right behind a full front row.
            const last = rows[rows.length - 1];
            if (last.count < 3) expect(rows.length).toBe(2);
            // Behind a back row, the last row always has 3 or more (a short one joined it).
            if (rows.length > 2) expect(last.count).toBeGreaterThanOrEqual(3);
          }
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
