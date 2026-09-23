/**
 * The fly's evening, as one deterministic state machine.
 *
 * Nothing here touches React or three.js. The scene reads the continuous
 * values every frame (how far the proboscis is out, where the foreleg is
 * going, how far the fly has slumped), the UI subscribes to the discrete
 * parts, and tools/sim-session.mjs runs the very same class headless.
 *
 * The visitor decides nothing. Every sip, every pouch, how many and how
 * strong, and when to stop, falls out of the fly's own state at the moment it
 * commits — and that state is partly its simulated brain (dopamine, the
 * defensive state, what its mushroom body has learned) and partly the two
 * drugs in its body, which act back on that brain (neural/pharmacology.js).
 */
import { TIN_GRIP, GLASS_GRIP, DRINK_GLASS_GRIP, MOUTH, LIP_OFFSET } from '../scene/barLayout.js';

export const PHASES = {
  IDLE: 'idle',
  /** Glass lifted and the fly drinking at the rim. */
  SIPPING: 'sipping',
  /** Foreleg to the tin, a pouch to the mouth, foreleg back. */
  POUCH: 'pouch',
  /** Ethanol sedation: the loss of righting a fly shows in an inebriometer. */
  PASSED_OUT: 'passed-out',
  /** Ordinary sleep, on the stool. It is that kind of bar. */
  ASLEEP: 'asleep',
  /** Nicotine poisoning. Nicotine is an insecticide; this is why. */
  SEIZURE: 'seizure',
};

// ------------------------------------------------------------------- time
/**
 * Game minutes per real second, by what the fly is doing. The evening runs
 * slow enough to watch; the day, which is mostly a hangover, runs faster.
 */
const MINUTES_PER_SECOND = { evening: 1.5, day: 4.5, asleep: 16, knocked: 5 };
/** The evening starts at seven. */
const START_MINUTE = 19 * 60;

// ---------------------------------------------------------------- ethanol
/**
 * The model runs in mM of body ethanol, which is how fly work reports it
 * (whole-body homogenate), and every threshold below is set in it. The panel
 * shows Promille (per mille): 21.7 mM is 1 g/L, about 1 ‰.
 *
 * Absorption is first order from the crop; elimination is zero order, the way
 * alcohol dehydrogenase saturates. Tolerance speeds elimination and raises
 * the sedation threshold, the rapid tolerance a single exposure leaves in
 * Drosophila (Scholz et al. 2000, Neuron; the gene it needs is called
 * `hangover` — Scholz et al. 2005, Nature).
 */
export const MM_PER_PERMILLE = 21.7;
const SIP_ETHANOL = 1.25;          // mM of eventual body ethanol per sip
const ABSORB_MIN = 11;             // crop -> body, time constant in minutes
const ELIMINATE = 0.115;           // mM per minute, naive
const SEDATION_MM = 34;            // loss of righting, naive
/** The naive sedation threshold, for the panel. */
export const SEDATION_PERMILLE = SEDATION_MM / MM_PER_PERMILLE;
const SIPS_PER_GLASS = 20;

// --------------------------------------------------------------- nicotine
/**
 * Nicotine in hemolymph, in ng/mL, on a human scale so pouch strengths read
 * as they do on the tin. A fly is far more sensitive than that — nicotine and
 * the neonicotinoids are insecticides because insect nicotinic receptors are
 * the main fast excitatory synapse in the whole CNS. The thresholds below are
 * set for legibility, not measured.
 */
export const POUCH_MG = [3, 6, 11, 16];
const POUCH_RELEASE_MIN = 18;      // release time constant
export const POUCH_WEAR_MIN = 38;  // how long one stays in
const BIOAVAIL = 0.55;
const NG_PER_MG = 3.6;
const NIC_HALF_LIFE = 75;          // minutes
const NIC_JITTER = 26;
const NIC_SEIZURE = 38;

// -------------------------------------------------------------- the state
/**
 * NPF, neuropeptide F: the satisfaction signal. Deprived male flies have less
 * of it and drink markedly more ethanol; ethanol exposure raises it again
 * (Shohat-Ophir et al. 2012, Science). So low NPF pushes it to drink, and
 * drinking tops it up — until the hangover drains it.
 */
const NPF_REST = 0.5;
const NPF_RECOVER_MIN = 240;
/**
 * Hangover. Ethanol is broken down to acetaldehyde, and what makes the morning
 * bad is what the night left behind once the ethanol itself is gone. It is
 * modelled as a load that builds with every mM eliminated and clears over
 * hours, felt only as the body ethanol falls — which is also why drinking
 * again masks it.
 */
const TOXIN_HALF_LIFE = 420;
const HANGOVER_SCALE = 64;
const HEART_REST = 268;
const HEART_MAX = 400;
const HEART_FAINT = 150;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Past 1 and back: a lid on a spring. */
const springOut = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const decay = (halfLife, dtMin) => Math.pow(0.5, dtMin / halfLife);

