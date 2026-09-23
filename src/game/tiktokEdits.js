/**
 * The TikTok edits the flies can scroll — shown only through TikTok's
 * official embedded player, and only after the visitor allows TikTok.
 *
 * Nothing is downloaded or re-hosted: each entry is a link to a public
 * TikTok post, and the post plays inside TikTok's own player, under TikTok's
 * terms and licences. If a creator has switched embedding off, or deletes
 * the post, the player reports an error and the flies skip it.
 *
 * To add an edit, paste its post URL as TikTok shows it when you open a post
 * in the browser (https://www.tiktok.com/@creator/video/1234567890123456789).
 * Short links (vm.tiktok.com/...) do not carry the post ID; open them first
 * and copy the full address. `node tools/check-tiktok-edits.mjs` checks every
 * entry against TikTok's public oEmbed endpoint and prints creator and title.
 *
 * Choose posts whose creators allow embedding, and keep the creator's handle
 * here exactly: it is shown as the credit under every video. Every post has to
 * carry #EDIT_TAG in its caption; the check flags any that does not.
 */
export const TIKTOK_EDITS = [
  { url: 'https://www.tiktok.com/@sabsvia/video/7683599968128503070', creator: '@sabsvia' },
  { url: 'https://www.tiktok.com/@chlo.vsp4/video/7625734045153938710', creator: '@chlo.vsp4' },
  { url: 'https://www.tiktok.com/@melanieae/video/7432472179553373482', creator: '@melanieae' },
  { url: 'https://www.tiktok.com/@showgirltz/video/7545608847143013638', creator: '@showgirltz' },
  { url: 'https://www.tiktok.com/@dns0699/video/7386705241959402785', creator: '@dns0699' },
  { url: 'https://www.tiktok.com/@dns0699/video/7402262265690459424', creator: '@dns0699' },
  { url: 'https://www.tiktok.com/@sw1ftzone/video/7670432491177577758', creator: '@sw1ftzone' },
  { url: 'https://www.tiktok.com/@rizunaedits/video/7512849886635674902', creator: '@rizunaedits' },
  { url: 'https://www.tiktok.com/@lokrvq/video/7625747251704499478', creator: '@lokrvq' },
  { url: 'https://www.tiktok.com/@sabrinaily2/video/7362323278561561889', creator: '@sabrinaily2' },
  { url: 'https://www.tiktok.com/@agbedit/video/7625683020296621334', creator: '@agbedit' },
  { url: 'https://www.tiktok.com/@heartlocktz/video/7615750867332975894', creator: '@heartlocktz' },
  { url: 'https://www.tiktok.com/@vxciovs/video/7642855598845119758', creator: '@vxciovs' },
  { url: 'https://www.tiktok.com/@sqnnynoir/video/7417887767432072470', creator: '@sqnnynoir' },
  { url: 'https://www.tiktok.com/@ollyot/video/7679834765075189014', creator: '@ollyot' },
  { url: 'https://www.tiktok.com/@wandvll/video/7617976696394009877', creator: '@wandvll' },
  { url: 'https://www.tiktok.com/@lokrvq/video/7562986955315678486', creator: '@lokrvq' },
  { url: 'https://www.tiktok.com/@eternaljuno/video/7663961386904489234', creator: '@eternaljuno' },
  { url: 'https://www.tiktok.com/@eicsxsabrina/video/7429464112159067423', creator: '@eicsxsabrina' },
  { url: 'https://www.tiktok.com/@eternaljuno/video/7607480461643844882', creator: '@eternaljuno' },
  { url: 'https://www.tiktok.com/@whiteoutstarz/video/7577087520765185335', creator: '@whiteoutstarz' },
  { url: 'https://www.tiktok.com/@daisvisualsfx/video/7416138932628327712', creator: '@daisvisualsfx' },
  { url: 'https://www.tiktok.com/@goodkarma131/video/7479988461492096261', creator: '@goodkarma131' },
  { url: 'https://www.tiktok.com/@vxciovs/video/7640963118151126285', creator: '@vxciovs' },
  { url: 'https://www.tiktok.com/@jqsids/video/7412357378932264225', creator: '@jqsids' },
  { url: 'https://www.tiktok.com/@thedevilsanus_/video/7421483962767281415', creator: '@thedevilsanus_' },
  { url: 'https://www.tiktok.com/@sentmedowntownlights/video/7490589351143918878', creator: '@sentmedowntownlights' },
  { url: 'https://www.tiktok.com/@m0nliqt/video/7676978955957570829', creator: '@m0nliqt' },
  { url: 'https://www.tiktok.com/@aeterrify/video/7411879080024345874', creator: '@aeterrify' },
  { url: 'https://www.tiktok.com/@joshm3r/video/7433454086730550544', creator: '@joshm3r' },
  { url: 'https://www.tiktok.com/@gyjfilm/video/7468878221807799558', creator: '@gyjfilm' },
  { url: 'https://www.tiktok.com/@thatgirllalison/video/7357349657413979434', creator: '@thatgirllalison' },
];

