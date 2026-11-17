// Resurrect animation, "up into warm light" (design steering file, Motion), as
// resurrect() in design/mockup.html:
// 1. an amber glow opens in the ground under the stone (the only warm light);
// 2. the stone slides aside and tips;
// 3. a sheet ghost rises with the site's icon as its eyes; marigold petals burst and fall;
// 4. the ghost flies off the top edge, toward the tab bar.
// The caller then sends `resurrect`: the plot becomes fresh soil, or on an
// error the stone comes back. Reduced motion: the stone fades out (0.3 s) and,
// after an error, fades back in.

import type { Grave } from '../core/types.js';
import {
  GLOW_IN_MS, SLIDE_AT_MS, SLIDE_MS, GHOST_AT_MS, GHOST_RISE_MS, FLY_AT_MS, FLY_MS, GLOW_OUT_MS,
  PETAL_COUNT, RESURRECT_FADE_MS, RETURN_MS, resurrectGeometry, petalFlight,
} from '../core/resurrect-motion.js';
import { medallion } from './stone.js';
import { prefersReducedMotion } from './mass-burial.js';
import { fx, settle, sleep, staticSvg } from './fx.js';

/** The mockup's GHOST: static markup, no user data. */
const GHOST_SVG =
  '<svg viewBox="0 0 100 124" aria-hidden="true"><defs><linearGradient id="gsheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8f1"/><stop offset="1" stop-color="#d6dbe2"/></linearGradient></defs>' +
  '<path d="M50 4 C23 4 11 27 11 52 L11 112 Q19 103 27 112 Q35 121 43 112 Q51 103 59 112 Q67 121 75 112 Q83 103 89 112 L89 52 C89 27 77 4 50 4Z" fill="url(#gsheet)"/>' +
  '<path d="M30 62 C34 82 32 98 27 110 M70 64 C66 84 68 98 73 110" stroke="#c4cad3" stroke-width="2" fill="none" opacity=".7"/></svg>';

const SLID = { transform: 'translateX(34%) rotate(10deg)', opacity: 0.9 };
const EASE_SLIDE = 'cubic-bezier(.3,.7,.3,1)';

/**
 * Play the animation up to the moment the tab should open. Resolves with
 * `restore`, which brings the stone back after an error reply. On success the
 * caller vacates the plot (fresh soil) and the stone stays hidden.
 */
export async function playResurrect(plot: HTMLElement, grave: Grave): Promise<{ restore(): Promise<void> }> {
  const stone = plot.querySelector<HTMLElement>('.stone');
  plot.classList.add('resurrecting'); // the stone takes no clicks meanwhile
  const done = () => plot.classList.remove('resurrecting');
  if (stone === null) return { restore: async () => done() };

  if (prefersReducedMotion()) {
    const out = stone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RESURRECT_FADE_MS, fill: 'forwards' });
    await settle(out);
    return {
      async restore() {
        const back = stone.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RESURRECT_FADE_MS });
        out.cancel();
        await settle(back);
        done();
      },
    };
  }

  const geo = resurrectGeometry(stone.getBoundingClientRect());

  // 1. The ground splits: the only warm light on the page.
  const glow = fx('warm-glow', geo.glow);
  glow.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.1)' }], { duration: GLOW_IN_MS, easing: 'ease-out', fill: 'forwards' });
  await sleep(SLIDE_AT_MS);

  // 2. The stone slides aside, from wherever its decay tilt left it.
  const rest = getComputedStyle(stone).transform;
  const resting = { transform: rest === 'none' ? 'none' : rest, opacity: 1 };
  const slide = stone.animate([resting, SLID], { duration: SLIDE_MS, easing: EASE_SLIDE, fill: 'forwards' });
  await sleep(GHOST_AT_MS - SLIDE_AT_MS);

  // 3. The ghost rises with the icon for eyes; marigold petals burst outward and fall.
  const ghost = fx('ghost', geo.ghost);
  ghost.append(staticSvg(GHOST_SVG), medallion(grave, 'eye l'), medallion(grave, 'eye r'));
  ghost.animate(
    [
      { opacity: 0, transform: 'translateY(45%) scale(.55)' },
      { opacity: 1, transform: 'translateY(-18%) scale(1)', offset: 0.7 },
      { opacity: 1, transform: 'translateY(-26%) scale(1) rotate(-3deg)' },
    ],
    { duration: GHOST_RISE_MS, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
  );
  for (let i = 0; i < PETAL_COUNT; i++) {
    const petal = fx('petal', geo.petal);
    const f = petalFlight([Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]);
    const flight = petal.animate(
      [
        { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
        { opacity: 0, transform: `translate(${f.dx}px, ${f.dy}px) rotate(${f.rotateDeg}deg) scale(${f.scale})` },
      ],
      { duration: f.durationMs, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'forwards' },
    );
    void settle(flight).then(() => petal.remove());
  }
  await sleep(FLY_AT_MS - GHOST_AT_MS);

  // 4. It flies off the top edge, toward the tab bar; the glow fades behind it.
  const fly = ghost.animate(
    [
      { transform: 'translateY(-26%) scale(1) rotate(-3deg)' },
      { transform: `translate(${geo.flyOff.dx}px, ${geo.flyOff.dy}px) scale(.45) rotate(-14deg)`, opacity: 0.9 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' },
  );
  await settle(fly);
  ghost.remove();
  void settle(glow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: GLOW_OUT_MS, fill: 'forwards' })).then(() => glow.remove());

  return {
    async restore() {
      const back = stone.animate([SLID, resting], { duration: RETURN_MS, easing: EASE_SLIDE });
      slide.cancel();
      await settle(back);
      done();
    },
  };
}
