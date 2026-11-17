// Landscape view: graves from storage, sorted newest first, placed in rows by
// layoutRows (Requirement 4.2). Back rows first in the DOM, as in the mockup.

import { getGraves } from '../platform/storage.js';
import { sortGraves } from '../core/decay.js';
import { layoutRows, plotJitter } from '../core/layout.js';
import type { RowLayout } from '../core/layout.js';
import type { Grave } from '../core/types.js';
import { NO_GRAVES_TEXT } from '../core/copy.js';

const RESIZE_DEBOUNCE_MS = 200;

export interface LandscapeElements {
  scene: HTMLElement;
  camera: HTMLElement;
  message: HTMLElement;
}

export function startLandscape(els: LandscapeElements): { refresh(): Promise<void> } {
  let graves: Grave[] | null = null;

  function render(): void {
    if (graves === null) return; // not read yet: show neither graves nor the empty message
    const sorted = sortGraves(graves);
    const rows = layoutRows(sorted.length, els.scene.clientWidth, els.scene.clientHeight);

    let next = 0;
    const rowElements = rows.map((row) => {
      const items = sorted.slice(next, next + row.count);
      next += row.count;
      return rowElement(row, items);
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
  return { refresh };
}

function rowElement(row: RowLayout, graves: Grave[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  el.dataset.s = String(row.scale);
  // CSSOM writes: allowed by the CSP, unlike inline style attributes.
  el.style.setProperty('--s', String(row.scale));
  el.style.setProperty('--veil', String(row.veil));
  el.style.bottom = `${row.bottom}px`;
  el.style.zIndex = String(60 - row.index * 10);
  for (const grave of graves) el.append(plotElement(grave, row.index));
  return el;
}

function plotElement(grave: Grave, depth: number): HTMLElement {
  const jitter = plotJitter(grave.id);
  const plot = document.createElement('div');
  plot.className = 'plot';
  plot.dataset.id = grave.id;
  plot.style.setProperty('--d', String(depth));
  plot.style.setProperty('--tilt', `${jitter.tiltDeg}deg`);
  plot.style.setProperty('--jy', `${jitter.offsetPx}px`);

  const mound = document.createElement('span');
  mound.className = 'mound';
  // Task 11.4 turns this into a <button> with the grave's details and decay look.
  const stone = document.createElement('div');
  stone.className = 'stone';
  plot.append(mound, stone);
  return plot;
}
