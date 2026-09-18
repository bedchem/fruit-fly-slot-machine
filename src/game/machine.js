/**
 * The whole spin, as one deterministic state machine.
 *
 * It owns continuous values (lever angle, how much of the fly's weight is on
 * the handle, each reel's angle) and advances them from a delta time. Nothing
 * here touches React or three.js: the scene reads these numbers every frame and
 * the UI subscribes to the discrete parts. That split is what keeps a 60 fps
 * lever pull from re-rendering the DOM.
 *
 * The pull is deliberately a three-beat action, because that is what the fly
 * has to perform: reach for the knob, haul it *down*, let it spring back *up* —
 * and only then do the reels let go.
 */

export const SYMBOLS = [
  { id: 'fly', name: 'Fly', weight: 5 },
  { id: 'wing', name: 'Wing', weight: 5 },
  { id: 'eye', name: 'Compound eye', weight: 4 },
  { id: 'neuron', name: 'Neuron', weight: 4 },
  { id: 'cherry', name: 'Cherry', weight: 5 },
  { id: 'seven', name: 'Seven', weight: 2 },
];

export const PHASES = {
  IDLE: 'idle',
  REACHING: 'reaching',
  PULLING: 'pulling',
  HELD: 'held',
  RETURNING: 'returning',
  SPINNING: 'spinning',
  RESOLVING: 'resolving',
  RESULT: 'result',
};

const T = {
  reach: 0.55,      // foreleg rises from rest onto the knob
  pull: 0.50,       // knob travels down
  hold: 0.10,       // the latch at the bottom
  ret: 0.34,        // spring back up
  release: 0.45,    // foreleg lets go and drops back to rest
  spinUp: 0.30,
  firstStop: 1.35,  // after the reels are released
  stopGap: 0.62,
  stopTime: 0.72,   // deceleration of a single reel
  resultHold: 2.4,
};

const REEL_SPEED = 19;          // rad/s at full tilt
const DOPAMINE_RISE = 0.30;
const DOPAMINE_DECAY = 2.6;

/**
 * The fly's internal state, built on what has actually been measured in
 * Drosophila rather than on human feelings with insect names.
 *
 * OCTOPAMINE is the insect counterpart of noradrenaline. It is the arousal
 *   signal — it rises with anything salient, good or bad — and in the reward
 *   pathway it sits UPSTREAM of dopamine: octopamine acts on the OAMB receptor
 *   of mushroom-body dopamine neurons, and activating those neurons can stand
 *   in for sugar. So here it spikes on every outcome, and dopamine only
 *   follows it when the spin actually paid. (Burke et al. 2012, Nature)
 *
 * DOPAMINE is reward, and specifically the PAM cluster; the PPL1 cluster
 *   carries negative value instead. That split is the one the mushroom body
 *   actually uses. (Aso et al. 2014, eLife; Burke et al. 2012)
 *
 * NPF, neuropeptide F, is the fly's NPY: the satisfaction signal. Deprivation
 *   halves it, and flies with low NPF seek reward harder — the sexually
 *   rejected males in Shohat-Ophir et al. drank markedly more ethanol. Here a
 *   losing streak drains it, which is the closest thing in this animal to
 *   chasing losses. (Shohat-Ophir et al. 2012, Science)
 *
 * DEFENSIVE AROUSAL is deliberately not called fear. Flies express a
 *   persistent, scalable internal state in response to repeated threat that
 *   meets the criteria for an emotion primitive, but the authors are careful
 *   not to call it fear, and so is this. (Gibson et al. 2015, Current Biology)
 *
 * JUDGEMENT BIAS: flies in a poor internal state judge ambiguous cues
 *   pessimistically, the same state-dependent bias measured in mammals. It is
 *   why this fly hesitates longer before committing a credit when it is doing
 *   badly. (Deakin et al. 2018, Proc R Soc B)
 *
 * HEART RATE: an adult male Drosophila dorsal vessel runs about 270-290 bpm at
 *   ten days old and slows with age; octopamine is a cardioaccelerator, so
 *   arousal drives it up from there. (Paternostro et al. 2001; Ocorr et al. 2007)
 */
const OCTOPAMINE_RISE = 0.25;   // arousal leads: fast on
const OCTOPAMINE_DECAY = 2.6;
const DOPAMINE_LAG = 0.22;      // dopamine follows octopamine, it does not lead
const NPF_DRAIN = 0.11;         // per losing spin
const NPF_GAIN = 0.34;          // per win
const HEART_REST = 268;         // bpm
const HEART_MAX = 392;
const LOW_CREDITS = 8;          // below this the state starts to shift

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t) => t * t;
/** Overshoot on the way home — a lever that snaps back never stops dead. */
const easeOutBack = (t, s = 1.45) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

