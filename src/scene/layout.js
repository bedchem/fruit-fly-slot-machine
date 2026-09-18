/**
 * Where everything sits. Shared by the app and by tools/preview.mjs, so the
 * framing a preview render shows is the framing the app builds.
 *
 * World frame: the slot pillar's axis is the origin, its base is on Y = 0,
 * and the machine the fly plays faces +X.
 */
import parts from './parts.js';
import { SHOULDER, REACH } from './flyRig.js';

export const PARTS = parts;

/** Lever swing, radians about +Z. 0 is the modelled rest pose. */
export const LEVER_REST = 0;
export const LEVER_PULLED = -0.95;

/** Where the lever knob is, in world space, at a given swing angle. */
export function knobAt(angle) {
  const [kx, ky, kz] = parts.lever.knobLocal;
  const [px, py, pz] = parts.lever.pivot;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [px + kx * c - ky * s, py + kx * s + ky * c, pz + kz];
}

/**
 * The stool this machine is served by, measured by tools/build-slot.mjs.
 * It stays exactly where the model parks it — the fly is fitted to the stool,
 * not the other way round (tools/fit-seated.mjs solves that).
 */
export const STOOL = {
  origin: parts.stool.origin,
  seatCenter: parts.stool.seatCenter,
  seatRadius: parts.stool.seatRadius,
  // The stool stays exactly where the model parks it.
  offset: [0, 0, 0],
};

/**
 * The fly, sitting up on the stool.
 *
 * A standing insect is horizontal; someone sitting at a machine is not. The
 * pitch tips the scan up onto its abdomen so the body is close to vertical —
 * that is what reads as sitting rather than hovering — and the yaw turns it so
 * the handle falls on its right, the side flyRig.js is measured for.
 *
 * position.y is chosen so the lowest point of the body lands on the cushion;
 * tools/poses.mjs solves all four numbers together with the stool offset.
 */
export const FLY = {
  position: [0.9631, 1.2664, -0.1845],
  rotationY: -1.9208,
  pitch: -1.05,
  scale: 0.62,
};

/** Fly model space -> world, including the seated pitch. */
export function flyToWorld([x, y, z], fly = FLY) {
  const cp = Math.cos(fly.pitch), sp = Math.sin(fly.pitch);
  const py = y * cp - z * sp;
  const pz = y * sp + z * cp;
  const cy = Math.cos(fly.rotationY), sy = Math.sin(fly.rotationY);
  const sx = x * fly.scale, syy = py * fly.scale, sz = pz * fly.scale;
  return [
    fly.position[0] + sx * cy + sz * sy,
    fly.position[1] + syy,
    fly.position[2] - sx * sy + sz * cy,
  ];
}

/** World -> fly model space. */
export function worldToFly([x, y, z], fly = FLY) {
  const cy = Math.cos(fly.rotationY), sy = Math.sin(fly.rotationY);
  const dx = (x - fly.position[0]) / fly.scale;
  const dy = (y - fly.position[1]) / fly.scale;
  const dz = (z - fly.position[2]) / fly.scale;
  const ux = dx * cy - dz * sy;
  const uz = dx * sy + dz * cy;
  const cp = Math.cos(-fly.pitch), sp = Math.sin(-fly.pitch);
  return [ux, dy * cp - uz * sp, dy * sp + uz * cp];
}

/**
 * Where the tarsus should actually land: on the near face of the knob rather
 * than buried in its centre, so the foot sits on the ball instead of through it.
 */
export function gripAt(angle, from = FLY.position) {
  const k = knobAt(angle);
  const d = [from[0] - k[0], 0, from[2] - k[2]];
  const l = Math.hypot(d[0], d[2]) || 1;
  const r = parts.lever.knob.radius * 0.9;
  return [k[0] + (d[0] / l) * r, k[1] + r * 0.35, k[2] + (d[2] / l) * r];
}

/** How far the foreleg has to stretch to reach a world point, 0..1 of its span. */
export function reachFraction(worldPoint, fly = FLY) {
  const p = worldToFly(worldPoint, fly);
  return Math.hypot(p[0] - SHOULDER[0], p[1] - SHOULDER[1], p[2] - SHOULDER[2]) / REACH;
}

/**
 * The shot. Set in front of the machine and a little to the handle side, high
 * enough to look down the cabinet face: the reels stay readable, and the fly
 * and the lever are both in frame through the whole pull.
 */
export const CAMERA = {
  position: [4.95, 2.70, -3.35],
  target: [1.05, 1.38, -0.15],
  fov: 40,
};

export const GROUND_Y = 0;
