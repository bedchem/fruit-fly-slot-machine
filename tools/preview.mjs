/**
 * Composes the scene offline and writes PNGs, so the layout can be judged
 * without a browser. It imports the app's own layout and rig modules, so what
 * a preview shows is what the app builds.
 *
 *   node tools/preview.mjs              all the standard shots
 *   node tools/preview.mjs reach        one of them
 *   node tools/preview.mjs orbit R H "az,az,..." "tx,ty,tz"
 */
import { loadMesh, renderScene, writePNG } from './lib-raster.mjs';
import * as rig from '../src/scene/flyRig.js';
import {
  FLY, CAMERA, LEVER_PULLED, STOOL, gripAt, flyToWorld, worldToFly, reachFraction,
} from '../src/scene/layout.js';

const url = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');

const rotZ = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

/** The fly's full world matrix: scale, pitch about local X, then yaw. */
function flyMatrix() {
  const k = FLY.scale;
  const cp = Math.cos(FLY.pitch), sp = Math.sin(FLY.pitch);
  const cy = Math.cos(FLY.rotationY), sy = Math.sin(FLY.rotationY);
  const col = (x, y, z) => [x * cy + z * sy, y, -x * sy + z * cy];
  const c0 = col(k, 0, 0);
  const c1 = col(0, k * cp, k * sp);
  const c2 = col(0, -k * sp, k * cp);
  return [c0[0], c0[1], c0[2], 0, c1[0], c1[1], c1[2], 0, c2[0], c2[1], c2[2], 0,
    FLY.position[0], FLY.position[1], FLY.position[2], 1];
}
const xfP = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const xfV = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];

console.log('loading built assets...');
const flyRest = loadMesh(url('../assets/models/fly.glb'));
const nv = flyRest.P.length / 3;

const W1 = new Float32Array(nv), W2 = new Float32Array(nv);
let touched = 0;
for (let i = 0; i < nv; i++) {
  const [a, b] = rig.legWeights(flyRest.P[i * 3], flyRest.P[i * 3 + 1], flyRest.P[i * 3 + 2]);
  W1[i] = a; W2[i] = b;
  if (a > 0.01) touched++;
}
console.log(`fly ${nv} verts, rigged foreleg ${touched} (${(100 * touched / nv).toFixed(1)}%)`);

// the matrix here and layout.js must agree, or previews lie
{
  const m = flyMatrix();
  const a = xfP(m, rig.SHOULDER);
  const b = flyToWorld(rig.SHOULDER);
  const err = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  console.log('matrix vs flyToWorld:', err < 1e-9 ? 'OK' : 'MISMATCH ' + err.toExponential(2));
  const round = worldToFly(flyToWorld(rig.HAND));
  const rerr = Math.hypot(round[0] - rig.HAND[0], round[1] - rig.HAND[1], round[2] - rig.HAND[2]);
  console.log('worldToFly round-trip:', rerr < 1e-9 ? 'OK' : 'MISMATCH ' + rerr.toExponential(2));
}

function poseFly(targetWorld) {
  const M = flyMatrix();
  const P = new Float64Array(flyRest.P.length);
  const N = new Float64Array(flyRest.N.length);
  let pose = null;
  if (targetWorld) {
    const local = worldToFly(targetWorld);
    pose = rig.solveLegIK(local);
    console.log('  foreleg at', (100 * reachFraction(targetWorld)).toFixed(0) + '% of reach',
      pose.overextended ? 'OVEREXTENDED' : '');
  }
  for (let i = 0; i < nv; i++) {
    let p = [flyRest.P[i * 3], flyRest.P[i * 3 + 1], flyRest.P[i * 3 + 2]];
    let n = [flyRest.N[i * 3], flyRest.N[i * 3 + 1], flyRest.N[i * 3 + 2]];
    if (pose && W1[i] > 5e-4) {
      p = rig.applyPose(p, W1[i], W2[i], pose);
      let rn = rig.quatRotate(pose.q1, n);
      rn = [n[0] + (rn[0] - n[0]) * W1[i], n[1] + (rn[1] - n[1]) * W1[i], n[2] + (rn[2] - n[2]) * W1[i]];
      if (W2[i] > 5e-4) {
        const r2 = rig.quatRotate(pose.q2, rn);
        rn = [rn[0] + (r2[0] - rn[0]) * W2[i], rn[1] + (r2[1] - rn[1]) * W2[i], rn[2] + (r2[2] - rn[2]) * W2[i]];
      }
      n = rn;
    }
    const wp = xfP(M, p), wn = xfV(M, n);
    P[i * 3] = wp[0]; P[i * 3 + 1] = wp[1]; P[i * 3 + 2] = wp[2];
    N[i * 3] = wn[0]; N[i * 3 + 1] = wn[1]; N[i * 3 + 2] = wn[2];
  }
  return { P, N, tris: flyRest.tris, color: [216, 140, 64] };
}

