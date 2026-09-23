/**
 * Solves the fly's seated placement from the actual mesh rather than from
 * eyeballed offsets.
 *
 * For each candidate (scale, pitch, yaw) it transforms every vertex, then:
 *   - drops the fly until its lowest point rests on the stool's seat
 *   - slides it along the seat until the foreleg is working at the target
 *     fraction of its reach
 *   - reports head clearance against the cabinet's stepped silhouette
 *
 * Prints the FLY block to paste into src/scene/layout.js.
 */
import { loadMesh } from './lib-raster.mjs';
import * as rig from '../src/scene/flyRig.js';
import { STOOL, knobAt, LEVER_PULLED, PARTS } from '../src/scene/layout.js';

const url = (p) => new URL(p, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const fly = loadMesh(url('../assets/models/fly.glb'));
const P = fly.P, nv = P.length / 3;

const SEAT_TOP = STOOL.seatCenter[1];
const TARGET_REACH = Number(process.argv[2] || 0.74);

/** The cabinet, as a stack of X limits by height. */
function cabinetFrontAt(y) {
  if (y < 0.68) return 0.55;         // the cross base
  if (y < 0.83) return 1.23;         // the button ledge sticks out furthest
  if (y < 1.46) return 1.03;         // the front panel and glass
  return 0.93;                       // the dome leans back
}

function transformAll(scale, pitch, yaw) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const out = new Float64Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3] * scale, y0 = P[i * 3 + 1] * scale, z0 = P[i * 3 + 2] * scale;
    const y = y0 * cp - z0 * sp;
    const z = y0 * sp + z0 * cp;
    out[i * 3] = x * cy + z * sy;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = -x * sy + z * cy;
  }
  return out;
}

const point = (T, p, scale, pitch, yaw) => {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x = p[0] * scale, y0 = p[1] * scale, z0 = p[2] * scale;
  const y = y0 * cp - z0 * sp;
  const z = y0 * sp + z0 * cp;
  return [x * cy + z * sy, y, -x * sy + z * cy];
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

console.log('seat top', SEAT_TOP.toFixed(4), ' target reach', TARGET_REACH);
console.log('');
console.log('scale pitch   yaw     posX    posY    posZ    rest  pulled  headClear  bodyGap');

const results = [];
for (const scale of [0.7, 0.8, 0.9, 1.0]) {
  for (const pitch of [0, -0.12, -0.25]) {
    for (const yawOff of [-0.26, -0.55, -0.8, -1.05, -1.3]) {
      const yaw = -Math.PI / 2 + yawOff;
      const T = transformAll(scale, pitch, yaw);

      // The legs splay far wider than this little stool, so what rests on
      // the cushion is the body, not the feet. Drop the fly until the lowest
      // BODY vertex is a whisker above the seat and let the legs drape.
      let minBody = Infinity;
      for (let i = 0; i < nv; i++) { if (P[i * 3 + 1] < 0.42) continue; if (T[i * 3 + 1] < minBody) minBody = T[i * 3 + 1]; }
      const posY = SEAT_TOP - minBody + 0.02;

      // slide along X until the foreleg works at the target fraction
      const shoulderRel = point(T, rig.SHOULDER, scale, pitch, yaw);
      const knob = knobAt(0);
      const R = rig.REACH * scale;
      const want = TARGET_REACH * R;
      // solve |knob - (pos + shoulderRel)| = want for posX, with posZ fixed on the seat
      const posZ = STOOL.seatCenter[2] + 0.02;
      const dy = knob[1] - (posY + shoulderRel[1]);
      const dz = knob[2] - (posZ + shoulderRel[2]);
      const rem = want * want - dy * dy - dz * dz;
      if (rem <= 0) continue;
      const posX = knob[0] + Math.sqrt(rem) - shoulderRel[0];

      const pos = [posX, posY, posZ];
      const at = (p) => { const q = point(T, p, scale, pitch, yaw); return [pos[0] + q[0], pos[1] + q[1], pos[2] + q[2]]; };
      const shoulder = at(rig.SHOULDER);
      const rest = dist(shoulder, knob) / R;
      const pulled = dist(shoulder, knobAt(LEVER_PULLED)) / R;

      // worst intrusion of any vertex into the cabinet silhouette
      // Only the head is required to clear the cabinet: a leg resting against
      // the machine is fine, a face through the glass is not.
      let headClear = Infinity;
      for (let i = 0; i < nv; i += 3) {
        if (P[i * 3 + 2] < 0.5 || P[i * 3 + 1] < 0.55) continue;   // head region in model space
        const wx = pos[0] + T[i * 3], wy = pos[1] + T[i * 3 + 1], wz = pos[2] + T[i * 3 + 2];
        if (Math.abs(wz) > 0.4) continue;
        const clear = wx - cabinetFrontAt(wy);
        if (clear < headClear) headClear = clear;
      }

      // how far the body sits above the seat, ignoring the legs:
      // the lowest vertex within the seat disc that belongs to the body
      let bodyGap = Infinity;
      for (let i = 0; i < nv; i += 3) {
        if (P[i * 3 + 1] < 0.42) continue;        // legs live below this in model space
        const wy = pos[1] + T[i * 3 + 1];
        const wx = pos[0] + T[i * 3], wz = pos[2] + T[i * 3 + 2];
        if (Math.hypot(wx - STOOL.seatCenter[0], wz - STOOL.seatCenter[2]) > STOOL.seatRadius * 1.3) continue;
        if (wy - SEAT_TOP < bodyGap) bodyGap = wy - SEAT_TOP;
      }

      const row = { scale, pitch, yaw, pos, rest, pulled, headClear, bodyGap };
      results.push(row);
      console.log(
        `${scale.toFixed(2)}  ${pitch.toFixed(2)}  ${yawOff.toFixed(2)}  ` +
        `${pos.map(n => n.toFixed(3).padStart(6)).join(' ')}  ` +
        `${(100 * rest).toFixed(0).padStart(3)}%  ${(100 * pulled).toFixed(0).padStart(4)}%  ` +
        `${headClear.toFixed(3).padStart(8)}  ${Number.isFinite(bodyGap) ? bodyGap.toFixed(3) : '  n/a'}`);
    }
  }
}

const good = results
  .filter((r) => r.headClear > 0.03)
  .sort((a, b) => Math.abs(a.bodyGap - 0.06) - Math.abs(b.bodyGap - 0.06));

console.log('\nbest fit (body closest to resting on the cushion, head clear of the cabinet):');
const b = good[0] || results[0];
if (!b) { console.log('  none'); process.exit(1); }
console.log(`  scale ${b.scale}  pitch ${b.pitch}  yaw ${b.yaw.toFixed(4)}  headClear ${b.headClear.toFixed(3)}  bodyGap ${b.bodyGap.toFixed(3)}`);
console.log('\npaste into src/scene/layout.js:');
console.log('export const FLY = {');
console.log(`  position: [${b.pos.map(n => n.toFixed(4)).join(', ')}],`);
console.log(`  rotationY: ${b.yaw.toFixed(4)},`);
console.log(`  pitch: ${b.pitch},`);
console.log(`  scale: ${b.scale},`);
console.log('};');
void PARTS;
