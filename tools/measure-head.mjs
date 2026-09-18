/**
 * Finds the head and the neck it turns on.
 *
 * Walks forward along the body axis counting the cross-section at each slice:
 * the thorax is wide, the head is wide, and the waist between them is the
 * narrowest point. That waist is the pivot the head rotation uses.
 */
import { loadMesh } from './lib-raster.mjs';

const url = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const m = loadMesh(url('../public/models/fly.glb'));
const P = m.P, nv = P.length / 3;

console.log('Z slice   n     radius   centroid (x, y, z)');
const slices = [];
for (let z = 0.20; z < 0.80; z += 0.03) {
  let n = 0, sx = 0, sy = 0, sz = 0;
  const pts = [];
  for (let i = 0; i < nv; i++) {
    const zz = P[i * 3 + 2];
    if (zz < z || zz >= z + 0.03) continue;
    const y = P[i * 3 + 1];
    if (y < 0.45) continue;                 // above the legs
    const x = P[i * 3];
    if (Math.abs(x) > 0.45) continue;       // exclude the wings
    n++; sx += x; sy += y; sz += zz;
    pts.push([x, y]);
  }
  if (n < 80) continue;
  const cx = sx / n, cy = sy / n;
  let r = 0;
  for (const [x, y] of pts) r += Math.hypot(x - cx, y - cy);
  r /= pts.length;
  slices.push({ z: z + 0.015, n, r, c: [cx, cy, sz / n] });
  console.log(`${(z + 0.015).toFixed(3)}  ${String(n).padStart(5)}  ${r.toFixed(4)}  ${cx.toFixed(3)}, ${cy.toFixed(3)}, ${(sz / n).toFixed(3)}`);
}

// the waist: the smallest mean radius between the thorax hump and the head
const mid = slices.filter((s) => s.z > 0.34 && s.z < 0.62);
const waist = mid.reduce((a, b) => (b.r < a.r ? b : a), mid[0]);
const head = slices.filter((s) => s.z > waist.z);
let hx = 0, hy = 0, hz = 0, hn = 0;
for (const s of head) { hx += s.c[0] * s.n; hy += s.c[1] * s.n; hz += s.c[2] * s.n; hn += s.n; }

console.log('\nNECK (narrowest waist)', waist.c.map(n => +n.toFixed(4)), 'meanRadius', waist.r.toFixed(4));
console.log('HEAD centroid         ', [hx / hn, hy / hn, hz / hn].map(n => +n.toFixed(4)));
console.log('\npaste into src/scene/flyRig.js:');
console.log(`export const NECK = [${waist.c.map(n => n.toFixed(4)).join(', ')}];`);
