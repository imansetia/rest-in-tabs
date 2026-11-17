import type { Theme } from '../core/types.js';
import { STORAGE_KEYS } from '../core/types.js';
import { parseTheme, resolveTheme } from '../core/theme.js';

// Theme adapter: chrome.storage.local (the choice), matchMedia (the system
// default) and the page's data-theme attribute. Decisions live in core/theme.ts.

export interface ThemeController {
  /** The theme currently applied to this page. */
  current(): Theme;
  /** Apply a choice now and remember it on this device for all extension pages. */
  choose(theme: Theme): Promise<void>;
}

const prefersLight = () => matchMedia('(prefers-color-scheme: light)');

/**
 * Apply the theme to this page and keep it current:
 * - at once from the system colour scheme, then from the stored choice once read;
 * - when another extension page changes the choice;
 * - when the system scheme changes while no choice is stored.
 *
 * `onApply` runs every time a theme is applied (e.g. to update aria-pressed).
 */
export function startTheme(onApply: (theme: Theme) => void = () => {}): ThemeController {
  let stored: Theme | null = null;
  let applied: Theme = 'night';

  const apply = () => {
    applied = resolveTheme(stored, prefersLight().matches);
    document.documentElement.dataset.theme = applied;
    onApply(applied);
  };

  apply();
  chrome.storage.local.get(STORAGE_KEYS.theme).then(
    (result) => {
      stored = parseTheme(result[STORAGE_KEYS.theme]);
      apply();
    },
    (err: unknown) => console.error('Could not read the theme; following the system:', err),
  );
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(STORAGE_KEYS.theme in changes)) return;
    stored = parseTheme(changes[STORAGE_KEYS.theme].newValue);
    apply();
  });
  prefersLight().addEventListener('change', apply);

  return {
    current: () => applied,
    async choose(theme) {
      stored = theme;
      apply();
      // If saving fails, this page keeps the choice until it is reloaded.
      await chrome.storage.local.set({ [STORAGE_KEYS.theme]: theme });
    },
  };
}
