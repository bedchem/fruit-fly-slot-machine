import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollScene } from './scene/ScrollScene.jsx';
import { Duo } from './game/scroll.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { DuoBrain } from './neural/scrollBrain.js';
import { Tooltips } from './ui/Tooltips.jsx';
import { CortisolMeter } from './ui/CortisolMeter.jsx';
import { HowItWorksButton } from './ui/HowItWorks.jsx';
import {
  ScrollBank, Phones, Feeds, Pair, Thread, Thoughts, MorningCard, EventToast, ScrollHowItWorks,
} from './ui/ScrollPanels.jsx';
import { LegalIcon, GitHubIcon, SoundIcon, LabIcon } from './ui/icons.jsx';
import { useTikTokConsent, TikTokNotice, EditList } from './ui/TikTokConsent.jsx';
import { EDITS, EDIT_SUBJECT } from './game/tiktokEdits.js';
import { EditOverlay, Favourites } from './ui/EditViews.jsx';
import { Loader } from './ui/Loader.jsx';
import site from '../site.config.js';

const TOAST_MS = 2600;

function readSeed() {
  try {
    const s = Number(new URLSearchParams(window.location.search).get('seed'));
    if (Number.isFinite(s) && s > 0) return Math.floor(s);
  } catch { /* fall through */ }
  return 1 + Math.floor(Math.random() * 1e6);
}

