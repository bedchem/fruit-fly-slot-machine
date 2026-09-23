/**
 * Splits pillar_slots.glb into named, correctly-pivoted parts.
 *
 *  - recentres the pillar on its own axis, base on Y = 0
 *  - lifts the front (+X) machine's lever out as `Lever`, with its node origin
 *    ON the pivot so the app only has to set rotation.z
 *  - drops the front machine's three printed reel strips (the app draws live
 *    drums in their place) and records their exact placement in parts.json
 *
 * Parts are found by connected component, not by bounding box, so nothing
 * bleeds between the lever, the reels and the cabinet.
 */
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, dedup, prune, clearNodeTransform } from '@gltf-transform/functions';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'assets/models/slot-machine.glb';
const META = 'src/scene/parts.js';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(SRC);
await doc.transform(flatten(), dedup());

const root = doc.getRoot();
const scene = root.listScenes()[0];

// --- bake every transform down into the vertex data -------------------------
for (const node of root.listNodes()) if (node.getMesh()) clearNodeTransform(node);

const prims = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) prims.push({ node, mesh, prim });
}

const v = [0, 0, 0];
const bounds = [[1e30, 1e30, 1e30], [-1e30, -1e30, -1e30]];
for (const { prim } of prims) {
  const pos = prim.getAttribute('POSITION');
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v);
    for (let a = 0; a < 3; a++) {
      if (v[a] < bounds[0][a]) bounds[0][a] = v[a];
      if (v[a] > bounds[1][a]) bounds[1][a] = v[a];
    }
  }
}
const OFF = [
  -(bounds[0][0] + bounds[1][0]) / 2,   // pillar axis -> origin
  -bounds[0][1],                        // base -> Y 0
  -(bounds[0][2] + bounds[1][2]) / 2,
];
console.log('source bounds', bounds[0].map(n => +n.toFixed(3)), bounds[1].map(n => +n.toFixed(3)));
console.log('recentre offset', OFF.map(n => +n.toFixed(4)));

const shifted = new Set();
for (const { prim } of prims) {
  const pos = prim.getAttribute('POSITION');
  if (shifted.has(pos)) continue;
  shifted.add(pos);
  const arr = pos.getArray();
  for (let i = 0; i < arr.length; i += 3) { arr[i] += OFF[0]; arr[i + 1] += OFF[1]; arr[i + 2] += OFF[2]; }
  pos.setArray(arr);
}

// --- connected components over the whole model ------------------------------
// vertices are welded by quantised position so components survive the
// per-material mesh split in the source file.
const weld = new Map();
let nextId = 0;
const parent = [];
const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
const weldId = (x, y, z) => {
  const k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
  let id = weld.get(k);
  if (id === undefined) { id = nextId++; weld.set(k, id); parent[id] = id; }
  return id;
};

const tris = [];
prims.forEach(({ prim }, pi) => {
  const pos = prim.getAttribute('POSITION');
  const idx = prim.getIndices();
  const n = idx ? idx.getCount() : pos.getCount();
  for (let t = 0; t < n; t += 3) {
    const i = [0, 1, 2].map(k => (idx ? idx.getScalar(t + k) : t + k));
    const w = [], c = [0, 0, 0];
    for (const vi of i) {
      pos.getElement(vi, v);
      w.push(weldId(v[0], v[1], v[2]));
      for (let a = 0; a < 3; a++) c[a] += v[a] / 3;
    }
    union(w[0], w[1]); union(w[1], w[2]);
    tris.push({ pi, i, w0: w[0], c });
  }
});
console.log('triangles', tris.length, 'welded vertices', nextId);

const comps = new Map();
for (const tri of tris) {
  const r = find(tri.w0);
  let c = comps.get(r);
  if (!c) { c = { n: 0, sum: [0, 0, 0], tris: [] }; comps.set(r, c); }
  c.n++; c.tris.push(tri);
  for (let a = 0; a < 3; a++) c.sum[a] += tri.c[a];
  tri.comp = r;
}
for (const c of comps.values()) c.ctr = c.sum.map(s => s / c.n);
console.log('components', comps.size);

// --- pick the parts belonging to the front (+X facing) machine --------------
const seed = (p) => {
  let best = null, bd = Infinity;
  for (const [r, c] of comps) {
    const d = Math.hypot(c.ctr[0] - p[0], c.ctr[1] - p[1], c.ctr[2] - p[2]);
    if (d < bd) { bd = d; best = r; }
  }
  return { r: best, c: comps.get(best), d: bd };
};
const S = (x, y, z) => [x + OFF[0], y + OFF[1], z + OFF[2]];
const leverHit = seed(S(0.962, 1.276, -0.463));
const plateHit = seed(S(0.916, 1.082, -0.442));
const reelHits = [S(1.008, 1.277, -0.254), S(1.008, 1.277, -0.142), S(1.008, 1.277, -0.030)].map(seed);
console.log('lever comp: tris', leverHit.c.n, 'ctr', leverHit.c.ctr.map(n => +n.toFixed(4)), 'seedDist', leverHit.d.toFixed(4));
console.log('plate comp: tris', plateHit.c.n, 'ctr', plateHit.c.ctr.map(n => +n.toFixed(4)), 'seedDist', plateHit.d.toFixed(4));
reelHits.forEach((h, i) => console.log('reel', i, 'tris', h.c.n, 'ctr', h.c.ctr.map(n => +n.toFixed(4)), 'seedDist', h.d.toFixed(4)));

