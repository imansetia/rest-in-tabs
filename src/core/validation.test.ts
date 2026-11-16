import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidGrave, parseGrave, normalizeStats } from './validation.js';
import { createGrave } from './graves.js';
import type { Grave, TabInfo, PageInfo } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidGrave(): Grave {
  return {
    id: 'abc-123',
    url: 'https://example.com/',
    title: 'Example',
    domain: 'example.com',
    buriedAt: 1_000_000_000_000,
    lastAccessed: 999_999_000_000,
    epitaph: 'A test page',
    epitaphSource: 'title',
    duplicateCount: 1,
  };
}

// ---------------------------------------------------------------------------
// isValidGrave
// ---------------------------------------------------------------------------

describe('isValidGrave', () => {
  it('accepts a valid Grave', () => {
    expect(isValidGrave(makeValidGrave())).toBe(true);
  });

  it('accepts a Grave with optional favIconUrl', () => {
    const grave = { ...makeValidGrave(), favIconUrl: 'https://example.com/icon.png' };
    expect(isValidGrave(grave)).toBe(true);
  });

  it('accepts a Grave with optional excerpt', () => {
    const grave = { ...makeValidGrave(), excerpt: 'Some text excerpt here' };
    expect(isValidGrave(grave)).toBe(true);
  });

  it('accepts all valid epitaphSource values', () => {
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'ai' })).toBe(true);
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'meta' })).toBe(true);
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'paragraph' })).toBe(true);
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'title' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidGrave(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidGrave(undefined)).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isValidGrave('not an object')).toBe(false);
    expect(isValidGrave(123)).toBe(false);
    expect(isValidGrave(true)).toBe(false);
  });

  it('rejects when id is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).id;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when id is empty', () => {
    expect(isValidGrave({ ...makeValidGrave(), id: '' })).toBe(false);
  });

  it('rejects when id is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), id: 123 })).toBe(false);
  });

  it('rejects when url is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).url;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when url does not start with http:// or https://', () => {
    expect(isValidGrave({ ...makeValidGrave(), url: 'chrome://newtab/' })).toBe(false);
    expect(isValidGrave({ ...makeValidGrave(), url: 'about:blank' })).toBe(false);
    expect(isValidGrave({ ...makeValidGrave(), url: 'ftp://example.com/' })).toBe(false);
  });

  it('accepts http:// URLs', () => {
    expect(isValidGrave({ ...makeValidGrave(), url: 'http://example.com/' })).toBe(true);
  });

  it('rejects when title is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).title;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when title is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), title: 123 })).toBe(false);
  });

  it('accepts empty title (page might have no title)', () => {
    expect(isValidGrave({ ...makeValidGrave(), title: '' })).toBe(true);
  });

  it('rejects when domain is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).domain;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when domain is empty', () => {
    expect(isValidGrave({ ...makeValidGrave(), domain: '' })).toBe(false);
  });

  it('rejects when domain is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), domain: 123 })).toBe(false);
  });

  it('rejects when buriedAt is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).buriedAt;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when buriedAt is not a number', () => {
    expect(isValidGrave({ ...makeValidGrave(), buriedAt: '1000000' })).toBe(false);
  });

  it('rejects when buriedAt is NaN', () => {
    expect(isValidGrave({ ...makeValidGrave(), buriedAt: NaN })).toBe(false);
  });

  it('rejects when buriedAt is Infinity', () => {
    expect(isValidGrave({ ...makeValidGrave(), buriedAt: Infinity })).toBe(false);
  });

  it('rejects when lastAccessed is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).lastAccessed;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when lastAccessed is not finite', () => {
    expect(isValidGrave({ ...makeValidGrave(), lastAccessed: NaN })).toBe(false);
    expect(isValidGrave({ ...makeValidGrave(), lastAccessed: Infinity })).toBe(false);
  });

  it('rejects when epitaph is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).epitaph;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when epitaph is empty', () => {
    expect(isValidGrave({ ...makeValidGrave(), epitaph: '' })).toBe(false);
  });

  it('rejects when epitaph is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), epitaph: 123 })).toBe(false);
  });

  it('rejects when epitaphSource is missing', () => {
    const grave = { ...makeValidGrave() };
    delete (grave as any).epitaphSource;
    expect(isValidGrave(grave)).toBe(false);
  });

  it('rejects when epitaphSource is invalid', () => {
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'invalid' })).toBe(false);
    expect(isValidGrave({ ...makeValidGrave(), epitaphSource: 'summary' })).toBe(false);
  });

  it('rejects when favIconUrl is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), favIconUrl: 123 })).toBe(false);
  });

  it('accepts data: URLs for favIconUrl', () => {
    expect(isValidGrave({ ...makeValidGrave(), favIconUrl: 'data:image/png;base64,abc' })).toBe(true);
  });

  it('accepts chrome:// URLs for favIconUrl', () => {
    expect(isValidGrave({ ...makeValidGrave(), favIconUrl: 'chrome://icon' })).toBe(true);
  });

  it('rejects when excerpt is not a string', () => {
    expect(isValidGrave({ ...makeValidGrave(), excerpt: 123 })).toBe(false);
    expect(isValidGrave({ ...makeValidGrave(), excerpt: {} })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property: createGrave always produces valid Graves
// ---------------------------------------------------------------------------

describe('Property: createGrave always produces valid Graves', () => {
  it('createGrave output is valid and survives a JSON round trip through parseGrave', () => {
    // Arbitraries for TabInfo and PageInfo.
    const anyTab: fc.Arbitrary<TabInfo> = fc.record({
      id: fc.integer({ min: 1 }),
      url: fc.webUrl({ validSchemes: ['https', 'http'] }),
      title: fc.string(),
      active: fc.boolean(),
      pinned: fc.boolean(),
      audible: fc.boolean(),
      incognito: fc.boolean(),
      lastAccessed: fc.integer({ min: 0, max: 2_000_000_000_000 }),
      favIconUrl: fc.option(
        fc.oneof(
          fc.webUrl({ validSchemes: ['https', 'http'] }),
          fc.constant('data:image/png;base64,abc123'),
          fc.constant('chrome://icon'),
        ),
        { nil: undefined },
      ),
    });

    const anyPage: fc.Arbitrary<PageInfo> = fc.record({
      title: fc.string(),
      metaDescription: fc.option(fc.string(), { nil: undefined }),
      firstParagraph: fc.option(fc.string(), { nil: undefined }),
      excerpt: fc.option(fc.string(), { nil: undefined }),
    });

    fc.assert(
      fc.property(
        anyTab,
        anyPage,
        fc.integer({ min: 0, max: 2_000_000_000_000 }), // now
        fc.uuid(), // id
        // Counts from countDuplicates, plus values it never returns, to check createGrave's guard.
        fc.oneof(fc.integer({ min: 1, max: 50 }), fc.constantFrom(0, -1, 2.5, NaN)),
        (tab, page, now, id, duplicateCount) => {
          const grave = createGrave(tab, page, now, id, duplicateCount);
          expect(isValidGrave(grave)).toBe(true);
          expect(Number.isInteger(grave.duplicateCount) && grave.duplicateCount >= 1).toBe(true);
          // What storage gives back is the same Grave.
          expect(parseGrave(JSON.parse(JSON.stringify(grave)))).toEqual(grave);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// parseGrave
// ---------------------------------------------------------------------------

describe('parseGrave', () => {
  it('keeps a valid duplicateCount', () => {
    expect(parseGrave({ ...makeValidGrave(), duplicateCount: 4 })?.duplicateCount).toBe(4);
  });

  it('keeps an old Grave without duplicateCount and reads it as 1', () => {
    const old: Record<string, unknown> = { ...makeValidGrave() };
    delete old.duplicateCount;
    expect(parseGrave(old)).toEqual({ ...makeValidGrave(), duplicateCount: 1 });
  });

  it('keeps a Grave with a bad duplicateCount and reads it as 1', () => {
    for (const bad of [0, -3, 1.5, '3', null, NaN]) {
      expect(parseGrave({ ...makeValidGrave(), duplicateCount: bad })?.duplicateCount).toBe(1);
    }
  });

  it('returns null when a required field is invalid', () => {
    expect(parseGrave({ ...makeValidGrave(), url: 'about:blank' })).toBeNull();
    expect(parseGrave(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeStats
// ---------------------------------------------------------------------------

describe('normalizeStats', () => {
  it('returns valid stats unchanged', () => {
    expect(normalizeStats({ buried: 10, resurrected: 5 })).toEqual({ buried: 10, resurrected: 5 });
  });

  it('defaults to zero when input is null', () => {
    expect(normalizeStats(null)).toEqual({ buried: 0, resurrected: 0 });
  });

  it('defaults to zero when input is undefined', () => {
    expect(normalizeStats(undefined)).toEqual({ buried: 0, resurrected: 0 });
  });

  it('defaults to zero when input is not an object', () => {
    expect(normalizeStats('not an object')).toEqual({ buried: 0, resurrected: 0 });
    expect(normalizeStats(123)).toEqual({ buried: 0, resurrected: 0 });
  });

  it('defaults buried to zero when missing', () => {
    expect(normalizeStats({ resurrected: 5 })).toEqual({ buried: 0, resurrected: 5 });
  });

  it('defaults resurrected to zero when missing', () => {
    expect(normalizeStats({ buried: 10 })).toEqual({ buried: 10, resurrected: 0 });
  });

  it('defaults buried to zero when not a number', () => {
    expect(normalizeStats({ buried: 'ten', resurrected: 5 })).toEqual({ buried: 0, resurrected: 5 });
  });

  it('defaults to zero when not finite', () => {
    expect(normalizeStats({ buried: NaN, resurrected: Infinity })).toEqual({ buried: 0, resurrected: 0 });
  });

  it('defaults to zero when not an integer', () => {
    expect(normalizeStats({ buried: 10.5, resurrected: 5.7 })).toEqual({ buried: 0, resurrected: 0 });
  });

  it('defaults to zero when negative', () => {
    expect(normalizeStats({ buried: -5, resurrected: -10 })).toEqual({ buried: 0, resurrected: 0 });
  });

  it('accepts zero values', () => {
    expect(normalizeStats({ buried: 0, resurrected: 0 })).toEqual({ buried: 0, resurrected: 0 });
  });
});
