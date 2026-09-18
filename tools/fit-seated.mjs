/**
 * Fits the fly to the stool WHERE THE MODEL PUTS IT — the furniture does not
 * move. The stool is a fixed target, so the only things left to choose are how
 * upright the fly sits, how big it is, and which way it is turned.
 *
 * For each candidate it sets the fly down so its body rests on the cushion and
 * its contact patch is centred on the seat, then reports how hard the foreleg
 * has to work to reach the handle. Sitting bolt upright puts the shoulder too
 * high and too far back; this finds the most upright pose that can still reach.
 */
import { loadMesh } from './lib-raster.mjs';
import * as rig from '../src/scene/flyRig.js';
import { STOOL, knobAt, gripAt, LEVER_PULLED } from '../src/scene/layout.js';

const url = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const mesh = loadMesh(url('../public/models/fly.glb'));
const P = mesh.P, nv = P.length / 3;

const SEAT = STOOL.seatCenter;
const MAX_REACH = Number(process.argv[2] || 0.90);

function matrix(scale, pitch, yaw, pos = [0, 0, 0]) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const col = (x, y, z) => [x * cy + z * sy, y, -x * sy + z * cy];
  const c0 = col(scale, 0, 0), c1 = col(0, scale * cp, scale * sp), c2 = col(0, -scale * sp, scale * cp);
  return [c0[0], c0[1], c0[2], 0, c1[0], c1[1], c1[2], 0, c2[0], c2[1], c2[2], 0, pos[0], pos[1], pos[2], 1];
}
const xf = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Sits the fly on the stool where it stands. Returns the placement. */
function fit(scale, pitch, yaw) {
  const M0 = matrix(scale, pitch, yaw);

  // lowest point of the body (not the legs — they dangle past the seat)
  let lowest = Infinity;
  for (let i = 0; i < nv; i++) {
    if (P[i * 3 + 1] < 0.42) continue;
    const y = xf(M0, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])[1];
    if (y < lowest) lowest = y;
  }
  // the patch that actually touches down, so it can be centred on the cushion
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < nv; i++) {
    if (P[i * 3 + 1] < 0.42) continue;
    const w = xf(M0, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    if (w[1] > lowest + 0.09) continue;
    cx += w[0]; cz += w[2]; n++;
  }
  cx /= n; cz /= n;

  const position = [SEAT[0] - cx, SEAT[1] - lowest + 0.012, SEAT[2] - cz];
  const M = matrix(scale, pitch, yaw, position);
  const shoulder = xf(M, rig.SHOULDER);
  const R = rig.REACH * scale;
  const head = xf(M, [0, 0.85, 0.791]);
  return {
    scale, pitch, yaw, position,
    rest: dist(shoulder, knobAt(0)) / R,
    pulled: dist(shoulder, knobAt(LEVER_PULLED)) / R,
    head,
    shoulder,
  };
}

function emit(r) {
  console.log(`  scale ${r.scale}  pitch ${r.pitch}  yawOff ${r.yawOff ?? '-'}` +
    `  rest ${(100 * r.rest).toFixed(0)}%  pulled ${(100 * r.pulled).toFixed(0)}%`);
  console.log('  head tip at', r.head.map(n => +n.toFixed(3)).join(', '));
  console.log('\npaste into src/scene/layout.js:');
  console.log('export const FLY = {');
  console.log(`  position: [${r.position.map(n => n.toFixed(4)).join(', ')}],`);
  console.log(`  rotationY: ${r.yaw.toFixed(4)},`);
  console.log(`  pitch: ${r.pitch},`);
  console.log(`  scale: ${r.scale},`);
  console.log('};');
}

// node tools/fit-seated.mjs pick <scale> <pitch> <yawOff>
if (process.argv[2] === 'pick') {
  const [scale, pitch, yawOff] = process.argv.slice(3).map(Number);
  const r = fit(scale, pitch, -Math.PI / 2 + yawOff);
  r.yawOff = yawOff;
  emit(r);
  process.exit(0);
}

console.log('stool stays at', SEAT.map(n => +n.toFixed(3)).join(', '), ' knob at', knobAt(0).map(n => +n.toFixed(3)).join(', '));
console.log('');
console.log('scale  pitch   yawOff   posX   posY   posZ    rest  pulled');

const rows = [];
for (const scale of [0.8, 0.9, 1.0, 1.1, 1.2]) {
  for (const pitch of [-0.55, -0.70, -0.85, -1.00, -1.15, -1.30]) {
    for (const yawOff of [-0.15, -0.35, -0.55]) {
      const r = fit(scale, pitch, -Math.PI / 2 + yawOff);
      r.yawOff = yawOff;
      rows.push(r);
      const ok = r.rest <= MAX_REACH && r.pulled <= MAX_REACH;
      console.log(
        `${scale.toFixed(2)}  ${pitch.toFixed(2)}  ${yawOff.toFixed(2)}   ` +
        `${r.position.map(n => n.toFixed(2).padStart(5)).join('  ')}  ` +
        `${(100 * r.rest).toFixed(0).padStart(4)}% ${(100 * r.pulled).toFixed(0).padStart(5)}%${ok ? '   <- reaches' : ''}`);
    }
  }
}

// the most upright pose that can still work the handle
const good = rows.filter((r) => r.rest <= MAX_REACH && r.pulled <= MAX_REACH)
  .sort((a, b) => a.pitch - b.pitch);
const best = good[0];
console.log('\nmost upright pose that still reaches the handle:');
if (!best) { console.log('  none — loosen MAX_REACH or let the fly lean further forward'); process.exit(1); }
console.log(`  scale ${best.scale}  pitch ${best.pitch}  yawOff ${best.yawOff}` +
  `  rest ${(100 * best.rest).toFixed(0)}%  pulled ${(100 * best.pulled).toFixed(0)}%`);
console.log('  head tip at', best.head.map(n => +n.toFixed(3)).join(', '));
console.log('\npaste into src/scene/layout.js:');
console.log('export const FLY = {');
console.log(`  position: [${best.position.map(n => n.toFixed(4)).join(', ')}],`);
console.log(`  rotationY: ${best.yaw.toFixed(4)},`);
console.log(`  pitch: ${best.pitch},`);
console.log(`  scale: ${best.scale},`);
console.log('};');
void gripAt;
