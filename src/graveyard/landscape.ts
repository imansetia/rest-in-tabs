// Landscape view: graves from storage, sorted newest first, placed in rows by
// layoutRows (Requirement 4.2). Back rows first in the DOM, as in the mockup.

import { getGraves } from '../platform/storage.js';
import { sortGraves } from '../core/decay.js';
import { layoutRows } from '../core/layout.js';
import type { RowLayout } from '../core/layout.js';
import type { Grave } from '../core/types.js';
import { NO_GRAVES_TEXT } from '../core/copy.js';
import { plotElement } from './stone.js';

const RESIZE_DEBOUNCE_MS = 200;

export interface LandscapeElements {
  scene: HTMLElement;
  camera: HTMLElement;
  message: HTMLElement;
}

/**
 * `displayClock` gives the time the page displays with. Each render reads it
 * once, so decay stages and every "x ago" agree (the Demo clock in task 15.1
 * passes a shifted clock).
 */
export function startLandscape(
  els: LandscapeElements,
  displayClock: () => number = () => Date.now(),
): { refresh(): Promise<void>; render(): void } {
  let graves: Grave[] | null = null;

  function render(): void {
    if (graves === null) return; // not read yet: show neither graves nor the empty message
    const displayNow = displayClock();
    const sorted = sortGraves(graves);
    const rows = layoutRows(sorted.length, els.scene.clientWidth, els.scene.clientHeight);

    let next = 0;
    const rowElements = rows.map((row) => {
      const items = sorted.slice(next, next + row.count);
      next += row.count;
      return rowElement(row, items, displayNow);
    });
    els.camera.replaceChildren(...rowElements.reverse());

    els.message.textContent = NO_GRAVES_TEXT;
    els.message.hidden = sorted.length > 0;
  }

  async function refresh(): Promise<void> {
    try {
      graves = await getGraves();
    } catch (err) {
      console.error('Could not read the graves; keeping the last view:', err);
      return;
    }
    render();
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, RESIZE_DEBOUNCE_MS);
  });

  void refresh();
  return { refresh, render };
}

function rowElement(row: RowLayout, graves: Grave[], displayNow: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  el.dataset.s = String(row.scale);
  // CSSOM writes: allowed by the CSP, unlike inline style attributes.
  el.style.setProperty('--s', String(row.scale));
  el.style.setProperty('--veil', String(row.veil));
  el.style.bottom = `${row.bottom}px`;
  el.style.zIndex = String(60 - row.index * 10);
  for (const grave of graves) el.append(plotElement(grave, row.index, displayNow));
  return el;
}
