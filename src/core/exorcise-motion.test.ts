import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { exorciseGeometry, boltPoints, batFlight, EXORCISE_MS, BOLT_STEPS } from './exorcise-motion.js';

const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });

describe('exorcise timeline', () => {
  it('silence 0.8 s, strike, then the stone sinks from 1060 ms to 2160 ms', () => {
    expect(EXORCISE_MS).toBe(2160);
  });
});

describe('exorciseGeometry', () => {
  it('matches the mockup for a front-row stone', () => {
    const g = exorciseGeometry({ left: 214, top: 504, width: 172, height: 196 }, 173);
    expect(g.bolt).toEqual({ x: 240, y: 173, w: 120, h: 351 });
    expect(g.bat.x).toBe(283);
    expect(g.bat.y).toBeCloseTo(504 + 58.8, 6);
    expect(g.bat.w).toBe(34);
  });

  it('the bolt starts at the top of the sky, never above the page, and ends in the stone', () => {
    fc.assert(
      fc.property(fc.double({ min: -500, max: 3000, noNaN: true }), fc.double({ min: 0, max: 2000, noNaN: true }), fc.double({ min: 20, max: 400, noNaN: true }), fc.double({ min: -300, max: 600, noNaN: true }),
        (left, top, width, sceneTop) => {
          const g = exorciseGeometry({ left, top, width, height: width * 1.14 }, sceneTop);
          expect(g.bolt.y).toBe(Math.max(0, sceneTop));
          expect(g.bolt.h).toBeGreaterThanOrEqual(0);
          if (top + 20 > g.bolt.y) expect(g.bolt.y + g.bolt.h).toBeCloseTo(top + 20, 6);
          expect(g.bolt.x + g.bolt.w / 2).toBeCloseTo(left + width / 2, 6);
        }),
      { numRuns: 300 },
    );
  });
});

describe('boltPoints', () => {
  it('runs from the top centre to the bottom centre in 7 steps, swaying at most 26 px', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), fc.array(unit, { minLength: BOLT_STEPS - 1, maxLength: BOLT_STEPS - 1 }), (h, sway) => {
        const pts = boltPoints(h, sway);
        expect(pts).toHaveLength(BOLT_STEPS + 1);
        expect(pts[0]).toEqual([60, 0]);
        expect(pts[BOLT_STEPS][0]).toBe(60);
        expect(pts[BOLT_STEPS][1]).toBeCloseTo(h, 6);
        pts.forEach(([x, y], i) => {
          expect(Math.abs(x - 60)).toBeLessThanOrEqual(26);
          if (i > 0) expect(y).toBeGreaterThanOrEqual(pts[i - 1][1]);
        });
      }),
      { numRuns: 200 },
    );
  });
});

describe('batFlight', () => {
  it('maps 0 and 1 to the ends of each range', () => {
    expect(batFlight([0, 0, 0, 0, 0])).toEqual({ burst: { dx: -60, dy: -40 }, end: { dx: -340, dy: -380 }, durationMs: 1100 });
    expect(batFlight([1, 1, 1, 1, 1])).toEqual({ burst: { dx: 60, dy: -10 }, end: { dx: 340, dy: -160 }, durationMs: 1600 });
  });

  it('always scatters upward', () => {
    fc.assert(
      fc.property(fc.tuple(unit, unit, unit, unit, unit), (u) => {
        const b = batFlight(u);
        expect(b.burst.dy).toBeLessThan(0);
        expect(b.end.dy).toBeLessThanOrEqual(-160);
        expect(b.durationMs).toBeGreaterThanOrEqual(1100);
        expect(b.durationMs).toBeLessThanOrEqual(1600);
      }),
      { numRuns: 200 },
    );
  });
});
