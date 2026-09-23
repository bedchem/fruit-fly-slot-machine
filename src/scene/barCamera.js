import { BAR_CAMERA } from './barLayout.js';

export const BAR_CAMERA_LIMITS = Object.freeze({ yaw: 0.55, pitch: 0.18, zoomMin: 0.86, zoomMax: 1.16 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/** Keep the seated fly in view while leaving room to inspect the pub. */
export function constrainBarView(view) {
  const limits = BAR_CAMERA_LIMITS;
  view.yaw = clamp(finite(view.yaw, 0), -limits.yaw, limits.yaw);
  view.pitch = clamp(finite(view.pitch, 0), -limits.pitch, limits.pitch);
  view.zoom = clamp(finite(view.zoom, 1), limits.zoomMin, limits.zoomMax);
  return view;
}

export function dragBarView(view, dx, dy, width, height) {
  view.yaw -= finite(dx, 0) / Math.max(1, width) * 1.4;
  view.pitch += finite(dy, 0) / Math.max(1, height) * 0.7;
  return constrainBarView(view);
}

export function zoomBarView(view, delta) {
  view.zoom *= Math.exp(clamp(finite(delta, 0), -100, 100) * 0.0012);
  return constrainBarView(view);
}

/** Exponential damping has the same response at 30, 60 and 120 Hz. */
export function dampBarView(current, desired, dt) {
  const blend = 1 - Math.exp(-Math.max(0, finite(dt, 0)) * 11);
  for (const key of ['yaw', 'pitch', 'zoom']) current[key] += (desired[key] - current[key]) * blend;
  return current;
}

/** A portrait canvas needs a wider vertical lens to retain the counter and fly. */
export function barCameraFov(width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  return BAR_CAMERA.fov + clamp((1.15 - aspect) * 19, 0, 15);
}

const OFFSET = BAR_CAMERA.position.map((value, i) => value - BAR_CAMERA.target[i]);
const RADIUS = Math.hypot(...OFFSET);
const BASE_YAW = Math.atan2(OFFSET[0], OFFSET[2]);
const BASE_PITCH = Math.asin(OFFSET[1] / RADIUS);

/** Pure world-space pose, also used by the camera's motion regression tests. */
export function sampleBarCamera(view, motion = {}, out = { position: [0, 0, 0], roll: 0 }) {
  // Camera parallax is deliberately mouse-only. The scene can sway and shake
  // as part of the fly's body animation, but the room itself never drifts by
  // time, alcohol level or an idle sine wave.
  const pointerMotion = motion.reducedMotion ? 0 : 1;
  const yaw = BASE_YAW + view.yaw + finite(motion.hoverX, 0) * 0.028 * pointerMotion;
  const pitch = BASE_PITCH + view.pitch - finite(motion.hoverY, 0) * 0.018 * pointerMotion;
  const radius = RADIUS * view.zoom;
  const horizontal = Math.cos(pitch) * radius;
  out.position[0] = BAR_CAMERA.target[0] + Math.sin(yaw) * horizontal;
  out.position[1] = BAR_CAMERA.target[1] + Math.sin(pitch) * radius;
  out.position[2] = BAR_CAMERA.target[2] + Math.cos(yaw) * horizontal;
  out.roll = 0;
  return out;
}
