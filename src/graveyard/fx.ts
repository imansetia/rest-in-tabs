// Shared helpers for the Resurrect and Exorcise effects (tasks 11.9, 11.10).

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves when the animation ends or is cancelled. */
export const settle = (animation: Animation) => animation.finished.then(() => undefined, () => undefined);

/** A decorative element fixed over the page (CSSOM writes, allowed by the CSP), hidden from screen readers. */
export function fx(className: string, box: { x: number; y: number; w: number; h?: number }): HTMLElement {
  const el = document.createElement('div');
  el.className = `fx ${className}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  if (box.h !== undefined) el.style.height = `${box.h}px`;
  document.body.append(el);
  return el;
}

const parsed = new Map<string, Element>();

/** A fresh copy of a static SVG (never user data); each string is parsed once. */
export function staticSvg(markup: string): Element {
  let template = parsed.get(markup);
  if (template === undefined) {
    const holder = document.createElement('template');
    holder.innerHTML = markup;
    template = holder.content.firstElementChild!;
    parsed.set(markup, template);
  }
  return template.cloneNode(true) as Element;
}
