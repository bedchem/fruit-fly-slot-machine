/**
 * What the fly at the trading desk is thinking, in words.
 *
 * As in the casino and the bar, the words are ours and the choice of line is
 * not: each situation is read off the trader's actual state — its position,
 * its P&L, what its optic lobe says the chart is doing, the giant fibre, NPF
 * and what its mushroom body has learned.
 */
import { PHASES } from '../game/trader.js';

const HOLD_MS = 5200;
const RECENT_MS = 3600;

const SITUATIONS = [
  {
    key: 'margin', urgent: true,
    when: (m) => m.phase === PHASES.MARGIN_CALL,
    lines: ['They took it. They took ALL of it.', 'Margin call. What is a margin. Why is it calling.', 'It was paper money. It was MY paper money.'],
  },
  {
    key: 'panic', urgent: true,
    when: (m) => m.order?.panic,
    lines: ['SELL SELL SELL SELL', 'Something huge is coming at me — GET OUT', 'Every leg says run. Selling everything.'],
  },
  {
    key: 'closed', urgent: true,
    when: (m) => m.phase === PHASES.CLOSED,
    lines: ['Market closed. Time to stare at the P&L all night.', 'Closing bell. Holding overnight. What could go wrong.'],
  },
  {
    key: 'big-win', urgent: true,
    when: (m, r) => r?.realized > 150,
    lines: ['Locked it in. I am a genius. A small, winged genius.', 'Profit! PAM is firing like fireworks.', 'I should start a newsletter.'],
  },
  {
    key: 'loss', urgent: true,
    when: (m, r) => r && r.realized < -60 && r.kind !== 'buy',
    lines: ['That was a hedge. I meant to do that.', 'It is only a loss if you look at it.', 'Fine. I will win it back. Bigger size.'],
  },
  {
    key: 'crash', urgent: true,
    when: (m) => m.loom > 0.4,
    lines: ['The red thing is getting BIGGER', 'That candle is coming right at me.', 'Why is the whole screen red'],
  },
  {
    key: 'fomo', urgent: false,
    when: (m) => m.perceivedTrend > 0.6 && m.position <= 0,
    lines: ['Everything is going up without me.', 'Number go up. I am not in the number.', 'Is it too late to buy? It is never too late to buy.'],
  },
  {
    key: 'riding', urgent: false,
    when: (m) => m.position > 0 && m.unrealizedPct > 0.01,
    lines: ['Diamond tarsi. Not selling.', 'Up only. Bananas to the moon.', 'Look at it go. I did this.'],
  },
  {
    key: 'short-winning', urgent: false,
    when: (m) => m.position < 0 && m.unrealizedPct > 0.01,
    lines: ['Short bananas. Long despair.', 'Everyone is sad. I am rich. Is that bad?'],
  },
  {
    key: 'bagholder', urgent: false,
    when: (m) => m.position !== 0 && m.unrealizedPct < -0.02,
    lines: ['It will come back. It always comes back.', 'Not a loss until I sell. So I will not sell.', 'Averaging down is a strategy. Probably.'],
  },
  {
    key: 'tilt', urgent: false,
    when: (m) => m.npf < 0.3,
    lines: ['I need one good trade. Just one.', 'Revenge is a dish best served leveraged.'],
  },
  {
    key: 'burned', urgent: false,
    when: (m) => m.memory < -0.3,
    lines: ['This market has hurt me before.', 'My mushroom body says: careful. My foreleg disagrees.'],
  },
  {
    key: 'news', urgent: false,
    when: (m) => m.market.news && m.market.minute - m.market.news.at < 15,
    lines: ['Something happened. I cannot read. But something happened.', 'The orange bar is back. Orange means… bananas?'],
  },
  {
    key: 'flat', urgent: false,
    when: (m) => m.position === 0,
    lines: ['Watching. Waiting. Wings twitching.', 'Cash is a position.', 'Just need the chart to move.'],
  },
  {
    key: 'calm', urgent: false,
    when: () => true,
    lines: ['Holding. Breathing. Refreshing.', 'Line goes sideways. So do I.'],
  },
];

export class TradeThinker {
  constructor() {
    this.key = null;
    this.text = '';
    this.since = 0;
    this.resultAt = null;
  }

  read(m) {
    const now = m.now();
    const r = m.lastResult && now - m.lastResult.at < RECENT_MS && m.lastResult.kind !== 'hold'
      ? m.lastResult : null;
    const s = SITUATIONS.find((x) => x.when(m, r));
    const moment = r && r.at !== this.resultAt;
    const changed = s.key !== this.key || moment;
    const held = Date.now() - this.since >= HOLD_MS;
    if (changed && (s.urgent || held)) {
      this.key = s.key;
      this.since = Date.now();
      if (r) this.resultAt = r.at;
      const options = s.lines.length > 1 ? s.lines.filter((t) => t !== this.text) : s.lines;
      this.text = options[Math.floor(Math.random() * options.length)];
    }
    return this.text;
  }
}
