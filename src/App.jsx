import { useCallback, useEffect, useRef, useState } from 'react';
import { FlyScene } from './scene/FlyScene.jsx';
import { SlotMachine as Machine, PHASES } from './game/machine.js';
import { LEVER_PULLED } from './scene/layout.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { Vitals } from './ui/Vitals.jsx';
import { Tooltips } from './ui/Tooltips.jsx';
import { ResultSlip, Credits, RunLog, BrokeCard, ReviveCard } from './ui/Result.jsx';
import { Stake } from './ui/Stake.jsx';
import { MemoryPanel, Ledger } from './ui/Memory.jsx';
import { HowItWorks, HowItWorksButton } from './ui/HowItWorks.jsx';
import site from '../site.config.js';

/** A page with lines of text: the legal notice. */
function LegalIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M12 2.5V6h3.5" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M7.8 10h4.6M7.8 13h4.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

/** The GitHub mark. */
function GitHubIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/** How long the "it comes round" card stays up. */
const REVIVE_CARD_MS = 4200;

/** A speaker: sound waves when on, a cross when muted. */
function SoundIcon({ muted }) {
  return (
    <svg className="pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
      {muted ? (
        <path d="M13 7.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      ) : (
        <>
          <path d="M13 7.3a3.6 3.6 0 0 1 0 5.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M15.4 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );
}

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

  const [ui, setUi] = useState({
    phase: machine.phase, credits: machine.credits, spins: 0, wins: 0,
    result: null, history: [],
    brokeStage: null, deaths: 0, revivedAt: 0,
  });
  const [muted, setMuted] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const closeHow = useCallback(() => setHowOpen(false), []);

  const handleEvent = useCallback((type, detail) => {
    switch (type) {
      case 'reach': sound.reach(); break;
      case 'broke': sound.stopReels(); sound.broke(); break;
      case 'revive': sound.revive(); break;
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
        && prev.brokeStage === m.brokeStage && prev.revivedAt === m.revivedAt
        && prev.deaths === m.deaths
        ? prev
        : {
          phase: m.phase, credits: m.credits, spins: m.spins, wins: m.wins,
          result: m.lastResult, history: m.history.slice(),
          brokeStage: m.brokeStage, deaths: m.deaths, revivedAt: m.revivedAt,
        }
    ));
  }, []);

  // Sound starts off. Browsers will not start audio without a gesture anyway,
  // so the visitor's FIRST press anywhere on the page turns it on. After that
  // only the sound pill (or M) switches it: once someone has turned it off,
  // clicking around the page must not bring it back.
  const soundTouched = useRef(false);
  const toggleSound = useCallback(() => {
    soundTouched.current = true;
    sound.resume();
    setMuted((v) => { sound.setMuted(!v); return !v; });
  }, []);

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const first = (e) => {
      if (soundTouched.current) return;
      // the pill and M make their own choice; turning it on here as well
      // would have their toggle switch it straight back off
      if (e.target?.closest?.('.pill.sound') || e.key === 'm' || e.key === 'M') return;
      soundTouched.current = true;
      sound.resume();
      sound.setMuted(false);
      setMuted(false);
    };
    events.forEach((e) => window.addEventListener(e, first, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, first));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'm' || e.key === 'M') toggleSound(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSound]);

  const showResult = ui.result && (ui.phase === PHASES.RESULT || ui.phase === PHASES.RESOLVING);
  // onTick fires at 12 Hz, so the card comes down within a tick of its time
  const showRevive = !ui.brokeStage && ui.revivedAt > 0 && Date.now() - ui.revivedAt < REVIVE_CARD_MS;

  return (
    <div className="app">
      <div className="stage">
        <FlyScene machine={machine} onTick={onTick} />

        <div className="stage-overlay">
          <header className="masthead">
            <h1>
              <span className="title-full">Fruit Fly Slot Machine</span>
              <span className="title-compact">Fruit Fly Slots</span>
            </h1>
            <p className="lede">
              <mark>A real brain.</mark> Every dot is a neuron of <mark>a real male fruit fly</mark>, mapped synapse by synapse
              from electron microscopy by{' '}
              <a href="https://www.janelia.org/project-team/flyem" target="_blank" rel="noopener">HHMI Janelia&rsquo;s FlyEM team</a>
              {' '}with{' '}
              <a href="https://research.google" target="_blank" rel="noopener">Google Research</a>,
              {' '}Cambridge and the MRC LMB, published as{' '}
              <a href="https://male-cns.janelia.org/" target="_blank" rel="noopener">MaleCNS v1.0</a>.
              What it does is how that real wiring responds in a fruit fly <mark>forced to gamble forever</mark>.
            </p>
            <p className="byline">
              <span>by </span>
              <a href="https://github.com/ryhox" target="_blank" rel="noopener" title="ryhox on GitHub">
                ryhox <GitHubIcon />
              </a>
              <span> and </span>
              <a href="https://github.com/plattnericus" target="_blank" rel="noopener" title="Nexor on GitHub">
                Nexor <GitHubIcon />
              </a>
            </p>
          </header>

          <aside className="bank">
            <div className="credits">
              <Credits value={ui.credits} /><span>credits</span>
            </div>
            <Stake machineRef={machineRef}>
              <RunLog history={ui.history} />
            </Stake>
            {ui.deaths > 0 && (
              <div className="bank-tags">
                <div className="tag dry">ran dry ×{ui.deaths}</div>
              </div>
            )}
          </aside>

          {/* bottom left: sound, then Legal, then How it works */}
          <nav className="dock-left" aria-label="Controls">
            <button
              type="button"
              className={`pill sound ${muted ? 'off' : ''}`}
              aria-pressed={!muted}
              onClick={toggleSound}
            >
              <SoundIcon muted={muted} />
              {muted ? 'Sound off' : 'Sound on'}
            </button>
            <a className="pill info" href="/legal.html"><LegalIcon />Legal</a>
            <HowItWorksButton open={howOpen} onToggle={() => setHowOpen((v) => !v)} />
          </nav>
          <HowItWorks open={howOpen} onClose={closeHow} />

          {showResult && <ResultSlip result={ui.result} />}
          {ui.brokeStage && <BrokeCard stage={ui.brokeStage} deaths={ui.deaths} />}
          {showRevive && <ReviveCard credits={machine.startingCredits} />}
        </div>
      </div>

      <aside className="panel">
        <Connectome machineRef={machineRef} store={cnsStore} ready={cnsReady} />
        <Vitals machineRef={machineRef} />
        <MemoryPanel store={cnsStore} ready={cnsReady} machineRef={machineRef} />
        <Ledger machineRef={machineRef} />
        <footer className="panel-foot">
          <p className="credits-3d">
            3D models, CC BY 4.0:{' '}
            <a
              href="https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117"
              target="_blank"
              rel="noopener"
            >
              fruit fly CT scan
            </a>
            {' '}by etainproject ·{' '}
            <a
              href="https://sketchfab.com/3d-models/pillar-slots-91e255e5a95745f4857607b388421ee1"
              target="_blank"
              rel="noopener"
            >
              Pillar Slots
            </a>
            {' '}by local.yany
          </p>
          <a className="source" href={site.repository} target="_blank" rel="noopener">
            <GitHubIcon /> Open source on GitHub
          </a>
        </footer>
      </aside>

      <Tooltips />
    </div>
  );
}
