/**
 * TikTok on the doomscroll page: the consent notice, the player, the live
 * hashtag feed, and the credits.
 *
 * Nothing here contacts TikTok until the visitor clicks "Allow TikTok
 * videos". Before that there is no iframe, no script, no preconnect — only
 * this notice. After it, each edit plays in TikTok's own embed player
 * (tiktokEdits.js), with the creator credited and linked underneath, and the
 * panel shows TikTok's hashtag embed. Withdrawing removes every frame at once.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { currentConsent, setConsent, onConsentChange, consentDate } from '../consent/consent.js';
import { playerUrl, tagEmbedUrl, tagUrl, EDIT_SUBJECT, EDIT_TAG } from '../game/tiktokEdits.js';
import { PHASES } from '../game/scroll.js';

export const TIKTOK = 'tiktok';
const TIKTOK_ORIGIN = 'https://www.tiktok.com';
/** A post TikTok could not serve loads again this often before the fly gives up on it. */
const RETRIES = 2;
const RETRY_MS = 1500;

/** [allowed (true/false/null), set(value)] — live across tabs. */
export function useTikTokConsent() {
  const [value, setValue] = useState(() => currentConsent(TIKTOK));
  useEffect(() => onConsentChange(() => setValue(currentConsent(TIKTOK))), []);
  const set = useCallback((v) => { setConsent(TIKTOK, v); setValue(v); }, []);
  return [value, set];
}

/**
 * The notice. Accept and reject are the same size and weight; the close
 * button rejects; nothing is pre-selected.
 */
export function TikTokNotice({ value, onChoose, onClose, count }) {
  const since = consentDate(TIKTOK);
  const decided = value !== null;
  const offer = [
    count > 0 && `the flies can also scroll ${count} real TikTok edit${count === 1 ? '' : 's'}`,
    EDIT_TAG && `the panel can show what TikTok lists under #${EDIT_TAG} right now`,
  ].filter(Boolean).join(', and ');
  return (
    <div className="slip consent" role="dialog" aria-labelledby="tiktok-consent-title" aria-describedby="tiktok-consent-body">
      <button type="button" className="howto-close" onClick={() => { if (!decided) onChoose(false); onClose(); }} aria-label="Close (no TikTok videos)">×</button>
      <h2 id="tiktok-consent-title">{EDIT_SUBJECT} edits from TikTok</h2>
      <div id="tiktok-consent-body" className="consent-body">
        <p>
          {offer.charAt(0).toUpperCase() + offer.slice(1)}, shown with TikTok&apos;s official embeds. Nothing from
          TikTok loads unless you allow it.
        </p>
        <p>
          If you allow it, your browser connects to TikTok (TikTok Technology Limited, Ireland). TikTok receives
          your IP address and information about your browser and device, and may store cookies or similar data on
          your device and use them for its own purposes, including analytics and advertising, as described in its
          {' '}<a href="https://www.tiktok.com/legal/page/eea/privacy-policy/en" target="_blank" rel="noopener">privacy policy</a>
          {' '}and <a href="https://www.tiktok.com/legal/page/global/cookie-policy/en" target="_blank" rel="noopener">cookie policy</a>.
          TikTok may transfer data outside the EU.
        </p>
        <p>
          You can change your mind at any time with <b>Cookie settings</b> on this page or on the
          {' '}<a href="/legal.html#tiktok">legal page</a>. Without TikTok, the experiment runs exactly as before.
        </p>
        {decided && (
          <p className="consent-state">
            Current choice: <b>{value ? 'TikTok videos allowed' : 'no TikTok videos'}</b>
            {since ? ` (since ${new Date(since).toLocaleDateString()})` : ''}.
          </p>
        )}
      </div>
      <div className="consent-actions">
        <button type="button" className="consent-btn" onClick={() => { onChoose(false); onClose(); }}>
          {value ? 'Withdraw consent' : 'Continue without TikTok'}
        </button>
        <button type="button" className="consent-btn" onClick={() => { onChoose(true); onClose(); }} disabled={value === true}>
          Allow TikTok videos
        </button>
      </div>
    </div>
  );
}

/**
 * One TikTok player on a fly's phone. The frame lives as long as the phone
 * shows the same post, so a post loaded early — waiting muted and paused just
 * below the one playing — is the one the swipe brings in, with nothing left
 * to load. While it plays it reports the real length of the edit back to the
 * fly, and tells the flies to skip a post TikTok cannot play (removed,
 * private, or embedding switched off). Without a `reel` it only waits.
 */
