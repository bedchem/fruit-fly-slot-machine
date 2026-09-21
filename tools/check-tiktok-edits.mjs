/**
 * Checks the TikTok edits listed in src/game/tiktokEdits.js before they go
 * live: every URL must carry a post ID, and TikTok's public oEmbed endpoint
 * must know the post. Prints the author and title TikTok reports, and flags
 * a creator handle that does not match.
 *
 *   node tools/check-tiktok-edits.mjs
 *
 * Runs on your machine only — visitors never contact TikTok unless they have
 * consented. oEmbed finding a post does not prove the creator allows
 * embedding; the page itself skips any post the player refuses to play.
 */
import { TIKTOK_EDITS, EDITS } from '../src/game/tiktokEdits.js';

if (!TIKTOK_EDITS.length) {
  console.log('No edits listed yet. Add post URLs to TIKTOK_EDITS in src/game/tiktokEdits.js.');
  process.exit(0);
}

let bad = 0;
for (const e of TIKTOK_EDITS) {
  const parsed = EDITS.find((x) => x.url === e.url);
  if (!parsed) {
    bad++;
    console.log(`✗ ${e.url}\n    no post ID in the URL, or no creator handle — use the full https://www.tiktok.com/@…/video/… address`);
    continue;
  }
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(e.url)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const o = await res.json();
    const handle = `@${o.author_unique_id ?? ''}`;
    const match = handle.toLowerCase() === e.creator.toLowerCase();
    if (!match) bad++;
    console.log(`${match ? '✓' : '!'} ${parsed.id}  ${handle} (${o.author_name ?? '?'})${match ? '' : `  ← listed as ${e.creator}`}\n    ${(o.title ?? '').slice(0, 110)}`);
  } catch (err) {
    bad++;
    console.log(`✗ ${parsed.id}  TikTok did not return this post (${err.message}) — removed, private, or the URL is wrong`);
  }
}
console.log(`\n${TIKTOK_EDITS.length - bad} of ${TIKTOK_EDITS.length} edits look fine.`);
process.exitCode = bad ? 1 : 0;
