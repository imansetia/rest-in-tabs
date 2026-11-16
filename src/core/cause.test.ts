import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { causeOfDeath, formatDuration } from './cause.js';
import type { CauseKind } from './cause.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// Independent oracle: regexes on the path, not the implementation's segment split
// ---------------------------------------------------------------------------

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

const CHECKOUT = /cart|checkout/;
const DRAFT = /(^|\/)(edit|draft|compose)(\/|$)/;
const SIGNUP = /register|signup|sign-up|join/;

function expectedKind(url: string, duplicateCount: number): CauseKind {
  if (duplicateCount > 1) return 'duplicate';
  const path = pathOf(url);
  if (CHECKOUT.test(path)) return 'checkout';
  if (DRAFT.test(path)) return 'draft';
  if (SIGNUP.test(path)) return 'signup';
  return 'neglect';
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const SEGMENTS = [
  'cart', 'Checkout', 'shoppingcart', 'edit', 'EDIT', 'draft', 'compose',
  'editor', 'drafts', 'recompose', 'register', 'SignUp', 'sign-up', 'join', 'joined',
  'docs', 'd', '1x9', 'watch', 'en-US', 'wiki', 'item',
];
const segment = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...SEGMENTS) },
  { weight: 1, arbitrary: fc.stringMatching(/^[a-z0-9-]{1,8}$/) },
);
const parseableUrl = fc
  .tuple(fc.constantFrom('https://', 'http://'), fc.domain(), fc.array(segment, { maxLength: 5 }), fc.boolean())
  .map(([scheme, host, segs, trailingSlash]) => `${scheme}${host}/${segs.join('/')}${trailingSlash ? '/' : ''}`);
const unparseableUrl = fc.constantFrom('', 'not a url', 'https://:invalid', 'http://');
const anyUrl = fc.oneof({ weight: 9, arbitrary: parseableUrl }, { weight: 1, arbitrary: unparseableUrl });

const duplicateCount = fc.oneof(
  { weight: 3, arbitrary: fc.constant(1) },
  { weight: 1, arbitrary: fc.integer({ min: 2, max: 50 }) },
);

/** Biased toward both sides of 1 hour, 47.5 hours (rounds to 48) and 59.5 days (rounds to 60). */
const near = (boundary: number, spread: number) =>
  fc.integer({ min: -spread, max: spread }).map((offset) => boundary + offset);
const anyInterval = fc.oneof(
  fc.integer({ min: -DAY, max: -1 }),
  near(HOUR, 60_000),
  near(47.5 * HOUR, 60_000),
  near(59.5 * DAY, HOUR),
  fc.integer({ min: 0, max: 3 * HOUR }),
  fc.integer({ min: 0, max: 400 * DAY }),
);

// ---------------------------------------------------------------------------
// Property 11
// Feature: rest-in-tabs, Property 11
// ---------------------------------------------------------------------------

