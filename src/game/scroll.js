/**
 * Two flies, two phones, one night.
 *
 * Drosi and Phila sit side by side and scroll a feed of reels. Nobody
 * controls them. Each has its own brain (neural/scrollBrain.js); each decides
 * for itself how long to watch, when to swipe, what to send the other, and —
 * eventually — when to stop. This file is the world they do it in: the reels,
 * the feed's algorithm, the messages between the two phones, the battery and
 * the clock. Plain JavaScript, no React, no three.js; tools/sim-scroll.mjs
 * runs the same classes headless.
 *
 * THE REELS — ten kinds — are things a fly's nervous system actually has an
 * opinion on: fermenting fruit, sugar, courtship song, a field of moving
 * stripes, a swarm — and a spider coming closer, a swatter coming down, a
 * vinegar trap, a parasitoid wasp, the blue light of a bug zapper. The brain feeds each
 * into the sensory pathway it would really use; the threats are looming
 * stimuli, and they reach the giant fibre.
 *
 * THE ALGORITHM knows nothing about flies. It measures how long each reel was
 * watched and serves more of whatever held attention. Threat reels drive
 * PPL1 and octopamine, and an aroused fly watches longer — so the feed drifts
 * towards doom on its own, and the flies scroll it, frightened, for longer.
 *
 * THE MESSAGES: a reel that spikes a fly's dopamine or arousal gets sent to
 * the other. Opening a reel from a friend is itself rewarding; a reply is
 * social reward for the sender, and "seen" with no reply is a small sting.
 * Two flies that keep replying to each other end up in reel ping-pong.
 */

export const REELS = {
  fruit: { label: 'rotting banana ASMR', creator: '@ferment.daily', kind: 'treat', reward: 0.75, threat: 0, habit: 0.14, color: '#e7b53c' },
  courtship: { label: 'he sang for her (wing song)', creator: '@maleCNS', kind: 'treat', reward: 0.6, threat: 0, habit: 0.12, color: '#d86ea0' },
  stripes: { label: 'oddly satisfying stripes', creator: '@optomotor', kind: 'treat', reward: 0.42, threat: 0, habit: 0.1, color: '#5aa6d6' },
  spider: { label: 'POV: it saw you', creator: '@arachnid.core', kind: 'threat', reward: 0, threat: 0.7, habit: 0.04, color: '#4a4550' },
  swatter: { label: 'the last thing he saw', creator: '@kitchen.cam', kind: 'threat', reward: 0, threat: 0.9, habit: 0.035, color: '#c9433a' },
  trap: { label: 'they went in. none came out.', creator: '@apple.cider', kind: 'threat', reward: 0.1, threat: 0.6, habit: 0.05, color: '#7a8c3a' },
  sugar: { label: 'sugar crystal ASMR (sound on)', creator: '@sweet.tooth', kind: 'treat', reward: 0.7, threat: 0, habit: 0.13, color: '#efe7d2' },
  swarm: { label: 'the swarm moves as one', creator: '@lek.life', kind: 'treat', reward: 0.5, threat: 0, habit: 0.11, color: '#6fb58a' },
  wasp: { label: 'she is looking for your kids', creator: '@leptopilina', kind: 'threat', reward: 0, threat: 0.75, habit: 0.04, color: '#e0b21c' },
  zapper: { label: 'go towards the light', creator: '@bug.zapper', kind: 'threat', reward: 0.25, threat: 0.6, habit: 0.05, color: '#7d6cf0' },
};
export const CATS = Object.keys(REELS);
export const NAMES = ['Drosi', 'Phila'];

export const PHASES = {
  WATCHING: 'watching',
  /** Foreleg up the screen: next reel. */
  SWIPING: 'swiping',
  /** Foreleg on the share arrow. */
  SHARING: 'sharing',
  /** Phone flat: 0%. It sits in the dark a while. */
  DEAD: 'dead',
  ASLEEP: 'asleep',
};

