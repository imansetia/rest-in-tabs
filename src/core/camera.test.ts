import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { cameraFocus, CAMERA_MAX_ZOOM } from './camera.js';
import { ROWS } from './layout.js';

const W = 1265, H = 750;

describe('cameraFocus', () => {
  it('does not zoom or move for a front-row grave (0.92 / 1 < 1)', () => {
    expect(cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: 300, targetY: 600, rowScale: 1 })).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('zooms by 0.92 / s for middle rows and at most 1.9 for far rows', () => {
    expect(cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: W / 2, targetY: H / 2, rowScale: 0.62 }).scale).toBeCloseTo(0.92 / 0.62, 10);
    expect(cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: W / 2, targetY: H / 2, rowScale: 0.34 }).scale).toBe(CAMERA_MAX_ZOOM);
  });

  it('places the target at 50% across and 60% down when nothing is clamped', () => {
    const k = 0.92 / 0.62;
    const f = cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: W / 2, targetY: H / 2, rowScale: 0.62 });
    expect(f.x + k * (W / 2)).toBeCloseTo(W * 0.5, 6);
    expect(f.y + k * (H / 2)).toBeCloseTo(H * 0.6, 6);
  });

  it('clamps at the edges, so a grave at the far left does not pull the scene off its edge', () => {
    const f = cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: 10, targetY: 20, rowScale: 0.5 });
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
    const g = cameraFocus({ sceneWidth: W, sceneHeight: H, targetX: W - 10, targetY: H - 5, rowScale: 0.5 });
    expect(g.x).toBeCloseTo(W * (1 - g.scale), 6);
    expect(g.y).toBeCloseTo(H * (1 - g.scale), 6);
  });

  it('always covers the whole scene and keeps the zoom between 1 and 1.9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 360, max: 2560 }),
        fc.integer({ min: 540, max: 900 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(...ROWS.map((r) => r.scale)),
        (sceneWidth, sceneHeight, fx, fy, rowScale) => {
          const f = cameraFocus({ sceneWidth, sceneHeight, targetX: fx * sceneWidth, targetY: fy * sceneHeight, rowScale });
          expect(f.scale).toBeGreaterThanOrEqual(1);
          expect(f.scale).toBeLessThanOrEqual(CAMERA_MAX_ZOOM);
          // The scaled camera spans [x, x + k·W] × [y, y + k·H]; it must contain [0, W] × [0, H].
          expect(f.x).toBeLessThanOrEqual(1e-9);
          expect(f.y).toBeLessThanOrEqual(1e-9);
          expect(f.x + f.scale * sceneWidth).toBeGreaterThanOrEqual(sceneWidth - 1e-6);
          expect(f.y + f.scale * sceneHeight).toBeGreaterThanOrEqual(sceneHeight - 1e-6);
        },
      ),
      { numRuns: 300 },
    );
  });
});
