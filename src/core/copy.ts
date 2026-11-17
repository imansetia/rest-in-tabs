import type { ErrorCode } from './messages.js';
import type { ManualBlockReason } from './selection.js';

// User-facing text for the Popup (and later the Graveyard). Plain and short:
// puns belong in epitaphs, not in buttons or errors.

const ERROR_TEXT: Record<ErrorCode, string> = {
  'bad-request': 'The request was not understood. Please try again.',
  'not-found': 'That tab or grave is no longer there.',
  'not-allowed': 'This page cannot be buried.',
  'open-failed': 'Could not reopen this page.',
  'save-failed': 'Could not save the change. Nothing was lost.',
  failed: 'Something went wrong. Please try again.',
};

const BLOCK_TEXT: Record<ManualBlockReason, string> = {
  'no-tab': 'There is no tab to bury here.',
  private: 'Tabs in private windows are never buried.',
  'unsupported-page': 'Only web pages (http or https) can be buried.',
};

export const WORKING_TEXT = 'Working…';
export const BURY_TAB_DONE_TEXT = 'Tab buried.';
export const COUNT_UNAVAILABLE_TEXT = 'Could not read the graveyard.';

export function errorText(code: ErrorCode): string {
  return ERROR_TEXT[code];
}

export function blockReasonText(reason: ManualBlockReason): string {
  return BLOCK_TEXT[reason];
}

export function graveCountText(count: number): string {
  if (count === 0) return 'No graves yet.';
  if (count === 1) return '1 grave';
  return `${count.toLocaleString('en-US')} graves`;
}

/**
 * Label and availability of the "Bury N idle tabs" button (Requirements 2.2,
 * 4.10). `count` is the last countIdle reply, or null before the first reply
 * (or when every request so far failed): the button then reads
 * "Bury idle tabs" and stays usable, because burying does not need the count.
 */
export function idleButtonState(count: number | null): { label: string; available: boolean } {
  if (count === null) return { label: 'Bury idle tabs', available: true };
  if (count === 0) return { label: 'No idle tabs to bury', available: false };
  if (count === 1) return { label: 'Bury 1 idle tab', available: true };
  return { label: `Bury ${count.toLocaleString('en-US')} idle tabs`, available: true };
}

/** Whole numbers in the stats bar: "46", "1,204". */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Memory amount, as the mockup's fmtRam: whole MB below 1,000 MB, otherwise
 * GB with one decimal ("950 MB", "1.0 GB", "2.3 GB").
 */
export function formatMemory(mb: number): string {
  if (mb < 1000) return `${Math.round(mb)} MB`;
  const gb = mb / 1000;
  return `${gb.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

/** The stats-bar memory figure, always labelled as an estimate (Requirement 7.2). */
export function freedMemoryText(mb: number): string {
  return `≈ ${formatMemory(mb)} freed (estimated)`;
}

/** Toast after the idle button. "Bury this tab" uses BURY_TAB_DONE_TEXT instead. */
export function buryIdleResultText(count: number): string {
  if (count === 0) return 'No idle tabs to bury.';
  if (count === 1) return 'Buried 1 idle tab.';
  return `Buried ${count.toLocaleString('en-US')} idle tabs.`;
}
