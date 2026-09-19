/**
 * What the fly has learned, and what it has spent learning it.
 *
 * The memory panel reads the mushroom body straight out of the running brain
 * (neural/memory.js): one bar per MBON compartment, its height the strength of
 * the KC→MBON synapses there relative to a naive fly. PPL1 compartments sit on
 * one side, PAM on the other, so a session of losses shows up as the approach
 * side wearing down — the memory itself, not a score about it.
 *
 * Both are read on an animation frame, like the vitals.
 */
import { useEffect, useRef } from 'react';
import { Thinker } from './thoughts.js';

export function MemoryPanel({ store, ready, machineRef }) {
  const markRef = useRef(null);
  const verdictRef = useRef(null);
  const learnedRef = useRef(null);
  const barsRef = useRef([]);
  const mbons = ready ? store.current.brain?.memory.mbons ?? [] : [];
  const approach = mbons.filter((mb) => mb.valence > 0);
  const avoid = mbons.filter((mb) => mb.valence <= 0);

  useEffect(() => {
    if (!ready) return undefined;
    const memory = store.current.brain?.memory;
    if (!memory) return undefined;
    const thinker = new Thinker();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = memory.value;
      if (markRef.current) markRef.current.style.setProperty('--x', String((v + 1) / 2));
      const m = machineRef.current;
      const text = m ? thinker.read(m) : '';
      if (verdictRef.current && verdictRef.current.textContent !== text) verdictRef.current.textContent = text;
      if (learnedRef.current) learnedRef.current.textContent = `${Math.round(memory.learned * 100)}%`;
      for (const el of barsRef.current) {
        if (!el) continue;
        const mb = memory.mbons[el.dataset.slot];
        el.style.setProperty('--v', mb.strength.toFixed(3));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, store, machineRef]);

  const bar = (mb) => {
    const slot = mbons.indexOf(mb);
    return (
      <i
        key={mb.name}
        data-slot={slot}
        className="tip"
        data-tip={`${mb.name} — a ${mb.cluster} compartment; this MBON drives ${mb.valence > 0 ? 'approach' : 'avoidance'}. Height: its KC→MBON synapses, relative to a naive fly.`}
        ref={(el) => { barsRef.current[slot] = el; }}
      />
    );
  };

  return (
    <section className="memory">
      <div className="memory-head">
        <span
          className="memory-title tip"
          data-tip="The mushroom body is where a fly learns what things are worth. Dopamine arriving while the Kenyon cells are active weakens the KC→MBON synapses in that compartment. Which MBON sits with which dopamine cluster is read off the connectome."
          tabIndex={0}
        >
          Mushroom body memory
        </span>
        <span className="memory-learned tip" data-tip="Mean weakening of the plastic KC→MBON synapses — how much it has stored. It fades again over minutes." tabIndex={0}>
          stored <b ref={learnedRef}>0%</b>
        </span>
      </div>

      <div className="memory-scale" aria-hidden="true">
        <span>avoid</span>
        <div className="memory-track"><i ref={markRef} /></div>
        <span>approach</span>
      </div>
      <p className="memory-verdict">
        <span className="memory-verdict-label">Fly's thoughts:</span>{' '}
        <span ref={verdictRef}>{ready ? '' : 'loading the connectome…'}</span>
      </p>

      {ready && (
        <div className="memory-banks">
          <div className="bank-row">
            <span className="tip" data-tip="Punishment weakens these. Their MBONs say approach, so losing them is how the fly learns to avoid.">PPL1 · approach</span>
            <div className="bars approach">{approach.map(bar)}</div>
          </div>
          <div className="bank-row">
            <span className="tip" data-tip="Reward weakens these. Their MBONs say avoid, so losing them is how the fly learns to approach.">PAM · avoid</span>
            <div className="bars avoid">{avoid.map(bar)}</div>
          </div>
        </div>
      )}
    </section>
  );
}

/** What has gone into the machine and what has come back out. */
export function Ledger({ machineRef }) {
  const refs = useRef({});

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const m = machineRef.current;
      if (!m) return;
      const net = m.won - m.staked;
      const vals = {
        staked: m.staked,
        won: m.won,
        net: `${net > 0 ? '+' : ''}${net}`,
        ret: m.staked ? `${Math.round((100 * m.won) / m.staked)}%` : '—',
        spins: m.spins,
        biggest: m.biggestStake || '—',
        dry: m.deaths,
      };
      for (const [k, v] of Object.entries(vals)) {
        const el = refs.current[k];
        if (el && el.textContent !== String(v)) el.textContent = v;
      }
      if (refs.current.net) refs.current.net.dataset.sign = net < 0 ? 'neg' : 'pos';
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [machineRef]);

  const cell = (key, label, tip) => (
    <div className="ledger-cell tip" data-tip={tip} tabIndex={0}>
      <b ref={(el) => { refs.current[key] = el; }}>0</b>
      <span>{label}</span>
    </div>
  );

  return (
    <section className="ledger">
      {cell('staked', 'staked', 'Every credit the fly has put into the machine this session.')}
      {cell('won', 'paid out', 'Every credit the machine has paid back.')}
      {cell('net', 'net', 'Paid out minus staked. The house edge, in credits.')}
      {cell('ret', 'return', 'What came back per credit staked. About half, on these odds.')}
      {cell('spins', 'spins', 'Pulls of the lever.')}
      {cell('biggest', 'top stake', 'The most it has put on one spin.')}
      {cell('dry', 'ran dry', 'Times it has run out of credit and believed it was dying.')}
    </section>
  );
}
