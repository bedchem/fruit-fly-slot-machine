/**
 * The market the fly trades: one ticker, $BNNA — banana futures, the only
 * asset a fruit fly has an opinion on.
 *
 * Entirely synthetic and seeded, so a session can be replayed exactly and
 * nothing is fetched from anywhere. Prices move as a random walk whose drift
 * and volatility come from a hidden regime, switched by a Markov chain:
 *
 *   calm      drifting up slowly, low volatility
 *   bull      a trend up
 *   bear      a trend down
 *   chop      no drift, high volatility — trends that are not trends
 *   bubble    an accelerating rise that ends, always, in a crash
 *   crash     a few minutes of free fall
 *
 * News arrives now and then as a headline and a jump. The fly cannot read;
 * the headlines are for the visitor.
 *
 * Paper money only. Nothing here is a real market, a real price or advice.
 */

export const TICKER = 'BNNA';
export const START_PRICE = 100;
/** Minutes in a session, 09:30 to 16:00. */
export const SESSION_MINUTES = 390;
const OPEN_MINUTE = 9 * 60 + 30;
/** Minutes per candle on the chart. */
export const CANDLE_MINUTES = 5;
const MAX_CANDLES = 90;

const REGIMES = {
  calm:   { drift: 0.00012, vol: 0.0018, stay: 0.985, next: { bull: 0.35, bear: 0.25, chop: 0.3, bubble: 0.1 } },
  bull:   { drift: 0.00085, vol: 0.0026, stay: 0.975, next: { calm: 0.4, chop: 0.25, bubble: 0.2, bear: 0.15 } },
  bear:   { drift: -0.0009, vol: 0.003, stay: 0.975, next: { calm: 0.4, chop: 0.35, bull: 0.25 } },
  chop:   { drift: 0, vol: 0.0048, stay: 0.97, next: { calm: 0.35, bull: 0.3, bear: 0.35 } },
  bubble: { drift: 0.0022, vol: 0.0032, stay: 0.965, next: { crash: 1 } },
  crash:  { drift: -0.012, vol: 0.006, stay: 0.82, next: { bear: 0.6, chop: 0.4 } },
};

const NEWS = [
  { text: 'Record harvest in Ecuador — supply floods the market', jump: -0.035 },
  { text: 'Banana blight spreads across plantations', jump: 0.045 },
  { text: 'Smoothie chain signs exclusive banana deal', jump: 0.03 },
  { text: 'Regulators probe "overripe" futures', jump: -0.03 },
  { text: 'Fruit bowl ETF adds $BNNA to its index', jump: 0.025 },
  { text: 'Shipping delays: containers of bananas stuck at sea', jump: 0.02 },
  { text: 'Study: apples are the new bananas', jump: -0.025 },
  { text: 'Influencer calls bananas "the potassium of the future"', jump: 0.035 },
  { text: 'Cold snap threatens the crop', jump: 0.028 },
  { text: 'Warehouse finds 40 tonnes of forgotten bananas', jump: -0.04 },
];

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(rng) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Market {
  constructor({ seed = 20260921, rng } = {}) {
    this.rng = rng ?? makeRng(seed);
    this.price = START_PRICE;
    this.minute = 0;          // minutes since the first open
    this.day = 1;
    this.regime = 'calm';
    this.candles = [];
    this.news = null;         // { text, jump, at } — the latest headline
    this.newsLog = [];
    this.history = [START_PRICE];   // one price per minute, recent first-out
    this.dayOpen = START_PRICE;
    this.open = true;
    this.startCandle();
  }

  get clock() {
    const m = OPEN_MINUTE + (this.minute % SESSION_MINUTES);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  /** Return over the last `n` minutes. */
  change(n) {
    const h = this.history;
    const past = h[Math.max(0, h.length - 1 - n)];
    return this.price / past - 1;
  }

  /** Realised volatility per minute over the last `n` minutes. */
  volatility(n = 30) {
    const h = this.history;
    const k = Math.min(n, h.length - 1);
    if (k < 2) return REGIMES.calm.vol;
    let s = 0, s2 = 0;
    for (let i = h.length - k; i < h.length; i++) {
      const r = Math.log(h[i] / h[i - 1]);
      s += r; s2 += r * r;
    }
    const mean = s / k;
    return Math.sqrt(Math.max(0, s2 / k - mean * mean));
  }

  startCandle() {
    this.candle = { o: this.price, h: this.price, l: this.price, c: this.price, at: this.minute };
    this.candles.push(this.candle);
    if (this.candles.length > MAX_CANDLES) this.candles.shift();
  }

  /** One minute of trading. Returns the headline if one broke this minute. */
  tick() {
    const r = REGIMES[this.regime];
    // regime switch
    if (this.rng() > r.stay) {
      let x = this.rng();
      for (const [name, p] of Object.entries(r.next)) {
        x -= p;
        if (x <= 0) { this.regime = name; break; }
      }
    }
    const reg = REGIMES[this.regime];
    let ret = reg.drift + reg.vol * gauss(this.rng);
    let headline = null;
    // news: rarely, and never in the middle of a crash
    if (this.regime !== 'crash' && this.rng() < 0.006) {
      const n = NEWS[Math.floor(this.rng() * NEWS.length)];
      ret += n.jump;
      headline = { ...n, at: this.minute, clock: this.clock, day: this.day };
      this.news = headline;
      this.newsLog.push(headline);
      if (this.newsLog.length > 8) this.newsLog.shift();
    }
    // a floor, so a long bear run cannot take bananas to zero
    this.price = Math.max(5, this.price * Math.exp(ret));
    this.history.push(this.price);
    if (this.history.length > 600) this.history.shift();

    const c = this.candle;
    c.c = this.price;
    if (this.price > c.h) c.h = this.price;
    if (this.price < c.l) c.l = this.price;

    this.minute += 1;
    if (this.minute % SESSION_MINUTES === 0) {
      // the close: overnight, the price gaps
      this.day += 1;
      const gap = 0.012 * gauss(this.rng) + REGIMES[this.regime].drift * 60;
      this.price = Math.max(5, this.price * Math.exp(gap));
      this.history.push(this.price);
      this.dayOpen = this.price;
      this.startCandle();
    } else if (this.minute % CANDLE_MINUTES === 0) {
      this.startCandle();
    }
    return headline;
  }
}
