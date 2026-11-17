// Protected Sites editor on the Options page (task 12, Requirement 8.1).
// Add by button or Enter; each entry has a Remove button. After a removal,
// focus moves to the next Remove button, else the previous one, else the field.

import { validateSetting } from '../core/settings.js';
import { parseSiteEntry } from '../core/options-form.js';
import { focusCandidates } from '../core/focus-order.js';

export interface SitesElements {
  input: HTMLInputElement;
  add: HTMLButtonElement;
  error: HTMLElement;
  list: HTMLUListElement;
  empty: HTMLElement;
}

export interface SitesEditor {
  render(sites: string[]): void;
}

/**
 * `sites()` is the stored list; `save(next)` writes it and resolves true on success.
 * `showError(input, errorEl, text)` sets the inline error and aria-invalid.
 */
export function startSites(
  els: SitesElements,
  sites: () => string[] | null,
  save: (next: string[]) => Promise<boolean>,
  showError: (input: HTMLInputElement, errorEl: HTMLElement, text: string) => void,
): SitesEditor {
  function render(list: string[]): void {
    // A change from another page rebuilds the list: keep focus on the same Remove button.
    const focused = document.activeElement?.closest<HTMLElement>('li[data-domain]')?.dataset.domain;
    els.list.replaceChildren(
      ...list.map((domain) => {
        const li = document.createElement('li');
        li.dataset.domain = domain;
        const name = document.createElement('span');
        name.textContent = domain;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${domain}`);
        remove.addEventListener('click', () => void removeSite(domain));
        li.append(name, remove);
        return li;
      }),
    );
    els.empty.hidden = list.length > 0;
    if (focused !== undefined) {
      els.list.querySelector<HTMLElement>(`li[data-domain="${CSS.escape(focused)}"] button`)?.focus();
    }
  }

  async function addSite(): Promise<void> {
    const list = sites();
    if (list === null) return;
    const parsed = parseSiteEntry(els.input.value, list);
    if (!parsed.ok) {
      showError(els.input, els.error, parsed.error);
      return;
    }
    showError(els.input, els.error, '');
    const next = [...list, parsed.domain];
    if (!validateSetting('protectedSites', next).ok) return;
    if (await save(next)) {
      els.input.value = '';
      render(next);
    }
  }

  async function removeSite(domain: string): Promise<void> {
    const list = sites();
    if (list === null) return;
    const neighbours = focusCandidates(list, domain);
    const next = list.filter((d) => d !== domain);
    if (!(await save(next))) return;
    render(next);
    const target = neighbours
      .map((d) => els.list.querySelector<HTMLElement>(`li[data-domain="${CSS.escape(d)}"] button`))
      .find((b) => b !== null);
    (target ?? els.input).focus();
  }

  els.add.addEventListener('click', () => void addSite());
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void addSite();
    }
  });
  els.input.addEventListener('input', () => showError(els.input, els.error, ''));

  return { render };
}