const MINUTES_PER_SECOND = { night: 1.3, asleep: 24, morning: 0 };
const NIGHT_START = 22 * 60 + 30;
const MORNING = 7 * 60 + 30;
const BATTERY_PER_MIN = 0.55;       // percent per minute of screen
const FEED_MEMORY = 24;             // reels the composition bar looks back over
const T = { swipe: 0.42, share: 0.75, morning: 6.5 };

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * The recommender, one per fly. It keeps an estimate of seconds watched per
 * category and serves by softmax over those, with a little exploration. It
 * has no idea what a spider is.
 */
export class Feed {
  constructor(rng) {
    this.rng = rng;
    this.expected = Object.fromEntries(CATS.map((c) => [c, 3.2]));
    this.served = [];
  }

  next() {
    let cat;
    if (this.rng() < 0.1) cat = CATS[Math.floor(this.rng() * CATS.length)];
    else {
      const temp = 0.9;
      const w = CATS.map((c) => Math.exp(this.expected[c] / temp));
      let x = this.rng() * w.reduce((a, b) => a + b, 0);
      cat = CATS[CATS.length - 1];
      for (let i = 0; i < CATS.length; i++) { x -= w[i]; if (x <= 0) { cat = CATS[i]; break; } }
    }
    this.served.push(cat);
    if (this.served.length > FEED_MEMORY) this.served.shift();
    return cat;
  }

  learn(cat, seconds) { this.expected[cat] += (seconds - this.expected[cat]) * 0.3; }

  /** Share of each category in what it has served lately. */
  get mix() {
    const n = Math.max(1, this.served.length);
    return Object.fromEntries(CATS.map((c) => [c, this.served.filter((x) => x === c).length / n]));
  }

  get doom() {
    const n = Math.max(1, this.served.length);
    return this.served.filter((c) => REELS[c].kind === 'threat').length / n;
  }

  /** The category it currently believes holds this fly best. */
  get favourite() { return CATS.reduce((a, b) => (this.expected[b] > this.expected[a] ? b : a)); }
}

let reelId = 0;
function makeReel(cat, rng, from = null) {
  return {
    id: ++reelId,
    cat,
    from,
    dur: 4 + rng() * 3,
    likes: Math.round(800 + rng() * 90000),
    seed: rng() * 1000,
  };
}

/** One fly and its phone. */
export class Scroller {
  constructor(duo, index, rng) {
    this.duo = duo;
    this.index = index;
    this.name = NAMES[index];
    this.rng = rng;
    this.feed = new Feed(rng);

    this.phase = PHASES.WATCHING;
    this.t = 0;
    this.reel = makeReel(this.feed.next(), rng);
    this.reelT = 0;
    this.peakDa = 0;
    this.peakOcto = 0;
    this.inbox = [];
    this.habit = Object.fromEntries(CATS.map((c) => [c, 0]));
    this.expectedValue = 0.35;       // what a reel is usually worth: RPE baseline

    // body and state
    this.dopamine = 0;
    this.octopamine = 0;
    this.startle = 0;
    this.fear = 0;
    this.npf = 0.5;
    this.memory = 0;
    this.learned = 0;
    this.neural = null;
    this.escape = 0;
    this.heartRate = 268;
    this.sleepPressure = 0.55 + index * 0.06;
    this.battery = 100 - index * 9;
    this.collapse = 0;
    this.lossStreak = 0;              // read by the shared stress gauge

    // what the brain is fed this frame
    this.rewardPulse = 0;
    this.punishPulse = 0;
    this.socialPulse = 0;
    this.buzz = 0;
    this.valuePulse = 0;

    // the foreleg on the screen
    this.grip = 0;
    this.swipe = 0;                   // 0..1 up the screen
    this.tap = 0;                     // 0..1 onto the share arrow
    this.flinch = 0;

    // the night's numbers
    this.screenMinutes = 0;
    this.reels = 0;
    this.sent = 0;
    this.received = 0;
    this.replies = 0;
    this.ignored = 0;
    this.flinches = 0;
    this.lastResult = null;
    this.history = [];
  }

