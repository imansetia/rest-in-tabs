import type { Settings } from './types.js';

// ---------------------------------------------------------------------------
// Allowed ranges (single source of truth used by both functions)
// ---------------------------------------------------------------------------

export const IDLE_MINUTES_MIN = 5;
export const IDLE_MINUTES_MAX = 10080; // 7 days
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 365;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  autoBury: true,
  idleMinutes: 180, // 3 hours
  protectedSites: [],
  retentionDays: 30,
};

// ---------------------------------------------------------------------------
// normalizeSettings
// ---------------------------------------------------------------------------

/**
 * Coerce an unknown value (e.g. from storage) into a valid Settings object.
 *
 * Rules:
 * - Missing or non-boolean `autoBury` → default (true).
 * - `idleMinutes` outside 5–10080 or non-integer → clamped/defaulted.
 * - `protectedSites` non-array → default ([]); non-string entries are dropped.
 *   String entries are trimmed, lower-cased, deduplicated and empty strings dropped.
 * - `retentionDays` null → kept as null ("Never").
 *   Non-null outside 1–365 or non-integer → clamped/defaulted.
 *
 * The function is idempotent: normalizeSettings(normalizeSettings(x)) ≡ normalizeSettings(x).
 */
export function normalizeSettings(raw: unknown): Settings {
  const src = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  // autoBury
  const autoBury =
    typeof src['autoBury'] === 'boolean' ? src['autoBury'] : DEFAULT_SETTINGS.autoBury;

  // idleMinutes
  const idleMinutes = clampInt(
    src['idleMinutes'],
    IDLE_MINUTES_MIN,
    IDLE_MINUTES_MAX,
    DEFAULT_SETTINGS.idleMinutes,
  );

  // protectedSites — always a fresh array; entries are trimmed, lower-cased,
  // deduplicated and emptied strings are dropped.
  const rawSites = src['protectedSites'];
  const protectedSites = Array.isArray(rawSites)
    ? normalizeProtectedSites(rawSites)
    : [];

  // retentionDays
  let retentionDays: number | null;
  if (src['retentionDays'] === null) {
    retentionDays = null;
  } else {
    retentionDays = clampInt(
      src['retentionDays'],
      RETENTION_DAYS_MIN,
      RETENTION_DAYS_MAX,
      DEFAULT_SETTINGS.retentionDays as number,
    );
  }

  return { autoBury, idleMinutes, protectedSites, retentionDays };
}

// ---------------------------------------------------------------------------
// validateSetting
// ---------------------------------------------------------------------------

type ValidateOk = { ok: true };
type ValidateErr = { ok: false; range: string };
type ValidateResult = ValidateOk | ValidateErr;

/**
 * Check whether a proposed value for a single setting key is within the
 * allowed range. Returns `{ ok: true }` on success, or
 * `{ ok: false, range: string }` describing the allowed range on failure.
 *
 * This is used by the Options page to show inline errors before saving.
 */
export function validateSetting(key: keyof Settings, value: unknown): ValidateResult {
  switch (key) {
    case 'autoBury':
      if (typeof value === 'boolean') return OK;
      return err('true or false');

    case 'idleMinutes':
      if (isInt(value) && (value as number) >= IDLE_MINUTES_MIN && (value as number) <= IDLE_MINUTES_MAX)
        return OK;
      return err(`${IDLE_MINUTES_MIN}–${IDLE_MINUTES_MAX} minutes`);

    case 'protectedSites':
      if (Array.isArray(value) && value.every((s) => typeof s === 'string')) return OK;
      return err('an array of domain strings');

    case 'retentionDays':
      if (value === null) return OK;
      if (
        isInt(value) &&
        (value as number) >= RETENTION_DAYS_MIN &&
        (value as number) <= RETENTION_DAYS_MAX
      )
        return OK;
      return err(`${RETENTION_DAYS_MIN}–${RETENTION_DAYS_MAX} days, or Never`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OK: ValidateOk = { ok: true };

function err(range: string): ValidateErr {
  return { ok: false, range };
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (!isInt(v)) return fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Trim, lower-case, drop empties, deduplicate — always returns a new array. */
function normalizeProtectedSites(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().toLowerCase();
    if (cleaned === '' || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}
