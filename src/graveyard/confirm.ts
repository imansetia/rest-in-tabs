// Exorcise confirmation (Requirement 5.3): a modal <dialog>, "Keep it" has the
// default focus, Esc keeps the grave.

import type { Grave } from '../core/types.js';
import { exorciseConfirmText } from '../core/copy.js';

export interface ConfirmElements {
  dialog: HTMLDialogElement;
  text: HTMLElement;
  keep: HTMLButtonElement;
  go: HTMLButtonElement;
}

/** Resolves true when the user chooses Exorcise, false for "Keep it" or Esc. */
export function askExorcise(els: ConfirmElements, grave: Grave): Promise<boolean> {
  els.text.textContent = exorciseConfirmText(grave.title.trim() || grave.domain);

  return new Promise((resolve) => {
    const finish = (confirmed: boolean) => {
      els.keep.removeEventListener('click', onKeep);
      els.go.removeEventListener('click', onGo);
      els.dialog.removeEventListener('cancel', onCancel);
      els.dialog.close();
      resolve(confirmed);
    };
    const onKeep = () => finish(false);
    const onGo = () => finish(true);
    const onCancel = (event: Event) => {
      event.preventDefault();
      finish(false);
    };

    els.keep.addEventListener('click', onKeep);
    els.go.addEventListener('click', onGo);
    els.dialog.addEventListener('cancel', onCancel);
    els.dialog.showModal();
    els.keep.focus();
  });
}
