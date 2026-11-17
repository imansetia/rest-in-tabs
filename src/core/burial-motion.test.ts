import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { riseDelays, countUpValue, massBurialMs, RISE_STEP_MS } from './burial-motion.js';

describe('riseDelays', () => {
  it('only new graves rise, newest first, 170 ms apart', () => {
    const shown = ['n1', 'n2', 'old1', 'n3', 'old2'];
    expect([...riseDelays(shown, new Set(['n3', 'n1', 'n2']))]).toEqual([['n1', 0], ['n2', 170], ['n3', 340]]);
  });

  it('gives nothing when no grave is new', () => {
    expect(riseDelays(['a', 'b'], new Set()).size).toBe(0);
  });

  it('delays follow display order and grow by one step each', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { maxLength: 30 }), fc.func(fc.boolean()), (ids, isNew) => {
        const rising = new Set(ids.filter((id) => isNew(id)));
        const delays = [...riseDelays(ids, rising)];
        expect(delays.map(([id]) => id)).toEqual(ids.filter((id) => rising.has(id)));
        delays.forEach(([, ms], i) => expect(ms).toBe(i * RISE_STEP_MS));
      }),
      { numRuns: 200 },
    );
  });
});

describe('massBurialMs', () => {
  it('is fog 0.9 s + 0.6 s + 170 ms per grave + 0.5 s recede', () => {
    expect(massBurialMs(0)).toBe(2000);
    expect(massBurialMs(12)).toBe(2000 + 12 * 170);
  });
});

describe('countUpValue', () => {
  it('starts at from, ends at to, and eases out', () => {
    expect(countUpValue(46, 58, 0)).toBe(46);
    expect(countUpValue(46, 58, 1)).toBe(58);
    expect(countUpValue(0, 1000, 0.5)).toBe(875); // 1 − 0.5³
    expect(countUpValue(0, 10, 2)).toBe(10); // progress is clamped
  });

  it('never goes backwards and stays between from and to', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 0, max: 5000 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
        (from, added, p1, p2) => {
          const to = from + added;
          const [lo, hi] = p1 <= p2 ? [p1, p2] : [p2, p1];
          const a = countUpValue(from, to, lo);
          const b = countUpValue(from, to, hi);
          expect(a).toBeLessThanOrEqual(b);
          expect(a).toBeGreaterThanOrEqual(from);
          expect(b).toBeLessThanOrEqual(to);
        }),
      { numRuns: 300 },
    );
  });
});