export function TikTokPlayer({ duo, edit, reel = null, audible = false }) {
  const frame = useRef(null);
  const ready = useRef(false);
  /** What TikTok reported, once it stopped trying, while the post waited off screen. */
  const failed = useRef(null);
  const now = useRef({ reel, audible });
  now.current = { reel, audible };
  // A post TikTok could not serve loads again, quietly, a couple of times
  // before the fly moves on. The first players of a visit often fail while
  // TikTok's session is still being set up, and a failure reported twice must
  // not cost the fly two videos.
  const [attempt, setAttempt] = useState(0);
  const attempts = useRef(0);
  const retryTimer = useRef(0);
  const retry = useCallback((code) => {
    if (attempts.current >= RETRIES) {
      const live = now.current.reel;
      if (live) duo.skipReel(live.id);
      else failed.current = code;
      return;
    }
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      attempts.current += 1;
      ready.current = false;
      setAttempt(attempts.current);
    }, RETRY_MS);
  }, [duo]);
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  /** Sends one of the player's documented commands (mute, unMute, play, seekTo…). */
  const command = useCallback((type, value) => {
    const msg = value === undefined ? { type } : { type, value };
    frame.current?.contentWindow?.postMessage({ ...msg, 'x-tiktok-player': true }, TIKTOK_ORIGIN);
  }, []);

  useEffect(() => {
    let autoplayRetried = false;
    const onMessage = (e) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const msg = typeof e.data === 'string' ? safeParse(e.data) : e.data;
      if (!msg || !msg['x-tiktok-player']) return;
      const live = now.current.reel;
      if (msg.type === 'onPlayerReady') {
        ready.current = true;
        command(live && now.current.audible ? 'unMute' : 'mute');
        command(live ? 'play' : 'pause');
      }
      if (msg.type === 'onPlayerError') {
        // 1001: no such post, or its creator does not allow embedding — never
        // again, playing or waiting. 2001/3001: TikTok could not serve or play
        // it this time — load it again, and skip it if that keeps failing.
        // 3002: retry muted once, since some browsers only allow silent
        // autoplay. It is not a fault of the post.
        const code = msg.value?.errorCode;
        if (code === 1001) duo.markBroken(edit.id);
        else if (code === 2001 || code === 3001) retry(code);
        else if (code === 3002 && live && !autoplayRetried) {
          autoplayRetried = true;
          command('mute');
          command('play');
        }
        return;
      }
      if (!live) {
        // waiting: it autoplays when it loads, so it is held at the start
        if (msg.type === 'onStateChange' && msg.value === 1) command('pause');
        return;
      }
      if (msg.type === 'onCurrentTime' && msg.value) duo.setEditDuration(live.id, msg.value.duration);
      if (msg.type === 'onStateChange' && msg.value === 0) duo.finishEdit(live.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [duo, edit.id, command, retry]);

  // A new reel on this frame — the waiting post coming up, or the same post
  // again to watch together — plays from the start.
  const reelId = reel?.id ?? null;
  const started = useRef(reelId);
  useEffect(() => {
    if (reelId === null || started.current === reelId) return;
    started.current = reelId;
    const code = failed.current;
    failed.current = null;
    if (code === 2001 || code === 3001) { duo.skipReel(reelId); return; }
    if (!ready.current) return;   // onPlayerReady starts it
    command('seekTo', 0);
    command(now.current.audible ? 'unMute' : 'mute');
    command('play');
  }, [reelId, duo, command]);

  // sound follows the page: one audible player at most, and only with sound on
  useEffect(() => {
    if (ready.current && reelId !== null) command(audible ? 'unMute' : 'mute');
  }, [audible, reelId, command]);

  return (
    <iframe
      ref={frame}
      key={attempt}
      className="tiktok-player"
      src={playerUrl(edit.id)}
      title={`${EDIT_SUBJECT} edit by ${edit.creator} on TikTok`}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      tabIndex={reel ? undefined : -1}
    />
  );
}

/**
 * The actual video moves with the fly's swipe, in both phone views, and the
 * next one waits just below it: the swipe pulls it up, already loaded.
 */
export function TikTokFeedPlayer({ duo, index, reel, next = null, audible = false }) {
  const track = useRef(null);
  // Before paint, so a post that has just come up never shows a frame at the
  // last reel's swipe offset.
  useLayoutEffect(() => {
    let raf;
    const animate = () => {
      const fly = duo.flies[index];
      // once the fly has moved on, hold the swipe until the page catches up
      const swipe = fly.reel.id !== reel.id ? 1 : fly.phase === PHASES.SWIPING ? fly.swipe : 0;
      track.current?.style.setProperty('--swipe', String(swipe));
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [duo, index, reel.id]);
  const waiting = next && next.id !== reel.edit.id ? next : null;
  return (
    <div className="tiktok-feed" ref={track}>
      <div className="tiktok-feed-item" key={reel.edit.id}>
        <TikTokPlayer duo={duo} edit={reel.edit} reel={reel} audible={audible} />
      </div>
      {waiting && (
        <div className="tiktok-feed-item next" key={waiting.id} aria-hidden="true">
          <TikTokPlayer duo={duo} edit={waiting} />
        </div>
      )}
    </div>
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/** The hashtag frame sizes itself; these keep a bad report from wrecking the panel. */
const TAG_HEIGHT = { start: 360, min: 240, max: 720 };
/**
 * Shown smaller than TikTok lays it out: the whole widget, its credits and
 * links included, scaled down rather than cropped.
 */
const TAG_SCALE = 0.75;

/**
 * TikTok's live feed for EDIT_TAG, in the panel: the official hashtag embed,
 * so what it lists, and in which order, is TikTok's and changes from visit to
 * visit. It is not the flies' feed — they play the listed edits one by one.
 * It stays folded away until the visitor opens it, and the frame exists only
 * while it is open, so it loads nothing until then. Before the visitor allows
 * TikTok it is a plain link and a way back to the notice; withdrawing takes
 * the frame out at once.
 */
export function TikTokTagFeed({ allowed, onAsk }) {
  const frame = useRef(null);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(TAG_HEIGHT.start);
  const live = allowed && open;
  useEffect(() => {
    if (!live) return undefined;
    const onMessage = (e) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const msg = typeof e.data === 'string' ? safeParse(e.data) : e.data;
      const h = Number(msg?.height);
      if (h > 1) setHeight(Math.min(TAG_HEIGHT.max, Math.max(TAG_HEIGHT.min, Math.round(h))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [live]);
  if (!EDIT_TAG) return null;
  const lang = navigator.language || 'en';
  return (
    <section className="tag-feed">
      <button
        type="button"
        className="tag-feed-toggle"
        aria-expanded={open}
        aria-controls="tag-feed-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Live on TikTok · #{EDIT_TAG}</span>
        <i aria-hidden="true" />
      </button>
      <div id="tag-feed-body" className="tag-feed-body" hidden={!open}>
        {!allowed ? (
          <p className="tag-feed-off">
            What TikTok lists under <a href={tagUrl(EDIT_TAG)} target="_blank" rel="noopener">#{EDIT_TAG}</a> right
            now. Nothing loads from TikTok until you allow it in{' '}
            <button type="button" onClick={onAsk}>Cookie settings</button>.
          </p>
        ) : live && (
          <div className="tiktok-tag-box" style={{ height: Math.round(height * TAG_SCALE), '--tag-scale': TAG_SCALE }}>
            <iframe
              ref={frame}
              name={`flylab-tag-${EDIT_TAG}`}
              className="tiktok-tag"
              src={tagEmbedUrl(EDIT_TAG, lang)}
              title={`#${EDIT_TAG} on TikTok, live`}
              style={{ height }}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}
        <p className="edit-disclaimer">
          What TikTok lists under the hashtag right now, chosen and ordered by TikTok; the flies&apos; phones play the
          edits listed below. The videos belong to their creators; {EDIT_SUBJECT} and the creators are not
          affiliated with Fly Lab.
        </p>
      </div>
    </section>
  );
}

/** The credit under a playing edit: creator, link to the original, and whose rights these are. */
export function EditCredit({ reel }) {
  return (
    <p className="edit-credit">
      Video: <a href={reel.edit.url} target="_blank" rel="noopener">{reel.edit.creator} on TikTok</a>.
      {' '}All rights remain with the creator and the rights holders of the music and footage.
    </p>
  );
}

/** Every edit in the feed, credited — visible whether or not TikTok is allowed; they are plain links. */
export function EditList({ edits }) {
  if (!edits.length) return null;
  return (
    <section className="edit-list">
      <span className="memory-title tip" tabIndex={0} data-tip="The TikTok posts the feed can show, with the people who made them. They are plain links: nothing loads from TikTok until you allow it.">
        TikTok edits in this feed
      </span>
      <ul>
        {edits.map((e) => (
          <li key={e.id}><a href={e.url} target="_blank" rel="noopener">{e.creator}</a></li>
        ))}
      </ul>
      <p className="edit-disclaimer">
        {EDIT_SUBJECT} and the creators are not affiliated with Fly Lab and have not endorsed it. The videos are
        shown through TikTok&apos;s own embedded player under TikTok&apos;s terms; nothing is downloaded or re-hosted here.
      </p>
    </section>
  );
}
