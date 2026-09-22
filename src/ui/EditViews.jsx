/**
 * The doomscroll, when the feed is TikTok edits: the big player a visitor can
 * open over the scene, and the ranking that replaces the feed-mix bar (a mix
 * of one kind of reel says nothing).
 */
import { useEffect, useRef } from 'react';
import { TikTokFeedPlayer, EditCredit } from './TikTokConsent.jsx';
import { EDIT_SUBJECT } from '../game/tiktokEdits.js';
import { NAMES } from '../game/scroll.js';

function useFrameLoop(ref, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (ref.current) fnRef.current(ref.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

const setText = (el, v) => { if (el && el.textContent !== String(v)) el.textContent = v; };

/**
 * The edit one fly is watching, large, over the scene. It follows that fly:
 * when it swipes to the next edit, so does the overlay; when it stops
 * watching edits, the overlay closes itself.
 */
export function EditOverlay({ duo, index, reel, audible, onClose }) {
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    box.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { if (!reel) onClose(); }, [reel, onClose]);
  if (!reel) return null;
  const name = duo.flies[index].name;
  return (
    <div className="edit-overlay" role="dialog" aria-label={`What ${name} is watching`} onClick={onClose}>
      <div className="edit-overlay-box" ref={box} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="edit-overlay-head">
          <span><b>{name}</b> is watching</span>
          <button type="button" className="edit-overlay-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="edit-overlay-video">
          <TikTokFeedPlayer duo={duo} index={index} reel={reel} audible={audible} />
        </div>
        <EditCredit reel={reel} />
      </div>
    </div>
  );
}

/**
 * With the edits on, the feed-mix bar is one colour; what is worth seeing is
 * which edits got to each fly — longest watched, most sent — and how far
 * each has fallen for her.
 */
export function Favourites({ duoRef }) {
  const refs = useRef([]);
  useFrameLoop(duoRef, (d) => {
    d.flies.forEach((f, i) => {
      const el = refs.current[i];
      if (!el) return;
      const top = f.topEdits(3);
      const rows = el.querySelectorAll('.fav-row');
      rows.forEach((row, k) => {
        const s = top[k];
        row.hidden = !s;
        if (!s) return;
        const a = row.querySelector('a');
        if (a.getAttribute('href') !== s.edit.url) a.setAttribute('href', s.edit.url);
        setText(a, s.edit.creator);
        setText(row.querySelector('.fav-time'), `${Math.round(s.watched)}s`);
        setText(row.querySelector('.fav-sent'), s.sent ? `sent ×${s.sent}` : '');
      });
      setText(el.querySelector('.fav-empty'), top.length ? '' : 'nothing watched yet');
      el.style.setProperty('--love', String(f.love));
      setText(el.querySelector('.fav-love b'), `${Math.round(f.love * 100)}%`);
    });
  });
  return (
    <section className="favourites">
      <span className="memory-title tip" tabIndex={0} data-tip={`With TikTok allowed, the feed is ${EDIT_SUBJECT} edits and nothing else. These are the ones that held each fly longest, and how often each was sent on.`}>
        Their favourite edits
      </span>
      {NAMES.map((n, i) => (
        <div className="fav" key={n} ref={(el) => { refs.current[i] = el; }}>
          <div className="fav-head">
            <b>{n}</b>
            <span className="fav-love tip" data-tip={`How far ${n} has fallen for ${EDIT_SUBJECT}: it grows with every edit watched, with dopamine behind it, and fades only slowly.`}>
              in love <b>0%</b>
            </span>
          </div>
          <div className="fav-love-track"><i /></div>
          <ol>
            {[0, 1, 2].map((k) => (
              <li className="fav-row" key={k} hidden>
                <a href="#" target="_blank" rel="noopener">—</a>
                <span className="fav-time" />
                <span className="fav-sent" />
              </li>
            ))}
          </ol>
          <p className="fav-empty" />
        </div>
      ))}
    </section>
  );
}
