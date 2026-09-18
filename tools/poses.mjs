/**
 * Renders a grid of candidate seated poses from the hero camera, so the
 * placement can be chosen by looking rather than by optimising a proxy metric.
 *
 *   node tools/poses.mjs            the default grid
 *   node tools/poses.mjs cam        the same pose from a few cameras
 */
import { loadMesh, renderScene, writePNG } from './lib-raster.mjs';
import * as rig from '../src/scene/flyRig.js';
import { STOOL, knobAt, gripAt, LEVER_PULLED, CAMERA } from '../src/scene/layout.js';

const url = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const flyRest = loadMesh(url('../public/models/fly.glb'));
const nv = flyRest.P.length / 3;
const P = flyRest.P;

const W1 = new Float32Array(nv), W2 = new Float32Array(nv);
for (let i = 0; i < nv; i++) {
  const [a, b] = rig.legWeights(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  W1[i] = a; W2[i] = b;
}

const rotZ = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};
const translate = (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
const slot = (angle, stoolOffset = [0, 0, 0]) => ({
  ...loadMesh(url('../public/models/slot-machine.glb'), {
    nodeTransform: (n) => (n === 'Lever' ? rotZ(angle)
      : n === 'Stool' ? translate(stoolOffset[0], stoolOffset[1], stoolOffset[2])
      : null),
  }),
  color: [126, 122, 118],
});

function matrix(f) {
  const k = f.scale;
  const cp = Math.cos(f.pitch), sp = Math.sin(f.pitch);
  const cy = Math.cos(f.rotationY), sy = Math.sin(f.rotationY);
  const col = (x, y, z) => [x * cy + z * sy, y, -x * sy + z * cy];
  const c0 = col(k, 0, 0), c1 = col(0, k * cp, k * sp), c2 = col(0, -k * sp, k * cp);
  return [c0[0], c0[1], c0[2], 0, c1[0], c1[1], c1[2], 0, c2[0], c2[1], c2[2], 0,
    f.position[0], f.position[1], f.position[2], 1];
}
const xfP = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const xfV = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];

function toFly(f, [x, y, z]) {
  const cy = Math.cos(f.rotationY), sy = Math.sin(f.rotationY);
  const dx = (x - f.position[0]) / f.scale, dy = (y - f.position[1]) / f.scale, dz = (z - f.position[2]) / f.scale;
  const ux = dx * cy - dz * sy, uz = dx * sy + dz * cy;
  const cp = Math.cos(-f.pitch), sp = Math.sin(-f.pitch);
  return [ux, dy * cp - uz * sp, dy * sp + uz * cp];
}

/**
 * Sits the fly on the stool and works out where the stool has to be.
 *
 * Height is forced: the lowest point of the body must land on the cushion.
 * That fixes how far the shoulder sits above the knob, so the only freedom
 * left is which way round the handle the fly sits — `azimuthDeg`, measured
 * from +X towards -Z. The position is solved from that, and the stool is then
 * slid under wherever the body actually touches down.
 */
function seat(scale, pitch, yawOff, azimuthDeg = 28, targetReach = 0.8) {
  const f = { scale, pitch, rotationY: -Math.PI / 2 + yawOff, position: [0, 0, 0] };

  let minBody = Infinity;
  {
    const M = matrix(f);
    for (let i = 0; i < nv; i++) {
      if (P[i * 3 + 1] < 0.42) continue;
      const y = xfP(M, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])[1];
      if (y < minBody) minBody = y;
    }
  }
  f.position[1] = STOOL.seatCenter[1] - minBody + 0.015;

  // shoulder offset from the fly's origin, at this orientation
  const rel = xfP(matrix(f), rig.SHOULDER).map((v, i) => v - f.position[i]);
  const knob = knobAt(0);
  const want = targetReach * rig.REACH * scale;
  const dy = (f.position[1] + rel[1]) - knob[1];          // shoulder above knob
  const horiz = Math.sqrt(Math.max(0.0004, want * want - dy * dy));
  const az = azimuthDeg * Math.PI / 180;
  const shoulder = [knob[0] + horiz * Math.cos(az), f.position[1] + rel[1], knob[2] - horiz * Math.sin(az)];
  f.position[0] = shoulder[0] - rel[0];
  f.position[2] = shoulder[2] - rel[2];
  f.feasible = want * want - dy * dy > 0.0004;

  // where the body meets the cushion, so the stool can be slid under it
  const M2 = matrix(f);
  let lowest = Infinity;
  for (let i = 0; i < nv; i++) {
    if (P[i * 3 + 1] < 0.42) continue;
    const w = xfP(M2, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    if (w[1] < lowest) lowest = w[1];
  }
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < nv; i++) {
    if (P[i * 3 + 1] < 0.42) continue;
    const w = xfP(M2, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    if (w[1] > lowest + 0.09) continue;
    cx += w[0]; cz += w[2]; n++;
  }
  f.contact = [cx / n, STOOL.seatCenter[1], cz / n];
  f.stoolOffset = [f.contact[0] - STOOL.seatCenter[0], 0, f.contact[2] - STOOL.seatCenter[2]];
  return f;
}