/** Two flies doomscrolling and sending each other reels. One of the Fly Lab experiments. */
export default function ScrollApp() {
  const duoRef = useRef(null);
  const eventRef = useRef(() => {});
  if (!duoRef.current) duoRef.current = new Duo({ seed: readSeed(), onEvent: (t, d) => eventRef.current(t, d) });
  const duo = duoRef.current;
  if (import.meta.env.DEV) window.__duo = duo;
  const canvasRefs = [useRef(null), useRef(null)];
  // one ref per fly, for the widgets that read a single animal
  const flyRefs = [useRef(duo.flies[0]), useRef(duo.flies[1])];

  const [ui, setUi] = useState({ thread: [], morning: null, toast: null, playing: [null, null] });

  // TikTok: nothing loads until the visitor allows it. With no edits listed
  // there is nothing to ask about, so the notice never appears.
  const [tiktok, setTiktok] = useTikTokConsent();
  const [noticeOpen, setNoticeOpen] = useState(() => EDITS.length > 0 && tiktok === null);
  /** Which fly's phone you hear, when both are on an edit. */
  const [listen, setListen] = useState(0);
  /** Which fly's edit is open large over the scene, if any. */
  const [expanded, setExpanded] = useState(null);
  const closeExpanded = useCallback(() => setExpanded(null), []);
  const fanMode = tiktok === true && EDITS.length > 0;
  useEffect(() => { duo.setFan(EDITS, tiktok === true); }, [duo, tiktok]);
  const toast = useRef(null);
  const [muted, setMuted] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const closeHow = useCallback(() => setHowOpen(false), []);

  eventRef.current = (type, d) => {
    const name = d && d.fly !== undefined ? duo.flies[d.fly].name : '';
    const say = (text) => { toast.current = { text, at: Date.now() }; };
    switch (type) {
      case 'swipe': sound.slip?.(); break;
      case 'shareStart': sound.tin?.(); break;
      case 'buzz': sound.reach(); sound.tease(); break;
      case 'flinch': sound.lose(); say(`${name} flinched — the giant fibre fired at a video`); break;
      case 'dead': sound.broke(); say(`${name}'s phone died`); break;
      case 'asleep': say(`${name} fell asleep with the phone in hand`); break;
      case 'morning': sound.revive(); break;
      default: break;
    }
  };

  // one connectome load, two brains: the second scope reads the second brain
  const { ready: cnsReady, store: cnsStore } = useConnectome(duoRef, DuoBrain);
  const storeB = useRef({});
  if (cnsReady && cnsStore.current.brain && !storeB.current.sim) {
    const b = cnsStore.current.brain.brains[1];
    storeB.current = { neurons: cnsStore.current.neurons, sim: b.sim, rest: b.rest, meta: cnsStore.current.meta };
  }

  const onTick = useCallback(() => {
    const d = duoRef.current;
    const beat = Math.floor(Date.now() / 500);
    // which fly is on a TikTok edit right now, if any: those get a player
    const playing = d.flies.map((f) => (f.reel.cat === 'fan' && f.screenOn && d.canPlay(f.reel.edit) ? f.reel : null));
    setUi((prev) => (
      prev.beat === beat && prev.threadLen === d.thread.length && prev.morning === d.morning && prev.toast === toast.current
        && prev.playing[0] === playing[0] && prev.playing[1] === playing[1]
        ? prev
        : { beat, thread: d.thread.slice(), threadLen: d.thread.length, morning: d.morning, toast: toast.current, playing }
    ));
  }, []);

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

  const showToast = ui.toast && Date.now() - ui.toast.at < TOAST_MS && !ui.morning;

  return (
    <div className="app venue-dark venue-scroll">
      <div className="stage">
        <ScrollScene duo={duo} onTick={onTick} canvasRefs={canvasRefs} />

        <div className="stage-overlay">
          <header className="masthead">
            <h1>
              <span className="title-full">Two Flies Doomscrolling</span>
              <span className="title-compact">Doomscroll</span>
            </h1>
            {fanMode ? (
              <p className="lede">
                <mark>Two real brains, one crush.</mark> Drosi and Phila scroll {EDIT_SUBJECT} edits on TikTok and send
                each other the ones that hit. Her songs reach them through Johnston&apos;s organ, dopamine does the
                rest, and <mark>every edit makes them fall a little further</mark>. Click a phone to watch along.
              </p>
            ) : (
              <p className="lede">
                <mark>Two real brains, one feed.</mark> Drosi and Phila scroll reels made of things a fly&apos;s nervous
                system cares about, send each other the ones that hit, and flinch at spiders through their real giant
                fibre. The algorithm only measures watch time — and <mark>drifts them towards doom</mark>.
              </p>
            )}
            <p className="byline">
              <span>by </span>
              <a href="https://github.com/ryhox" target="_blank" rel="noopener" title="ryhox on GitHub">ryhox <GitHubIcon /></a>
              <span>, </span>
              <a href="https://github.com/plattnericus" target="_blank" rel="noopener" title="Nexor on GitHub">Nexor <GitHubIcon /></a>
              <span> and </span>
              <a href="https://github.com/peramanu" target="_blank" rel="noopener" title="peramanu on GitHub">peramanu <GitHubIcon /></a>
            </p>
          </header>

          <ScrollBank duoRef={duoRef} />

          <nav className="dock-left" aria-label="Controls">
            <a className="pill info home" href="/"><LabIcon />Fly Lab</a>
            <button type="button" className={`pill sound ${muted ? 'off' : ''}`} aria-pressed={!muted} onClick={toggleSound}>
              <SoundIcon muted={muted} />
              {muted ? 'Sound off' : 'Sound on'}
            </button>
            <a className="pill info" href="/legal.html"><LegalIcon />Legal</a>
            {EDITS.length > 0 && (
              <button type="button" className="pill info" onClick={() => setNoticeOpen(true)} aria-haspopup="dialog">
                <LegalIcon />Cookie settings
              </button>
            )}
            <HowItWorksButton open={howOpen} onToggle={() => setHowOpen((v) => !v)} />
          </nav>
          <ScrollHowItWorks open={howOpen} onClose={closeHow} />
          {noticeOpen && (
            <TikTokNotice value={tiktok} onChoose={setTiktok} onClose={() => setNoticeOpen(false)} count={EDITS.length} />
          )}

          <Loader />
          {showToast && <EventToast event={ui.toast} />}
          {expanded !== null && (
            <EditOverlay
              duo={duo}
              index={expanded}
              reel={tiktok === true ? ui.playing[expanded] : null}
              audible={!muted}
              onClose={closeExpanded}
            />
          )}
          <MorningCard report={ui.morning} />
        </div>
      </div>

      <aside className="panel">
        <Phones
          duoRef={duoRef}
          canvasRefs={canvasRefs}
          playing={tiktok === true ? ui.playing : [null, null]}
          soundOn={!muted}
          listen={listen}
          onListen={(i) => { setListen(i); if (muted) toggleSound(); }}
          expanded={expanded}
          onExpand={setExpanded}
        />
        {fanMode ? <Favourites duoRef={duoRef} /> : <Feeds duoRef={duoRef} />}
        <div className="scopes">
          <div>
            <span className="scope-owner">Drosi&apos;s brain</span>
            <Connectome machineRef={duoRef} store={cnsStore} ready={cnsReady} height={170} />
          </div>
          <div>
            <span className="scope-owner">Phila&apos;s brain</span>
            <Connectome machineRef={duoRef} store={storeB} ready={cnsReady && !!storeB.current.sim} height={170} />
          </div>
        </div>
        <Pair duoRef={duoRef} />
        <div className="cortisols">
          <CortisolMeter machineRef={flyRefs[0]} label="Cortisol · Drosi" idPrefix="cortisol-drosi" />
          <CortisolMeter machineRef={flyRefs[1]} label="Cortisol · Phila" idPrefix="cortisol-phila" />
        </div>
        <Thread thread={ui.thread} />
        <Thoughts duoRef={duoRef} />
        <EditList edits={EDITS} />
        <footer className="panel-foot">
          <p className="credits-3d">
            3D model, CC BY 4.0:{' '}
            <a href="https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117" target="_blank" rel="noopener">
              fruit fly CT scan
            </a>
            {' '}by etainproject, twice. The reels are drawn from primitives; no fly owns a phone.
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
