import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { decayStage, expiredGraves, sortGraves, searchGraves, newestMatch, estimateFreedMb, type DecayStage } from './decay.js';
import type { Grave } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1;
function makeGrave(overrides: Partial<Grave> = {}): Grave {
  return {
    id: String(nextId++),
    url: `https://example-${nextId}.com/`,
    title: 'Example',
    domain: 'example.com',
    buriedAt: Date.now(),
    lastAccessed: Date.now() - 1000,
    epitaph: 'Some page',
    epitaphSource: 'title',
    duplicateCount: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary Grave with a unique-enough url and a valid buriedAt. */
const anyGrave: fc.Arbitrary<Grave> = fc.record<Grave>({
  id: fc.uuid(),
  url: fc.webUrl({ validSchemes: ['https'] }),
  title: fc.string(),
  domain: fc.domain(),
  buriedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  lastAccessed: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  epitaph: fc.string({ minLength: 1, maxLength: 200 }),
  epitaphSource: fc.constantFrom('ai', 'meta', 'paragraph', 'title') as fc.Arbitrary<Grave['epitaphSource']>,
  favIconUrl: fc.option(fc.webUrl(), { nil: undefined }),
  excerpt: fc.option(fc.string(), { nil: undefined }),
  duplicateCount: fc.integer({ min: 1, max: 5 }),
});

// ---------------------------------------------------------------------------
// Property 7: Decay never reverses
// Feature: rest-in-tabs, Property 7
// ---------------------------------------------------------------------------

describe('Property 7: Decay never reverses', () => {
  it('stage at t2 >= stage at t1 when t2 >= t1', () => {
    const stageOrder: Record<DecayStage, number> = { fresh: 0, weathered: 1, crumbling: 2 };
    const ONE_DAY = 86_400_000;
    const SEVEN_DAYS = 604_800_000;

    // Track how many runs hit each stage and each transition.
    let freshCount = 0;
    let weatheredCount = 0;
    let crumblingCount = 0;
    let transitionCount = 0;

    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000_000, max: 1_500_000_000_000 }), // buriedAt
        fc.oneof(
          // Generate (t1, t2) pairs that explicitly cross stage boundaries.
          fc.record({
            t1Offset: fc.integer({ min: 0, max: ONE_DAY - 1 }), // fresh
            t2Offset: fc.integer({ min: ONE_DAY, max: SEVEN_DAYS + 1_000_000 }), // weathered or crumbling
          }),
          fc.record({
            t1Offset: fc.integer({ min: ONE_DAY, max: SEVEN_DAYS - 1 }), // weathered
            t2Offset: fc.integer({ min: SEVEN_DAYS, max: SEVEN_DAYS * 2 }), // crumbling
          }),
          // Also generate arbitrary offsets.
          fc.record({
            t1Offset: fc.integer({ min: 0, max: SEVEN_DAYS * 3 }),
            t2Offset: fc.integer({ min: 0, max: SEVEN_DAYS * 3 }),
          }),
        ),
        (buriedAt, { t1Offset, t2Offset }) => {
          const time1 = buriedAt + Math.min(t1Offset, t2Offset);
          const time2 = buriedAt + Math.max(t1Offset, t2Offset);

          const stage1 = decayStage(buriedAt, time1);
          const stage2 = decayStage(buriedAt, time2);

          // Count stages seen at time1.
          if (stage1 === 'fresh') freshCount++;
          if (stage1 === 'weathered') weatheredCount++;
          if (stage1 === 'crumbling') crumblingCount++;

          // Count when stage changes between t1 and t2.
          if (stage1 !== stage2) transitionCount++;

          expect(stageOrder[stage2]).toBeGreaterThanOrEqual(stageOrder[stage1]);
        },
      ),
      { numRuns: 300 },
    );

    // Verify we tested all stages and saw some transitions.
    expect(freshCount).toBeGreaterThan(0);
    expect(weatheredCount).toBeGreaterThan(0);
    expect(crumblingCount).toBeGreaterThan(0);
    expect(transitionCount).toBeGreaterThan(0);
  });

  it('stage boundaries fall exactly at 1 day and 7 days', () => {
    const ONE_DAY = 86_400_000;
    const SEVEN_DAYS = 604_800_000;
    const buriedAt = 1_000_000_000_000;

    // Just before 1 day: fresh.
    expect(decayStage(buriedAt, buriedAt + ONE_DAY - 1)).toBe('fresh');
    // Exactly 1 day: weathered.
    expect(decayStage(buriedAt, buriedAt + ONE_DAY)).toBe('weathered');
    // Just before 7 days: weathered.
    expect(decayStage(buriedAt, buriedAt + SEVEN_DAYS - 1)).toBe('weathered');
    // Exactly 7 days: crumbling.
    expect(decayStage(buriedAt, buriedAt + SEVEN_DAYS)).toBe('crumbling');
    // Way past 7 days: crumbling.
    expect(decayStage(buriedAt, buriedAt + SEVEN_DAYS * 10)).toBe('crumbling');
  });
});

