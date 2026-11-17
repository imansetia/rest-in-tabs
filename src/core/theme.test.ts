import { describe, it, expect } from 'vitest';
import { parseTheme, resolveTheme } from './theme.js';

describe('parseTheme', () => {
  it('accepts night and dusk only', () => {
    expect(parseTheme('night')).toBe('night');
    expect(parseTheme('dusk')).toBe('dusk');
    for (const raw of [undefined, null, '', 'light', 'dark', 'Night', 1, {}]) {
      expect(parseTheme(raw)).toBeNull();
    }
  });
});

describe('resolveTheme', () => {
  it('follows the system when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dusk');
    expect(resolveTheme(null, false)).toBe('night');
  });

  it('a stored choice wins over the system', () => {
    expect(resolveTheme('night', true)).toBe('night');
    expect(resolveTheme('dusk', false)).toBe('dusk');
  });
});