  get friend() { return this.duo.flies[1 - this.index]; }
  get awake() { return this.phase !== PHASES.ASLEEP; }
  get screenOn() { return this.phase !== PHASES.ASLEEP && this.phase !== PHASES.DEAD; }
  get now() { return this.duo.now(); }
  get cat() { return REELS[this.reel.cat]; }
  /** How far a threat reel has come at the viewer: the loom. */
  get loom() {
    if (!this.screenOn || this.cat.kind !== 'threat') return 0;
    return clamp01(this.reelT / this.reel.dur) * this.cat.threat;
  }
  /** How strongly the screen holds attention right now. */
  get interest() {
    const c = this.cat;
    return c.reward * (1 - this.habit[this.reel.cat]) * 0.9
      + this.octopamine * 1.1 + this.dopamine * 0.45
      + (this.reel.from ? 0.45 : 0);
  }
  get boredom() { return 0.28 + clamp01(this.reelT / this.reel.dur) * 0.55; }

  record(r) {
    this.lastResult = { ...r, at: this.now, clock: this.duo.clock };
    this.history.push({ at: this.lastResult.at, kind: r.kind, cat: r.cat });
    if (this.history.length > 14) this.history.shift();
  }

  update(dt, dtMin) {
    this.t += dt;
    this.startle = Math.max(0, this.startle - dt / 1.3);
    for (const k of ['rewardPulse', 'punishPulse', 'socialPulse', 'buzz', 'valuePulse']) this[k] = Math.max(0, this[k] - dt * 1.8);
    this.flinch = Math.max(0, this.flinch - dt * 2.5);
    // habituation fades over the night
    for (const c of CATS) this.habit[c] = Math.max(0, this.habit[c] - dtMin * 0.004);

    switch (this.phase) {
      case PHASES.WATCHING: this.updateWatching(dt, dtMin); break;
      case PHASES.SWIPING: this.updateSwiping(dt); break;
      case PHASES.SHARING: this.updateSharing(dt); break;
      case PHASES.DEAD: this.updateDead(dt, dtMin); break;
      case PHASES.ASLEEP: this.updateAsleep(dt, dtMin); break;
      default: break;
    }
    if (this.screenOn) {
      this.screenMinutes += dtMin;
      this.battery = Math.max(0, this.battery - dtMin * BATTERY_PER_MIN * (0.8 + this.octopamine * 0.4));
      if (this.battery <= 0 && this.phase !== PHASES.DEAD) this.phoneDies();
    }
    this.updateBody(dt, dtMin);
  }

  updateWatching(dt, dtMin) {
    this.reelT += dt;
    this.grip += (0.35 - this.grip) * Math.min(1, dt * 3);   // holding, thumb near the screen
    this.swipe += (0 - this.swipe) * Math.min(1, dt * 6);
    this.tap += (0 - this.tap) * Math.min(1, dt * 6);
    this.peakDa = Math.max(this.peakDa, this.dopamine);
    this.peakOcto = Math.max(this.peakOcto, this.octopamine);
    // the giant fibre: a threat reel close enough, and it flinches — once a
    // reel; an escape reflex does not fire again while the threat stays put
    if (this.escape > 0.75 && !this.flinched && this.reelT > 0.5) {
      this.flinched = true;
      this.flinch = 1;
      this.flinches += 1;
      this.startle = 1;
      this.duo.emit('flinch', { fly: this.index });
    }
    // the other one wants to show it something: switch now
    if (this.switchNow) { this.switchNow = false; this.startSwipe(); return; }
    // a message waiting from earlier: once this reel has had a moment
    if (this.inbox.length && this.inbox[0].from && !this.reel.from && !this.reel.together && this.reelT > 0.6) {
      this.startSwipe();
      return;
    }
    if (this.reelT >= this.reel.dur) {
      // it loops: another round of the same reel
      this.reelT = 0;
      this.loops = (this.loops ?? 0) + 1;
      if (this.loops >= 2) { this.startSwipe(); return; }
    }
    if (this.reelT > 0.9 && this.interest < this.boredom) this.startSwipe();
    // sleep takes it mid-reel, phone in hand
    const light = 0.3 + this.octopamine * 0.35 + this.dopamine * 0.15;
    if (this.sleepPressure - light > 0.62) this.fallAsleep();
    void dtMin;
  }

