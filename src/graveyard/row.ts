// Helpers for the Landscape view: one row of plots, and comparing grave lists.

import type { RowLayout } from '../core/layout.js';
import type { Grave } from '../core/types.js';
import { plotElement } from './stone.js';

/** Same graves with the same data, in any order. */
export function sameGraves(a: Grave[], b: Grave[]): boolean {
  const key = (list: Grave[]) => JSON.stringify([...list].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)));
  return a.length === b.length && key(a) === key(b);
}

export function rowElement(row: RowLayout, graves: Grave[], displayNow: number, delays: Map<string, number>): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  el.dataset.s = String(row.scale);
  // CSSOM writes: allowed by the CSP, unlike inline style attributes.
  el.style.setProperty('--s', String(row.scale));
  el.style.setProperty('--veil', String(row.veil));
  el.style.bottom = `${row.bottom}px`;
  el.style.zIndex = String(60 - row.index * 10);
  for (const grave of graves) el.append(plotElement(grave, row.index, displayNow, delays.get(grave.id)));
  return el;
}
