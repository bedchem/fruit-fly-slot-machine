/**
 * What the fly is thinking, in words.
 *
 * The words are ours — a fly has none. What they are read off is not: every
 * line is chosen by the fly's actual state — its credits, its losing streak,
 * the last outcome, NPF, the defensive state, what its mushroom body has
 * learned, and whether it has run dry before. The sentence is a translation
 * of numbers that are already on screen, not a script.
 *
 * Situations are checked in order; the first that applies wins. Moments (a
 * win, a loss, running dry) cut in at once; moods (a long slide, a learned
 * dread) only replace a thought that has had time to be read.
 */
import { PHASES } from '../game/machine.js';

/** How long a thought stays up before a mere change of mood may replace it. */
const HOLD_MS = 5200;
/** How long after a result that result is still what it is thinking about. */
const RECENT_MS = 3800;

const SITUATIONS = [
  // --- out of credit: it believes it is dying -------------------------------
  {
    key: 'panic', urgent: true,
    when: (m) => m.brokeStage === 'panic',
    lines: [
      'No. No, no, no — it\'s all gone. Everything.',
      'Empty. I put it ALL in. How is it all gone?',
      'Nothing left… my heart, it won\'t stop racing…',
    ],
  },
  {
    key: 'fading', urgent: true,
    when: (m) => m.brokeStage === 'fading',
    lines: [
      'It\'s getting dark… I gambled everything away.',
      'So this is how it ends. On a stool. For a machine.',
      'I\'m dying… and all I can think about is one more pull.',
    ],
  },
  {
    key: 'still', urgent: true,
    when: (m) => m.brokeStage === 'still',
    lines: ['…', '…cold…', '…'],
  },
  {
    key: 'revived', urgent: true,
    when: (m) => m.revivedAt && Date.now() - m.revivedAt < 6500,
    lines: [
      'I\'m… alive? Someone fed the machine. Just one more, then.',
      'I came back. Of course I came back. The reels are waiting.',
      'Breathe. There\'s credit again. I won\'t lose it this time. I won\'t.',
    ],
    deathLines: [
      'I\'ve died here before and I\'m back again. Why can\'t I leave?',
      'Again. I did this again. And I\'m already reaching for the lever.',
    ],
  },

  // --- the moment a result lands -------------------------------------------
  {
    key: 'jackpot', urgent: true,
    when: (m, r) => r?.jackpot,
    lines: [
      'SEVENS! I KNEW IT! I knew it would pay!',
      'JACKPOT! Every loss was worth it — every single one!',
      'Look at it all! I\'m never stopping now!',
    ],
  },
  {
    key: 'win', urgent: true,
    when: (m, r) => r?.win,
    lines: [
      'YES! It\'s paying! I\'m on a roll now!',
      'I told you — it always comes back around!',
      'That feeling… I need that again. Right now.',
    ],
  },
  {
    key: 'last-credits', urgent: true,
    when: (m, r) => r && !r.win && m.credits > 0 && m.credits <= 3,
    lines: [
      'I keep losing… I\'m going to die here. One more pull anyway.',
      'Only a few left. If this one doesn\'t hit, that\'s it for me.',
      'Please. Please just this once. I can\'t go back to nothing.',
    ],
  },
  {
    key: 'near', urgent: true,
    when: (m, r) => r && r.nearMiss,
    lines: [
      'SO close! One more symbol! The next one is mine.',
      'It almost paid — it\'s warming up, I can feel it.',
      'Two out of three! I can\'t stop now, it\'s about to hit.',
    ],
  },

  // --- the moods underneath ------------------------------------------------
  {
    key: 'streak',
    when: (m) => m.lossStreak >= 5,
    lines: [
      'Why won\'t it pay? It HAS to pay soon. It has to.',
      'Every pull takes a little more of me. I pull anyway.',
      'I can\'t remember the last time I won. Just one more.',
    ],
  },
  {
    key: 'dread',
    when: (m) => m.memory < -0.45,
    lines: [
      'This machine is killing me… and I can\'t stop feeding it.',
      'I know it\'s bad for me. I know. My leg reaches for it anyway.',
      'Everything in me says leave. I stay.',
    ],
  },
  {
    key: 'fear',
    when: (m) => m.fear > 0.55,
    lines: [
      'My heart won\'t slow down. Is this how it ends?',
      'Credits running out… don\'t look at the number. Just pull.',
      'Something terrible is coming. I can feel it in the reels.',
    ],
  },
  {
    key: 'hollow',
    when: (m) => m.npf < 0.25,
    lines: [
      'Nothing feels good anymore. Only the pull.',
      'Empty inside. The lever is the only thing that still means anything.',
      'I don\'t even want to win. I just want to keep going.',
    ],
  },
  {
    key: 'rich',
    when: (m) => m.credits >= m.startingCredits * 1.4,
    lines: [
      'Look at this pile! I can\'t lose now!',
      'I\'m good at this. Really good. Bigger bets, bigger wins.',
      'This is my machine. It knows me.',
    ],
  },
  {
    key: 'love',
    when: (m) => m.memory > 0.3,
    lines: [
      'This machine loves me. I can feel it.',
      'Every pull feels like coming home.',
    ],
  },
  {
    key: 'calm',
    when: () => true,
    lines: [
      'Just me and the reels. Let\'s see what happens.',
      'Not sure about this machine yet.',
      'The lights, the sound… just one pull. Maybe two.',
    ],
  },
];

/** Picks and holds the fly's current thought. Call `read(machine)` per frame. */
export class Thinker {
  constructor() {
    this.key = null;
    this.text = '';
    this.since = 0;
    this.resultAt = null;
  }

  read(m) {
    const now = Date.now();
    const r = m.lastResult && now - m.lastResult.at < RECENT_MS
      && (m.phase === PHASES.RESULT || m.phase === PHASES.RESOLVING || m.phase === PHASES.IDLE)
      ? m.lastResult : null;
    const s = SITUATIONS.find((x) => x.when(m, r));
    // a new result is a new moment even if it lands in the same situation
    const moment = r && r.at !== this.resultAt;
    const changed = s.key !== this.key || moment;
    const held = now - this.since >= HOLD_MS;
    if (changed && (s.urgent || held)) {
      this.key = s.key;
      this.since = now;
      if (r) this.resultAt = r.at;
      const pool = s.deathLines && m.deaths > 1 ? s.deathLines : s.lines;
      const options = pool.length > 1 ? pool.filter((t) => t !== this.text) : pool;
      this.text = options[Math.floor(Math.random() * options.length)];
    }
    return this.text;
  }
}
