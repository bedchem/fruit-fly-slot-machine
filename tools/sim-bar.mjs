/**
 * Plays a whole session headless: the real bar, the real brain, the real
 * mushroom-body learning and the real pharmacology, stepped at 60 fps on a
 * simulated clock.
 *
 *   node tools/sim-bar.mjs [minutes=10] [seed=1]
 *
 * One line per decision and per event — what it took and why, where its body
 * ethanol and nicotine are, and what the mushroom body now says about the
 * bar — so the policy and the pharmacokinetics can be judged over several
 * nights rather than guessed from a few minutes in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bar } from '../src/game/bar.js';
import { parseGraph } from '../src/neural/simulation.js';
import { BarBrain as Brain } from '../src/neural/barBrain.js';
import meta from '../src/neural/cnsGraph.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const minutes = Number(process.argv[2] ?? 10);
let seed = Number(process.argv[3] ?? 1);
const quiet = process.argv.includes('--quiet');

const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
let clock = 0;

const buf = fs.readFileSync(path.join(here, '../public/data/graph.bin'));
const graph = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const brain = new Brain(graph, meta);

const log = [];
const b = new Bar({
  rng,
  now: () => clock,
  onEvent: (type, d) => {
    if (!['boutDone', 'tuck', 'passout', 'sleep', 'wake', 'seizure', 'recover', 'refill'].includes(type)) return;
    const t = `${(clock / 1000).toFixed(0).padStart(5)}s d${b.day} ${b.clock}`;
    const body = `EtOH ${b.bac.toFixed(1).padStart(5)} mM  nic ${b.nicotine.toFixed(1).padStart(5)}  hang ${b.hangover.toFixed(2)}`
      + `  npf ${b.npf.toFixed(2)} tol ${b.tolerance.toFixed(2)} dep ${b.dependence.toFixed(2)}`
      + `  da ${b.dopamine.toFixed(2)} mem ${b.memory >= 0 ? '+' : ''}${b.memory.toFixed(2)}`;
    const what = type === 'boutDone' ? `${d.sips} sips`
      : type === 'tuck' ? `pouch ${d.mg} mg`
        : type === 'wake' ? `WAKES (hangover ${d.hangover.toFixed(2)})`
          : type.toUpperCase();
    log.push(`${t}  ${what.padEnd(26)} ${body}  | ${b.lastResult?.why ?? ''}`);
  },
});
brain.attach(b);

const dt = 1 / 60;
const frames = Math.round(minutes * 60 / dt);
const started = performance.now();
let rests = 0;
for (let f = 0; f < frames; f++) {
  const before = b.lastResult;
  b.update(dt);
  brain.step(b, dt);
  if (b.lastResult !== before && b.lastResult?.kind === 'rest') rests++;
  clock += dt * 1000;
}
if (!quiet) console.log(log.join('\n'));
console.log(`\n${minutes} real minutes (${((performance.now() - started) / 1000).toFixed(1)}s to run): `
  + `${b.nights} nights, ${b.sips} sips, ${b.beers} glasses finished, ${b.pouchCount} pouches (${b.nicotineMg} mg), `
  + `${b.passouts} pass-outs, ${b.seizures} seizures, ${rests} decisions to wait; `
  + `all-time peak ${b.allTimePeak.toFixed(1)} mM, worst hangover ${b.hangoverWorst.toFixed(2)}`);
