// Search camera, as walkTo in design/mockup.html: glide toward a grave and
// enlarge it, so a far grave comes forward out of the fog. Pure.

export const CAMERA_MAX_ZOOM = 1.9;

export interface CameraFocusInput {
  sceneWidth: number;
  sceneHeight: number;
  /** Centre of the target plot in the camera's own (unscaled) coordinates, px. */
  targetX: number;
  targetY: number;
  /** Scale s of the target's row (1 = front row). */
  rowScale: number;
}

/**
 * Zoom k = clamp(0.92 / s, 1, 1.9); the target is placed at 50% across and
 * 60% down the scene, then the offset is clamped so the camera always covers
 * the whole scene. The camera's transform-origin is its top-left corner:
 * transform = translate(x, y) scale(k).
 */
export function cameraFocus(input: CameraFocusInput): { scale: number; x: number; y: number } {
  const k = Math.min(CAMERA_MAX_ZOOM, Math.max(1, 0.92 / input.rowScale));
  const x = clamp(input.sceneWidth * 0.5 - k * input.targetX, input.sceneWidth * (1 - k), 0);
  const y = clamp(input.sceneHeight * 0.6 - k * input.targetY, input.sceneHeight * (1 - k), 0);
  return { scale: k, x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
