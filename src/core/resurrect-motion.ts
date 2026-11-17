// Resurrect timing and geometry, from resurrect() in design/mockup.html. Pure.
// "Up into warm light": glow in the ground, the stone slides aside, the ghost
// rises with marigold petals, then flies off the top edge.

/** The amber glow opens in the ground. */
export const GLOW_IN_MS = 650;
/** The stone starts sliding aside this long after the glow starts... */
export const SLIDE_AT_MS = 450;
export const SLIDE_MS = 520;
/** ...and the ghost starts rising this long after the glow starts. */
export const GHOST_AT_MS = SLIDE_AT_MS + 260;
export const GHOST_RISE_MS = 1000;
/** The ghost flies off the top edge this long after the glow starts. */
export const FLY_AT_MS = GHOST_AT_MS + 1150;
export const FLY_MS = 820;
/** The glow fades once the ghost has gone. */
export const GLOW_OUT_MS = 600;
/** Petals burst outward and fall for 1.3 to 2.1 s each. */
export const PETAL_COUNT = 18;
export const PETAL_MIN_MS = 1300;
export const PETAL_MAX_MS = 2100;
/** Reduced motion: the stone fades out (and back in after an error). */
export const RESURRECT_FADE_MS = 300;
/** On an error reply, the stone slides back into place. */
export const RETURN_MS = 520;

/** From the start of the glow until the ghost has left the page (motion on). */
export const RESURRECT_MS = FLY_AT_MS + FLY_MS;

export interface Box {
  x: number;
  y: number;
  w: number;
  h?: number;
}

export interface ResurrectGeometry {
  glow: Box;
  ghost: Box;
  /** Where the ghost ends, relative to where it rose: up past the top edge, toward the tab bar. */
  flyOff: { dx: number; dy: number };
  /** Where every petal starts. */
  petal: Box;
}

/**
 * Page positions (viewport px) for the effects, from the stone's bounding box.
 * The glow is centred on the foot of the stone, twice its width; the ghost is
 * 0.78 of the stone's width (at least 70 px) and stands on the same foot.
 */
export function resurrectGeometry(stone: { left: number; width: number; bottom: number }): ResurrectGeometry {
  const baseX = stone.left + stone.width / 2;
  const baseY = stone.bottom;
  const w = stone.width;
  const gw = Math.max(70, w * 0.78);
  return {
    glow: { x: baseX - w, y: baseY - w * 0.9, w: w * 2, h: w * 1.6 },
    ghost: { x: baseX - gw / 2, y: baseY - gw * 1.24, w: gw },
    flyOff: { dx: -baseX * 0.35, dy: -(baseY + 260) },
    petal: { x: baseX - 5, y: baseY - 18, w: 10, h: 14 },
  };
}

export interface PetalFlight {
  dx: number;
  dy: number;
  rotateDeg: number;
  scale: number;
  durationMs: number;
}

/**
 * One petal's flight from five numbers in [0, 1) (Math.random in the page):
 * out by up to 180 px either side, up by 90 to 320 px, spinning up to 1.5 turns
 * either way, shrinking to 0.5 to 1, over 1.3 to 2.1 s.
 */
export function petalFlight(u: readonly [number, number, number, number, number]): PetalFlight {
  const between = (t: number, a: number, b: number) => a + Math.min(1, Math.max(0, t)) * (b - a);
  return {
    dx: between(u[0], -180, 180),
    dy: between(u[1], -320, -90),
    rotateDeg: between(u[2], -540, 540),
    scale: between(u[3], 0.5, 1),
    durationMs: between(u[4], PETAL_MIN_MS, PETAL_MAX_MS),
  };
}