// ---------------------------------------------------------------------------
// Property 8: Expiry removes only old Graves
// Feature: rest-in-tabs, Property 8
// ---------------------------------------------------------------------------

describe('Property 8: Expiry removes only old Graves', () => {
  it('returns exactly the Graves older than the retention period', () => {
    let hasRetention = 0;
    let hasNull = 0;
    let hasExpired = 0;
    let hasNotExpired = 0;

    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1, max: 365 }), // retentionDays
          fc.constant(null), // "Never"
        ),
        fc.integer({ min: 0, max: 2_000_000_000_000 }), // now
        (retentionDays, now) => {
          if (retentionDays === null) hasNull++;
          else hasRetention++;

          // Build Graves deliberately around the expiry boundary when retentionDays is set.
          const graves: Grave[] = [];
          if (retentionDays !== null) {
            const maxAge = retentionDays * 86_400_000;
            // Some expired (just past the boundary).
            graves.push(makeGrave({ buriedAt: now - maxAge - 1_000_000 }));
            graves.push(makeGrave({ buriedAt: now - maxAge - 1 }));
            // Some not expired (just before the boundary).
            graves.push(makeGrave({ buriedAt: now - maxAge }));
            graves.push(makeGrave({ buriedAt: now - maxAge + 1_000_000 }));
            graves.push(makeGrave({ buriedAt: now }));
          } else {
            // For null retention, add any Graves.
            graves.push(makeGrave({ buriedAt: now - 1_000_000_000 }));
            graves.push(makeGrave({ buriedAt: now }));
          }

          const result = expiredGraves(graves, retentionDays, now);

          if (retentionDays === null) {
            // When retention is "Never", no Graves expire.
            expect(result).toEqual([]);
          } else {
            const maxAge = retentionDays * 86_400_000;
            // Every returned Grave must be expired.
            for (const g of result) {
              const age = now - g.buriedAt;
              expect(age).toBeGreaterThan(maxAge);
              hasExpired++;
            }

            // Every expired Grave in the input must be in the result.
            for (const g of graves) {
              const age = now - g.buriedAt;
              if (age > maxAge) {
                expect(result).toContainEqual(g);
              } else {
                expect(result).not.toContainEqual(g);
                hasNotExpired++;
              }
            }
          }
        },
      ),
      { numRuns: 300 },
    );

    // Verify we tested both null and numeric retention, and saw both expired and not-expired cases.
    expect(hasNull).toBeGreaterThan(0);
    expect(hasRetention).toBeGreaterThan(0);
    expect(hasExpired).toBeGreaterThan(0);
    expect(hasNotExpired).toBeGreaterThan(0);
  });

  it('retention boundary: exactly at the limit is NOT expired, one ms past is expired', () => {
    const retentionDays = 30;
    const maxAge = retentionDays * 86_400_000;
    const buriedAt = 1_000_000_000_000;
    const now = buriedAt + maxAge;

    const graveAtLimit = makeGrave({ buriedAt });
    const gravePastLimit = makeGrave({ buriedAt: buriedAt - 1 });

    expect(expiredGraves([graveAtLimit], retentionDays, now)).toEqual([]);
    expect(expiredGraves([gravePastLimit], retentionDays, now)).toEqual([gravePastLimit]);
  });
});

