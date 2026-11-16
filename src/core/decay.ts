import type { Grave } from './types.js';
import { EST_MB_PER_TAB } from './types.js';

// ---------------------------------------------------------------------------
// Decay stages
// ---------------------------------------------------------------------------

export type DecayStage = 'fresh' | 'weathered' | 'crumbling';

/**
 * Compute the decay stage of a Grave based on its age.
 *
 * Rules:
 * - Fresh: less than 1 day old (age < 86_400_000 ms)
 * - Weathered: 1 day up to 7 days old (86_400_000 ms <= age < 604_800_000 ms)
 * - Crumbling: more than 7 days old (age >= 604_800_000 ms)
 *
 * Validates: Requirement 6.1
 */
export function decayStage(buriedAt: number, now: number): DecayStage {
  const age = now - buriedAt;
  const ONE_DAY = 86_400_000; // 24 * 60 * 60 * 1000
  const SEVEN_DAYS = 604_800_000; // 7 * ONE_DAY

  if (age < ONE_DAY) return 'fresh';
  if (age < SEVEN_DAYS) return 'weathered';
  return 'crumbling';
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/**
 * Filter Graves to those that have expired (older than the retention period).
 *
 * Rules:
 * - When `retentionDays` is `null`, nothing expires (return empty array).
 * - Otherwise, a Grave is expired when `now - buriedAt > retentionDays * 86_400_000`.
 *
 * Validates: Requirements 6.3, 6.4
 */
export function expiredGraves(
  graves: Grave[],
  retentionDays: number | null,
  now: number,
): Grave[] {
  if (retentionDays === null) return [];

  const maxAge = retentionDays * 86_400_000; // days to milliseconds
  return graves.filter((g) => now - g.buriedAt > maxAge);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort Graves from most recently buried to least recently buried.
 *
 * Returns a new array; the input is not mutated.
 *
 * Validates: Requirement 4.2
 */
export function sortGraves(graves: Grave[]): Grave[] {
  return [...graves].sort((a, b) => b.buriedAt - a.buriedAt);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Filter Graves to those matching the search query (case-insensitive).
 *
 * A Grave matches when its title, domain, or epitaph contains the query
 * string (ignoring letter case). An empty query matches all Graves.
 *
 * Validates: Requirement 4.3
 */
export function searchGraves(graves: Grave[], query: string): Grave[] {
  if (query === '') return graves;

  const lowerQuery = query.toLowerCase();
  return graves.filter((g) => {
    return (
      g.title.toLowerCase().includes(lowerQuery) ||
      g.domain.toLowerCase().includes(lowerQuery) ||
      g.epitaph.toLowerCase().includes(lowerQuery)
    );
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Estimate the memory freed (in megabytes) from the number of buried tabs.
 *
 * Uses EST_MB_PER_TAB (50 MB) as a rough estimate.
 *
 * Validates: Requirement 7.1
 */
export function estimateFreedMb(buried: number): number {
  return buried * EST_MB_PER_TAB;
}
