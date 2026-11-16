// Test-only fakes for the platform adapters. Not imported by production code.

import type { StorageAdapter, TabsAdapter, ExtractAdapter } from './adapters.js';
import { DEFAULT_SETTINGS } from './settings.js';
import type { Grave, Settings, Stats, TabInfo } from './types.js';

export const DAY = 86_400_000;

export function makeTab(id: number, overrides: Partial<TabInfo> = {}): TabInfo {
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

export function makeGrave(id: string, overrides: Partial<Grave> = {}): Grave {
  return {
    id,
    url: `https://grave-${id}.example.com/`,
    title: `Grave ${id}`,
    domain: `grave-${id}.example.com`,
    buriedAt: Date.now(),
    lastAccessed: Date.now() - DAY,
    epitaph: `Epitaph ${id}`,
    epitaphSource: 'title',
    duplicateCount: 1,
    ...overrides,
  };
}

export interface FakeStorageOptions {
  settings?: Partial<Settings>;
  installedAt?: number;
  graves?: Grave[];
  stats?: Stats;
  /** Every write rejects, like a full storage quota. */
  failWrites?: boolean;
}

/** In-memory storage. Values are cloned on read and write, like chrome.storage. */
export function fakeStorage(options: FakeStorageOptions = {}) {
  let graves: Grave[] = structuredClone(options.graves ?? []);
  let stats: Stats = { ...(options.stats ?? { buried: 0, resurrected: 0 }) };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const failIfAsked = () => {
    if (options.failWrites) throw new Error('QUOTA_BYTES quota exceeded');
  };

  const adapter: StorageAdapter = {
    getGraves: async () => structuredClone(graves),
    setGraves: async (next) => {
      failIfAsked();
      graves = structuredClone(next);
    },
    getSettings: async () => structuredClone(settings),
    getStats: async () => ({ ...stats }),
    setGravesAndStats: async (nextGraves, nextStats) => {
      failIfAsked();
      graves = structuredClone(nextGraves);
      stats = { ...nextStats };
    },
    getInstalledAt: async () => options.installedAt,
  };
  return { adapter, graves: () => graves, stats: () => stats };
}

/** Open tabs live in a Map. removeTab closes them and throws on an unknown id, like Chrome. */
export function fakeTabs(initial: TabInfo[], options: { failCreate?: boolean } = {}) {
  const open = new Map(initial.map((t) => [t.id, { ...t }]));
  const removeCalls: number[] = [];
  const createdUrls: string[] = [];
  let nextId = 1000;

  const adapter: TabsAdapter = {
    queryTabs: async () => [...open.values()].map((t) => ({ ...t })),
    getTab: async (id) => {
      const tab = open.get(id);
      return tab ? { ...tab } : null;
    },
    removeTab: async (id) => {
      removeCalls.push(id);
      if (!open.delete(id)) throw new Error(`No tab with id: ${id}.`);
    },
    createTab: async (url) => {
      if (options.failCreate) throw new Error('Tabs cannot be edited right now');
      createdUrls.push(url);
      const id = nextId++;
      open.set(id, makeTab(id, { url, active: true, lastAccessed: Date.now() }));
    },
  };

  /** Simulate the user changing a tab, e.g. switching to it. */
  const update = (id: number, changes: Partial<TabInfo>) => {
    const tab = open.get(id);
    if (tab) open.set(id, { ...tab, ...changes });
  };

  return { adapter, open, removeCalls, createdUrls, update };
}

/** Extraction that returns the title only. onExtract runs while a tab is "being read". */
export function fakeExtract(onExtract?: (tabId: number) => void): ExtractAdapter {
  return {
    extractPageInfo: async (id) => {
      onExtract?.(id);
      return { title: `Page ${id}` };
    },
  };
}
