import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isProtected, canBuryManually, selectBurialCandidates } from './selection.js';
import { DEFAULT_SETTINGS } from './settings.js';
import type { TabInfo, Settings } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTab(overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    id: 1,
    url: 'https://example.com/',
    title: 'Example',
    active: false,
    pinned: false,
    audible: false,
    incognito: false,
    lastAccessed: 0,
    ...overrides,
  };
}

/**
 * Parse the hostname from a URL the same way isProtected does:
 * lower-case and strip one trailing dot.
 * Returns null if the URL is not parseable.
 */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/**
 * Given a hostname like "docs.example.com", return "example.com"
 * (strip the first label). Returns the original if there is no dot.
 */
function parentDomain(host: string): string {
  const dot = host.indexOf('.');
  return dot === -1 ? host : host.slice(dot + 1);
}

/**
 * Compute whether a tab is protected using only tab fields and the
 * protectedSites list — WITHOUT calling isProtected. Used in Property 2
 * so the test does not simply re-invoke the function under test.
 */
function tabIsProtectedIndependently(tab: TabInfo, protectedSites: string[]): boolean {
  if (tab.active || tab.pinned || tab.audible || tab.incognito) return true;
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return true;
  const host = hostnameOf(tab.url);
  if (host === null) return true; // unparseable
  return protectedSites.some((entry) => host === entry || host.endsWith('.' + entry));
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid http(s) URL. */
const httpUrl = fc.oneof(
  fc.constant('http://example.com/page'),
  fc.constant('https://example.com/page'),
  fc.constant('https://docs.example.com/page'),
  fc.constant('https://notexample.com/page'),
  fc.webUrl({ validSchemes: ['http', 'https'] }),
);

/** A non-http(s) URL. */
const nonHttpUrl = fc.oneof(
  fc.constant('chrome://newtab/'),
  fc.constant('about:blank'),
  fc.constant('file:///home/user/notes.txt'),
  fc.constant('ftp://files.example.com/'),
);

const anyUrl = fc.oneof(httpUrl, nonHttpUrl);

/** Arbitrary TabInfo with randomised protection-relevant fields. */
const anyTab: fc.Arbitrary<TabInfo> = fc.record<TabInfo>({
  id: fc.integer({ min: 1 }),
  url: anyUrl,
  title: fc.string(),
  favIconUrl: fc.option(fc.webUrl(), { nil: undefined }),
  active: fc.boolean(),
  pinned: fc.boolean(),
  audible: fc.boolean(),
  incognito: fc.boolean(),
  lastAccessed: fc.integer({ min: 0 }),
});

/** Arbitrary valid Settings with autoBury on and no protected sites. */
const settingsOn: fc.Arbitrary<Settings> = fc.record<Settings>({
  autoBury: fc.constant(true),
  idleMinutes: fc.integer({ min: 5, max: 10080 }), // 5 minutes to 7 days
  protectedSites: fc.constant([]),
  retentionDays: fc.oneof(fc.integer({ min: 1, max: 365 }), fc.constant(null)),
});

/**
 * Given an array of tabs, build a protectedSites list that is derived from
 * the actual hostnames in those tabs. For each http(s) tab, we either:
 *   - protect the exact hostname, or
 *   - protect a parent domain of the hostname.
 * This guarantees that the generated sites match real tab URLs, so the
 * domain-match branch of isProtected is actually exercised.
 *
 * Returns { protectedSites, protectedTabIds } where protectedTabIds is the
 * set of tab IDs whose hostname matched an entry we added.
 */
function deriveProtectedSites(
  tabs: TabInfo[],
  picks: Array<{ tabIndex: number; useParent: boolean }>,
): { protectedSites: string[]; protectedTabIds: Set<number> } {
  const seen = new Set<string>();
  const addedEntries: string[] = [];
  const protectedTabIds = new Set<number>();

  for (const { tabIndex, useParent } of picks) {
    const tab = tabs[tabIndex];
    if (!tab) continue;
    const host = hostnameOf(tab.url);
    if (!host) continue;
    const entry = useParent ? parentDomain(host) : host;
    if (!seen.has(entry)) {
      seen.add(entry);
      addedEntries.push(entry);
    }
  }

  // Now mark every tab whose hostname matches any added entry as protected.
  for (const tab of tabs) {
    const host = hostnameOf(tab.url);
    if (!host) continue;
    if (addedEntries.some((entry) => host === entry || host.endsWith('.' + entry))) {
      protectedTabIds.add(tab.id);
    }
  }

  return { protectedSites: addedEntries, protectedTabIds };
}

// ---------------------------------------------------------------------------
// Property 1 — Protected tabs are never selected
// Feature: rest-in-tabs, Property 1
// ---------------------------------------------------------------------------

describe('Property 1: Protected tabs are never selected', () => {
  it('never returns an active, pinned, audible, incognito, or non-http(s) tab', () => {
    fc.assert(
      fc.property(fc.array(anyTab), settingsOn, fc.integer({ min: 0 }), (tabs, settings, now) => {
        const result = selectBurialCandidates(tabs, settings, now);
        for (const tab of result) {
          expect(tab.active).toBe(false);
          expect(tab.pinned).toBe(false);
          expect(tab.audible).toBe(false);
          expect(tab.incognito).toBe(false);
          expect(tab.url.startsWith('http://') || tab.url.startsWith('https://')).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('never returns a tab whose hostname matches a protected site derived from the tab list', () => {
    // Build protectedSites from the actual tab hostnames so the domain-matching
    // branch is genuinely exercised. Track how many runs had at least one match.
    let runsWithMatch = 0;

    fc.assert(
      fc.property(
        fc.array(anyTab, { minLength: 1, maxLength: 10 }),
        // For each tab position, decide whether to add it and whether to use the parent domain.
        fc.array(
          fc.record({ tabIndex: fc.nat({ max: 9 }), useParent: fc.boolean() }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.integer({ min: 0, max: 1_000_000_000_000 }),
        (tabs, picks, now) => {
          const { protectedSites, protectedTabIds } = deriveProtectedSites(tabs, picks);
          if (protectedTabIds.size > 0) runsWithMatch++;

          const settings: Settings = {
            ...DEFAULT_SETTINGS,
            autoBury: true,
            protectedSites,
          };
          const result = selectBurialCandidates(tabs, settings, now);

          for (const tab of result) {
            const host = hostnameOf(tab.url);
            if (host === null) continue;
            for (const entry of protectedSites) {
              expect(host === entry || host.endsWith('.' + entry)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 500 },
    );

    // Verify the domain-matching branch was actually hit in a meaningful number of runs.
    expect(runsWithMatch).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Selection is exactly the idle, unprotected tabs
// Feature: rest-in-tabs, Property 2
// ---------------------------------------------------------------------------

describe('Property 2: Selection is exactly the idle, unprotected tabs', () => {
  it('result equals exactly the tabs that are not protected and are idle, in input order', () => {
    let runsWithMatch = 0;

    fc.assert(
      fc.property(
        fc.array(anyTab, { minLength: 0, maxLength: 15 }),
        fc.array(
          fc.record({ tabIndex: fc.nat({ max: 14 }), useParent: fc.boolean() }),
          { minLength: 0, maxLength: 5 },
        ),
        fc.integer({ min: 5, max: 1440 }), // idleMinutes
        fc.integer({ min: 0, max: 1_000_000_000_000 }), // now
        (tabs, picks, idleMinutes, now) => {
          const { protectedSites, protectedTabIds } = deriveProtectedSites(tabs, picks);
          if (protectedTabIds.size > 0) runsWithMatch++;

          const settings: Settings = {
            autoBury: true,
            idleMinutes,
            protectedSites,
            retentionDays: 30,
          };

          const result = selectBurialCandidates(tabs, settings, now);

          // Compute the expected list independently from tab fields — do NOT call isProtected.
          const idleMs = idleMinutes * 60_000;
          const expected = tabs.filter((tab) => {
            if (!tabIsProtectedIndependently(tab, protectedSites) &&
                now - tab.lastAccessed >= idleMs) {
              return true;
            }
            return false;
          });

          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 300 },
    );

    expect(runsWithMatch).toBeGreaterThan(30);
  });

  it('a tab exactly at the idle threshold is selected', () => {
    const idleMinutes = 30;
    const now = 10_000 * 60_000;
    const lastAccessed = now - idleMinutes * 60_000;
    const tab = makeTab({ lastAccessed });
    const settings: Settings = { ...DEFAULT_SETTINGS, autoBury: true, idleMinutes };
    expect(selectBurialCandidates([tab], settings, now)).toContain(tab);
  });

  it('a tab one millisecond short of the threshold is NOT selected', () => {
    const idleMinutes = 30;
    const now = 10_000 * 60_000;
    const lastAccessed = now - idleMinutes * 60_000 + 1;
    const tab = makeTab({ lastAccessed });
    const settings: Settings = { ...DEFAULT_SETTINGS, autoBury: true, idleMinutes };
    expect(selectBurialCandidates([tab], settings, now)).not.toContain(tab);
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Auto-Bury off selects nothing
// Feature: rest-in-tabs, Property 3
// ---------------------------------------------------------------------------

describe('Property 3: Auto-Bury off selects nothing', () => {
  it('returns [] for any tabs and time when autoBury is false', () => {
    fc.assert(
      fc.property(
        fc.array(anyTab),
        settingsOn.map((s) => ({ ...s, autoBury: false })),
        fc.integer({ min: 0 }),
        (tabs, settings, now) => {
          expect(selectBurialCandidates(tabs, settings, now)).toEqual([]);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// isProtected — targeted examples
// ---------------------------------------------------------------------------

describe('isProtected — targeted examples', () => {
  it('protects an active tab', () => {
    expect(isProtected(makeTab({ active: true }), [])).toBe(true);
  });

  it('protects a pinned tab', () => {
    expect(isProtected(makeTab({ pinned: true }), [])).toBe(true);
  });

  it('protects an audible tab', () => {
    expect(isProtected(makeTab({ audible: true }), [])).toBe(true);
  });

  it('protects an incognito tab', () => {
    expect(isProtected(makeTab({ incognito: true }), [])).toBe(true);
  });

  it('protects a non-http(s) URL', () => {
    expect(isProtected(makeTab({ url: 'chrome://settings/' }), [])).toBe(true);
    expect(isProtected(makeTab({ url: 'about:blank' }), [])).toBe(true);
    expect(isProtected(makeTab({ url: 'file:///notes.txt' }), [])).toBe(true);
  });

  it('protects an exact domain match', () => {
    expect(isProtected(makeTab({ url: 'https://example.com/' }), ['example.com'])).toBe(true);
  });

  it('protects a subdomain of a listed domain', () => {
    expect(isProtected(makeTab({ url: 'https://docs.example.com/' }), ['example.com'])).toBe(true);
    expect(isProtected(makeTab({ url: 'https://a.b.example.com/' }), ['example.com'])).toBe(true);
  });

  it('does NOT protect a look-alike domain (notexample.com vs example.com)', () => {
    expect(isProtected(makeTab({ url: 'https://notexample.com/' }), ['example.com'])).toBe(false);
    expect(isProtected(makeTab({ url: 'https://myexample.com/' }), ['example.com'])).toBe(false);
  });

  it('protects a trailing-dot hostname ("example.com." matches entry "example.com")', () => {
    const tab = makeTab({ url: 'http://example.com./' });
    expect(isProtected(tab, ['example.com'])).toBe(true);
  });

  it('does not protect an unprotected http(s) tab with empty protectedSites', () => {
    expect(isProtected(makeTab({ url: 'https://example.com/' }), [])).toBe(false);
  });

  it('URL parse failure is treated as protected (even with empty protectedSites)', () => {
    const tab: TabInfo = { ...makeTab(), url: 'https://:invalid' };
    expect(isProtected(tab, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canBuryManually — targeted examples
// ---------------------------------------------------------------------------

describe('canBuryManually — targeted examples', () => {
  it('allows an active http(s) tab', () => {
    expect(canBuryManually(makeTab({ active: true }))).toBe(true);
  });

  it('allows a pinned http(s) tab', () => {
    expect(canBuryManually(makeTab({ pinned: true }))).toBe(true);
  });

  it('allows an audible http(s) tab', () => {
    expect(canBuryManually(makeTab({ audible: true }))).toBe(true);
  });

  it('blocks an incognito tab', () => {
    expect(canBuryManually(makeTab({ incognito: true }))).toBe(false);
  });

  it('blocks a non-http(s) URL', () => {
    expect(canBuryManually(makeTab({ url: 'chrome://newtab/' }))).toBe(false);
    expect(canBuryManually(makeTab({ url: 'about:blank' }))).toBe(false);
  });

  it('allows a tab on a protected site (Protected Sites bypassed for manual)', () => {
    expect(canBuryManually(makeTab({ url: 'https://example.com/' }))).toBe(true);
  });

  it('blocks a tab with an unparseable URL', () => {
    expect(canBuryManually(makeTab({ url: 'not-a-valid-url' }))).toBe(false);
  });
});
