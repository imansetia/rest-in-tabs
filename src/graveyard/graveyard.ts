// Graveyard page. Task 11.1: theme only; the scene and graves follow in 11.2+.

import { startTheme } from '../platform/theme.js';
import type { Theme } from '../core/types.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Graveyard markup is missing #${id}`);
  return el as T;
}

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
