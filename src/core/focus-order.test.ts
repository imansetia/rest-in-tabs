import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { focusCandidates } from './focus-order.js';

describe('focusCandidates', () => {
  it('the next grave first, else the previous one', () => {
    expect(focusCandidates(['a', 'b', 'c'], 'b')[0]).toBe('c');
    expect(focusCandidates(['a', 'b', 'c'], 'c')[0]).toBe('b'); // the last one: previous
    expect(focusCandidates(['a', 'b', 'c'], 'a')[0]).toBe('b');
  });

  it('then alternates outward: next, previous, next but one, previous but one', () => {
    expect(focusCandidates(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual(['d', 'b', 'e', 'a']);
    expect(focusCandidates(['a', 'b', 'c', 'd', 'e'], 'd')).toEqual(['e', 'c', 'b', 'a']);
  });

  it('no candidates for the only grave or an unknown id', () => {
    expect(focusCandidates(['a'], 'a')).toEqual([]);
    expect(focusCandidates(['a', 'b'], 'x')).toEqual([]);
  });

  it('lists every other grave exactly once, the nearer ones first', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 30 }), fc.nat(), (order, pick) => {
        const removed = order[pick % order.length];
        const at = order.indexOf(removed);
        const result = focusCandidates(order, removed);
        expect([...result].sort()).toEqual(order.filter((id) => id !== removed).sort());
        const distance = result.map((id) => Math.abs(order.indexOf(id) - at));
        distance.forEach((d, i) => { if (i > 0) expect(d).toBeGreaterThanOrEqual(distance[i - 1]); });
      }),
      { numRuns: 300 },
    );
  });
});
