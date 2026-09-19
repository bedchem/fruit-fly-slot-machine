/**
 * The fly's vitals.
 *
 * Read straight off the machine on an animation frame rather than through
 * React state — a heart trace that re-renders the DOM twelve times a second
 * looks like a heart trace that re-renders the DOM twelve times a second.
 */
import { useEffect, useRef } from 'react';

/**
 * What each signal is. Shown on hover, because the panel should be readable
 * without already knowing fly neuroscience.
 */
const EXPLAIN = {
  heart: 'The dorsal vessel, in beats per minute. A young adult fly rests around 270; octopamine is a cardioaccelerator, so arousal drives it up from there.',
  dopamine: 'The PAM cluster — the cells that signal reward. They fire when the spin pays, and that is what teaches the mushroom body the pull was worth making.',
  octopamine: 'The insect equivalent of adrenaline. It rises with anything salient, win or loss, and it sits upstream of the reward cells rather than beside them.',
  defensive: 'A persistent, scalable defensive state that builds as the credits drain. Deliberately not called fear — that word has not been earned in a fly.',
  npf: 'Neuropeptide F, this animal’s version of NPY: satisfaction. A losing streak drains it, and a fly running low on NPF seeks reward harder.',
};

export function Vitals({ machineRef }) {
  const ecgRef = useRef(null);
  const bpmRef = useRef(null);
  const rowsRef = useRef({});

  useEffect(() => {
    const canvas = ecgRef.current;
    const ctx = canvas?.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let W = 0, H = 0;
    let beatPhase = 0;
    const trace = [];

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = machineRef.current;
      if (!m) return;

      // --- the trace ---------------------------------------------------
      if (canvas) {
        const w = Math.max(60, canvas.clientWidth);
        const h = Math.max(24, canvas.clientHeight);
        if (w !== W || h !== H) { W = w; H = h; canvas.width = W; canvas.height = H; }

        // one PQRST complex per beat, at the fly's current rate
        beatPhase += dt * (m.heartRate / 60);
        while (beatPhase >= 1) beatPhase -= 1;
        const p = beatPhase;
        let v = 0;
        if (p < 0.10) v = Math.sin(p / 0.10 * Math.PI) * 0.18;          // P
        else if (p < 0.16) v = -0.14 * Math.sin((p - 0.10) / 0.06 * Math.PI); // Q
        else if (p < 0.22) v = Math.sin((p - 0.16) / 0.06 * Math.PI) * 1.0;   // R
        else if (p < 0.30) v = -0.3 * Math.sin((p - 0.22) / 0.08 * Math.PI);  // S
        else if (p < 0.52) v = Math.sin((p - 0.30) / 0.22 * Math.PI) * 0.26;  // T
        // as it gives up the complexes shrink towards a flat line
        trace.push(v * (1 - m.collapse * 0.85) + (Math.random() - 0.5) * 0.02);
        while (trace.length > W) trace.shift();

        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(43,36,28,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H / 2 + 0.5);
        ctx.lineTo(W, H / 2 + 0.5);
        ctx.stroke();

        ctx.strokeStyle = m.fear > 0.5 ? '#cf4a2f' : '#2b241c';
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const n = trace.length;
        for (let i = 0; i < n; i++) {
          const x = W - n + i;
          const y = H / 2 - trace[i] * (H * 0.38);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      // --- the numbers -------------------------------------------------
      if (bpmRef.current) bpmRef.current.textContent = Math.round(m.heartRate);

      const set = (key, value, text) => {
        const el = rowsRef.current[key];
        if (!el) return;
        el.style.setProperty('--v', String(Math.max(0, Math.min(1, value))));
        const out = el.querySelector('output');
        if (out) out.textContent = text;
      };
      set('dopamine', m.dopamine, m.dopamine.toFixed(2));
      set('octopamine', m.octopamine, m.octopamine.toFixed(2));
      set('defensive', m.fear, m.fear < 0.02 ? 'none' : m.fear.toFixed(2));
      set('npf', m.npf, m.npf.toFixed(2));

    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [machineRef]);

  const row = (key, label) => (
    <div className="vital" key={key} ref={(el) => { rowsRef.current[key] = el; }}>
      <span className="vital-label tip" data-tip={EXPLAIN[key]} tabIndex={0}>{label}</span>
      <div className="vital-track"><i /></div>
      <output className="vital-value">—</output>
    </div>
  );

  return (
    <section className="vitals">
      <div className="heart">
        <div className="heart-read tip" data-tip={EXPLAIN.heart} tabIndex={0}>
          <b ref={bpmRef}>296</b>
          <span>bpm</span>
        </div>
        <canvas ref={ecgRef} className="heart-trace" aria-label="Heart rate" />
      </div>

      {row('dopamine', 'Dopamine')}
      {row('octopamine', 'Octopamine')}
      {row('defensive', 'Defensive')}
      {row('npf', 'NPF')}

    </section>
  );
}
