import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollScene } from './scene/ScrollScene.jsx';
import { Duo, NAMES } from './game/scroll.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { DuoBrain } from './neural/scrollBrain.js';
import { Tooltips } from './ui/Tooltips.jsx';
import {
  ScrollBank, Phones, Feeds, ScrollVitals, Thread, Thoughts, MorningCard, EventToast, ScrollHowItWorks,
} from './ui/ScrollPanels.jsx';
import { GitHubIcon } from './ui/icons.jsx';
import { SiteMenu, LabHome } from './ui/SiteMenu.jsx';
import { useSound } from './ui/useSound.js';
import { useTikTokConsent, TikTokNotice, EditList, TikTokTagFeed } from './ui/TikTokConsent.jsx';
import { EDIT_TAG } from './game/tiktokEdits.js';
import { cachedEdits, fetchEdits, forgetEdits } from './game/editPool.js';
import { EditOverlay, Favourites } from './ui/EditViews.jsx';
import { Loader } from './ui/Loader.jsx';
import site from '../site.config.js';

const TOAST_MS = 2600;
/** A long night on the page still picks up a pool refreshed in the meantime. */
const POOL_POLL_MS = 20 * 60 * 1000;

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

  const [ui, setUi] = useState({ thread: [], morning: null, toast: null, playing: [null, null], upcoming: [null, null] });

  // TikTok: nothing loads until the visitor allows it. With no edits listed
  // and no hashtag there is nothing to ask about, so the notice never appears.
  const [tiktok, setTiktok] = useTikTokConsent();
  // the pool starts from what this browser last saw; a fresh one only adds to it
  const [edits, setEdits] = useState(cachedEdits);
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const [noticeOpen, setNoticeOpen] = useState(() => (edits.length > 0 || !!EDIT_TAG) && tiktok === null);
  /** Which fly's phone you hear, when both are on an edit. */
  const [listen, setListen] = useState(0);
  /** Which fly's edit is open large over the scene, if any. */
  const [expanded, setExpanded] = useState(null);
  const closeExpanded = useCallback(() => setExpanded(null), []);
  const fanMode = tiktok === true && edits.length > 0;
  // consent switches the edits on and off; a refreshed pool only joins them
  useEffect(() => { duo.setFan(editsRef.current, tiktok === true); }, [duo, tiktok]);
  useEffect(() => { duo.updateEdits(edits); }, [duo, edits]);
  useEffect(() => {
    if (tiktok !== true) {
      if (tiktok === false) forgetEdits();
      return undefined;
    }
    const ctl = new AbortController();
    const pull = () => fetchEdits({ signal: ctl.signal }).then((list) => { if (list) setEdits(list); });
    pull();
    const poll = setInterval(pull, POOL_POLL_MS);
    return () => { ctl.abort(); clearInterval(poll); };
  }, [tiktok]);
  const toast = useRef(null);
  const { muted, toggleSound } = useSound();
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
    // and what each of those phones shows next, to load it before the swipe
    const upcoming = playing.map((r, i) => (r ? d.upcomingEdit(i) : null));
    setUi((prev) => (
      prev.beat === beat && prev.threadLen === d.thread.length && prev.morning === d.morning && prev.toast === toast.current
        && prev.playing[0] === playing[0] && prev.playing[1] === playing[1]
        && prev.upcoming[0] === upcoming[0] && prev.upcoming[1] === upcoming[1]
        ? prev
        : { beat, thread: d.thread.slice(), threadLen: d.thread.length, morning: d.morning, toast: toast.current, playing, upcoming }
    ));
  }, []);

  const showToast = ui.toast && Date.now() - ui.toast.at < TOAST_MS && !ui.morning;

  return (
    <div className="app venue-dark venue-scroll">
      <div className="stage">
        <ScrollScene duo={duo} onTick={onTick} canvasRefs={canvasRefs} />

        <div className="stage-overlay">
          <header className="masthead">
            <LabHome />
            <h1>
              <span className="title-full">Two Flies Doomscrolling</span>
              <span className="title-compact">Doomscroll</span>
            </h1>
            <p className="byline">
              <span>by </span>
              <a href="https://github.com/orgs/bedchem/people" target="_blank" rel="noopener" title="BedChem on GitHub">BedChem <GitHubIcon /></a>
            </p>
          </header>

          <ScrollBank duoRef={duoRef} />

          <SiteMenu
            muted={muted}
            onToggleSound={toggleSound}
            howOpen={howOpen}
            onToggleHow={() => setHowOpen((v) => !v)}
          />
          <ScrollHowItWorks
            open={howOpen}
            onClose={closeHow}
            onCookieSettings={() => setNoticeOpen(true)}
          />
          {noticeOpen && (
            <TikTokNotice value={tiktok} onChoose={setTiktok} onClose={() => setNoticeOpen(false)} count={edits.length} />
          )}

          <Loader ready={cnsReady} />
          {showToast && <EventToast event={ui.toast} />}
          {expanded !== null && (
            <EditOverlay
              duo={duo}
              index={expanded}
              reel={tiktok === true ? ui.playing[expanded] : null}
              next={tiktok === true ? ui.upcoming[expanded] : null}
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
          upcoming={tiktok === true ? ui.upcoming : [null, null]}
          soundOn={!muted}
          listen={listen}
          onListen={(i) => { setListen(i); if (muted) toggleSound(); }}
          expanded={expanded}
          onExpand={setExpanded}
        />
        {fanMode ? <Favourites duoRef={duoRef} /> : <Feeds duoRef={duoRef} />}
        <div className="scopes">
          <div>
            <span className="scope-owner">{NAMES[0]}&apos;s brain</span>
            <Connectome machineRef={duoRef} store={cnsStore} ready={cnsReady} height={170} />
          </div>
          <div>
            <span className="scope-owner">{NAMES[1]}&apos;s brain</span>
            <Connectome machineRef={duoRef} store={storeB} ready={cnsReady && !!storeB.current.sim} height={170} />
          </div>
        </div>
        <ScrollVitals flyRefs={flyRefs} />
        <TikTokTagFeed allowed={tiktok === true} onAsk={() => setNoticeOpen(true)} />
        <Thread thread={ui.thread} />
        <Thoughts duoRef={duoRef} />
        <EditList edits={edits} />
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
