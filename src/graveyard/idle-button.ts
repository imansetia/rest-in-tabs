// "Bury N idle tabs" in the Graveyard header (Requirements 2.2, 4.10).
// Same label rules as the Popup (idleButtonState). The count is refreshed on
// load, when the caller reports a storage change, when the page becomes
// visible again, and once a minute while visible (design.md, Idle count).

import { sendMessage } from '../platform/messaging.js';
import { idleButtonState, buryIdleResultText, errorText, WORKING_TEXT } from '../core/copy.js';
import type { Toast } from './toast.js';

const REFRESH_MS = 60_000;

export function startIdleButton(button: HTMLButtonElement, toast: Toast): { refresh(): Promise<void> } {
  let count: number | null = null;
  let busy = false;
  let latestRequest = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const render = () => {
    const state = idleButtonState(count);
    button.textContent = state.label;
    // aria-disabled keeps the button focusable while it is unavailable.
    button.setAttribute('aria-disabled', String(busy || !state.available));
  };

  async function refresh(): Promise<void> {
    const mine = ++latestRequest;
    const response = await sendMessage({ type: 'countIdle' });
    if (mine !== latestRequest) return; // a newer request was sent meanwhile
    // On failure the last count stays (or none: "Bury idle tabs", usable).
    if (response.ok && response.count !== undefined) count = response.count;
    render();
  }

  button.addEventListener('click', async () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    render();
    // A run can take a while (up to 2 s per tab), so say that it started.
    toast.show(WORKING_TEXT, { sticky: true });

    const response = await sendMessage({ type: 'buryIdle' });

    busy = false;
    toast.show(response.ok ? buryIdleResultText(response.count ?? 0) : errorText(response.error));
    await refresh();
  });

  const schedule = () => {
    clearInterval(timer);
    timer = document.visibilityState === 'visible' ? setInterval(() => void refresh(), REFRESH_MS) : undefined;
  };
  document.addEventListener('visibilitychange', () => {
    schedule();
    if (document.visibilityState === 'visible') void refresh();
  });

  render();
  schedule();
  void refresh();
  return { refresh };
}
