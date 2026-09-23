/**
 * Where the two scrollers sit. Ryhox takes the casino's seat (layout.js),
 * Plattnericus the same pose moved along the floor beside it, each on its own
 * stool. A phone floats in front of each face — held, as far as the scene is
 * concerned, by the legs the rig does not drive — with the right foreleg free
 * to swipe and tap.
 *
 * The phone is placed in the world, relative to the eyes: a hand's length in
 * front along the fly's heading and a little below. (The seated fly is tipped
 * back, so "forward" in its own model space points half at the ceiling.)
 * tools/check-scroll-reach.mjs confirms the foreleg reaches the whole screen.
 */
import { FLY, flyToWorld, worldToFly } from './layout.js';

/** How far apart the two stools stand, along Z. */
export const SPACING = 0.95;

export const POSES = [
  FLY,
  { ...FLY, position: [FLY.position[0], FLY.position[1], FLY.position[2] + SPACING] },
];
export const STOOL_OFFSETS = [[0, 0, 0], [0, 0, SPACING]];

/** Where the eyes are, in the fly's model space: the phone faces them, the head aims them. */
export const EYES_LOCAL = [0.02, 0.64, 0.6];
/** The phone: this far in front of the eyes along the heading, and this far below. */
const PHONE_AHEAD = 0.23;
const PHONE_BELOW = 0.14;
/** Asleep, it slides down into the lap. */
const LAP_AHEAD = 0.1;
const LAP_BELOW = 0.34;

/**
 * Phone size, metres, as the world goes — the flies are person-sized here.
 * A generous phablet, so the glow and the glass read at the distance of the
 * shot.
 */
export const PHONE = { width: 0.118, height: 0.244, depth: 0.01 };

/** Screen-space points the foreleg uses, as fractions of the screen (x right, y up). */
export const SWIPE_FROM = [0.05, -0.3];
export const SWIPE_TO = [0.05, 0.3];
export const SHARE_BUTTON = [0.36, -0.12];
export const THUMB_REST = [0.52, -0.42];

export const eyesWorld = (i) => flyToWorld(EYES_LOCAL, POSES[i]);
const ahead = (i, dist, below) => {
  const e = eyesWorld(i);
  const r = POSES[i].rotationY;
  return [e[0] + Math.sin(r) * dist, e[1] - below, e[2] + Math.cos(r) * dist];
};
export const phoneWorld = (i) => ahead(i, PHONE_AHEAD, PHONE_BELOW);
export const lapWorld = (i) => ahead(i, LAP_AHEAD, LAP_BELOW);
/** The phone in the fly's own model space, for the reach check. */
export const phoneLocal = (i = 0) => worldToFly(phoneWorld(i), POSES[i]);

/**
 * The shot: from behind the pair, over Ryhox's shoulder — the way you would
 * catch two people on their phones late at night. Both screens face the
 * camera beside their owners' heads, and the window is ahead of them.
 * Checked by projection: both flies whole, both screens clear of the heads.
 */
export const SCROLL_CAMERA = {
  position: [3.9, 2.7, -1.2],
  target: [0.75, 1.3, 0.35],
  fov: 40,
};