  startSwipe() {
    const watched = this.reelT + (this.loops ?? 0) * this.reel.dur;
    this.finishReel(watched);
    this.phase = this.pendingShare ? PHASES.SHARING : PHASES.SWIPING;
    this.t = 0;
    this.duo.emit(this.phase === PHASES.SHARING ? 'shareStart' : 'swipe', { fly: this.index });
  }

  /** What watching that reel taught the feed, and what it does next with it. */
  finishReel(watched) {
    const r = this.reel;
    const c = REELS[r.cat];
    this.reels += 1;
    if (!r.from) this.feed.learn(r.cat, watched);
    this.habit[r.cat] = Math.min(0.9, this.habit[r.cat] + c.habit);
    const liked = this.peakDa > 0.34 || this.peakOcto > 0.58;
    this.record({ kind: 'watched', cat: r.cat, watched, from: r.from });
    if (r.together) {
      // watching it again alongside the other one: nothing to learn, nothing to send
      this.pendingShare = null;
    } else if (r.from !== null) {
      // a friend's reel gets an answer — or does not
      const reply = liked ? (c.kind === 'threat' ? 'OMG' : 'haha') : null;
      this.friend.onReaction(reply, r);
      this.duo.message(this.index, reply ?? 'seen', r);
    } else {
      // worth sending? dopamine or sheer arousal, and more so when the
      // other one has been answering
      const warm = Math.min(0.3, this.replies * 0.06);
      const score = (this.peakDa - 0.3) * 1.6 + (this.peakOcto - 0.45) * 1.2 + warm;
      this.pendingShare = score > 0.12 + this.rng() * 0.45 ? r : null;
    }
  }

  updateSwiping(dt) {
    const k = clamp01(this.t / T.swipe);
    this.grip = 1;
    this.swipe = easeInOut(k);
    if (k >= 1) this.nextReel();
  }

  updateSharing(dt) {
    const k = clamp01(this.t / T.share);
    this.grip = 1;
    this.tap = Math.sin(k * Math.PI);
    if (k >= 1) {
      const r = this.pendingShare;
      this.pendingShare = null;
      this.sent += 1;
      // "look at this": if the other one is free, both watch it now, together;
      // if it is busy — sending something itself, or on another friend reel —
      // it waits in the queue and gets watched later, alone
      const together = this.friend.free;
      const shareId = ++reelId;
      this.friend.receive({ ...r, shareId }, this.index, together);
      if (together) this.inbox.unshift({ ...r, id: ++reelId, shareId, from: null, together: this.friend.name });
      this.duo.message(this.index, 'reel', r);
      this.record({ kind: 'sent', cat: r.cat });
      this.phase = PHASES.SWIPING;
      this.t = 0;
    }
    void dt;
  }

  nextReel() {
    const fromFriend = this.inbox.shift();
    this.reel = fromFriend ?? makeReel(this.feed.next(), this.rng);
    this.reelT = 0;
    this.loops = 0;
    this.peakDa = 0;
    this.peakOcto = 0;
    this.flinched = false;
    this.phase = PHASES.WATCHING;
    this.t = 0;
    // reward prediction error: what this reel is worth against what reels
    // usually are. Opening a friend's reel is worth something by itself.
    const c = this.cat;
    const value = c.reward * (1 - this.habit[this.reel.cat]) + (this.reel.from ? 0.3 : 0);
    this.valuePulse = Math.max(0, value - this.expectedValue) * 2;
    this.expectedValue += (value - this.expectedValue) * 0.15;
    if (this.reel.from) this.socialPulse = Math.max(this.socialPulse, 0.6);
  }

