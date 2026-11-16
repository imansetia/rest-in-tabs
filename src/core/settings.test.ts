import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeSettings,
  validateSetting,
  DEFAULT_SETTINGS,
  IDLE_MINUTES_MIN,
  IDLE_MINUTES_MAX,
  RETENTION_DAYS_MIN,
  RETENTION_DAYS_MAX,
} from './settings.js';
import type { Settings } from './types.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Produces an integer or a non-integer number, a string, null, undefined, etc. */
const anyScalar = fc.oneof(
  fc.integer(),
  fc.float(),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
);

/** Produces any value that could plausibly appear in storage. */
const anyValue: fc.Arbitrary<unknown> = fc.oneof(
  anyScalar,
  fc.array(anyScalar),
  fc.object(),
  fc.constant({}),
);

/** Produces a plausible (but possibly invalid) settings-shaped object. */
const anyRawSettings: fc.Arbitrary<unknown> = fc.oneof(
  // Completely random value
  anyValue,
  // Object with settings-shaped keys but arbitrary values
  fc.record({
    autoBury: anyScalar,
    idleMinutes: anyScalar,
    protectedSites: fc.oneof(fc.array(anyScalar), anyScalar),
    retentionDays: fc.oneof(fc.integer(), fc.constant(null), anyScalar),
    demo: anyScalar,
  }),
  // Partial object (only some keys present)
  fc.record(
    {
      autoBury: fc.boolean(),
      idleMinutes: fc.integer({ min: 1, max: 2000 }),
      protectedSites: fc.array(fc.string()),
      retentionDays: fc.oneof(fc.integer({ min: 0, max: 400 }), fc.constant(null)),
      demo: fc.boolean(),
    },
    { requiredKeys: [] },
  ),
);

// ---------------------------------------------------------------------------
// Property 10 — Feature: rest-in-tabs
// ---------------------------------------------------------------------------

