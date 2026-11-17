// Focus after a grave leaves (task 11.12): the nearest grave in the view on
// screen, the next one, else the previous one (focusCandidates). In the
// Landscape that is a stone; in the List view, the same row's Exorcise button.

export interface GraveFocusElements {
  scene: HTMLElement;
  camera: HTMLElement;
  listBody: HTMLElement;
  /** Focused when no grave is left (the search field). */
  fallback: HTMLElement;
}

export interface GraveFocus {
  /** Ids of the graves the user can tab to, in tab order, in the view on screen. */
  order(): string[];
  /**
   * Focus the first of these graves that is still shown, else the fallback.
   * Does nothing if the user has already put focus somewhere else meanwhile.
   */
  focusFirst(ids: readonly string[]): void;
}

const LIVE_PLOT = '.plot:not(.gone):not(.emptied)';

export function createGraveFocus(els: GraveFocusElements): GraveFocus {
  const inLandscape = () => !els.scene.hidden;

  const targets = (): Map<string, HTMLElement> => {
    const found = new Map<string, HTMLElement>();
    if (inLandscape()) {
      for (const plot of els.camera.querySelectorAll<HTMLElement>(LIVE_PLOT)) {
        const stone = plot.querySelector<HTMLElement>('.stone');
        if (plot.dataset.id !== undefined && stone !== null) found.set(plot.dataset.id, stone);
      }
    } else {
      for (const row of els.listBody.querySelectorAll<HTMLElement>('tr[data-id]')) {
        const button = row.querySelector<HTMLElement>('.btn.danger');
        if (row.dataset.id !== undefined && button !== null) found.set(row.dataset.id, button);
      }
    }
    return found;
  };

  return {
    order: () => [...targets().keys()],
    focusFirst(ids) {
      const active = document.activeElement;
      if (active !== null && active !== document.body) return; // the user is already somewhere
      const shown = targets();
      const target = ids.map((id) => shown.get(id)).find((el) => el !== undefined) ?? els.fallback;
      target.focus();
    },
  };
}
