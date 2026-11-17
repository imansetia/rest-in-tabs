import type { Theme } from './types.js';

/** A stored theme value, or null when it is missing or not 'night' / 'dusk'. */
export function parseTheme(raw: unknown): Theme | null {
  return raw === 'night' || raw === 'dusk' ? raw : null;
}

/**
 * The theme to show: the stored choice if there is one, otherwise Dusk when
 * the system prefers a light colour scheme and Night otherwise.
 *
 * Validates: Requirement 9.7
 */
export function resolveTheme(stored: Theme | null, systemPrefersLight: boolean): Theme {
  if (stored !== null) return stored;
  return systemPrefersLight ? 'dusk' : 'night';
}
