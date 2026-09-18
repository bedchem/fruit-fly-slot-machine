/**
 * Measures a foreleg's joints off the mesh, so the rig constants in
 * src/scene/flyRig.js are read from the scan rather than guessed.
 *
 *   node tools/measure-fly.mjs right|left
 *
 * The fly faces +Z with +Y up, so its right side is -X (forward × up).
 * Each leg is isolated by a coarse box, then the femur is traced by taking the
 * centroid of a Z slice and the tibia by the centroid of a Y slice; where the
 * two traces meet is the femur/tibia joint.
 */
import { loadMesh } from './lib-raster.mjs';

const SIDE = (process.argv[2] || 'right').toLowerCase();
const SRC = process.argv[3] || 'public/models/fly.glb';

// generous boxes around each front leg, from the slab survey of the scan
const BOX = {
  right: { x: [-0.42, -0.05], z: [0.18, 0.84], y: [-0.05, 0.62] },   // fly's right = -X
  left: { x: [-0.06, 0.30], z: [0.14, 0.84], y: [-0.05, 0.62] },
};
const box = BOX[SIDE];
if (!box) throw new Error('side must be right or left');

const m = loadMesh(SRC);
const P = m.P, nv = P.length / 3;
const inLeg = (x, y, z) => x > box.x[0] && x < box.x[1] && z > box.z[0] && z < box.z[1] && y < box.y[1] && y > box.y[0];

function centroid(pred) {
  let n = 0; const s = [0, 0, 0];
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (!inLeg(x, y, z) || !pred(x, y, z)) continue;
    n++; s[0] += x; s[1] += y; s[2] += z;
    const p = [x, y, z];
    for (let a = 0; a < 3; a++) { if (p[a] < mn[a]) mn[a] = p[a]; if (p[a] > mx[a]) mx[a] = p[a]; }
  }
  return { n, c: s.map(v => v / n), mn, mx };
}

console.log(`--- ${SIDE} foreleg, ${SRC} ---`);
console.log('\nfemur trace (centroid per Z slice, upper leg only):');
const femur = [];
for (let z = box.z[0]; z < box.z[1]; z += 0.04) {
  const r = centroid((x, y, zz) => zz >= z && zz < z + 0.04 && y > 0.40);
  if (r.n > 120) { femur.push({ z: z + 0.02, c: r.c, n: r.n }); console.log('  Z', (z + 0.02).toFixed(2), 'n', String(r.n).padStart(6), 'c', r.c.map(v => +v.toFixed(3)).join(', ')); }
}

console.log('\ntibia trace (centroid per Y slice):');
const tibia = [];
for (let y = -0.02; y < 0.50; y += 0.04) {
  const r = centroid((x, yy) => yy >= y && yy < y + 0.04);
  if (r.n > 120) { tibia.push({ y: y + 0.02, c: r.c, n: r.n }); console.log('  Y', (y + 0.02).toFixed(2), 'n', String(r.n).padStart(6), 'c', r.c.map(v => +v.toFixed(3)).join(', ')); }
}

// shoulder = innermost end of the femur trace; hand = lowest end of the tibia trace
const shoulder = femur[0]?.c;
const hand = tibia[0]?.c;

// The knee is where the two traces meet. The topmost Y slices pick up the
// thorax as well as the leg, which drags their centroid inboard, so only the
// slices thin enough to be leg are trusted.
const CLEAN = 500;
const cleanTibia = tibia.filter((s) => s.n < CLEAN);
const tibiaTop = cleanTibia[cleanTibia.length - 1].c;
const femurEnd = femur[femur.length - 1].c;
const knee = femurEnd.map((v, i) => (v + tibiaTop[i]) / 2);
console.log('\nfemur outer end', femurEnd.map(v => +v.toFixed(3)), ' tibia top', tibiaTop.map(v => +v.toFixed(3)));

const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
console.log('\nSHOULDER', shoulder.map(v => +v.toFixed(4)));
console.log('KNEE    ', knee.map(v => +v.toFixed(4)));
console.log('HAND    ', hand.map(v => +v.toFixed(4)));
console.log('BONE1', d(shoulder, knee).toFixed(4), 'BONE2', d(knee, hand).toFixed(4), 'REACH', (d(shoulder, knee) + d(knee, hand)).toFixed(4));
console.log('\npaste into src/scene/flyRig.js:');
console.log(`export const SHOULDER = [${shoulder.map(v => v.toFixed(4)).join(', ')}];`);
console.log(`export const KNEE = [${knee.map(v => v.toFixed(4)).join(', ')}];`);
console.log(`export const HAND = [${hand.map(v => v.toFixed(4)).join(', ')}];`);
