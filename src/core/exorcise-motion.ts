// Exorcise timing and geometry, from exorcise() in design/mockup.html. Pure.
// "Down into the dark": a moment of silence, one lightning strike, bats
// scatter, the stone sinks, the fence crow calls once.

/** A moment of silence: the scene dims and the fog stops. */
export const HUSH_MS = 800;
/** The lightning bolt and the flash (limited to the scene) last 0.52 s... */
export const STRIKE_MS = 520;
/** ...and the bats burst out and the stone starts sinking this long after the strike. */
export const SINK_AT_MS = 260;
/** The stone sinks into the ground. */
export const SINK_MS = 1100;
/** Bats: 9 of them, each flying for 1.1 to 1.6 s. */
export const BAT_COUNT = 9;
export const BAT_MIN_MS = 1100;
export const BAT_MAX_MS = 1600;
/** The fence crow's call (a head movement, CSS animation). */
export const CAW_MS = 700;
/** Reduced motion: the stone fades out. */
export const EXORCISE_FADE_MS = 300;

/** From the start of the silence until the stone is under the ground (motion on). */
export const EXORCISE_MS = HUSH_MS + SINK_AT_MS + SINK_MS;

/** The bolt has this many segments between the top of the sky and the stone. */
export const BOLT_STEPS = 7;
const BOLT_WIDTH = 120;
const BOLT_SWAY = 26;

export interface ExorciseGeometry {
  /** Where the bolt's SVG box sits: from the top of the sky down to just inside the stone. */
  bolt: { x: number; y: number; w: number; h: number };
  /** Where every bat starts. */
  bat: { x: number; y: number; w: number };
}

/**
 * Page positions (viewport px) from the stone's bounding box and the top of
 * the scene. The bolt starts at the top of the sky, never above the page
 * header, and ends 20 px into the stone.
 */
export function exorciseGeometry(stone: { left: number; top: number; width: number; height: number }, sceneTop: number): ExorciseGeometry {
  const bx = stone.left + stone.width / 2;
  const skyTop = Math.max(0, sceneTop);
  return {
    bolt: { x: bx - BOLT_WIDTH / 2, y: skyTop, w: BOLT_WIDTH, h: Math.max(0, stone.top + 20 - skyTop) },
    bat: { x: bx - 17, y: stone.top + stone.height * 0.3, w: 34 },
  };
}

const between = (t: number, a: number, b: number) => a + Math.min(1, Math.max(0, t)) * (b - a);

/**
 * The bolt's polyline points inside its box, top to bottom. The ends sit on
 * the centre line; the BOLT_STEPS − 1 bends sway up to 26 px either side,
 * from numbers in [0, 1) (Math.random in the page).
 */
export function boltPoints(height: number, sway: readonly number[]): Array<[number, number]> {
  const centre = BOLT_WIDTH / 2;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= BOLT_STEPS; i++) {
    const x = i === 0 || i === BOLT_STEPS ? centre : centre + between(sway[i - 1] ?? 0.5, -BOLT_SWAY, BOLT_SWAY);
    points.push([x, (height * i) / BOLT_STEPS]);
  }
  return points;
}

export interface BatFlight {
  /** Where it is after the first fifth of its flight (bursting out). */
  burst: { dx: number; dy: number };
  /** Where it ends: far up and out. */
  end: { dx: number; dy: number };
  durationMs: number;
}

/** One bat's flight from five numbers in [0, 1): it bursts out, then scatters upward. */
export function batFlight(u: readonly [number, number, number, number, number]): BatFlight {
  return {
    burst: { dx: between(u[0], -60, 60), dy: between(u[1], -40, -10) },
    end: { dx: between(u[2], -340, 340), dy: between(u[3], -380, -160) },
    durationMs: between(u[4], BAT_MIN_MS, BAT_MAX_MS),
  };
}
