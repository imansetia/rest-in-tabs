// Mass burial timing and maths, from buryIdle / countUp in design/mockup.html. Pure.

/** Fog rolls in before the graves rise. */
export const FOG_ROLL_MS = 900;
/** One new grave starts rising every 170 ms. */
export const RISE_STEP_MS = 170;
/** After the last grave starts: 600 ms, then the fog recedes over 500 ms. */
export const RISE_TAIL_MS = 600;
export const FOG_RECEDE_MS = 500;
/** The counts tick up over 1.4 s. */
export const COUNT_UP_MS = 1400;
/** Reduced motion: new graves fade in over 0.3 s. */
export const FADE_MS = 300;

/**
 * Start delay of each rising grave: newest first, 170 ms apart. The newest
 * graves stand in the front row, so the front row rises first.
 * `newestFirst` is every shown grave id in display order.
 */
export function riseDelays(newestFirst: string[], rising: ReadonlySet<string>, stepMs = RISE_STEP_MS): Map<string, number> {
  const delays = new Map<string, number>();
  for (const id of newestFirst) if (rising.has(id)) delays.set(id, delays.size * stepMs);
  return delays;
}

/** Total time from the start of the fog to the end of the burial (motion on). */
export function massBurialMs(risingCount: number): number {
  return FOG_ROLL_MS + RISE_TAIL_MS + risingCount * RISE_STEP_MS + FOG_RECEDE_MS;
}

/**
 * Count-up value at `progress` (0 to 1) with the mockup's ease-out cubic:
 * from + (to − from) × (1 − (1 − p)³), rounded.
 */
export function countUpValue(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * (1 - (1 - p) ** 3));
}
