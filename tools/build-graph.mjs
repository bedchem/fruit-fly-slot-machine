/**
 * Builds the connectivity the app actually simulates.
 *
 * The full graph is 140 k neurons and tens of millions of synapses, which is
 * not going into a browser. The standard reduction in connectome work is to
 * collapse to CELL TYPE: every neuron of a type is wired much the same way, so
 * a type-by-type weight matrix keeps the real circuit and loses the redundancy.
 * That is what this emits.
 *
 * Every number is measured:
 *   - edge weights are summed synapse counts from connectome-weights
 *   - the sign of each edge is the presynaptic type's predicted transmitter
 *     (acetylcholine excites; GABA and glutamate inhibit — in flies glutamate
 *     is largely inhibitory through GluClα)
 *   - weights are divided by the postsynaptic type's neuron count, so an edge
 *     is "synapses onto an average cell of this type"
 *
 *   node tools/build-graph.mjs <cns-data-dir>
 *
 * Data: https://male-cns.janelia.org/download/ — CC BY 4.0, FlyEM / HHMI
 * Janelia, University of Cambridge, MRC LMB and Google Research.
 */
import fs from 'fs';
import path from 'path';
import lz4 from 'lz4js';
import { RecordBatchReader, compressionRegistry } from 'apache-arrow';
import { readFeather } from './lib-feather.mjs';

compressionRegistry.set(0, { decode: (d) => lz4.decompress(d) });

const DIR = process.argv[2] || 'cns-data';
const OUT = 'public/data/graph.bin';
const OUT_META = 'src/neural/cnsGraph.js';

/** How many cell types the model runs. */
const MAX_TYPES = Number(process.env.MAX_TYPES || 1600);
/** Edges carrying fewer synapses than this per postsynaptic cell are dropped. */
const MIN_WEIGHT = Number(process.env.MIN_WEIGHT || 0.6);

// ---------------------------------------------------------------- annotations
const ann = readFeather(path.join(DIR, 'body-annotations.feather'));
const aBody = ann.getChild('bodyId');
const aType = ann.getChild('type');
const aClass = ann.getChild('class');
const aSuper = ann.getChild('superclass');

const typeOfBody = new Map();          // bodyId(String) -> type name
const typeInfo = new Map();            // type -> { n, class, superclass }
for (let i = 0; i < ann.numRows; i++) {
  const ty = aType.get(i);
  if (!ty) continue;
  typeOfBody.set(String(aBody.get(i)), ty);
  let info = typeInfo.get(ty);
  if (!info) { info = { n: 0, cls: aClass.get(i) || '', sup: aSuper.get(i) || '' }; typeInfo.set(ty, info); }
  info.n++;
}
console.log('annotated bodies:', typeOfBody.size, ' distinct types:', typeInfo.size);

// ------------------------------------------------------------ neurotransmitter
const nt = readFeather(path.join(DIR, 'body-neurotransmitters.feather'));
const nBody = nt.getChild('body');
const nCons = nt.getChild('consensus_nt');
const ntVotes = new Map();             // type -> { nt -> count }
for (let i = 0; i < nt.numRows; i++) {
  const ty = typeOfBody.get(String(nBody.get(i)));
  if (!ty) continue;
  const t = nCons.get(i);
  if (!t) continue;
  let v = ntVotes.get(ty);
  if (!v) { v = new Map(); ntVotes.set(ty, v); }
  v.set(t, (v.get(t) || 0) + 1);
}
/** Fast excitation, fast inhibition, or modulation — the sign each edge gets. */
const SIGN = {
  acetylcholine: 1,
  glutamate: -1,      // GluClα is an inhibitory chloride channel in flies
  gaba: -1,
  dopamine: 0.25,     // modulatory, not a fast synapse
  octopamine: 0.25,
  serotonin: 0.15,
  histamine: -1,      // photoreceptor output: inhibitory onto LMCs
  unknown: 0.3,
};
const typeNT = new Map();
for (const [ty, votes] of ntVotes) {
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  typeNT.set(ty, best ? best[0] : 'unknown');
}
console.log('types with a transmitter call:', typeNT.size);

// ------------------------------------------------------------- pick the types
// Force-keep the circuit the readout is about, then fill by neuron count.
const FORCE = (ty, info) => (
  /^(PAM|PPL1|PPL2|PPM12)/.test(ty)          // dopaminergic clusters
  || info.cls === 'DAN' || info.cls === 'MBON' || info.cls === 'Kenyon_Cell'
  || info.cls === 'gustatory' || info.cls === 'olfactory'
  || info.cls === 'CX'
  || info.sup === 'descending_neuron'
);
const all = [...typeInfo.entries()];
const forced = all.filter(([ty, i]) => FORCE(ty, i));
const rest = all.filter(([ty, i]) => !FORCE(ty, i)).sort((a, b) => b[1].n - a[1].n);
const chosen = [...forced, ...rest.slice(0, Math.max(0, MAX_TYPES - forced.length))];
const typeIdx = new Map(chosen.map(([ty], i) => [ty, i]));
const K = chosen.length;
console.log(`simulating ${K} cell types (${forced.length} forced, ${K - forced.length} by size)`);

