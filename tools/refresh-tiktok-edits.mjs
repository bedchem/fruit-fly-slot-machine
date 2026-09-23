/**
 * Keeps the flies' pool of TikTok edits growing. It finds public posts tagged
 * #EDIT_TAG through a web search API — it never searches or scrapes TikTok —
 * checks every one against TikTok's public oEmbed endpoint, and publishes the
 * ones that pass as the pool the doomscroll page loads (POOL_URL).
 *
 *   BRAVE_API_KEY=… node tools/refresh-tiktok-edits.mjs
 *   GOOGLE_API_KEY=… GOOGLE_CSE_ID=… node tools/refresh-tiktok-edits.mjs
 *
 *   --out <file>    where to write (default public/pool/tiktok-edits.json)
 *   --every <h>     keep running and refresh every h hours (the Docker service)
 *   --queries <n>   searches per run (default 8; the free search tiers are small)
 *   --max <n>       posts kept in the pool, newest finds first (default 150)
 *
 * A post goes in only if oEmbed knows it, its caption carries #EDIT_TAG, and it
 * is plainly a fan's post: the star's own accounts are left out, and so is any
 * account that could pass for hers — a display name mixing Latin letters with
 * Cyrillic or Greek look-alikes, or her name with nothing saying it is a fan
 * account (edit, fan, stan, daily…). Posts already in the pool are checked again
 * on every run, take the creator's current handle, and go when they fail.
 * Without a search key it only re-checks the pool it has.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EDITS, EDIT_TAG, captionHasTag, parseEdits } from '../src/game/tiktokEdits.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const OUT = arg('out', 'public/pool/tiktok-edits.json');
const EVERY_H = Number(arg('every', 0));
const QUERIES = Number(arg('queries', 8));
const MAX = Number(arg('max', 150));

/** Her own accounts: they post announcements, not edits. */
const OFFICIAL = new Set(['sabrinacarpenter', 'teamsabrina']);
/** Searched together with the hashtag, a few at random each run, so every run turns up different posts. */
const TOPICS = [
  'edit', 'aftereffects', 'espresso', 'please please please', 'manchild', 'tears', 'taste', 'juno',
  'bed chem', 'feather', 'nonsense', 'house tour', 'short n sweet', "man's best friend", 'tour',
  'coachella', 'grammys', 'snl', 'scenepack', 'concert',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const LATIN = /[A-Za-z]/;
const LOOKALIKE = /[Ͱ-ϿЀ-ӿ]/;
const FAN_MARK = /edit|fan|stan|daily|update|archive|clips/i;
/** Credited under a video, could this account be taken for hers? */
function couldPassForHer(handle, name = '') {
  if (LATIN.test(name) && LOOKALIKE.test(name)) return `look-alike letters in "${name}"`;
  const plain = `${handle}${name}`.toLowerCase().replace(/[^a-z]/g, '');
  if (plain.includes(EDIT_TAG.toLowerCase()) && !FAN_MARK.test(`${handle} ${name}`)) return `named like her own account (@${handle})`;
  return null;
}
const POST_URL = /https?:\/\/(?:www\.)?tiktok\.com\/@([\w.-]{1,40})\/video\/(\d{8,25})/g;

function searchProvider() {
  if (process.env.BRAVE_API_KEY) {
    return {
      name: 'Brave Search',
      async search(q) {
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q, count: '20' })}`, {
          headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.web?.results ?? []).map((r) => r.url);
      },
    };
  }
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
    return {
      name: 'Google Programmable Search',
      async search(q) {
        const params = new URLSearchParams({ key: process.env.GOOGLE_API_KEY, cx: process.env.GOOGLE_CSE_ID, q, num: '10' });
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.items ?? []).map((i) => i.link);
      },
    };
  }
  return null;
}

/** Post IDs and handles found in a search's result addresses. */
async function discover(provider) {
  const found = new Map();
  const queries = shuffle([...TOPICS]).slice(0, QUERIES).map((t) => `site:tiktok.com "#${EDIT_TAG}" ${t}`);
  for (const q of queries) {
    try {
      for (const url of await provider.search(q)) {
        for (const [, handle, id] of url.matchAll(POST_URL)) found.set(id, `https://www.tiktok.com/@${handle}/video/${id}`);
      }
    } catch (err) {
      console.log(`  search failed (${err.message}): ${q}`);
    }
    await sleep(1100);   // the free tiers allow about one request a second
  }
  return found;
}

/** What TikTok says about a post, if it passes: the entry to publish, under the creator's current handle. */
async function vet(url) {
  const id = url.match(/\/video\/(\d+)/)?.[1];
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { why: `oEmbed HTTP ${res.status}` };
    const o = await res.json();
    const handle = o.author_unique_id;
    if (!handle) return { why: 'no author' };
    if (OFFICIAL.has(handle.toLowerCase())) return { why: 'official account' };
    const posing = couldPassForHer(handle, o.author_name);
    if (posing) return { why: posing };
    if (!captionHasTag(o.title)) return { why: `no #${EDIT_TAG} in the caption` };
    return { edit: { url: `https://www.tiktok.com/@${handle}/video/${id}`, creator: `@${handle}` } };
  } catch (err) {
    return { why: err.message };
  }
}

function readPool() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    return Array.isArray(data.edits) ? data.edits : [];
  } catch {
    return [];
  }
}

function writePool(edits) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = `${OUT}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ tag: EDIT_TAG, updated: new Date().toISOString(), edits }, null, 1)}\n`);
  fs.renameSync(tmp, OUT);   // the page never reads a half-written file
}

async function refresh() {
  const started = new Date().toISOString();
  console.log(`[${started}] refreshing #${EDIT_TAG} → ${OUT}`);
  const listed = new Set(EDITS.map((e) => e.id));
  const kept = [];
  const seen = new Set();

  // what is published already: checked again, oldest finds last
  for (const old of readPool()) {
    const id = parseEdits([old])[0]?.id;
    if (!id || seen.has(id) || listed.has(id)) continue;
    seen.add(id);
    const r = await vet(old.url);
    if (r.edit) kept.push({ ...r.edit, found: old.found ?? started });
    else console.log(`  − ${id} ${old.creator}: ${r.why}`);
    await sleep(250);
  }

  const provider = searchProvider();
  let added = 0;
  if (!provider) {
    console.log('  no BRAVE_API_KEY, or GOOGLE_API_KEY with GOOGLE_CSE_ID: only re-checking the pool');
  } else {
    const found = await discover(provider);
    console.log(`  ${provider.name}: ${found.size} posts in the results`);
    for (const [id, url] of found) {
      if (seen.has(id) || listed.has(id)) continue;
      seen.add(id);
      const r = await vet(url);
      if (r.edit) { kept.unshift({ ...r.edit, found: started }); added++; console.log(`  + ${id} ${r.edit.creator}`); }
      else console.log(`  · ${id}: ${r.why}`);
      await sleep(250);
    }
  }

  const pool = kept.sort((a, b) => String(b.found).localeCompare(String(a.found))).slice(0, MAX);
  writePool(pool);
  console.log(`  ${added} new, ${pool.length} in the pool (plus the ${EDITS.length} listed in tiktokEdits.js)`);
}

await refresh().catch((err) => { console.error(err); process.exitCode = 1; });
if (EVERY_H > 0) {
  for (;;) {
    await sleep(EVERY_H * 3600 * 1000);
    await refresh().catch((err) => console.error(err));
  }
}
