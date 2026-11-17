// Text shown on and for a tombstone. Pure: every time is passed in, so the
// Graveyard can render with one displayNow (and the Demo clock can shift it).

import type { Grave } from './types.js';
import type { DecayStage } from './decay.js';
import { formatDuration } from './cause.js';

const HOUR = 3_600_000;

/** The condition label, shown in text wherever the look shows it (Requirement 6.2). */
export const STAGE_LABEL: Record<DecayStage, string> = {
  fresh: 'Fresh',
  weathered: 'Weathered',
  crumbling: 'Crumbling',
};

/** "15 NOV", as the mockup's fmtShort (en-GB day and short month, capitals). */
export function stoneDate(t: number): string {
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

/** "15 November 2026", as the mockup's fmtLong (Plaque, List view hover). */
export function longDate(t: number): string {
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "last visited — buried", e.g. "15 NOV — 17 NOV". */
export function stoneDates(lastAccessed: number, buriedAt: number): string {
  return `${stoneDate(lastAccessed)} — ${stoneDate(buriedAt)}`;
}

/** "just now" under one hour, otherwise "5 hours ago", "3 days ago", "2 months ago". */
export function timeAgo(t: number, displayNow: number): string {
  const ms = Math.max(0, displayNow - t);
  return ms < HOUR ? 'just now' : `${formatDuration(ms)} ago`;
}

/**
 * The name carved on the stone: the title up to the first " · " (mockup:
 * shortTitle). A grave without a title shows its domain.
 */
export function stoneName(title: string, domain: string): string {
  return title.split(' · ')[0].trim() || title.trim() || domain;
}

/** Accessible name of a stone: "Title. Condition. Buried 5 hours ago." */
export function stoneLabel(
  grave: Pick<Grave, 'title' | 'domain' | 'buriedAt'>,
  stage: DecayStage,
  displayNow: number,
): string {
  const title = grave.title.trim() || grave.domain;
  return `${title}. ${STAGE_LABEL[stage]}. Buried ${timeAgo(grave.buriedAt, displayNow)}.`;
}