const LEVER = new Set([leverHit.r]);
const DROP = new Set(reelHits.map(h => h.r));
if (DROP.size !== 3) throw new Error('expected 3 distinct reel components, got ' + DROP.size);
if (LEVER.has(plateHit.r)) console.warn('note: mounting plate is part of the lever component');

// The stool this machine is served by, so the app can slide it up to the
// cabinet — an upright fly cannot reach the handle from where it is parked.
const STOOL = new Set();
for (const [r, c] of comps) {
  if (r === leverHit.r || DROP.has(r)) continue;
  if (c.ctr[0] > 1.2 && Math.abs(c.ctr[2]) < 0.5) STOOL.add(r);
}
console.log('stool components:', STOOL.size);

function vertBounds(comp, filter) {
  const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
  for (const tri of comp.tris) {
    const pos = prims[tri.pi].prim.getAttribute('POSITION');
    for (const vi of tri.i) {
      pos.getElement(vi, v);
      if (filter && !filter(v)) continue;
      for (let a = 0; a < 3; a++) { if (v[a] < mn[a]) mn[a] = v[a]; if (v[a] > mx[a]) mx[a] = v[a]; }
    }
  }
  return { mn, mx };
}
const lb = vertBounds(leverHit.c);
const pb = vertBounds(plateHit.c);
console.log('lever verts bbox', lb.mn.map(n => +n.toFixed(4)), lb.mx.map(n => +n.toFixed(4)));
console.log('plate verts bbox', pb.mn.map(n => +n.toFixed(4)), pb.mx.map(n => +n.toFixed(4)));

// pivot = centre of the mounting plate
const PIVOT = [(pb.mn[0] + pb.mx[0]) / 2, (pb.mn[1] + pb.mx[1]) / 2, (pb.mn[2] + pb.mx[2]) / 2];

// knob = the ball at the top of the arm
const knobCut = lb.mx[1] - 0.06;
const kb = vertBounds(leverHit.c, (p) => p[1] >= knobCut);
const knob = {
  center: kb.mn.map((n, a) => (n + kb.mx[a]) / 2),
  radius: Math.max(kb.mx[0] - kb.mn[0], kb.mx[2] - kb.mn[2]) / 2,
};
console.log('pivot', PIVOT.map(n => +n.toFixed(4)));
console.log('knob ', knob.center.map(n => +n.toFixed(4)), 'r', knob.radius.toFixed(4));

const reels = reelHits.map(h => {
  const b = vertBounds(h.c);
  return {
    center: b.mn.map((n, a) => (n + b.mx[a]) / 2),
    radius: Math.max(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1]) / 2,
    width: b.mx[2] - b.mn[2],
  };
});
reels.sort((a, b) => a.center[2] - b.center[2]);
reels.forEach((r, i) => console.log('reel', i, 'c', r.center.map(n => +n.toFixed(4)), 'r', r.radius.toFixed(4), 'w', r.width.toFixed(4)));

// --- rebuild the scene: Cabinet + Lever, reel strips dropped ----------------
const buf = root.listBuffers()[0];

function makePrim(srcPrim, triList, translate) {
  const src = srcPrim.getAttribute('POSITION');
  const srcN = srcPrim.getAttribute('NORMAL');
  const srcUV = srcPrim.getAttribute('TEXCOORD_0');
  const remap = new Map();
  const pos = [], nrm = [], uv = [], ind = [];
  const t3 = [0, 0, 0], t2 = [0, 0];
  for (const tri of triList) for (const vi of tri.i) {
    let ni = remap.get(vi);
    if (ni === undefined) {
      ni = remap.size; remap.set(vi, ni);
      src.getElement(vi, t3);
      pos.push(t3[0] - (translate ? translate[0] : 0), t3[1] - (translate ? translate[1] : 0), t3[2] - (translate ? translate[2] : 0));
      if (srcN) { srcN.getElement(vi, t3); nrm.push(t3[0], t3[1], t3[2]); }
      if (srcUV) { srcUV.getElement(vi, t2); uv.push(t2[0], t2[1]); }
    }
    ind.push(ni);
  }
  const p = doc.createPrimitive().setMaterial(srcPrim.getMaterial());
  p.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf));
  if (srcN) p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nrm)).setBuffer(buf));
  if (srcUV) p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf));
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ind)).setBuffer(buf));
  return p;
}