const bodyToIdx = new Map();
for (const [body, ty] of typeOfBody) {
  const i = typeIdx.get(ty);
  if (i !== undefined) bodyToIdx.set(body, i);
}
console.log('bodies mapped into the model:', bodyToIdx.size);

// ------------------------------------------------------- stream the edge list
const edges = new Map();               // post * K + pre  ->  summed synapses
let read = 0, used = 0;
const reader = await RecordBatchReader.from(
  fs.createReadStream(path.join(DIR, 'connectome-weights.feather')),
);
await reader.open();
for await (const batch of reader) {
  const pre = batch.getChild('body_pre');
  const post = batch.getChild('body_post');
  const w = batch.getChild('weight');
  for (let i = 0; i < batch.numRows; i++) {
    read++;
    const a = bodyToIdx.get(String(pre.get(i)));
    if (a === undefined) continue;
    const b = bodyToIdx.get(String(post.get(i)));
    if (b === undefined) continue;
    const key = b * K + a;
    edges.set(key, (edges.get(key) || 0) + Number(w.get(i)));
    used++;
  }
  if (read % 5000000 < 65536) console.log(`  ${(read / 1e6).toFixed(1)}M edges read, ${edges.size} type pairs`);
}
console.log(`edges: ${read} read, ${used} inside the model, ${edges.size} distinct type pairs`);

// ------------------------------------------------- normalise, sign, sparsify
const rows = Array.from({ length: K }, () => []);
let dropped = 0;
for (const [key, syn] of edges) {
  const post = Math.floor(key / K);
  const pre = key % K;
  const perCell = syn / chosen[post][1].n;            // synapses onto an average cell
  if (perCell < MIN_WEIGHT) { dropped++; continue; }
  const sign = SIGN[typeNT.get(chosen[pre][0]) || 'unknown'] ?? SIGN.unknown;
  rows[post].push([pre, perCell * sign]);
}
const nnz = rows.reduce((a, r) => a + r.length, 0);
console.log(`kept ${nnz} edges (dropped ${dropped} below ${MIN_WEIGHT} synapses/cell)`);

// CSR: offsets[K+1], indices[nnz] uint16, weights[nnz] float32
const offsets = new Uint32Array(K + 1);
const indices = new Uint16Array(nnz);
const weights = new Float32Array(nnz);
let p = 0;
for (let i = 0; i < K; i++) {
  offsets[i] = p;
  for (const [j, w] of rows[i]) { indices[p] = j; weights[p] = w; p++; }
}
offsets[K] = p;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const header = Buffer.alloc(12);
header.write('CNSG', 0, 'ascii');
header.writeUInt32LE(K, 4);
header.writeUInt32LE(nnz, 8);
fs.writeFileSync(OUT, Buffer.concat([
  header,
  Buffer.from(offsets.buffer), Buffer.from(indices.buffer), Buffer.from(weights.buffer),
]));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');

// ------------------------------------------------------------------- metadata
const names = chosen.map(([ty]) => ty);
const counts = chosen.map(([, i]) => i.n);
const classes = chosen.map(([, i]) => i.cls || i.sup || '');
const transmitters = chosen.map(([ty]) => typeNT.get(ty) || 'unknown');

const pick = (re, field = 'cls') => chosen
  .map(([ty, i], k) => ({ ty, i, k }))
  .filter(({ ty, i }) => (field === 'name' ? re.test(ty) : re.test(i.cls || '') || re.test(i.sup || '')))
  .map(({ k }) => k);

const meta = {
  dataset: 'MaleCNS v1.0',
  source: 'https://male-cns.janelia.org/download/',
  license: 'CC BY 4.0 — FlyEM/HHMI Janelia, Univ. of Cambridge, MRC LMB, Google Research',
  types: K,
  edges: nnz,
  names, counts, classes, transmitters,
  // the populations the model drives and reads, found by their real annotations
  populations: {
    reward: pick(/^PAM/, 'name'),               // PAM cluster: appetitive reinforcement
    punish: pick(/^PPL1/, 'name'),              // PPL1 cluster: aversive reinforcement
    gustatory: pick(/gustatory/),               // sugar in, the real reward channel
    visual: pick(/^(visual|ol_)/),              // the reels
    mechanosensory: pick(/mechanosensory/),     // the handle
    descending: pick(/descending_neuron/),      // motor command out
    mushroomBody: pick(/Kenyon_Cell/),
    mushroomOut: pick(/MBON/),
    centralComplex: pick(/^CX$/),
  },
};
fs.writeFileSync(OUT_META, [
  '// GENERATED by tools/build-graph.mjs from MaleCNS v1.0 — do not edit.',
  `// ${meta.license}`,
  '',
  `export default ${JSON.stringify(meta)};`,
  '',
].join('\n'));
console.log('wrote', OUT_META, (fs.statSync(OUT_META).size / 1e6).toFixed(2), 'MB');
for (const [k, v] of Object.entries(meta.populations)) console.log('  ', k.padEnd(16), v.length, 'types');
