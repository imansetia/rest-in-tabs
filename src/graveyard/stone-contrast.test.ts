// "Text on stone" (design steering file): every text colour on a tombstone is
// --bone. Reads stone.css, so a later edit that brings back --bone-dim, --muted
// or --spectral on a stone fails here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast } from '../core/contrast.js';

const css = readFileSync(new URL('./stone.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** [selector, color value] for every `color:` declaration in a rule about a stone's text. */
function stoneTextColours(): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    if (!selector.includes('.stone') || selector.includes('.fav')) continue; // the medallion's letter sits on its disc
    for (const decl of rule[2].matchAll(/(?<![\w-])color\s*:\s*([^;]+)/g)) found.push([selector, decl[1].trim()]);
  }
  return found;
}

describe('Text on stone', () => {
  it('every text colour on a stone is var(--bone)', () => {
    const colours = stoneTextColours();
    expect(colours.length).toBeGreaterThanOrEqual(3); // .stone, .dates, .cause: not a vacuous pass
    expect(colours.filter(([, value]) => value !== 'var(--bone)')).toEqual([]);
  });

  it('--bone meets AA on the Crumbling stone colour, which is hard-coded in stone.css', () => {
    expect(css).toContain('#434a56');
    expect(contrast('#ece6d8', '#434a56')).toBeGreaterThanOrEqual(4.5);
  });
});
