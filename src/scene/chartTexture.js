/**
 * Draws the $BNNA chart: candles, the price, the fly's position and its
 * average cost, and whatever the market is shouting right now. The same
 * painter fills the monitor in the 3D scene (as a texture) and the chart in
 * the panel (as a plain canvas), so what the visitor reads is exactly what
 * the fly is looking at.
 */
import { TICKER } from '../game/market.js';
import { PHASES } from '../game/trader.js';

const UP = '#3fbf6a';
const DOWN = '#e0503a';
const INK = '#e9e2d4';
const DIM = 'rgba(233,226,212,0.45)';
const GRID = 'rgba(233,226,212,0.08)';
const BG = '#11151c';
const ACCENT = '#de7a22';

const money = (x) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/**
 * @param ctx      2D context, any size
 * @param tr       the Trader
 * @param opts     { header: draw the ticker line, compact: fewer labels }
 */
export function drawChart(ctx, tr, { header = true, compact = false } = {}) {
  const { width: W, height: H } = ctx.canvas;
  const m = tr.market;
  const s = W / 1024;                   // everything is laid out at 1024 wide
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const top = header ? 92 * s : 14 * s;
  const bottom = H - (compact ? 16 : 58) * s;
  const left = 18 * s;
  const right = W - 96 * s;
  const candles = m.candles;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
  if (tr.position) { lo = Math.min(lo, tr.avgCost); hi = Math.max(hi, tr.avgCost); }
  const pad = (hi - lo) * 0.08 + 0.2;
  lo -= pad; hi += pad;
  const y = (p) => bottom - (p - lo) / (hi - lo) * (bottom - top);

  // grid and price scale
  ctx.font = `${Math.round(18 * s)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const step = niceStep((hi - lo) / 5);
  for (let p = Math.ceil(lo / step) * step; p < hi; p += step) {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, y(p)); ctx.lineTo(right, y(p)); ctx.stroke();
    if (!compact) { ctx.fillStyle = DIM; ctx.fillText(p.toFixed(step < 1 ? 1 : 0), right + 12 * s, y(p)); }
  }

  // candles
  const n = 90;
  const cw = (right - left) / n;
  const x0 = right - candles.length * cw;
  candles.forEach((c, i) => {
    const up = c.c >= c.o;
    ctx.strokeStyle = ctx.fillStyle = up ? UP : DOWN;
    const cx = x0 + (i + 0.5) * cw;
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.beginPath(); ctx.moveTo(cx, y(c.h)); ctx.lineTo(cx, y(c.l)); ctx.stroke();
    const yo = y(c.o), yc = y(c.c);
    ctx.fillRect(cx - cw * 0.34, Math.min(yo, yc), cw * 0.68, Math.max(1.5 * s, Math.abs(yc - yo)));
  });

  // the fly's average cost, when it holds something
  if (tr.position) {
    const ya = y(tr.avgCost);
    ctx.setLineDash([8 * s, 7 * s]);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(left, ya); ctx.lineTo(right, ya); ctx.stroke();
    ctx.setLineDash([]);
    if (!compact) {
      ctx.fillStyle = ACCENT;
      ctx.fillText(`${tr.position > 0 ? 'LONG' : 'SHORT'} ${Math.abs(tr.position)}`, left + 8 * s, ya - 16 * s);
    }
  }

  // the last price, tagged on the scale
  const last = m.price;
  const yl = y(last);
  const dayUp = last >= m.dayOpen;
  ctx.fillStyle = dayUp ? UP : DOWN;
  ctx.fillRect(right + 4 * s, yl - 14 * s, 90 * s, 28 * s);
  ctx.fillStyle = BG;
  ctx.fillText(last.toFixed(2), right + 12 * s, yl);

  if (header) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(40 * s)}px Inter, system-ui, sans-serif`;
    ctx.fillText(`$${TICKER}`, left, 54 * s);
    ctx.font = `500 ${Math.round(34 * s)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(last.toFixed(2), left + 170 * s, 54 * s);
    const chg = last / m.dayOpen - 1;
    ctx.fillStyle = chg >= 0 ? UP : DOWN;
    ctx.fillText(`${chg >= 0 ? '+' : ''}${(chg * 100).toFixed(2)}%`, left + 330 * s, 54 * s);
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(20 * s)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(`DAY ${m.day} · ${m.clock}`, left, 82 * s);
    ctx.textAlign = 'right';
    ctx.fillStyle = tr.pnl >= 0 ? UP : DOWN;
    ctx.font = `600 ${Math.round(30 * s)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(money(tr.pnl), W - 20 * s, 54 * s);
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(20 * s)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText('PAPER P&L', W - 20 * s, 82 * s);
    ctx.textAlign = 'left';
  }

  // the headline ribbon
  if (!compact && m.news && m.minute - m.news.at < 40) {
    ctx.fillStyle = 'rgba(222,122,34,0.92)';
    ctx.fillRect(0, H - 48 * s, W, 48 * s);
    ctx.fillStyle = '#1b130b';
    ctx.font = `600 ${Math.round(22 * s)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`BREAKING  ${m.news.text}`, left, H - 24 * s);
  }

  // what is covering the screen
  const overlay = tr.phase === PHASES.MARGIN_CALL ? ['MARGIN CALL', DOWN]
    : tr.phase === PHASES.CLOSED ? ['MARKET CLOSED', INK]
      : tr.loom > 0.35 ? ['CRASH', DOWN] : null;
  if (overlay) {
    ctx.fillStyle = overlay[1] === DOWN ? `rgba(224,80,58,${0.18 + tr.loom * 0.25})` : 'rgba(17,21,28,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = overlay[1];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // a crash grows: the loom is the size of the word
    const grow = overlay[0] === 'CRASH' ? 0.7 + tr.loom * 0.9 : 1;
    ctx.font = `800 ${Math.round(96 * s * grow)}px Inter, system-ui, sans-serif`;
    ctx.fillText(overlay[0], W / 2, H / 2);
    ctx.textAlign = 'left';
  }
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}


// ------------------------------------------------------------------------
// The other five screens. Each takes (ctx, trader, brain) and paints a whole
// screen; brain is the running TraderBrain, or null while it loads.

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = 'Inter, system-ui, sans-serif';
const FLY = '#de7a22';
const HOLD = '#8fb5a0';
const COIN = '#8a8f99';

/** A screen's frame: background, a title bar, and the layout box below it. */
function frame(ctx, title, right = '') {
  const { width: W, height: H } = ctx.canvas;
  const s = W / 768;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(233,226,212,0.06)';
  ctx.fillRect(0, 0, W, 52 * s);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(24 * s)}px ${SANS}`;
  ctx.fillText(title, 20 * s, 27 * s);
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(18 * s)}px ${MONO}`;
    ctx.fillText(right, W - 20 * s, 27 * s);
    ctx.textAlign = 'left';
  }
  return { W, H, s, top: 64 * s, left: 20 * s, right: W - 20 * s, bottom: H - 20 * s };
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** The wire: every headline so far, newest first. */
export function drawNews(ctx, tr) {
  const m = tr.market;
  const f = frame(ctx, 'NEWS WIRE', `DAY ${m.day} · ${m.clock}`);
  const { s } = f;
  let y = f.top + 10 * s;
  const items = m.newsLog.slice().reverse();
  if (!items.length) {
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(22 * s)}px ${SANS}`;
    ctx.fillText('No headlines yet. Bananas are quiet.', f.left, y + 20 * s);
    return;
  }
  items.forEach((n, i) => {
    if (y > f.bottom - 30 * s) return;
    const fresh = i === 0 && m.minute - n.at < 40;
    ctx.font = `${fresh ? 600 : 400} ${Math.round(21 * s)}px ${SANS}`;
    const lines = wrap(ctx, n.text, f.right - f.left).slice(0, 2);
    if (fresh) {
      // the latest headline, while it is still news, on the accent
      ctx.fillStyle = 'rgba(222,122,34,0.9)';
      ctx.fillRect(0, y - 6 * s, f.W, (48 + lines.length * 26) * s);
    }
    ctx.fillStyle = fresh ? '#1b130b' : DIM;
    ctx.font = `${Math.round(16 * s)}px ${MONO}`;
    ctx.fillText(`D${n.day} ${n.clock}   ${n.jump >= 0 ? '▲' : '▼'} ${(Math.abs(n.jump) * 100).toFixed(1)}%`, f.left, y + 10 * s);
    ctx.fillStyle = fresh ? '#1b130b' : INK;
    ctx.font = `${fresh ? 600 : 400} ${Math.round(21 * s)}px ${SANS}`;
    lines.forEach((l, k) => ctx.fillText(l, f.left, y + (36 + k * 26) * s));
    y += (56 + lines.length * 26) * s;
  });
}