// ---------------------------------------------------------------------------
// Property 9: Search returns matching Graves only
// Feature: rest-in-tabs, Property 9
// ---------------------------------------------------------------------------

describe('Property 9: Search returns matching Graves only', () => {
  it('every result contains the query in title, domain or epitaph (case-insensitive)', () => {
    let emptyQueryCount = 0;
    let nonEmptyQueryCount = 0;
    let matchInTitle = 0;
    let matchInDomain = 0;
    let matchInEpitaph = 0;
    let noMatch = 0;

    fc.assert(
      fc.property(
        // Generate Graves, then derive some queries from them to ensure matches.
        fc.array(anyGrave, { minLength: 1, maxLength: 10 }).chain((graves) => {
          return fc.oneof(
            // Empty query.
            fc.constant(''),
            // Query from a random Grave's title substring.
            fc.integer({ min: 0, max: graves.length - 1 }).chain((i) => {
              const title = graves[i].title;
              if (title.length === 0) return fc.constant('nomatch');
              const len = Math.min(title.length, 5);
              return fc.integer({ min: 0, max: title.length - len }).map((start) =>
                title.slice(start, start + len),
              );
            }),
            // Query from a random Grave's domain substring.
            fc.integer({ min: 0, max: graves.length - 1 }).chain((i) => {
              const domain = graves[i].domain;
              if (domain.length === 0) return fc.constant('nomatch');
              const len = Math.min(domain.length, 5);
              return fc.integer({ min: 0, max: domain.length - len }).map((start) =>
                domain.slice(start, start + len),
              );
            }),
            // Query from a random Grave's epitaph substring.
            fc.integer({ min: 0, max: graves.length - 1 }).chain((i) => {
              const epitaph = graves[i].epitaph;
              if (epitaph.length === 0) return fc.constant('nomatch');
              const len = Math.min(epitaph.length, 5);
              return fc.integer({ min: 0, max: epitaph.length - len }).map((start) =>
                epitaph.slice(start, start + len),
              );
            }),
            // Random string that likely won't match.
            fc.string({ minLength: 1, maxLength: 10 }),
          ).map((query) => ({ graves, query }));
        }),
        ({ graves, query }) => {
          if (query === '') emptyQueryCount++;
          else nonEmptyQueryCount++;

          const result = searchGraves(graves, query);

          if (query === '') {
            // Empty query matches all Graves.
            expect(result).toEqual(graves);
          } else {
            const lowerQuery = query.toLowerCase();

            // Every result must match.
            for (const g of result) {
              const inTitle = g.title.toLowerCase().includes(lowerQuery);
              const inDomain = g.domain.toLowerCase().includes(lowerQuery);
              const inEpitaph = g.epitaph.toLowerCase().includes(lowerQuery);

              expect(inTitle || inDomain || inEpitaph).toBe(true);

              if (inTitle) matchInTitle++;
              if (inDomain) matchInDomain++;
              if (inEpitaph) matchInEpitaph++;
            }

            // Every matching Grave in the input must be in the result.
            for (const g of graves) {
              const inTitle = g.title.toLowerCase().includes(lowerQuery);
              const inDomain = g.domain.toLowerCase().includes(lowerQuery);
              const inEpitaph = g.epitaph.toLowerCase().includes(lowerQuery);

              if (inTitle || inDomain || inEpitaph) {
                expect(result).toContainEqual(g);
              } else {
                expect(result).not.toContainEqual(g);
                noMatch++;
              }
            }
          }
        },
      ),
      { numRuns: 300 },
    );

    // Verify we tested both empty and non-empty queries, and saw matches in all fields.
    expect(emptyQueryCount).toBeGreaterThan(0);
    expect(nonEmptyQueryCount).toBeGreaterThan(0);
    expect(matchInTitle).toBeGreaterThan(0);
    expect(matchInDomain).toBeGreaterThan(0);
    expect(matchInEpitaph).toBeGreaterThan(0);
    expect(noMatch).toBeGreaterThan(0);
  });

  it('case-insensitive: "EXAMPLE" matches "example.com"', () => {
    const grave = makeGrave({ domain: 'example.com' });
    expect(searchGraves([grave], 'EXAMPLE')).toEqual([grave]);
  });
});

