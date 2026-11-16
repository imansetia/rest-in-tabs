// Cause of death: a one-line obituary chosen by fixed rules from stored data.
// Nothing here is generated or random (Requirement 10.1).

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type CauseKind = 'duplicate' | 'checkout' | 'draft' | 'signup' | 'neglect';

/**
 * The Grave fields the rules read. A Grave satisfies this structurally once it
 * has duplicateCount (task 10.2).
 */
export interface CauseOfDeathInput {
  url: string;
  buriedAt: number;
  lastAccessed: number;
  /** Open tabs with this exact url at burial, this one included. 1 = no duplicate. */
  duplicateCount: number;
}

const DRAFT_SEGMENTS = new Set(['edit', 'draft', 'compose']);
const SIGNUP_WORDS = ['register', 'signup', 'sign-up', 'join'];

/**
 * Pick the first matching rule of Requirement 10.3:
 *   1. duplicateCount > 1                                  → duplicate
 *   2. path contains "cart" or "checkout"                  → checkout
 *   3. a path segment is exactly edit, draft or compose    → draft
 *   4. path contains register, signup, sign-up or join     → signup
 *   5. otherwise                                           → neglect
 *
 * The path is new URL(url).pathname, lower-cased. An unparseable URL has an
 * empty path, so only the duplicate and neglect rules can match.
 */
export function causeOfDeath(grave: CauseOfDeathInput): { kind: CauseKind; text: string } {
  if (grave.duplicateCount > 1) {
    return {
      kind: 'duplicate',
      text: `Died a duplicate. ${grave.duplicateCount} identical tabs were open.`,
    };
  }

  const path = lowerCasePath(grave.url);

  if (path.includes('cart') || path.includes('checkout')) {
    return { kind: 'checkout', text: 'Abandoned at checkout.' };
  }
  // Whole segments only: "/document/d/1x9/edit" is a draft, "/editor" is not.
  if (path.split('/').some((segment) => DRAFT_SEGMENTS.has(segment))) {
    return { kind: 'draft', text: 'Abandoned mid-draft.' };
  }
  if (SIGNUP_WORDS.some((word) => path.includes(word))) {
    return { kind: 'signup', text: 'Abandoned during sign-up.' };
  }
  return {
    kind: 'neglect',
    text: `Died of neglect. Unvisited for ${formatDuration(grave.buriedAt - grave.lastAccessed)}.`,
  };
}

/**
 * Human-readable length of an interval, rounded as the mockup does:
 *   below 1 hour                    → "less than an hour"
 *   h = round(ms / 1 h), h < 48     → "1 hour" / "h hours"
 *   d = round(ms / 1 day), d < 60   → "d days"
 *   otherwise                       → "round(d / 30) months"
 *
 * Negative or non-finite intervals (clock changes, bad data) count as 0.
 */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (safe < HOUR) return 'less than an hour';

  const hours = Math.round(safe / HOUR);
  if (hours < 48) return hours === 1 ? '1 hour' : `${hours} hours`;

  const days = Math.round(safe / DAY);
  if (days < 60) return `${days} days`;

  return `${Math.round(days / 30)} months`;
}

function lowerCasePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}
