// Demo clock in the Graveyard header (task 15.1, Requirements 8.5, 8.6), as the
// mockup's "Demo clock" range: 0 to 14 days, labelled "+N days". Shown only
// while the Demo setting is on. The offset lives in this page only: it starts
// at 0, is reset to 0 when Demo is turned off, and is never stored or sent.

import { getSettings, onStorageChanged } from '../platform/storage.js';
import { parseDemoDays, demoLabel } from '../core/demo-clock.js';

export interface DemoClockElements {
  root: HTMLElement;
  input: HTMLInputElement;
  output: HTMLOutputElement;
}

/** `onChange(days)` runs whenever the offset changes (also back to 0 when Demo is turned off). */
export function startDemoClock(els: DemoClockElements, onChange: (days: number) => void): void {
  let days = 0;

  const show = (d: number) => {
    els.input.value = String(d);
    els.output.textContent = demoLabel(d);
    els.input.setAttribute('aria-valuetext', demoLabel(d));
  };
  const set = (d: number) => {
    show(d);
    if (d === days) return;
    days = d;
    onChange(d);
  };

  els.input.addEventListener('input', () => set(parseDemoDays(els.input.value)));

  const apply = (demo: boolean) => {
    els.root.hidden = !demo;
    if (!demo) set(0);
  };
  const read = () =>
    getSettings().then(
      (settings) => apply(settings.demo),
      (err: unknown) => console.error('Could not read the Demo setting; the clock stays hidden:', err),
    );

  onStorageChanged((keys) => {
    if (keys.includes('settings')) void read();
  });
  show(0);
  void read();
}
