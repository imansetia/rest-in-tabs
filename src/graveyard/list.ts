// List view (Requirements 4.3 to 4.6, 6.2, 10.5), as renderList in design/mockup.html:
// a table of tab (icon, title, domain), epitaph, cause of death, buried ("x ago",
// full date on hover), condition and actions; sorted newest, oldest or by name;
// the same search as the Landscape. Grave data is only set as text.

import type { Grave } from '../core/types.js';
import { searchGraves, decayStage } from '../core/decay.js';
import { causeOfDeath } from '../core/cause.js';
import { STAGE_LABEL, longDate, timeAgo } from '../core/stone-text.js';
import { sortForList, parseListOrder } from '../core/list-order.js';
import { listCountText, NO_GRAVES_TEXT, NO_MATCH_TEXT, CLEAR_SEARCH_LABEL } from '../core/copy.js';
import { medallion } from './stone.js';
import type { PlaqueActions } from './plaque.js';

export interface ListElements {
  root: HTMLElement;
  count: HTMLElement;
  sort: HTMLSelectElement;
  body: HTMLElement;
  empty: HTMLElement;
}

export interface ListDeps {
  graves(): Grave[];
  term(): string;
  displayClock(): number;
  actions: PlaqueActions;
  /** Empty the search field and put focus back in it. */
  clearSearch(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function startList(els: ListElements, deps: ListDeps): { render(): void } {
  function row(grave: Grave, displayNow: number): HTMLTableRowElement {
    const title = grave.title.trim() || grave.domain;
    const stage = decayStage(grave.buriedAt, displayNow);

    const names = el('div');
    names.append(el('div', 'title', title), el('div', 'sub', grave.domain));
    const tab = el('div', 't');
    tab.append(medallion(grave), names);

    const buried = el('span', '', timeAgo(grave.buriedAt, displayNow));
    buried.title = longDate(grave.buriedAt);

    // Visible text first in the accessible name, so each row's buttons are told apart.
    const resurrect = el('button', 'btn', 'Resurrect');
    resurrect.type = 'button';
    resurrect.setAttribute('aria-label', `Resurrect ${title}`);
    resurrect.addEventListener('click', () => deps.actions.resurrect(grave));
    const exorcise = el('button', 'btn danger', 'Exorcise');
    exorcise.type = 'button';
    exorcise.setAttribute('aria-label', `Exorcise ${title}`);
    exorcise.addEventListener('click', () => deps.actions.exorcise(grave, exorcise));
    const buttons = el('div', 'row-actions');
    buttons.append(resurrect, exorcise);

    const cells: Array<Node> = [
      tab,
      document.createTextNode(grave.epitaph),
      document.createTextNode(causeOfDeath(grave).text),
      buried,
      el('span', `chip ${stage}`, STAGE_LABEL[stage]),
      buttons,
    ];
    const tr = el('tr');
    tr.dataset.id = grave.id;
    cells.forEach((content, i) => {
      const td = el('td', i === 1 ? 'epi' : '');
      td.append(content);
      tr.append(td);
    });
    return tr;
  }

  function render(): void {
    if (els.root.hidden) return; // rendered when the List view is shown
    const all = deps.graves();
    const term = deps.term();
    const shown = sortForList(term === '' ? all : searchGraves(all, term), parseListOrder(els.sort.value));
    const displayNow = deps.displayClock();

    els.count.textContent = listCountText(shown.length, all.length);
    els.body.replaceChildren(...shown.map((grave) => row(grave, displayNow)));

    els.empty.hidden = shown.length > 0;
    if (all.length === 0) {
      els.empty.textContent = NO_GRAVES_TEXT;
    } else if (shown.length === 0) {
      // As the Landscape (Requirement 4.6): the message and a "Clear search" button.
      const clear = el('button', 'btn', CLEAR_SEARCH_LABEL);
      clear.type = 'button';
      clear.addEventListener('click', () => deps.clearSearch());
      els.empty.replaceChildren(document.createTextNode(NO_MATCH_TEXT), clear);
    }
  }

  els.sort.addEventListener('change', render);
  return { render };
}
