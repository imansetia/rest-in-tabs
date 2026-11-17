// Options page (task 12, Requirement 8): Auto-Bury, Idle Threshold, Protected
// Sites, Retention Period and the Demo setting. Each change is checked with
// validateSetting and saved at once; the service worker reads the settings at
// every check, so it applies from the next one (Requirement 8.2). A value
// outside its range is not saved: the field shows the allowed range (8.3).

import { startTheme } from '../platform/theme.js';
import { getSettings, setSettings, onStorageChanged } from '../platform/storage.js';
import { normalizeSettings, validateSetting } from '../core/settings.js';
import { idleForDisplay, idleMinutesFrom, parseIdleUnit, rangeErrorText } from '../core/options-form.js';
import { errorText } from '../core/copy.js';
import type { Settings } from '../core/types.js';
import { startSites } from './sites.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Options markup is missing #${id}`);
  return el as T;
}

const els = {
  form: byId<HTMLFormElement>('form'),
  loading: byId('loading'),
  status: byId('status'),
  autoBury: byId<HTMLInputElement>('auto-bury'),
  idleAmount: byId<HTMLInputElement>('idle-amount'),
  idleUnit: byId<HTMLSelectElement>('idle-unit'),
  idleError: byId('idle-error'),
  siteInput: byId<HTMLInputElement>('site-input'),
  siteAdd: byId<HTMLButtonElement>('site-add'),
  siteError: byId('site-error'),
  sites: byId<HTMLUListElement>('sites'),
  sitesEmpty: byId('sites-empty'),
  retentionDays: byId<HTMLInputElement>('retention-days'),
  retentionNever: byId<HTMLInputElement>('retention-never'),
  retentionError: byId('retention-error'),
  demo: byId<HTMLInputElement>('demo'),
};

const SAVED_TEXT = 'Saved.';
const READ_FAILED_TEXT = 'Could not read the settings. Please reopen this page.';

let current: Settings | null = null;
let statusTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(text: string, isError = false): void {
  clearTimeout(statusTimer);
  els.status.textContent = text;
  els.status.classList.toggle('error', isError);
  if (!isError) statusTimer = setTimeout(() => (els.status.textContent = ''), 2800);
}

function showError(input: HTMLInputElement, errorEl: HTMLElement, text: string): void {
  errorEl.textContent = text;
  input.setAttribute('aria-invalid', String(text !== ''));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Put the stored values in the form. Fields the user is editing keep what they typed. */
function render(settings: Settings): void {
  const editing = document.activeElement;
  els.autoBury.checked = settings.autoBury;
  if (editing !== els.idleAmount && editing !== els.idleUnit) {
    const idle = idleForDisplay(settings.idleMinutes);
    els.idleAmount.value = String(idle.amount);
    els.idleUnit.value = idle.unit;
    showError(els.idleAmount, els.idleError, '');
  }
  els.retentionNever.checked = settings.retentionDays === null;
  els.retentionDays.disabled = settings.retentionDays === null;
  // With "Never" the field keeps its last number, so unticking Never brings it back.
  if (settings.retentionDays !== null && editing !== els.retentionDays) {
    els.retentionDays.value = String(settings.retentionDays);
    showError(els.retentionDays, els.retentionError, '');
  }
  els.demo.checked = settings.demo;
  sites.render(settings.protectedSites);
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** Save one changed value (already validated). On failure the form shows the stored values again. */
async function save(change: Partial<Settings>): Promise<boolean> {
  if (current === null) return false;
  const next = normalizeSettings({ ...current, ...change });
  try {
    await setSettings(next);
    current = next;
    setStatus(SAVED_TEXT);
    return true;
  } catch (err) {
    console.error('Could not save the settings:', err);
    setStatus(errorText('save-failed'), true);
    render(current);
    return false;
  }
}

function saveIdle(): void {
  const minutes = idleMinutesFrom(els.idleAmount.valueAsNumber, parseIdleUnit(els.idleUnit.value));
  const check = validateSetting('idleMinutes', minutes);
  if (!check.ok) {
    showError(els.idleAmount, els.idleError, rangeErrorText(check.range));
    return;
  }
  showError(els.idleAmount, els.idleError, '');
  void save({ idleMinutes: minutes });
}

function saveRetention(): void {
  if (els.retentionNever.checked) return;
  const days = els.retentionDays.valueAsNumber;
  const check = validateSetting('retentionDays', days);
  if (!check.ok) {
    showError(els.retentionDays, els.retentionError, rangeErrorText(check.range));
    return;
  }
  showError(els.retentionDays, els.retentionError, '');
  void save({ retentionDays: days });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const sites = startSites(
  { input: els.siteInput, add: els.siteAdd, error: els.siteError, list: els.sites, empty: els.sitesEmpty },
  () => current?.protectedSites ?? null,
  (next) => save({ protectedSites: next }),
  showError,
);

els.form.addEventListener('submit', (event) => event.preventDefault());
els.autoBury.addEventListener('change', () => void save({ autoBury: els.autoBury.checked }));
els.idleAmount.addEventListener('change', saveIdle);
els.idleUnit.addEventListener('change', saveIdle);
els.retentionDays.addEventListener('change', saveRetention);
els.retentionNever.addEventListener('change', () => {
  els.retentionDays.disabled = els.retentionNever.checked;
  if (els.retentionNever.checked) {
    showError(els.retentionDays, els.retentionError, '');
    void save({ retentionDays: null });
  } else {
    // Back to a number of days: the one typed, or the default if the field is empty.
    if (els.retentionDays.value === '') els.retentionDays.value = '30';
    saveRetention();
    els.retentionDays.focus();
  }
});
els.demo.addEventListener('change', () => void save({ demo: els.demo.checked }));

// Another Options page (or a future writer) changed the settings: show them.
// Our own saves come back here too; those change nothing, so the form is left alone.
onStorageChanged((keys) => {
  if (!keys.includes('settings')) return;
  getSettings().then(
    (settings) => {
      if (JSON.stringify(settings) === JSON.stringify(current)) return;
      current = settings;
      render(settings);
    },
    (err: unknown) => console.error('Could not read the settings:', err),
  );
});

startTheme();
getSettings().then(
  (settings) => {
    current = settings;
    render(settings);
    els.loading.hidden = true;
    els.form.hidden = false;
  },
  (err: unknown) => {
    console.error('Could not read the settings:', err);
    els.loading.textContent = READ_FAILED_TEXT;
  },
);
