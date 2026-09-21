/**
 * Can the fly's right foreleg reach both trading buttons, fully pressed?
 *
 *   node tools/check-trade-reach.mjs
 *
 * Prints the reach fraction for each (1 is the leg fully stretched); the IK
 * clamps anything past 1, which shows as a tarsus hovering over the button.
 */
import { reachFraction } from '../src/scene/layout.js';
import { pressPoint } from '../src/scene/tradeLayout.js';

let ok = true;
for (const which of ['buy', 'sell']) {
  for (const depth of [0, 1]) {
    const r = reachFraction(pressPoint(which, depth));
    if (r >= 0.97) ok = false;
    console.log(`${which.padEnd(4)} depth ${depth}: ${(r * 100).toFixed(0)}% of reach`);
  }
}
console.log(ok ? 'both buttons reachable' : 'OUT OF REACH — move BUTTONS in tradeLayout.js');
process.exitCode = ok ? 0 : 1;
