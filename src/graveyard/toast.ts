// Toast: one polite live region (role="status") for action results (Requirement 9.5).
// Timings from design/mockup.html: shown for 2.8 s, 0.3 s fade.

const SHOW_MS = 2800;
const FADE_MS = 300;

export interface Toast {
  /** Show a message. `sticky` keeps it until the next message (e.g. "Working…"). */
  show(text: string, options?: { sticky?: boolean }): void;
}

export function createToast(el: HTMLElement): Toast {
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const write = (text: string) => {
    el.textContent = text;
    el.classList.add('show');
  };

  return {
    show(text, { sticky = false } = {}) {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
      if (el.textContent === text) {
        // The same text again would not be announced; clear it first.
        el.textContent = '';
        requestAnimationFrame(() => write(text));
      } else {
        write(text);
      }
      if (sticky) return;
      hideTimer = setTimeout(() => {
        el.classList.remove('show');
        // Empty the region after the fade, so screen readers do not find stale text.
        clearTimer = setTimeout(() => {
          el.textContent = '';
        }, FADE_MS + 100);
      }, SHOW_MS);
    },
  };
}
