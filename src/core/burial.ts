import type { TabInfo, PageInfo } from './types.js';
import { GRAVE_CAP } from './types.js';
import type { StorageAdapter, TabsAdapter, ExtractAdapter } from './adapters.js';
import type { MessageResponse } from './messages.js';
import { runQueue, writeQueue } from './queue.js';
import { selectBurialCandidates, selectAutomaticCandidates, canBuryManually } from './selection.js';
import { createGrave, addGrave } from './graves.js';

// Burial orchestration. Adapters are injected so tests can use fakes.

/** Decides, from the tab as it is right before saving, whether to still bury it. */
type StillBuriable = (fresh: TabInfo) => boolean;

type Outcome = 'saved' | 'skipped' | 'save-failed';

// ---------------------------------------------------------------------------
// buryTabs (alarm and "Bury idle tabs now")
// ---------------------------------------------------------------------------

/**
 * Bury idle tabs.
 *
 * - Automatic run (isAutomatic=true): stored settings; idleness measured from
 *   max(lastAccessed, installedAt) (Requirement 1.7).
 * - Manual run (isAutomatic=false): autoBury forced to true (Requirement 2.2);
 *   the tab's real lastAccessed is used.
 *
 * In both, each tab is checked again right before saving and skipped if it
 * became protected or is no longer idle.
 *
 * Runs never overlap. Returns the number of graves saved.
 */
export function buryTabs(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  isAutomatic: boolean,
): Promise<number> {
  return runQueue.enqueue(async () => {
    const [settings, openTabs, installedAt] = await Promise.all([
      storage.getSettings(),
      tabs.queryTabs(),
      storage.getInstalledAt(),
    ]);
    const now = Date.now();

    let candidates: TabInfo[];
    let stillBuriable: StillBuriable;
    if (isAutomatic) {
      candidates = selectAutomaticCandidates(openTabs, settings, installedAt, now);
      stillBuriable = (fresh) =>
        selectAutomaticCandidates([fresh], settings, installedAt, Date.now()).length === 1;
    } else {
      const manual = { ...settings, autoBury: true };
      candidates = selectBurialCandidates(openTabs, manual, now);
      stillBuriable = (fresh) => selectBurialCandidates([fresh], manual, Date.now()).length === 1;
    }

    let saved = 0;
    for (const tab of candidates) {
      if ((await burySingleTab(storage, tabs, extract, tab, stillBuriable)) === 'saved') saved++;
    }
    return saved;
  });
}

// ---------------------------------------------------------------------------
// buryTab ("Bury this tab")
// ---------------------------------------------------------------------------

/**
 * Bury one tab on request, even if it is active, pinned or on a protected
 * site (Requirement 2.1). Private windows and non-http(s) pages are refused.
 */
export function buryTab(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  tabId: number,
): Promise<MessageResponse> {
  return runQueue.enqueue(async () => {
    const tab = await tabs.getTab(tabId);
    if (tab === null) return { ok: false, error: 'not-found' };
    if (!canBuryManually(tab)) return { ok: false, error: 'not-allowed' };

    const outcome = await burySingleTab(storage, tabs, extract, tab, () => true);
    if (outcome === 'saved') return { ok: true };
    return { ok: false, error: outcome === 'skipped' ? 'not-found' : 'save-failed' };
  });
}

// ---------------------------------------------------------------------------
// burySingleTab
// ---------------------------------------------------------------------------

/**
 * Extract page info, re-check the tab, save the grave, then close the tab.
 * The tab is closed only after the save succeeds (Requirement 1.5).
 */
async function burySingleTab(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  tab: TabInfo,
  stillBuriable: StillBuriable,
): Promise<Outcome> {
  let page: PageInfo;
  try {
    page = await extract.extractPageInfo(tab.id);
  } catch (err) {
    // Requirement 3.7: fall back to the tab title.
    console.warn(`Could not read page for tab ${tab.id}; using its title:`, err);
    page = { title: tab.title };
  }

  // Extraction can take up to 2 s per tab. Since selection the user may have
  // closed the tab, navigated it elsewhere, or switched to it.
  const fresh = await tabs.getTab(tab.id);
  if (fresh === null || fresh.url !== tab.url || !stillBuriable(fresh)) return 'skipped';

  const grave = createGrave(fresh, page, Date.now(), crypto.randomUUID());

  try {
    await writeQueue.enqueue(async () => {
      const [graves, stats] = await Promise.all([storage.getGraves(), storage.getStats()]);
      await storage.setGravesAndStats(addGrave(graves, grave, GRAVE_CAP), {
        ...stats,
        buried: stats.buried + 1,
      });
    });
  } catch (err) {
    console.error(`Could not save grave for tab ${tab.id}; tab left open:`, err);
    return 'save-failed';
  }

  try {
    await tabs.removeTab(tab.id);
  } catch (err) {
    console.warn(`Grave saved for tab ${tab.id}, but closing the tab failed:`, err);
  }
  return 'saved';
}
