import { useCallback, useRef, useState } from 'react';
import { TradeScene } from './scene/TradeScene.jsx';
import { Trader, PHASES } from './game/trader.js';
import { sound } from './audio/audio.js';
import { Connectome } from './neural/Connectome.jsx';
import { useConnectome } from './neural/useConnectome.js';
import { TraderBrain } from './neural/traderBrain.js';
import { Vitals } from './ui/Vitals.jsx';
import { Tooltips } from './ui/Tooltips.jsx';
import { MemoryPanel } from './ui/Memory.jsx';
import { TradeThinker } from './ui/tradeThoughts.js';
import {
  TradeBank, Vision, League, FillSlip, MarginCard, ClosedCard, NewsToast, TradeHowItWorks,
} from './ui/TradePanels.jsx';
import { GitHubIcon } from './ui/icons.jsx';
import { SiteMenu } from './ui/SiteMenu.jsx';
import { useSound } from './ui/useSound.js';
import site from '../site.config.js';
import { Loader } from './ui/Loader.jsx';

const SLIP_MS = 2400;
const NEWS_MS = 6000;

/**
 * A new market every visit, but a reproducible one: `?seed=42` replays
 * exactly the same prices, headlines and crashes.
 */
function readSeed() {
  try {
    const s = Number(new URLSearchParams(window.location.search).get('seed'));
    if (Number.isFinite(s) && s > 0) return Math.floor(s);
  } catch { /* fall through */ }
  return 1 + Math.floor(Math.random() * 1e6);
}

/** The trading desk: the fly paper-trades banana futures. One of the Fly Lab experiments. */
export default function TradeApp() {
  const traderRef = useRef(null);
  const eventRef = useRef(() => {});
  if (!traderRef.current) {
    traderRef.current = new Trader({ seed: readSeed(), onEvent: (t, d) => eventRef.current(t, d) });
  }
  const trader = traderRef.current;
  if (import.meta.env.DEV) window.__trader = trader;

  const [ui, setUi] = useState({ phase: trader.phase, result: null, history: [], panics: 0, marginCalls: 0, news: null, newsAt: 0 });
  const { muted, toggleSound } = useSound();
  const [howOpen, setHowOpen] = useState(false);
  const closeHow = useCallback(() => setHowOpen(false), []);

  eventRef.current = (type, d) => {
    switch (type) {
      case 'reach': sound.reach(); break;
      case 'press': sound.tin?.(); break;
      case 'panic': sound.seizure?.(); break;
      case 'filled':
        if (d.realized > 1) { sound.coin(Math.min(8, 2 + Math.round(d.realized / 100))); }
        else if (d.realized < -1) sound.lose();
        break;
      case 'marginCall': sound.broke(); break;
      case 'refill': sound.revive(); break;
      case 'news': sound.tease(); break;
      default: break;
    }
  };

  const { ready: cnsReady, store: cnsStore } = useConnectome(traderRef, TraderBrain);

  const onTick = useCallback(() => {
    const m = traderRef.current;
    const beat = Math.floor(Date.now() / 500);
    const news = m.market.news;
    setUi((prev) => (
      prev.beat === beat && prev.phase === m.phase && prev.result === m.lastResult
        && prev.panics === m.panics && prev.marginCalls === m.marginCalls && prev.news === news
        ? prev
        : {
          beat, phase: m.phase, result: m.lastResult, history: m.history.slice(),
          panics: m.panics, marginCalls: m.marginCalls,
          news, newsAt: news !== prev.news ? Date.now() : prev.newsAt,
        }
    ));
  }, []);

  const now = Date.now();
  const r = ui.result;
  const showSlip = r && now - r.at < SLIP_MS && ['buy', 'sell', 'panic'].includes(r.kind);
  const showNews = ui.news && now - ui.newsAt < NEWS_MS && ui.phase !== PHASES.MARGIN_CALL;

  return (
    <div className="app venue-dark venue-trade">
      <div className="stage">
        <TradeScene trader={trader} store={cnsStore} onTick={onTick} />

        <div className="stage-overlay">
          <Loader />
          <header className="masthead">
            <h1>
              <span className="title-full">Fruit Fly Trading Desk</span>
              <span className="title-compact">Fruit Fly Trader</span>
            </h1>
            <p className="lede">
              <mark>A real brain reads the chart.</mark> The price moves the fly&apos;s own motion detectors, the
              wiring of{' '}
              <a href="https://male-cns.janelia.org/" target="_blank" rel="noopener">MaleCNS v1.0</a>{' '}
              decides which way it leans, and <mark>a crash fires its escape reflex</mark>. It paper-trades
              banana futures, alone, against buy-and-hold and a coin.
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

          <TradeBank traderRef={traderRef} ui={ui} />

          <SiteMenu
            muted={muted}
            onToggleSound={toggleSound}
            howOpen={howOpen}
            onToggleHow={() => setHowOpen((v) => !v)}
          />
          <TradeHowItWorks open={howOpen} onClose={closeHow} />

          {showNews && <NewsToast news={ui.news} />}
          {ui.phase === PHASES.MARGIN_CALL && <MarginCard count={ui.marginCalls} />}
          {ui.phase === PHASES.CLOSED && <ClosedCard day={trader.market.day - 1} pnl={trader.pnl} />}
          {showSlip && ui.phase !== PHASES.MARGIN_CALL && ui.phase !== PHASES.CLOSED && <FillSlip result={r} />}
        </div>
      </div>

      <aside className="panel">
        <Connectome machineRef={traderRef} store={cnsStore} ready={cnsReady} />
        <Vision traderRef={traderRef} store={cnsStore} ready={cnsReady} />
        <League traderRef={traderRef} />
        <Vitals machineRef={traderRef} />
        <MemoryPanel store={cnsStore} ready={cnsReady} machineRef={traderRef} ThinkerClass={TradeThinker} />
        <footer className="panel-foot">
          <p className="credits-3d">
            3D model, CC BY 4.0:{' '}
            <a href="https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117" target="_blank" rel="noopener">
              fruit fly CT scan
            </a>
            {' '}by etainproject. Paper money only — nothing here is a real market or investment advice.
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