function pickWeighted(rng) {
  const total = SYMBOLS.reduce((a, s) => a + s.weight, 0);
  let r = rng() * total;
  for (let i = 0; i < SYMBOLS.length; i++) { r -= SYMBOLS[i].weight; if (r <= 0) return i; }
  return SYMBOLS.length - 1;
}

/**
 * Rolls the three symbols.
 *
 * Uniform reels would pay a triple about once in fifty spins, which is a dull
 * demo, so the outcome is decided first and the symbols are chosen to match —
 * the same way a real machine works. `nearMissRate` is what makes losing spins
 * land two-of-a-kind often enough to feel like something nearly happened.
 */
export function rollOutcome(rng = Math.random, { winRate = 0.26, nearMissRate = 0.45 } = {}) {
  if (rng() < winRate) {
    const s = pickWeighted(rng);
    return { reels: [s, s, s], win: true, jackpot: SYMBOLS[s].id === 'seven' };
  }
  if (rng() < nearMissRate) {
    const s = pickWeighted(rng);
    let other = pickWeighted(rng);
    while (other === s) other = pickWeighted(rng);
    const slot = Math.floor(rng() * 3);
    const reels = [s, s, s];
    reels[slot] = other;
    return { reels, win: false, nearMiss: true };
  }
  let reels;
  do {
    reels = [pickWeighted(rng), pickWeighted(rng), pickWeighted(rng)];
  } while (reels[0] === reels[1] && reels[1] === reels[2]);
  return { reels, win: false, nearMiss: false };
}

/** Reel angle that parks symbol `i` in the middle of the window. */
export function angleForSymbol(i, n = SYMBOLS.length) {
  return 2 * Math.PI * (0.25 - (i + 0.5) / n);
}

export class SlotMachine {
  constructor({ leverPulled = -0.95, onEvent = () => {}, rng = Math.random } = {}) {
    this.leverPulled = leverPulled;
    this.onEvent = onEvent;
    this.rng = rng;

    this.phase = PHASES.IDLE;
    this.t = 0;
    this.leverAngle = 0;
    /** 0 = foreleg at its rest pose, 1 = tarsus on the knob. */
    this.grip = 0;
    this.dopamine = 0;
    this.dopamineTarget = 0;

    /** Insect adrenaline: the startle/stress signal. */
    this.octopamine = 0;
    this.octopamineTarget = 0;
    /** Slow dread. Builds as the credits drain and as losses stack up. */
    this.fear = 0;
    /** Set by the connectome model once it is running. */
    this.neural = null;
    this.startle = 0;
    /** Neuropyeptide F: the satisfaction signal. Starts satisfied. */
    this.npf = 0.7;
    this.lossStreak = 0;
    this.heartRate = HEART_REST;

    this.credits = 20;
    this.startingCredits = 20;
    this.spins = 0;
    this.wins = 0;
    this.lastResult = null;
    /** The last dozen outcomes, newest last — what the run log shows. */
    this.history = [];
    this.best = 0;
    this.shake = 0;

    this.reels = [0, 1, 2].map(() => ({ angle: 0, speed: 0, state: 'idle', from: 0, to: 0, t: 0 }));
    this.outcome = null;
    this.stopped = 0;
    this.reelsReleased = false;
    this.aborted = false;
    this.returnFrom = 0;

    // set by the drag handler while the player is hauling the knob by hand
    this.dragging = false;
    this.dragAngle = 0;

    /**
     * The fly plays on its own. It keeps its own clock so the gap between
     * spins varies — a machine that fires on an exact metronome reads as a
     * looping animation rather than as something deciding to pull again.
     */
    this.autoplay = true;
    this.idleFor = 0;
    this.nextPullAfter = 1.1;
  }

  get busy() { return this.phase !== PHASES.IDLE && this.phase !== PHASES.RESULT; }
  get pullProgress() { return this.leverPulled === 0 ? 0 : this.leverAngle / this.leverPulled; }

  emit(type, detail) { this.onEvent(type, detail); }