/** Motion timings, real seconds. */
const T = {
  lean: 0.75, sip: 0.78, unlean: 0.65,
  glassLift: 0.55, glassLower: 0.65, gulp: 1.1,
  reach: 0.9, pinch: 0.42, lift: 1.05, tuck: 1.0, release: 0.9,
  lidShut: 0.16,
  refill: 1.6,
  fit: 3.0,
};

/** Which of the pulls on a decision is winning, in words. */
export function urgeReason(a, kind) {
  if (kind === 'rest') {
    if (a.sleepy > 0.3) return 'too heavy to lift its head';
    if (a.caution > 0.35) return 'hungover — holding off';
    return 'not ready for another drink or pouch';
  }
  if (kind === 'pouch') {
    if (a.craving > 0.35) return 'the nicotine is wearing off — wants another pouch';
    if (a.coUse > 0.18) return 'drunk, and it wants a pouch with it';
    return 'curious about the tin';
  }
  const top = Math.max(a.chase, a.buzz, a.memory, a.relief);
  if (top < 0.12) return 'a slow, steady drink';
  if (top === a.relief) return 'hungover — a drink makes the headache go away';
  if (top === a.buzz) return 'enjoying the buzz — wants it to last';
  if (top === a.memory) return a.memory < 0 ? 'remembers the mornings' : 'remembers how good this felt';
  return 'feeling low — drinking to feel better';
}

export class Bar {
  constructor({ onEvent = () => {}, rng = Math.random, now = () => Date.now() } = {}) {
    this.onEvent = onEvent;
    this.rng = rng;
    this.now = now;

    this.phase = PHASES.IDLE;
    this.t = 0;
    this.minute = START_MINUTE;
    this.day = 1;

    // --- body --------------------------------------------------------------
    this.crop = 0;            // mM of ethanol still to be absorbed
    this.bac = 0;             // mM in the body
    this.peakBac = 0;         // this night
    this.allTimePeak = 0;
    this.toxin = 0;           // what the night leaves behind
    this.tolerance = 0;       // 0..1
    this.pouches = [];        // [{ mg, left, age }]
    this.nicotine = 0;        // ng/mL
    this.dependence = 0;      // 0..1
    this.sleepPressure = 0.25;

    // --- signals (set by the brain once it runs) ---------------------------
    this.dopamine = 0;
    this.octopamine = 0;
    this.startle = 0;
    this.fear = 0;
    this.npf = 0.42;          // it came in a little deprived
    this.memory = 0;
    this.learned = 0;
    this.neural = null;
    this.heartRate = HEART_REST;

    // --- motion ------------------------------------------------------------
    this.lean = 0;            // 0..1 head lowered to the glass
    this.extend = 0;          // 0..1 proboscis out
    this.proboscis = 0;       // visual extension; continuous at contact and release
    this.glassLift = 0;       // 0 on the counter, 1 at the mouth
    this.glassTilt = 0;       // 0 upright, 1 tipped to drink
    this.drinkStyle = 'sips';  // seeded: ordinary sips or one committed gulp
    this.grip = 0;            // 0..1 foreleg blended from rest onto handTarget
    this.handTarget = TIN_GRIP.slice();
    this.pouchInHand = false;
    this.pouchStage = null;
    this.stageK = 0;          // 0..1 through the current pouch stage
    this.tinLid = 0;          // 0 shut .. 1 open (a little past, on the spring)
    this.tingle = 0;          // the hit of a fresh pouch, fading
    this.mouth = MOUTH.slice();  // where the mouthparts are; the scene keeps it live
    this.collapse = 0;        // 0 upright .. 1 slumped
    this.shake = 0;
    this.fill = 1;            // glass level 0..1
    this.refilling = 0;
    this.seizureFit = 0;      // violent twitching while seizing

    // --- the current action -----------------------------------------------
    this.plan = null;         // { kind, sips|mg, why }
    this.sipsTaken = 0;
    this.lastResult = null;
    this.history = [];

    // --- the tab ------------------------------------------------------------
    this.beers = 0;           // glasses started
    this.sips = 0;
    this.pouchCount = 0;
    this.nicotineMg = 0;
    this.passouts = 0;
    this.seizures = 0;
    this.nights = 1;
    this.biggestBout = 0;
    this.hangoverWorst = 0;

    this.idleFor = 0;
    this.nextDecisionAfter = 2.2;
    this.lastNeuralBac = 0;
    this.ethanolRise = 0;     // mM per game minute, while it climbs
    this.nicotineRise = 0;
    this.wokeAt = 0;
    this.lastEvent = null;
  }

