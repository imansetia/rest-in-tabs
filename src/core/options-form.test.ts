import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { idleForDisplay, idleMinutesFrom, parseIdleUnit, rangeErrorText, parseSiteEntry, SITE_ERROR, UNIT_MINUTES } from './options-form.js';
import { validateSetting, IDLE_MINUTES_MIN, IDLE_MINUTES_MAX, DEFAULT_SETTINGS } from './settings.js';
import { isProtected } from './selection.js';

describe('idleForDisplay', () => {
  it('uses the largest unit that divides evenly', () => {
    expect(idleForDisplay(DEFAULT_SETTINGS.idleMinutes)).toEqual({ amount: 3, unit: 'hours' });
    expect(idleForDisplay(IDLE_MINUTES_MAX)).toEqual({ amount: 7, unit: 'days' });
    expect(idleForDisplay(IDLE_MINUTES_MIN)).toEqual({ amount: 5, unit: 'minutes' });
    expect(idleForDisplay(90)).toEqual({ amount: 90, unit: 'minutes' });
    expect(idleForDisplay(1440)).toEqual({ amount: 1, unit: 'days' });
  });

  it('round-trips every allowed value through the form', () => {
    fc.assert(
      fc.property(fc.integer({ min: IDLE_MINUTES_MIN, max: IDLE_MINUTES_MAX }), (minutes) => {
        const { amount, unit } = idleForDisplay(minutes);
        expect(Number.isInteger(amount)).toBe(true);
        expect(idleMinutesFrom(amount, unit)).toBe(minutes);
      }),
      { numRuns: 300 },
    );
  });
});

describe('idleMinutesFrom', () => {
  it('converts, rounding float noise away but keeping real fractions', () => {
    expect(idleMinutesFrom(1.5, 'hours')).toBe(90);
    // Both products carry float noise (504.00000000000006, 122.99999999999999).
    expect(0.35 * 1440).not.toBe(504);
    expect(2.05 * 60).not.toBe(123);
    expect(idleMinutesFrom(0.35, 'days')).toBe(504);
    expect(idleMinutesFrom(2.05, 'hours')).toBe(123);
    expect(idleMinutesFrom(7, 'days')).toBe(10080);
    expect(idleMinutesFrom(2.5, 'minutes')).toBe(2.5);
    expect(Number.isNaN(idleMinutesFrom(Number.NaN, 'hours'))).toBe(true);
  });

  it('so validateSetting rejects what is outside 5 minutes to 7 days, and fractions of a minute', () => {
    expect(validateSetting('idleMinutes', idleMinutesFrom(4, 'minutes')).ok).toBe(false);
    expect(validateSetting('idleMinutes', idleMinutesFrom(8, 'days')).ok).toBe(false);
    expect(validateSetting('idleMinutes', idleMinutesFrom(2.5, 'minutes')).ok).toBe(false);
    expect(validateSetting('idleMinutes', idleMinutesFrom(2.05, 'hours')).ok).toBe(true);
  });
});

describe('parseIdleUnit and rangeErrorText', () => {
  it('only knows the three units', () => {
    expect(parseIdleUnit('hours')).toBe('hours');
    expect(parseIdleUnit('days')).toBe('days');
    expect(parseIdleUnit('weeks')).toBe('minutes');
    expect(Object.keys(UNIT_MINUTES)).toEqual(['minutes', 'hours', 'days']);
  });

  it('shows the allowed range from validateSetting', () => {
    const idle = validateSetting('idleMinutes', 1);
    const keep = validateSetting('retentionDays', 0);
    expect(!idle.ok && rangeErrorText(idle.range)).toBe('Allowed: 5 minutes to 7 days.');
    expect(!keep.ok && rangeErrorText(keep.range)).toBe('Allowed: 1 to 365 days, or Never.');
  });
});

describe('parseSiteEntry', () => {
  it('keeps the lower-cased hostname of a domain or a whole address', () => {
    expect(parseSiteEntry('  Docs.Example.COM ', [])).toEqual({ ok: true, domain: 'docs.example.com' });
    expect(parseSiteEntry('https://www.Example.com/a/b?c=1#d', [])).toEqual({ ok: true, domain: 'www.example.com' });
    expect(parseSiteEntry('example.com/path', [])).toEqual({ ok: true, domain: 'example.com' });
    expect(parseSiteEntry('localhost:3000', [])).toEqual({ ok: true, domain: 'localhost' });
    expect(parseSiteEntry('example.com.', [])).toEqual({ ok: true, domain: 'example.com' });
    expect(parseSiteEntry('bücher.de', [])).toEqual({ ok: true, domain: 'xn--bcher-kva.de' }); // as a tab's hostname
  });

  it('explains what is wrong', () => {
    expect(parseSiteEntry('   ', [])).toEqual({ ok: false, error: SITE_ERROR.empty });
    expect(parseSiteEntry('exa mple.com', [])).toEqual({ ok: false, error: SITE_ERROR.invalid });
    expect(parseSiteEntry('chrome://extensions', [])).toEqual({ ok: false, error: SITE_ERROR.scheme });
    expect(parseSiteEntry('ftp://files.example.com', [])).toEqual({ ok: false, error: SITE_ERROR.scheme });
    expect(parseSiteEntry('Example.com', ['example.com'])).toEqual({ ok: false, error: SITE_ERROR.duplicate });
  });

  it('a protected entry protects tabs on that site and its subdomains', () => {
    fc.assert(
      fc.property(fc.domain(), fc.constantFrom('', 'www.', 'docs.'), fc.webPath(), (domain, sub, path) => {
        const parsed = parseSiteEntry(domain.toUpperCase(), []);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const tab = { id: 1, url: `https://${sub}${domain}${path}`, title: '', active: false, pinned: false, audible: false, incognito: false, lastAccessed: 0 };
        expect(isProtected(tab, [parsed.domain])).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
