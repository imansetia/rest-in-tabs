import type { Grave, Settings, Stats } from '../core/types.js';
import { STORAGE_KEYS } from '../core/types.js';
import { normalizeSettings } from '../core/settings.js';
import { parseGrave, normalizeStats } from '../core/validation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StorageChangeListener = () => void;

// ---------------------------------------------------------------------------
// getGraves
// ---------------------------------------------------------------------------

/**
 * Read the Graves list from chrome.storage.local.
 *
 * Each entry goes through parseGrave: malformed Graves are skipped (and
 * dropped on the next write); a missing or bad duplicateCount becomes 1.
 * Returns an empty array if no Graves are stored.
 * Throws if the read fails.
 */
export async function getGraves(): Promise<Grave[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.graves);
  const rawGraves = result[STORAGE_KEYS.graves];

  if (!Array.isArray(rawGraves)) return [];

  return rawGraves.map(parseGrave).filter((g): g is Grave => g !== null);
}

// ---------------------------------------------------------------------------
// setGraves
// ---------------------------------------------------------------------------

/**
 * Write the Graves list to chrome.storage.local.
 *
 * Throws if the write fails.
 */
export async function setGraves(graves: Grave[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.graves]: graves });
}

// ---------------------------------------------------------------------------
// setGravesAndStats
// ---------------------------------------------------------------------------

/**
 * Write graves and stats in one chrome.storage.local.set call, so a burial or
 * resurrection never saves one without the other.
 *
 * Throws if the write fails.
 */
export async function setGravesAndStats(graves: Grave[], stats: Stats): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.graves]: graves,
    [STORAGE_KEYS.stats]: stats,
  });
}

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------

/**
 * Read Settings from chrome.storage.local.
 *
 * The raw value is always passed through normalizeSettings, so the result
 * is guaranteed to be valid. Missing or invalid fields are defaulted.
 * Throws if the read fails.
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

// ---------------------------------------------------------------------------
// setSettings
// ---------------------------------------------------------------------------

/**
 * Write Settings to chrome.storage.local.
 *
 * Throws if the write fails.
 */
export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

/**
 * Read Stats from chrome.storage.local.
 *
 * The raw value is always passed through normalizeStats, so the result
 * is guaranteed to have non-negative integers. Missing or invalid fields
 * default to 0.
 * Throws if the read fails.
 */
export async function getStats(): Promise<Stats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.stats);
  return normalizeStats(result[STORAGE_KEYS.stats]);
}

// ---------------------------------------------------------------------------
// setStats
// ---------------------------------------------------------------------------

/**
 * Write Stats to chrome.storage.local.
 *
 * Throws if the write fails.
 */
export async function setStats(stats: Stats): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.stats]: stats });
}

// ---------------------------------------------------------------------------
// getInstalledAt
// ---------------------------------------------------------------------------

/**
 * Read installedAt from chrome.storage.local.
 *
 * Returns undefined if not set (should only happen before onInstalled runs).
 * Throws if the read fails.
 */
export async function getInstalledAt(): Promise<number | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.installedAt);
  const value = result[STORAGE_KEYS.installedAt];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// setInstalledAt
// ---------------------------------------------------------------------------

/**
 * Write installedAt to chrome.storage.local.
 *
 * Throws if the write fails.
 */
export async function setInstalledAt(timestamp: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.installedAt]: timestamp });
}

// ---------------------------------------------------------------------------
// onChanged subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to storage changes.
 *
 * The listener is called whenever any of the extension's storage keys
 * (graves, settings, stats) are modified in chrome.storage.local.
 *
 * Returns an unsubscribe function.
 */
export function onStorageChanged(listener: StorageChangeListener): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    // Only fire for chrome.storage.local changes to our keys.
    if (areaName !== 'local') return;
    if (
      STORAGE_KEYS.graves in changes ||
      STORAGE_KEYS.settings in changes ||
      STORAGE_KEYS.stats in changes
    ) {
      listener();
    }
  };

  chrome.storage.onChanged.addListener(handler);

  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}
