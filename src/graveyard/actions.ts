// Resurrect and Exorcise from the Graveyard (Requirements 5.1 to 5.4). The page
// only sends messages; the service worker opens tabs and writes storage.
// Animations arrive in tasks 11.9 and 11.10.

import type { Grave } from '../core/types.js';
import { sendMessage } from '../platform/messaging.js';
import { errorText, RESURRECT_DONE_TEXT, EXORCISE_DONE_TEXT } from '../core/copy.js';
import type { Landscape } from './landscape.js';
import type { Plaque, PlaqueActions } from './plaque.js';
import type { Toast } from './toast.js';
import { askExorcise, type ConfirmElements } from './confirm.js';

export function graveActions(
  landscape: Landscape,
  toast: Toast,
  confirm: ConfirmElements,
  plaque: () => Plaque,
): PlaqueActions {
  return {
    async resurrect(grave: Grave) {
      landscape.expectLeaving(grave.id);
      const response = await sendMessage({ type: 'resurrect', graveId: grave.id });
      if (response.ok) {
        landscape.vacate(grave.id, 'emptied');
        toast.show(RESURRECT_DONE_TEXT);
      } else {
        // open-failed: the grave is kept (Requirement 5.2).
        landscape.cancelLeaving(grave.id);
        toast.show(errorText(response.error));
        void landscape.refresh();
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
