import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resurrectGeometry, petalFlight, RESURRECT_MS, GHOST_AT_MS, FLY_AT_MS } from './resurrect-motion.js';

describe('resurrect timeline', () => {
  it('follows the mockup: slide at 450 ms, ghost at 710 ms, fly-off at 1860 ms, gone at 2680 ms', () => {
    expect(GHOST_AT_MS).toBe(710);
    expect(FLY_AT_MS).toBe(1860);
    expect(RESURRECT_MS).toBe(2680);
  });
});

describe('resurrectGeometry', () => {
  it('matches the mockup for a front-row stone', () => {
    // 172 px wide stone whose foot is centred at x = 300, y = 700.
    const g = resurrectGeometry({ left: 214, width: 172, bottom: 700 });
    expect(g.glow.x).toBe(128);
    expect(g.glow.y).toBeCloseTo(545.2, 6);
    expect(g.glow.w).toBe(344);
    expect(g.glow.h).toBeCloseTo(275.2, 6);
    expect(g.ghost.w).toBeCloseTo(134.16, 6);
    expect(g.ghost.x).toBeCloseTo(300 - 67.08, 6);
    expect(g.ghost.y).toBeCloseTo(700 - 134.16 * 1.24, 6);
    expect(g.flyOff).toEqual({ dx: -105, dy: -960 });
    expect(g.petal).toEqual({ x: 295, y: 682, w: 10, h: 14 });
  });

  it('a small far stone still gets a 70 px ghost', () => {
    expect(resurrectGeometry({ left: 0, width: 58, bottom: 300 }).ghost.w).toBe(70);
  });

  it('the ghost is centred on the stone and always flies off above the top edge', () => {
    fc.assert(
      fc.property(fc.double({ min: -500, max: 3000, noNaN: true }), fc.double({ min: 20, max: 400, noNaN: true }), fc.double({ min: 0, max: 2000, noNaN: true }),
        (left, width, bottom) => {
          const g = resurrectGeometry({ left, width, bottom });
          expect(g.ghost.x + g.ghost.w / 2).toBeCloseTo(left + width / 2, 6);
          expect(g.glow.x + g.glow.w / 2).toBeCloseTo(left + width / 2, 6);
          // The ghost's bottom edge ends at least 100 px above the top of the page.
          expect(g.ghost.y + g.ghost.w * 1.24 + g.flyOff.dy).toBeLessThanOrEqual(-100);
        }),
      { numRuns: 300 },
    );
  });
});

describe('petalFlight', () => {
  it('maps 0 and 1 to the ends of each range', () => {
    expect(petalFlight([0, 0, 0, 0, 0])).toEqual({ dx: -180, dy: -320, rotateDeg: -540, scale: 0.5, durationMs: 1300 });
    expect(petalFlight([1, 1, 1, 1, 1])).toEqual({ dx: 180, dy: -90, rotateDeg: 540, scale: 1, durationMs: 2100 });
  });

  it('always flies up and stays in range', () => {
    const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });
    fc.assert(
      fc.property(fc.tuple(unit, unit, unit, unit, unit), (u) => {
        const p = petalFlight(u);
        expect(Math.abs(p.dx)).toBeLessThanOrEqual(180);
        expect(p.dy).toBeGreaterThanOrEqual(-320);
        expect(p.dy).toBeLessThanOrEqual(-90);
        expect(Math.abs(p.rotateDeg)).toBeLessThanOrEqual(540);
        expect(p.scale).toBeGreaterThanOrEqual(0.5);
        expect(p.durationMs).toBeGreaterThanOrEqual(1300);
        expect(p.durationMs).toBeLessThanOrEqual(2100);
      }),
      { numRuns: 300 },
    );
  });
});