const buckets = { Cabinet: new Map(), Lever: new Map(), Stool: new Map() };
for (const tri of tris) {
  if (DROP.has(tri.comp)) continue;
  const part = LEVER.has(tri.comp) ? 'Lever' : STOOL.has(tri.comp) ? 'Stool' : 'Cabinet';
  const m = buckets[part];
  if (!m.has(tri.pi)) m.set(tri.pi, []);
  m.get(tri.pi).push(tri);
}

// The stool's node origin goes on the floor under its seat, so the app moves
// it by translating in X/Z without lifting it off the ground.
let stoolSeat = null;
{
  const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
  for (const r of STOOL) for (const tri of comps.get(r).tris) {
    const pos = prims[tri.pi].prim.getAttribute('POSITION');
    for (const vi of tri.i) {
      pos.getElement(vi, v);
      for (let a = 0; a < 3; a++) { if (v[a] < mn[a]) mn[a] = v[a]; if (v[a] > mx[a]) mx[a] = v[a]; }
    }
  }
  // the seat is the widest horizontal slab below the backrest
  let top = -1e30;
  for (const r of STOOL) {
    const c = comps.get(r);
    const b = vertBounds(c);
    if ((b.mx[1] - b.mn[1]) < 0.2 && b.mx[1] > top) { top = b.mx[1]; stoolSeat = b; }
  }
  const seatCenter = [(stoolSeat.mn[0] + stoolSeat.mx[0]) / 2, stoolSeat.mx[1], (stoolSeat.mn[2] + stoolSeat.mx[2]) / 2];
  stoolSeat = {
    origin: [seatCenter[0], 0, seatCenter[2]],
    seatCenter,
    seatRadius: Math.max(stoolSeat.mx[0] - stoolSeat.mn[0], stoolSeat.mx[2] - stoolSeat.mn[2]) / 2,
    bounds: { min: mn, max: mx },
  };
  console.log('stool origin', stoolSeat.origin.map(n => +n.toFixed(4)),
    'seat', stoolSeat.seatCenter.map(n => +n.toFixed(4)), 'radius', stoolSeat.seatRadius.toFixed(4));
}

const ORIGIN_OF = { Lever: PIVOT, Stool: stoolSeat.origin };
const newNodes = [];
for (const part of ['Cabinet', 'Lever', 'Stool']) {
  const byPrim = buckets[part];
  const origin = ORIGIN_OF[part] || null;
  const mesh = doc.createMesh(part);
  let n = 0;
  for (const [pi, list] of byPrim) {
    mesh.addPrimitive(makePrim(prims[pi].prim, list, origin));
    n += list.length;
  }
  const node = doc.createNode(part).setMesh(mesh);
  if (origin) node.setTranslation(origin);
  newNodes.push(node);
  console.log('part', part + ':', n, 'tris in', byPrim.size, 'primitives');
}

for (const node of scene.listChildren()) scene.removeChild(node);
for (const node of newNodes) scene.addChild(node);
await doc.transform(prune());

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');

const meta = {
  _comment: 'Measured from pillar_slots.glb by tools/build-slot.mjs. Pillar axis at origin, base at Y=0, front machine faces +X.',
  lever: {
    pivot: PIVOT.map(n => +n.toFixed(5)),
    axis: 'z',
    knob: { center: knob.center.map(n => +n.toFixed(5)), radius: +knob.radius.toFixed(5) },
    knobLocal: knob.center.map((n, a) => +(n - PIVOT[a]).toFixed(5)),
    armLength: +Math.hypot(knob.center[0] - PIVOT[0], knob.center[1] - PIVOT[1]).toFixed(5),
  },
  stool: {
    origin: stoolSeat.origin.map(n => +n.toFixed(5)),
    seatCenter: stoolSeat.seatCenter.map(n => +n.toFixed(5)),
    seatRadius: +stoolSeat.seatRadius.toFixed(5),
  },
  reels: reels.map(r => ({ center: r.center.map(n => +n.toFixed(5)), radius: +r.radius.toFixed(5), width: +r.width.toFixed(5) })),
  bounds: { min: bounds[0].map((n, a) => +(n + OFF[a]).toFixed(4)), max: bounds[1].map((n, a) => +(n + OFF[a]).toFixed(4)) },
};
fs.mkdirSync(path.dirname(META), { recursive: true });
const header = [
  '// GENERATED by tools/build-slot.mjs — do not edit by hand.',
  '// A module rather than JSON so the build tools and the app can both import',
  '// it without JSON import attributes.',
  '',
].join('\n');
fs.writeFileSync(META, header + 'export default ' + JSON.stringify(meta, null, 2) + ';\n');
console.log('wrote', META);
