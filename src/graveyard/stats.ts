// Stats bar: buried, resurrected and the estimated memory freed (Requirements 7.1, 7.2).

import { getStats } from '../platform/storage.js';
import { estimateFreedMb } from '../core/decay.js';
import { formatCount, formatMemory } from '../core/copy.js';

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
  async function refresh(): Promise<void> {
    try {
      const stats = await getStats();
      els.buried.textContent = formatCount(stats.buried);
      els.resurrected.textContent = formatCount(stats.resurrected);
      els.memory.textContent = formatMemory(estimateFreedMb(stats.buried));
      els.group.hidden = false;
    } catch (err) {
      console.error('Could not read the statistics:', err);
    }
  }

  void refresh();
  return { refresh };
}
