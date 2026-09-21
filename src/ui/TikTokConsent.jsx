/**
 * TikTok on the doomscroll page: the consent notice, the player, and the
 * credits.
 *
 * Nothing here contacts TikTok until the visitor clicks "Allow TikTok
 * videos". Before that there is no iframe, no script, no preconnect — only
 * this notice. After it, each edit plays in TikTok's own embed player
 * (tiktokEdits.js), muted and looping, with the creator credited and linked
 * underneath. Withdrawing removes every player at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentConsent, setConsent, onConsentChange, consentDate } from '../consent/consent.js';
import { playerUrl, EDIT_SUBJECT } from '../game/tiktokEdits.js';

export const TIKTOK = 'tiktok';
const TIKTOK_ORIGIN = 'https://www.tiktok.com';

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
  return (
    <div className="slip consent" role="dialog" aria-labelledby="tiktok-consent-title" aria-describedby="tiktok-consent-body">
      <button type="button" className="howto-close" onClick={() => { if (!decided) onChoose(false); onClose(); }} aria-label="Close (no TikTok videos)">×</button>
      <h2 id="tiktok-consent-title">{EDIT_SUBJECT} edits from TikTok</h2>
      <div id="tiktok-consent-body" className="consent-body">
        <p>
          The flies can also scroll {count} real TikTok edit{count === 1 ? '' : 's'}, shown with TikTok&apos;s official
          embedded player. Nothing from TikTok loads unless you allow it.
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
 * One fly's TikTok player, laid over its phone in the panel. It reports the
 * real length of the edit back to the fly, and tells the flies to skip a post
 * TikTok cannot play (removed, private, or embedding switched off).
 */
export function TikTokPlayer({ duo, reel, audible = false }) {
  const frame = useRef(null);
  const ready = useRef(false);
  const audibleRef = useRef(audible);
  audibleRef.current = audible;

  /** Sends one of the player's documented commands (mute, unMute, play…). */
  const command = useCallback((type) => {
    frame.current?.contentWindow?.postMessage({ type, 'x-tiktok-player': true }, TIKTOK_ORIGIN);
  }, []);

  // sound follows the page: one audible player at most, and only with sound on
  useEffect(() => {
    if (ready.current) command(audible ? 'unMute' : 'mute');
  }, [audible, command]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const msg = typeof e.data === 'string' ? safeParse(e.data) : e.data;
      if (!msg || !msg['x-tiktok-player']) return;
      if (msg.type === 'onPlayerReady') {
        ready.current = true;
        command(audibleRef.current ? 'unMute' : 'mute');
        command('play');
      }
      if (msg.type === 'onCurrentTime' && msg.value) duo.setEditDuration(reel.id, msg.value.duration);
      if (msg.type === 'onPlayerError') {
        // 1001: no such post, or its creator does not allow embedding — never
        // again. 2001/3001: TikTok could not serve or play it this time — skip
        // it now. 3002: the browser blocked autoplay — not a fault of the
        // post; the player shows its play button and the fly watches on.
        const code = msg.value?.errorCode;
        if (code === 1001) duo.markBroken(reel.edit.id);
        else if (code === 2001 || code === 3001) duo.skipReel(reel.id);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [duo, reel, command]);
  return (
    <iframe
      ref={frame}
      className="tiktok-player"
      key={reel.id}
      src={playerUrl(reel.edit.id)}
      title={`${EDIT_SUBJECT} edit by ${reel.edit.creator} on TikTok`}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
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