/** The race: the fly's P&L against buy-and-hold and a coin, since the start. */
export function drawRace(ctx, tr) {
  const f = frame(ctx, 'FLY vs MARKET', 'PAPER P&L');
  const { s } = f;
  const c = tr.curve;
  const bottom = f.bottom - 10 * s;
  const right = f.right - 150 * s;
  let lo = -100, hi = 100;
  for (const p of c) { lo = Math.min(lo, p.fly, p.hold, p.coin); hi = Math.max(hi, p.fly, p.hold, p.coin); }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const y = (v) => bottom - (v - lo) / (hi - lo) * (bottom - f.top);
  const x = (i) => f.left + (c.length < 2 ? 0 : i / (c.length - 1)) * (right - f.left);
  ctx.strokeStyle = 'rgba(233,226,212,0.25)';
  ctx.setLineDash([6 * s, 6 * s]);
  ctx.beginPath(); ctx.moveTo(f.left, y(0)); ctx.lineTo(right, y(0)); ctx.stroke();
  ctx.setLineDash([]);
  const lines = [['coin', COIN, 'coin'], ['hold', HOLD, 'hold'], ['fly', FLY, 'fly']];
  for (const [k, color, label] of lines) {
    if (c.length < 2) continue;
    ctx.strokeStyle = color;
    ctx.lineWidth = (k === 'fly' ? 4 : 2.5) * s;
    ctx.beginPath();
    c.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p[k])) : ctx.moveTo(x(i), y(p[k]))));
    ctx.stroke();
    const last = c[c.length - 1][k];
    ctx.fillStyle = color;
    ctx.font = `${k === 'fly' ? 700 : 500} ${Math.round(19 * s)}px ${MONO}`;
    ctx.fillText(`${label} ${last >= 0 ? '+' : '−'}$${Math.abs(last).toFixed(0)}`, right + 12 * s, y(last));
  }
}