const translate = (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
function slotAt(angle) {
  const m = loadMesh(url('../assets/models/slot-machine.glb'),
    { nodeTransform: (name) => (name === 'Lever' ? rotZ(angle)
      : name === 'Stool' ? translate(STOOL.offset[0], STOOL.offset[1], STOOL.offset[2]) : null) });
  return { ...m, color: [126, 122, 118] };
}

function report() {
  const M = flyMatrix();
  const head = xfP(M, [0, 0.85, 0.791]);
  const belly = xfP(M, [0, 0.45, -0.25]);
  const sh = xfP(M, rig.SHOULDER);
  const feet = xfP(M, [-0.55, -0.015, -0.9]);
  console.log('  head tip  ', head.map(n => +n.toFixed(3)).join(', '), '(cabinet face is X 1.03 below Y 1.46, X 0.93 above)');
  console.log('  underside ', belly.map(n => +n.toFixed(3)).join(', '), ' <- seat top is Y 0.803');
  console.log('  hind foot ', feet.map(n => +n.toFixed(3)).join(', '));
  console.log('  shoulder  ', sh.map(n => +n.toFixed(3)).join(', '));
  console.log('  reach: rest', (100 * reachFraction(gripAt(0))).toFixed(0) + '%',
    ' pulled', (100 * reachFraction(gripAt(LEVER_PULLED))).toFixed(0) + '%');
}

const mode = process.argv[2] || 'all';

if (mode === 'orbit') {
  const radius = Number(process.argv[3] || 5.0);
  const height = Number(process.argv[4] || 2.2);
  const list = (process.argv[5] || '0,30,60,90,120,150,180,210,240,270,300,330').split(',').map(Number);
  const look = (process.argv[6] || '1.15,1.20,-0.18').split(',').map(Number);
  const meshes = [slotAt(LEVER_PULLED * 0.35), poseFly(gripAt(LEVER_PULLED * 0.35))];
  const COLS = list.length <= 4 ? 2 : 4;
  const ROWS = Math.ceil(list.length / COLS);
  const TW = list.length <= 4 ? 480 : 326;
  const TH = list.length <= 4 ? 320 : 218;
  const sheet = Buffer.alloc(TW * COLS * TH * ROWS * 3);
  list.forEach((az, i) => {
    const a = az * Math.PI / 180;
    const eye = [look[0] + radius * Math.cos(a), height, look[2] + radius * Math.sin(a)];
    const tile = renderScene({ meshes, W: TW, H: TH, eye, target: look, fov: 40, ground: 0 });
    const ox = (i % COLS) * TW, oy = Math.floor(i / COLS) * TH;
    for (let y = 0; y < TH; y++) tile.copy(sheet, ((oy + y) * TW * COLS + ox) * 3, y * TW * 3, (y + 1) * TW * 3);
    console.log('azimuth', az, 'eye', eye.map(n => +n.toFixed(2)).join(', '));
  });
  writePNG('preview_orbit.png', TW * COLS, TH * ROWS, sheet);
  console.log('wrote preview_orbit.png (left-to-right, top-to-bottom:', list.join(', ') + ')');
} else {
  const shots = {
    rest: { lever: 0, target: null },
    reach: { lever: 0, target: gripAt(0) },
    mid: { lever: LEVER_PULLED * 0.5, target: gripAt(LEVER_PULLED * 0.5) },
    pull: { lever: LEVER_PULLED, target: gripAt(LEVER_PULLED) },
    seat: { lever: 0, target: gripAt(0), eye: [3.1, 1.5, -1.75], look: [1.5, 0.95, 0.0], fov: 32 },
  };
  for (const [name, cfg] of Object.entries(shots)) {
    if (mode !== 'all' && mode !== name) continue;
    console.log('shot', name);
    const meshes = [slotAt(cfg.lever), poseFly(cfg.target)];
    if (name === 'reach') report();
    renderScene({
      meshes, out: `preview_${name}.png`, W: 980, H: 640,
      eye: cfg.eye || CAMERA.position, target: cfg.look || CAMERA.target, fov: cfg.fov || CAMERA.fov, ground: 0,
    });
    console.log('  wrote preview_' + name + '.png');
  }
}
