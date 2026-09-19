/**
 * The connectome scope.
 *
 * Every dot is one real neuron, drawn at its measured soma coordinate from
 * MaleCNS v1.0. Its brightness is the simulated firing rate of that neuron's
 * cell type, from the rate model in simulation.js running on the measured
 * wiring — so when a region lights up, it is lighting up because current
 * actually reached it through the connectome, not because something here said
 * it should.
 *
 * Points are accumulated into a float buffer and tone-mapped once per frame:
 * 60 000 canvas paths would not fit in a frame, 60 000 buffer writes do.
 */
import { useEffect, useRef } from 'react';
import graphMeta from './cnsGraph.js';
import cnsMeta from './cnsMeta.js';

/**
 * Colour by functional group — the same convention connectome renders use:
 * the optic lobes cool, the central brain warm, the nerve cord neutral.
 */
const GROUP_HUE = {
  optic: [72, 208, 255],
  central_brain: [255, 168, 68],
  mushroom_body: [255, 196, 96],
  mushroom_out: [255, 150, 90],
  central_complex: [255, 214, 120],
  dopaminergic: [255, 176, 60],
  olfactory: [186, 232, 140],
  gustatory: [140, 255, 190],
  mechanosensory: [200, 200, 240],
  descending: [190, 226, 255],
  ascending: [170, 210, 245],
  motor: [225, 235, 255],
  nerve_cord: [214, 226, 240],
  other: [170, 186, 205],
};

/** Rendered even when quiet, so the anatomy is always there. */
const BASELINE = 0.36;
const REST_RATE = 0.06;
/** How far above its own resting rate a type has to be to count as firing. */
const FIRING = 0.04;
/** Brightness per unit of rate above rest. */
const ACT_GAIN = 3.4;
const TINT = 0.85;
const SPLAT = [[1, 0], [0, 1], [1, 1]];
/** How far the cloud sways either side, radians. */
const MAX_YAW = 0.38;