/** The book: a synthetic depth ladder around the last price. */
export function drawBook(ctx, tr) {
  const m = tr.market;
  const f = frame(ctx, 'ORDER BOOK', `$${TICKER}`);
  const { s } = f;
  const levels = 7;
  const tick = 0.05;
  const mid = Math.round(m.price / tick) * tick;
  const rowH = (f.bottom - f.top) / (levels * 2 + 1);
  const hash = (k) => Math.abs(Math.sin(k * 12.9898 + m.minute * 0.37) * 43758.5453) % 1;
  const barMax = (f.right - f.left) * 0.55;
  ctx.font = `${Math.round(18 * s)}px ${MONO}`;
  for (let i = 0; i < levels * 2 + 1; i++) {
    const k = levels - i;                     // +levels .. -levels
    const price = mid + k * tick;
    const yy = f.top + (i + 0.5) * rowH;
    if (k === 0) {
      ctx.fillStyle = INK;
      ctx.font = `600 ${Math.round(22 * s)}px ${MONO}`;
      ctx.fillText(`${m.price.toFixed(2)}  last`, f.left, yy);
      ctx.font = `${Math.round(18 * s)}px ${MONO}`;
      continue;
    }
    const size = Math.round(20 + hash(price * 100) * 180 * (1 + Math.abs(k) * 0.12));
    const ask = k > 0;
    ctx.fillStyle = ask ? 'rgba(224,80,58,0.28)' : 'rgba(63,191,106,0.28)';
    const bw = Math.min(1, size / 400) * barMax;
    ctx.fillRect(f.right - bw, yy - rowH * 0.38, bw, rowH * 0.76);
    ctx.fillStyle = ask ? DOWN : UP;
    ctx.fillText(price.toFixed(2), f.left, yy);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.fillText(String(size), f.right - 8 * s, yy);
    ctx.textAlign = 'left';
  }
}

