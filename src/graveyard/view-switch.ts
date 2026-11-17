// Landscape / List switch (Requirement 4.3). The Graveyard opens on the
// Landscape (Requirement 4.1); the choice is not saved, as in the mockup.

export interface ViewSwitchElements {
  landscapeButton: HTMLButtonElement;
  listButton: HTMLButtonElement;
  scene: HTMLElement;
  list: HTMLElement;
}

export interface ViewSwitchHooks {
  /** Called after the scene is shown again. */
  showLandscape(): void;
  /** Called after the list is shown. */
  showList(): void;
}

export function startViewSwitch(els: ViewSwitchElements, hooks: ViewSwitchHooks): void {
  let current: 'landscape' | 'list' = 'landscape';

  const show = (view: 'landscape' | 'list') => {
    if (view === current) return;
    current = view;
    els.landscapeButton.setAttribute('aria-pressed', String(view === 'landscape'));
    els.listButton.setAttribute('aria-pressed', String(view === 'list'));
    els.scene.hidden = view !== 'landscape';
    els.list.hidden = view !== 'list';
    if (view === 'landscape') hooks.showLandscape();
    else hooks.showList();
  };

  els.landscapeButton.addEventListener('click', () => show('landscape'));
  els.listButton.addEventListener('click', () => show('list'));
}
