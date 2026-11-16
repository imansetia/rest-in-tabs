import type { TabInfo } from './types.js';

/**
 * Convert a chrome.tabs.Tab to TabInfo.
 *
 * Returns null if the tab is missing required fields (id or url).
 *
 * When lastAccessed is missing, uses the supplied `now` value so the tab
 * has age 0 at that moment, preventing it from being selected as idle.
 */
export function tabToTabInfo(tab: chrome.tabs.Tab, now: number): TabInfo | null {
  // Required fields.
  if (tab.id === undefined || tab.url === undefined) return null;

  return {
    id: tab.id,
    url: tab.url,
    title: tab.title ?? '',
    favIconUrl: tab.favIconUrl,
    active: tab.active ?? false,
    pinned: tab.pinned ?? false,
    audible: tab.audible ?? false,
    incognito: tab.incognito ?? false,
    // When lastAccessed is missing, use now so (now - lastAccessed) = 0,
    // making the tab never idle at this moment.
    lastAccessed: tab.lastAccessed ?? now,
  };
}
