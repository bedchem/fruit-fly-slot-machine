/**
 * Runs the slot machine headlessly and prints the timeline of one spin, plus
 * a long run to check the payout maths. Catches sequencing bugs long before a
 * browser would.
 */
import { SlotMachine, PHASES, rollOutcome, SYMBOLS, angleForSymbol } from '../src/game/machine.js';

const events = [];
const m = new SlotMachine({ onEvent: (type, d) => events.push({ t: +clock.toFixed(2), type, d }) });
let clock = 0;
const DT = 1 / 60;

m.start();
let lastPhase = null;
const rows = [];
for (let i = 0; i < 60 * 14; i++) {
  m.update(DT);
  clock += DT;
  if (m.phase !== lastPhase) {
    rows.push([clock.toFixed(2), m.phase, m.leverAngle.toFixed(3), m.grip.toFixed(2),
      m.reels.map(r => r.state).join('/'), m.dopamine.toFixed(2)]);
    lastPhase = m.phase;
  }
  if (m.phase === PHASES.IDLE && clock > 2) break;
}
console.log('phase transitions   t    phase       lever   grip  reels                dopa');
for (const r of rows) console.log('  ', r[0].padStart(6), r[1].padEnd(11), r[2].padStart(7), r[3].padStart(5), r[4].padEnd(20), r[5]);
console.log('\nevents:');
for (const e of events) console.log('  ', String(e.t).padStart(6), e.type, e.d ? JSON.stringify(e.d).slice(0, 90) : '');
console.log('\nfinal: phase', m.phase, 'credits', m.credits, 'result', m.lastResult && {
  symbols: m.lastResult.symbols.map(s => s.id), win: m.lastResult.win, payout: m.lastResult.payout,
});

// reels must land exactly on the rolled symbol
const landed = m.reels.map((r, i) => {
  const want = angleForSymbol(m.outcome.reels[i]);
  const err = Math.abs(((r.angle - want) % (2 * Math.PI) + 2 * Math.PI + 1e-9) % (2 * Math.PI));
  return Math.min(err, 2 * Math.PI - err);
});
console.log('reel landing error (rad):', landed.map(n => n.toExponential(1)).join(', '),
  landed.every(e => e < 1e-6) ? 'OK' : 'MISALIGNED');

// payout maths over a long run
let credits = 0, spins = 0, wins = 0, near = 0, jack = 0;
for (let i = 0; i < 200000; i++) {
  const o = rollOutcome();
  spins++; credits -= 1;
  if (o.win) { wins++; credits += o.jackpot ? 12 : 3; if (o.jackpot) jack++; }
  else if (o.nearMiss) near++;
}
console.log(`\n${spins} spins: win ${(100 * wins / spins).toFixed(1)}%  jackpot ${(100 * jack / spins).toFixed(2)}%  ` +
  `near-miss ${(100 * near / spins).toFixed(1)}%  return-to-player ${(100 * (credits + spins) / spins).toFixed(1)}%`);

// a full spin cycle, timed
let cyc = 0;
const m2 = new SlotMachine();
m2.start();
while (m2.phase !== PHASES.IDLE && cyc < 30) { m2.update(DT); cyc += DT; }
console.log('full cycle back to idle:', cyc.toFixed(2), 's');
