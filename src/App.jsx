import { useCallback, useEffect, useRef, useState } from 'react';
import { FlyScene } from './scene/FlyScene.jsx';
import { SlotMachine as Machine, PHASES } from './game/machine.js';
import { LEVER_PULLED } from './scene/layout.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { Vitals } from './ui/Vitals.jsx';
import { Tooltips } from './ui/Tooltips.jsx';
import { ResultSlip, Credits, RunLog } from './ui/Result.jsx';

const PHASE_COPY = {
  [PHASES.IDLE]: 'waiting',
  [PHASES.REACHING]: 'reaching for the handle',
  [PHASES.PULLING]: 'pulling down',
  [PHASES.HELD]: 'latched',
  [PHASES.RETURNING]: 'springing back',
  [PHASES.SPINNING]: 'spinning',
  [PHASES.RESOLVING]: 'reading the line',
  [PHASES.RESULT]: 'result',
};

export default function App() {
  // The machine outlives every render; events are dispatched through a ref so
  // the handler can be redefined without rebuilding it.
  const machineRef = useRef(null);
  const eventRef = useRef(() => {});
  if (!machineRef.current) {
    machineRef.current = new Machine({
      leverPulled: LEVER_PULLED,
      onEvent: (type, detail) => eventRef.current(type, detail),
    });
  }
  const machine = machineRef.current;
  if (import.meta.env.DEV) window.__machine = machine;

  const [ui, setUi] = useState({
    phase: machine.phase, credits: machine.credits, spins: 0, wins: 0,
    result: null, history: [], best: 0,
  });
  const [muted, setMuted] = useState(false);

  const handleEvent = useCallback((type, detail) => {
    switch (type) {
      case 'reach': sound.reach(); break;
      case 'refill': sound.coin(3); break;
      case 'latch': sound.latch(); break;
      case 'release': sound.spring(); break;
      case 'slip': sound.slip(); break;
      case 'spinStart': sound.startReels(); break;
      case 'reelStop': {
        sound.reelStop(detail.index);
        const m = machineRef.current;
        // two matching with one still to land: lean on it
        if (detail.index === 1 && m.outcome && m.outcome.reels[0] === m.outcome.reels[1]) sound.tease();
        break;
      }
      case 'win':
        sound.stopReels();
        sound.win(detail.jackpot);
        sound.coin(detail.jackpot ? 12 : 5);
        break;
      case 'lose':
        sound.stopReels();
        sound.lose();
        break;
      default: break;
    }
  }, []);
  eventRef.current = handleEvent;

  // Loads the connectome and runs the rate model against the game. Once it is
  // ready the fly's dopamine comes from the simulated PAM cluster rather than
  // from a local curve.
  const { ready: cnsReady, store: cnsStore } = useConnectome(machineRef);

  const onTick = useCallback(() => {
    const m = machineRef.current;
    setUi((prev) => (
      prev.phase === m.phase && prev.credits === m.credits
        && prev.spins === m.spins && prev.result === m.lastResult
        ? prev
        : {
          phase: m.phase, credits: m.credits, spins: m.spins, wins: m.wins,
          result: m.lastResult, history: m.history.slice(), best: m.best,
        }
    ));
  }, []);

  // The fly plays on its own; there is nothing to press. Browsers still will
  // not start audio without a gesture, so the first interaction of any kind
  // unlocks it and then the listener retires.
  useEffect(() => {
    const unlock = () => { sound.resume(); };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'm' || e.key === 'M') setMuted((v) => { sound.setMuted(!v); return !v; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showResult = ui.result && (ui.phase === PHASES.RESULT || ui.phase === PHASES.RESOLVING);

  return (
    <div className="app">
      <div className="stage">
        <FlyScene machine={machine} onTick={onTick} />

        <div className="stage-overlay">
          <header className="masthead sheet">
            <h1>Fruit Fly Slot Machine</h1>
            <p>A <i>Drosophila</i> CT scan plays a one-armed bandit, on its own.</p>
          </header>

          <div className="dock sheet">
            <div className="credits">
              <Credits value={ui.credits} /><span>credits</span>
            </div>
            <RunLog history={ui.history} />
            <div className="dock-buttons">
              <button className="btn" onClick={() => setMuted((v) => { sound.setMuted(!v); return !v; })}>
                {muted ? 'Sound off' : 'Sound on'}
              </button>
            </div>
            <p className="dock-status">
              <span className="live" /> {PHASE_COPY[ui.phase] || ui.phase}
              {ui.best > 0 && <em className="best">best {ui.best}</em>}
            </p>
          </div>

          {showResult && <ResultSlip result={ui.result} />}
        </div>
      </div>

      <aside className="panel sheet">
        <div className="holes" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => <span key={i} />)}
        </div>

        <Connectome machineRef={machineRef} store={cnsStore} ready={cnsReady} />
        <Vitals machineRef={machineRef} />

        <p className="note">
          Anatomy and wiring are real: soma coordinates, cell types and
          {' '}<b>151.9 M</b> measured synapses from <b>MaleCNS v1.0</b>. Activity is a
          rate model run over that wiring — the game only injects current into
          the real sensory and dopaminergic populations; where it spreads is the
          connectome's doing.
        </p>
      </aside>

      <Tooltips />
    </div>
  );
}

