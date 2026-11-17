// Graveyard page: wires the header modules to the page and to storage changes.
// The scene and graves follow in tasks 11.3 and later.

import { startTheme } from '../platform/theme.js';
import { onStorageChanged } from '../platform/storage.js';
import type { Theme } from '../core/types.js';
import { createToast } from './toast.js';
import { startStats } from './stats.js';
import { startIdleButton } from './idle-button.js';
import { startLandscape } from './landscape.js';
import { createPlaque } from './plaque.js';
import { graveActions } from './actions.js';
import { startSearch } from './search.js';
import { startList } from './list.js';
import { startViewSwitch } from './view-switch.js';
import { createGraveFocus } from './grave-focus.js';
import { startAiEpitaphs } from './ai-epitaphs.js';
import { startDemoClock } from './demo-clock.js';
import { demoNow } from '../core/demo-clock.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Graveyard markup is missing #${id}`);
  return el as T;
}

// ---------------------------------------------------------------------------
// Theme switch
// ---------------------------------------------------------------------------

const themeButtons: Record<Theme, HTMLButtonElement> = {
  night: byId<HTMLButtonElement>('th-night'),
  dusk: byId<HTMLButtonElement>('th-dusk'),
};

const theme = startTheme((current) => {
  for (const [name, button] of Object.entries(themeButtons)) {
    button.setAttribute('aria-pressed', String(name === current));
  }
});

for (const [name, button] of Object.entries(themeButtons) as Array<[Theme, HTMLButtonElement]>) {
  button.addEventListener('click', () => {
    theme.choose(name).catch((err: unknown) => console.error('Could not save the theme:', err));
  });
}

// ---------------------------------------------------------------------------
// Header: stats and the idle button
// ---------------------------------------------------------------------------

const toast = createToast(byId('toast'));

const stats = startStats({
  group: byId('stats'),
  buried: byId('st-buried'),
  resurrected: byId('st-res'),
  memory: byId('st-ram'),
});

// ---------------------------------------------------------------------------
// Landscape
// ---------------------------------------------------------------------------

// One clock for everything the page displays. The Demo clock (task 15.1) moves
// it forward; burial, expiry and stats in the service worker use the real time.
let demoDays = 0;
const displayClock = () => demoNow(Date.now(), demoDays);

const landscape = startLandscape(
  { scene: byId('scene'), camera: byId('camera'), message: byId('scene-msg'), flyer: byId('flyer') },
  displayClock,
);

// Our own "Bury N idle tabs" holds the Landscape's updates until its run ends,
// so all its graves rise together.
const idleButton = startIdleButton(byId<HTMLButtonElement>('bury-idle'), toast, () => landscape.holdUpdates());

// ---------------------------------------------------------------------------
// Plaque, Resurrect, Exorcise
// ---------------------------------------------------------------------------

const confirmDialog = byId<HTMLDialogElement>('confirm');
const actions = graveActions(
  landscape,
  toast,
  { dialog: confirmDialog, text: byId('cf-text'), keep: byId<HTMLButtonElement>('cf-keep'), go: byId<HTMLButtonElement>('cf-go') },
  () => plaque,
  { scene: byId('scene'), flash: byId('flash'), crow: byId('fence-crow') },
  createGraveFocus({ scene: byId('scene'), camera: byId('camera'), listBody: byId('list-body'), fallback: byId('q') }),
);
const plaque = createPlaque(
  {
    root: byId('plaque'),
    close: byId<HTMLButtonElement>('pl-close'),
    title: byId('pl-title'),
    domain: byId('pl-domain'),
    epitaph: byId('pl-epi'),
    cause: byId('pl-cause'),
    visited: byId('pl-visited'),
    buried: byId('pl-buried'),
    stage: byId('pl-stage'),
    resurrect: byId<HTMLButtonElement>('pl-res'),
    exorcise: byId<HTMLButtonElement>('pl-exo'),
    confirm: confirmDialog,
  },
  displayClock,
  actions,
);

const searchInput = byId<HTMLInputElement>('q');
const search = startSearch(
  { input: searchInput, scene: byId('scene'), camera: byId('camera'), message: byId('scene-msg') },
  landscape,
);

// ---------------------------------------------------------------------------
// List view and the Landscape / List switch
// ---------------------------------------------------------------------------

const list = startList(
  { root: byId('list'), count: byId('list-count'), sort: byId<HTMLSelectElement>('sort'), body: byId('list-body'), empty: byId('list-empty') },
  {
    graves: () => landscape.graves(),
    term: () => search.term(),
    displayClock,
    actions,
    clearSearch: () => {
      search.clear();
      searchInput.focus();
    },
  },
);
landscape.onData(() => list.render());
search.onApply(() => list.render());
// A mass burial clears the search and resets the camera first, as in the mockup.
landscape.onBurialStart(() => {
  plaque.close(false);
  search.clear();
  idleButton.burialStarted();
});

startViewSwitch(
  { landscapeButton: byId<HTMLButtonElement>('v-land'), listButton: byId<HTMLButtonElement>('v-list'), scene: byId('scene'), list: byId('list') },
  {
    showLandscape() {
      landscape.render(); // laid out again now that the scene has a size
      search.reapply(true);
    },
    showList() {
      plaque.close(false);
      list.render();
    },
  },
);

// A stone opens (or switches) the Plaque.
byId('camera').addEventListener('click', (event) => {
  const stone = event.target instanceof Element ? event.target.closest<HTMLElement>('.stone') : null;
  const id = stone?.closest<HTMLElement>('.plot')?.dataset.id;
  const grave = id === undefined ? undefined : landscape.grave(id);
  if (stone && grave) plaque.open(grave, stone);
});

// Demo clock: moving it closes the Plaque and re-renders without animation; the
// List view follows through the search's apply after the render.
startDemoClock(
  { root: byId('clock-wrap'), input: byId<HTMLInputElement>('clock'), output: byId<HTMLOutputElement>('clock-out') },
  (days) => {
    demoDays = days;
    plaque.close(false);
    landscape.renderWhenIdle();
  },
);

// On-device AI epitaphs (task 13): the button shows only when the model can be downloaded.
startAiEpitaphs({ button: byId<HTMLButtonElement>('ai-enable'), toast, graves: () => landscape.graves(), onData: (cb) => landscape.onData(cb) });

// Live updates (Requirement 4.7). Settings changes (threshold, protected
// sites) change the idle count as well as graves do.
onStorageChanged((keys) => {
  if (keys.includes('stats')) void stats.refresh();
  if (keys.includes('graves')) void landscape.refresh();
  if (keys.includes('graves') || keys.includes('settings')) void idleButton.refresh();
});