describe('newestMatch (where the search camera goes)', () => {
  it('is the most recently buried match, whatever the input order', () => {
    const old = makeGrave({ title: 'Lisbon weather', buriedAt: 1000 });
    const newer = makeGrave({ title: 'Lisbon flights', buriedAt: 3000 });
    const other = makeGrave({ title: 'Porto', buriedAt: 5000 });
    expect(newestMatch([old, newer, other], 'lisbon')).toBe(newer);
    expect(newestMatch([other, newer, old], 'LISBON')).toBe(newer);
  });

  it('null for an empty query or no match', () => {
    const g = makeGrave({ title: 'Porto' });
    expect(newestMatch([g], '')).toBeNull();
    expect(newestMatch([g], 'zzz')).toBeNull();
  });

  it('always a match with the latest burial time among the matches', () => {
    fc.assert(
      fc.property(fc.array(anyGrave, { minLength: 1, maxLength: 20 }), fc.constantFrom('a', 'e', 'co', '.', 'zz'), (graves, query) => {
        const matches = searchGraves(graves, query);
        const result = newestMatch(graves, query);
        if (matches.length === 0) expect(result).toBeNull();
        else {
          expect(matches).toContain(result);
          expect(result!.buriedAt).toBe(Math.max(...matches.map((g) => g.buriedAt)));
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// sortGraves — targeted cases
// ---------------------------------------------------------------------------

describe('sortGraves — targeted cases', () => {
  it('returns newest first', () => {
    const oldest = makeGrave({ buriedAt: 100 });
    const middle = makeGrave({ buriedAt: 200 });
    const newest = makeGrave({ buriedAt: 300 });

    const result = sortGraves([oldest, middle, newest]);
    expect(result).toEqual([newest, middle, oldest]);
  });

  it('does not mutate the input array', () => {
    const graves = [
      makeGrave({ buriedAt: 100 }),
      makeGrave({ buriedAt: 200 }),
      makeGrave({ buriedAt: 300 }),
    ];
    const original = [...graves];
    sortGraves(graves);
    expect(graves).toEqual(original);
  });

  it('works with an empty array', () => {
    expect(sortGraves([])).toEqual([]);
  });

  it('stable for Graves with identical buriedAt', () => {
    const g1 = makeGrave({ buriedAt: 100, url: 'https://a.com/' });
    const g2 = makeGrave({ buriedAt: 100, url: 'https://b.com/' });
    const g3 = makeGrave({ buriedAt: 100, url: 'https://c.com/' });

    const result = sortGraves([g1, g2, g3]);
    // All have the same buriedAt, so order should be preserved (or at least consistent).
    expect(result.map((g) => g.url)).toEqual(['https://a.com/', 'https://b.com/', 'https://c.com/']);
  });
});

// ---------------------------------------------------------------------------
// estimateFreedMb — targeted cases
// ---------------------------------------------------------------------------

describe('estimateFreedMb — targeted cases', () => {
  it('returns 0 for 0 buried tabs', () => {
    expect(estimateFreedMb(0)).toBe(0);
  });

  it('returns 50 for 1 buried tab', () => {
    expect(estimateFreedMb(1)).toBe(50);
  });

  it('returns 5000 for 100 buried tabs', () => {
    expect(estimateFreedMb(100)).toBe(5000);
  });
});
