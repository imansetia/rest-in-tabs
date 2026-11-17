// Landscape layout, as written in .kiro/steering/design.md ("Rows") and in
// renderLandscape in design/mockup.html. Pure: plain numbers in, plain data out.

/** Row scale and fog veil, front row first. */
export const ROWS: ReadonlyArray<{ scale: number; veil: number }> = [
  { scale: 1, veil: 0 },
  { scale: 0.78, veil: 0.18 },
  { scale: 0.62, veil: 0.35 },
  { scale: 0.5, veil: 0.48 },
  { scale: 0.41, veil: 0.56 },
  { scale: 0.34, veil: 0.6 },
];

const PLOT_HEIGHT = 236;
const PLOT_WIDTH = 172;
const PLOT_GAP = 30;
const PLOT_PITCH = PLOT_WIDTH + PLOT_GAP; // plot width plus the gap between plots
const FRONT_BOTTOM = 58;
/** Space kept clear at each side of the scene (the front row's capacity uses the same 40 px). */
const SIDE_MARGIN = 20;

/**
 * Row pitch p: each next row sits 236 × s × p px higher. 0.7 in a scene 680 px
 * or taller (as in the mockup), closer in a short scene so more rows fit:
 * p = max(0.45, 0.7 × min(1, sceneHeight / 680)).
 */
export function rowPitch(sceneHeight: number): number {
  const h = Number.isFinite(sceneHeight) ? Math.max(0, sceneHeight) : 0;
  return Math.max(0.45, 0.7 * Math.min(1, h / 680));
}

/**
 * Distance in px between the centres of neighbouring plots when a row's stones
 * at normal spacing (172 × s wide, 30 × s apart) would be wider than the scene
 * less its side margins; they then stand closer, overlapping, so the whole row
 * fits. undefined when the row fits at normal spacing.
 */
export function crowdedStep(count: number, scale: number, sceneWidth: number): number | undefined {
  if (count < 2) return undefined;
  const room = sceneWidth - 2 * SIDE_MARGIN;
  const normal = count * PLOT_WIDTH * scale + (count - 1) * PLOT_GAP * scale;
  if (normal <= room) return undefined;
  return Math.max(0, (room - PLOT_WIDTH * scale) / (count - 1));
}

export interface RowLayout {
  /** 0 = front row. Also the "depth" used to darken and blur farther rows. */
  index: number;
  scale: number;
  veil: number;
  /** Distance from the bottom of the scene, in px. */
  bottom: number;
  /** How many graves stand in this row. */
  count: number;
  /**
   * Only on a crowded last row: px between neighbouring plot centres (closer
   * than normal, overlapping), so every stone stays in the scene.
   */
  step?: number;
}

/**
 * Split `graveCount` graves (sorted newest first) into rows, front row first.
 * Only rows that hold at least one grave are returned.
 *
 * - Front row capacity: floor((width − 40) / 202), at least 2.
 *   Row i holds max(front, floor(front / s_i) + i).
 * - The front row sits 58 px above the bottom; each next row sits
 *   236 × s × p px higher (s of the row in front, p = rowPitch(sceneHeight)).
 *   Before adding row i > 0 at `bottom`, stop if
 *   bottom + 236 × s_i × 0.55 > 0.8 × sceneHeight. The last row added holds the rest.
 * - A last row with fewer than 3 graves joins the row in front of it, unless
 *   that is the front row and it would then exceed its capacity. The front row
 *   never grows wider than the scene; back rows may run slightly past the
 *   edges (the fog hides them), and a lone stone never floats on the horizon.
 * - The last row never hides graves past the edges: if it would be wider than
 *   the scene, it gets a `step` (crowdedStep) and its stones overlap.
 *
 * Validates: Requirement 4.2
 */
export function layoutRows(graveCount: number, sceneWidth: number, sceneHeight: number): RowLayout[] {
  const front = Math.max(2, Math.floor((sceneWidth - 40) / PLOT_PITCH));

  const pitch = rowPitch(sceneHeight);
  const rows: Array<RowLayout & { capacity: number }> = [];
  let bottom = FRONT_BOTTOM;
  for (const [index, { scale, veil }] of ROWS.entries()) {
    if (index > 0 && bottom + PLOT_HEIGHT * scale * 0.55 > sceneHeight * 0.8) break;
    rows.push({ index, scale, veil, bottom, count: 0, capacity: Math.max(front, Math.floor(front / scale) + index) });
    bottom += PLOT_HEIGHT * scale * pitch;
  }
  rows[rows.length - 1].capacity = Infinity;

  let left = Math.max(0, Math.floor(graveCount));
  for (const row of rows) {
    row.count = Math.min(row.capacity, left);
    left -= row.count;
  }

  const used = rows.filter((row) => row.count > 0);
  const last = used[used.length - 1];
  const inFront = used[used.length - 2];
  if (inFront !== undefined && last.count < 3 && (inFront.index > 0 || inFront.count + last.count <= inFront.capacity)) {
    used.pop();
    inFront.count += last.count;
  }
  const result: RowLayout[] = used.map(({ capacity: _capacity, ...row }) => row);
  const back = result[result.length - 1];
  if (back !== undefined) {
    const step = crowdedStep(back.count, back.scale, sceneWidth);
    if (step !== undefined) back.step = step;
  }
  return result;
}

/**
 * The graves of each row, front row first, newest first within a row. This is
 * also the page order: the front row comes first in the page, so Tab reaches
 * the newest graves first (rows stack visually by z-index, not page order).
 * `newestFirst` is sorted newest first; `rows` comes from layoutRows.
 */
export function graveRows<T>(newestFirst: readonly T[], rows: readonly RowLayout[]): Array<{ row: RowLayout; graves: T[] }> {
  let next = 0;
  return rows.map((row) => {
    const graves = newestFirst.slice(next, next + row.count);
    next += row.count;
    return { row, graves };
  });
}

/**
 * Deterministic, hand-placed look for one plot, from a hash of the grave id
 * (the mockup's hash: h = 7, then h = (h × 31 + charCode) mod 9973).
 * - tiltDeg: ((h mod 7) − 3) || 2, used by Weathered and Crumbling stones
 * - offsetPx: (h mod 5) × 3, a small vertical offset
 * - hasCrow: h mod 3 = 0 (a crow on Crumbling stones)
 * - hasCross: h mod 3 = 1 (a fallen cross beside some Crumbling stones)
 */
export function plotJitter(graveId: string): { tiltDeg: number; offsetPx: number; hasCrow: boolean; hasCross: boolean } {
  let h = 7;
  for (const c of graveId) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return {
    tiltDeg: (h % 7) - 3 || 2,
    offsetPx: (h % 5) * 3,
    hasCrow: h % 3 === 0,
    hasCross: h % 3 === 1,
  };
}