describe('Property 11: Cause of death follows the fixed rules', () => {
  it('picks the first matching rule and fills only N and D into its template', () => {
    const kinds: Record<CauseKind, number> = { duplicate: 0, checkout: 0, draft: 0, signup: 0, neglect: 0 };
    let severalPathRules = 0;
    let duplicateOverPath = 0;
    let draftNearMiss = 0;
    let unparseable = 0;

    fc.assert(
      fc.property(anyUrl, duplicateCount, fc.integer({ min: 400 * DAY, max: 2_000_000_000_000 }), anyInterval,
        (url, dup, buriedAt, interval) => {
          const lastAccessed = buriedAt - interval;
          const result = causeOfDeath({ url, buriedAt, lastAccessed, duplicateCount: dup });
          const kind = expectedKind(url, dup);

          const path = pathOf(url);
          const pathRules = [CHECKOUT, DRAFT, SIGNUP].filter((re) => re.test(path)).length;
          kinds[kind]++;
          if (dup === 1 && pathRules > 1) severalPathRules++;
          if (dup > 1 && pathRules > 0) duplicateOverPath++;
          if (/(^|\/)(editor|drafts|recompose)(\/|$)/.test(path) && !DRAFT.test(path)) draftNearMiss++;
          if (path === '') unparseable++;

          expect(result.kind).toBe(kind);
          const expectedText = {
            duplicate: `Died a duplicate. ${dup} identical tabs were open.`,
            checkout: 'Abandoned at checkout.',
            draft: 'Abandoned mid-draft.',
            signup: 'Abandoned during sign-up.',
            neglect: `Died of neglect. Unvisited for ${formatDuration(interval)}.`,
          }[kind];
          expect(result.text).toBe(expectedText);
        }),
      { numRuns: 400 },
    );

    for (const count of Object.values(kinds)) expect(count).toBeGreaterThan(0);
    expect(severalPathRules).toBeGreaterThan(0);
    expect(duplicateOverPath).toBeGreaterThan(0);
    expect(draftNearMiss).toBeGreaterThan(0);
    expect(unparseable).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Property 12
// Feature: rest-in-tabs, Property 12
// ---------------------------------------------------------------------------

/** Read a formatted duration back as milliseconds, to compare lengths. */
function shownMs(text: string): number {
  if (text === 'less than an hour') return 0;
  const m = /^(\d+) (hours?|days|months)$/.exec(text);
  if (m === null) throw new Error(`Unexpected duration: ${text}`);
  const n = Number(m[1]);
  return m[2].startsWith('hour') ? n * HOUR : m[2] === 'days' ? n * DAY : n * 30 * DAY;
}

describe('Property 12: Durations use the right unit and never shrink', () => {
  it('uses the unit given by the rounded hour and day counts', () => {
    const seen = { less: 0, hours: 0, days: 0, months: 0, negative: 0 };

    fc.assert(
      fc.property(anyInterval, (ms) => {
        const text = formatDuration(ms);
        const safe = ms > 0 ? ms : 0;
        const hours = Math.round(safe / HOUR);
        const days = Math.round(safe / DAY);
        if (ms < 0) seen.negative++;

        if (safe < HOUR) {
          seen.less++;
          expect(text).toBe('less than an hour');
        } else if (hours < 48) {
          seen.hours++;
          expect(text).toBe(hours === 1 ? '1 hour' : `${hours} hours`);
        } else if (days < 60) {
          seen.days++;
          expect(text).toBe(`${days} days`);
        } else {
          seen.months++;
          expect(text).toBe(`${Math.round(days / 30)} months`);
        }
      }),
      { numRuns: 400 },
    );

    for (const count of Object.values(seen)) expect(count).toBeGreaterThan(0);
  });

  it('a longer interval never shows a shorter duration', () => {
    fc.assert(
      fc.property(anyInterval, anyInterval, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(shownMs(formatDuration(hi))).toBeGreaterThanOrEqual(shownMs(formatDuration(lo)));
      }),
      { numRuns: 400 },
    );
  });
});

// ---------------------------------------------------------------------------
// Targeted examples (steering file and mockup data)
// ---------------------------------------------------------------------------

describe('causeOfDeath — examples', () => {
  const at = 1_700_000_000_000;
  const cause = (url: string, idleMs = 3 * DAY, duplicateCount = 1) =>
    causeOfDeath({ url, buriedAt: at, lastAccessed: at - idleMs, duplicateCount }).text;

  it('matches the mockup graves', () => {
    expect(cause('https://ikea.com/us/en/shoppingcart')).toBe('Abandoned at checkout.');
    expect(cause('https://docs.google.com/document/d/1x9/edit')).toBe('Abandoned mid-draft.');
    expect(cause('https://duolingo.com/register')).toBe('Abandoned during sign-up.');
    expect(cause('https://github.com/acme/web/pull/482', 30 * HOUR, 3)).toBe('Died a duplicate. 3 identical tabs were open.');
    expect(cause('https://example.com/article')).toBe('Died of neglect. Unvisited for 3 days.');
  });

  it('counts only whole draft segments', () => {
    expect(cause('https://example.com/editor')).toBe('Died of neglect. Unvisited for 3 days.');
    expect(cause('https://example.com/Compose/')).toBe('Abandoned mid-draft.');
  });

  it('a duplicate wins over any path rule; an unparseable URL can only be neglect or duplicate', () => {
    expect(cause('https://shop.example.com/checkout', DAY, 2)).toBe('Died a duplicate. 2 identical tabs were open.');
    expect(cause('https://:invalid', 2 * HOUR)).toBe('Died of neglect. Unvisited for 2 hours.');
  });
});

describe('formatDuration — boundaries', () => {
  it('formats each unit edge', () => {
    expect(formatDuration(-5 * HOUR)).toBe('less than an hour');
    expect(formatDuration(HOUR - 1)).toBe('less than an hour');
    expect(formatDuration(HOUR)).toBe('1 hour');
    expect(formatDuration(47.5 * HOUR - 1)).toBe('47 hours');
    expect(formatDuration(47.5 * HOUR)).toBe('2 days');
    expect(formatDuration(59.5 * DAY - 1)).toBe('59 days');
    expect(formatDuration(59.5 * DAY)).toBe('2 months');
  });
});