export function Connectome({ machineRef, store, ready, height = 300 }) {
  const canvasRef = useRef(null);
  const headRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return undefined;
    const { neurons, sim } = store.current;
    if (!neurons || !sim) return undefined;
    // each type's own resting rate, from the settled network: "firing" means
    // above that, not above some fixed line most types never reach
    const rest = store.current.rest ?? new Float32Array(sim.K).fill(REST_RATE);

    // per-neuron colour and the type index it reads its rate from
    const n = neurons.count;
    const hue = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const g = cnsMeta.groups[neurons.group[i]] || 'other';
      const c = GROUP_HUE[g] || GROUP_HUE.other;
      hue[i * 3] = c[0]; hue[i * 3 + 1] = c[1]; hue[i * 3 + 2] = c[2];
    }
    // cnsMeta type indices and graph type indices are different tables, so map
    // one to the other by name once, here, rather than every frame
    const graphIndexOf = new Map(graphMeta.names.map((nm, i) => [nm, i]));
    const typeToGraph = new Int32Array(cnsMeta.types.length).fill(-1);
    cnsMeta.types.forEach((nm, i) => {
      const gi = graphIndexOf.get(nm);
      if (gi !== undefined) typeToGraph[i] = gi;
    });
    const rateIndex = new Int32Array(n);
    // how many drawn neurons each simulated type stands for, so the readout
    // can count neurons firing rather than types
    const perType = new Int32Array(graphMeta.types);
    let simulated = 0;
    for (let i = 0; i < n; i++) {
      const t = neurons.type[i];
      const gi = t >= 0 ? typeToGraph[t] : -1;
      rateIndex[i] = gi;
      if (gi >= 0) { simulated++; perType[gi]++; }
    }
    if (import.meta.env.DEV) {
      console.info(`[connectome] ${simulated.toLocaleString()} of ${n.toLocaleString()} drawn neurons `
        + `belong to a simulated cell type (${(100 * simulated / n).toFixed(0)}%)`);
    }
    // measure the cloud once so the framing fits whatever the data is
    let bx0 = 1, bx1 = 0, by0 = 1, by1 = 0, bz0 = 1, bz1 = 0;
    for (let i = 0; i < n; i++) {
      const X = neurons.pos[i * 3] / 65535, Y = neurons.pos[i * 3 + 1] / 65535, Z = neurons.pos[i * 3 + 2] / 65535;
      if (X < bx0) bx0 = X; if (X > bx1) bx1 = X;
      if (Y < by0) by0 = Y; if (Y > by1) by1 = Y;
      if (Z < bz0) bz0 = Z; if (Z > bz1) bz1 = Z;
    }
    // the cloud's own centre: it turns about this, so it stays put on screen
    const midX = (bx0 + bx1) / 2 - 0.5, midY = (by0 + by1) / 2 - 0.5, midZ = (bz0 + bz1) / 2 - 0.5;
    // The widest and tallest the outline ever gets on screen over the whole
    // sway, perspective included — measured once, so the fit is exact rather
    // than a worst-case guess that leaves the brain small.
    let fitW = 0, fitH = 0;
    for (let k = 0; k <= 8; k++) {
      const yaw = -MAX_YAW + (2 * MAX_YAW * k) / 8;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const X = neurons.pos[i * 3] / 65535 - 0.5 - midX;
        const Y = neurons.pos[i * 3 + 1] / 65535 - 0.5 - midY;
        const Z = neurons.pos[i * 3 + 2] / 65535 - 0.5 - midZ;
        const d = 1 / (1 + (-X * s + Z * c) * 0.5);
        const px = (X * c + Z * s) * d, py = Y * d;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
      fitW = Math.max(fitW, x1 - x0);
      fitH = Math.max(fitH, y1 - y0);
    }

    // a fixed per-neuron speckle so the cloud has grain
    const jitter = new Float32Array(n);
    for (let i = 0; i < n; i++) jitter[i] = 0.6 + ((i * 2654435761) % 1000) / 2500;

    const ctx = canvas.getContext('2d', { alpha: false });
    let raf = 0;
    let accum = null, image = null;
    let W = 0, H = 0, spin = 0, tick = 0;
    let shiftX = 0, shiftY = 0;
    let last = performance.now();

    const resize = () => {
      const w = Math.max(80, Math.round(canvas.clientWidth));
      const h = Math.max(80, Math.round(canvas.clientHeight));
      if (w === W && h === H) return;
      W = w; H = h; canvas.width = W; canvas.height = H;
      accum = new Float32Array(W * H * 3);
      image = ctx.createImageData(W, H);
    };

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick += dt;
      resize();

      const rate = sim.rate;
      spin += dt * 0.18;
      const yaw = Math.sin(spin * 0.55) * MAX_YAW;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);

      // fit the widest rotated extent, so nothing clips at any point of the sway
      const scale = Math.min(W / (fitW * 1.06), H / (fitH * 1.06));
      // centre on what is actually on screen: the brain is not symmetric, so
      // its outline shifts as it turns. Measured while drawing, applied on the
      // next frame — the sway is slow enough that one frame of lag never shows.
      const ox = W / 2 + shiftX;
      const oy = H / 2 + shiftY;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;

      accum.fill(0);
      const pos = neurons.pos;
      for (let i = 0; i < n; i++) {
        // decode the quantised soma coordinate, relative to the cloud's centre
        const X = pos[i * 3] / 65535 - 0.5 - midX;
        const Y = pos[i * 3 + 1] / 65535 - 0.5 - midY;
        const Z = pos[i * 3 + 2] / 65535 - 0.5 - midZ;
        const rx = X * cy + Z * sy;
        const rz = -X * sy + Z * cy;
        const depth = 1 / (1 + rz * 0.5);
        const px = rx * scale * depth;
        const py = -Y * scale * depth;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        const sx = (ox + px) | 0;
        const sy2 = (oy + py) | 0;
        if (sx < 0 || sx >= W || sy2 < 0 || sy2 >= H) continue;

        const gi = rateIndex[i];
        const lift = gi >= 0 ? rate[gi] - rest[gi] : 0;
        const j = jitter[i] * depth;
        const base = j * BASELINE;
        const act = Math.max(0, lift) * j * ACT_GAIN;

        const hr = hue[i * 3], hg = hue[i * 3 + 1], hb = hue[i * 3 + 2];
        let cr = (120 + (hr - 120) * TINT) * base + hr * act;
        let cg = (140 + (hg - 140) * TINT) * base + hg * act;
        let cb = (168 + (hb - 168) * TINT) * base + hb * act;

        const o = (sy2 * W + sx) * 3;
        accum[o] += cr; accum[o + 1] += cg; accum[o + 2] += cb;
        if (act > 0.55) {
          // a strongly firing cell gets a little bloom of its own
          cr *= 0.65; cg *= 0.65; cb *= 0.65;
          for (let k = 0; k < SPLAT.length; k++) {
            const nx = sx + SPLAT[k][0], ny = sy2 + SPLAT[k][1];
            if (nx >= W || ny >= H) continue;
            const q = (ny * W + nx) * 3;
            accum[q] += cr; accum[q + 1] += cg; accum[q + 2] += cb;
          }
        }
      }
      shiftX = -(x0 + x1) / 2;
      shiftY = -(y0 + y1) / 2;

      const data = image.data;
      for (let i = 0, p = 0; i < accum.length; i += 3, p += 4) {
        data[p] = 255 - 255 / (1 + accum[i] * 0.020);
        data[p + 1] = 255 - 255 / (1 + accum[i + 1] * 0.020);
        data[p + 2] = 255 - 255 / (1 + accum[i + 2] * 0.020);
        data[p + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);

      if (headRef.current) {
        let hot = 0;
        for (let i = 0; i < rate.length; i++) if (rate[i] - rest[i] > FIRING) hot += perType[i];
        headRef.current.textContent =
          `${(1 / Math.max(dt, 1e-3)).toFixed(0)} FPS · LIF 200 HZ · ${hot.toLocaleString()} NEURONS FIRING`;
      }
      void tick;
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, store, machineRef]);

  return (
    <div className="scope">
      <div className="scope-bar">
        <span className="scope-title">Drosophila connectome</span>
        <span className="scope-rate" ref={headRef}>loading…</span>
      </div>
      <canvas
        ref={canvasRef}
        className="scope-canvas tip"
        style={{ height }}
        data-tip="Every dot is one real neuron at its measured soma coordinate. Brightness is the simulated firing rate of that cell type, from a rate model running on the measured wiring — so a region lights up because current actually reached it."
        aria-label="Simulated neural activity"
      />
      <div className="scope-foot tip" data-tip={`${cnsMeta.neuronsDrawn.toLocaleString()} of the ${cnsMeta.neuronsTotal.toLocaleString()} real neurons are drawn. The model runs on the signed connections between their cell types, collapsed from 151.9 million measured synapses.`}>
        <b>{cnsMeta.neuronsDrawn.toLocaleString()}</b> neurons ·{' '}
        <b>{graphMeta.edges.toLocaleString()}</b> connections · <b>151.9 M</b> synapses
      </div>
    </div>
  );
}
