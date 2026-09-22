import { useCallback, useEffect, useRef, useState } from 'react';
import { BarScene } from './scene/BarScene.jsx';
import { Bar, PHASES } from './game/bar.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { BarBrain } from './neural/barBrain.js';
import { Vitals } from './ui/Vitals.jsx';
import { Tooltips } from './ui/Tooltips.jsx';
import { MemoryPanel } from './ui/Memory.jsx';
import { HowItWorksButton } from './ui/HowItWorks.jsx';
import { BarThinker } from './ui/barThoughts.js';
import { BarBank, BarBody, BarTab, ActionSlip, DownCard, WakeCard, BarHowItWorks } from './ui/BarPanels.jsx';
import { LegalIcon, GitHubIcon, SoundIcon, LabIcon } from './ui/icons.jsx';
import site from '../site.config.js';
import { Loader } from './ui/Loader.jsx';

/** How long the slip after an action, and the morning card, stay up. */
const SLIP_MS = 2600;
const WAKE_CARD_MS = 5200;

/** The bar: the fly drinks and takes pouches. One of the Fly Lab experiments. */
export default function BarApp() {
  const barRef = useRef(null);
  const eventRef = useRef(() => {});
  if (!barRef.current) {
    barRef.current = new Bar({ onEvent: (type, detail) => eventRef.current(type, detail) });
  }
  const bar = barRef.current;
  // for poking at from the console while developing
  if (import.meta.env.DEV) window.__bar = bar;

  const [ui, setUi] = useState({ phase: bar.phase, result: null, history: [], passouts: 0, seizures: 0, wokeAt: 0, clock: bar.clock });
  const [muted, setMuted] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const closeHow = useCallback(() => setHowOpen(false), []);

  eventRef.current = (type, detail) => {
    switch (type) {
      case 'lean': sound.lean?.(); break;
      case 'sip': sound.sip?.(detail.n); break;
      case 'refill': sound.pour?.(); break;
      case 'reach': sound.reach(); break;
      case 'tin': sound.tin?.(); break;
      case 'lid': sound.lidShut?.(); break;
      case 'tuck': sound.tuck?.(detail.mg); break;
      case 'spent': sound.spit?.(); break;
      case 'passout': sound.passout?.(); break;
      case 'sleep': sound.snore?.(); break;
      case 'seizure': sound.seizure?.(); break;
      case 'wake': case 'recover': sound.revive(); break;
      default: break;
    }
  };

  const { ready: cnsReady, store: cnsStore } = useConnectome(barRef, BarBrain);

  const onTick = useCallback(() => {
    const m = barRef.current;
    // half-second beats, so timed cards come down without waiting for an event
    const beat = Math.floor(Date.now() / 500);
    setUi((prev) => (
      prev.beat === beat && prev.phase === m.phase && prev.result === m.lastResult && prev.passouts === m.passouts
        && prev.seizures === m.seizures && prev.wokeAt === m.wokeAt
        && (!m.down || prev.clock === m.clock)
        ? prev
        : {
          beat, phase: m.phase, result: m.lastResult, history: m.history.slice(),
          passouts: m.passouts, seizures: m.seizures, wokeAt: m.wokeAt, clock: m.clock,
        }
    ));
  }, []);

  // Sound: as in the casino, the first press anywhere turns it on, and after
  // that only the pill (or M) switches it.
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
  // leaving the bar must not leave it snoring
  useEffect(() => () => sound.stopSnore?.(), []);
  useEffect(() => {
    if (ui.phase !== PHASES.ASLEEP && ui.phase !== PHASES.PASSED_OUT) sound.stopSnore?.();
  }, [ui.phase]);

  const now = Date.now();
  const down = ui.phase === PHASES.ASLEEP || ui.phase === PHASES.PASSED_OUT || ui.phase === PHASES.SEIZURE;
  const showSlip = !down && ui.result && now - ui.result.at < SLIP_MS;
  const showWake = !down && ui.wokeAt > 0 && now - ui.wokeAt < WAKE_CARD_MS;

  return (
    <div className="app venue-bar">
      <div className="stage">
        <BarScene bar={bar} onTick={onTick} />

        <div className="stage-overlay">
          <Loader />
          <header className="masthead">
            <h1>
              <span className="title-full">Fruit Fly at the Bar</span>
              <span className="title-compact">Fruit Fly Bar</span>
            </h1>
            <p className="lede">
              <mark>The same real brain</mark>, now at a bar. Beer through a straw, nicotine pouches from the tin —
              and both drugs act on <mark>the measured wiring</mark> of{' '}
              <a href="https://male-cns.janelia.org/" target="_blank" rel="noopener">MaleCNS v1.0</a>: ethanol
              strengthens its GABA synapses, nicotine its cholinergic ones. It decides <mark>how much, and when to stop</mark>.
            </p>
            <p className="byline">
              <span>by </span>
              <a href="https://github.com/ryhox" target="_blank" rel="noopener" title="ryhox on GitHub">ryhox <GitHubIcon /></a>
              <span>, </span>
              <a href="https://github.com/plattnericus" target="_blank" rel="noopener" title="Nexor on GitHub">Nexor <GitHubIcon /></a>
              <span> and </span>
              <a href="https://github.com/peramanu" target="_blank" rel="noopener" title="peramanu on GitHub">peramanu <GitHubIcon /></a>
            </p>
          </header>

          <BarBank machineRef={barRef} ui={ui} />

          <nav className="dock-left" aria-label="Controls">
            <a className="pill info home" href="/"><LabIcon />Fly Lab</a>
            <button type="button" className={`pill sound ${muted ? 'off' : ''}`} aria-pressed={!muted} onClick={toggleSound}>
              <SoundIcon muted={muted} />
              {muted ? 'Sound off' : 'Sound on'}
            </button>
            <a className="pill info" href="/legal.html"><LegalIcon />Legal</a>
            <HowItWorksButton open={howOpen} onToggle={() => setHowOpen((v) => !v)} />
          </nav>
          <BarHowItWorks open={howOpen} onClose={closeHow} />

          {showSlip && <ActionSlip result={ui.result} />}
          {down && <DownCard phase={ui.phase} clock={ui.clock} />}
          {showWake && <WakeCard hangover={bar.hangover} />}
        </div>
      </div>

      <aside className="panel">
        <Connectome machineRef={barRef} store={cnsStore} ready={cnsReady} />
        <Vitals machineRef={barRef} />
        <BarBody machineRef={barRef} store={cnsStore} ready={cnsReady} />
        <MemoryPanel store={cnsStore} ready={cnsReady} machineRef={barRef} ThinkerClass={BarThinker} />
        <BarTab machineRef={barRef} />
        <footer className="panel-foot">
          <p className="credits-3d">
            3D model, CC BY 4.0:{' '}
            <a href="https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117" target="_blank" rel="noopener">
              fruit fly CT scan
            </a>
            {' '}by etainproject. The bar is built from primitives.
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
