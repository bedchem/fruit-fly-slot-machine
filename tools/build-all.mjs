/**
 * Rebuilds every generated asset. Run with `npm run assets`.
 *
 * The connectome dumps are large (1 GB for the weights) and are downloaded on
 * demand into a local cache rather than committed. Everything the app actually
 * ships is small: 0.66 MB of neuron positions and 0.43 MB of connectivity.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const HOME = process.env.USERPROFILE || process.env.HOME || '.';
const DESKTOP = path.join(HOME, 'Desktop');
const CACHE = process.env.CNS_DIR || path.join('.cache', 'cns');

const MODELS = {
  fly: process.env.FLY_GLB || path.join(DESKTOP, 'drosophila_-_adult_fruit_fly_-_ct_scan.glb'),
  slot: process.env.SLOT_GLB || path.join(DESKTOP, 'pillar_slots.glb'),
};

const CNS_FILES = {
  'body-annotations.feather':
    'https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather',
  'body-neurotransmitters.feather':
    'https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-neurotransmitters-male-cns-v1.0.feather',
  'connectome-weights.feather':
    'https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather',
};

const run = (args, label) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`${label} failed`); process.exit(r.status ?? 1); }
};

// --- the two Sketchfab models ---------------------------------------------
for (const [name, file] of Object.entries(MODELS)) {
  if (!fs.existsSync(file)) {
    console.error(`missing ${name} model: ${file}\n`
      + `  set ${name.toUpperCase()}_GLB to point at it`);
    process.exit(1);
  }
}
run(['tools/build-slot.mjs', MODELS.slot], 'slot machine');
run(['tools/build-fly.mjs', MODELS.fly, 'assets/models/fly.glb', '0.22'], 'fly');
run(['tools/compress-models.mjs'], 'compress models for the site');

// --- the connectome --------------------------------------------------------
fs.mkdirSync(CACHE, { recursive: true });
for (const [name, url] of Object.entries(CNS_FILES)) {
  const dest = path.join(CACHE, name);
  if (fs.existsSync(dest)) { console.log(`cached ${name} (${(fs.statSync(dest).size / 1e6).toFixed(0)} MB)`); continue; }
  console.log(`downloading ${name} …`);
  const r = spawnSync('curl', ['-sSL', '-o', dest, url], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('download failed:', url); process.exit(1); }
}
run(['tools/build-connectome.mjs', CACHE], 'neuron cloud');
run(['tools/build-graph.mjs', CACHE], 'connectivity graph');

console.log('\nall assets built.');
