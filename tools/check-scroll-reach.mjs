/**
 * Can each fly's right foreleg reach the whole of its phone screen?
 *
 *   node tools/check-scroll-reach.mjs
 *
 * Checks the swipe path, the share button and the resting thumb against the
 * leg's span, in the fly's own model space (the phone is placed there).
 */
import { SHOULDER, REACH } from '../src/scene/flyRig.js';
import { phoneLocal, PHONE, SWIPE_FROM, SWIPE_TO, SHARE_BUTTON, THUMB_REST, POSES } from '../src/scene/scrollLayout.js';

// the screen, roughly, in model units: the phone is scaled by the pose
const s = 1 / POSES[0].scale;
const c = phoneLocal(0);
const at = ([u, v]) => [c[0] + u * PHONE.width * s, c[1] + v * PHONE.height * s, c[2]];
let ok = true;
for (const [name, p] of [['swipe start', SWIPE_FROM], ['swipe end', SWIPE_TO], ['share', SHARE_BUTTON], ['thumb rest', THUMB_REST]]) {
  const q = at(p);
  const r = Math.hypot(q[0] - SHOULDER[0], q[1] - SHOULDER[1], q[2] - SHOULDER[2]) / REACH;
  if (r >= 0.97) ok = false;
  console.log(`${name.padEnd(12)} ${(r * 100).toFixed(0)}% of reach`);
}
console.log(ok ? 'the whole screen is in reach' : 'OUT OF REACH — move the phone in scrollLayout.js');
process.exitCode = ok ? 0 : 1;
