import type { StorageAdapter, TabsAdapter } from './adapters.js';
import type { MessageResponse } from './messages.js';
import { writeQueue } from './queue.js';
import { expiredGraves } from './decay.js';

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
