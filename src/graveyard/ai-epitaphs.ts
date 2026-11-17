// On-device AI epitaphs in the Graveyard (task 13.3, Requirements 3.4, 3.5):
// - "available": upgrade at once, then again whenever new graves with an
//   excerpt arrive while the page is open;
// - "downloadable": show "Enable AI epitaphs"; the click starts the download
//   (a user gesture is required), the button shows the progress as text, then
//   the epitaphs are upgraded as above;
// - "downloading" / "unavailable": nothing; the fallback Epitaph stays.
// The page never writes graves: each summary goes to the service worker as an
// updateEpitaph message, and the stone changes through the normal live update.

import { aiPlan, upgradeEpitaphs, gravesToUpgrade, downloadProgressText } from '../core/ai-epitaph.js';
import { sendMessage } from '../platform/messaging.js';
import { checkAvailability, openSummarizer, type OpenSummarizer } from '../platform/summarizer.js';
import type { Grave } from '../core/types.js';
import { ENABLE_AI_LABEL, AI_WRITING_TEXT, AI_FAILED_TEXT, aiDoneText } from '../core/copy.js';
import type { Toast } from './toast.js';

export interface AiEpitaphDeps {
  button: HTMLButtonElement;
  toast: Toast;
  graves(): Grave[];
  /** Run when the graves are read again (new graves may have an excerpt). */
  onData(callback: () => void): void;
}

export function startAiEpitaphs(deps: AiEpitaphDeps): void {
  let session: OpenSummarizer | null = null;
  let running: Promise<number> | null = null;
  // Each grave is tried once per visit: a failed one is not retried on every live update.
  const tried = new Set<string>();
  let again = false;

  /** Upgrade until nothing is left; a call during a run makes the run go round once more. */
  function upgrade(): Promise<number> {
    if (running !== null) {
      again = true;
      return running;
    }
    running = (async () => {
      let total = 0;
      do {
        again = false;
        if (session === null) break;
        const s = session;
        const result = await upgradeEpitaphs({
          graves: deps.graves,
          summarize: (excerpt) => s.summarize(excerpt),
          send: (graveId, epitaph) => sendMessage({ type: 'updateEpitaph', graveId, epitaph }),
          tried,
        });
        total += result.upgraded;
      } while (again);
      return total;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  deps.onData(() => {
    if (session !== null && gravesToUpgrade(deps.graves()).some((g) => !tried.has(g.id))) void upgrade();
  });
  window.addEventListener('pagehide', () => session?.destroy());

  const setBusy = (label: string) => {
    deps.button.textContent = label;
    deps.button.setAttribute('aria-disabled', 'true');
  };

  deps.button.addEventListener('click', async () => {
    if (deps.button.getAttribute('aria-disabled') === 'true') return;
    setBusy(downloadProgressText(0, 1));
    try {
      // Called straight from the click, so the download may start (user activation).
      session = await openSummarizer((loaded, total) => {
        deps.button.textContent = downloadProgressText(loaded, total);
      });
    } catch (err) {
      console.error('Could not enable AI epitaphs:', err);
      deps.button.textContent = ENABLE_AI_LABEL;
      deps.button.removeAttribute('aria-disabled');
      deps.toast.show(AI_FAILED_TEXT);
      return;
    }
    setBusy(AI_WRITING_TEXT);
    const count = await upgrade();
    deps.button.hidden = true;
    deps.toast.show(aiDoneText(count));
  });

  void (async () => {
    const plan = aiPlan(await checkAvailability());
    if (plan === 'offer') {
      deps.button.hidden = false;
      return;
    }
    if (plan !== 'upgrade') return;
    try {
      // The model is already on the device: no gesture is needed.
      session = await openSummarizer();
    } catch (err) {
      console.error('Could not start the summarizer; fallback epitaphs stay:', err);
      return;
    }
    void upgrade();
  })();
}
