/**
 * Two flies doomscrolling, headless: the real feed, the real messages, two
 * real brains, stepped at 60 fps on a simulated clock.
 *
 *   node tools/sim-scroll.mjs [minutes=6] [seed=1] [--quiet] [--fan]
 *
 * One line per event — reels sent and answered, flinches, dead phones, sleep —
 * and a summary per night: screen time, how far each feed drifted towards
 * doom, and how in sync the two brains ran.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Duo, REELS } from '../src/game/scroll.js';
import { EDITS } from '../src/game/tiktokEdits.js';
import { parseGraph } from '../src/neural/simulation.js';
import { DuoBrain } from '../src/neural/scrollBrain.js';
import meta from '../src/neural/cnsGraph.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const nums = args.filter((a) => !a.startsWith('--')).map(Number);
const minutes = nums[0] ?? 6;
const seed = nums[1] ?? 1;

const buf = fs.readFileSync(path.join(here, '../public/data/graph.bin'));
const graph = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const brain = new DuoBrain(graph, meta);

let clock = 0;
const log = [];
let syncSum = 0, syncN = 0, syncShared = 0, syncSharedN = 0;
const duo = new Duo({
  seed,
  now: () => clock,
  onEvent: (type, d) => {
    const t = `${(clock / 1000).toFixed(0).padStart(4)}s n${duo.night} ${duo.clock}`;
    const f = d && d.fly !== undefined ? duo.flies[d.fly] : null;
    if (type === 'morning') {
      log.push(`${t}  ── MORNING ──`);
      for (const r of d) {
        log.push(`         ${r.name.padEnd(6)} screen ${Math.round(r.screen)} min, ${r.reels} reels, sent ${r.sent}, `
          + `${r.replies} replies / ${r.ignored} left on seen, ${r.flinches} flinches, feed ${Math.round(r.doom * 100)}% doom, `
          + `algorithm's favourite: ${r.favourite}`);
      }
      return;
    }
    if (!['shareStart', 'flinch', 'dead', 'asleep', 'night'].includes(type)) return;
    const what = type === 'shareStart' ? `sends ${f.lastResult?.cat ?? '?'}`
      : type === 'night' ? `── night ${d.night} ──` : type;
    log.push(`${t}  ${(f?.name ?? '').padEnd(6)} ${what.padEnd(22)}`
      + (f ? ` da ${f.dopamine.toFixed(2)} oct ${f.octopamine.toFixed(2)} fear ${f.fear.toFixed(2)} npf ${f.npf.toFixed(2)} bat ${f.battery.toFixed(0)}% doom ${Math.round(f.feed.doom * 100)}%` : '')
      + `  sync ${duo.sync.toFixed(2)}`);
  },
});
brain.attach(duo);
if (args.includes('--fan')) duo.setFan(EDITS, true);

const dt = 1 / 60;
const frames = Math.round(minutes * 60 / dt);
const started = performance.now();
for (let i = 0; i < frames; i++) {
  duo.update(dt);
  brain.step(duo, dt);
  clock += dt * 1000;
  if (!duo.morning && duo.flies.every((f) => f.screenOn) && i % 12 === 0) {
    syncSum += duo.sync; syncN++;
    const [x, y] = duo.flies;
    if (x.reel.shareId && x.reel.shareId === y.reel.shareId) { syncShared += duo.sync; syncSharedN++; }
  }
}
if (!quiet) console.log(log.join('\n'));
const [a, b] = duo.flies;
const fmt = (f) => `${f.name}: ${Math.round(f.screenMinutes)} min on screen, ${f.reels} reels, sent ${f.sent}, `
  + `${f.flinches} flinches, feed ${Math.round(f.feed.doom * 100)}% doom (expects ${Object.entries(f.feed.expected)
    .map(([k, v]) => `${k} ${v.toFixed(1)}s`).join(', ')})`;
console.log(`\n${minutes} real minutes (${((performance.now() - started) / 1000).toFixed(1)}s to run), night ${duo.night}, ${duo.exchanged} reels exchanged`);
console.log(fmt(a));
console.log(fmt(b));
console.log(`brain sync: ${(syncSum / Math.max(1, syncN)).toFixed(2)} on average, `
  + `${(syncShared / Math.max(1, syncSharedN)).toFixed(2)} while watching a sent reel together`);
void REELS;
