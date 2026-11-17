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
export interface Landscape {
  refresh(): Promise<void>;
  render(): void;
  /** The grave shown with this id, if any. */
  grave(id: string): Grave | undefined;
  /** All graves currently known (empty until the first read). */
  graves(): Grave[];
  /** Run after every render (search re-applies its matches). */
  onRender(callback: () => void): void;
  /** Run whenever the graves are read, even when the landscape does not re-render (the List view). */
  onData(callback: () => void): void;
  /**
   * Call before sending resurrect/exorcise for this grave. While it is
   * expected to leave, a storage change that only removes it does not
   * re-render, so its plot can show soil or bare ground (Requirement 4.11).
   */
  expectLeaving(id: string): void;
  /** The request failed: stop expecting the grave to leave. */
  cancelLeaving(id: string): void;
  /** Show the plot as fresh empty soil ('emptied') or bare ground ('gone'). */
  vacate(id: string, look: 'emptied' | 'gone'): void;
}

export function startLandscape(
  els: LandscapeElements,
  displayClock: () => number = () => Date.now(),
): Landscape {
  let graves: Grave[] | null = null;
  const leaving = new Set<string>();
  const renderListeners: Array<() => void> = [];
  const dataListeners: Array<() => void> = [];

  function render(): void {
    if (graves === null) return; // not read yet: show neither graves nor the empty message
    leaving.clear(); // a re-render ends every soil or bare-ground plot
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
    for (const listener of renderListeners) listener();
  }

  async function refresh(): Promise<void> {
    let next: Grave[];
    try {
      next = await getGraves();
    } catch (err) {
      console.error('Could not read the graves; keeping the last view:', err);
      return;
    }
    const onlyLeaversGone =
      graves !== null && leaving.size > 0 && sameGraves(graves.filter((g) => !leaving.has(g.id)), next);
    graves = next;
    if (!onlyLeaversGone) render();
    for (const listener of dataListeners) listener();
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, RESIZE_DEBOUNCE_MS);
  });

  void refresh();
  return {
    refresh,
    render,
    grave: (id) => graves?.find((g) => g.id === id),
    graves: () => graves ?? [],
    onRender: (callback) => void renderListeners.push(callback),
    onData: (callback) => void dataListeners.push(callback),
    expectLeaving: (id) => void leaving.add(id),
    cancelLeaving: (id) => void leaving.delete(id),
    vacate(id, look) {
      const plot = els.camera.querySelector(`.plot[data-id="${CSS.escape(id)}"]`);
      plot?.classList.add(look);
    },
  };
}

/** Same graves with the same data, in any order. */
function sameGraves(a: Grave[], b: Grave[]): boolean {
  const key = (list: Grave[]) => JSON.stringify([...list].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)));
  return a.length === b.length && key(a) === key(b);
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
