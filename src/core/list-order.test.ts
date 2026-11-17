import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortForList, parseListOrder, LIST_ORDERS } from './list-order.js';
import type { Grave } from './types.js';

function grave(id: string, title: string, buriedAt: number): Grave {
  return {
    id, url: `https://example.com/${id}`, title, domain: 'example.com', buriedAt, lastAccessed: buriedAt - 1000,
    epitaph: 'E', epitaphSource: 'title', duplicateCount: 1,
  };
}

const graves = [grave('a', 'banana', 200), grave('b', 'Apple', 300), grave('c', 'cherry', 100), grave('d', 'Éclair', 250)];
const ids = (list: Grave[]) => list.map((g) => g.id);

describe('sortForList', () => {
  it('newest first, oldest first, and by name', () => {
    expect(ids(sortForList(graves, 'new'))).toEqual(['b', 'd', 'a', 'c']);
    expect(ids(sortForList(graves, 'old'))).toEqual(['c', 'a', 'd', 'b']);
    // English collation: case-insensitive, É next to E
    expect(ids(sortForList(graves, 'name'))).toEqual(['b', 'a', 'c', 'd']);
  });

  it('never changes the input and keeps every grave', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ title: fc.string(), buriedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }) }), { maxLength: 30 }),
        fc.constantFrom(...LIST_ORDERS),
        (specs, order) => {
          const input = specs.map((s, i) => grave(String(i), s.title, s.buriedAt));
          const before = JSON.stringify(input);
          const out = sortForList(input, order);
          expect(JSON.stringify(input)).toBe(before);
          expect([...ids(out)].sort()).toEqual([...ids(input)].sort());
          for (let i = 1; i < out.length; i++) {
            if (order === 'new') expect(out[i - 1].buriedAt).toBeGreaterThanOrEqual(out[i].buriedAt);
            if (order === 'old') expect(out[i - 1].buriedAt).toBeLessThanOrEqual(out[i].buriedAt);
            if (order === 'name') expect(out[i - 1].title.localeCompare(out[i].title, 'en')).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('parseListOrder', () => {
  it('accepts the three orders and defaults to newest first', () => {
    expect(parseListOrder('old')).toBe('old');
    expect(parseListOrder('name')).toBe('name');
    expect(parseListOrder('new')).toBe('new');
    expect(parseListOrder('')).toBe('new');
    expect(parseListOrder('random')).toBe('new');
  });
});
