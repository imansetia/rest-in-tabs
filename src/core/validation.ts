import type { Grave, Stats } from './types.js';

// ---------------------------------------------------------------------------
// Grave validation
// ---------------------------------------------------------------------------

/**
 * A stored Grave that passed isValidGrave. Its duplicateCount has not been
 * checked yet: it may be missing (old graves) or malformed.
 */
export type StoredGrave = Omit<Grave, 'duplicateCount'> & { duplicateCount?: unknown };

/** A Duplicate count is an integer >= 1; anything else counts as 1. */
export function normalizeDuplicateCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1;
}

/**
 * Turn a raw stored value into a Grave, or null when a required field is
 * invalid. A missing or bad duplicateCount never makes a Grave invalid: it
 * becomes 1, so old graves are kept (Requirement 10.4). The next write stores
 * the defaulted value.
 */
export function parseGrave(raw: unknown): Grave | null {
  if (!isValidGrave(raw)) return null;
  return { ...raw, duplicateCount: normalizeDuplicateCount(raw.duplicateCount) };
}

/**
 * Check whether an unknown value has the shape of a valid Grave.
 *
 * A valid Grave must have:
 * - id: string
 * - url: string starting with http:// or https://
 * - title: string
 * - domain: non-empty string
 * - buriedAt: finite number
 * - lastAccessed: finite number
 * - epitaph: non-empty string
 * - epitaphSource: one of 'ai', 'meta', 'paragraph', 'title'
 * - favIconUrl: optional string (any scheme accepted, e.g. https://, data:, chrome://)
 * - excerpt: optional string
 *
 * duplicateCount is deliberately not checked here; parseGrave defaults it.
 * The storage adapter reads graves through parseGrave, so malformed Graves
 * are skipped when read and dropped on the next write.
 */
export function isValidGrave(value: unknown): value is StoredGrave {
  if (value === null || typeof value !== 'object') return false;

  const g = value as Record<string, unknown>;

  // Required string fields.
  if (typeof g.id !== 'string' || g.id === '') return false;
  if (typeof g.url !== 'string' || (!g.url.startsWith('http://') && !g.url.startsWith('https://')))
    return false;
  if (typeof g.title !== 'string') return false;
  if (typeof g.domain !== 'string' || g.domain === '') return false;
  if (typeof g.epitaph !== 'string' || g.epitaph === '') return false;

  // Required number fields.
  if (typeof g.buriedAt !== 'number' || !Number.isFinite(g.buriedAt)) return false;
  if (typeof g.lastAccessed !== 'number' || !Number.isFinite(g.lastAccessed)) return false;

  // epitaphSource must be one of the allowed values.
  if (
    g.epitaphSource !== 'ai' &&
    g.epitaphSource !== 'meta' &&
    g.epitaphSource !== 'paragraph' &&
    g.epitaphSource !== 'title'
  )
    return false;

  // Optional fields.
  if (g.favIconUrl !== undefined && typeof g.favIconUrl !== 'string') return false;

  if (g.excerpt !== undefined && typeof g.excerpt !== 'string') return false;

  return true;
}

// ---------------------------------------------------------------------------
// Stats validation
// ---------------------------------------------------------------------------

/**
 * Normalize stats from storage.
 *
 * Ensures both fields are non-negative integers. Missing or invalid values
 * default to 0.
 */
export function normalizeStats(value: unknown): Stats {
  if (value === null || typeof value !== 'object') {
    return { buried: 0, resurrected: 0 };
  }

  const s = value as Record<string, unknown>;

  const buried =
    typeof s.buried === 'number' && Number.isFinite(s.buried) && Number.isInteger(s.buried) && s.buried >= 0
      ? s.buried
      : 0;

  const resurrected =
    typeof s.resurrected === 'number' &&
    Number.isFinite(s.resurrected) &&
    Number.isInteger(s.resurrected) &&
    s.resurrected >= 0
      ? s.resurrected
      : 0;

  return { buried, resurrected };
}
