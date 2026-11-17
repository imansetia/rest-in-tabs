// On-device AI epitaphs (task 13, Requirements 3.4, 3.5). Pure decisions plus
// the upgrade loop, which gets the summarizer and the message sender injected
// so it can be tested with fakes. The Summarizer API itself lives in
// platform/summarizer.ts; the page never writes graves (updateEpitaph message).

import type { Grave } from './types.js';
import { EXCERPT_MAX_AGE_DAYS } from './types.js';
import { cleanEpitaphText } from './graves.js';
import type { MessageResponse } from './messages.js';

export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

/** Anything the browser reports that is not one of the four states counts as unavailable. */
export function parseAvailability(raw: unknown): AiAvailability {
  return raw === 'available' || raw === 'downloadable' || raw === 'downloading' ? raw : 'unavailable';
}

/**
 * What the Graveyard does for a status (design, AI epitaph upgrade):
 * - available    → upgrade at once (the model is on the device, no gesture needed);
 * - downloadable → offer "Enable AI epitaphs"; nothing downloads before the click;
 * - downloading / unavailable → nothing; the fallback Epitaph stays.
 */
export function aiPlan(status: AiAvailability): 'upgrade' | 'offer' | 'none' {
  if (status === 'available') return 'upgrade';
  if (status === 'downloadable') return 'offer';
  return 'none';
}

/** Graves that still have a page excerpt to summarise, newest first (front-row stones change first). */
export function gravesToUpgrade(graves: readonly Grave[]): Grave[] {
  return graves.filter((g) => typeof g.excerpt === 'string' && g.excerpt.trim() !== '').sort((a, b) => b.buriedAt - a.buriedAt);
}

/** Quote pairs the model may wrap a summary in: opening → closing. */
const QUOTE_PAIRS: Readonly<Record<string, string>> = { '"': '"', '“': '”', "'": "'", '‘': '’' };

/**
 * Drop one pair of quotes around the whole text, but only when no other quote
 * of the same kind is inside, so '"A" and "B"' stays as it is.
 */
function unwrapQuotes(text: string): string {
  const close = QUOTE_PAIRS[text[0]];
  if (close === undefined || text.length < 2 || text[text.length - 1] !== close) return text;
  const inner = text.slice(1, -1);
  return inner.includes(text[0]) || inner.includes(close) ? text : inner;
}

/**
 * The Epitaph from a summary: a leading list marker or wrapping quotes are
 * dropped (the model may still format a one-line summary as a bullet), then the
 * same rules as fallbackEpitaph apply. '' means there is nothing to use.
 */
export function cleanAiEpitaph(summary: string): string {
  const text = summary.trim().replace(/^(?:[-*•]|\d+[.)])(?:\s+|$)/, '').trim();
  return cleanEpitaphText(unwrapQuotes(text));
}

const EXCERPT_MAX_AGE_MS = EXCERPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Drop the excerpt from graves buried more than 7 days ago (design: excerpts
 * are kept 7 days either way). Returns the new list, or null when nothing changed.
 */
export function withoutOldExcerpts(graves: readonly Grave[], now: number): Grave[] | null {
  let changed = false;
  const next = graves.map((g) => {
    if (g.excerpt === undefined || now - g.buriedAt <= EXCERPT_MAX_AGE_MS) return g;
    changed = true;
    return withoutExcerpt(g);
  });
  return changed ? next : null;
}

export function withoutExcerpt(grave: Grave): Grave {
  const { excerpt: _excerpt, ...rest } = grave;
  return rest;
}

/** The download as text on the button: "Downloading model… 42%". */
export function downloadProgressText(loaded: number, total: number): string {
  const fraction = Number.isFinite(loaded) ? loaded / (Number.isFinite(total) && total > 0 ? total : 1) : 0;
  return `Downloading model… ${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}

export interface UpgradeDeps {
  /** The graves as the page knows them now (read again before every grave). */
  graves(): readonly Grave[];
  summarize(excerpt: string): Promise<string>;
  /** Send updateEpitaph to the service worker. */
  send(graveId: string, epitaph: string): Promise<MessageResponse>;
  /**
   * Graves already tried. Pass the same set to every call on a page, so a grave
   * whose summary failed is not tried again on each live update.
   */
  tried?: Set<string>;
}

/**
 * Upgrade every grave that still has an excerpt, one at a time, newest first.
 * The list is read again before each grave, so graves that left meanwhile are
 * skipped and graves buried meanwhile are included. A grave whose summary
 * fails keeps its fallback Epitaph (and its excerpt, so a later visit retries
 * until the 7-day prune). Each grave is tried once per `tried` set (per call
 * if none is given).
 */
export async function upgradeEpitaphs(deps: UpgradeDeps): Promise<{ upgraded: number; failed: number }> {
  const tried = deps.tried ?? new Set<string>();
  let upgraded = 0;
  let failed = 0;
  for (;;) {
    const grave = gravesToUpgrade(deps.graves()).find((g) => !tried.has(g.id));
    if (grave === undefined) break;
    tried.add(grave.id);
    let epitaph: string;
    try {
      epitaph = cleanAiEpitaph(await deps.summarize(grave.excerpt!));
    } catch (err) {
      console.error(`Could not summarise grave ${grave.id}; the fallback epitaph stays:`, err);
      failed++;
      continue;
    }
    if (epitaph === '') {
      failed++;
      continue;
    }
    const response = await deps.send(grave.id, epitaph);
    if (response.ok) upgraded++;
    else failed++;
  }
  return { upgraded, failed };
}
