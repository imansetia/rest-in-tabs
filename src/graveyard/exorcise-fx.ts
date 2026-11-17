// Exorcise animation, "down into the dark" (design steering file, Motion), as
// exorcise() in design/mockup.html. It plays after the confirmation and a
// successful reply:
// 1. a moment of silence: the scene dims and the fog stops (0.8 s);
// 2. one lightning strike from the top of the sky to the stone, with a flash limited to the scene;
// 3. bats scatter upward and the stone sinks into the ground (1.1 s);
// 4. the crow on the fence calls once (a head movement).
// The caller then shows bare ground. Reduced motion: the stone fades out (0.3 s).

import {
  HUSH_MS, STRIKE_MS, SINK_AT_MS, SINK_MS, BAT_COUNT, EXORCISE_FADE_MS,
  exorciseGeometry, boltPoints, batFlight, BOLT_STEPS,
} from '../core/exorcise-motion.js';
import { prefersReducedMotion } from './mass-burial.js';
import { fx, settle, sleep, staticSvg } from './fx.js';

export interface ExorciseElements {
  scene: HTMLElement;
  /** The white flash over the scene (not the page). */
  flash: HTMLElement;
  /** The crow on the fence. */
  crow: Element;
}

/** The mockup's BAT: static markup, no user data. */
const BAT_SVG =
  '<svg viewBox="0 0 60 30" aria-hidden="true"><path d="M30 10 C28 6 26 6 25 9 C20 4 10 4 2 10 C8 11 11 14 12 18 C16 15 20 15 22 18 C25 16 28 17 30 21 C32 17 35 16 38 18 C40 15 44 15 48 18 C49 14 52 11 58 10 C50 4 40 4 35 9 C34 6 32 6 30 10Z" fill="#090b11"/></svg>';

const SVG_NS = 'http://www.w3.org/2000/svg';
const random5 = () => [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()] as const;

/** Silences can overlap (two exorcisms at once); the scene wakes when the last one ends. */
let hushes = 0;

function boltElement(box: { x: number; y: number; w: number; h: number }): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'bolt');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(box.w));
  svg.setAttribute('height', String(box.h));
  svg.style.left = `${box.x}px`;
  svg.style.top = `${box.y}px`;
  const sway = Array.from({ length: BOLT_STEPS - 1 }, () => Math.random());
  const points = boltPoints(box.h, sway).map(([x, y]) => `${x},${y}`).join(' ');
  // A bright core, then a wide pale glow (the mockup's two polylines).
  for (const [stroke, width] of [['#eef3ff', '3'], ['rgba(170,200,255,.5)', '10']]) {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', points);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', width);
    line.setAttribute('stroke-linejoin', 'bevel');
    svg.append(line);
  }
  return svg;
}

/** Restart the fence crow's one call. */
function caw(crow: Element): void {
  crow.classList.remove('caw');
  void crow.getBoundingClientRect();
  crow.classList.add('caw');
}

/** Play the animation; resolves when the stone is gone (under the ground, or faded). */
export async function playExorcise(plot: HTMLElement, els: ExorciseElements): Promise<void> {
  const stone = plot.querySelector<HTMLElement>('.stone');
  if (stone === null) return;
  plot.classList.add('exorcising'); // the stone takes no clicks meanwhile

  if (prefersReducedMotion()) {
    await settle(stone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXORCISE_FADE_MS, fill: 'forwards' }));
    return;
  }

  hushes++;
  els.scene.classList.add('hush');
  try {
    // 1. A moment of silence.
    await sleep(HUSH_MS);

    // 2. One strike, from the top of the sky to the stone; the flash covers the scene only.
    const geo = exorciseGeometry(stone.getBoundingClientRect(), els.scene.getBoundingClientRect().top);
    const bolt = boltElement(geo.bolt);
    document.body.append(bolt);
    els.flash.animate([{ opacity: 0 }, { opacity: 0.75 }, { opacity: 0.08 }, { opacity: 0.5 }, { opacity: 0 }], { duration: STRIKE_MS });
    void settle(bolt.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: STRIKE_MS, fill: 'forwards' })).then(() => bolt.remove());
    await sleep(SINK_AT_MS);

    // 3. Bats scatter upward; the stone sinks into the ground.
    for (let i = 0; i < BAT_COUNT; i++) {
      const bat = fx('bat', geo.bat);
      bat.append(staticSvg(BAT_SVG));
      const f = batFlight(random5());
      const flight = bat.animate(
        [
          { opacity: 0, transform: 'translate(0, 0) scale(.4)' },
          { opacity: 1, transform: `translate(${f.burst.dx}px, ${f.burst.dy}px) scale(1)`, offset: 0.2 },
          { opacity: 0, transform: `translate(${f.end.dx}px, ${f.end.dy}px) scale(.7)` },
        ],
        { duration: f.durationMs, easing: 'ease-in', fill: 'forwards' },
      );
      void settle(flight).then(() => bat.remove());
    }
    plot.classList.add('sinking'); // the ground hides the sinking stone
    const rest = getComputedStyle(stone).transform;
    await settle(stone.animate(
      [{ transform: rest === 'none' ? 'none' : rest }, { transform: 'translateY(108%)' }],
      { duration: SINK_MS, easing: 'cubic-bezier(.55,0,.8,.4)', fill: 'forwards' },
    ));

    // 4. The crow on the fence calls once.
    caw(els.crow);
  } finally {
    hushes--;
    if (hushes === 0) els.scene.classList.remove('hush');
  }
}
