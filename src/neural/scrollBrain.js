/**
 * Two brains, one feed.
 *
 * Each fly gets its own rate model over the same measured MaleCNS wiring —
 * two networks running side by side, two mushroom bodies learning separately.
 * What each reel does to a brain goes in through the pathway a fly would
 * really use for it:
 *
 *   rotting fruit        -> olfactory receptor neurons, and taste
 *   sugar                -> the gustatory neurons
 *   courtship song       -> Johnston's organ: JO-A and JO-B, the antennal
 *                           neurons tuned to near-field sound
 *   moving stripes,      -> the elementary motion detectors, T4 and T5,
 *   a swarm                 all four directions
 *   a bug zapper         -> bright flickering light on the visual system
 *   a TikTok edit        -> her music into JO-A/B, and reward that grows
 *                           with the fly's love for her
 *   spider, swatter,     -> the looming detectors LPLC2 and LC4, which
 *   vinegar trap, wasp,     converge on the giant fibre DNp01, and PPL1
 *   the zapper coming in
 *
 * plus the screen's own light on the whole visual system, the buzz of an
 * incoming message on the mechanosensory neurons, and dopamine for a reel
 * that is better than reels usually are — a reward prediction error — and
 * for anything that comes from the other fly.
 *
 * BRAIN SYNC is inter-subject correlation, the measure hyperscanning studies
 * use between people watching the same film: for each of a dozen populations
 * — the senses the reels reach, the dopamine clusters, the central complex,
 * the mushroom body — the time course of its activity over the last six
 * seconds is correlated between the two brains, and the correlations are
 * averaged. Two flies on different reels drift apart; a sent reel, watched
 * together, pulls them into step.
 * It is the in-silico version of what hyperscanning studies measure between
 * people watching the same thing.
 */
import { ConnectomeSim } from './simulation.js';
import { MushroomBodyMemory } from './memory.js';
import { PHASES } from '../game/scroll.js';

/** Brain sync: samples a second, and how many make the window. */
const SYNC_HZ = 5;
const SYNC_WINDOW = 30;

const indices = (meta, test) => meta.names.map((n, i) => [n, i]).filter(([n, i]) => test(n, i)).map(([, i]) => i);

class FlyBrain {
  constructor(graph, meta, sensors) {
    this.P = meta.populations;
    this.S = sensors;
    this.sim = new ConnectomeSim(graph);
    for (let i = 0; i < 12; i++) this.sim.step(0.25);
    this.rest = this.sim.rate.slice();
    this.restReward = this.sim.mean(this.P.reward);
    this.restPunish = this.sim.mean(this.P.punish);
    this.restEscape = this.sim.mean(sensors.escape);
    this.memory = new MushroomBodyMemory(this.sim, graph, this.P, meta.names, this.rest);
  }

  get rate() { return this.sim.rate; }

  step(f, dt) {
    const { sim, P, S } = this;
    sim.clearInput();
    const awake = 1 - f.collapse * 0.85;
    const on = f.screenOn ? 1 : 0;

    // the screen: light, and what is on it
    sim.drive(P.visual, (0.05 + on * 0.06) * awake);
    if (on) {
      const kind = f.reel.cat;
      if (kind === 'fruit') { sim.drive(S.smell, 0.35); sim.drive(P.gustatory, 0.12); }
      if (kind === 'courtship') sim.drive(S.hearing, 0.45);
      if (kind === 'stripes') sim.drive(S.motion, 0.3 + 0.15 * Math.sin(f.reelT * 6));
      if (kind === 'sugar') sim.drive(P.gustatory, 0.4);
      if (kind === 'swarm') sim.drive(S.motion, 0.22 + 0.1 * Math.sin(f.reelT * 3));
      // the zapper's UV: a bright, flickering light on the whole visual system
      if (kind === 'zapper') sim.drive(P.visual, 0.08 + 0.06 * Math.abs(Math.sin(f.reelT * 9)));
      // a TikTok edit: her music through Johnston's organ, a face on screen,
      // and a pull of reward that grows as the fly falls for her
      if (kind === 'fan') {
        sim.drive(S.hearing, 0.35);
        sim.drive(P.visual, 0.05);
        sim.drive(P.reward, f.love * 0.08);
      }
      sim.drive(S.loom, f.loom * 1.1);
      sim.drive(P.punish, f.loom * 0.35);
    }

    // the standing state
    sim.drive(P.centralComplex, (0.04 + f.deliberation * 0.05) * awake);
    sim.drive(P.mushroomBody, (0.004 + on * 0.01) * awake);
    sim.drive(P.descending, (0.03 + f.arousal * 0.08) * awake);
    sim.drive(P.punish, f.fear * 0.1 * awake);

    // the foreleg on the glass, the phone buzzing
    sim.drive(P.mechanosensory, f.grip * 0.25 + f.swipe * 0.2 + f.buzz * 0.5);

    // value: a better-than-usual reel, a friend's reel, a reply
    sim.drive(P.reward, (f.valuePulse * 0.35 + f.socialPulse * 0.55 + f.rewardPulse * 0.5) * awake);
    sim.drive(P.punish, f.punishPulse * 0.5);

    sim.step(dt);
    this.memory.update(dt);
    f.setNeuralReadout(sim.mean(P.reward), sim.mean(P.punish));
    f.setEscape(Math.max(0, sim.mean(S.escape) - this.restEscape) / 0.4);
    f.setMemory(this.memory.value, this.memory.learned);
  }
}

