import { useCallback, useRef, useState } from 'react';
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
import { HowItWorks } from './ui/HowItWorks.jsx';
import site from '../site.config.js';
import { Loader } from './ui/Loader.jsx';
import { GitHubIcon } from './ui/icons.jsx';
import { SiteMenu } from './ui/SiteMenu.jsx';
import { useSound } from './ui/useSound.js';

/** How long the "it comes round" card stays up. */
const REVIVE_CARD_MS = 4200;

/** The casino: the fly at the slot machine. One of the Fly Lab experiments. */
export default function CasinoApp() {
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
  const { muted, toggleSound } = useSound();
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

  const showResult = ui.result && (ui.phase === PHASES.RESULT || ui.phase === PHASES.RESOLVING);
  // onTick fires at 12 Hz, so the card comes down within a tick of its time
  const showRevive = !ui.brokeStage && ui.revivedAt > 0 && Date.now() - ui.revivedAt < REVIVE_CARD_MS;

  return (
    <div className="app">
      <div className="stage">
        <FlyScene machine={machine} onTick={onTick} />

        <div className="stage-overlay">
          <Loader />
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
              <span>, </span>
              <a href="https://github.com/plattnericus" target="_blank" rel="noopener" title="Nexor on GitHub">
                Nexor <GitHubIcon />
              </a>
              <span> and </span>
              <a href="https://github.com/peramanu" target="_blank" rel="noopener" title="peramanu on GitHub">
                peramanu <GitHubIcon />
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

          <SiteMenu
            muted={muted}
            onToggleSound={toggleSound}
            howOpen={howOpen}
            onToggleHow={() => setHowOpen((v) => !v)}
          />
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
