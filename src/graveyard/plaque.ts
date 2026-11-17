// Plaque: the details of one grave, with Resurrect and Exorcise (Requirements 4.8, 4.9).
// Behaviour as in design/mockup.html:
// - opens on a stone, focus moves to Resurrect; another stone switches it;
// - closes with ×, Esc or a click anywhere outside it; × and Esc return focus to
//   the stone; a click outside leaves focus where the user clicked (task 11.12);
// - clicks (and Esc) inside the Exorcise confirmation leave it open.

import type { Grave } from '../core/types.js';
import { decayStage } from '../core/decay.js';
import { causeOfDeath } from '../core/cause.js';
import { STAGE_LABEL, longDate, timeAgo } from '../core/stone-text.js';

export interface PlaqueElements {
  root: HTMLElement;
  close: HTMLButtonElement;
  title: HTMLElement;
  domain: HTMLElement;
  epitaph: HTMLElement;
  cause: HTMLElement;
  visited: HTMLElement;
  buried: HTMLElement;
  stage: HTMLElement;
  resurrect: HTMLButtonElement;
  exorcise: HTMLButtonElement;
  confirm: HTMLDialogElement;
}

export interface PlaqueActions {
  resurrect(grave: Grave): void;
  /** `invoker` gets focus back if the user keeps the grave. */
  exorcise(grave: Grave, invoker: HTMLElement): void;
}

export interface Plaque {
  open(grave: Grave, opener: HTMLElement): void;
  close(restoreFocus: boolean): void;
}

export function createPlaque(els: PlaqueElements, displayClock: () => number, actions: PlaqueActions): Plaque {
  let current: Grave | null = null;
  let opener: HTMLElement | null = null;

  function open(grave: Grave, from: HTMLElement): void {
    const displayNow = displayClock();
    const stage = decayStage(grave.buriedAt, displayNow);
    current = grave;
    opener = from;

    els.title.textContent = grave.title.trim() || grave.domain;
    els.domain.textContent = grave.domain;
    els.epitaph.textContent = grave.epitaph;
    els.cause.textContent = causeOfDeath(grave).text;
    els.visited.textContent = longDate(grave.lastAccessed);
    els.buried.textContent = `${longDate(grave.buriedAt)} (${timeAgo(grave.buriedAt, displayNow)})`;
    els.stage.className = `chip ${stage}`;
    els.stage.textContent = STAGE_LABEL[stage];

    els.root.hidden = false;
    els.resurrect.focus();
  }

  function close(restoreFocus: boolean): void {
    if (els.root.hidden) return;
    els.root.hidden = true;
    current = null;
    if (restoreFocus && opener?.isConnected) opener.focus();
    opener = null;
  }

  els.close.addEventListener('click', () => close(true));
  els.resurrect.addEventListener('click', () => {
    if (current === null) return;
    const grave = current;
    close(false);
    actions.resurrect(grave);
  });
  els.exorcise.addEventListener('click', () => {
    if (current !== null) actions.exorcise(current, els.exorcise);
  });

  // A click anywhere outside closes it. Clicking another stone opens that one
  // instead, and clicks in the confirmation (including its backdrop) leave it open.
  document.addEventListener('click', (event) => {
    if (els.root.hidden || !(event.target instanceof Element)) return;
    if (event.target.closest('.plaque, .stone, dialog')) return;
    close(false);
  });
  document.addEventListener('keydown', (event) => {
    // Esc in the open confirmation only closes the confirmation.
    if (event.key !== 'Escape' || els.root.hidden || els.confirm.open) return;
    close(true);
  });

  return { open, close };
}
