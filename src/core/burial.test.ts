import { describe, it, expect, vi, afterEach } from 'vitest';
import { buryTabs, buryTab } from './burial.js';
import { DAY, makeTab, fakeStorage, fakeTabs, fakeExtract } from './test-fakes.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buryTabs', () => {
  it('two overlapping runs bury each idle tab exactly once', async () => {
    const storage = fakeStorage({ installedAt: 0 });
    const tabs = fakeTabs([makeTab(1), makeTab(2), makeTab(3)]);
    const extract = fakeExtract();

    const [first, second] = await Promise.all([
      buryTabs(storage.adapter, tabs.adapter, extract, true),
      buryTabs(storage.adapter, tabs.adapter, extract, true),
    ]);

    expect(first + second).toBe(3);
    expect(storage.stats().buried).toBe(3);
    expect([...tabs.removeCalls].sort()).toEqual([1, 2, 3]);
    expect(storage.graves()).toHaveLength(3);
    expect(tabs.open.size).toBe(0);
  });

  it('a manual run buries idle tabs when Auto-Bury is off; an automatic run does not', async () => {
    // installedAt = now also holds back automatic runs (Req 1.7); a manual
    // run must use the real lastAccessed.
    const storage = fakeStorage({ settings: { autoBury: false }, installedAt: Date.now() });
    const tabs = fakeTabs([makeTab(1), makeTab(2, { active: true })]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), true)).toBe(0);
    expect(tabs.removeCalls).toEqual([]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), false)).toBe(1);
    expect(tabs.removeCalls).toEqual([1]); // the active tab stays protected
    expect(storage.stats().buried).toBe(1);
  });

  it('a failed save leaves the tab open and stats unchanged', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = fakeStorage({ installedAt: 0, failWrites: true });
    const tabs = fakeTabs([makeTab(1)]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), true)).toBe(0);
    expect(tabs.removeCalls).toEqual([]);
    expect(tabs.open.has(1)).toBe(true);
    expect(storage.stats().buried).toBe(0);
    expect(storage.graves()).toEqual([]);
  });

  it.each([
    ['automatic', true],
    ['manual', false],
  ])('%s run: skips a selected tab that the user switches to during the run', async (_, isAutomatic) => {
    const storage = fakeStorage({ installedAt: 0 });
    const tabs = fakeTabs([makeTab(1), makeTab(2), makeTab(3)]);
    // While tab 1 is being read, the user switches to tab 3.
    const extract = fakeExtract((id) => {
      if (id === 1) tabs.update(3, { active: true, lastAccessed: Date.now() });
    });

    expect(await buryTabs(storage.adapter, tabs.adapter, extract, isAutomatic)).toBe(2);
    expect(tabs.removeCalls).toEqual([1, 2]);
    expect(tabs.open.has(3)).toBe(true);
    expect(storage.stats().buried).toBe(2);
    expect(storage.graves().map((g) => g.url)).not.toContain('https://site3.example.com/');
  });

  it('skips a selected tab that navigates to a different URL during extraction', async () => {
    const storage = fakeStorage({ installedAt: 0 });
    const tabs = fakeTabs([makeTab(1), makeTab(2)]);
    // Tab 1 navigates while it is being read; it stays inactive and idle, so
    // only the URL check can stop the burial.
    const extract = fakeExtract((id) => {
      if (id === 1) tabs.update(1, { url: 'https://elsewhere.example.org/' });
    });

    expect(await buryTabs(storage.adapter, tabs.adapter, extract, true)).toBe(1);
    expect(tabs.removeCalls).toEqual([2]);
    expect(tabs.open.get(1)?.url).toBe('https://elsewhere.example.org/');
    expect(storage.graves().map((g) => g.url)).toEqual(['https://site2.example.com/']);
  });

  it('an automatic run right after install buries no tab that was idle before install', async () => {
    const now = Date.now();
    const storage = fakeStorage({ installedAt: now });
    const tabs = fakeTabs([
      makeTab(1, { lastAccessed: now - 30 * DAY }),
      makeTab(2, { lastAccessed: now - DAY }),
    ]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), true)).toBe(0);
    expect(tabs.removeCalls).toEqual([]);
    expect(storage.graves()).toEqual([]);
  });

  it('records the Duplicate count from the run snapshot: 3 identical tabs give 3', async () => {
    const storage = fakeStorage({ installedAt: 0 });
    const url = 'https://same.example.com/page';
    const tabs = fakeTabs([makeTab(1, { url }), makeTab(2, { url }), makeTab(3, { url }), makeTab(4)]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), true)).toBe(4);

    // addGrave keeps one grave per url; it still records all 3 open copies.
    const byUrl = new Map(storage.graves().map((g) => [g.url, g]));
    expect(storage.graves()).toHaveLength(2);
    expect(byUrl.get(url)?.duplicateCount).toBe(3);
    expect(byUrl.get('https://site4.example.com/')?.duplicateCount).toBe(1);
  });

  it('a grave keeps the real lastAccessed, not installedAt', async () => {
    const now = Date.now();
    const installedAt = now - 10 * DAY;
    const realLastAccessed = now - 20 * DAY;
    const storage = fakeStorage({ installedAt });
    const tabs = fakeTabs([makeTab(1, { lastAccessed: realLastAccessed })]);

    expect(await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), true)).toBe(1);
    expect(storage.graves()[0].lastAccessed).toBe(realLastAccessed);
  });
});

describe('buryTab', () => {
  it('buries an active, pinned tab on a protected site', async () => {
    const storage = fakeStorage({ settings: { protectedSites: ['example.com'] } });
    const tabs = fakeTabs([makeTab(1, { active: true, pinned: true, lastAccessed: Date.now() })]);

    expect(await buryTab(storage.adapter, tabs.adapter, fakeExtract(), 1)).toEqual({ ok: true });
    expect(tabs.removeCalls).toEqual([1]);
    expect(storage.stats().buried).toBe(1);
  });

  it('counts the other open tabs with the same url', async () => {
    const storage = fakeStorage();
    const url = 'https://same.example.com/page';
    const tabs = fakeTabs([makeTab(1, { url, active: true }), makeTab(2, { url }), makeTab(3)]);

    expect(await buryTab(storage.adapter, tabs.adapter, fakeExtract(), 1)).toEqual({ ok: true });
    expect(storage.graves()[0].duplicateCount).toBe(2);
  });

  it('refuses private-window and non-http(s) tabs, and reports a missing tab', async () => {
    const storage = fakeStorage();
    const tabs = fakeTabs([
      makeTab(1, { incognito: true }),
      makeTab(2, { url: 'chrome://settings/' }),
    ]);
    const extract = fakeExtract();

    expect(await buryTab(storage.adapter, tabs.adapter, extract, 1)).toEqual({ ok: false, error: 'not-allowed' });
    expect(await buryTab(storage.adapter, tabs.adapter, extract, 2)).toEqual({ ok: false, error: 'not-allowed' });
    expect(await buryTab(storage.adapter, tabs.adapter, extract, 99)).toEqual({ ok: false, error: 'not-found' });
    expect(tabs.removeCalls).toEqual([]);
    expect(storage.graves()).toEqual([]);
  });
});
