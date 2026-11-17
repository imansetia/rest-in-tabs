// Demo clock (task 15.1, Requirements 8.5, 8.6). Pure. It only shifts the time
// the Graveyard displays with; burial, expiry, statistics and storage always
// use the real time, and the offset is never saved or sent anywhere.

export const DEMO_DAYS_MAX = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The slider's value as whole days, 0 to 14 (anything else becomes 0 or is clamped). */
export function parseDemoDays(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(DEMO_DAYS_MAX, Math.max(0, Math.round(n)));
}

/** The time the Graveyard displays with: the real time moved forward by `days`. */
export function demoNow(realNow: number, days: number): number {
  return realNow + parseDemoDays(days) * DAY_MS;
}

/** "+0 days", "+1 day", "+14 days", as the mockup's clock output. */
export function demoLabel(days: number): string {
  const d = parseDemoDays(days);
  return `+${d} ${d === 1 ? 'day' : 'days'}`;
}
