// WCAG AA check of the colour tokens (Requirement 9.4), read straight from
// tokens.css so the test follows any change to the values.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast } from '../core/contrast.js';

const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Tokens per theme
// ---------------------------------------------------------------------------

function block(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`tokens.css has no ${selector} block`);
  const body = tokensCss.slice(start, tokensCss.indexOf('}', start));
  const values: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) values[m[1]] = m[2].toLowerCase();
  return values;
}

const night = block(':root');
const themes = { night, dusk: { ...night, ...block('[data-theme="dusk"]') } };

// Text colours used on the page backgrounds and panels in design/mockup.html.
const TEXT = ['text', 'muted', 'bone', 'bone-dim', 'spectral', 'danger'];
const SURFACES = ['sky-1', 'panel', 'panel-2'];

describe('colour tokens', () => {
  it('the light-system default (before any script) is exactly the Dusk block', () => {
    const early = block(':root:not([data-theme])');
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme\]\) \{/);
    expect(early).toEqual(block('[data-theme="dusk"]'));
    expect(Object.keys(early).length).toBeGreaterThan(5);
  });

  it('match the steering file table', () => {
    expect(themes.night['sky-1']).toBe('#03050b');
    expect(themes.dusk['sky-1']).toBe('#121a2b');
    expect(themes.dusk['panel-2']).toBe('#1c2638');
    expect(themes.dusk.bone).toBe('#ece6d8'); // "same" in both themes
  });

  it('the contrast formula gives known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: every text colour meets AA (4.5:1) on every page surface`, () => {
      const failures: string[] = [];
      for (const fg of TEXT) {
        for (const bg of SURFACES) {
          const ratio = contrast(t[fg], t[bg]);
          if (ratio < 4.5) failures.push(`--${fg} on --${bg}: ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${name}: the focus ring (--spectral) is at least 3:1 against every surface`, () => {
      for (const bg of SURFACES) expect(contrast(t.spectral, t[bg])).toBeGreaterThanOrEqual(3);
    });

    it(`${name}: --bone meets AA on both stone colours (steering: "Text on stone")`, () => {
      expect(contrast(t.bone, t['stone-1'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.bone, t['stone-2'])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
