import type { TabInfo } from '../core/types.js';
import { tabToTabInfo } from '../core/tab-mapping.js';

// ---------------------------------------------------------------------------
// queryTabs
// ---------------------------------------------------------------------------

/**
 * Query tabs and convert them to TabInfo[].
 *
 * Tabs without an id or url are skipped.
 * Throws if the query fails.
 */
export async function queryTabs(queryInfo: chrome.tabs.QueryInfo = {}): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query(queryInfo);
  const now = Date.now();
  return tabs.map((tab) => tabToTabInfo(tab, now)).filter((t): t is TabInfo => t !== null);
}

// ---------------------------------------------------------------------------
// getActiveTab
// ---------------------------------------------------------------------------

/**
 * The active tab of the window the calling page (e.g. the Popup) belongs to,
 * or null if there is none. Throws if the query fails.
 */
export async function getActiveTab(): Promise<TabInfo | null> {
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  return tab ?? null;
}

// ---------------------------------------------------------------------------
// getTab
// ---------------------------------------------------------------------------

/**
 * Read one tab by id.
 *
 * Returns null when the tab no longer exists (chrome.tabs.get rejects) or has
 * no id or url. Callers treat null as "do not bury", the safe direction.
 */
export async function getTab(tabId: number): Promise<TabInfo | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tabToTabInfo(tab, Date.now());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// removeTab
// ---------------------------------------------------------------------------

/**
 * Close a tab by id.
 *
 * Throws if the removal fails.
 */
export async function removeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

// ---------------------------------------------------------------------------
// createTab
// ---------------------------------------------------------------------------

/**
 * Open a new tab with the given URL.
 *
 * Returns the TabInfo of the created tab, or null if the created tab
 * is missing required fields.
 * Throws if tab creation fails.
 */
export async function createTab(url: string): Promise<TabInfo | null> {
  const tab = await chrome.tabs.create({ url });
  const now = Date.now();
  return tabToTabInfo(tab, now);
}
