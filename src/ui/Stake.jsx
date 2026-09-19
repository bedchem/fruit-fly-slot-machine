/**
 * What the fly is staking, and why.
 *
 * The stake is the fly's own decision (machine.decideBet), so this shows the
 * decision being formed rather than just its result: while it sits between
 * spins the pips follow what it is leaning towards, and the four pulls on it
 * move underneath — one of them what its mushroom body has learned. Once it commits, the pips lock to what it actually put in.
 *
 * Read off the machine on an animation frame, like the vitals — the appetite
 * moves continuously and should not be pushed through React state.
 */
import { useEffect, useRef } from 'react';
import { MAX_BET, PHASES, betReason, stakeFor } from '../game/machine.js';

const PULLS = [
  { key: 'chase', label: 'chase', tip: 'Low NPF. A deprived fly seeks reward harder, so a losing run pushes the stake up.' },
  { key: 'reward', label: 'reward', tip: 'The PAM cluster still firing from a payout: the last pull was worth making.' },
  { key: 'memory', label: 'memory', tip: 'What the mushroom body has learned about this machine. It pushes the stake up if the machine has paid, down if it has punished — and red means down.' },
  { key: 'caution', label: 'caution', tip: 'The defensive state, a bad session and every time it has run dry — a fly in a poor state reads the odds pessimistically.' },
];

/** `children` render straight under the stake line — the run history sits there. */
export function Stake({ machineRef, children }) {
  const pipsRef = useRef([]);
  const numRef = useRef(null);
  const verbRef = useRef(null);
  const whyRef = useRef(null);
  const barsRef = useRef({});
  const rootRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const m = machineRef.current;
      if (!m) return;

      const a = m.appetite;
      const broke = m.phase === PHASES.BROKE;
      const committed = !broke && m.bet > 0 && m.phase !== PHASES.IDLE;
      const shown = broke ? 0 : committed ? m.bet : Math.min(stakeFor(a.urge), Math.max(1, m.credits));
      const verb = broke ? 'nothing left' : committed ? 'staked' : 'leaning';
      const why = broke ? 'out of credit' : committed ? (m.betWhy?.why ?? '') : betReason(a);

      pipsRef.current.forEach((el, i) => {
        if (el) el.className = i < shown ? 'on' : '';
      });
      if (numRef.current && numRef.current.textContent !== String(shown)) numRef.current.textContent = shown;
      if (verbRef.current && verbRef.current.textContent !== verb) verbRef.current.textContent = verb;
      if (whyRef.current && whyRef.current.textContent !== why) whyRef.current.textContent = why;
      if (rootRef.current) rootRef.current.dataset.state = broke ? 'broke' : committed ? 'committed' : 'leaning';
      for (const p of PULLS) {
        const el = barsRef.current[p.key];
        if (!el) continue;
        el.style.setProperty('--v', String(Math.min(1, Math.abs(a[p.key]) / 0.6)));
        el.dataset.sign = a[p.key] < 0 ? 'neg' : 'pos';
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [machineRef]);

  return (
    <div
      className="stake tip"
      ref={rootRef}
      data-tip={`The fly picks its own stake, 1 to ${MAX_BET} credits, from its state at the moment it pulls. Wins pay three times the stake; three sevens pay twelve.`}
    >
      <div className="stake-head">
        <span className="stake-verb" ref={verbRef}>leaning</span>
        <span className="stake-pips" aria-hidden="true">
          {Array.from({ length: MAX_BET }, (_, i) => <i key={i} ref={(el) => { pipsRef.current[i] = el; }} />)}
        </span>
        <b ref={numRef}>1</b>
      </div>
      {children}
      <p className="stake-why" ref={whyRef} />
      <div className="stake-pulls">
        {PULLS.map((p) => (
          <span key={p.key} className={`pull pull-${p.key} tip`} data-tip={p.tip} ref={(el) => { barsRef.current[p.key] = el; }}>
            <i />{p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