describe('Property 10: Settings are always in range', () => {
  it('normalizeSettings always returns values inside the allowed ranges', () => {
    fc.assert(
      fc.property(anyRawSettings, (raw) => {
        const s = normalizeSettings(raw);

        expect(typeof s.autoBury).toBe('boolean');

        expect(Number.isInteger(s.idleMinutes)).toBe(true);
        expect(s.idleMinutes).toBeGreaterThanOrEqual(IDLE_MINUTES_MIN);
        expect(s.idleMinutes).toBeLessThanOrEqual(IDLE_MINUTES_MAX);

        expect(Array.isArray(s.protectedSites)).toBe(true);

        if (s.retentionDays !== null) {
          expect(Number.isInteger(s.retentionDays)).toBe(true);
          expect(s.retentionDays).toBeGreaterThanOrEqual(RETENTION_DAYS_MIN);
          expect(s.retentionDays).toBeLessThanOrEqual(RETENTION_DAYS_MAX);
        }

        expect(typeof s.demo).toBe('boolean');
      }),
      { numRuns: 200 },
    );
  });

  it('keeps a boolean demo and turns anything else into false', () => {
    const seen = { keptTrue: 0, keptFalse: 0, defaulted: 0 };
    fc.assert(
      fc.property(anyRawSettings, (raw) => {
        const s = normalizeSettings(raw);
        const stored = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>).demo : undefined;
        if (typeof stored === 'boolean') {
          expect(s.demo).toBe(stored);
          if (stored) seen.keptTrue++;
          else seen.keptFalse++;
        } else {
          expect(s.demo).toBe(false);
          seen.defaulted++;
        }
      }),
      { numRuns: 300 },
    );
    for (const count of Object.values(seen)) expect(count).toBeGreaterThan(0);
  });

  it('normalizeSettings is idempotent', () => {
    fc.assert(
      fc.property(anyRawSettings, (raw) => {
        const once = normalizeSettings(raw);
        const twice = normalizeSettings(once);
        expect(twice).toEqual(once);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// protectedSites cleaning properties
// ---------------------------------------------------------------------------

describe('normalizeSettings — protectedSites cleaning', () => {
  /** Arbitrary that produces strings with leading/trailing whitespace, mixed case, etc. */
  const messySite = fc.oneof(
    fc.string().map((s) => `  ${s}  `),
    fc.string().map((s) => s.toUpperCase()),
    fc.string().map((s) => s.toLowerCase()),
    fc.constant(''),
    fc.constant('   '),
  );

  it('every entry in the result is trimmed, lower-cased and non-empty', () => {
    fc.assert(
      fc.property(fc.array(messySite, { minLength: 0, maxLength: 20 }), (sites) => {
        const s = normalizeSettings({ ...DEFAULT_SETTINGS, protectedSites: sites });
        for (const entry of s.protectedSites) {
          expect(entry).toBe(entry.trim());
          expect(entry).toBe(entry.toLowerCase());
          expect(entry.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('every entry in the result is unique', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 0, maxLength: 30 }), (sites) => {
        const s = normalizeSettings({ ...DEFAULT_SETTINGS, protectedSites: sites });
        const unique = new Set(s.protectedSites);
        expect(s.protectedSites.length).toBe(unique.size);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Mutation-isolation — DEFAULT_SETTINGS is never modified
// ---------------------------------------------------------------------------

describe('normalizeSettings — mutation isolation', () => {
  it('mutating a normalizeSettings result does not change DEFAULT_SETTINGS', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        (extra) => {
          const before = [...DEFAULT_SETTINGS.protectedSites];
          const result = normalizeSettings({ ...DEFAULT_SETTINGS });
          result.protectedSites.push(...extra);
          expect(DEFAULT_SETTINGS.protectedSites).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('mutating a normalizeSettings result when input has no protectedSites does not change DEFAULT_SETTINGS', () => {
    const before = [...DEFAULT_SETTINGS.protectedSites];
    const result = normalizeSettings({});
    result.protectedSites.push('mutated.example.com');
    expect(DEFAULT_SETTINGS.protectedSites).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// validateSetting — spot checks and boundary checks
// ---------------------------------------------------------------------------

describe('validateSetting', () => {
  describe('autoBury', () => {
    it('accepts true and false', () => {
      expect(validateSetting('autoBury', true)).toEqual({ ok: true });
      expect(validateSetting('autoBury', false)).toEqual({ ok: true });
    });
    it('rejects non-booleans', () => {
      for (const v of [1, 'true', null, undefined]) {
        expect(validateSetting('autoBury', v).ok).toBe(false);
      }
    });
  });

  describe('idleMinutes', () => {
    it('accepts boundary values', () => {
      expect(validateSetting('idleMinutes', IDLE_MINUTES_MIN)).toEqual({ ok: true });
      expect(validateSetting('idleMinutes', IDLE_MINUTES_MAX)).toEqual({ ok: true });
    });
    it('rejects one below min and one above max', () => {
      expect(validateSetting('idleMinutes', IDLE_MINUTES_MIN - 1).ok).toBe(false);
      expect(validateSetting('idleMinutes', IDLE_MINUTES_MAX + 1).ok).toBe(false);
    });
    it('rejects non-integers', () => {
      expect(validateSetting('idleMinutes', 30.5).ok).toBe(false);
      expect(validateSetting('idleMinutes', '30').ok).toBe(false);
    });
    it('range message contains the min and max', () => {
      const result = validateSetting('idleMinutes', 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.range).toContain(String(IDLE_MINUTES_MIN));
        expect(result.range).toContain(String(IDLE_MINUTES_MAX));
      }
    });
  });

  describe('protectedSites', () => {
    it('accepts an array of strings', () => {
      expect(validateSetting('protectedSites', [])).toEqual({ ok: true });
      expect(validateSetting('protectedSites', ['example.com'])).toEqual({ ok: true });
    });
    it('rejects a non-array and an array with non-strings', () => {
      expect(validateSetting('protectedSites', 'example.com').ok).toBe(false);
      expect(validateSetting('protectedSites', [1, 2]).ok).toBe(false);
    });
  });

  describe('demo', () => {
    it('defaults to false', () => {
      expect(DEFAULT_SETTINGS.demo).toBe(false);
      expect(normalizeSettings({}).demo).toBe(false);
    });
    it('accepts true and false, rejects anything else', () => {
      expect(validateSetting('demo', true)).toEqual({ ok: true });
      expect(validateSetting('demo', false)).toEqual({ ok: true });
      for (const v of [1, 'true', null, undefined]) {
        expect(validateSetting('demo', v).ok).toBe(false);
      }
    });
  });

  describe('retentionDays', () => {
    it('accepts null', () => {
      expect(validateSetting('retentionDays', null)).toEqual({ ok: true });
    });
    it('accepts boundary values', () => {
      expect(validateSetting('retentionDays', RETENTION_DAYS_MIN)).toEqual({ ok: true });
      expect(validateSetting('retentionDays', RETENTION_DAYS_MAX)).toEqual({ ok: true });
    });
    it('rejects one below min and one above max', () => {
      expect(validateSetting('retentionDays', RETENTION_DAYS_MIN - 1).ok).toBe(false);
      expect(validateSetting('retentionDays', RETENTION_DAYS_MAX + 1).ok).toBe(false);
    });
    it('range message says "Never" and not "null"', () => {
      const result = validateSetting('retentionDays', 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.range).toContain('Never');
        expect(result.range).not.toContain('null');
      }
    });
  });

  it('every setting key either passes or returns a non-empty range string', () => {
    const keys: Array<keyof Settings> = [
      'autoBury',
      'idleMinutes',
      'protectedSites',
      'retentionDays',
      'demo',
    ];
    fc.assert(
      fc.property(fc.constantFrom(...keys), anyValue, (key, value) => {
        const result = validateSetting(key, value);
        if (!result.ok) {
          expect(result.range.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });
});
