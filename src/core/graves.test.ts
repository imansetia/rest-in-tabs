import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { fallbackEpitaph, addGrave, createGrave, countDuplicates } from './graves.js';
import { EPITAPH_MAX, GRAVE_CAP, EXCERPT_MAX } from './types.js';
import type { Grave, PageInfo, TabInfo } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function codePointLength(s: string): number {
  return [...s].length;
}

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

function makeTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    id: 1,
    url: 'https://example.com/',
    title: 'Example',
    active: false,
    pinned: false,
    audible: false,
    incognito: false,
    lastAccessed: 1_000_000,
    ...overrides,
  };
}

function makePage(overrides: Partial<PageInfo> = {}): PageInfo {
  return { title: 'Page Title', ...overrides };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Any string including empty, whitespace-only, very long, with emoji. */
const anyString = fc.oneof(
  fc.string(),
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t\n\r'),
  fc.constant('a '.repeat(150)), // 300 chars, whitespace runs to collapse
  fc.string({ maxLength: 500 }),
  // Strings that may contain multi-byte graphemes (emoji, CJK, etc.)
  fc.string({ unit: 'grapheme', maxLength: 300 }),
);

/**
 * Text with random whitespace runs (spaces, tabs, newlines, multiple in a row),
 * guaranteed to be over 200 code points to exercise truncation and whitespace collapse together.
 */
const longTextWithWhitespaceRuns = fc
  .array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 15, maxLength: 30 })
  .chain((words) => {
    // Join with random whitespace runs: 1-5 of (space | tab | newline)
    const whitespaceChars = [' ', '\t', '\n'];
    return fc.tuple(
      ...Array(words.length - 1).fill(
        fc.array(fc.constantFrom(...whitespaceChars), { minLength: 1, maxLength: 5 })
          .map((chars) => chars.join('')),
      ),
    ).map((runs) => {
      let result = words[0];
      for (let i = 0; i < runs.length; i++) {
        result += runs[i] + words[i + 1];
      }
      return result;
    });
  });

const anyPageInfo: fc.Arbitrary<PageInfo> = fc.record<PageInfo>({
  title: fc.oneof(anyString, longTextWithWhitespaceRuns),
  metaDescription: fc.option(fc.oneof(anyString, longTextWithWhitespaceRuns), { nil: undefined }),
  firstParagraph: fc.option(fc.oneof(anyString, longTextWithWhitespaceRuns), { nil: undefined }),
  excerpt: fc.option(anyString, { nil: undefined }),
});

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
// Property 4: Graves stay unique and capped
// Feature: rest-in-tabs, Property 4
// ---------------------------------------------------------------------------