function posed(f, targetWorld) {
  const M = matrix(f);
  const out = new Float64Array(P.length), N = new Float64Array(flyRest.N.length);
  const pose = targetWorld ? rig.solveLegIK(toFly(f, targetWorld)) : null;
  for (let i = 0; i < nv; i++) {
    let p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    let n = [flyRest.N[i * 3], flyRest.N[i * 3 + 1], flyRest.N[i * 3 + 2]];
    if (pose && W1[i] > 5e-4) {
      p = rig.applyPose(p, W1[i], W2[i], pose);
      let rn = rig.quatRotate(pose.q1, n);
      rn = [n[0] + (rn[0] - n[0]) * W1[i], n[1] + (rn[1] - n[1]) * W1[i], n[2] + (rn[2] - n[2]) * W1[i]];
      if (W2[i] > 5e-4) { const r2 = rig.quatRotate(pose.q2, rn); rn = [rn[0] + (r2[0] - rn[0]) * W2[i], rn[1] + (r2[1] - rn[1]) * W2[i], rn[2] + (r2[2] - rn[2]) * W2[i]]; }
      n = rn;
    }
    const wp = xfP(M, p), wn = xfV(M, n);
    out[i * 3] = wp[0]; out[i * 3 + 1] = wp[1]; out[i * 3 + 2] = wp[2];
    N[i * 3] = wn[0]; N[i * 3 + 1] = wn[1]; N[i * 3 + 2] = wn[2];
  }
  return { P: out, N, tris: flyRest.tris, color: [216, 140, 64] };
}

const TW = 470, TH = 310;
const machine = slot(LEVER_PULLED * 0.4);

if (process.argv[2] === 'cam') {
  const f = seat(0.78, -0.42, -0.30);
  const fly = posed(f, gripAt(LEVER_PULLED * 0.4, f.position));
  const cams = [
    { eye: [4.20, 3.05, -2.10], look: [1.00, 1.20, -0.10], fov: 40 },
    { eye: [3.40, 3.40, -2.90], look: [0.95, 1.15, -0.10], fov: 42 },
    { eye: [5.10, 2.55, -1.30], look: [1.05, 1.25, -0.10], fov: 34 },
    { eye: [4.60, 3.60, -3.20], look: [0.95, 1.10, -0.10], fov: 38 },
  ];
  const sheet = Buffer.alloc(TW * 2 * TH * 2 * 3);
  cams.forEach((c, i) => {
    const tile = renderScene({ meshes: [machine, fly], W: TW, H: TH, eye: c.eye, target: c.look, fov: c.fov, ground: 0 });
    const ox = (i % 2) * TW, oy = Math.floor(i / 2) * TH;
    for (let y = 0; y < TH; y++) tile.copy(sheet, ((oy + y) * TW * 2 + ox) * 3, y * TW * 3, (y + 1) * TW * 3);
    console.log(i, 'eye', c.eye.join(','), 'look', c.look.join(','), 'fov', c.fov);
  });
  writePNG('preview_cams.png', TW * 2, TH * 2, sheet);
  console.log('wrote preview_cams.png');
} else {
  const cands = [
    { scale: 0.65, pitch: -1.30, yaw: -0.20, az: 30 },
    { scale: 0.70, pitch: -1.30, yaw: -0.20, az: 30 },
    { scale: 0.70, pitch: -1.45, yaw: -0.20, az: 42 },
    { scale: 0.78, pitch: -1.35, yaw: -0.20, az: 42 },
    { scale: 0.70, pitch: -1.20, yaw: -0.40, az: 54 },
    { scale: 0.78, pitch: -1.45, yaw: -0.30, az: 54 },
  ];
  const COLS = 2, ROWS = Math.ceil(cands.length / COLS);
  const sheet = Buffer.alloc(TW * COLS * TH * ROWS * 3);
  cands.forEach((c, i) => {
    const f = seat(c.scale, c.pitch, c.yaw, c.az);
    const fly = posed(f, gripAt(LEVER_PULLED * 0.4, f.position));
    const tile = renderScene({
      meshes: [slot(LEVER_PULLED * 0.4, f.stoolOffset), fly], W: TW, H: TH,
      eye: CAMERA.position, target: CAMERA.target, fov: CAMERA.fov, ground: 0,
    });
    const ox = (i % COLS) * TW, oy = Math.floor(i / COLS) * TH;
    for (let y = 0; y < TH; y++) tile.copy(sheet, ((oy + y) * TW * COLS + ox) * 3, y * TW * 3, (y + 1) * TW * 3);
    console.log(i, `scale ${c.scale} pitch ${c.pitch} yaw ${c.yaw} az ${c.az}`,
      `pos [${f.position.map(n => n.toFixed(4)).join(', ')}] rotY ${f.rotationY.toFixed(4)}`,
      `stool [${f.stoolOffset.map(n => n.toFixed(4)).join(', ')}]`, f.feasible ? '' : 'INFEASIBLE');
  });
  writePNG('preview_poses.png', TW * COLS, TH * ROWS, sheet);
  console.log('wrote preview_poses.png (left-to-right, top-to-bottom)');
}
