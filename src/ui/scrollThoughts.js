/**
 * What each scroller is thinking, in words.
 *
 * As in the other experiments, the words are ours and the choice of line is
 * not: it is read off that fly's state — the reel on its screen, a message
 * arriving, the giant fibre, its battery, its fear and what the feed has
 * turned into.
 */
import { PHASES } from '../game/scroll.js';

const HOLD_MS = 5000;

const SITUATIONS = [
  { key: 'asleep', urgent: true, when: (f) => f.phase === PHASES.ASLEEP, lines: ['zzz…', '…one more… zzz', '…spiders… zzz'] },
  { key: 'dead', urgent: true, when: (f) => f.phase === PHASES.DEAD, lines: ['No. No no no. 0%.', 'The screen went black and so did I.', 'Now what do I look at. The wall?'] },
  { key: 'flinch', urgent: true, when: (f) => f.flinch > 0.3, lines: ['AAH—', 'It was coming right at me!', 'Why did I jump? It is a video. I know it is a video.'] },
  {
    key: 'got', urgent: true, when: (f) => f.buzz > 0.5,
    lines: [(f) => `${f.friend.name} sent me something!`, (f) => `Ooh, ${f.friend.name}.`, () => 'A message. Everything else can wait.'],
  },
  {
    key: 'sending', urgent: true, when: (f) => f.phase === PHASES.SHARING,
    lines: [(f) => `${f.friend.name} HAS to see this.`, () => 'Sending. Sending right now.', (f) => `@${f.friend.name} lol`],
  },
  {
    key: 'friend-reel', urgent: false, when: (f) => f.reel.from && f.phase === PHASES.WATCHING,
    lines: [(f) => `What did ${f.friend.name} send me…`, () => 'Watching it because a friend sent it. That is love.'],
  },
  {
    key: 'ignored', urgent: false, when: (f) => f.ignored > f.replies && f.ignored > 1,
    lines: [(f) => `${f.friend.name} left me on seen. Again.`, () => 'Seen. Just "seen". Fine.'],
  },
  { key: 'low', urgent: false, when: (f) => f.battery < 12, lines: ['Battery 9%. That is basically forever.', 'Just until 5%. Then I stop. Maybe.'] },
  {
    key: 'doom', urgent: false, when: (f) => f.feed.doom > 0.6,
    lines: ['Why is it all spiders now.', 'I do not even like this. I cannot stop.', 'The algorithm knows me better than I know me.'],
  },
  { key: 'threat', urgent: false, when: (f) => f.cat.kind === 'threat', lines: ['Do not look. Keep looking.', 'This is fine. This is research.', 'My heart is going 380.'] },
  { key: 'tired', urgent: false, when: (f) => f.sleepPressure > 0.9, lines: ['Eyes closing. Thumb still going.', 'It is 2am and I am learning about vinegar traps.'] },
  { key: 'fruit', urgent: false, when: (f) => f.reel.cat === 'fruit', lines: ['Look at that banana. LOOK at it.', 'So ripe. So beautiful. So far away.'] },
  { key: 'courtship', urgent: false, when: (f) => f.reel.cat === 'courtship', lines: ['He is singing with his WING. Iconic.', 'I could never.'] },
  { key: 'stripes', urgent: false, when: (f) => f.reel.cat === 'stripes', lines: ['The stripes. The stripes are so smooth.', 'I am turning with them. I cannot not turn.'] },
  { key: 'sugar', urgent: false, when: (f) => f.reel.cat === 'sugar', lines: ['I can almost taste it through the glass.', 'Sugar. Just… sugar. Perfect content.'] },
  { key: 'swarm', urgent: false, when: (f) => f.reel.cat === 'swarm', lines: ['They all turn at once. How do they KNOW.', 'I want to be in a swarm. I am on a stool.'] },
  { key: 'wasp', urgent: true, when: (f) => f.reel.cat === 'wasp' && f.reelT > 2, lines: ['Not the wasp. Anything but the wasp.', 'She is so close. She is SO close.'] },
  { key: 'zapper', urgent: false, when: (f) => f.reel.cat === 'zapper', lines: ['The light is so pretty. I know. I KNOW.', "Don't go in the light. Don't go in the li—"] },
  {
    key: 'fan', urgent: true, when: (f) => f.reel.cat === 'fan' && f.reelT > 0.5,
    lines: [
      (f) => (f.love > 0.5 ? 'I would give up sugar for her. Not all sugar. Some sugar.' : 'Wait. Who is she. Why is she so good.'),
      () => 'Rewatching. Rewatching again.',
      (f) => (f.reel.from ? `${f.friend.name} gets it. ${f.friend.name} GETS it.` : `Sending this to ${f.friend.name} immediately.`),
    ],
  },
  { key: 'calm', urgent: false, when: () => true, lines: ['One more.', 'Just checking something.', 'Scroll. Scroll. Scroll.'] },
];

export class ScrollThinker {
  constructor(fly) {
    this.fly = fly;
    this.key = null;
    this.text = '';
    this.since = 0;
  }

  read() {
    const f = this.fly;
    const s = SITUATIONS.find((x) => x.when(f));
    const held = Date.now() - this.since >= HOLD_MS;
    if (s.key !== this.key && (s.urgent || held)) {
      this.key = s.key;
      this.since = Date.now();
      const lines = s.lines.map((l) => (typeof l === 'function' ? l(f) : l));
      const options = lines.length > 1 ? lines.filter((t) => t !== this.text) : lines;
      this.text = options[Math.floor(Math.random() * options.length)];
    }
    return this.text;
  }
}
