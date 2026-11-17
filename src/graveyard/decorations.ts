// Decorative SVGs from design/mockup.html (ROSE, CRACK, WEB, WEEDS, PERCH,
// FALLEN). Static markup only, never user data; all hidden from screen readers.

const SVG = {
  rose: '<svg class="deco rose" viewBox="0 0 40 60" aria-hidden="true"><path d="M20 58 C19 46 22 38 20 26" stroke="#1d281b" stroke-width="2.4" fill="none"/><path d="M20 44 C14 40 9 42 7 46 C12 47 16 46 20 44Z" fill="#1d281b"/><path d="M20 26 C12 26 9 18 13 12 C15 8 20 7 22 9 C25 6 30 9 30 14 C31 21 27 26 20 26Z" fill="#120e14"/><path d="M15 14 C18 11 22 12 23 15 C21 19 17 19 15 14Z" fill="#3b0d18"/><path d="M19 18 C21 16 25 17 25 20" stroke="#4a1220" stroke-width="1.4" fill="none"/></svg>',
  crack: '<svg class="deco crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M63 2 L56 15 L64 23 L52 39 L58 48 L49 63" stroke="#191d24" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke"/><path d="M58 48 L69 55" stroke="#191d24" stroke-width="1.2" fill="none" vector-effect="non-scaling-stroke"/></svg>',
  web: '<svg class="deco web" viewBox="0 0 50 50" aria-hidden="true"><g stroke="rgba(232,228,216,.42)" stroke-width=".7" fill="none"><path d="M0 0 L50 50 M0 0 L50 18 M0 0 L18 50 M0 0 L36 50 M0 0 L50 34"/><path d="M10 0 Q12 8 0 10 M22 0 Q24 16 0 22 M34 0 Q36 24 0 34 M46 0 Q46 32 0 46"/></g></svg>',
  weeds: '<svg class="deco weeds" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#2a3824" stroke-width="2" stroke-linecap="round"><path d="M6 40 Q8 24 4 12"/><path d="M12 40 Q14 22 20 10"/><path d="M18 40 Q16 28 10 20"/><path d="M98 40 Q100 20 94 6"/><path d="M104 40 Q108 26 116 16"/><path d="M110 40 Q110 30 104 22"/><path d="M40 40 Q42 32 38 26"/><path d="M80 40 Q78 30 84 24"/><path d="M60 40 Q62 30 58 22"/></g></svg>',
  perch: '<svg class="deco perch" viewBox="0 0 60 50" aria-hidden="true"><path d="M8 30 C10 22 18 18 26 19 C30 12 38 10 44 14 L55 13 L46 18 C48 24 46 32 38 36 L40 47 M33 37 L32 47" fill="#04060a" stroke="#04060a" stroke-width="2"/><path d="M8 30 C4 31 2 34 1 38 C6 35 12 34 18 32" fill="#04060a"/><circle cx="42" cy="16" r="1.3" fill="#9aa3b0"/></svg>',
  fallen: '<svg class="deco fallen" viewBox="0 0 90 40" aria-hidden="true"><g fill="#3a414d" stroke="#232831" stroke-width="1.5"><rect x="4" y="18" width="80" height="11" rx="2"/><rect x="58" y="6" width="11" height="34" rx="2"/></g></svg>',
} as const;

export type Decoration = keyof typeof SVG;

const parsed = new Map<Decoration, Element>();

/** A fresh copy of a decoration (each SVG string is parsed once). */
export function decoration(name: Decoration): Element {
  let template = parsed.get(name);
  if (template === undefined) {
    const holder = document.createElement('template');
    holder.innerHTML = SVG[name];
    template = holder.content.firstElementChild!;
    parsed.set(name, template);
  }
  return template.cloneNode(true) as Element;
}
