/**
 * One tooltip layer for the whole page.
 *
 * Anything with a `data-tip` attribute gets an explanation on hover or focus.
 * It is drawn into a fixed-position node at the document root rather than as a
 * `::after` on the element itself, because the side panel is a scroll
 * container and would clip any absolutely-positioned child.
 */
import { useEffect, useRef } from 'react';

export function Tooltips() {
  const tipRef = useRef(null);

  useEffect(() => {
    const tip = tipRef.current;
    if (!tip) return undefined;
    let current = null;

    const place = (el) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      current = el;
      tip.textContent = text;
      tip.classList.add('on');
      // measure after the text is in, then keep it on screen
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const margin = 8;
      let left = r.left;
      let top = r.top - t.height - margin;
      if (top < margin) top = r.bottom + margin;          // flip under
      left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };

    const hide = () => { current = null; tip.classList.remove('on'); };

    const over = (e) => {
      const el = e.target.closest?.('[data-tip]');
      if (el && el !== current) place(el);
      else if (!el && current) hide();
    };

    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', over);
    document.addEventListener('pointerleave', hide);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', over);
      document.removeEventListener('pointerleave', hide);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  return <div className="tiplayer" ref={tipRef} role="tooltip" aria-hidden="true" />;
}
