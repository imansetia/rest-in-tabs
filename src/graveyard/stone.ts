// One plot: mound, tombstone button and decorations, with the decay look of
// its stage (Requirements 4.1, 6.1, 6.2, 10.5). Structure from the mockup's plotHtml.
// Grave data is only ever set with textContent / properties, never as markup.

import type { Grave } from '../core/types.js';
import { decayStage } from '../core/decay.js';
import { plotJitter } from '../core/layout.js';
import { causeOfDeath } from '../core/cause.js';
import { stoneName, stoneDates, stoneLabel } from '../core/stone-text.js';
import { letterFor, discColor } from '../core/icon.js';
import { iconSrc } from '../platform/favicon.js';
import { decoration } from './decorations.js';

/**
 * The grave's icon: Chrome's _favicon image over the first letter of the domain
 * on a muted disc (Requirement 4.12). The image appears once it has loaded; if
 * it fails it is removed, so the letter shows. Also used by the Plaque, the List
 * view and the Resurrect ghost (tasks 11.5 to 11.9).
 */
export function medallion(grave: Pick<Grave, 'url' | 'domain'>, className = 'fav'): HTMLElement {
  const disc = document.createElement('span');
  disc.className = className;
  disc.setAttribute('aria-hidden', 'true');
  disc.style.setProperty('--c', discColor(grave.domain));
  disc.textContent = letterFor(grave.domain);

  const img = document.createElement('img');
  img.alt = '';
  img.addEventListener('load', () => img.classList.add('ok'), { once: true });
  img.addEventListener('error', () => img.remove(), { once: true });
  img.src = iconSrc(grave.url);
  disc.append(img);
  return disc;
}

function text(className: string, value: string): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = value;
  return span;
}

/** `depth` is the row index (0 = front); `displayNow` is the time the page displays with. */
export function plotElement(grave: Grave, depth: number, displayNow: number): HTMLElement {
  const stage = decayStage(grave.buriedAt, displayNow);
  const jitter = plotJitter(grave.id);

  const plot = document.createElement('div');
  plot.classList.add('plot', `stage-${stage}`);
  if (jitter.hasCross) plot.classList.add('has-cross');
  if (jitter.hasCrow) plot.classList.add('has-crow');
  plot.dataset.id = grave.id;
  plot.style.setProperty('--d', String(depth));
  plot.style.setProperty('--tilt', `${jitter.tiltDeg}deg`);
  plot.style.setProperty('--jy', `${jitter.offsetPx}px`);

  const mound = document.createElement('span');
  mound.className = 'mound';

  const stone = document.createElement('button');
  stone.type = 'button';
  stone.className = 'stone';
  stone.setAttribute('aria-label', stoneLabel(grave, stage, displayNow));
  stone.append(
    medallion(grave),
    text('name', stoneName(grave.title, grave.domain)),
    text('dates', stoneDates(grave.lastAccessed, grave.buriedAt)),
    text('epi', grave.epitaph),
    text('cause', causeOfDeath(grave).text),
    decoration('crack'),
    decoration('web'),
  );

  plot.append(mound, decoration('fallen'), stone, decoration('rose'), decoration('weeds'), decoration('perch'));
  return plot;
}
