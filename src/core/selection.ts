import type { TabInfo, Settings } from './types.js';
import { hostnameOf } from './url-utils.js';

/**
 * Returns true when a tab must never be buried automatically.
 *
 * A tab is protected when it is:
 *   - the active (foreground) tab of any window
 *   - pinned
 *   - playing audio
 *   - in a private (incognito) window
 *   - not an http: or https: URL
 *   - on a domain in protectedSites, or on a subdomain of one
 *
 * protectedSites entries are assumed to be already lower-cased and trimmed
 * (as produced by normalizeSettings). The tab hostname is normalised by
 * stripping one trailing dot (FQDN form) before comparison.
 *
 * Validates: Requirement 1.3
 */
export function isProtected(tab: TabInfo, protectedSites: string[]): boolean {
  if (tab.active) return true;
  if (tab.pinned) return true;
  if (tab.audible) return true;
  if (tab.incognito) return true;
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return true;

  // Parse the URL unconditionally so an unparseable URL is always protected,
  // regardless of whether protectedSites is empty.
  const host = hostnameOf(tab.url);
  if (host === null) return true;

  if (protectedSites.some((entry) => host === entry || host.endsWith('.' + entry))) {
    return true;
  }

  return false;
}

/**
 * Returns true when a tab may be buried via the "Bury this tab" button.
 *
 * Manual burial bypasses active, pinned, audible and Protected Sites checks,
 * but still requires an http(s) URL and a non-incognito window.
 *
 * Validates: Requirements 2.1, 2.3
 */
export function canBuryManually(tab: TabInfo): boolean {
  if (tab.incognito) return false;
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return false;
  // Reject unparseable URLs (hostnameOf returns null).
  if (hostnameOf(tab.url) === null) return false;
  return true;
}

/**
 * Returns the tabs that the auto-burial alarm should close on this run.
 *
 * A tab is selected when ALL of the following hold:
 *   1. settings.autoBury is true
 *   2. the tab is not protected (isProtected returns false)
 *   3. now - tab.lastAccessed >= settings.idleMinutes * 60_000
 *      (both now and lastAccessed are ms epoch; idleMinutes is whole minutes)
 *
 * The function is pure: it reads no globals and calls no chrome.* APIs.
 *
 * Validates: Requirements 1.2, 1.3, 1.6, 2.2
 */
export function selectBurialCandidates(
  tabs: TabInfo[],
  settings: Settings,
  now: number,
): TabInfo[] {
  if (!settings.autoBury) return [];

  const idleMs = settings.idleMinutes * 60_000;

  return tabs.filter(
    (tab) => !isProtected(tab, settings.protectedSites) && now - tab.lastAccessed >= idleMs,
  );
}
