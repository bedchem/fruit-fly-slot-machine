/**
 * Checks the rate model on the real graph: is it stable, and does driving the
 * real sensory populations actually move the real readouts?
 *
 * The gain in src/neural/simulation.js is set from this. Too low and the
 * network is a dead baseline; too high and the recurrence runs away and every
 * type pins at 1. The sweep prints both failure modes so the chosen value is
 * visibly in the middle.
 */
import fs from 'fs';
import { ConnectomeSim, parseGraph } from '../src/neural/simulation.js';
import meta from '../src/neural/cnsGraph.js';

const buf = fs.readFileSync(new URL('../public/data/graph.bin', import.meta.url));
const graph = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
console.log(`graph: ${graph.K} types, ${graph.nnz} edges`);

const P = meta.populations;
let pos = 0, neg = 0, sumAbs = 0;
for (let i = 0; i < graph.nnz; i++) {
  if (graph.weights[i] > 0) pos++; else if (graph.weights[i] < 0) neg++;
  sumAbs += Math.abs(graph.weights[i]);
}
console.log(`edges: ${pos} excitatory, ${neg} inhibitory, mean |w| ${(sumAbs / graph.nnz).toFixed(2)}`);

function run(gain, drive, seconds = 3) {
  const sim = new ConnectomeSim(graph, { gain });
  const steps = Math.round(seconds * 200);
  for (let s = 0; s < steps; s++) {
    sim.clearInput();
    if (drive && s > steps * 0.35) for (const [k, amt] of Object.entries(drive)) sim.drive(P[k], amt);
    sim.tick(1 / 200);
  }
  let mean = 0, max = 0, pinned = 0;
  for (let i = 0; i < sim.K; i++) {
    mean += sim.rate[i];
    if (sim.rate[i] > max) max = sim.rate[i];
    if (sim.rate[i] > 0.97) pinned++;
  }
  return {
    mean: mean / sim.K, max, pinned,
    reward: sim.mean(P.reward), punish: sim.mean(P.punish),
    mb: sim.mean(P.mushroomBody), mbon: sim.mean(P.mushroomOut),
    visual: sim.mean(P.visual), desc: sim.mean(P.descending),
  };
}

console.log('\ngain sweep — resting network (no drive):');
console.log('gain      mean    max   pinned   PAM    PPL1');
for (const gain of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1.0, 1.15]) {
  const r = run(gain, null);
  console.log(`${gain.toFixed(3)}  ${r.mean.toFixed(3)}  ${r.max.toFixed(3)}  ${String(r.pinned).padStart(5)}` +
    `  ${r.reward.toFixed(3)}  ${r.punish.toFixed(3)}`);
}

console.log('\nresponse at the chosen gain — does driving real inputs move real readouts?');
const GAIN = Number(process.argv[2] || 0.0007);
const cases = {
  'rest              ': null,
  'sugar (gustatory) ': { gustatory: 0.55 },
  'reels (visual)    ': { visual: 0.45 },
  'handle (mechano)  ': { mechanosensory: 0.5 },
};
console.log('condition            PAM    PPL1     KC    MBON  visual   desc    mean');
for (const [name, drive] of Object.entries(cases)) {
  const r = run(GAIN, drive);
  console.log(`${name}  ${r.reward.toFixed(3)}  ${r.punish.toFixed(3)}  ${r.mb.toFixed(3)}` +
    `  ${r.mbon.toFixed(3)}  ${r.visual.toFixed(3)}  ${r.desc.toFixed(3)}  ${r.mean.toFixed(3)}`);
}

// a cost check: how long does one simulated second take?
const t0 = performance.now();
const sim = new ConnectomeSim(graph, { gain: GAIN });
for (let i = 0; i < 200; i++) { sim.clearInput(); sim.tick(1 / 200); }
console.log(`\n1 s of simulation = ${(performance.now() - t0).toFixed(1)} ms of CPU`);
