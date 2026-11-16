import { describe, it, expect, vi, afterEach } from 'vitest';
import { buryTabs } from './burial.js';
import type { StorageAdapter, TabsAdapter, ExtractAdapter } from './burial.js';
import { DEFAULT_SETTINGS } from './settings.js';
import type { Grave, Settings, Stats, TabInfo } from './types.js';

// ---------------------------------------------------------------------------
// Fake adapters
// ---------------------------------------------------------------------------

function makeTab(id: number, overrides: Partial<TabInfo> = {}): TabInfo {
  return {
    id,
    url: `https://site${id}.example.com/`,
    title: `Tab ${id}`,
    active: false,
    pinned: false,
    audible: false,
    incognito: false,
    lastAccessed: 0, // idle for decades
    ...overrides,
  };
}

interface FakeStorageOptions {
  settings?: Partial<Settings>;
  installedAt?: number;
  failSetGraves?: boolean;
}

function fakeStorage(options: FakeStorageOptions = {}) {
  let graves: Grave[] = [];
  let stats: Stats = { buried: 0, resurrected: 0 };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...options.settings };

  const adapter: StorageAdapter = {
    getGraves: async () => structuredClone(graves),
    setGraves: async (next) => {
      if (options.failSetGraves) throw new Error('QUOTA_BYTES quota exceeded');
      graves = structuredClone(next);
    },
    getSettings: async () => structuredClone(settings),
    getStats: async () => ({ ...stats }),
    setStats: async (next) => {
      stats = { ...next };
    },
    getInstalledAt: async () => options.installedAt,
  };
  return { adapter, graves: () => graves, stats: () => stats };
}

/** Open tabs live in a Map; removeTab closes them and throws on an unknown id, like Chrome. */
function fakeTabs(initial: TabInfo[]) {
  const open = new Map(initial.map((t) => [t.id, t]));
  const removeCalls: number[] = [];

  const adapter: TabsAdapter = {
    queryTabs: async () => [...open.values()],
    removeTab: async (id) => {
      removeCalls.push(id);
      if (!open.delete(id)) throw new Error(`No tab with id: ${id}.`);
    },
  };
  return { adapter, open, removeCalls };
}

const extract: ExtractAdapter = {
  extractPageInfo: async (id) => ({ title: `Page ${id}` }),
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buryTabs', () => {
  it('two overlapping runs bury each idle tab exactly once', async () => {
    const storage = fakeStorage({ installedAt: 0 });
    const tabs = fakeTabs([makeTab(1), makeTab(2), makeTab(3)]);

    const [first, second] = await Promise.all([
      buryTabs(storage.adapter, tabs.adapter, extract, true),
      buryTabs(storage.adapter, tabs.adapter, extract, true),
    ]);

    expect(first + second).toBe(3);
    expect(storage.stats().buried).toBe(3);
    expect([...tabs.removeCalls].sort()).toEqual([1, 2, 3]);
    expect(storage.graves().map((g) => g.url).sort()).toEqual([
      'https://site1.example.com/',
      'https://site2.example.com/',
      'https://site3.example.com/',
    ]);
    expect(tabs.open.size).toBe(0);
  });

  it('a manual run buries idle tabs when Auto-Bury is off; an automatic run does not', async () => {
    // installedAt = now: an automatic run would also be held back by Req 1.7,
    // while a manual run must use the real lastAccessed.
    const storage = fakeStorage({ settings: { autoBury: false }, installedAt: Date.now() });
    const tabs = fakeTabs([makeTab(1), makeTab(2, { active: true })]);

    expect(await buryTabs(storage.adapter, tabs.adapter, extract, true)).toBe(0);
    expect(tabs.removeCalls).toEqual([]);

    expect(await buryTabs(storage.adapter, tabs.adapter, extract, false)).toBe(1);
    expect(tabs.removeCalls).toEqual([1]); // the active tab stays protected
    expect(storage.stats().buried).toBe(1);
    expect(storage.graves()).toHaveLength(1);
  });

  it('a failed save leaves the tab open and stats unchanged', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = fakeStorage({ installedAt: 0, failSetGraves: true });
    const tabs = fakeTabs([makeTab(1)]);

    const saved = await buryTabs(storage.adapter, tabs.adapter, extract, true);

    expect(saved).toBe(0);
    expect(tabs.removeCalls).toEqual([]);
    expect(tabs.open.has(1)).toBe(true);
    expect(storage.stats().buried).toBe(0);
    expect(storage.graves()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });
});
