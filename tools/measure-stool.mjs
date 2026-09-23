/**
 * Finds the stool in front of the +X machine and prints its seat, so the fly
 * can be sat on it rather than floated near it.
 */
import { loadMesh } from './lib-raster.mjs';
import { loadGLB, readAccessor, walk, xfP } from './lib-glb.mjs';

const SRC = 'assets/models/slot-machine.glb';
const { json, bin } = loadGLB(SRC);

// connected components, welded by quantised position
const P = [], tris = [];
walk(json, (ni, node, m) => {
  for (const prim of json.meshes[node.mesh].primitives) {
    const pos = readAccessor(json, bin, prim.attributes.POSITION);
    const idx = prim.indices !== undefined ? readAccessor(json, bin, prim.indices) : null;
    const base = P.length / 3;
    for (let i = 0; i < pos.count; i++) {
      const w = xfP(m, [pos.data[i * 3], pos.data[i * 3 + 1], pos.data[i * 3 + 2]]);
      P.push(w[0], w[1], w[2]);
    }
    if (idx) for (let i = 0; i < idx.count; i += 3) tris.push(base + idx.data[i], base + idx.data[i + 1], base + idx.data[i + 2]);
  }
});
const nv = P.length / 3;
const weld = new Map(); let next = 0; const parent = [];
const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
const id = (i) => {
  const k = Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4);
  let v = weld.get(k);
  if (v === undefined) { v = next++; weld.set(k, v); parent[v] = v; }
  return v;
};
const wid = new Int32Array(nv);
for (let i = 0; i < nv; i++) wid[i] = id(i);
for (let t = 0; t < tris.length; t += 3) { union(wid[tris[t]], wid[tris[t + 1]]); union(wid[tris[t + 1]], wid[tris[t + 2]]); }

const comps = new Map();
for (let t = 0; t < tris.length; t += 3) {
  const r = find(wid[tris[t]]);
  let c = comps.get(r);
  if (!c) { c = { n: 0, mn: [1e30, 1e30, 1e30], mx: [-1e30, -1e30, -1e30] }; comps.set(r, c); }
  c.n++;
  for (let k = 0; k < 3; k++) { const vi = tris[t + k]; for (let a = 0; a < 3; a++) { const v = P[vi * 3 + a]; if (v < c.mn[a]) c.mn[a] = v; if (v > c.mx[a]) c.mx[a] = v; } }
}

// the stool serving the +X machine sits well out along +X, near Z = 0
const stool = [...comps.values()]
  .filter((c) => {
    const cx = (c.mn[0] + c.mx[0]) / 2, cz = (c.mn[2] + c.mx[2]) / 2;
    return cx > 1.2 && Math.abs(cz) < 0.5;
  })
  .sort((a, b) => a.mn[1] - b.mn[1]);

console.log('parts of the +X stool, lowest first:');
for (const c of stool) {
  console.log('  tris', String(c.n).padStart(5),
    'y', c.mn[1].toFixed(3) + '..' + c.mx[1].toFixed(3),
    'x', c.mn[0].toFixed(3) + '..' + c.mx[0].toFixed(3),
    'z', c.mn[2].toFixed(3) + '..' + c.mx[2].toFixed(3));
}

// the seat = the flat part whose top is the highest horizontal surface below the backrest
const seat = stool.filter((c) => (c.mx[1] - c.mn[1]) < 0.2).sort((a, b) => b.mx[1] - a.mx[1])[0];
if (seat) {
  console.log('\nseat top Y', seat.mx[1].toFixed(4),
    'centre', [((seat.mn[0] + seat.mx[0]) / 2).toFixed(4), seat.mx[1].toFixed(4), ((seat.mn[2] + seat.mx[2]) / 2).toFixed(4)].join(', '),
    'radius', (Math.max(seat.mx[0] - seat.mn[0], seat.mx[2] - seat.mn[2]) / 2).toFixed(4));
}
