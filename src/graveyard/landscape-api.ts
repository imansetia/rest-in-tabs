// The Landscape view's interface (implementation: landscape.ts).

import type { Grave } from '../core/types.js';

export interface LandscapeElements {
  scene: HTMLElement;
  camera: HTMLElement;
  message: HTMLElement;
  /** The crow that crosses the moon during a mass burial. */
  flyer: Element;
}

export interface Landscape {
  refresh(): Promise<void>;
  render(): void;
  /**
   * Render now, or as soon as no animation or hold is running (the Demo clock:
   * a re-render must not replace a stone under a ghost, a bolt or rising graves).
   */
  renderWhenIdle(): void;
  /** The grave shown with this id, if any. */
  grave(id: string): Grave | undefined;
  /** All graves currently known (empty until the first read). */
  graves(): Grave[];
  /** Run after every render (search re-applies its matches). */
  onRender(callback: () => void): void;
  /** Run whenever the graves are read, even when the landscape does not re-render (the List view). */
  onData(callback: () => void): void;
  /** Run when a mass burial starts (the search is cleared, as in the mockup). */
  onBurialStart(callback: () => void): void;
  /**
   * Hold storage-driven updates until the returned function is called, e.g.
   * while our own "Bury idle tabs" request runs, so its graves rise together.
   * Releasing reads storage again and resolves once the view has settled
   * (any mass burial it started has ended), so the result toast comes after it.
   */
  holdUpdates(): () => Promise<void>;
  /**
   * Call before sending resurrect/exorcise for this grave. While it is
   * expected to leave, a storage change that only removes it does not
   * re-render, so its plot can show soil or bare ground (Requirement 4.11).
   */
  expectLeaving(id: string): void;
  /** The request failed: stop expecting the grave to leave. */
  cancelLeaving(id: string): void;
  /** Show the plot as fresh empty soil ('emptied') or bare ground ('gone'). */
  vacate(id: string, look: 'emptied' | 'gone'): void;
  /** The grave's plot, if the Landscape is on screen (for the Resurrect animation). */
  visiblePlot(id: string): HTMLElement | null;
}

