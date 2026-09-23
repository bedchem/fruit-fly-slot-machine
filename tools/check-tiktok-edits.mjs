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
import { TIKTOK_EDITS, EDITS, EDIT_TAG, tagUrl, captionHasTag } from '../src/game/tiktokEdits.js';

if (EDIT_TAG) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(tagUrl(EDIT_TAG))}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const o = await res.json();
    if (o.embed_type !== 'hashtag') throw new Error(`embed type ${o.embed_type ?? 'missing'}`);
    console.log(`✓ #${EDIT_TAG}  TikTok serves a hashtag embed for it\n`);
  } catch (err) {
    process.exitCode = 1;
    console.log(`✗ #${EDIT_TAG}  TikTok has no hashtag embed for it (${err.message}) — check EDIT_TAG\n`);
  }
}

if (!TIKTOK_EDITS.length) {
  console.log('No edits listed yet. Add post URLs to TIKTOK_EDITS in src/game/tiktokEdits.js.');
  process.exit(process.exitCode ?? 0);
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
    // the feed is one star's edits: the caption has to carry her hashtag
    const tagged = captionHasTag(o.title);
    if (!match || !tagged) bad++;
    console.log(`${match && tagged ? '✓' : '!'} ${parsed.id}  ${handle} (${o.author_name ?? '?'})${match ? '' : `  ← listed as ${e.creator}`}`
      + `${tagged ? '' : `  ← no #${EDIT_TAG} in the caption`}\n    ${(o.title ?? '').slice(0, 110)}`);
  } catch (err) {
    bad++;
    console.log(`✗ ${parsed.id}  TikTok did not return this post (${err.message}) — removed, private, or the URL is wrong`);
  }
}
console.log(`\n${TIKTOK_EDITS.length - bad} of ${TIKTOK_EDITS.length} edits look fine.`);
process.exitCode = bad || process.exitCode ? 1 : 0;