  emit(type, detail) { this.lastEvent = { type, at: this.now() }; this.onEvent(type, detail); }

  // ================================================================ derived

  get hour() { return Math.floor(this.minute / 60) % 24; }
  get clock() {
    const m = Math.floor(this.minute) % (24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  /** The bar is busy from six in the evening until it empties out. */
  get evening() { const h = this.hour; return h >= 18 || h < 5; }
  get permille() { return this.bac / MM_PER_PERMILLE; }
  /** The headline meter stays informative after a blackout: show the level
   * that caused the fall until the fly wakes, while the body rail still shows
   * the clearing alcohol level. */
  get meterPermille() {
    return this.down ? Math.max(this.permille, this.peakBac / MM_PER_PERMILLE) : this.permille;
  }
  get sedationAt() { return SEDATION_MM * (1 + this.tolerance * 0.45); }
  /** 0 sober .. 1 at the sedation threshold. */
  get intox() { return clamp01(this.bac / this.sedationAt); }
  /** The early, stimulating part of the curve: flies speed up before they fall. */
  get stim() { return smooth(1.5, 7, this.bac) * (1 - smooth(14, 26, this.bac)); }
  get sedation() { return smooth(this.sedationAt * 0.5, this.sedationAt, this.bac); }
  /** Ataxia: the sway. */
  get sway() { return smooth(9, 30, this.bac); }
  get hangover() {
    const load = clamp01(this.toxin / HANGOVER_SCALE);
    return load * (1 - smooth(1.5, 9, this.bac));
  }
  get nicStim() { return clamp01(this.nicotine / NIC_JITTER); }
  get jitter() { return smooth(NIC_JITTER * 0.8, NIC_SEIZURE, this.nicotine); }
  get craving() { return this.dependence * (1 - smooth(4, 16, this.nicotine)); }
  get busy() { return this.phase !== PHASES.IDLE; }
  get down() { return this.phase === PHASES.PASSED_OUT || this.phase === PHASES.ASLEEP || this.phase === PHASES.SEIZURE; }

  /**
   * What it wants, right now. Evaluated all the time, not just when it
   * commits, so the panel can show what it is leaning towards.
   *
   *   chase    low NPF. The rejected males of Shohat-Ophir 2012 drank more.
   *   buzz     the stimulating edge of a rising ethanol level, plus dopamine
   *            still firing — ethanol is rewarding to a fly, and flies will
   *            work for it (Kaun et al. 2011, Nat Neurosci). Tolerance blunts it.
   *   memory   what its mushroom body has learned about this bar.
   *   relief   a drink makes the hangover go away for a while, and a fly
   *            low on NPF takes that deal.
   *   caution  the defensive state, the hangover and nicotine nausea —
   *            all of it scaled down by how drunk it is. Disinhibition is
   *            why the fourth drink is easier than the first.
   *   craving  nicotine dependence, felt as the level falls.
   */
  get appetite() {
    const I = this.intox;
    const H = this.hangover;
    const disinhibit = 1 - 0.72 * smooth(5, 28, this.bac);
    const chase = (1 - this.npf) * 0.5;
    const buzz = (this.stim * 0.26 + this.dopamine * 0.24) * (1 - this.tolerance * 0.45);
    const memory = Math.max(-0.35, Math.min(0.35, this.memory * 0.4));
    const relief = H * (1 - this.npf) * 0.75;
    const nausea = smooth(NIC_JITTER, NIC_SEIZURE, this.nicotine);
    const caution = (this.fear * 0.4 + H * 0.5 + nausea * 0.5) * disinhibit;
    const sleepy = this.sedation * 0.22 + Math.max(0, this.sleepPressure - 0.85) * 0.6;
    // the crop fills up: a fly that has just drunk a lot is, for now, full
    const full = clamp01(this.crop / (SIP_ETHANOL * 7));
    // the lights, the noise, everyone else at it: evening is a cue
    const cue = this.evening ? 0.08 : 0;
    // and drunk, the next one is simply easier
    const loose = (1 - disinhibit) * 0.2;
    const beer = clamp01(0.06 + cue + chase + buzz + memory + relief + loose - caution - sleepy - full * 0.45);

    const craving = this.craving;
    const coUse = I * 0.38;
    const curiosity = this.pouchCount === 0 ? 0.1 + I * 0.18 : 0;
    const pouch = clamp01(0.06 + craving * 1.25 + coUse * 1.3 + curiosity + this.dopamine * 0.04
      - this.nicotine / 60 - caution * 0.3 - sleepy * 0.3);
    return { cue, chase, buzz, memory, relief, caution, sleepy, full, craving, coUse, disinhibit, beer, pouch };
  }

  /** How many sips a given urge asks for. */
  static sipsFor(urge) { return Math.max(1, Math.min(5, Math.round(1 + urge * 4.4))); }

  // ============================================================== decisions

  /** Commits to the next thing: a bout of sips, a pouch, or nothing yet. */
  decide() {
    const a = this.appetite;
    const noise = () => (this.rng() - 0.5) * 0.16;
    const beer = a.beer + noise();
    const canPouch = this.pouches.length < 2;
    const pouch = canPouch ? a.pouch + noise() : -1;
    const bar = 0.24 + this.rng() * 0.1;

    if (Math.max(beer, pouch) < bar) {
      this.record({ kind: 'rest', why: urgeReason(a, 'rest') });
      return 'rest';
    }
    if (pouch > beer) {
      // a disinhibited fly reaches for the strong ones
      const want = clamp01(a.pouch * 1.1 + (1 - a.disinhibit) * 0.55 + noise());
      const mg = POUCH_MG[Math.min(3, Math.round(want * 3.2))];
      this.plan = { kind: 'pouch', mg, why: urgeReason(a, 'pouch') };
      this.startPouch();
      return 'pouch';
    }
    const sips = Bar.sipsFor(clamp01(a.beer + noise() + (1 - a.disinhibit) * 0.2));
    this.plan = { kind: 'beer', sips, why: urgeReason(a, 'beer') };
    this.startSipping();
    return 'beer';
  }

  startSipping() {
    this.phase = PHASES.SIPPING;
    this.t = 0;
    this.sipsTaken = 0;
    this.drinkStyle = this.rng() < 0.22 ? 'gulp' : 'sips';
    this.grip = 0;
    this.handTarget = GLASS_GRIP.slice();
    this.glassLift = 0;
    this.glassTilt = 0;
    this.emit('lean');
  }

  startPouch() {
    this.phase = PHASES.POUCH;
    this.t = 0;
    this.pouchStage = 'reach';
    this.stageK = 0;
    this.lidPopped = false;
    this.lidClicked = false;
    this.handTarget = TIN_GRIP.slice();
    this.emit('reach');
  }

  /** Under the lip, wherever the head has put the mouth this frame. */
  get tuckAt() {
    const m = this.mouth;
    return [m[0] + LIP_OFFSET[0], m[1] + LIP_OFFSET[1], m[2] + LIP_OFFSET[2]];
  }

  record(r) {
    this.lastResult = { ...r, at: this.now(), bac: this.bac, nicotine: this.nicotine, clock: this.clock };
    if (r.kind !== 'rest') {
      this.history.push({ at: this.lastResult.at, kind: r.kind, size: r.sips ?? r.mg ?? 0 });
      if (this.history.length > 12) this.history.shift();
    }
  }

  // ================================================================ update

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    const rate = this.phase === PHASES.ASLEEP || this.phase === PHASES.PASSED_OUT ? MINUTES_PER_SECOND.asleep
      : this.phase === PHASES.SEIZURE ? MINUTES_PER_SECOND.knocked
        : this.evening ? MINUTES_PER_SECOND.evening : MINUTES_PER_SECOND.day;
    const dtMin = dt * rate;
    this.advanceClock(dtMin);

    switch (this.phase) {
      case PHASES.SIPPING: this.updateSipping(dt); break;
      case PHASES.POUCH: this.updatePouch(dt); break;
      case PHASES.PASSED_OUT:
      case PHASES.ASLEEP: this.updateSleep(dt); break;
      case PHASES.SEIZURE: this.updateSeizure(dt); break;
      default: this.relax(dt);
    }

    this.updateBody(dtMin, dt);
    this.updateSignals(dt, dtMin);
    this.updateAutonomy(dt);
    if (this.refilling > 0) {
      this.refilling = Math.max(0, this.refilling - dt / T.refill);
      this.fill = 1 - this.refilling;
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.tingle = Math.max(0, this.tingle - dt / 1.5);
    // anything that cuts a pouch short leaves the tin to close itself
    if (this.phase !== PHASES.POUCH) this.tinLid = Math.max(0, this.tinLid - dt * 6);
    return this;
  }

  advanceClock(dtMin) {
    const before = Math.floor(this.minute / (24 * 60));
    this.minute += dtMin;
    const after = Math.floor(this.minute / (24 * 60));
    if (after > before) this.day += 1;
  }

  relax(dt) {
    const k = Math.min(1, dt * 5);
    this.lean += (0 - this.lean) * k;
    this.extend += (0 - this.extend) * k;
    this.proboscis *= Math.exp(-dt * 5);
    this.glassLift *= Math.exp(-dt * 5);
    this.glassTilt *= Math.exp(-dt * 5);
    this.grip += (0 - this.grip) * k;
    this.collapse = Math.max(0, this.collapse - dt / 2.4);
  }

  updateSipping(dt) {
    const slow = 1 + this.sway * 0.9;          // a drunk fly is slower and less steady
    const { sips } = this.plan;
    const reach = T.lean * slow;
    const lift = T.glassLift * slow;
    const drink = (this.drinkStyle === 'gulp' ? T.gulp : Math.max(T.sip, sips * T.sip)) * slow;
    const lower = T.glassLower * slow;
    const t = this.t;
    const drinkStart = reach + lift;
    const lowerStart = drinkStart + drink;
    if (t < reach) {
      const k = easeInOut(t / reach);
      this.lean = smooth(0.2, 1, k);
      this.extend = k;
      this.grip = k;
      this.handTarget = GLASS_GRIP.slice();
      this.glassLift = 0;
      this.glassTilt = 0;
      return;
    }
    if (t < drinkStart) {
      const k = easeInOut((t - reach) / lift);
      this.grip = 1;
      this.glassLift = k;
      this.glassTilt = 0;
      this.handTarget = GLASS_GRIP.map((v, i) => v + (DRINK_GLASS_GRIP[i] - GLASS_GRIP[i]) * k);
      this.lean = 1;
      this.extend = 1;
      return;
    }
    if (t < lowerStart) {
      const k = clamp01((t - drinkStart) / drink);
      this.grip = 1;
      this.glassLift = 1;
      this.glassTilt = smooth(0.06, 0.2, k);
      this.handTarget = DRINK_GLASS_GRIP.slice();
      this.lean = 1;
      this.extend = 1;
      if (this.drinkStyle === 'gulp') {
        if (k >= 0.42 && this.sipsTaken < sips) while (this.sipsTaken < sips) this.takeSip();
      } else {
        const done = Math.floor(k * sips);
        while (this.sipsTaken < Math.min(done, sips)) this.takeSip();
      }
      return;
    }
    if (t < lowerStart + lower) {
      const k = easeInOut((t - lowerStart) / lower);
      this.grip = 1 - k;
      this.glassLift = 1 - k;
      this.glassTilt = 1 - k;
      this.handTarget = DRINK_GLASS_GRIP.map((v, i) => v + (GLASS_GRIP[i] - DRINK_GLASS_GRIP[i]) * k);
      this.lean = 1 - k;
      this.extend = 1 - k;
      return;
    }
    while (this.sipsTaken < sips) this.takeSip();
    this.finishBout();
  }

  takeSip() {
    this.sipsTaken += 1;
    this.sips += 1;
    this.crop += SIP_ETHANOL;
    this.fill = Math.max(0, this.fill - 1 / SIPS_PER_GLASS);
    this.sipPulse = 1;
    this.emit('sip', { n: this.sipsTaken });
  }

  finishBout() {
    const { sips, why } = this.plan;
    if (sips > this.biggestBout) this.biggestBout = sips;
    this.record({ kind: 'beer', sips, why });
    this.emit('boutDone', { sips });
    if (this.fill <= 0.001) {
      this.refilling = 1;
      this.beers += 1;
      this.emit('refill');
    }
    this.plan = null;
    this.phase = PHASES.IDLE;
    this.t = 0;
    this.lean = 0; this.extend = 0; this.proboscis = 0;
    this.glassLift = 0; this.glassTilt = 0; this.grip = 0;
  }

  /**
   * A pouch, in six beats: the foreleg goes to the tin and flips the lid, takes
   * a pouch, carries it up in an arc as the lid snaps shut, presses it in under
   * the lip twice with the head tipped back, and lets go.
   */
  updatePouch(dt) {
    const slow = 1 + this.sway * 0.7;
    const s = this.pouchStage;
    const t = this.t;
    // Carry the fractional frame into the next beat instead of introducing a
    // fresh pause at every transition on slower displays.
    const next = (stage, duration) => {
      this.pouchStage = stage;
      this.t = Math.max(0, t - duration);
      this.stageK = 0;
    };
    if (s === 'reach') {
      const k = clamp01(t / (T.reach * slow));
      this.stageK = k;
      const reach = easeInOut(k);
      this.handTarget = [TIN_GRIP[0], TIN_GRIP[1] + Math.sin(reach * Math.PI) ** 2 * 0.018, TIN_GRIP[2]];
      this.grip = reach;
      // the tarsus catches the front of the lid on the way in and flips it up
      const open = clamp01((k - 0.55) / 0.45);
      this.tinLid = open > 0 ? springOut(open) : 0;
      if (open > 0 && !this.lidPopped) { this.lidPopped = true; this.emit('tin'); }
      if (k >= 1) { this.tinLid = 1; next('pinch', T.reach * slow); }
    } else if (s === 'pinch') {
      const k = clamp01(t / T.pinch);
      this.stageK = k;
      this.grip = 1;
      this.tinLid = 1;
      this.pouchInHand = true;
      // a small dip to close on it, and up again
      this.handTarget = [TIN_GRIP[0], TIN_GRIP[1] - 0.004 * Math.sin(k * Math.PI) ** 2, TIN_GRIP[2]];
      if (k >= 1) next('lift', T.pinch);
    } else if (s === 'lift') {
      const k = easeInOut(clamp01(t / (T.lift * slow)));
      this.stageK = k;
      const to = this.tuckAt;
      // up and a little out on the way, so the pouch never drags through the body
      const arc = Math.sin(k * Math.PI);
      this.handTarget = [
        TIN_GRIP[0] + (to[0] - TIN_GRIP[0]) * k,
        TIN_GRIP[1] + (to[1] - TIN_GRIP[1]) * k + arc * 0.03,
        TIN_GRIP[2] + (to[2] - TIN_GRIP[2]) * k - arc * 0.025,
      ];
      // it looks down at what it is carrying up
      this.lean = 0.35 * arc;
      // the lid is on a spring: out of the way of the pouch, it snaps back
      const shut = clamp01((t - 0.12) / T.lidShut);
      this.tinLid = 1 - shut * shut;
      if (shut >= 1 && !this.lidClicked) { this.lidClicked = true; this.emit('lid'); }
      if (k >= 1) next('tuck', T.lift * slow);
    } else if (s === 'tuck') {
      const k = clamp01(t / T.tuck);
      this.stageK = k;
      // two presses in towards the mouth, the head tipped back to take it
      const press = Math.pow(Math.sin(k * Math.PI * 2), 2) * 0.012;
      const at = this.tuckAt;
      const l = Math.hypot(LIP_OFFSET[0], LIP_OFFSET[1], LIP_OFFSET[2]) || 1;
      this.handTarget = at.map((v, i) => v - (LIP_OFFSET[i] / l) * press);
      this.lean = -0.9 * Math.sin(k * Math.PI) ** 2;
      this.tinLid = 0;
      if (k >= 1) {
        this.pouchInHand = false;
        this.pouches.push({ mg: this.plan.mg, left: this.plan.mg, age: 0 });
        this.pouchCount += 1;
        this.nicotineMg += this.plan.mg;
        this.tingle = 0.4 + 0.6 * (this.plan.mg / POUCH_MG[POUCH_MG.length - 1]);
        this.record({ kind: 'pouch', mg: this.plan.mg, why: this.plan.why });
        this.emit('tuck', { mg: this.plan.mg });
        next('release', T.tuck);
      }
    } else {
      const k = clamp01(t / T.release);
      this.stageK = k;
      // Clear the lip before relaxing the foreleg. A little lift keeps the
      // returning tarsus from cutting straight through the underside of the head.
      const at = this.tuckAt;
      const retreat = smooth(0, 0.65, k);
      this.handTarget = [
        at[0] + LIP_OFFSET[0] * retreat * 0.65,
        at[1] + LIP_OFFSET[1] * retreat * 0.65 + Math.sin(k * Math.PI) ** 2 * 0.012,
        at[2] + LIP_OFFSET[2] * retreat * 0.65,
      ];
      this.grip = 1 - easeInOut(k);
      this.lean *= Math.max(0, 1 - dt * 8);
      if (k >= 1) {
        this.grip = 0;
        this.plan = null;
        this.pouchStage = null;
        this.phase = PHASES.IDLE;
        this.t = 0;
      }
    }
  }

  /** The scene says where the mouthparts are each frame; headless, they stay put. */
  setMouth(p) { this.mouth = p; }

  /** Sedation, or sleep: it slumps, the clock runs, the body clears. */
  updateSleep(dt) {
    this.lean += (0 - this.lean) * Math.min(1, dt * 3);
    this.extend += (0 - this.extend) * Math.min(1, dt * 4);
    this.proboscis *= Math.exp(-dt * 7);
    this.glassLift *= Math.exp(-dt * 5);
    this.glassTilt *= Math.exp(-dt * 5);
    this.grip += (0 - this.grip) * Math.min(1, dt * 4);
    this.pouchInHand = false;
    this.collapse = Math.min(1, this.collapse + dt / 1.6);
    const slept = this.minute - this.fellAt;
    // it sleeps until the ethanol is mostly gone and it has had a night of it
    const morning = this.hour >= 8 && this.hour < 17;
    if (slept > 6 * 60 && morning && this.bac < 3 && this.sleepPressure < 0.25) this.wake();
    // nobody sleeps forever, however drunk
    else if (slept > 14 * 60) this.wake();
  }

  updateSeizure(dt) {
    this.lean += (0 - this.lean) * Math.min(1, dt * 3);
    this.extend = 0;
    this.proboscis *= Math.exp(-dt * 12);
    this.glassLift *= Math.exp(-dt * 6);
    this.glassTilt *= Math.exp(-dt * 6);
    this.grip += (0 - this.grip) * Math.min(1, dt * 4);
    this.pouchInHand = false;
    // the fit first, then it lies there knocked down until the level falls
    if (this.t < T.fit) {
      this.seizureFit = 1;
      this.collapse = Math.min(0.6, this.collapse + dt / 2);
      this.shake = Math.max(this.shake, 0.35);
    } else {
      this.seizureFit = Math.max(0, this.seizureFit - dt / 1.5);
      this.collapse = Math.min(1, this.collapse + dt / 2);
      if (this.nicotine < NIC_JITTER * 0.8) this.wake(true);
    }
  }

  fallAsleep(passedOut) {
    this.phase = passedOut ? PHASES.PASSED_OUT : PHASES.ASLEEP;
    this.t = 0;
    this.fellAt = this.minute;
    this.plan = null;
    this.pouchInHand = false;
    this.pouchStage = null;
    this.stageK = 0;
    if (passedOut) this.passouts += 1;
    this.history.push({ at: this.now(), kind: passedOut ? 'passout' : 'sleep' });
    if (this.history.length > 12) this.history.shift();
    this.record({ kind: passedOut ? 'passout' : 'sleep' });
    this.emit(passedOut ? 'passout' : 'sleep');
  }

  seize() {
    this.phase = PHASES.SEIZURE;
    this.t = 0;
    this.plan = null;
    this.pouchInHand = false;
    this.pouchStage = null;
    this.stageK = 0;
    this.seizures += 1;
    this.startle = 1;
    this.shake = 0.8;
    // the pouches come out: it spits them
    const spent = this.pouches.length;
    this.pouches = [];
    if (spent) this.emit('spent', { n: spent });
    this.history.push({ at: this.now(), kind: 'seizure' });
    if (this.history.length > 12) this.history.shift();
    this.record({ kind: 'seizure' });
    this.emit('seizure');
  }

  wake(fromSeizure = false) {
    const wasAsleep = !fromSeizure;
    this.phase = PHASES.IDLE;
    this.t = 0;
    this.idleFor = 0;
    this.nextDecisionAfter = 3.5;
    this.wokeAt = this.now();
    if (wasAsleep) {
      this.nights += 1;
      this.peakBac = 0;
      if (this.hangover > this.hangoverWorst) this.hangoverWorst = this.hangover;
    }
    this.record({ kind: fromSeizure ? 'recover' : 'wake', hangover: this.hangover });
    this.emit(fromSeizure ? 'recover' : 'wake', { hangover: this.hangover });
  }

  // ================================================================== body

  updateBody(dtMin, dt) {
    // ethanol: crop -> body -> out
    const absorbed = this.crop * (1 - Math.exp(-dtMin / ABSORB_MIN));
    this.crop -= absorbed;
    const before = this.bac;
    this.bac += absorbed;
    const out = Math.min(this.bac, ELIMINATE * (1 + this.tolerance * 0.6) * dtMin);
    this.bac -= out;
    this.toxin = this.toxin * decay(TOXIN_HALF_LIFE, dtMin) + out;
    this.ethanolRise = dtMin > 0 ? Math.max(0, (this.bac - before) / dtMin) : 0;
    if (this.bac > this.peakBac) this.peakBac = this.bac;
    if (this.bac > this.allTimePeak) this.allTimePeak = this.bac;
    // rapid tolerance builds while it is drunk and fades over days
    this.tolerance = clamp01(this.tolerance * decay(3 * 24 * 60, dtMin) + this.intox * dtMin / 3600);

    // nicotine: pouches release, the level decays
    let released = 0;
    for (const p of this.pouches) {
      const r = p.left * (1 - Math.exp(-dtMin / POUCH_RELEASE_MIN));
      p.left -= r; p.age += dtMin;
      released += r;
    }
    const wearing = this.pouches.length;
    this.pouches = this.pouches.filter((p) => p.age < POUCH_WEAR_MIN);
    if (this.pouches.length < wearing) this.emit('spent', { n: wearing - this.pouches.length });
    const nicBefore = this.nicotine;
    this.nicotine = this.nicotine * decay(NIC_HALF_LIFE, dtMin) + released * BIOAVAIL * NG_PER_MG;
    this.nicotineRise = dtMin > 0 ? Math.max(0, (this.nicotine - nicBefore) / dtMin) : 0;
    this.dependence = clamp01(this.dependence * decay(5 * 24 * 60, dtMin) + released * BIOAVAIL * 0.02);

    // sleep pressure builds awake, clears asleep; ethanol adds to it
    if (this.phase === PHASES.ASLEEP || this.phase === PHASES.PASSED_OUT) {
      this.sleepPressure = Math.max(0, this.sleepPressure - dtMin / (7 * 60));
    } else {
      this.sleepPressure += dtMin / (16 * 60) * (1 + this.intox * 0.8);
    }

    // NPF: drifts home, ethanol tops it up, a hangover drains it
    const H = this.hangover;
    this.npf += (NPF_REST - this.npf) * (1 - Math.exp(-dtMin / NPF_RECOVER_MIN));
    const asleep = this.phase === PHASES.ASLEEP || this.phase === PHASES.PASSED_OUT;
    this.npf += (this.intox * 0.0012 - H * (asleep ? 0.0003 : 0.0016)) * dtMin;
    this.npf = clamp01(this.npf);

    // thresholds
    if (!this.down && this.bac >= this.sedationAt && this.phase !== PHASES.POUCH) this.fallAsleep(true);
    if (this.phase !== PHASES.SEIZURE && this.nicotine >= NIC_SEIZURE) this.seize();
    void dt;
  }

  /**
   * The readouts. With the brain running, dopamine and octopamine come from
   * the simulated PAM and PPL1 clusters; the rest is the body's.
   */
  updateSignals(dt, dtMin) {
    const H = this.hangover;
    const jitter = this.jitter;
    const target = clamp01(H * 0.75 + jitter * 0.55 + (this.phase === PHASES.SEIZURE ? 1 : 0));
    const rate = target > this.fear ? 1.4 : 3.5;
    this.fear += (target - this.fear) * (1 - Math.exp(-dt / rate));

    if (this.neural) {
      const span = 0.22;
      this.dopamine = clamp01((this.neural.reward - this.neuralRest) / span);
      this.octopamine = clamp01((this.neural.punish - this.neuralRestPunish) / span * 0.8 + this.startle
        + this.nicStim * 0.25);
    } else {
      this.dopamine += ((this.ethanolRise * 1.2 + this.nicotineRise * 0.5) - this.dopamine) * Math.min(1, dt * 2);
      this.dopamine = clamp01(this.dopamine);
      this.octopamine += ((H * 0.5 + jitter + this.startle) - this.octopamine) * Math.min(1, dt * 2);
      this.octopamine = clamp01(this.octopamine);
    }
    this.startle = Math.max(0, this.startle - dt / 1.4);
    this.sipPulse = Math.max(0, (this.sipPulse ?? 0) - dt * 3);

    // heart: nicotine and octopamine drive it, deep sedation slows it
    const want = HEART_REST + (HEART_MAX - HEART_REST)
      * clamp01(this.octopamine * 0.5 + this.nicStim * 0.45 + this.stim * 0.2 + this.fear * 0.3 + this.dopamine * 0.2);
    const heart = want + (HEART_FAINT - want) * this.sedation * 0.6 * (this.phase === PHASES.SEIZURE ? 0 : 1);
    this.heartRate += (heart - this.heartRate) * (1 - Math.exp(-dt / 0.6));
    void dtMin;
  }

  /** The fly runs itself. */
  updateAutonomy(dt) {
    if (this.phase !== PHASES.IDLE) { this.idleFor = 0; return; }
    this.idleFor += dt;
    if (this.idleFor < this.nextDecisionAfter) return;
    this.idleFor = 0;

    // bedtime: late and tired, or just too tired
    const late = this.hour >= 1 && this.hour < 7;
    if ((late && this.sleepPressure > 0.8) || this.sleepPressure > 1.35) {
      this.fallAsleep(false);
      return;
    }
    const kind = this.decide();
    // a hungover or drunk fly is slow to decide anything
    const pessimism = this.fear * 1.4 + this.hangover * 1.6;
    const heavy = this.sedation * 3 + this.sway * 0.8;
    this.nextDecisionAfter = (kind === 'rest' ? 2.4 : 1.4) + pessimism + heavy + this.rng() * 1.6;
  }

  /** 0..1 while idle: how close it is to committing. */
  get deliberation() {
    if (this.phase !== PHASES.IDLE) return 0;
    return clamp01(this.idleFor / Math.max(0.1, this.nextDecisionAfter));
  }

  /** 0 calm .. 1 wound up. Drives the idle animation. */
  get arousal() {
    return clamp01(this.dopamine * 0.5 + this.octopamine * 0.6 + this.nicStim * 0.4 + this.stim * 0.3)
      * (1 - this.collapse);
  }

  // ============================================================ from brain

  setNeuralReadout(reward, punish) {
    this.neural = { reward, punish };
    if (this.neuralRest === undefined) this.setNeuralRest(reward, punish);
  }

  setNeuralRest(reward, punish) {
    this.neuralRest = reward;
    this.neuralRestPunish = punish;
  }

  setMemory(value, learned) {
    this.memory = value;
    this.learned = learned;
  }
}
