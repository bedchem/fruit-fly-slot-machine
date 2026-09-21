/**
 * Consent for third-party content.
 *
 * Fly Lab itself sets no cookies and sends nothing to anyone. The one
 * exception a visitor can opt into is TikTok: the doomscroll experiment can
 * show real TikTok videos through TikTok's official embedded player, and
 * loading that player connects the browser to TikTok, which receives the IP
 * address and device data and may set its own cookies. So nothing from TikTok
 * loads until the visitor has said yes, here, and the choice can be changed
 * at any time — on the experiment page and on the legal page.
 *
 * The choice itself is kept in localStorage under one key. Storing a consent
 * decision is strictly necessary to honour it, so it needs no consent of its
 * own; it holds only the answer and when it was given, never anything about
 * the visitor.
 *
 * Rules followed (EU ePrivacy / GDPR, and the Italian Garante's 2021 cookie
 * guidelines): nothing pre-ticked, rejecting as easy as accepting, closing
 * the notice counts as rejecting, scrolling or clicking elsewhere is not
 * consent, and withdrawing is as easy as giving.
 */

const KEY = 'flylab.consent';
/** Bump when what a consent covers changes: old answers are then asked again. */
export const CONSENT_VERSION = 1;
const EVENT = 'flylab-consent';

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.version === CONSENT_VERSION ? data : null;
  } catch {
    return null;
  }
}

/** true (allowed), false (refused) or null (not asked yet) for a service. */
export function getConsent(service) {
  const v = read()?.services?.[service]?.value;
  return typeof v === 'boolean' ? v : null;
}

/** When the current answer for a service was given, as an ISO string, or null. */
export function consentDate(service) {
  return read()?.services?.[service]?.at ?? null;
}

export function setConsent(service, value) {
  const data = read() ?? { version: CONSENT_VERSION, services: {} };
  data.services[service] = { value: !!value, at: new Date().toISOString() };
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: the choice lasts the visit */ }
  memory[service] = !!value;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { service, value: !!value } }));
}

/** If storage is unavailable, the answer still holds for this page view. */
const memory = {};
export function currentConsent(service) {
  const stored = getConsent(service);
  return stored !== null ? stored : (service in memory ? memory[service] : null);
}

/** Calls `fn(service, value)` whenever a choice changes, in this tab or another. */
export function onConsentChange(fn) {
  const local = (e) => fn(e.detail.service, e.detail.value);
  const other = (e) => { if (e.key === KEY) fn(null, null); };
  window.addEventListener(EVENT, local);
  window.addEventListener('storage', other);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener('storage', other);
  };
}
