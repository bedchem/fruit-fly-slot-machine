/**
 * The consent controls on the legal page: shows the current TikTok choice
 * and lets the visitor change or withdraw it. Plain DOM, no framework — the
 * legal page is static and should stay that way.
 */
import { currentConsent, setConsent, consentDate, onConsentChange } from './consent.js';

const box = document.getElementById('consent-controls');

function render() {
  if (!box) return;
  const v = currentConsent('tiktok');
  const since = consentDate('tiktok');
  const state = v === true ? 'allowed' : v === false ? 'refused' : 'not decided yet (nothing from TikTok has been loaded)';
  box.innerHTML = '';
  const p = document.createElement('p');
  p.innerHTML = `Your current choice for TikTok videos: <strong>${state}</strong>${since ? ` (${new Date(since).toLocaleString()})` : ''}.`;
  const row = document.createElement('p');
  row.className = 'consent-row';
  const allow = button('Allow TikTok videos', () => setConsent('tiktok', true), v === true);
  const refuse = button(v === true ? 'Withdraw consent' : 'Refuse TikTok videos', () => setConsent('tiktok', false), v === false);
  row.append(refuse, allow);
  box.append(p, row);
}

function button(label, onClick, disabled) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'consent-btn';
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener('click', () => { onClick(); render(); });
  return b;
}

render();
onConsentChange(render);
