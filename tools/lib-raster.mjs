/**
 * A dependency-free software rasteriser used to compose and check the scene
 * offline, before any of it is wired into React. It is how the fly's pose,
 * the lever geometry and the camera framing in src/scene/layout.js were
 * settled — cheaper to iterate on than a browser reload.
 */
import zlib from 'zlib';
import fs from 'fs';
import { loadGLB, readAccessor, walk, xfP, xfV, mul } from './lib-glb.mjs';

let CRC = null;
function crc32(buf) {
  if (!CRC) { CRC = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function writePNG(file, W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const idat = zlib.deflateSync(raw, { level: 6 });
  const chunks = [];
  const push = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(td) >>> 0);
    chunks.push(len, td, cb);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  push('IHDR', ihdr); push('IDAT', idat); push('IEND', Buffer.alloc(0));
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]));
}

/** Flattens a GLB into world-space positions, normals and a triangle list. */
export function loadMesh(path, opts = {}) {
  const { json, bin } = loadGLB(path);
  const override = opts.nodeTransform;
  const P = [], N = [], tris = [];
  walk(json, (ni, node, m) => {
    if (override) { const extra = override(node.name); if (extra) m = mul(m, extra); }
    for (const prim of json.meshes[node.mesh].primitives) {
      const pos = readAccessor(json, bin, prim.attributes.POSITION);
      const nrm = prim.attributes.NORMAL !== undefined ? readAccessor(json, bin, prim.attributes.NORMAL) : null;
      const idx = prim.indices !== undefined ? readAccessor(json, bin, prim.indices) : null;
      const base = P.length / 3;
      for (let i = 0; i < pos.count; i++) {
        const w = xfP(m, [pos.data[i * 3], pos.data[i * 3 + 1], pos.data[i * 3 + 2]]);
        P.push(w[0], w[1], w[2]);
        if (nrm) { const wn = xfV(m, [nrm.data[i * 3], nrm.data[i * 3 + 1], nrm.data[i * 3 + 2]]); N.push(wn[0], wn[1], wn[2]); }
        else N.push(0, 1, 0);
      }
      if (idx) for (let i = 0; i < idx.count; i += 3) tris.push(base + idx.data[i], base + idx.data[i + 1], base + idx.data[i + 2]);
      else for (let i = 0; i < pos.count; i += 3) tris.push(base + i, base + i + 1, base + i + 2);
    }
  });
  return { P: new Float64Array(P), N: new Float64Array(N), tris: new Uint32Array(tris), json };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Perspective render of one or more meshes.
 * meshes: [{ P, N, tris, color:[r,g,b] | fn(x,y,z) }]
 */
export function renderScene({ meshes, out, W = 900, H = 640, eye, target, fov = 32, bg = [244, 238, 228], ground = null, light = [0.45, 0.8, 0.35] }) {
  const fwd = nrm(sub(target, eye));
  const right = nrm(crs(fwd, [0, 1, 0]));
  const up = crs(right, fwd);
  const f = 1 / Math.tan((fov * Math.PI / 180) / 2);
  const aspect = W / H;

  const zbuf = new Float32Array(W * H).fill(Infinity);
  const img = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { img[i * 3] = bg[0]; img[i * 3 + 1] = bg[1]; img[i * 3 + 2] = bg[2]; }

  const L = nrm(light);

  const project = (p) => {
    const d = sub(p, eye);
    const z = dt(d, fwd);
    if (z <= 1e-4) return null;
    return [W / 2 + (dt(d, right) * f / aspect) / z * (W / 2), H / 2 - (dt(d, up) * f) / z * (H / 2), z];
  };

  // simple ground plane, drawn first so geometry z-tests against it
  if (ground !== null) {
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const ndx = ((px + 0.5) - W / 2) / (W / 2) * aspect / f;
      const ndy = -((py + 0.5) - H / 2) / (H / 2) / f;
      const dir = [fwd[0] + right[0] * ndx + up[0] * ndy, fwd[1] + right[1] * ndx + up[1] * ndy, fwd[2] + right[2] * ndx + up[2] * ndy];
      if (Math.abs(dir[1]) < 1e-6) continue;
      const t = (ground - eye[1]) / dir[1];
      if (t <= 0) continue;
      const hit = [eye[0] + dir[0] * t, ground, eye[2] + dir[2] * t];
      const z = dt(sub(hit, eye), fwd);
      if (z <= 0 || z >= zbuf[py * W + px]) continue;
      const fade = Math.max(0, 1 - Math.hypot(hit[0], hit[2]) / 9);
      const o = py * W + px;
      zbuf[o] = z;
      img[o * 3] = bg[0] * (0.82 + 0.18 * fade);
      img[o * 3 + 1] = bg[1] * (0.80 + 0.18 * fade);
      img[o * 3 + 2] = bg[2] * (0.76 + 0.18 * fade);
    }
  }

  for (const mesh of meshes) {
    const { P, N, tris } = mesh;
    const nv = P.length / 3;
    const sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const s = project([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      if (!s) { sz[i] = -1; continue; }
      sx[i] = s[0]; sy[i] = s[1]; sz[i] = s[2];
    }
    const colOf = typeof mesh.color === 'function' ? mesh.color : () => (mesh.color || [210, 200, 186]);
    for (let t = 0; t < tris.length; t += 3) {
      const i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
      if (sz[i0] < 0 || sz[i1] < 0 || sz[i2] < 0) continue;
      const x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
      const a0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), a1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const b0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), b1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      if (a0 > a1 || b0 > b1) continue;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      for (let py = b0; py <= b1; py++) for (let px = a0; px <= a1; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area;
        const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * sz[i0] + w1 * sz[i1] + w2 * sz[i2];
        const o = py * W + px;
        if (z >= zbuf[o]) continue;
        zbuf[o] = z;
        let nx = w0 * N[i0 * 3] + w1 * N[i1 * 3] + w2 * N[i2 * 3];
        let ny = w0 * N[i0 * 3 + 1] + w1 * N[i1 * 3 + 1] + w2 * N[i2 * 3 + 1];
        let nz = w0 * N[i0 * 3 + 2] + w1 * N[i1 * 3 + 2] + w2 * N[i2 * 3 + 2];
        const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln;
        const diff = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
        const sh = 0.26 + 0.74 * diff;
        const wx = w0 * P[i0 * 3] + w1 * P[i1 * 3] + w2 * P[i2 * 3];
        const wy = w0 * P[i0 * 3 + 1] + w1 * P[i1 * 3 + 1] + w2 * P[i2 * 3 + 1];
        const wz = w0 * P[i0 * 3 + 2] + w1 * P[i1 * 3 + 2] + w2 * P[i2 * 3 + 2];
        const c = colOf(wx, wy, wz);
        img[o * 3] = Math.min(255, c[0] * sh);
        img[o * 3 + 1] = Math.min(255, c[1] * sh);
        img[o * 3 + 2] = Math.min(255, c[2] * sh);
      }
    }
  }
  if (out) writePNG(out, W, H, img);
  return img;
}
