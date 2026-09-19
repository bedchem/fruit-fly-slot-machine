/**
 * Plays a whole session headless: the real machine, the real brain, the real
 * mushroom-body learning, stepped at 60 fps on a simulated clock.
 *
 *   node tools/sim-session.mjs [minutes=15] [seed=1]
 *
 * One line per spin — what it staked and why, what came up, and what the
 * mushroom body now says about the machine — so the learning rate and the
 * stake policy can be judged over a long session rather than guessed from a
 * few minutes in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SlotMachine } from '../src/game/machine.js';
import { parseGraph } from '../src/neural/simulation.js';
import { Brain } from '../src/neural/brain.js';
import meta from '../src/neural/cnsGraph.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const minutes = Number(process.argv[2] ?? 15);
let seed = Number(process.argv[3] ?? 1);

// deterministic rng, so a run can be repeated
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// the machine stamps results with Date.now(); run that on the simulated clock
let clock = 0;
Date.now = () => clock;

const buf = fs.readFileSync(path.join(here, '../public/data/graph.bin'));
const graph = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const brain = new Brain(graph, meta);

const log = [];
const m = new SlotMachine({
  rng,
  onEvent: (type, d) => {
    const t = (clock / 1000).toFixed(0).padStart(5) + 's';
    const mem = `mem ${m.memory >= 0 ? '+' : ''}${m.memory.toFixed(2)} (${(m.learned * 100).toFixed(0)}% stored)`;
    if (type === 'win' || type === 'lose') {
      const what = d.jackpot ? 'JACKPOT' : d.win ? `won ${d.payout}` : d.nearMiss ? 'near miss' : 'lost';
      log.push(`${t}  stake ${d.bet}  ${what.padEnd(9)}  credits ${String(m.credits).padStart(3)}  `
        + `${mem}  fear ${m.fear.toFixed(2)}  npf ${m.npf.toFixed(2)}  | ${d.betWhy}`);
    }
    if (type === 'broke') log.push(`${t}  ── OUT OF CREDIT (#${m.deaths}) ──  ${mem}`);
    if (type === 'revive') log.push(`${t}  ── comes round, ${m.credits} credits ──`);
  },
});
brain.attach(m);

const dt = 1 / 60;
const frames = Math.round(minutes * 60 / dt);
const started = performance.now();
for (let f = 0; f < frames; f++) {
  m.update(dt);
  brain.step(m, dt, clock);
  clock += dt * 1000;
}

console.log(log.join('\n'));
console.log('\n' + [
  `${minutes} min simulated in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  `spins ${m.spins}, wins ${m.wins} (${(100 * m.wins / Math.max(1, m.spins)).toFixed(0)}%)`,
  `staked ${m.staked}, won ${m.won}, return ${(100 * m.won / Math.max(1, m.staked)).toFixed(0)}%, biggest stake ${m.biggestStake}`,
  `ran dry ${m.deaths}×`,
  `memory ${m.memory.toFixed(2)}, stored ${(m.learned * 100).toFixed(0)}%`,
].join('\n'));
console.log('\ncompartments:');
for (const mb of brain.memory.mbons) {
  console.log(`  ${mb.name.padEnd(12)} ${mb.cluster.padEnd(4)} ${mb.valence > 0 ? 'approach' : 'avoid   '}  strength ${(mb.strength * 100).toFixed(0)}%`);
}
