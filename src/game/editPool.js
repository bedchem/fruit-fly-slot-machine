/**
 * The flies' pool of TikTok edits, kept fresh without ever holding them up.
 *
 * The list in tiktokEdits.js is always in. On top of it comes whatever
 * tools/refresh-tiktok-edits.mjs last found under EDIT_TAG and published at
 * POOL_URL. The last pool that arrived is kept in this browser, so a visit
 * starts from it at once and the fetch only adds to it; a missing file, a
 * server error or no network changes nothing on screen.
 *
 * The copy is written only while TikTok is allowed and removed when the
 * visitor withdraws: it holds public post addresses and nothing about anyone.
 */
import { EDITS, POOL_URL, parseEdits } from './tiktokEdits.js';

const KEY = 'flylab.edits';
/** An old copy is worse than none: posts vanish, and the file will come again. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function merge(extra) {
  return parseEdits([...EDITS, ...extra]);
}

function readCache() {
  try {
    const data = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (!data || !(Date.now() - data.at < MAX_AGE_MS)) return [];
    return parseEdits(data.edits);
  } catch {
    return [];
  }
}

/** The pool to start with: the list, and the last pool this browser saw. */
export function cachedEdits() {
  return merge(readCache());
}

/**
 * The published pool, merged with the list and remembered for next time.
 * Resolves to null when there is nothing new to use.
 */
export async function fetchEdits({ signal } = {}) {
  let res;
  try {
    res = await fetch(POOL_URL, { cache: 'no-cache', signal });
  } catch {
    return null;
  }
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
  let data;
  try { data = await res.json(); } catch { return null; }
  const found = parseEdits(data?.edits);
  if (!found.length) return null;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), edits: found.map(({ url, creator }) => ({ url, creator })) }));
  } catch { /* private mode: the pool lasts the visit */ }
  return merge(found);
}

/** Withdrawing consent takes the remembered pool with it. */
export function forgetEdits() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
