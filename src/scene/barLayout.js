/**
 * Where everything in the bar sits. The fly and its stool are where the
 * casino puts them (layout.js) — the fly's seated pose was solved against
 * that stool — and the counter is built where the slot pillar stood.
 *
 * World frame, one unit a metre: Y up, the floor on Y = 0. The counter runs
 * along Z; the fly sits on its +X side and faces -X, over the counter.
 */
import { FLY, flyToWorld } from './layout.js';

/**
 * The old bar brings its own upholstered stool, and OldBar.jsx stands it
 * exactly where the casino's stool is. Its cushion is taller, though: the top
 * is at 0.892 against the casino seat's 0.803, so at the bar the fly keeps its
 * pose and sits that much higher.
 */
export const SEAT_RISE = 0.089;
export const BAR_FLY = { ...FLY, position: [FLY.position[0], FLY.position[1] + SEAT_RISE, FLY.position[2]] };

/**
 * The mouthparts, in the fly's own model space: the underside of the front of
 * the head, where the proboscis folds away. Measured off the scan: the
 * lowest, frontmost part of the head.
 */
export const MOUTH_LOCAL = [0.02, 0.585, 0.66];
export const MOUTH = flyToWorld(MOUTH_LOCAL, BAR_FLY);

/** The bar counter: a slab whose near edge the fly sits at. */
export const COUNTER = {
  top: 1.30,
  thickness: 0.06,
  front: 0.86,      // X of the near edge, the fly's side
  back: 0.26,
  zMin: -2.6,
  zMax: 2.2,
};

/**
 * The glass, on the counter right in front of the fly, with a straw bent
 * over to its mouth: flies drink through the proboscis, not from a rim.
 */
export const GLASS = {
  base: [0.82, COUNTER.top, -0.065],
  height: 0.16,
  radiusTop: 0.043,
  radiusBottom: 0.034,
};

/** The tarsus closes around the middle of the glass while it drinks. */
export const GLASS_GRIP = [GLASS.base[0] - 0.03, GLASS.base[1] + 0.085, GLASS.base[2]];

/** Bottom of the glass when its rim reaches the mouth for a proper sip. */
export const DRINK_GLASS_BASE = [MOUTH[0] - 0.025, MOUTH[1] - GLASS.height - 0.012, MOUTH[2] + 0.006];
export const DRINK_GLASS_GRIP = [DRINK_GLASS_BASE[0] - 0.045, DRINK_GLASS_BASE[1] + 0.085, DRINK_GLASS_BASE[2]];

/** The pouch tin, on the counter under the right foreleg. */
export const TIN = {
  center: [0.84, COUNTER.top, -0.305],
  radius: 0.036,
  height: 0.021,
};

/** Where the tarsus closes on a pouch: the top of the open tin. */
export const TIN_GRIP = [TIN.center[0] + 0.012, TIN.center[1] + TIN.height + 0.006, TIN.center[2] + 0.004];

/**
 * Where a pouch gets tucked: just under the mouthparts, a touch to the right —
 * the fly's version of under the lip.
 */
export const TUCK = flyToWorld([MOUTH_LOCAL[0] - 0.05, MOUTH_LOCAL[1] - 0.04, MOUTH_LOCAL[2] - 0.02], BAR_FLY);
/**
 * The same spot relative to the mouthparts, as a world offset. The head turns,
 * so the scene adds this to where the mouth actually is each frame.
 */
export const LIP_OFFSET = [TUCK[0] - MOUTH[0], TUCK[1] - MOUTH[1], TUCK[2] - MOUTH[2]];

/**
 * The end of the straw: a little in front of and below the mouthparts, so the
 * proboscis has somewhere to reach. The straw is bent to arrive here.
 */
export const STRAW_TIP = (() => {
  const m = flyToWorld(MOUTH_LOCAL, BAR_FLY);
  return [m[0] - 0.075, m[1] - 0.085, m[2] + 0.01];
})();

/**
 * The shot: down the length of the counter from the fly's right, so the
 * face, the proboscis on the straw, the glass and the tin are all in view,
 * with the stool under it and the back bar alongside.
 */
export const BAR_CAMERA = {
  position: [0.20, 2.54, -3.59],
  target: [0.72, 1.51, 0.11],
  fov: 43,
};
