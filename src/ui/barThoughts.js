/**
 * What the fly at the bar is thinking, in words.
 *
 * As in the casino (thoughts.js), the words are ours and the choice of line is
 * not: every situation is read off the fly's actual state — its body ethanol
 * and nicotine, the hangover, NPF, what its mushroom body has learned, and
 * what it just did. Moments cut in at once; moods wait until the last thought
 * has had time to be read.
 */
import { PHASES } from '../game/bar.js';

const HOLD_MS = 5200;
const RECENT_MS = 3600;

const SITUATIONS = [
  // --- knocked down ---------------------------------------------------------
  {
    key: 'seizure', urgent: true,
    when: (m) => m.phase === PHASES.SEIZURE && m.t < 3,
    lines: ['EVERYTHING IS FIRING AT ONCE—', 'can\'t — stop — the legs—', 'TOO MUCH TOO MUCH TOO MUCH'],
  },
  {
    key: 'knocked', urgent: true,
    when: (m) => m.phase === PHASES.SEIZURE,
    lines: ['…the tin… was the tin…', '…never again. never.', '…why is the floor so loud…'],
  },
  {
    key: 'passed-out', urgent: true,
    when: (m) => m.phase === PHASES.PASSED_OUT,
    lines: ['…', '…one more… zzz…', '…the room is… a boat…'],
  },
  {
    key: 'asleep', urgent: true,
    when: (m) => m.phase === PHASES.ASLEEP,
    lines: ['zzz…', '…mm… sugar…', '…zzz…'],
  },
  {
    key: 'woke-bad', urgent: true,
    when: (m) => m.wokeAt && m.now() - m.wokeAt < 6500 && m.hangover > 0.35,
    lines: [
      'Where am I. Why is it so bright. Why is it so LOUD.',
      'My head. Every neuron I have hurts. All sixty thousand of them.',
      'I\'m never drinking again. I say this every morning.',
    ],
  },
  {
    key: 'woke-ok', urgent: true,
    when: (m) => m.wokeAt && m.now() - m.wokeAt < 6500,
    lines: ['Morning. That wasn\'t so bad.', 'Up. Oddly fine. Suspiciously fine.'],
  },

  // --- the moment an action lands -------------------------------------------
  {
    key: 'pouch-first', urgent: true,
    when: (m, r) => r?.kind === 'pouch' && m.pouchCount === 1,
    lines: ['So THIS is what the tin is for. Oh. Oh, my heart.', 'Tingly. Everything is tingly. Is this good?'],
  },
  {
    key: 'pouch-strong', urgent: true,
    when: (m, r) => r?.kind === 'pouch' && r.mg >= 11,
    lines: ['The strong one. I\'m a strong fly.', 'Sixteen milligrams? Sure. Why not. What\'s a milligram.'],
  },
  {
    key: 'pouch', urgent: true,
    when: (m, r) => r?.kind === 'pouch',
    lines: ['Under the lip. Just a little one.', 'Ahh. That\'s the stuff.'],
  },
  {
    key: 'big-bout', urgent: true,
    when: (m, r) => r?.kind === 'beer' && r.sips >= 5,
    lines: ['CHUG. CHUG. CHUG.', 'Five in a row and I could do five more.', 'I don\'t even taste it anymore. Good.'],
  },
  {
    key: 'first-sips', urgent: true,
    when: (m, r) => r?.kind === 'beer' && m.sips <= 6,
    lines: ['Ugh — it burns. Why does everyone drink this?', 'Bitter. Weird. …Again, though.'],
  },

  // --- the body -------------------------------------------------------------
  {
    key: 'nic-jitter',
    when: (m) => m.jitter > 0.3,
    lines: ['My heart is doing a drum solo.', 'I can hear my own wings. I\'m not flying.', 'Sweaty. Can a fly sweat? I\'m doing it.'],
  },
  {
    key: 'hair',
    when: (m) => m.hangover > 0.3 && m.bac > 2,
    lines: ['There it is. The headache\'s going. Just a little more.', 'Hair of the dog. I read that somewhere. Do dogs have hair?'],
  },
  {
    key: 'hungover',
    when: (m) => m.hangover > 0.3,
    lines: [
      'Don\'t look at the glass. Don\'t look at the glass.',
      'Everything tastes like regret.',
      'Octopamine through the roof and not in the fun way.',
    ],
  },
  {
    key: 'wasted',
    when: (m) => m.sedation > 0.35,
    lines: ['I love this bar. I love this stool. I love you, stool.', 'Is the counter moving or is it me. It\'s me.', 'Whose proboscis is this?'],
  },
  {
    key: 'drunk',
    when: (m) => m.sway > 0.4,
    lines: ['I\'m not drunk, the room is.', 'Another one. I\'ve earned it. For… things.', 'Everyone here is my best friend.'],
  },
  {
    key: 'buzzed',
    when: (m) => m.stim > 0.5,
    lines: ['Ooh. Warm. Buzzy. Wings feel great.', 'I feel FAST. Faster than a fruit fly.', 'This is nice. Why don\'t I do this every night?'],
  },
  {
    key: 'craving',
    when: (m) => m.craving > 0.3,
    lines: ['Where did I put the tin.', 'Just one pouch. To take the edge off.', 'Something\'s missing. Something small and white.'],
  },
  {
    key: 'deprived',
    when: (m) => m.npf < 0.3,
    lines: ['Nothing feels like anything.', 'Empty. The glass isn\'t, though.'],
  },
  {
    key: 'learned-bad',
    when: (m) => m.memory < -0.35,
    lines: ['I know how this ends. With a morning.', 'This place hurts me. And yet. The straw.'],
  },
  {
    key: 'learned-good',
    when: (m) => m.memory > 0.35,
    lines: ['This bar gets me.', 'My mushroom body says yes. Loudly.'],
  },
  {
    key: 'calm',
    when: () => true,
    lines: ['Nice place. Quiet. Sticky.', 'Just the one tonight. Probably.', 'Straw\'s right there. No rush.'],
  },
];

export class BarThinker {
  constructor() {
    this.key = null;
    this.text = '';
    this.since = 0;
    this.resultAt = null;
  }

  read(m) {
    const now = m.now();
    const r = m.lastResult && now - m.lastResult.at < RECENT_MS && m.lastResult.kind !== 'rest'
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
