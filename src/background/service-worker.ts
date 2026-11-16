import { getInstalledAt, setInstalledAt, getGraves, setGraves, getSettings, getStats, setStats } from '../platform/storage.js';
import { queryTabs, removeTab } from '../platform/tabs.js';
import { extractPageInfo } from '../platform/extract.js';
import { buryTabs } from '../core/burial.js';
import type { StorageAdapter, TabsAdapter, ExtractAdapter } from '../core/burial.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALARM_NAME = 'bury-check';
const ALARM_PERIOD_MINUTES = 1;

// ---------------------------------------------------------------------------
// Platform adapter instances
// ---------------------------------------------------------------------------

const storage: StorageAdapter = {
  getGraves,
  setGraves,
  getSettings,
  getStats,
  setStats,
  getInstalledAt,
};

const tabs: TabsAdapter = {
  queryTabs,
  removeTab,
};

const extract: ExtractAdapter = {
  extractPageInfo,
};

// ---------------------------------------------------------------------------
// Install and startup handlers
// ---------------------------------------------------------------------------

/**
 * On install, update or reload: record the install time once, then register
 * the alarm. installedAt is never overwritten, so updates and dev reloads do
 * not pause automatic burial again.
 */
chrome.runtime.onInstalled.addListener(async () => {
  try {
    if ((await getInstalledAt()) === undefined) {
      await setInstalledAt(Date.now());
    }
  } catch (err) {
    console.error('Could not record install time:', err);
  }
  await registerAlarm();
});

/**
 * On startup, register the alarm (in case it was cleared by browser restart).
 */
chrome.runtime.onStartup.addListener(async () => {
  await registerAlarm();
});

// ---------------------------------------------------------------------------
// Alarm registration
// ---------------------------------------------------------------------------

/**
 * Register the periodic bury-check alarm.
 */
async function registerAlarm(): Promise<void> {
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_PERIOD_MINUTES,
  });
}

// ---------------------------------------------------------------------------
// Alarm handler
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    try {
      const count = await buryTabs(storage, tabs, extract, true);
      if (count > 0) {
        console.log(`Buried ${count} idle tab(s)`);
      }
    } catch (err) {
      console.error('Bury-check alarm failed:', err);
    }
  }
});
