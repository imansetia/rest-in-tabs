import type { PageInfo, Grave, EpitaphSource, TabInfo } from './types.js';
import { EPITAPH_MAX, EXCERPT_MAX } from './types.js';
import { hostnameOf } from './url-utils.js';
import { normalizeDuplicateCount } from './validation.js';

// ---------------------------------------------------------------------------
// fallbackEpitaph
// ---------------------------------------------------------------------------

/**
 * Produce a fallback Epitaph from page info.
 *
 * Source priority: metaDescription → firstParagraph → title.
 * The first candidate that is non-empty after trimming is used.
 *
 * Before truncation each candidate is:
 *   1. Trimmed of leading/trailing whitespace.
 *   2. All internal runs of whitespace (spaces, tabs, newlines, etc.)
 *      collapsed to a single space.
 *
 * The result is truncated to at most EPITAPH_MAX (200) Unicode code points,
 * measured as [...text].length so surrogate pairs count as one.
 *
 * When every candidate (including title) is empty or whitespace-only,
 * the function returns "Untitled page" with source 'title'.
 *
 * Validates: Requirements 3.2, 3.3, 3.7
 */
export function fallbackEpitaph(page: PageInfo): { text: string; source: EpitaphSource } {
  const candidates: Array<{ text: string; source: EpitaphSource }> = [
    { text: page.metaDescription ?? '', source: 'meta' },
    { text: page.firstParagraph ?? '', source: 'paragraph' },
    { text: page.title, source: 'title' },
  ];

  for (const { text, source } of candidates) {
    const cleaned = cleanEpitaphText(text);
    if (cleaned.length > 0) return { text: cleaned, source };
  }

  return { text: 'Untitled page', source: 'title' };
}

/**
 * The Epitaph cleaning rules (Requirement 3.3), shared by fallbackEpitaph and
 * the AI epitaph upgrade: trim, collapse every whitespace run to one space,
 * cut to EPITAPH_MAX code points, trim the end again. '' when nothing is left.
 */
export function cleanEpitaphText(text: string): string {
  // Example: "a ".repeat(150) → collapse → "a a a..." (200 code points) → might end with a space.
  return truncateByCodePoint(collapseWhitespace(text), EPITAPH_MAX).trimEnd();
}

// ---------------------------------------------------------------------------
// createGrave
// ---------------------------------------------------------------------------

/**
 * Build a complete Grave from a tab and its extracted page info.
 *
 * - url and title come from the tab.
 * - domain is the lower-cased hostname from hostnameOf(tab.url), or 'unknown'
 *   if the URL cannot be parsed.
 * - epitaph and epitaphSource come from fallbackEpitaph.
 * - excerpt is page.excerpt cut to EXCERPT_MAX characters (by UTF-16 code
 *   unit — the excerpt is handled internally and never shown directly).
 * - buriedAt and lastAccessed are both in milliseconds epoch.
 * - id is provided by the caller (use crypto.randomUUID() in production).
 * - duplicateCount comes from countDuplicates on the run's tab snapshot;
 *   anything that is not an integer >= 1 is stored as 1.
 *
 * Validates: Requirements 3.1, 3.2, 5.1, 10.2
 */
export function createGrave(
  tab: TabInfo,
  page: PageInfo,
  now: number,
  id: string,
  duplicateCount: number,
): Grave {
  const { text: epitaph, source: epitaphSource } = fallbackEpitaph(page);
  const domain = hostnameOf(tab.url) ?? 'unknown';
  return {
    id,
    url: tab.url,
    title: tab.title,
    domain,
    favIconUrl: tab.favIconUrl,
    buriedAt: now,
    lastAccessed: tab.lastAccessed,
    epitaph,
    epitaphSource,
    excerpt: page.excerpt !== undefined
      ? page.excerpt.slice(0, EXCERPT_MAX)
      : undefined,
    duplicateCount: normalizeDuplicateCount(duplicateCount),
  };
}

// ---------------------------------------------------------------------------
// countDuplicates
// ---------------------------------------------------------------------------

/**
 * Number of tabs in the snapshot whose url is exactly `url`. The tab being
 * buried is part of the snapshot, so the result is at least 1 even if the
 * snapshot is stale and no longer contains it.
 *
 * Validates: Requirement 10.2
 */
export function countDuplicates(tabs: TabInfo[], url: string): number {
  return Math.max(1, tabs.filter((tab) => tab.url === url).length);
}

// ---------------------------------------------------------------------------
// addGrave
// ---------------------------------------------------------------------------

/**
 * Add or replace a Grave in the list, then enforce the cap.
 *
 * Rules:
 * 1. If a Grave with the same `url` already exists, replace it at its
 *    current position. The incoming Grave takes over that slot.
 * 2. If no existing Grave has that `url`, append the new Grave.
 * 3. If the resulting list exceeds `cap`, remove the oldest entries among
 *    the OTHER graves (smallest `buriedAt`) until the list is at most `cap`
 *    long. The new grave is NEVER dropped, regardless of its `buriedAt`.
 *    Remaining graves keep their original relative order.
 * 4. Always returns a new array; the input array is never mutated.
 *
 * Validates: Requirements 3.8, 6.5
 */
export function addGrave(graves: Grave[], grave: Grave, cap: number): Grave[] {
  // Step 1 & 2: replace existing entry for this URL, or append.
  const existingIndex = graves.findIndex((g) => g.url === grave.url);
  let next: Grave[];
  if (existingIndex !== -1) {
    next = graves.slice();
    next[existingIndex] = grave;
  } else {
    next = [...graves, grave];
  }

  // Step 3: trim to cap without touching the new grave.
  if (next.length > cap) {
    // Build a list of the OTHER entries (all except the new grave) sorted by
    // buriedAt ascending so we know which to drop first.
    const newGraveIndex = next.findIndex((g) => g === grave);
    const others = next
      .map((g, i) => ({ g, i }))
      .filter(({ i }) => i !== newGraveIndex)
      .sort((a, b) => a.g.buriedAt - b.g.buriedAt); // oldest first

    const toDrop = next.length - cap; // how many to remove
    const dropIndices = new Set(others.slice(0, toDrop).map(({ i }) => i));

    next = next.filter((_, i) => !dropIndices.has(i));
  }

  return next;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Trim leading/trailing whitespace and collapse every internal run of
 * whitespace characters (space, tab, newline, carriage return, etc.) into
 * a single space.
 */
function collapseWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Truncate a string to at most `max` Unicode code points.
 * Uses the string iterator, which yields one entry per code point (not code
 * unit), so surrogate pairs (emoji, etc.) count as one code point.
 */
function truncateByCodePoint(text: string, max: number): string {
  // Fast path: for ASCII-only strings .length equals code-point count.
  if (text.length <= max) return text;

  let count = 0;
  let result = '';
  for (const char of text) {
    if (count >= max) break;
    result += char;
    count++;
  }
  return result;
}