  /** Button, keypress or the end of a drag that got far enough. */
  start() {
    if (this.busy || this.credits <= 0) return false;
    this.credits -= 1;
    this.spins += 1;
    this.outcome = rollOutcome(this.rng);
    this.reelsReleased = false;
    this.lastResult = null;
    this.phase = PHASES.REACHING;
    this.t = 0;
    this.emit('reach');
    return true;
  }

  /** Player grabbed the knob directly. */
  beginDrag() {
    if (this.busy || this.credits <= 0) return false;
    this.dragging = true;
    this.phase = PHASES.REACHING;
    this.t = 0;
    this.emit('reach');
    return true;
  }

  /** `amount` is 0..1 of the way to the bottom of the swing. */
  dragTo(amount) {
    if (!this.dragging) return;
    this.dragAngle = clamp01(amount);
  }

  endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragAngle > 0.75 && this.credits > 0) {
      this.credits -= 1;
      this.spins += 1;
      this.outcome = rollOutcome(this.rng);
      this.lastResult = null;
      this.phase = PHASES.HELD;
      this.t = 0;
      this.leverAngle = this.leverPulled;
      this.emit('latch');
    } else {
      // not far enough — let it go and put the foreleg back
      this.phase = PHASES.RETURNING;
      this.t = 0;
      this.returnFrom = this.leverAngle;
      this.aborted = true;
      this.emit('slip');
    }
    this.dragAngle = 0;
  }

  /**
   * Lets the drums go. Called partway through the lever's return, not at the
   * end of it: the reels breaking loose while the handle is still travelling is
   * most of why a real machine feels mechanical.
   */
  releaseReels() {
    this.stopped = 0;
    this.reelsReleased = true;
    this.reels.forEach((r) => { r.state = 'accel'; r.t = 0; });
    this.emit('spinStart');
  }

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    const P = PHASES;

    switch (this.phase) {
      case P.REACHING: {
        this.grip = easeInOut(clamp01(this.t / T.reach));
        if (this.dragging) {
          // once the foot is on the knob the player's drag drives the angle
          if (this.grip >= 1) this.phase = P.PULLING;
        } else if (this.t >= T.reach) {
          this.phase = P.PULLING; this.t = 0; this.emit('pullStart');
        }
        break;
      }
      case P.PULLING: {
        if (this.dragging) {
          this.leverAngle += (this.dragAngle * this.leverPulled - this.leverAngle) * Math.min(1, dt * 18);
        } else {
          const k = clamp01(this.t / T.pull);
          this.leverAngle = this.leverPulled * easeInQuad(k);
          if (k >= 1) { this.phase = P.HELD; this.t = 0; this.emit('latch'); }
        }
        break;
      }
      case P.HELD: {
        this.leverAngle = this.leverPulled;
        if (this.t >= T.hold) {
          this.phase = P.RETURNING; this.t = 0;
          this.returnFrom = this.leverAngle;
          this.emit('release');
        }
        break;
      }
      case P.RETURNING: {
        const k = clamp01(this.t / T.ret);
        this.leverAngle = this.returnFrom * (1 - easeOutBack(k));
        if (k >= 0.5 && !this.aborted && this.outcome && !this.reelsReleased) this.releaseReels();
        if (k >= 1) {
          this.leverAngle = 0;
          this.t = 0;
          if (this.aborted) { this.aborted = false; this.phase = P.IDLE; }
          else this.phase = P.SPINNING;
        }
        break;
      }
      case P.SPINNING:
      case P.RESOLVING: {
        this.leverAngle += (0 - this.leverAngle) * Math.min(1, dt * 10);
        // let go of the knob a beat after the lever is home
        const since = this.t;
        this.grip = 1 - easeInOut(clamp01((since - 0.18) / T.release));
        break;
      }
      case P.RESULT: {
        this.grip += (0 - this.grip) * Math.min(1, dt * 6);
        this.leverAngle += (0 - this.leverAngle) * Math.min(1, dt * 10);
        if (this.t >= T.resultHold) { this.phase = P.IDLE; this.t = 0; }
        break;
      }
      default: {
        this.grip += (0 - this.grip) * Math.min(1, dt * 5);
        this.leverAngle += (0 - this.leverAngle) * Math.min(1, dt * 8);
      }
    }

    this.updateReels(dt);
    this.updateDopamine(dt);
    this.updateStress(dt);
    this.updateAutoplay(dt);
    this.shake = Math.max(0, this.shake - dt * 3.2);
    return this;
  }

  updateAutoplay(dt) {
    if (this.phase !== PHASES.IDLE) { this.idleFor = 0; return; }
    if (!this.autoplay || this.dragging) return;
    this.idleFor += dt;
    if (this.idleFor < this.nextPullAfter) return;
    this.idleFor = 0;
    // the fly is not going to walk off and get change
    if (this.credits <= 0) { this.credits += 20; this.emit('refill'); }
    // longer pause after a win — it sits with it for a moment
    // a frightened fly hesitates before committing another credit
    const base = this.lastResult?.win ? 2.0 : 1.0;
    // state-dependent judgement bias: a fly in a poor state reads the odds
    // pessimistically and takes longer to commit (Deakin 2018)
    const pessimism = this.fear * 1.8 + (1 - this.npf) * 1.2;
    this.nextPullAfter = base + pessimism + this.rng() * 1.4;
    this.start();
  }

  setAutoplay(on) {
    this.autoplay = on;
    this.idleFor = 0;
    this.nextPullAfter = on ? 0.5 : 1.1;
  }

  updateReels(dt) {
    let allStopped = true;
    this.reels.forEach((r, i) => {
      switch (r.state) {
        case 'accel': {
          r.t += dt;
          r.speed = REEL_SPEED * easeOutCubic(clamp01(r.t / T.spinUp));
          r.angle -= r.speed * dt;
          if (r.t >= T.spinUp) { r.state = 'run'; r.t = 0; }
          allStopped = false;
          break;
        }
        case 'run': {
          r.t += dt;
          r.speed = REEL_SPEED;
          r.angle -= r.speed * dt;
          const due = T.firstStop + i * T.stopGap;
          if (r.t >= due) {
            r.from = r.angle;
            // land on the rolled symbol, at least one more full turn away
            const want = angleForSymbol(this.outcome.reels[i]);
            let to = want;
            while (to > r.from - 2 * Math.PI) to -= 2 * Math.PI;
            r.to = to;
            r.state = 'stopping';
            r.t = 0;
          }
          allStopped = false;
          break;
        }
        case 'stopping': {
          r.t += dt;
          const k = clamp01(r.t / T.stopTime);
          r.angle = r.from + (r.to - r.from) * easeOutBack(k, 1.1);
          r.speed = REEL_SPEED * (1 - k);
          if (k >= 1) {
            r.angle = r.to;
            r.speed = 0;
            r.state = 'stopped';
            this.stopped += 1;
            this.emit('reelStop', { index: i, symbol: this.outcome.reels[i], remaining: 2 - i });
          } else allStopped = false;
          break;
        }
        default: break;
      }
    });

    if (this.phase === PHASES.SPINNING && allStopped && this.stopped === 3) {
      this.phase = PHASES.RESOLVING;
      this.t = 0;
      this.resolve();
    }
  }

  resolve() {
    const o = this.outcome;
    // tuned for ~96% return to player: generous enough to keep going, not a fountain
    const payout = o.win ? (o.jackpot ? 12 : 3) : 0;
    this.credits += payout;
    if (o.win) this.wins += 1;
    this.lastResult = {
      reels: o.reels.slice(),
      symbols: o.reels.map((i) => SYMBOLS[i]),
      win: o.win,
      jackpot: !!o.jackpot,
      nearMiss: !!o.nearMiss,
      payout,
      at: Date.now(),
    };
    this.dopamineTarget = o.win ? (o.jackpot ? 1 : 0.82) : 0.12;
    // a loss is a startle; a near miss is a bigger one
    this.octopamineTarget = o.win ? 0.25 : (o.nearMiss ? 0.95 : 0.6);
    this.startle = o.win ? 0.2 : (o.nearMiss ? 0.75 : 0.45);
    this.lossStreak = o.win ? 0 : this.lossStreak + 1;
    // NPF: a payout tops it up, a loss drains it. Low NPF is what drives a fly
    // to keep seeking (Shohat-Ophir 2012).
    this.npf = clamp01(this.npf + (o.win ? NPF_GAIN * (o.jackpot ? 1.6 : 1) : -NPF_DRAIN));
    this.shake = o.win ? 1 : 0.25;
    this.history.push({ at: this.lastResult.at, win: o.win, jackpot: !!o.jackpot, nearMiss: !!o.nearMiss });
    if (this.history.length > 12) this.history.shift();
    if (payout > this.best) this.best = payout;
    this.emit(o.win ? 'win' : 'lose', this.lastResult);
    this.phase = PHASES.RESULT;
    this.t = 0;
    // the pulse is an impulse, not a level: it decays from here
    setTimeout(() => { this.dopamineTarget = 0; }, o.win ? 260 : 90);
    this.reels.forEach((r) => { r.state = 'idle'; r.speed = 0; });
  }

  /**
   * Hands the simulated PAM and PPL1 rates back from the connectome model.
   *
   * When this is being called, the fly's dopamine is not a curve drawn here —
   * it is the mean firing rate of the real reward cluster in the simulation,
   * rescaled from its resting level. `updateDopamine` falls back to the local
   * curve only while the connectome assets are still loading.
   */
  setNeuralReadout(reward, punish) {
    this.neural = { reward, punish };
    // Calibrate against the network's own resting level rather than a guessed
    // zero: a slow floor-follower that drops fast and rises very slowly, so a
    // reward pulse reads as a pulse and long-term drift is still absorbed.
    if (this.neuralRest === undefined) { this.neuralRest = reward; this.neuralRestPunish = punish; }
    this.neuralRest = reward < this.neuralRest
      ? this.neuralRest + (reward - this.neuralRest) * 0.08
      : this.neuralRest + (reward - this.neuralRest) * 0.0006;
    this.neuralRestPunish = punish < this.neuralRestPunish
      ? this.neuralRestPunish + (punish - this.neuralRestPunish) * 0.08
      : this.neuralRestPunish + (punish - this.neuralRestPunish) * 0.0006;
  }

  updateDopamine(dt) {
    if (this.neural) {
      // scale the simulated rate so resting reads 0 and a full reward pulse
      // reads about 1; the SHAPE is the network's, not an easing curve
      const span = 0.22;
      this.dopamine = clamp01((this.neural.reward - this.neuralRest) / span);
      this.octopamine = clamp01((this.neural.punish - this.neuralRestPunish) / span * 0.8
        + this.startle);
      this.startle = Math.max(0, this.startle - dt / 1.4);
      return;
    }
    // fallback while the connectome is still downloading
    const rate = this.dopamineTarget > this.dopamine ? DOPAMINE_RISE : DOPAMINE_DECAY;
    const k = 1 - Math.exp(-dt / rate);
    this.dopamine += (this.dopamineTarget - this.dopamine) * k;
    if (this.dopamine < 1e-4) this.dopamine = 0;
  }

  /**
   * How frightened the fly is, and what that does to it.
   *
   * Two components: how close it is to being broke, and how badly the last few
   * spins went. Both are slow. On top of them sits octopamine, which spikes on
   * a loss and at the moment the reels are still running — the fly is not
   * afraid of the machine, it is afraid of the outcome.
   */
  updateStress(dt) {
    const broke = clamp01((LOW_CREDITS - this.credits) / LOW_CREDITS);
    const streak = clamp01(this.lossStreak / 6);
    const target = clamp01(broke * 0.7 + streak * 0.4 + (1 - this.npf) * 0.25);
    // dread builds faster than it lifts
    const rate = target > this.fear ? 1.6 : 3.2;
    this.fear += (target - this.fear) * (1 - Math.exp(-dt / rate));

    // Suspense while the reels run. With the connectome model attached this
    // rides on top of the simulated PPL1 rate rather than replacing it.
    const suspense = this.phase === PHASES.SPINNING
      ? 0.2 + 0.35 * (this.stopped / 3) + 0.25 * this.fear
      : 0;
    if (!this.neural) {
      const base = Math.max(this.octopamineTarget, suspense);
      const orate = base > this.octopamine ? OCTOPAMINE_RISE : OCTOPAMINE_DECAY;
      this.octopamine += (base - this.octopamine) * (1 - Math.exp(-dt / orate));
      this.octopamineTarget *= Math.exp(-dt / 0.8);
      if (this.octopamine < 1e-4) this.octopamine = 0;
    } else {
      this.octopamine = clamp01(this.octopamine + suspense * 0.5);
    }

    // the heart follows both amines, plus the effort of the pull itself
    const effort = this.grip * 0.25;
    const want = HEART_REST + (HEART_MAX - HEART_REST)
      * clamp01(this.octopamine * 0.75 + this.dopamine * 0.5 + this.fear * 0.35 + effort);
    this.heartRate += (want - this.heartRate) * (1 - Math.exp(-dt / 0.55));
  }

  /** 0 = calm, 1 = as wound up as it gets. Drives the idle animation. */
  get arousal() {
    return clamp01(this.dopamine * 0.7 + this.octopamine * 0.8 + this.fear * 0.35);
  }

  addCredits(n = 20) { this.credits += n; }
}