/** The tape: every price of the session so far, and every fill the fly made. */
export function drawTape(ctx, tr) {
  const m = tr.market;
  const f = frame(ctx, 'ITS TRADES', `${tr.fills.length} FILLS`);
  const { s } = f;
  const h = m.history;
  const L = h.length;
  let lo = Infinity, hi = -Infinity;
  for (const p of h) { if (p < lo) lo = p; if (p > hi) hi = p; }
  const pad = (hi - lo) * 0.08 + 0.2;
  lo -= pad; hi += pad;
  const y = (p) => f.bottom - (p - lo) / (hi - lo) * (f.bottom - f.top);
  const x = (i) => f.left + (L < 2 ? 0 : i / (L - 1)) * (f.right - f.left);
  ctx.strokeStyle = 'rgba(233,226,212,0.7)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  h.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p)) : ctx.moveTo(x(i), y(p))));
  ctx.stroke();
  // fills, placed by how many minutes ago they happened
  for (const fl of tr.fills) {
    const i = L - 1 - (m.minute - fl.minute);
    if (i < 0) continue;
    const px = x(i), py = y(fl.price);
    const r = 9 * s;
    ctx.fillStyle = fl.panic ? DOWN : fl.dir > 0 ? UP : DOWN;
    ctx.beginPath();
    if (fl.dir > 0) { ctx.moveTo(px, py - r); ctx.lineTo(px + r, py + r * 0.8); ctx.lineTo(px - r, py + r * 0.8); }
    else { ctx.moveTo(px, py + r); ctx.lineTo(px + r, py - r * 0.8); ctx.lineTo(px - r, py - r * 0.8); }
    ctx.closePath();
    ctx.fill();
    if (fl.panic) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(px, py, r * 1.7, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

/** Its own brain, live: the motion readers, the trend, the giant fibre. */
export function drawBrain(ctx, tr, brain) {
  const f = frame(ctx, 'FLY BRAIN · LIVE', 'MaleCNS v1.0');
  const { s } = f;
  if (!brain) {
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(22 * s)}px ${SANS}`;
    ctx.fillText('loading the connectome…', f.left, f.top + 30 * s);
    return;
  }
  const rate = brain.sim.rate;
  const colW = (f.right - f.left - 30 * s) / 2;
  const rowH = 26 * s;
  const bars = (list, idxs, x0, color, label) => {
    ctx.fillStyle = DIM;
    ctx.font = `${Math.round(16 * s)}px ${MONO}`;
    ctx.fillText(label, x0, f.top + 8 * s);
    list.forEach((r, k) => {
      const yy = f.top + (30 + k * 30) * s;
      const v = Math.max(0, Math.min(1, (rate[idxs[k]] - brain.rest[idxs[k]]) * 4));
      ctx.fillStyle = 'rgba(233,226,212,0.1)';
      ctx.fillRect(x0 + 110 * s, yy - rowH * 0.3, colW - 110 * s, rowH * 0.6);
      ctx.fillStyle = color;
      ctx.fillRect(x0 + 110 * s, yy - rowH * 0.3, (colW - 110 * s) * v, rowH * 0.6);
      ctx.fillStyle = INK;
      ctx.fillText(r.name, x0, yy);
    });
  };
  bars(brain.readers.up, brain.readUp, f.left, UP, 'READS UP');
  bars(brain.readers.down, brain.readDown, f.left + colW + 30 * s, DOWN, 'READS DOWN');

  // the verdict and the escape neuron, along the bottom
  const yTrend = f.bottom - 70 * s;
  const w = f.right - f.left - 150 * s;
  ctx.fillStyle = 'rgba(233,226,212,0.1)';
  ctx.fillRect(f.left + 150 * s, yTrend - 8 * s, w, 16 * s);
  const t = Math.max(-1, Math.min(1, tr.perceivedTrend));
  ctx.fillStyle = t >= 0 ? UP : DOWN;
  const cx = f.left + 150 * s + w / 2;
  ctx.fillRect(Math.min(cx, cx + t * w / 2), yTrend - 8 * s, Math.abs(t) * w / 2, 16 * s);
  ctx.fillStyle = INK;
  ctx.fillText('TREND', f.left, yTrend);

  // the giant fibre, with its escape threshold marked at the middle
  const yGf = f.bottom - 26 * s;
  const g = Math.min(1, tr.escape / 1.5);
  ctx.fillStyle = 'rgba(233,226,212,0.1)';
  ctx.fillRect(f.left + 150 * s, yGf - 8 * s, w, 16 * s);
  ctx.fillStyle = DOWN;
  ctx.fillRect(f.left + 150 * s, yGf - 8 * s, w * g, 16 * s);
  ctx.fillStyle = INK;
  ctx.fillRect(f.left + 150 * s + w * 0.5 - 1.5 * s, yGf - 14 * s, 3 * s, 28 * s);
  ctx.fillText('DNp01', f.left, yGf);
}

/** One painter per screen id (tradeLayout.js MONITORS). */
export const PAINTERS = {
  main: (ctx, tr) => drawChart(ctx, tr),
  news: drawNews,
  race: drawRace,
  book: drawBook,
  tape: drawTape,
  brain: drawBrain,
};
