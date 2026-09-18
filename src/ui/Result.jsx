/**
 * The payoff moment.
 *
 * A slot machine's whole job is the beat between the last reel landing and
 * knowing what you got, so this is a printed slip: the three symbols the fly
 * actually landed, drawn with the same painters the reels use, and a rubber
 * stamp that hits a moment later. The delay is the point — the stamp lands
 * after the symbols have registered, not with them.
 */
import { useEffect, useRef, useState } from 'react';
import { symbolCanvas } from '../scene/reelTexture.js';

function Symbol({ id, size = 46 }) {
  const host = useRef(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const canvas = symbolCanvas(id, size);
    el.replaceChildren(canvas);
    return () => el.replaceChildren();
  }, [id, size]);
  return <span className="sym" ref={host} aria-label={id} />;
}

export function ResultSlip({ result }) {
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    setStamped(false);
    if (!result) return undefined;
    const t = setTimeout(() => setStamped(true), 380);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;
  const tone = result.jackpot ? 'jackpot' : result.win ? 'win' : result.nearMiss ? 'near' : 'lose';
  const verdict = result.jackpot ? 'JACKPOT'
    : result.win ? `PAID ${result.payout}`
      : result.nearMiss ? 'SO CLOSE' : 'NO LINE';

  return (
    <div className={`slip ${tone}`} key={result.at}>
      <div className="slip-reels">
        {result.symbols.map((s, i) => (
          <Symbol key={`${result.at}-${i}`} id={s.id} />
        ))}
      </div>
      <div className={`stamp ${stamped ? 'down' : ''}`}>{verdict}</div>
      {result.win && stamped && (
        <div className="coins" aria-hidden="true">
          {Array.from({ length: result.jackpot ? 14 : 7 }, (_, i) => (
            <i key={i} style={{ '--i': i, '--d': `${(i % 5) * 60}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Credits that roll rather than jump. A payout you watch arrive is worth more
 * than a number that changes.
 */
export function Credits({ value }) {
  const ref = useRef(null);
  const shown = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const from = shown.current;
    if (from === value) return undefined;
    if (value > from) { setFlash(true); setTimeout(() => setFlash(false), 700); }
    const start = performance.now();
    const dur = Math.min(900, 120 + Math.abs(value - from) * 90);
    let raf = 0;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (value - from) * eased);
      if (ref.current) ref.current.textContent = v;
      if (k < 1) raf = requestAnimationFrame(tick);
      else shown.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <b className={`roll ${flash ? 'up' : ''}`} ref={ref}>{shown.current}</b>;
}

/**
 * The last dozen spins as tally marks. It is the cheapest way to make a losing
 * streak legible — which is exactly the thing the fly's own state is reacting
 * to, so it should be visible to whoever is watching as well.
 */
export function RunLog({ history }) {
  return (
    <div className="runlog tip" data-tip="The last dozen spins. A long run of misses is what drains the fly's NPF and builds its defensive state.">
      {history.map((h, i) => (
        <i key={h.at ?? i} className={h.jackpot ? 'j' : h.win ? 'w' : h.nearMiss ? 'n' : 'l'} />
      ))}
    </div>
  );
}
