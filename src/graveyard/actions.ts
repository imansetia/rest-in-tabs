// Resurrect and Exorcise from the Graveyard (Requirements 5.1 to 5.4). The page
// only sends messages; the service worker opens tabs and writes storage.
// Resurrect plays its animation before the message (task 11.9); Exorcise
// plays its animation after a successful reply (task 11.10).
// Focus afterwards (task 11.12): once the view has settled, the nearest grave
// (the next one, else the previous one) if the grave left, or the grave itself
// if it stayed, unless the user has put focus somewhere else meanwhile.

import type { Grave } from '../core/types.js';
import { sendMessage } from '../platform/messaging.js';
import { errorText, RESURRECT_DONE_TEXT, EXORCISE_DONE_TEXT } from '../core/copy.js';
import { focusCandidates } from '../core/focus-order.js';
import type { Landscape } from './landscape.js';
import type { Plaque, PlaqueActions } from './plaque.js';
import type { Toast } from './toast.js';
import { askExorcise, type ConfirmElements } from './confirm.js';
import { playResurrect } from './resurrect-fx.js';
import { playExorcise, type ExorciseElements } from './exorcise-fx.js';
import type { GraveFocus } from './grave-focus.js';

export function graveActions(
  landscape: Landscape,
  toast: Toast,
  confirm: ConfirmElements,
  plaque: () => Plaque,
  effects: ExorciseElements,
  focus: GraveFocus,
): PlaqueActions {
  // Graves being resurrected or exorcised: a second action on them is ignored.
  const inFlight = new Set<string>();

  /** Release the hold, wait for the view to settle, then place focus. */
  async function finish(grave: Grave, release: () => Promise<void>, neighbours: string[], left: boolean): Promise<void> {
    inFlight.delete(grave.id);
    // Reads storage again: a kept grave re-renders, a removed one stays soil or bare ground.
    await release();
    focus.focusFirst(left ? neighbours : [grave.id, ...neighbours]);
  }

  return {
    async resurrect(grave: Grave) {
      if (inFlight.has(grave.id)) return; // its ghost is already on the way
      inFlight.add(grave.id);
      const neighbours = focusCandidates(focus.order(), grave.id);
      landscape.expectLeaving(grave.id);
      // No re-render may replace the stone while its animation runs.
      const release = landscape.holdUpdates();
      let left = false;
      try {
        // In the List view (or a hidden page) there is no animation, as in the mockup.
        const plot = landscape.visiblePlot(grave.id);
        const motion = plot === null ? null : await playResurrect(plot, grave);
        // The ghost has flown off toward the tab bar: now the tab opens.
        const response = await sendMessage({ type: 'resurrect', graveId: grave.id });
        if (response.ok) {
          left = true;
          landscape.vacate(grave.id, 'emptied');
          toast.show(RESURRECT_DONE_TEXT);
        } else {
          // open-failed: the grave is kept (Requirement 5.2) and its stone comes back.
          landscape.cancelLeaving(grave.id);
          await motion?.restore();
          toast.show(errorText(response.error));
        }
      } finally {
        await finish(grave, release, neighbours, left);
      }
    },

    async exorcise(grave: Grave, invoker: HTMLElement) {
      if (inFlight.has(grave.id)) return;
      const neighbours = focusCandidates(focus.order(), grave.id);
      if (!(await askExorcise(confirm, grave))) {
        invoker.focus(); // kept: the Plaque stays open
        return;
      }
      inFlight.add(grave.id);
      plaque().close(false);
      landscape.expectLeaving(grave.id);
      // No re-render may replace the stone before or during its animation.
      const release = landscape.holdUpdates();
      let left = false;
      try {
        const response = await sendMessage({ type: 'exorcise', graveId: grave.id });
        if (response.ok) {
          left = true;
          // Deleted for good: now the stone goes down into the dark. No animation in the List view.
          const plot = landscape.visiblePlot(grave.id);
          if (plot !== null) await playExorcise(plot, effects);
          landscape.vacate(grave.id, 'gone');
          toast.show(EXORCISE_DONE_TEXT);
        } else {
          // On an error reply there is no animation (task 11.10).
          landscape.cancelLeaving(grave.id);
          toast.show(errorText(response.error));
        }
      } finally {
        await finish(grave, release, neighbours, left);
      }
    },
  };
}
