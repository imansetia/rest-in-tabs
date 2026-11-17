// Graveyard page: wires the header modules to the page and to storage changes.
// The scene and graves follow in tasks 11.3 and later.

import { startTheme } from '../platform/theme.js';
import { onStorageChanged } from '../platform/storage.js';
import type { Theme } from '../core/types.js';
import { createToast } from './toast.js';
import { startStats } from './stats.js';
import { startIdleButton } from './idle-button.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Graveyard markup is missing #${id}`);
  return el as T;
}

// ---------------------------------------------------------------------------
// Theme switch
// ---------------------------------------------------------------------------

const themeButtons: Record<Theme, HTMLButtonElement> = {
  night: byId<HTMLButtonElement>('th-night'),
  dusk: byId<HTMLButtonElement>('th-dusk'),
};

const theme = startTheme((current) => {
  for (const [name, button] of Object.entries(themeButtons)) {
    button.setAttribute('aria-pressed', String(name === current));
  }
});

for (const [name, button] of Object.entries(themeButtons) as Array<[Theme, HTMLButtonElement]>) {
  button.addEventListener('click', () => {
    theme.choose(name).catch((err: unknown) => console.error('Could not save the theme:', err));
  });
}

// ---------------------------------------------------------------------------
// Header: stats and the idle button
// ---------------------------------------------------------------------------

const toast = createToast(byId('toast'));

const stats = startStats({
  group: byId('stats'),
  buried: byId('st-buried'),
  resurrected: byId('st-res'),
  memory: byId('st-ram'),
});

const idleButton = startIdleButton(byId<HTMLButtonElement>('bury-idle'), toast);

// Live updates (Requirement 4.7). Settings changes (threshold, protected
// sites) change the idle count as well as graves do.
onStorageChanged((keys) => {
  if (keys.includes('stats')) void stats.refresh();
  if (keys.includes('graves') || keys.includes('settings')) void idleButton.refresh();
});
