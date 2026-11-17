// Popup: sends requests to the service worker and shows the results.
// It reads the grave count but never writes storage.

import { getGraves, onStorageChanged } from '../platform/storage.js';
import { getActiveTab } from '../platform/tabs.js';
import { sendMessage } from '../platform/messaging.js';
import { startTheme } from '../platform/theme.js';
import { manualBurialBlock } from '../core/selection.js';
import {
  errorText,
  blockReasonText,
  tabsAtRestText,
  lastBuriedText,
  buryIdleResultText,
  idleButtonState,
  WORKING_TEXT,
  BURY_TAB_DONE_TEXT,
  COUNT_UNAVAILABLE_TEXT,
} from '../core/copy.js';
import type { Message, MessageResponse } from '../core/messages.js';
import type { TabInfo } from '../core/types.js';

type Success = Extract<MessageResponse, { ok: true }>;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Popup markup is missing #${id}`);
  return el as T;
}

const countEl = byId('grave-count');
const lastEl = byId('last');
const lastEpitaphEl = byId('last-epitaph');
const buryThisButton = byId<HTMLButtonElement>('bury-this');
const buryThisReason = byId('bury-this-reason');
const buryIdleButton = byId<HTMLButtonElement>('bury-idle');
const statusEl = byId('status');

let currentTab: TabInfo | null = null;
let tabLoaded = false;
let busy = false;
/** Last countIdle reply; null until the first one arrives. */
let idleCount: number | null = null;
/** Only the newest countIdle request may update idleCount. */
let countRequest = 0;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * aria-disabled (not the disabled attribute) keeps the buttons focusable, so
 * screen reader users still reach "Bury this tab" and hear why it is
 * unavailable, and focus is not lost while a request runs.
 */
function setUnavailable(button: HTMLButtonElement, unavailable: boolean): void {
  button.setAttribute('aria-disabled', String(unavailable));
}

function isUnavailable(button: HTMLButtonElement): boolean {
  return button.getAttribute('aria-disabled') === 'true';
}

function render(): void {
  const block = tabLoaded ? manualBurialBlock(currentTab) : null;
  setUnavailable(buryThisButton, busy || !tabLoaded || block !== null);
  const idle = idleButtonState(idleCount);
  buryIdleButton.textContent = idle.label;
  setUnavailable(buryIdleButton, busy || !idle.available);
  buryThisReason.textContent = block === null ? '' : blockReasonText(block);
  buryThisReason.hidden = block === null;
}

function setStatus(text: string, isError: boolean): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** "<b>26</b> tabs at rest" and the newest Epitaph under "Last buried". */
async function refreshCount(): Promise<void> {
  try {
    const graves = await getGraves();
    const { number, words } = tabsAtRestText(graves.length);
    const bold = document.createElement('b');
    bold.textContent = number;
    countEl.replaceChildren(bold, ` ${words}`);
    lastEpitaphEl.textContent = lastBuriedText(graves);
    lastEl.hidden = false;
  } catch (err) {
    console.error('Could not read graves:', err);
    countEl.textContent = COUNT_UNAVAILABLE_TEXT;
    lastEl.hidden = true; // no false "Nothing yet."
  }
}

async function refreshCurrentTab(): Promise<void> {
  try {
    currentTab = await getActiveTab();
  } catch (err) {
    console.error('Could not read the current tab:', err);
    currentTab = null;
  }
  tabLoaded = true;
  render();
}

/**
 * Ask the service worker how many tabs the idle button would bury. If the
 * request fails, the last count stays (or none, so the label reads
 * "Bury idle tabs" and the button stays usable).
 */
async function refreshIdleCount(): Promise<void> {
  const mine = ++countRequest;
  const response = await sendMessage({ type: 'countIdle' });
  if (mine !== countRequest) return; // a newer request was sent meanwhile
  if (response.ok && response.count !== undefined) idleCount = response.count;
  render();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Send one request. Both buttons stay unavailable until it settles, because
 * "Bury this tab" can wait behind a burial run that is already in progress.
 */
async function run(message: Message, successText: (response: Success) => string): Promise<void> {
  busy = true;
  render();
  setStatus(WORKING_TEXT, false);

  const response = await sendMessage(message);

  busy = false;
  if (response.ok) {
    setStatus(successText(response), false);
  } else {
    setStatus(errorText(response.error), true);
  }
  // After a burial the active tab of this window may be a different one, and
  // fewer tabs are idle.
  await Promise.all([refreshCurrentTab(), refreshIdleCount()]);
}

buryThisButton.addEventListener('click', () => {
  if (isUnavailable(buryThisButton) || currentTab === null) return;
  void run({ type: 'buryTab', tabId: currentTab.id }, () => BURY_TAB_DONE_TEXT);
});

buryIdleButton.addEventListener('click', () => {
  if (isUnavailable(buryIdleButton)) return;
  void run({ type: 'buryIdle' }, (response) => buryIdleResultText(response.count ?? 0));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

startTheme();
onStorageChanged(() => {
  void refreshCount();
});
render();
void refreshCount();
void refreshCurrentTab();
void refreshIdleCount();
