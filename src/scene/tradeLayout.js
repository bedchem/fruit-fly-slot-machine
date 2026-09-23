/**
 * The trading desk. The fly and its stool are where the casino puts them
 * (layout.js); the desk stands where the bar counter did, a wall of six
 * monitors faces the fly across it, and two arcade buttons — BUY and SELL — sit under its right
 * foreleg, placed where the rig can reach (tools/check-trade-reach.mjs).
 */
import { COUNTER } from './barLayout.js';

export const DESK = { ...COUNTER, zMin: -1.4, zMax: 1.2 };

/**
 * Six monitors in two rows of three, standing on the desk and facing the fly
 * (+X). The outer columns hinge on the edges of the middle one and swing in
 * towards it, the way a trader angles a wall of screens: an unbroken arc,
 * every screen turned about the vertical only, so all their edges stay level.
 * Each names what it shows; chartTexture.js has a painter per name.
 */
const SCREEN_W = 0.6;
const SCREEN_H = 0.35;
const GAP = 0.018;               // bezel to bezel
const ROW_Y = [1.935, 1.555];    // top row, bottom row
const MIDDLE = [0.34, -0.1];     // x, z of the middle column
const SWING = 0.3;               // radians the outer columns turn in
const TILT = -0.06;              // every screen leans back the same, a touch
const LAYOUT = [
  ['news', 'main', 'race'],
  ['book', 'tape', 'brain'],
];

/** Centre and yaw of a column: -1 the fly's left (+Z), 0 middle, 1 its right. */
function column(side) {
  if (side === 0) return { x: MIDDLE[0], z: MIDDLE[1], yaw: 0 };
  const half = SCREEN_W / 2 + GAP / 2;
  // the hinge: the middle screen's edge on this side
  const hingeZ = MIDDLE[1] - side * half;
  // from the hinge, half a screen outwards along the swung-in face
  return {
    x: MIDDLE[0] + Math.sin(SWING) * half,
    z: hingeZ - side * Math.cos(SWING) * half,
    yaw: -side * SWING,
  };
}

export const MONITORS = LAYOUT.flatMap((row, r) => row.map((id, c) => {
  const col = column(c - 1);
  return {
    id,
    center: [col.x, ROW_Y[r], col.z],
    yaw: col.yaw,
    width: SCREEN_W,
    height: SCREEN_H,
    tilt: TILT,
  };
}));

/** The screen the fly trades from: the price chart, top middle. */
export const MONITOR = MONITORS.find((m) => m.id === 'main');

const BUTTON_Y = DESK.top + 0.018;
/** The two buttons, a hand's width apart, under the right foreleg. */
export const BUTTONS = {
  // The fly sits at the near end of the desk (z ≈ -1.34). Keep the buttons
  // under its right foreleg and on the desk surface, not in the middle of the
  // desk where the reach rig cannot touch them.
  buy: [0.79, BUTTON_Y, -1.23],
  sell: [0.79, BUTTON_Y, -1.39],
  radius: 0.034,
};

/** Where the tarsus lands on a button, and how far down a press takes it. */
export const pressPoint = (which, depth = 0) => {
  const b = BUTTONS[which];
  return [b[0], b[1] + 0.012 - depth * 0.014, b[2]];
};

/** What the fly watches: the middle of the price chart, a little low. */
export const SCREEN_GAZE = [MONITOR.center[0], MONITOR.center[1] - 0.04, MONITOR.center[2]];

/** Where its eyes go when it glances at another screen. */
export const gazeAt = (id) => {
  const m = MONITORS.find((x) => x.id === id) ?? MONITOR;
  return [m.center[0], m.center[1] - 0.03, m.center[2]];
};

/**
 * The shot: behind the fly and off its right shoulder, the way you would
 * watch someone trade — the wall of screens beyond it, clear of its head,
 * and the buttons under its foreleg. Checked by projection so the six
 * screens land in the free middle of the stage, between the title and the
 * account card.
 */
export const TRADE_CAMERA = {
  position: [2.3, 2.2, -3.3],
  // Lower and pull the look point towards the fly's end of the desk so the
  // seated fly stays visible above the dock on narrow stages.
  target: [0.55, 1.15, -0.45],
  fov: 40,
};
