// Options page form logic (task 12, Requirement 8). Pure: the page reads and
// writes the inputs; these decide what the values mean and what to say.

export type IdleUnit = 'minutes' | 'hours' | 'days';

export const UNIT_MINUTES: Readonly<Record<IdleUnit, number>> = { minutes: 1, hours: 60, days: 1440 };
const UNITS_LARGEST_FIRST: readonly IdleUnit[] = ['days', 'hours', 'minutes'];

/** The Idle Threshold as shown: the largest unit that divides it evenly (180 → 3 hours). */
export function idleForDisplay(minutes: number): { amount: number; unit: IdleUnit } {
  const unit = UNITS_LARGEST_FIRST.find((u) => minutes % UNIT_MINUTES[u] === 0) ?? 'minutes';
  return { amount: minutes / UNIT_MINUTES[unit], unit };
}

/**
 * Minutes from what the user typed (1.5 hours → 90). Float noise is rounded
 * away (0.35 days → 504, not 504.00000000000006); a real fraction of a minute
 * stays a fraction, so validateSetting rejects it. NaN stays NaN.
 */
export function idleMinutesFrom(amount: number, unit: IdleUnit): number {
  const minutes = amount * UNIT_MINUTES[unit];
  const whole = Math.round(minutes);
  return Math.abs(minutes - whole) < 1e-9 ? whole : minutes;
}

export function parseIdleUnit(value: string): IdleUnit {
  return value === 'hours' || value === 'days' ? value : 'minutes';
}

/** Inline error under a field, from validateSetting's range (Requirement 8.3). */
export function rangeErrorText(range: string): string {
  return `Allowed: ${range}.`;
}

export const SITE_ERROR = {
  empty: 'Enter a site such as example.com.',
  invalid: 'Enter a site such as example.com.',
  scheme: 'Only websites (http or https) can be protected.',
  duplicate: 'This site is already on the list.',
} as const;

export type SiteResult = { ok: true; domain: string } | { ok: false; error: string };

/**
 * A Protected Sites entry from what the user typed: a domain ("Docs.Example.com")
 * or a whole address ("https://docs.example.com/a?b"). Kept: the lower-cased
 * hostname, in the same form as a tab's hostname (punycode, no trailing dot),
 * so the comparison in isProtected matches. `existing` is the current list.
 */
export function parseSiteEntry(text: string, existing: readonly string[]): SiteResult {
  const typed = text.trim();
  if (typed === '') return { ok: false, error: SITE_ERROR.empty };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) && !/^[^:/]+:\d+(\/|$)/.test(typed); // "host:8080" is not a scheme
  let url: URL;
  try {
    url = new URL(hasScheme ? typed : `http://${typed}`);
  } catch {
    return { ok: false, error: SITE_ERROR.invalid };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: SITE_ERROR.scheme };
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!/[a-z0-9]/.test(domain)) return { ok: false, error: SITE_ERROR.invalid };
  if (existing.includes(domain)) return { ok: false, error: SITE_ERROR.duplicate };
  return { ok: true, domain };
}
