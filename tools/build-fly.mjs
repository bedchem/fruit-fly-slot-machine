/**
 * Prepares the CT-scan fly for the browser.
 *
 * The source is a 40 MB, 1.5 M-triangle merged STL split into fifteen
 * 65 k-vertex chunks. This bakes the Sketchfab root transform (so the fly
 * ends up Y-up, facing +Z, feet on Y = 0), joins the chunks back into one
 * mesh, welds the duplicated chunk seams and decimates to a size a browser
 * is happy to stream.
 *
 * Coordinates are deliberately left in that baked world frame: the foreleg
 * rig constants in src/scene/flyRig.js are measured in it.
 */
import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, dedup, join, weld, simplify, prune, clearNodeTransform } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'public/models/fly.glb';
const RATIO = Number(process.argv[4] || 0.22);

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();

const count = () => {
  let t = 0, v = 0;
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices();
    t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    v += p.getAttribute('POSITION').getCount();
  }
  return { t, v };
};
console.log('source', count());

await doc.transform(flatten(), dedup());

// Sketchfab ships the model Z-up behind a root matrix. Bake it, so the frame
// the rig constants were measured in is the frame the app loads.
for (const node of root.listNodes()) if (node.getMesh()) clearNodeTransform(node);

await MeshoptSimplifier.ready;
await doc.transform(
  join({ keepNamed: false }),
  weld({ tolerance: 1e-5 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002, lockBorder: false }),
  prune(),
);
console.log('after simplify', count());

// The source material is left exactly as downloaded — the translucent amber
// resin look is the whole character of this scan, so nothing here retints it.
for (const mat of root.listMaterials()) {
  console.log('material kept as-is:', mat.getName(),
    'baseColor', mat.getBaseColorFactor().map(n => +n.toFixed(3)),
    'alphaMode', mat.getAlphaMode(),
    'metallic', +mat.getMetallicFactor().toFixed(3),
    'roughness', +mat.getRoughnessFactor().toFixed(3));
}

const bounds = [[1e30, 1e30, 1e30], [-1e30, -1e30, -1e30]];
const v = [0, 0, 0];
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const pos = p.getAttribute('POSITION');
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v);
    for (let a = 0; a < 3; a++) { if (v[a] < bounds[0][a]) bounds[0][a] = v[a]; if (v[a] > bounds[1][a]) bounds[1][a] = v[a]; }
  }
}
console.log('baked bounds', bounds[0].map(n => +n.toFixed(4)), bounds[1].map(n => +n.toFixed(4)));

for (const node of root.listNodes()) if (node.getMesh()) node.setName('Fly');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
