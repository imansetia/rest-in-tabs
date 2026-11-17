// Search in the Landscape view (Requirements 4.4, 4.6), as applySearch and
// walkTo in design/mockup.html:
// - matches title, domain or epitaph, ignoring case and surrounding spaces,
//   180 ms after typing stops;
// - the fog thins, non-matching graves fade, matching graves lose their veil;
// - the camera glides (1.1 s, CSS) to the newest match (newestMatch),
//   enlarging it up to 1.9x so a far grave comes forward;
// - no match: "No grave bears that name." with "Clear search"; clearing resets the view.

import { searchGraves, newestMatch } from '../core/decay.js';
import { cameraFocus } from '../core/camera.js';
import { NO_MATCH_TEXT, CLEAR_SEARCH_LABEL } from '../core/copy.js';
import type { Landscape } from './landscape.js';

const DEBOUNCE_MS = 180;

export interface SearchElements {
  input: HTMLInputElement;
  scene: HTMLElement;
  camera: HTMLElement;
  message: HTMLElement;
}

export interface Search {
  /** The trimmed query ('' when not searching). */
  term(): string;
  /** Empty the field and reset the view. */
  clear(): void;
  /** Apply the current query again; `walk` moves the camera (after switching back to the Landscape). */
  reapply(walk: boolean): void;
  /** Run after every apply (the List view re-renders). */
  onApply(callback: () => void): void;
}

export function startSearch(els: SearchElements, landscape: Landscape): Search {
  let cameraScale = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const applyListeners: Array<() => void> = [];

  function walkTo(plot: HTMLElement | null): void {
    if (plot === null) {
      cameraScale = 1;
      els.camera.style.transform = '';
      return;
    }
    const scene = els.scene.getBoundingClientRect();
    const camera = els.camera.getBoundingClientRect();
    const target = plot.getBoundingClientRect();
    const focus = cameraFocus({
      sceneWidth: scene.width,
      sceneHeight: scene.height,
      // Undo the current zoom to get the plot's centre in camera coordinates.
      targetX: (target.left + target.width / 2 - camera.left) / cameraScale,
      targetY: (target.top + target.height / 2 - camera.top) / cameraScale,
      rowScale: Number(plot.closest<HTMLElement>('.row')?.dataset.s ?? 1),
    });
    cameraScale = focus.scale;
    els.camera.style.transform = focus.scale === 1 ? '' : `translate(${focus.x}px, ${focus.y}px) scale(${focus.scale})`;
  }

  function showNoMatch(): void {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn';
    clear.textContent = CLEAR_SEARCH_LABEL;
    clear.addEventListener('click', () => {
      api.clear();
      els.input.focus();
    });
    els.message.replaceChildren(document.createTextNode(NO_MATCH_TEXT), clear);
    els.message.hidden = false;
  }

  /** `walk`: move the camera (typing); not after a re-render (the view stays where it is). */
  function apply(walk: boolean): void {
    const term = els.input.value.trim();
    const searching = term !== '';
    const graves = landscape.graves();
    const matches = new Set(searching ? searchGraves(graves, term).map((g) => g.id) : []);
    const newestId = newestMatch(graves, term)?.id;

    els.scene.classList.toggle('searching', searching);
    let target: HTMLElement | null = null;
    for (const plot of els.camera.querySelectorAll<HTMLElement>('.plot')) {
      const id = plot.dataset.id ?? '';
      plot.classList.toggle('match', matches.has(id));
      if (id === newestId) target = plot;
    }

    // With no graves at all the landscape shows its own empty message.
    if (graves.length > 0) {
      if (searching && matches.size === 0) showNoMatch();
      else els.message.hidden = true;
    }
    // The camera only moves while the Landscape is shown (it has no size in the List view).
    if (walk && !els.scene.hidden) walkTo(target);
    for (const listener of applyListeners) listener();
  }

  els.input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => apply(true), DEBOUNCE_MS);
  });
  landscape.onRender(() => apply(false));

  const api: Search = {
    term: () => els.input.value.trim(),
    clear(): void {
      clearTimeout(timer);
      els.input.value = '';
      apply(true);
    },
    reapply: (walk) => apply(walk),
    onApply: (callback) => void applyListeners.push(callback),
  };
  return api;
}
