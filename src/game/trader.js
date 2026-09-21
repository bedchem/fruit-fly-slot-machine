/**
 * The fly's trading account, as one deterministic state machine.
 *
 * It paper-trades $BNNA (market.js) by pressing two arcade buttons with its
 * right foreleg: one press, one unit of thirty shares. Long or short, up to five
 * units either way. Nothing here touches React or three.js; the scene reads
 * the continuous values, the UI reads the discrete ones, and
 * tools/sim-trade.mjs runs the same class headless against the same brain.
 *
 * What it trades on is what it SEES. The chart is on a monitor in front of
 * it; the brain (neural/traderBrain.js) turns the chart's motion into current
 * in the real upward and downward motion detectors of the optic lobe, and
 * hands back what the wiring downstream of them makes of it. That — not the
 * price — is `perceivedTrend`. A crash on screen is a looming stimulus; it
 * reaches the giant fibre, and the giant fibre makes the fly flee: it dumps
 * everything, whatever its plan was.
 *
 * Two other accounts trade alongside it for comparison, with the same money,
 * the same fees and the same moments of decision: one buys at the start and
 * never touches it again, and one flips a coin.
 *
 * Paper money only. Nothing here is investment advice, or a real market.
 */
import { Market, makeRng } from './market.js';

export const PHASES = {
  IDLE: 'idle',
  /** Foreleg on the buttons, working through an order one unit at a time. */
  PRESSING: 'pressing',
  /** Equity fell below maintenance: the broker closes everything. */
  MARGIN_CALL: 'margin-call',
  /** Between sessions. */
  CLOSED: 'closed',
};

export const START_CASH = 10000;
export const SHARES_PER_UNIT = 30;   // five units is 1.5x the stake: paper leverage
export const MAX_UNITS = 5;
const FEE = 0.0005;               // of notional, per press
const MAINTENANCE = 0.5;          // margin call below half the stake
/**
 * Giant fibre activity, above its resting level, at which the fly escapes.
 * Ordinary arousal keeps it around 0.3; a crash on screen drives it past 1.
 */
const ESCAPE_THRESHOLD = 0.75;
/** Market minutes per real second while the session is open. */
const MINUTES_PER_SECOND = 3.2;

