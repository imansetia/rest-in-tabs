// Thin wiring layer: connects chrome.* events to core orchestration.
// No decision logic lives here.

import {
  getInstalledAt,
  setInstalledAt,
  getGraves,
  setGraves,
  getSettings,
  getStats,
  setGravesAndStats,
} from '../platform/storage.js';
import { queryTabs, getTab, removeTab, createTab } from '../platform/tabs.js';
import { extractPageInfo } from '../platform/extract.js';
import type { StorageAdapter, TabsAdapter, ExtractAdapter } from '../core/adapters.js';
import { buryTabs, buryTab, countIdleTabs } from '../core/burial.js';
import { resurrect, exorcise, expireGraves } from '../core/grave-actions.js';
import { parseMessage } from '../core/messages.js';
import type { Message, MessageResponse } from '../core/messages.js';

const ALARM_NAME = 'bury-check';
const ALARM_PERIOD_MINUTES = 1;

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const storage: StorageAdapter = {
  getGraves,
  setGraves,
  getSettings,
  getStats,
  setGravesAndStats,
  getInstalledAt,
};

const tabs: TabsAdapter = { queryTabs, getTab, removeTab, createTab };

const extract: ExtractAdapter = { extractPageInfo };

// ---------------------------------------------------------------------------
// Install, startup, alarm
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

chrome.runtime.onStartup.addListener(async () => {
  await registerAlarm();
});

async function registerAlarm(): Promise<void> {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  try {
    await expireGraves(storage);
  } catch (err) {
    console.error('Expiry failed:', err);
  }

  try {
    await buryTabs(storage, tabs, extract, true);
  } catch (err) {
    console.error('Automatic burial failed:', err);
  }
});

// ---------------------------------------------------------------------------
// Messages from the Popup and Graveyard
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  // Accept messages only from this extension's own pages.
  const fromOwnPage =
    sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('')) === true;
  if (!fromOwnPage) return false;

  const message = parseMessage(raw);
  if (message === null) {
    sendResponse({ ok: false, error: 'bad-request' } satisfies MessageResponse);
    return false;
  }

  handleMessage(message).then(sendResponse, (err: unknown) => {
    console.error(`Message ${message.type} failed:`, err);
    sendResponse({ ok: false, error: 'failed' } satisfies MessageResponse);
  });
  return true; // keep the channel open for the async response
});

async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'buryTab':
      return buryTab(storage, tabs, extract, message.tabId);
    case 'buryIdle':
      return { ok: true, count: await buryTabs(storage, tabs, extract, false) };
    case 'countIdle':
      return { ok: true, count: await countIdleTabs(storage, tabs) };
    case 'resurrect':
      return resurrect(storage, tabs, message.graveId);
    case 'exorcise':
      return exorcise(storage, message.graveId);
  }
}
