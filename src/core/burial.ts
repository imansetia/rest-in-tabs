import type { Grave, Settings, Stats, TabInfo, PageInfo } from './types.js';
import { GRAVE_CAP } from './types.js';
import { selectBurialCandidates } from './selection.js';
import { createGrave, addGrave } from './graves.js';

// ---------------------------------------------------------------------------
// Platform adapter interfaces
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  getGraves(): Promise<Grave[]>;
  setGraves(graves: Grave[]): Promise<void>;
  getSettings(): Promise<Settings>;
  getStats(): Promise<Stats>;
  setStats(stats: Stats): Promise<void>;
  getInstalledAt(): Promise<number | undefined>;
}

export interface TabsAdapter {
  queryTabs(queryInfo?: any): Promise<TabInfo[]>;
  removeTab(tabId: number): Promise<void>;
}

export interface ExtractAdapter {
  extractPageInfo(tabId: number): Promise<PageInfo>;
}

// ---------------------------------------------------------------------------
// Serial queue
// ---------------------------------------------------------------------------

/**
 * Runs async operations one at a time, in the order they were enqueued.
 * A failed operation does not block the ones after it.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Chains whole burial runs. A run starts only after the previous run has
 * finished, then queries tabs fresh, so it never selects a tab that the
 * previous run is about to close.
 */
const runQueue = new SerialQueue();

/**
 * Serializes every read-modify-write of graves and stats. Kept separate from
 * runQueue so a run can enqueue its own writes without waiting on itself.
 */
const writeQueue = new SerialQueue();

// ---------------------------------------------------------------------------
// buryTabs
// ---------------------------------------------------------------------------

/**
 * Bury idle tabs: select candidates, extract page info, save graves, close tabs.
 *
 * - Automatic run (isAutomatic=true): uses the stored settings and measures
 *   idleness from Math.max(tab.lastAccessed, installedAt) (Requirement 1.7).
 * - Manual run (isAutomatic=false, "Bury idle tabs now"): forces autoBury to
 *   true (Requirement 2.2) and uses the tab's real lastAccessed.
 *
 * Runs never overlap. Graves always store the tab's real lastAccessed.
 *
 * Returns the number of graves saved.
 */
export function buryTabs(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  isAutomatic: boolean,
): Promise<number> {
  return runQueue.enqueue(() => runBurial(storage, tabs, extract, isAutomatic));
}

async function runBurial(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  isAutomatic: boolean,
): Promise<number> {
  const [storedSettings, openTabs, installedAt] = await Promise.all([
    storage.getSettings(),
    tabs.queryTabs(),
    storage.getInstalledAt(),
  ]);
  const now = Date.now();

  const settings: Settings = isAutomatic ? storedSettings : { ...storedSettings, autoBury: true };

  // For automatic runs, select on copies whose lastAccessed is clamped to
  // installedAt, but bury the original tabs so graves keep the real value.
  const measuredTabs =
    isAutomatic && installedAt !== undefined
      ? openTabs.map((tab) => ({ ...tab, lastAccessed: Math.max(tab.lastAccessed, installedAt) }))
      : openTabs;
  const selectedIds = new Set(selectBurialCandidates(measuredTabs, settings, now).map((t) => t.id));
  const candidates = openTabs.filter((tab) => selectedIds.has(tab.id));

  let saved = 0;
  for (const tab of candidates) {
    if (await burySingleTab(storage, tabs, extract, tab, now)) saved++;
  }
  return saved;
}

// ---------------------------------------------------------------------------
// burySingleTab
// ---------------------------------------------------------------------------

/**
 * Extract page info, save the grave, then close the tab.
 *
 * Returns true when the grave was saved. The tab is closed only after the
 * save succeeds (Requirement 1.5).
 */
async function burySingleTab(
  storage: StorageAdapter,
  tabs: TabsAdapter,
  extract: ExtractAdapter,
  tab: TabInfo,
  now: number,
): Promise<boolean> {
  let page: PageInfo;
  try {
    page = await extract.extractPageInfo(tab.id);
  } catch (err) {
    // Requirement 3.7: fall back to the tab title.
    console.warn(`Could not read page for tab ${tab.id}; using its title:`, err);
    page = { title: tab.title };
  }

  const grave = createGrave(tab, page, now, crypto.randomUUID());

  try {
    await writeQueue.enqueue(async () => {
      const graves = await storage.getGraves();
      await storage.setGraves(addGrave(graves, grave, GRAVE_CAP));
      const stats = await storage.getStats();
      await storage.setStats({ ...stats, buried: stats.buried + 1 });
    });
  } catch (err) {
    console.error(`Could not save grave for tab ${tab.id}; tab left open:`, err);
    return false;
  }

  try {
    await tabs.removeTab(tab.id);
  } catch (err) {
    console.warn(`Grave saved for tab ${tab.id}, but closing the tab failed:`, err);
  }
  return true;
}
