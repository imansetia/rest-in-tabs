// Landscape view: graves from storage, sorted newest first, placed in rows by
// layoutRows (Requirement 4.2). Front row first in the page (Tab order: newest
// first); rows stack visually by z-index, as in the mockup.
// Graves that are new since the last read rise in a mass burial (task 11.8).

import { getGraves } from '../platform/storage.js';
import { sortGraves } from '../core/decay.js';
import { layoutRows, graveRows } from '../core/layout.js';
import { riseDelays } from '../core/burial-motion.js';
import type { Grave } from '../core/types.js';
import { NO_GRAVES_TEXT } from '../core/copy.js';
import { rowElement, sameGraves } from './row.js';
import { playMassBurial } from './mass-burial.js';
import type { Landscape, LandscapeElements } from './landscape-api.js';

export type { Landscape, LandscapeElements } from './landscape-api.js';

const RESIZE_DEBOUNCE_MS = 200;

/**
 * `displayClock` gives the time the page displays with. Each render reads it
 * once, so decay stages and every "x ago" agree (the Demo clock in task 15.1
 * passes a shifted clock).
 */
export function startLandscape(els: LandscapeElements, displayClock: () => number = () => Date.now()): Landscape {
  let graves: Grave[] | null = null;
  const leaving = new Set<string>();
  const listeners = { render: [] as Array<() => void>, data: [] as Array<() => void>, burial: [] as Array<() => void> };
  let holds = 0;
  let animating = false;
  let refreshWaiting = false;
  let reading = 0; // refreshes past the hold check and not yet finished
  let settledWaiters: Array<() => void> = [];

  function checkSettled(): void {
    if (animating || holds > 0 || refreshWaiting || reading > 0) return;
    const waiters = settledWaiters;
    settledWaiters = [];
    for (const resolve of waiters) resolve();
  }

  function render(rising: ReadonlySet<string> = new Set()): void {
    if (graves === null) return; // not read yet: show neither graves nor the empty message
    leaving.clear(); // a re-render ends every soil or bare-ground plot
    const displayNow = displayClock();
    const sorted = sortGraves(graves);
    const delays = riseDelays(sorted.map((g) => g.id), rising);
    const rows = layoutRows(sorted.length, els.scene.clientWidth, els.scene.clientHeight);

    // A live update (e.g. an AI epitaph) replaces every stone: keep focus on the same grave.
    const focusedId = document.activeElement?.closest<HTMLElement>('#camera .plot')?.dataset.id;
    // Front row first in the page, so Tab reaches the newest graves first.
    els.camera.replaceChildren(...graveRows(sorted, rows).map(({ row, graves: items }) => rowElement(row, items, displayNow, delays)));
    if (focusedId !== undefined) {
      els.camera.querySelector<HTMLElement>(`.plot[data-id="${CSS.escape(focusedId)}"] .stone`)?.focus({ preventScroll: true });
    }

    els.message.textContent = NO_GRAVES_TEXT;
    els.message.hidden = sorted.length > 0;
    for (const listener of listeners.render) listener();
  }

  async function refresh(): Promise<void> {
    // Storage-driven re-renders wait until a running animation (or a hold) ends.
    if (animating || holds > 0) {
      refreshWaiting = true;
      return;
    }
    reading++;
    try {
      await readAndShow();
    } finally {
      reading--;
      checkSettled();
    }
  }

  async function readAndShow(): Promise<void> {
    let next: Grave[];
    try {
      next = await getGraves();
    } catch (err) {
      console.error('Could not read the graves; keeping the last view:', err);
      return;
    }
    // Another read started an animation while this one waited: read again after it.
    if (animating) {
      refreshWaiting = true;
      return;
    }
    const known = graves === null ? null : new Set(graves.map((g) => g.id));
    const arrived = new Set(known === null ? [] : next.filter((g) => !known.has(g.id)).map((g) => g.id));
    const onlyLeaversGone =
      graves !== null && leaving.size > 0 && sameGraves(graves.filter((g) => !leaving.has(g.id)), next);
    graves = next;
    for (const listener of listeners.data) listener();

    const visible = !els.scene.hidden && document.visibilityState === 'visible';
    if (arrived.size > 0 && visible) {
      animating = true;
      for (const listener of listeners.burial) listener();
      try {
        await playMassBurial(els, arrived.size, () => render(arrived));
      } finally {
        animating = false;
      }
      if (refreshWaiting) {
        refreshWaiting = false;
        void refresh();
      }
    } else if (!onlyLeaversGone) {
      render();
    }
  }

  const findPlot = (id: string) => els.camera.querySelector<HTMLElement>(`.plot[data-id="${CSS.escape(id)}"]`);

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  // Lay out again after a resize, but never under a running animation or a hold.
  const relayout = () => {
    resizeTimer = animating || holds > 0 ? setTimeout(relayout, RESIZE_DEBOUNCE_MS) : (render(), undefined);
  };
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, RESIZE_DEBOUNCE_MS);
  });

  void refresh();
  return {
    refresh,
    render: () => render(),
    grave: (id) => graves?.find((g) => g.id === id),
    graves: () => graves ?? [],
    onRender: (callback) => void listeners.render.push(callback),
    onData: (callback) => void listeners.data.push(callback),
    onBurialStart: (callback) => void listeners.burial.push(callback),
    holdUpdates() {
      holds++;
      let released = false;
      return () => {
        const settled = new Promise<void>((resolve) => settledWaiters.push(resolve));
        if (!released) {
          released = true;
          holds--;
          // Read even if no change arrived during the hold: the request's last
          // write may reach this page after its response does.
          if (holds === 0) {
            refreshWaiting = false;
            void refresh();
          }
        }
        checkSettled();
        return settled;
      };
    },
    expectLeaving: (id) => void leaving.add(id),
    cancelLeaving: (id) => void leaving.delete(id),
    vacate(id, look) {
      const plot = findPlot(id);
      plot?.classList.add(look);
      // Fresh soil carries no decay (moss mound, weeds), as in the mockup.
      if (look === 'emptied') plot?.classList.remove('stage-weathered', 'stage-crumbling');
    },
    visiblePlot: (id) => (!els.scene.hidden && document.visibilityState === 'visible' ? findPlot(id) : null),
  };
}
