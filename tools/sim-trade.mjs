/**
 * Trades headless: the real market, the real trader, the real brain — motion
 * detectors, giant fibre, mushroom body — stepped at 60 fps on a simulated
 * clock.
 *
 *   node tools/sim-trade.mjs [minutes=10] [seed=1] [--quiet]
 *   node tools/sim-trade.mjs --league [minutes=10] [seeds=8]
 *
 * One line per order: what it did and why, the price, what its optic lobe
 * reported, its P&L against buy-and-hold and a coin. `--league` plays several
 * seeds and prints only the scoreboard: does a fly beat the market?
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Trader } from '../src/game/trader.js';
import { parseGraph } from '../src/neural/simulation.js';
import { TraderBrain } from '../src/neural/traderBrain.js';
import meta from '../src/neural/cnsGraph.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const league = args.includes('--league');
const quiet = args.includes('--quiet') || league;
const nums = args.filter((a) => !a.startsWith('--')).map(Number);
const minutes = nums[0] ?? 10;

const buf = fs.readFileSync(path.join(here, '../public/data/graph.bin'));
const graph = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const money = (x) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(0)}`;

function play(seed) {
  let clock = 0;
  const brain = new TraderBrain(graph, meta);
  const log = [];
  const tr = new Trader({
    seed,
    now: () => clock,
    onEvent: (type, d) => {
      if (!['filled', 'marginCall', 'close'].includes(type)) return;
      const t = `${(clock / 1000).toFixed(0).padStart(4)}s d${tr.market.day} ${tr.market.clock}`;
      const what = type === 'filled'
        ? `${d.kind.toUpperCase().padEnd(5)} ${String(d.units).padStart(3)} → pos ${String(d.position).padStart(2)}  ${money(d.realized).padStart(6)}`
        : type === 'marginCall' ? '── MARGIN CALL ──' : `── close of day ${d.day} ──`;
      log.push(`${t}  ${what.padEnd(32)} $${tr.price.toFixed(2).padStart(7)} ${tr.market.regime.padEnd(6)}`
        + `  sees ${tr.perceivedTrend >= 0 ? '+' : ''}${tr.perceivedTrend.toFixed(2)} gf ${tr.escape.toFixed(2)}`
        + `  fly ${money(tr.pnl).padStart(6)} hold ${money(tr.holdPnl).padStart(6)} coin ${money(tr.coinPnl).padStart(6)}`
        + `  mem ${tr.memory >= 0 ? '+' : ''}${tr.memory.toFixed(2)}  | ${tr.lastResult?.why ?? ''}`);
    },
  });
  brain.attach(tr);
  const dt = 1 / 60;
  const frames = Math.round(minutes * 60 / dt);
  for (let f = 0; f < frames; f++) {
    tr.update(dt);
    brain.step(tr, dt);
    clock += dt * 1000;
  }
  return { tr, brain, log };
}

if (league) {
  const seeds = nums[1] ?? 8;
  let beatHold = 0, beatCoin = 0;
  console.log('seed   days  fly        hold       coin       trades  win%  panics  margin');
  for (let s = 1; s <= seeds; s++) {
    const { tr } = play(s);
    if (tr.pnl > tr.holdPnl) beatHold++;
    if (tr.pnl > tr.coinPnl) beatCoin++;
    const wr = tr.wins + tr.losses ? Math.round(100 * tr.wins / (tr.wins + tr.losses)) : 0;
    console.log(`${String(s).padStart(4)}  ${String(tr.market.day).padStart(5)}  ${money(tr.pnl).padEnd(9)}  ${money(tr.holdPnl).padEnd(9)}  ${money(tr.coinPnl).padEnd(9)}`
      + `  ${String(tr.trades).padStart(6)}  ${String(wr).padStart(4)}  ${String(tr.panics).padStart(6)}  ${String(tr.marginCalls).padStart(6)}`);
  }
  console.log(`\nthe fly beat buy-and-hold in ${beatHold}/${seeds} markets and the coin in ${beatCoin}/${seeds}`);
} else {
  const { tr, brain, log } = play(nums[1] ?? 1);
  if (!quiet) console.log(log.join('\n'));
  console.log(`\nreads upward motion with: ${brain.readers.up.map((r) => r.name).join(', ')}`);
  console.log(`reads downward motion with: ${brain.readers.down.map((r) => r.name).join(', ')}`);
  console.log(`${minutes} real minutes, ${tr.market.day - 1} sessions closed: fly ${money(tr.pnl)}, hold ${money(tr.holdPnl)}, coin ${money(tr.coinPnl)}; `
    + `${tr.trades} units traded, ${tr.wins} winning / ${tr.losses} losing closes, ${tr.panics} panic sells, ${tr.marginCalls} margin calls, fees $${tr.fees.toFixed(0)}`);
}