/** The foreleg on a button, seconds. */
const T = {
  reach: 0.28, press: 0.12, lift: 0.14, release: 0.35,
  panicPress: 0.16,
  marginCall: 5.5,
  closed: 3.2,
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const clamp01 = (x) => clamp(x, 0, 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Which pull on the decision is winning, in words. */
export function tradeReason(a, target, position) {
  if (a.capitulate) return 'the loss finally hurts more than admitting it';
  if (a.holdLoser) return 'down on this one — not selling at a loss';
  if (a.takeProfit) return 'up on this one — locking it in while PAM fires';
  if (target === position) return Math.abs(a.follow) < 0.12 ? 'the chart is not moving it' : 'happy where it is';
  const up = target > position;
  if (a.chase > 0.3 && Math.abs(target) >= 4) return 'NPF low — it needs a win, sizing up';
  if (a.caution > 0.45) return 'shaken — cutting its size';
  if (a.memory < -0.25) return 'remembers getting burned — careful';
  if (Math.abs(a.follow) > 0.45) return up ? 'everything on screen is moving up' : 'everything on screen is moving down';
  return up ? 'leaning with the upward drift' : 'leaning with the downward drift';
}

export class Trader {
  constructor({ onEvent = () => {}, seed = 20260921, rng, now = () => Date.now() } = {}) {
    this.onEvent = onEvent;
    this.rng = rng ?? makeRng(seed ^ 0x5bd1e995);
    this.coinRng = makeRng(seed ^ 0x27d4eb2d);
    this.now = now;
    this.market = new Market({ seed });

    this.phase = PHASES.IDLE;
    this.t = 0;
    this.marketAcc = 0;

    // --- the account -------------------------------------------------------
    this.cash = START_CASH;
    this.position = 0;          // units, negative is short
    this.avgCost = 0;           // per share
    this.realized = 0;
    this.fees = 0;
    this.deposits = START_CASH; // paper money put in, refills included
    this.peakEquity = START_CASH;
    this.trades = 0;
    this.wins = 0;
    this.losses = 0;
    this.marginCalls = 0;
    this.panics = 0;
    this.biggestWin = 0;
    this.biggestLoss = 0;

    // --- the benchmarks ----------------------------------------------------
    this.holdShares = START_CASH / this.market.price;
    this.coin = { cash: START_CASH, position: 0, fees: 0 };

    // --- state -------------------------------------------------------------
    this.dopamine = 0;
    this.octopamine = 0;
    this.startle = 0;
    this.fear = 0;
    this.npf = 0.55;
    this.memory = 0;
    this.learned = 0;
    this.neural = null;
    this.heartRate = 268;
    this.perceivedTrend = 0;    // from the optic lobe, via the brain
    this.escape = 0;            // giant fibre, via the brain
    this.lossStreak = 0;
    this.collapse = 0;

    // --- what is on screen, as the eye gets it ------------------------------
    this.motion = 0;            // signed, smoothed vertical motion of the chart
    this.loom = 0;              // 0..1: a crash filling the screen
    this.rewardPulse = 0;
    this.punishPulse = 0;

    // --- the foreleg ---------------------------------------------------------
    this.grip = 0;
    this.pressDepth = 0;
    this.button = null;         // 'buy' | 'sell' while pressing
    this.order = null;          // { target, why, panic }
    this.pressT = 0;
    this.pressed = { buy: 0, sell: 0 };   // button travel, for the scene

    this.lastResult = null;
    this.history = [];
    /** One sample a market minute: the three accounts' P&L, for the race screen. */
    this.curve = [];
    /** Every fill, for the tape screen: { minute, day, price, dir, panic }. */
    this.fills = [];
    this.idleFor = 0;
    this.nextDecisionAfter = 2.5;
    this.panicCooldown = 0;
    this.lastEvent = null;
  }

  emit(type, detail) { this.lastEvent = { type, at: this.now() }; this.onEvent(type, detail); }

  // ================================================================ money

  get price() { return this.market.price; }
  get exposure() { return this.position * SHARES_PER_UNIT * this.price; }
  get equity() { return this.cash + this.exposure; }
  /** Profit since the start, paper money topped up after margin calls excluded. */
  get pnl() { return this.equity - this.deposits; }
  get unrealized() {
    return this.position ? (this.price - this.avgCost) * this.position * SHARES_PER_UNIT : 0;
  }
  get unrealizedPct() {
    return this.position ? (this.price / this.avgCost - 1) * Math.sign(this.position) : 0;
  }
  get drawdown() { return clamp01(1 - this.equity / this.peakEquity); }
  get holdPnl() { return this.holdShares * this.price - START_CASH; }
  get coinPnl() { return this.coin.cash + this.coin.position * SHARES_PER_UNIT * this.price - START_CASH; }

  /** One unit, at the current price. Returns the realised profit of that unit. */
  fill(dir) {
    const p = this.price;
    const shares = SHARES_PER_UNIT;
    const fee = p * shares * FEE;
    this.cash -= dir * p * shares + fee;
    this.fees += fee;
    let realized = 0;
    const before = this.position;
    if (before !== 0 && Math.sign(before) !== dir) {
      // closing a unit
      realized = (p - this.avgCost) * shares * Math.sign(before) - fee;
      this.realized += realized;
      this.position += dir;
      if (this.position === 0) this.avgCost = 0;
    } else {
      // opening or adding
      const n = Math.abs(before);
      this.avgCost = (this.avgCost * n + p) / (n + 1);
      this.position += dir;
      realized = -fee;
    }
    this.pressed[dir > 0 ? 'buy' : 'sell'] = 1;
    this.fills.push({ minute: this.market.minute, day: this.market.day, price: p, dir, panic: !!this.order?.panic });
    if (this.fills.length > 300) this.fills.shift();
    return realized;
  }

  // ============================================================ decisions

  /**
   * What it wants to hold, and why. Evaluated all the time so the panel can
   * show what it is leaning towards.
   *
   *   follow   the perceived trend, from the optic lobe. Flies turn with
   *            wide-field motion — the optomotor response — and this is the
   *            same wiring deciding which way to lean. Momentum trading as
   *            a reflex.
   *   memory   what the mushroom body has learned about being in this
   *            market: profits through PAM, losses through PPL1.
   *   chase    low NPF — a fly on a losing run sizes up to win it back.
   *   greed    dopamine still up from the last win.
   *   caution  the defensive state and the drawdown: it trades smaller.
   *
   * and two biases people have names for: it sells winners early while PAM is
   * firing (the disposition effect), and it will not sell a loser until the
   * loss hurts more than admitting it (loss aversion) — then it capitulates.
   */
  get appetite() {
    const follow = clamp(this.perceivedTrend, -1, 1);
    const memory = clamp(this.memory * 0.5, -0.4, 0.4);
    const chase = (1 - this.npf) * 0.6;
    const greed = this.dopamine * 0.35;
    const caution = clamp01(this.fear * 0.55 + this.drawdown * 1.6);
    const conviction = Math.abs(follow) * (1 + chase + greed + memory);
    const size = clamp01((conviction - 0.08) * 1.5) * (1 - caution * 0.75);
    let target = Math.sign(follow) * Math.round(size * MAX_UNITS);

    const u = this.unrealizedPct;
    const exiting = this.position !== 0 && (target === 0 || Math.sign(target) !== Math.sign(this.position)
      || Math.abs(target) < Math.abs(this.position));
    const takeProfit = this.position !== 0 && u > 0.018 && this.dopamine > 0.25;
    if (takeProfit) target = Math.round(this.position / 2);
    const pain = this.octopamine * 0.6 + this.fear * 0.4;
    const capitulate = this.position !== 0 && u < 0 && (u < -0.06 || pain > 0.62);
    const holdLoser = !capitulate && exiting && u < -0.004 && !takeProfit;
    if (holdLoser) target = this.position;
    if (capitulate) target = 0;
    target = clamp(target, -MAX_UNITS, MAX_UNITS);
    return { follow, memory, chase, greed, caution, size, target, takeProfit, holdLoser, capitulate };
  }

  decide() {
    const a = this.appetite;
    // a little doubt: the same state does not always produce the same order
    let target = a.target;
    if (!a.holdLoser && !a.capitulate && this.rng() < 0.18) target = clamp(target + (this.rng() < 0.5 ? -1 : 1), -MAX_UNITS, MAX_UNITS);
    this.coinDecides();
    if (target === this.position) {
      this.record({ kind: 'hold', why: tradeReason(a, target, this.position) });
      return false;
    }
    this.startOrder(target, tradeReason(a, target, this.position), false);
    return true;
  }

  /** The coin trades at the same moments, with the same limits and fees. */
  coinDecides() {
    const c = this.coin;
    const target = Math.round((this.coinRng() * 2 - 1) * MAX_UNITS);
    const d = target - c.position;
    if (!d) return;
    const fee = Math.abs(d) * SHARES_PER_UNIT * this.price * FEE;
    c.cash -= d * SHARES_PER_UNIT * this.price + fee;
    c.fees += fee;
    c.position = target;
  }

  startOrder(target, why, panic) {
    this.order = { target, why, panic, from: this.position, realized: 0, startPrice: this.price };
    this.phase = PHASES.PRESSING;
    this.button = target > this.position ? 'buy' : 'sell';
    this.pressT = 0;
    this.stage = this.grip > 0.9 ? 'press' : 'reach';
    this.t = 0;
    this.emit(panic ? 'panic' : 'reach', { button: this.button });
  }

  record(r) {
    this.lastResult = { ...r, at: this.now(), price: this.price, clock: this.market.clock, day: this.market.day };
    if (r.kind !== 'hold') {
      this.history.push({ at: this.lastResult.at, kind: r.kind, pnl: r.realized ?? 0, units: r.units ?? 0 });
      if (this.history.length > 12) this.history.shift();
    }
  }

  // =============================================================== update

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;

    if (this.phase === PHASES.CLOSED) {
      if (this.t >= T.closed) { this.phase = PHASES.IDLE; this.t = 0; this.emit('open'); }
    } else {
      this.marketAcc += dt * MINUTES_PER_SECOND;
      while (this.marketAcc >= 1) {
        this.marketAcc -= 1;
        const before = this.market.day;
        const news = this.market.tick();
        this.curve.push({ fly: this.pnl, hold: this.holdPnl, coin: this.coinPnl });
        if (this.curve.length > 800) this.curve.shift();
        if (news) { this.startle = Math.max(this.startle, 0.5); this.emit('news', news); }
        if (this.market.day !== before) { this.closeSession(); break; }
      }
    }

    switch (this.phase) {
      case PHASES.PRESSING: this.updatePressing(dt); break;
      case PHASES.MARGIN_CALL: this.updateMarginCall(dt); break;
      default: this.relax(dt);
    }
    this.updateEyes(dt);
    this.updateSignals(dt);
    this.checkMargin();
    this.updateAutonomy(dt);

    for (const k of ['buy', 'sell']) this.pressed[k] = Math.max(0, this.pressed[k] - dt * 6);
    this.peakEquity = Math.max(this.peakEquity, this.equity);
    return this;
  }

  closeSession() {
    // an order in progress finishes first; the close waits for the foreleg
    if (this.phase === PHASES.PRESSING) this.closePending = true;
    else { this.phase = PHASES.CLOSED; this.t = 0; }
    this.record({ kind: 'close' });
    this.emit('close', { day: this.market.day - 1 });
  }

  relax(dt) {
    const k = Math.min(1, dt * 5);
    this.grip += (0 - this.grip) * k;
    this.pressDepth += (0 - this.pressDepth) * k;
    this.collapse = Math.max(0, this.collapse - dt / 2.5);
  }

  updatePressing(dt) {
    const o = this.order;           // null once released: the order is filled
    const panic = !!o?.panic;
    const press = panic ? T.panicPress : T.press;
    const lift = panic ? T.panicPress : T.lift;
    if (this.stage === 'reach') {
      this.grip = easeInOut(clamp01(this.t / T.reach));
      this.pressDepth = 0;
      if (this.t >= T.reach) { this.stage = 'press'; this.t = 0; }
    } else if (this.stage === 'press') {
      this.grip = 1;
      this.pressDepth = easeInOut(clamp01(this.t / press));
      if (this.t >= press) {
        const dir = this.button === 'buy' ? 1 : -1;
        o.realized += this.fill(dir);
        this.emit('press', { button: this.button, position: this.position });
        this.stage = 'lift'; this.t = 0;
      }
    } else if (this.stage === 'lift') {
      this.pressDepth = 1 - easeInOut(clamp01(this.t / lift));
      if (this.t >= lift) {
        if (this.position !== o.target) { this.stage = 'press'; this.t = 0; }
        else { this.stage = 'release'; this.t = 0; this.finishOrder(); }
      }
    } else {
      this.grip = 1 - easeInOut(clamp01(this.t / T.release));
      if (this.t >= T.release) {
        this.grip = 0;
        this.button = null;
        this.phase = this.closePending ? PHASES.CLOSED : PHASES.IDLE;
        this.closePending = false;
        this.t = 0;
      }
    }
  }

  finishOrder() {
    const o = this.order;
    const units = o.target - o.from;
    const closedSome = Math.abs(o.target) < Math.abs(o.from) || Math.sign(o.target) !== Math.sign(o.from);
    this.trades += Math.abs(units);
    let kind = o.panic ? 'panic' : units > 0 ? 'buy' : 'sell';
    if (closedSome && o.from !== 0) {
      const r = o.realized;
      if (r > 0) { this.wins += 1; this.lossStreak = 0; this.biggestWin = Math.max(this.biggestWin, r); }
      else { this.losses += 1; this.lossStreak += 1; this.biggestLoss = Math.min(this.biggestLoss, r); }
      // realised money is what teaches it: PAM on a win, PPL1 on a loss,
      // scaled by how much it meant against the account
      const k = clamp(Math.abs(r) / (START_CASH * 0.01), 0.25, 1.4);
      if (r > 0) { this.rewardPulse = k; this.npf = clamp01(this.npf + 0.07 * k); }
      else { this.punishPulse = k; this.npf = clamp01(this.npf - 0.06 * k); this.startle = Math.max(this.startle, 0.35 * k); }
    }
    this.record({ kind, units, from: o.from, to: o.target, realized: o.realized, why: o.why });
    this.emit('filled', { kind, units, realized: o.realized, position: this.position });
    this.order = null;
  }

  checkMargin() {
    if (this.phase === PHASES.MARGIN_CALL) return;
    if (this.equity >= START_CASH * MAINTENANCE) return;
    // the broker does not wait for the foreleg
    const price = this.price;
    const pos = this.position;
    if (pos) {
      const fee = Math.abs(pos) * SHARES_PER_UNIT * price * FEE;
      this.cash += pos * SHARES_PER_UNIT * price - fee;
      this.realized += (price - this.avgCost) * pos * SHARES_PER_UNIT - fee;
      this.fees += fee;
    }
    this.position = 0;
    this.avgCost = 0;
    this.order = null;
    this.button = null;
    this.closePending = false;
    this.phase = PHASES.MARGIN_CALL;
    this.t = 0;
    this.marginCalls += 1;
    this.punishPulse = 1.4;
    this.startle = 1;
    this.npf = clamp01(this.npf - 0.25);
    this.history.push({ at: this.now(), kind: 'margin' });
    if (this.history.length > 12) this.history.shift();
    this.record({ kind: 'margin', units: -pos });
    this.emit('marginCall');
  }

  updateMarginCall(dt) {
    this.grip += (0 - this.grip) * Math.min(1, dt * 4);
    this.pressDepth = 0;
    this.collapse = Math.min(0.8, this.collapse + dt / 1.5);
    if (this.t >= T.marginCall) {
      // more paper money: nothing about it was ever real
      const top = START_CASH - this.cash;
      this.cash = START_CASH;
      this.deposits += top;
      this.peakEquity = START_CASH;
      this.phase = PHASES.IDLE;
      this.t = 0;
      this.idleFor = 0;
      this.nextDecisionAfter = 3;
      this.record({ kind: 'refill' });
      this.emit('refill');
    }
  }

  // ============================================================ the eyes

  /**
   * What the monitor puts on the retina. The newest candle moving up or down
   * is vertical motion across much of the visual field; a crash is a red bar
   * growing fast towards the fly — a loom.
   */
  updateEyes(dt) {
    const m = this.market;
    const vol = Math.max(0.0015, m.volatility(40));
    const recent = m.change(4) / (vol * 2);
    this.motion += (clamp(recent, -1.5, 1.5) - this.motion) * Math.min(1, dt * 2.5);
    const drop = -m.change(12);
    const target = clamp01((drop - 0.022) / 0.04);
    this.loom += (target - this.loom) * Math.min(1, dt * (target > this.loom ? 6 : 1.2));
  }

  get upMotion() { return clamp01(this.motion); }
  get downMotion() { return clamp01(-this.motion); }

  updateSignals(dt) {
    this.rewardPulse = Math.max(0, this.rewardPulse - dt * 2.2);
    this.punishPulse = Math.max(0, this.punishPulse - dt * 2.2);
    this.startle = Math.max(0, this.startle - dt / 1.4);
    this.panicCooldown = Math.max(0, this.panicCooldown - dt);

    if (this.neural) {
      const span = 0.22;
      this.dopamine = clamp01((this.neural.reward - this.neuralRest) / span);
      this.octopamine = clamp01((this.neural.punish - this.neuralRestPunish) / span * 0.8 + this.startle);
    } else {
      // fallback while the connectome loads: the eye's own numbers
      this.perceivedTrend = this.motion * 0.6;
      this.dopamine += (this.rewardPulse * 0.8 - this.dopamine) * Math.min(1, dt * 3);
      this.octopamine += (this.punishPulse * 0.6 + this.startle + this.loom * 0.6 - this.octopamine) * Math.min(1, dt * 3);
    }

    // the defensive state: losing money, and the market lurching
    const vol = this.market.volatility(30) / 0.003;
    const target = clamp01(this.drawdown * 2.2 + clamp01(vol - 1) * 0.3 + this.loom * 0.6 + clamp01(this.lossStreak / 5) * 0.3
      + (this.phase === PHASES.MARGIN_CALL ? 1 : 0));
    this.fear += (target - this.fear) * (1 - Math.exp(-dt / (target > this.fear ? 1.2 : 4)));
    // NPF drifts home slowly
    this.npf += (0.55 - this.npf) * (1 - Math.exp(-dt / 90));

    const want = 268 + 132 * clamp01(this.octopamine * 0.6 + this.fear * 0.4 + this.dopamine * 0.3 + this.grip * 0.15);
    this.heartRate += (want - this.heartRate) * (1 - Math.exp(-dt / 0.5));

    // the giant fibre: past threshold the fly escapes — it sells everything
    if (this.escape > ESCAPE_THRESHOLD && this.position !== 0 && this.panicCooldown === 0
      && this.phase !== PHASES.MARGIN_CALL && this.phase !== PHASES.CLOSED) {
      this.panics += 1;
      this.panicCooldown = 12;
      this.startle = 1;
      this.startOrder(0, 'giant fibre fired — escape', true);
    }
  }

  updateAutonomy(dt) {
    if (this.phase !== PHASES.IDLE) { this.idleFor = 0; return; }
    this.idleFor += dt;
    if (this.idleFor < this.nextDecisionAfter) return;
    this.idleFor = 0;
    this.decide();
    const hesitation = this.fear * 1.5 + (this.lossStreak > 2 ? 0.8 : 0);
    this.nextDecisionAfter = 1.8 + hesitation + this.rng() * 1.8;
  }

  get deliberation() {
    if (this.phase !== PHASES.IDLE) return 0;
    return clamp01(this.idleFor / Math.max(0.1, this.nextDecisionAfter));
  }

  get arousal() {
    return clamp01(this.dopamine * 0.6 + this.octopamine * 0.7 + this.fear * 0.3) * (1 - this.collapse);
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

  setVision(trend, escape) {
    this.perceivedTrend = trend;
    this.escape = escape;
  }

  setMemory(value, learned) {
    this.memory = value;
    this.learned = learned;
  }
}
