// Mass burial (design steering file, Motion), as buryIdle in design/mockup.html:
// 1. fog rolls in thick (0.9 s);
// 2. the new graves rise, newest first, 170 ms apart, front row first;
// 3. the counts tick up (stats.ts);
// 4. a crow flies across the moon; the fog recedes.
// Reduced motion: no fog roll or crow; the new graves fade in (0.3 s, CSS).

import { FOG_ROLL_MS, RISE_STEP_MS, RISE_TAIL_MS, FOG_RECEDE_MS, FADE_MS } from '../core/burial-motion.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface MassBurialElements {
  scene: HTMLElement;
  camera: HTMLElement;
  flyer: Element;
}

/**
 * Play the sequence. `renderRising` draws the scene with the new graves marked
 * as rising (each with its delay). Resolves when the animation has ended and
 * the plots are back to normal.
 */
export async function playMassBurial(els: MassBurialElements, risingCount: number, renderRising: () => void): Promise<void> {
  const reduce = prefersReducedMotion();
  if (!reduce) {
    els.scene.classList.add('fogroll');
    await sleep(FOG_ROLL_MS);
  }
  renderRising();

  if (reduce) {
    await sleep(FADE_MS);
  } else {
    // Restart the crow's flight even if it flew a moment ago.
    els.flyer.classList.remove('go');
    void els.flyer.getBoundingClientRect();
    els.flyer.classList.add('go');
    await sleep(RISE_TAIL_MS + risingCount * RISE_STEP_MS);
    els.scene.classList.remove('fogroll');
    await sleep(FOG_RECEDE_MS);
  }
  for (const plot of els.camera.querySelectorAll('.plot.rising')) plot.classList.remove('rising');
}
