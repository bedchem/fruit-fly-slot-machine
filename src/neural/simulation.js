/**
 * A rate model run over the measured MaleCNS v1.0 connectivity.
 *
 * This is the part that is actually simulated rather than scripted. The state
 * is one firing rate per cell type; every tick each type integrates the summed
 * input from the types that really synapse onto it, with the sign of the
 * presynaptic transmitter, and relaxes towards it:
 *
 *     drive_i = GAIN * sum_j W_ij r_j  +  I_i
 *     r_i    += (phi(drive_i) - r_i) * dt / TAU
 *
 * W comes from tools/build-graph.mjs: summed synapse counts per postsynaptic
 * cell, signed by the predicted transmitter. Nothing about which region lights
 * up is written down anywhere — the only thing the game injects is current into
 * the real sensory populations, and where that current spreads is whatever the
 * wiring does with it.
 *
 * What is NOT claimed: this is a rate model, not a spiking one, run on a
 * type-collapsed graph, and no one has recorded a fly playing a slot machine.
 * The anatomy is measured; the dynamics on top of it are a model.
 */

/**
 * Global synaptic gain, chosen with tools/tune-sim.mjs. The sweep there shows
 * the network going critical at 1.0 — every type pins at once — so it is run
 * just below, where current injected into one population still travels several
 * synapses before it dies out.
 */
const GAIN = 0.8;
/** Membrane/rate time constant, seconds. */
const TAU = 0.055;
/** Tonic background so a resting network is not silent. */
const BASELINE = 0.035;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Saturating transfer: rates cannot go negative or run away. */
const phi = (x) => (x <= 0 ? 0 : x < 1 ? x : 1 + Math.log(x)) / (1 + 0.35 * Math.max(0, x - 1));

/**
 * Scales each type's inbound weights so they sum to one.
 *
 * Raw synapse counts span two orders of magnitude between populations — an
 * MBON collects thousands of synapses per cell, a gustatory receptor tens — so
 * a single gain cannot suit both, and a signal dies before it crosses the
 * three hops from sugar to the PAM cluster. Normalising per cell keeps the
 * RELATIVE weights of each type's inputs, which is the part the connectome
 * measured, while putting every type on the same footing.
 */
function normalizeRows(graph) {
  const { K, offsets, indices, weights } = graph;
  void indices;
  const out = new Float32Array(weights.length);
  for (let i = 0; i < K; i++) {
    let total = 0;
    for (let p = offsets[i]; p < offsets[i + 1]; p++) total += Math.abs(weights[p]);
    const inv = total > 0 ? 1 / total : 0;
    for (let p = offsets[i]; p < offsets[i + 1]; p++) out[p] = weights[p] * inv;
  }
  return out;
}

export class ConnectomeSim {
  /**
   * @param {{K:number, offsets:Uint32Array, indices:Uint16Array, weights:Float32Array}} graph
   */
  constructor(graph, opts = {}) {
    this.gain = opts.gain ?? GAIN;
    this.tau = opts.tau ?? TAU;
    this.baseline = opts.baseline ?? BASELINE;
    this.K = graph.K;
    this.offsets = graph.offsets;
    this.indices = graph.indices;
    this.weights = opts.normalize === false ? graph.weights : normalizeRows(graph);
    this.rate = new Float32Array(this.K).fill(this.baseline);
    this.input = new Float32Array(this.K);
    this.next = new Float32Array(this.K);
    this.acc = 0;
  }

  /** Clears the injected current. Call before setting this tick's drive. */
  clearInput() { this.input.fill(0); }

  /** Injects current into every type in a population. */
  drive(population, amount) {
    if (!amount) return;
    for (let i = 0; i < population.length; i++) this.input[population[i]] += amount;
  }

  /** Mean rate across a population — how the readouts are taken. */
  mean(population) {
    if (!population.length) return 0;
    let s = 0;
    for (let i = 0; i < population.length; i++) s += this.rate[population[i]];
    return s / population.length;
  }

  /**
   * Advances the network. Steps at a fixed 200 Hz regardless of frame rate, so
   * the dynamics do not change with the display.
   */
  step(dt) {
    const H = 1 / 200;
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= H) { this.acc -= H; this.tick(H); }
  }

  tick(h) {
    const { K, offsets, indices, weights, rate, input, next } = this;
    const k = h / this.tau;
    for (let i = 0; i < K; i++) {
      let sum = 0;
      const end = offsets[i + 1];
      for (let p = offsets[i]; p < end; p++) sum += weights[p] * rate[indices[p]];
      const drive = sum * this.gain + input[i] + this.baseline;
      next[i] = rate[i] + (phi(drive) - rate[i]) * k;
    }
    for (let i = 0; i < K; i++) rate[i] = clamp01(next[i]);
  }
}

/** Parses the CSR blob written by tools/build-graph.mjs. */
export function parseGraph(buffer) {
  const dv = new DataView(buffer);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'CNSG') throw new Error('not a connectome graph: ' + magic);
  const K = dv.getUint32(4, true);
  const nnz = dv.getUint32(8, true);
  let o = 12;
  const offsets = new Uint32Array(buffer.slice(o, o + (K + 1) * 4)); o += (K + 1) * 4;
  const indices = new Uint16Array(buffer.slice(o, o + nnz * 2)); o += nnz * 2;
  const weights = new Float32Array(buffer.slice(o, o + nnz * 4));
  return { K, nnz, offsets, indices, weights };
}

/** Parses the neuron cloud written by tools/build-connectome.mjs. */
export function parseNeurons(buffer) {
  const dv = new DataView(buffer);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'CNS1') throw new Error('not a neuron cloud: ' + magic);
  const count = dv.getUint32(4, true);
  const groups = dv.getUint32(8, true);
  const types = dv.getUint32(12, true);
  let o = 16;
  const pos = new Uint16Array(buffer.slice(o, o + count * 6)); o += count * 6;
  const group = new Uint8Array(buffer.slice(o, o + count)); o += count;
  const type = new Int32Array(buffer.slice(o, o + count * 4));
  return { count, groups, types, pos, group, type };
}