  /** Free to switch to a reel from the other one right now. */
  get free() {
    return this.phase === PHASES.WATCHING && !this.reel.from && !this.reel.together && !this.pendingShare;
  }

  receive(reel, fromIndex, now = false) {
    this.received += 1;
    const copy = { ...reel, id: ++reelId, from: NAMES[fromIndex] };
    if (now) { this.inbox.unshift(copy); this.switchNow = true; }
    else this.inbox.push(copy);
    if (this.inbox.length > 4) this.inbox.pop();
    if (this.awake) { this.buzz = 1; this.startle = Math.max(this.startle, 0.35); }
    this.duo.emit('buzz', { fly: this.index });
  }

  /** The other fly answered one of this fly's reels — or left it on seen. */
  onReaction(reply) {
    if (reply) {
      this.replies += 1;
      this.socialPulse = 1;
      this.npf = clamp01(this.npf + 0.05);
    } else {
      this.ignored += 1;
      this.punishPulse = Math.max(this.punishPulse, 0.35);
      this.npf = clamp01(this.npf - 0.02);
    }
  }

  phoneDies() {
    this.phase = PHASES.DEAD;
    this.t = 0;
    this.record({ kind: 'dead' });
    this.duo.emit('dead', { fly: this.index });
  }

  updateDead(dt) {
    this.grip += (0 - this.grip) * Math.min(1, dt * 3);
    // in the dark, sleep comes quickly
    if (this.t > 5 || this.sleepPressure > 0.7) this.fallAsleep();
  }

  fallAsleep() {
    if (this.phase === PHASES.SWIPING || this.phase === PHASES.SHARING) return;
    this.phase = PHASES.ASLEEP;
    this.t = 0;
    this.pendingShare = null;
    this.record({ kind: 'asleep' });
    this.duo.emit('asleep', { fly: this.index });
  }

  updateAsleep(dt, dtMin) {
    this.grip += (0 - this.grip) * Math.min(1, dt * 3);
    this.collapse = Math.min(1, this.collapse + dt / 2);
    this.sleepPressure = Math.max(0, this.sleepPressure - dtMin / (7 * 60));
  }

  wake() {
    this.phase = PHASES.WATCHING;
    this.t = 0;
    this.collapse = 0;
    this.battery = 100;
    this.sleepPressure = 0.5 + this.rng() * 0.1;
    this.screenMinutes = 0;
    this.reels = 0;
    this.sent = 0;
    this.received = 0;
    this.replies = 0;
    this.ignored = 0;
    this.flinches = 0;
    this.inbox = [];
    this.nextReel();
  }

  updateBody(dt, dtMin) {
    if (this.awake) {
      this.sleepPressure += dtMin / (14 * 60);
      this.collapse = Math.max(0, this.collapse - dt / 2);
    }
    // fear: what the screen has been, and what the feed has turned into
    const target = clamp01(this.octopamine * 0.5 + this.feed.doom * 0.6 * (this.screenOn ? 1 : 0.3));
    this.fear += (target - this.fear) * (1 - Math.exp(-dt / (target > this.fear ? 2 : 6)));
    this.npf += (0.5 - this.npf) * (1 - Math.exp(-dtMin / 180)) - this.fear * 0.0015 * dtMin;
    this.npf = clamp01(this.npf);

    if (this.neural) {
      const span = 0.22;
      this.dopamine = clamp01((this.neural.reward - this.neuralRest) / span);
      this.octopamine = clamp01((this.neural.punish - this.neuralRestPunish) / span * 0.8 + this.startle);
    } else {
      this.dopamine += (this.valuePulse + this.socialPulse * 0.6 - this.dopamine) * Math.min(1, dt * 3);
      this.octopamine += (this.loom + this.startle - this.octopamine) * Math.min(1, dt * 3);
      this.dopamine = clamp01(this.dopamine);
      this.octopamine = clamp01(this.octopamine);
    }
    const want = 268 + 130 * clamp01(this.octopamine * 0.6 + this.fear * 0.3 + this.dopamine * 0.3);
    const heart = this.phase === PHASES.ASLEEP ? 220 : want;
    this.heartRate += (heart - this.heartRate) * (1 - Math.exp(-dt / 0.6));
  }

