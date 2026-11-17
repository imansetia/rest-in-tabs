// Stats bar: buried, resurrected and the estimated memory freed (Requirements 7.1, 7.2).
// When the buried count goes up (a burial), it and the memory figure count up
// over 1.4 s as in the mockup's mass burial; with reduced motion they jump.

import { getStats } from '../platform/storage.js';
import { estimateFreedMb } from '../core/decay.js';
import { formatCount, formatMemory } from '../core/copy.js';
import { countUpValue, COUNT_UP_MS } from '../core/burial-motion.js';
import type { Stats } from '../core/types.js';
import { prefersReducedMotion } from './mass-burial.js';

export interface StatsElements {
  group: HTMLElement;
  buried: HTMLElement;
  resurrected: HTMLElement;
  memory: HTMLElement;
}

/**
 * Read the stats and show them. The group stays hidden until the first read
 * succeeds; a later failed read keeps the last numbers shown.
 */
export function startStats(els: StatsElements): { refresh(): Promise<void> } {
  let shown: Stats | null = null; // what the bar shows, or is counting up to
  let frame = 0;

  const draw = (buried: number) => {
    els.buried.textContent = formatCount(buried);
    els.memory.textContent = formatMemory(estimateFreedMb(buried));
  };

  function countUp(from: number, to: number): void {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const step = (t: number) => {
      const progress = (t - start) / COUNT_UP_MS;
      draw(countUpValue(from, to, progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  async function refresh(): Promise<void> {
    let stats: Stats;
    try {
      stats = await getStats();
    } catch (err) {
      console.error('Could not read the statistics:', err);
      return;
    }
    const from = shown?.buried ?? stats.buried;
    shown = stats;
    els.resurrected.textContent = formatCount(stats.resurrected);
    if (stats.buried > from && !prefersReducedMotion()) {
      countUp(from, stats.buried);
    } else {
      cancelAnimationFrame(frame);
      draw(stats.buried);
    }
    els.group.hidden = false;
  }

  void refresh();
  return { refresh };
}
