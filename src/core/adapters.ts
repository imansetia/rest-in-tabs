import type { Grave, Settings, Stats, TabInfo, PageInfo } from './types.js';

// Interfaces for the platform adapters that core orchestration receives as
// parameters. src/platform implements them with chrome.*; tests use fakes.

export interface StorageAdapter {
  getGraves(): Promise<Grave[]>;
  /** For writes that change only graves (exorcise, expiry). */
  setGraves(graves: Grave[]): Promise<void>;
  getSettings(): Promise<Settings>;
  getStats(): Promise<Stats>;
  /** Writes graves and stats in one storage call (burial, resurrect). */
  setGravesAndStats(graves: Grave[], stats: Stats): Promise<void>;
  getInstalledAt(): Promise<number | undefined>;
}

export interface TabsAdapter {
  queryTabs(): Promise<TabInfo[]>;
  /** Returns null when no tab with this id exists any more. */
  getTab(tabId: number): Promise<TabInfo | null>;
  removeTab(tabId: number): Promise<void>;
  createTab(url: string): Promise<unknown>;
}

export interface ExtractAdapter {
  extractPageInfo(tabId: number): Promise<PageInfo>;
}
