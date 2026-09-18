/**
 * Turns the MaleCNS v1.0 dumps into the two assets the app ships:
 *
 *   public/data/neurons.bin   real soma coordinates + per-neuron type index
 *   src/neural/cnsMeta.js     the type table, and which types are which
 *
 * Nothing here is invented. The coordinates are the measured soma locations of
 * the neurons in the volume; the classes, superclasses and cell types are the
 * curated annotations; the dopaminergic clusters are looked up by their real
 * type names rather than by position.
 *
 *   node tools/build-connectome.mjs <cns-data-dir>
 *
 * Data: https://male-cns.janelia.org/download/ — CC BY 4.0, FlyEM / HHMI
 * Janelia, University of Cambridge, MRC LMB and Google Research.
 */
import fs from 'fs';
import path from 'path';
import { readFeather } from './lib-feather.mjs';

const DIR = process.argv[2] || 'cns-data';
const OUT_BIN = 'public/data/neurons.bin';
const OUT_META = 'src/neural/cnsMeta.js';

/** How many neurons to draw. The full set is 141 781; this keeps the panel
 *  cheap while still sampling every population. 0 keeps all of them. */
const MAX_NEURONS = Number(process.env.MAX_NEURONS || 60000);

const ann = readFeather(path.join(DIR, 'body-annotations.feather'));
console.log('annotations:', ann.numRows, 'rows');

const bodyId = ann.getChild('bodyId');
const soma = ann.getChild('somaLocation');
const typeCol = ann.getChild('type');
const classCol = ann.getChild('class');
const superCol = ann.getChild('superclass');
const sideCol = ann.getChild('somaSide');

/**
 * The functional grouping the panel colours by. These are real annotation
 * values, mapped to the coarse systems a viewer can actually read.
 */
function groupOf(cls, sup) {
  const s = sup || '';
  const c = cls || '';
  if (c === 'DAN') return 'dopaminergic';
  if (c === 'MBON') return 'mushroom_out';
  if (c === 'Kenyon_Cell') return 'mushroom_body';
  if (c === 'CX') return 'central_complex';
  if (/^olfactory|ALPN|ALLN/.test(c)) return 'olfactory';
  if (/gustatory/.test(c)) return 'gustatory';
  if (/mechanosensory|hygro|thermo|chemosensory/.test(c)) return 'mechanosensory';
  if (/^ol_|visual/.test(s) || c === 'visual') return 'optic';
  if (s === 'descending_neuron') return 'descending';
  if (s === 'ascending_neuron' || s === 'sensory_ascending') return 'ascending';
  if (/motor|efferent/.test(s)) return 'motor';
  if (/^vnc_/.test(s)) return 'nerve_cord';
  if (s === 'cb_intrinsic') return 'central_brain';
  return 'other';
}

const groupNames = [];
const meta_group = (i) => groupNames[i];
const rows = [];
const typeIndex = new Map();
const groupIndex = new Map();
const groupCounts = new Map();

for (let i = 0; i < ann.numRows; i++) {
  const s = soma.get(i);
  if (!s || s.length !== 3) continue;               // only neurons with a measured soma
  const g = groupOf(classCol.get(i), superCol.get(i));
  if (!groupIndex.has(g)) { groupIndex.set(g, groupIndex.size); groupNames.push(g); }
  groupCounts.set(g, (groupCounts.get(g) || 0) + 1);

  const ty = typeCol.get(i) || '';
  if (ty && !typeIndex.has(ty)) typeIndex.set(ty, typeIndex.size);

  rows.push({
    id: bodyId.get(i),
    x: Number(s.get(0)), y: Number(s.get(1)), z: Number(s.get(2)),
    g: groupIndex.get(g),
    t: ty ? typeIndex.get(ty) : -1,
    side: sideCol.get(i) || '',
  });
}
console.log('neurons with soma coordinates:', rows.length);
console.log('distinct annotated types:', typeIndex.size);
for (const [g, n] of [...groupCounts].sort((a, b) => b[1] - a[1])) {
  console.log('  ', g.padEnd(18), n);
}

/**
 * Thin out, but never thin the populations that matter.
 *
 * 64% of the neurons in this animal are optic lobe, and a uniform sample would
 * spend the budget on them and leave 144 of the 340 dopaminergic cells — the
 * ones the whole readout is about. So the small groups are kept whole and only
 * the big ones are sampled down.
 */