describe('Property 4: Graves stay unique and capped', () => {
  it('result contains the new grave URL exactly once', () => {
    fc.assert(
      fc.property(
        fc.array(anyGrave, { minLength: 0, maxLength: 20 }),
        anyGrave,
        fc.integer({ min: 1, max: 30 }),
        (graves, newGrave, cap) => {
          // Ensure uniqueness in input list (deduplicate by url).
          const uniqueGraves = graves.filter(
            (g, i, arr) => arr.findIndex((x) => x.url === g.url) === i && g.url !== newGrave.url,
          );
          const result = addGrave(uniqueGraves, newGrave, cap);
          const matchCount = result.filter((g) => g.url === newGrave.url).length;
          expect(matchCount).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('result has no duplicate URLs', () => {
    fc.assert(
      fc.property(
        fc.array(anyGrave, { minLength: 0, maxLength: 20 }),
        anyGrave,
        fc.integer({ min: 1, max: 30 }),
        (graves, newGrave, cap) => {
          const uniqueGraves = graves.filter(
            (g, i, arr) => arr.findIndex((x) => x.url === g.url) === i && g.url !== newGrave.url,
          );
          const result = addGrave(uniqueGraves, newGrave, cap);
          const urls = result.map((g) => g.url);
          const uniqueUrls = new Set(urls);
          expect(urls.length).toBe(uniqueUrls.size);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('result length is at most cap', () => {
    fc.assert(
      fc.property(
        fc.array(anyGrave, { minLength: 0, maxLength: 20 }),
        anyGrave,
        fc.integer({ min: 1, max: 30 }),
        (graves, newGrave, cap) => {
          const uniqueGraves = graves.filter(
            (g, i, arr) => arr.findIndex((x) => x.url === g.url) === i && g.url !== newGrave.url,
          );
          const result = addGrave(uniqueGraves, newGrave, cap);
          expect(result.length).toBeLessThanOrEqual(cap);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('dropped entries are the oldest among the existing graves, not the new grave', () => {
    fc.assert(
      fc.property(
        fc.array(anyGrave, { minLength: 2, maxLength: 20 }),
        anyGrave,
        (rawGraves, newGrave) => {
          // Make input list unique and not containing newGrave's URL.
          const graves = rawGraves
            .filter((g, i, arr) => arr.findIndex((x) => x.url === g.url) === i && g.url !== newGrave.url)
            .slice(0, 10);
          if (graves.length < 2) return; // skip degenerate cases

          // cap is exactly the existing count — adding one will force a drop.
          const cap = graves.length;
          const result = addGrave(graves, newGrave, cap);

          // The new grave must be in the result.
          expect(result.some((g) => g.url === newGrave.url)).toBe(true);

          // The dropped grave must be the one with the smallest buriedAt among the originals.
          const sortedByAge = [...graves].sort((a, b) => a.buriedAt - b.buriedAt);
          const oldest = sortedByAge[0];
          // oldest should be absent (unless newGrave.url replaced it, which can't happen here
          // because we ensured newGrave.url ∉ graves).
          expect(result.some((g) => g.url === oldest.url)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('new grave with the smallest buriedAt is never dropped', () => {
    // 10 existing graves with buriedAt 100..1000; new grave has buriedAt 0 (clock set back).
    const existing = Array.from({ length: 10 }, (_, i) =>
      makeGrave({ url: `https://site${i}.com/`, buriedAt: (i + 1) * 100 }),
    );
    const newGrave = makeGrave({ url: 'https://new.com/', buriedAt: 0 });
    const cap = 10; // adding one over cap forces a drop
    const result = addGrave(existing, newGrave, cap);
    expect(result.some((g) => g.url === newGrave.url)).toBe(true);
    expect(result.length).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Property 5: Burial preserves the address
// Feature: rest-in-tabs, Property 5
// ---------------------------------------------------------------------------

describe('Property 5: Burial preserves the address (createGrave)', () => {
  it('createGrave url equals the tab url', () => {
    fc.assert(
      fc.property(
        fc.webUrl({ validSchemes: ['https', 'http'] }),
        anyPageInfo,
        fc.integer({ min: 0 }),
        fc.uuid(),
        (url, page, now, id) => {
          const tab = makeTab({ url });
          const grave = createGrave(tab, page, now, id, 1);
          expect(grave.url).toBe(tab.url);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('createGrave sets buriedAt to the supplied now', () => {
    fc.assert(
      fc.property(anyPageInfo, fc.integer({ min: 0, max: 2_000_000_000_000 }), fc.uuid(), (page, now, id) => {
        const grave = createGrave(makeTab(), page, now, id, 1);
        expect(grave.buriedAt).toBe(now);
      }),
      { numRuns: 100 },
    );
  });

  it('createGrave domain is the lower-cased hostname', () => {
    const tab = makeTab({ url: 'https://Docs.Example.COM/path' });
    const grave = createGrave(tab, makePage(), 0, 'id-1', 1);
    expect(grave.domain).toBe('docs.example.com');
  });

  it('createGrave excerpt is capped at EXCERPT_MAX', () => {
    const longExcerpt = 'x'.repeat(EXCERPT_MAX + 100);
    const grave = createGrave(makeTab(), makePage({ excerpt: longExcerpt }), 0, 'id-2', 1);
    expect(grave.excerpt!.length).toBeLessThanOrEqual(EXCERPT_MAX);
  });

  it('createGrave excerpt is undefined when page has no excerpt', () => {
    const grave = createGrave(makeTab(), makePage(), 0, 'id-3', 1);
    expect(grave.excerpt).toBeUndefined();
  });

  it('createGrave stores the duplicate count, and 1 for anything below 1 or not an integer', () => {
    expect(createGrave(makeTab(), makePage(), 0, 'id-4', 3).duplicateCount).toBe(3);
    for (const bad of [0, -2, 1.5, NaN]) {
      expect(createGrave(makeTab(), makePage(), 0, 'id-5', bad).duplicateCount).toBe(1);
    }
  });
});

describe('countDuplicates', () => {
  it('counts tabs with exactly the same url, and never returns less than 1', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://a.example/x' }),
      makeTab({ id: 2, url: 'https://a.example/x' }),
      makeTab({ id: 3, url: 'https://a.example/x#top' }),
      makeTab({ id: 4, url: 'https://A.example/x' }),
    ];
    expect(countDuplicates(tabs, 'https://a.example/x')).toBe(2);
    expect(countDuplicates(tabs, 'https://a.example/x#top')).toBe(1);
    expect(countDuplicates([], 'https://a.example/x')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Property 6: Epitaphs are always valid
// Feature: rest-in-tabs, Property 6
// ---------------------------------------------------------------------------

describe('Property 6: Epitaphs are always valid', () => {
  it('result is never empty', () => {
    fc.assert(
      fc.property(anyPageInfo, (page) => {
        const { text } = fallbackEpitaph(page);
        expect(text.length).toBeGreaterThan(0);
      }),
      { numRuns: 300 },
    );
  });

  it('result has no leading or trailing whitespace', () => {
    fc.assert(
      fc.property(anyPageInfo, (page) => {
        const { text } = fallbackEpitaph(page);
        expect(text).toBe(text.trim());
      }),
      { numRuns: 300 },
    );
  });

  it('result has no internal whitespace runs (all runs collapsed to single space)', () => {
    fc.assert(
      fc.property(anyPageInfo, (page) => {
        const { text } = fallbackEpitaph(page);
        expect(text).not.toMatch(/\s{2,}/);
        expect(text).not.toMatch(/[\t\n\r]/);
      }),
      { numRuns: 300 },
    );
  });

  it('result is at most EPITAPH_MAX Unicode code points', () => {
    fc.assert(
      fc.property(anyPageInfo, (page) => {
        const { text } = fallbackEpitaph(page);
        expect(codePointLength(text)).toBeLessThanOrEqual(EPITAPH_MAX);
      }),
      { numRuns: 300 },
    );
  });

  it('source order: meta before paragraph before title', () => {
    // meta present → use meta
    expect(fallbackEpitaph({ title: 'T', metaDescription: 'Meta', firstParagraph: 'Para' }).source).toBe('meta');
    // meta absent, paragraph present → use paragraph
    expect(fallbackEpitaph({ title: 'T', firstParagraph: 'Para' }).source).toBe('paragraph');
    // only title → use title
    expect(fallbackEpitaph({ title: 'T' }).source).toBe('title');
  });

  it('whitespace-only meta falls through to paragraph', () => {
    const result = fallbackEpitaph({ title: 'T', metaDescription: '   ', firstParagraph: 'Para' });
    expect(result.source).toBe('paragraph');
    expect(result.text).toBe('Para');
  });

  it('all fields empty or whitespace returns "Untitled page" with source title', () => {
    expect(fallbackEpitaph({ title: '' })).toEqual({ text: 'Untitled page', source: 'title' });
    expect(fallbackEpitaph({ title: '  ', metaDescription: '\t', firstParagraph: '\n' }))
      .toEqual({ text: 'Untitled page', source: 'title' });
  });

  it('internal whitespace is collapsed: newlines and tabs become single spaces', () => {
    const result = fallbackEpitaph({ title: 'Hello\n\nWorld\t!' });
    expect(result.text).toBe('Hello World !');
  });

  it('a 200-code-point emoji string is not truncated', () => {
    const text = '😀'.repeat(EPITAPH_MAX); // 200 emoji = 200 code points, 400 UTF-16 units
    const result = fallbackEpitaph({ title: text });
    expect(codePointLength(result.text)).toBe(EPITAPH_MAX);
  });

  it('a 201-code-point string is truncated to exactly 200 code points', () => {
    const text = '💀'.repeat(EPITAPH_MAX + 1);
    const result = fallbackEpitaph({ title: text });
    expect(codePointLength(result.text)).toBe(EPITAPH_MAX);
  });

  it('truncation never splits a surrogate pair', () => {
    // Build a string where the 200th code point is an emoji (2 UTF-16 units).
    // If truncation used .slice(0, 200) it would cut mid-surrogate.
    const prefix = 'a'.repeat(EPITAPH_MAX - 1); // 199 ASCII code points
    const text = prefix + '🪦' + 'extra'; // 🪦 is the 200th code point
    const result = fallbackEpitaph({ title: text });
    expect(codePointLength(result.text)).toBe(EPITAPH_MAX);
    expect(result.text.endsWith('🪦')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addGrave — additional targeted cases
// ---------------------------------------------------------------------------

describe('addGrave — targeted cases', () => {
  it('replaces an existing grave with the same URL', () => {
    const url = 'https://example.com/';
    const original = makeGrave({ url, epitaph: 'Old' });
    const updated = makeGrave({ url, epitaph: 'New' });
    const result = addGrave([original], updated, 100);
    expect(result.length).toBe(1);
    expect(result[0].epitaph).toBe('New');
  });

  it('never mutates the input array', () => {
    const graves = [makeGrave(), makeGrave({ url: 'https://other.com/' })];
    const original = [...graves];
    addGrave(graves, makeGrave({ url: 'https://new.com/' }), 100);
    expect(graves).toEqual(original);
  });

  it('works with an empty input list', () => {
    const grave = makeGrave();
    const result = addGrave([], grave, GRAVE_CAP);
    expect(result).toEqual([grave]);
  });
});
