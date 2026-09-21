/**
 * The TikTok edits the flies can scroll — shown only through TikTok's
 * official embedded player, and only after the visitor allows TikTok.
 *
 * Nothing is downloaded or re-hosted: each entry is a link to a public
 * TikTok post, and the post plays inside TikTok's own player, under TikTok's
 * terms and licences. If a creator has switched embedding off, or deletes
 * the post, the player reports an error and the flies skip it.
 *
 * TO FILL IN: paste the post URLs, as TikTok shows them when you open a post
 * in the browser (https://www.tiktok.com/@creator/video/1234567890123456789).
 * Short links (vm.tiktok.com/...) do not carry the post ID; open them first
 * and copy the full address. `node tools/check-tiktok-edits.mjs` checks every
 * entry against TikTok's public oEmbed endpoint and prints creator and title.
 *
 * Choose posts whose creators allow embedding, and keep the creator's handle
 * here exactly: it is shown as the credit under every video.
 */
export const TIKTOK_EDITS = [
  // { url: 'https://www.tiktok.com/@creator/video/0000000000000000000', creator: '@creator' },
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
];

/** The star the edits are about, for labels and the not-affiliated notice. */
export const EDIT_SUBJECT = 'Sabrina Carpenter';

const ID = /\/video\/(\d{8,})/;

/** The usable entries: a post ID parsed from the URL, and a creator handle. */
export const EDITS = TIKTOK_EDITS
  .map((e) => ({ ...e, id: (e.url.match(ID) || [])[1] }))
  .filter((e) => e.id && e.creator);

/**
 * The player URL for a post: TikTok's documented embed player, looping, no
 * clutter. It starts silent (`mute` on ready) and the page un-mutes at most
 * one player at a time, when the visitor has sound on — `muted=1` would lock
 * the volume at zero for good, so it is not used.
 */
export function playerUrl(id) {
  const q = new URLSearchParams({
    autoplay: '1',
    loop: '1',
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