const KEEP_WHOLE = new Set([
  'dopaminergic', 'mushroom_out', 'olfactory', 'gustatory',
  'mechanosensory', 'motor', 'descending', 'ascending', 'central_complex',
]);
let kept = rows;
if (MAX_NEURONS && rows.length > MAX_NEURONS) {
  const whole = rows.filter((r) => KEEP_WHOLE.has(meta_group(r.g)));
  const rest = rows.filter((r) => !KEEP_WHOLE.has(meta_group(r.g)));
  const budget = Math.max(0, MAX_NEURONS - whole.length);
  const stride = rest.length / budget;
  kept = whole.slice();
  for (let i = 0; i < rest.length; i += stride) kept.push(rest[Math.floor(i)]);
  console.log(`thinned ${rows.length} -> ${kept.length}`
    + ` (kept ${whole.length} whole from ${[...KEEP_WHOLE].join('/')}, sampled the rest every ${stride.toFixed(2)}th)`);
}

// --- normalise into a unit-ish box, y up, facing the viewer ----------------
// The dump is in nanometre voxel space with +y pointing down the animal's
// dorsoventral axis; flip it so the brain sits the right way up on screen.
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const r of kept) {
  const p = [r.x, r.y, r.z];
  for (let a = 0; a < 3; a++) { if (p[a] < mn[a]) mn[a] = p[a]; if (p[a] > mx[a]) mx[a] = p[a]; }
}
const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
const ctr = [0, 1, 2].map((a) => (mn[a] + mx[a]) / 2);
console.log('soma bbox', mn, mx, 'span', span);

// quantised to 16 bits per axis: the volume is ~90 um across, so a step is
// well under a micron — far finer than a soma.
const pos = new Uint16Array(kept.length * 3);
const grp = new Uint8Array(kept.length);
const typ = new Int32Array(kept.length);
kept.forEach((r, i) => {
  const nx = (r.x - ctr[0]) / span;          // -0.5 .. 0.5
  const ny = -(r.y - ctr[1]) / span;         // flip: dorsal up
  const nz = (r.z - ctr[2]) / span;
  pos[i * 3] = Math.round((nx + 0.5) * 65535);
  pos[i * 3 + 1] = Math.round((ny + 0.5) * 65535);
  pos[i * 3 + 2] = Math.round((nz + 0.5) * 65535);
  grp[i] = r.g;
  typ[i] = r.t;
});

fs.mkdirSync(path.dirname(OUT_BIN), { recursive: true });
const header = Buffer.alloc(16);
header.write('CNS1', 0, 'ascii');
header.writeUInt32LE(kept.length, 4);
header.writeUInt32LE(groupIndex.size, 8);
header.writeUInt32LE(typeIndex.size, 12);
fs.writeFileSync(OUT_BIN, Buffer.concat([
  header,
  Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength),
  Buffer.from(grp.buffer, grp.byteOffset, grp.byteLength),
  Buffer.from(typ.buffer, typ.byteOffset, typ.byteLength),
]));
console.log('wrote', OUT_BIN, (fs.statSync(OUT_BIN).size / 1e6).toFixed(2), 'MB');

// --- the dopaminergic clusters, by their real type names -------------------
const danTypes = [...typeIndex.keys()].filter((t) => /^(PAM|PPL1|PPL2|PPM12)/.test(t)).sort();
const reward = danTypes.filter((t) => t.startsWith('PAM'));
const punish = danTypes.filter((t) => /^PPL1/.test(t));
console.log('DAN types:', danTypes.length, '| PAM (reward):', reward.length, '| PPL1 (punishment):', punish.length);

const meta = {
  dataset: 'MaleCNS v1.0',
  source: 'https://male-cns.janelia.org/download/',
  license: 'CC BY 4.0 — FlyEM/HHMI Janelia, Univ. of Cambridge, MRC LMB, Google Research',
  neuronsTotal: rows.length,
  neuronsDrawn: kept.length,
  groups: [...groupIndex.keys()],
  types: [...typeIndex.keys()],
  rewardTypes: reward,
  punishTypes: punish,
};
fs.mkdirSync(path.dirname(OUT_META), { recursive: true });
fs.writeFileSync(OUT_META, [
  '// GENERATED by tools/build-connectome.mjs from MaleCNS v1.0 — do not edit.',
  `// ${meta.license}`,
  '',
  `export default ${JSON.stringify(meta, null, 1)};`,
  '',
].join('\n'));
console.log('wrote', OUT_META, (fs.statSync(OUT_META).size / 1e6).toFixed(2), 'MB');