export class DuoBrain {
  constructor(graph, meta) {
    const sensors = {
      smell: indices(meta, (n, i) => meta.classes[i] === 'olfactory'),
      hearing: indices(meta, (n) => /^JO-(A|B)/.test(n)),
      motion: indices(meta, (n) => /^T[45][abcd]$/.test(n)),
      loom: indices(meta, (n) => n === 'LPLC2' || n === 'LC4'),
      escape: indices(meta, (n) => n === 'DNp01'),
    };
    this.sensors = sensors;
    this.brains = [new FlyBrain(graph, meta, sensors), new FlyBrain(graph, meta, sensors)];
    this.sync = 0;
    this.syncClock = 0;
    const P = meta.populations;
    /** The regions compared for brain sync. */
    this.regions = [
      sensors.smell, sensors.hearing, sensors.motion, sensors.loom, P.visual, P.gustatory,
      P.mechanosensory, P.reward, P.punish, P.centralComplex, P.mushroomBody, P.mushroomOut, P.descending,
    ].filter((r) => r.length);
    /** Per brain, per region: the last SYNC_WINDOW samples. */
    this.series = this.brains.map(() => this.regions.map(() => []));
    /** The one the default connectome scope shows. */
    this.sim = this.brains[0].sim;
    this.rest = this.brains[0].rest;
    this.memory = this.brains[0].memory;
  }

  get rate() { return this.brains[0].sim.rate; }

  attach(duo) {
    duo.flies.forEach((f, i) => f.setNeuralRest(this.brains[i].restReward, this.brains[i].restPunish));
  }

  step(duo, dt) {
    if (duo.morning) return;
    duo.flies.forEach((f, i) => this.brains[i].step(f, dt));
    this.syncClock += dt;
    if (this.syncClock >= 1 / SYNC_HZ) {
      this.syncClock = 0;
      this.brains.forEach((b, i) => this.regions.forEach((reg, k) => {
        const s = this.series[i][k];
        s.push(b.sim.mean(reg));
        if (s.length > SYNC_WINDOW) s.shift();
      }));
      const r = this.correlate();
      // both asleep, both screens dark: the question does not apply
      const target = duo.flies.some((f) => f.phase !== PHASES.ASLEEP) ? r : this.sync;
      this.sync += (target - this.sync) * 0.35;
      duo.sync = this.sync;
    }
  }

  /**
   * Inter-subject correlation: per region, the Pearson correlation of the two
   * time courses over the window; then the mean over the regions that moved.
   */
  correlate() {
    const [A, B] = this.series;
    let sum = 0, n = 0;
    for (let k = 0; k < this.regions.length; k++) {
      const a = A[k], b = B[k];
      const len = Math.min(a.length, b.length);
      if (len < 8) continue;
      let ma = 0, mb = 0;
      for (let i = 0; i < len; i++) { ma += a[i]; mb += b[i]; }
      ma /= len; mb /= len;
      let cov = 0, va = 0, vb = 0;
      for (let i = 0; i < len; i++) {
        const x = a[i] - ma, y = b[i] - mb;
        cov += x * y; va += x * x; vb += y * y;
      }
      // a region that did not move in either brain says nothing either way
      if (va < 1e-10 || vb < 1e-10) continue;
      sum += cov / Math.sqrt(va * vb);
      n += 1;
    }
    return n ? sum / n : 0;
  }
}