  get arousal() { return clamp01(this.dopamine * 0.5 + this.octopamine * 0.7) * (1 - this.collapse); }
  /**
   * What the stress gauge adds on top of fear and arousal: a feed gone to
   * doom, being left on seen, and the last few percent of battery.
   */
  get stressExtra() {
    return this.feed.doom * 0.2 + Math.min(0.15, this.ignored * 0.03)
      + (this.screenOn && this.battery < 10 ? 0.08 : 0);
  }
  /** The flinch, as the body jolt the fly rig already knows how to play. */
  get seizureFit() { return this.flinch * 0.7; }
  get deliberation() { return this.phase === PHASES.WATCHING ? clamp01(this.reelT / this.reel.dur) : 0; }

  // --------------------------------------------------------- from brain
  setNeuralReadout(reward, punish) {
    this.neural = { reward, punish };
    if (this.neuralRest === undefined) this.setNeuralRest(reward, punish);
  }

  setNeuralRest(reward, punish) { this.neuralRest = reward; this.neuralRestPunish = punish; }
  setMemory(value, learned) { this.memory = value; this.learned = learned; }
  setEscape(e) { this.escape = e; }
}

/** The two of them, the clock, and the thread between their phones. */
export class Duo {
  constructor({ seed = 1, onEvent = () => {}, now = () => Date.now() } = {}) {
    this.rng = makeRng(seed);
    this.onEvent = onEvent;
    this.now = now;
    this.minute = NIGHT_START;
    this.night = 1;
    this.flies = [new Scroller(this, 0, makeRng(seed * 7 + 1)), new Scroller(this, 1, makeRng(seed * 13 + 5))];
    this.thread = [];                 // the chat between them
    this.sync = 0;                    // brain sync, set by the brain
    this.morning = null;              // the report, between nights
    this.morningT = 0;
    this.exchanged = 0;
    this.lastEvent = null;
  }

  emit(type, detail) { this.lastEvent = { type, at: this.now(), detail }; this.onEvent(type, detail); }

  get clock() {
    const m = Math.floor(this.minute) % (24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  message(fromIndex, kind, reel) {
    if (kind === 'reel') this.exchanged += 1;
    this.thread.push({ at: this.now(), from: fromIndex, kind, cat: reel?.cat, clock: this.clock });
    if (this.thread.length > 30) this.thread.shift();
  }

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    if (this.morning) {
      this.morningT += dt;
      if (this.morningT >= T.morning) this.nextNight();
      return this;
    }
    const allAsleep = this.flies.every((f) => !f.awake);
    const rate = allAsleep ? MINUTES_PER_SECOND.asleep : MINUTES_PER_SECOND.night;
    const dtMin = dt * rate;
    this.minute += dtMin;
    for (const f of this.flies) f.update(dt, dtMin);
    const m = this.minute % (24 * 60);
    if (allAsleep && m >= MORNING && m < 12 * 60) this.dawn();
    return this;
  }

  dawn() {
    this.morning = this.flies.map((f) => ({
      name: f.name,
      screen: f.screenMinutes,
      reels: f.reels,
      sent: f.sent,
      replies: f.replies,
      ignored: f.ignored,
      flinches: f.flinches,
      doom: f.feed.doom,
      favourite: f.feed.favourite,
    }));
    this.morningT = 0;
    this.emit('morning', this.morning);
  }

  nextNight() {
    this.morning = null;
    this.night += 1;
    // the same day's evening: the morning is 07:30, the next night 22:30
    this.minute = Math.floor(this.minute / (24 * 60)) * 24 * 60 + NIGHT_START;
    for (const f of this.flies) f.wake();
    this.emit('night', { night: this.night });
  }
}
