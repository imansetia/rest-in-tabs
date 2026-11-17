import type { StorageAdapter, TabsAdapter } from './adapters.js';
import type { MessageResponse } from './messages.js';
import { writeQueue } from './queue.js';
import { expiredGraves } from './decay.js';
import { cleanAiEpitaph, withoutExcerpt, withoutOldExcerpts } from './ai-epitaph.js';

// Resurrect, exorcise and expiry orchestration. Every change goes through the
// shared write queue. Adapters are injected so tests can use fakes.

/**
 * Reopen a grave's page in a new tab, then remove the grave and count the
 * resurrection. If the tab cannot be opened, the grave is kept (Requirement 5.2).
 */
export function resurrect(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  graveId: string,
): Promise<MessageResponse> {
  return writeQueue.enqueue(async () => {
    const [graves, stats] = await Promise.all([storage.getGraves(), storage.getStats()]);
    const grave = graves.find((g) => g.id === graveId);
    if (grave === undefined) return { ok: false, error: 'not-found' };

    try {
      await tabs.createTab(grave.url);
    } catch (err) {
      console.error(`Could not reopen ${grave.url}; grave kept:`, err);
      return { ok: false, error: 'open-failed' };
    }

    try {
      await storage.setGravesAndStats(
        graves.filter((g) => g.id !== graveId),
        { ...stats, resurrected: stats.resurrected + 1 },
      );
    } catch (err) {
      // The page is open again; the grave stays, so nothing is lost.
      console.error(`Reopened ${grave.url}, but could not remove its grave:`, err);
      return { ok: false, error: 'save-failed' };
    }
    return { ok: true };
  });
}

/**
 * Permanently delete a grave (Requirement 5.4). Confirmation happens in the
 * Graveyard UI before this message is sent. Stats are not affected.
 */
export function exorcise(storage: StorageAdapter, graveId: string): Promise<MessageResponse> {
  return writeQueue.enqueue(async () => {
    const graves = await storage.getGraves();
    if (!graves.some((g) => g.id === graveId)) return { ok: false, error: 'not-found' };

    try {
      await storage.setGraves(graves.filter((g) => g.id !== graveId));
    } catch (err) {
      console.error(`Could not exorcise grave ${graveId}:`, err);
      return { ok: false, error: 'save-failed' };
    }
    return { ok: true };
  });
}

/**
 * Remove graves older than the Retention Period (Requirements 6.3, 6.4).
 * Writes only when something expired. Returns the number removed.
 */
export function expireGraves(storage: StorageAdapter): Promise<number> {
  return writeQueue.enqueue(async () => {
    const [graves, settings] = await Promise.all([storage.getGraves(), storage.getSettings()]);
    const expired = new Set(expiredGraves(graves, settings.retentionDays, Date.now()));
    if (expired.size === 0) return 0;

    await storage.setGraves(graves.filter((g) => !expired.has(g)));
    return expired.size;
  });
}

/**
 * Save an on-device AI summary as a grave's Epitaph (task 13.2, Requirements
 * 3.3, 3.4): cleaned with the fallbackEpitaph rules, marked as source "ai",
 * and the excerpt deleted. Text with nothing left after cleaning is a
 * bad-request; a grave that left meanwhile is not-found (nothing is written).
 */
export function updateEpitaph(storage: StorageAdapter, graveId: string, text: string): Promise<MessageResponse> {
  return writeQueue.enqueue(async () => {
    const epitaph = cleanAiEpitaph(text);
    if (epitaph === '') return { ok: false, error: 'bad-request' };
    const graves = await storage.getGraves();
    const index = graves.findIndex((g) => g.id === graveId);
    if (index === -1) return { ok: false, error: 'not-found' };

    const next = graves.slice();
    next[index] = { ...withoutExcerpt(graves[index]), epitaph, epitaphSource: 'ai' };
    try {
      await storage.setGraves(next);
    } catch (err) {
      console.error(`Could not save the AI epitaph of grave ${graveId}:`, err);
      return { ok: false, error: 'save-failed' };
    }
    return { ok: true };
  });
}

/**
 * Drop page excerpts older than 7 days (task 13.4), whether or not the AI ever
 * used them. Separate from expireGraves, which only checks the Retention
 * Period. Writes only when something changed. Returns the number pruned.
 */
export function pruneExcerpts(storage: StorageAdapter): Promise<number> {
  return writeQueue.enqueue(async () => {
    const graves = await storage.getGraves();
    const next = withoutOldExcerpts(graves, Date.now());
    if (next === null) return 0;
    await storage.setGraves(next);
    return next.filter((g, i) => g !== graves[i]).length;
  });
}
