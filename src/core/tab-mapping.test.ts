import { describe, it, expect } from 'vitest';
import { tabToTabInfo } from './tab-mapping.js';
import { createGrave } from './graves.js';
import { isValidGrave } from './validation.js';
import { selectBurialCandidates } from './selection.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    url: 'https://example.com/',
    title: 'Example',
    active: false,
    pinned: false,
    audible: false,
    incognito: false,
    index: 0,
    windowId: 1,
    highlighted: false,
    groupId: -1,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: 1_000_000_000_000,
    ...overrides,
  } as chrome.tabs.Tab;
}

// ---------------------------------------------------------------------------
// tabToTabInfo
// ---------------------------------------------------------------------------

describe('tabToTabInfo', () => {
  it('converts a complete tab to TabInfo', () => {
    const tab = makeTab({
      id: 42,
      url: 'https://docs.example.com/page',
      title: 'Documentation',
      favIconUrl: 'https://example.com/icon.png',
      active: true,
      pinned: true,
      audible: true,
      incognito: true,
      lastAccessed: 1_234_567_890_000,
    });

    const now = Date.now();
    const result = tabToTabInfo(tab, now);

    expect(result).toEqual({
      id: 42,
      url: 'https://docs.example.com/page',
      title: 'Documentation',
      favIconUrl: 'https://example.com/icon.png',
      active: true,
      pinned: true,
      audible: true,
      incognito: true,
      lastAccessed: 1_234_567_890_000,
    });
  });

  it('returns null when id is missing', () => {
    const tab = makeTab();
    delete (tab as any).id;
    const now = Date.now();
    expect(tabToTabInfo(tab, now)).toBeNull();
  });

  it('returns null when url is missing', () => {
    const tab = makeTab();
    delete (tab as any).url;
    const now = Date.now();
    expect(tabToTabInfo(tab, now)).toBeNull();
  });

  it('defaults title to empty string when missing', () => {
    const tab = makeTab();
    delete (tab as any).title;
    const now = Date.now();
    const result = tabToTabInfo(tab, now);
    expect(result?.title).toBe('');
  });

  it('sets favIconUrl to undefined when missing', () => {
    const tab = makeTab();
    delete (tab as any).favIconUrl;
    const now = Date.now();
    const result = tabToTabInfo(tab, now);
    expect(result?.favIconUrl).toBeUndefined();
  });

  it('defaults boolean flags to false when missing', () => {
    const tab = makeTab();
    delete (tab as any).active;
    delete (tab as any).pinned;
    delete (tab as any).audible;
    delete (tab as any).incognito;

    const now = Date.now();
    const result = tabToTabInfo(tab, now);
    expect(result?.active).toBe(false);
    expect(result?.pinned).toBe(false);
    expect(result?.audible).toBe(false);
    expect(result?.incognito).toBe(false);
  });

  it('uses now for lastAccessed when missing so the tab is never idle at that moment', () => {
    const tab = makeTab();
    delete (tab as any).lastAccessed;
    const now = 1_500_000_000_000;
    const result = tabToTabInfo(tab, now);
    expect(result?.lastAccessed).toBe(now);
  });

  it('a tab with missing lastAccessed produces a valid grave and is not selected as idle', () => {
    const tab = makeTab({ url: 'https://example.com/' });
    delete (tab as any).lastAccessed;
    const now = 1_500_000_000_000;

    const tabInfo = tabToTabInfo(tab, now);
    expect(tabInfo).not.toBeNull();

    // The grave produced from this tab must be valid.
    const page = { title: 'Test' };
    const grave = createGrave(tabInfo!, page, now, 'test-id', 1);
    expect(isValidGrave(grave)).toBe(true);

    // The tab must not be selected as idle at the same now.
    const settings = { autoBury: true, idleMinutes: 30, protectedSites: [], retentionDays: 30 };
    const candidates = selectBurialCandidates([tabInfo!], settings, now);
    expect(candidates).toEqual([]);
  });
});
