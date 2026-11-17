// Resurrect and Exorcise from the Graveyard (Requirements 5.1 to 5.4). The page
// only sends messages; the service worker opens tabs and writes storage.
// Resurrect plays its animation first (task 11.9); Exorcise's arrives in 11.10.

import type { Grave } from '../core/types.js';
import { sendMessage } from '../platform/messaging.js';
import { errorText, RESURRECT_DONE_TEXT, EXORCISE_DONE_TEXT } from '../core/copy.js';
import type { Landscape } from './landscape.js';
import type { Plaque, PlaqueActions } from './plaque.js';
import type { Toast } from './toast.js';
import { askExorcise, type ConfirmElements } from './confirm.js';
import { playResurrect } from './resurrect-fx.js';

export function graveActions(
  landscape: Landscape,
  toast: Toast,
  confirm: ConfirmElements,
  plaque: () => Plaque,
): PlaqueActions {
  const resurrecting = new Set<string>();

  return {
    async resurrect(grave: Grave) {
      if (resurrecting.has(grave.id)) return; // its ghost is already on the way
      resurrecting.add(grave.id);
      landscape.expectLeaving(grave.id);
      // No re-render may replace the stone while its animation runs.
      const release = landscape.holdUpdates();
      try {
        // In the List view (or a hidden page) there is no animation, as in the mockup.
        const plot = landscape.visiblePlot(grave.id);
        const motion = plot === null ? null : await playResurrect(plot, grave);
        // The ghost has flown off toward the tab bar: now the tab opens.
        const response = await sendMessage({ type: 'resurrect', graveId: grave.id });
        if (response.ok) {
          landscape.vacate(grave.id, 'emptied');
          toast.show(RESURRECT_DONE_TEXT);
        } else {
          // open-failed: the grave is kept (Requirement 5.2) and its stone comes back.
          landscape.cancelLeaving(grave.id);
          await motion?.restore();
          toast.show(errorText(response.error));
        }
      } finally {
        resurrecting.delete(grave.id);
        void release(); // reads storage again: a kept grave re-renders, a removed one stays soil
      }
    },

    async exorcise(grave: Grave, invoker: HTMLElement) {
      if (!(await askExorcise(confirm, grave))) {
        invoker.focus(); // kept: the Plaque stays open
        return;
      }
      plaque().close(false);
      landscape.expectLeaving(grave.id);
      const response = await sendMessage({ type: 'exorcise', graveId: grave.id });
      if (response.ok) {
        landscape.vacate(grave.id, 'gone');
        toast.show(EXORCISE_DONE_TEXT);
      } else {
        landscape.cancelLeaving(grave.id);
        toast.show(errorText(response.error));
        void landscape.refresh();
      }
    },
  };
}