/** The star the edits are about, for labels and the not-affiliated notice. */
export const EDIT_SUBJECT = 'Sabrina Carpenter';

/**
 * The hashtag whose live feed sits beside the flies: whatever TikTok lists
 * under it right now, fetched fresh on every visit through TikTok's official
 * hashtag embed. It needs the same consent as the edits. An empty string
 * leaves the live feed out.
 */
export const EDIT_TAG = 'sabrinacarpenter';

export const tagUrl = (tag) => `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;

/** Whether a post's caption carries the hashtag: the filter every post in the feed passes. */
export const captionHasTag = (caption, tag = EDIT_TAG) => !tag || String(caption ?? '').toLowerCase().includes(`#${tag.toLowerCase()}`);

/**
 * The hashtag embed's frame. It is the iframe TikTok's embed.js puts in place
 * of the oEmbed markup for a hashtag (`data-embed-type="tag"`); using it
 * directly keeps TikTok's script out of the page, as with the player below.
 * The frame reports its height by postMessage, tagged with the frame's name.
 */
export function tagEmbedUrl(tag, lang = 'en') {
  const q = new URLSearchParams({ lang, embedFrom: 'oembed' });
  return `https://www.tiktok.com/embed/tag/${encodeURIComponent(tag)}?${q}`;
}

const POST = /^https:\/\/www\.tiktok\.com\/@([\w.-]{1,40})\/video\/(\d{8,25})(?:[?#]|$)/;
const HANDLE = /^@[\w.-]{1,40}$/;

/**
 * The usable entries: plainly a TikTok post and a creator handle, with the
 * post ID parsed out, each post once. The list above and the refreshed pool
 * both come through here, so nothing else can reach a player.
 */
export function parseEdits(list) {
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const id = typeof e?.url === 'string' ? (e.url.match(POST) || [])[2] : null;
    if (!id || seen.has(id) || typeof e.creator !== 'string' || !HANDLE.test(e.creator)) continue;
    seen.add(id);
    out.push({ url: e.url, creator: e.creator, id });
  }
  return out;
}

export const EDITS = parseEdits(TIKTOK_EDITS);

/**
 * Where tools/refresh-tiktok-edits.mjs publishes the edits it keeps finding
 * under EDIT_TAG. It is a file on this site, not a request to TikTok; the page
 * adds what it lists to the edits above.
 */
export const POOL_URL = '/pool/tiktok-edits.json';

/**
 * The player URL for a post: TikTok's documented embed player, no
 * clutter. It starts silent (`mute` on ready) and the page un-mutes at most
 * one player at a time, when the visitor has sound on — `muted=1` would lock
 * the volume at zero for good, so it is not used.
 */
export function playerUrl(id) {
  const q = new URLSearchParams({
    autoplay: '1',
    loop: '0',
    muted: '0',
    controls: '0',
    progress_bar: '1',
    play_button: '0',
    volume_control: '0',
    fullscreen_button: '0',
    timestamp: '0',
    music_info: '1',
    description: '1',
    rel: '0',
    closed_caption: '0',
  });
  return `https://www.tiktok.com/player/v1/${id}?${q}`;
}
