/**
 * The phone screens: the app's chrome, and a painter per kind of reel.
 *
 * One painter draws each fly's screen into its own canvas; the 3D phone uses
 * it as a texture and the side panel copies it, so the visitor sees exactly
 * the reel the fly is watching. Every reel is drawn from primitives and
 * animated by how far into it the fly is.
 */
import { REELS, PHASES } from '../game/scroll.js';

export const SCREEN_W = 270;
export const SCREEN_H = 560;

const INK = '#f4efe6';
const SANS = 'Inter, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** A fruit fly, in the site's flat style, facing right (or left, `flip`); `wing` beats 0..1. */
function fly(ctx, x, y, size, { wing = 0, color = '#d9731f', angle = 0, flip = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // flipped, it faces left the right way up; rotated by pi it would be upside down
  ctx.scale((flip ? -1 : 1) * size / 40, size / 40);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-6, -8 - wing * 6, 7, 16, -0.6 - wing * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(-4, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e3872f';
  ctx.beginPath(); ctx.ellipse(8, -1, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -2, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b8321f';
  ctx.beginPath(); ctx.arc(18, -3, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-2, -10 - wing * 5, 6, 14, -0.9 - wing * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const PAINT = {
  fruit(ctx, t, W, H) {
    ctx.fillStyle = '#3a2a12'; ctx.fillRect(0, 0, W, H);
    // a banana going over, spots spreading, a fly on it
    ctx.save();
    ctx.translate(W / 2, H * 0.52);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#e7b53c';
    ctx.beginPath(); ctx.ellipse(0, 0, 110, 38, 0, 0.15, Math.PI - 0.15); ctx.ellipse(0, -18, 104, 22, 0, Math.PI - 0.1, 0.1, true); ctx.fill();
    ctx.fillStyle = '#5a3a14';
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = 3 + (i % 4) * 2 + t * 1.6;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 70, 10 + Math.sin(a * 1.7) * 14, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // drips of juice
    ctx.fillStyle = 'rgba(231,181,60,0.7)';
    for (let i = 0; i < 4; i++) {
      const y = H * 0.6 + ((t * 60 + i * 50) % 160);
      ctx.beginPath(); ctx.ellipse(W * 0.35 + i * 22, y, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    fly(ctx, W * 0.55 + Math.sin(t * 3) * 6, H * 0.43, 46, { wing: Math.abs(Math.sin(t * 20)) * 0.3 });
  },

  courtship(ctx, t, W, H) {
    ctx.fillStyle = '#2d1830'; ctx.fillRect(0, 0, W, H);
    // he sings: one wing out, vibrating; sound rings reach her
    fly(ctx, W * 0.3, H * 0.5, 56, { wing: 0.6 + Math.sin(t * 60) * 0.4, color: '#c9602a' });
    fly(ctx, W * 0.72, H * 0.5, 60, { flip: true, color: '#d9731f' });
    ctx.strokeStyle = '#d86ea0';
    for (let k = 0; k < 4; k++) {
      const r = ((t * 70 + k * 30) % 120) + 10;
      ctx.globalAlpha = 1 - r / 130;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(W * 0.3 + 10, H * 0.5 - 20, r, -0.7, 0.7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d86ea0';
    ctx.font = `700 18px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('♪ bzz bzz bzzz ♪', W / 2, H * 0.34);
    ctx.textAlign = 'left';
  },

  stripes(ctx, t, W, H) {
    // a drum of stripes turning: the stimulus of every optomotor experiment
    const n = 10;
    const w = W / n * 2;
    const shift = (t * 90) % w;
    for (let i = -2; i < n + 2; i++) {
      ctx.fillStyle = i % 2 ? '#5aa6d6' : '#10202c';
      ctx.fillRect(i * (w / 2) + shift, 0, w / 2 + 1, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  },

  spider(ctx, t, W, H, r) {
    ctx.fillStyle = '#1c1a20'; ctx.fillRect(0, 0, W, H);
    // it comes closer: the size is the loom
    const k = Math.min(1, t / r.dur);
    const s = 20 + k * k * 260;
    const cx = W / 2 + Math.sin(t * 2) * 6, cy = H * 0.48;
    ctx.strokeStyle = '#0a0a0c';
    ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const a = (i % 4) * 0.45 - 0.7 + Math.sin(t * 8 + i) * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + side * s * 0.6, cy + a * s * 0.8 - s * 0.35, cx + side * s * 0.95, cy + a * s + s * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.3, s * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9433a';
    for (const [dx, dy] of [[-0.1, -0.2], [0.1, -0.2], [-0.05, -0.27], [0.05, -0.27]]) {
      ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, s * 0.035, 0, Math.PI * 2); ctx.fill();
    }
  },

  swatter(ctx, t, W, H, r) {
    ctx.fillStyle = '#e9e1cf'; ctx.fillRect(0, 0, W, H);
    // a kitchen, from the fly's point of view; the swatter comes down
    ctx.fillStyle = '#c9b89a'; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    const k = Math.min(1, t / r.dur);
    const s = 40 + Math.pow(k, 3) * 520;
    ctx.save();
    ctx.translate(W / 2, H * 0.45);
    ctx.fillStyle = '#c9433a';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#8a2a22';
    ctx.lineWidth = Math.max(1, s * 0.02);
    const cells = 7;
    for (let i = 1; i < cells; i++) {
      const o = -s / 2 + (s / cells) * i;
      ctx.beginPath(); ctx.moveTo(o, -s / 2); ctx.lineTo(o, s / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s / 2, o); ctx.lineTo(s / 2, o); ctx.stroke();
    }
    ctx.restore();
    if (k > 0.94) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); }
  },

  trap(ctx, t, W, H) {
    ctx.fillStyle = '#26240f'; ctx.fillRect(0, 0, W, H);
    // a jar of cider vinegar, a paper funnel, flies going in
    const jx = W / 2, jy = H * 0.62;
    ctx.fillStyle = 'rgba(160,170,90,0.35)';
    ctx.fillRect(jx - 70, jy - 60, 140, 150);
    ctx.fillStyle = '#9aa03a';
    ctx.fillRect(jx - 70, jy + 20, 140, 70);
    ctx.fillStyle = '#e9e1cf';
    ctx.beginPath(); ctx.moveTo(jx - 80, jy - 70); ctx.lineTo(jx + 80, jy - 70); ctx.lineTo(jx + 8, jy - 8); ctx.lineTo(jx - 8, jy - 8); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.25 + i * 0.2) % 1);
      const x = jx + Math.sin(i * 2 + t) * 60 * (1 - p);
      const y = jy - 170 + p * 150;
      fly(ctx, x, y, 22, { wing: Math.abs(Math.sin(t * 25 + i)) * 0.4, angle: 1.2 });
    }
    for (let i = 0; i < 4; i++) fly(ctx, jx - 40 + i * 26, jy + 40 + (i % 2) * 8, 18, { angle: Math.PI / 2 });
  },

  sugar(ctx, t, W, H) {
    ctx.fillStyle = '#2a2230'; ctx.fillRect(0, 0, W, H);
    // a sugar cube, crystals raining onto a pool of syrup, a fly drinking it
    ctx.fillStyle = '#c98a3c';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.72, 110, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5efe2';
    ctx.save();
    ctx.translate(W * 0.33, H * 0.55);
    ctx.rotate(-0.12);
    ctx.fillRect(-38, -38, 76, 76);
    ctx.fillStyle = '#e2d8c4';
    ctx.fillRect(-38, 24, 76, 14);
    ctx.restore();
    let seed = 9;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W;
      const y = ((rnd() * H + t * (60 + rnd() * 80)) % (H * 0.7));
      const r = 1.5 + rnd() * 2.5;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`;
      ctx.fillRect(x, y, r, r);
    }
    // a glint that runs across the cube
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 5)})`;
    ctx.beginPath(); ctx.arc(W * 0.28 + ((t * 40) % 60), H * 0.5, 6, 0, Math.PI * 2); ctx.fill();
    fly(ctx, W * 0.68, H * 0.66, 50, { wing: Math.abs(Math.sin(t * 18)) * 0.25 });
  },

  swarm(ctx, t, W, H) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f2c27a'); sky.addColorStop(1, '#6a4a5e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // dusk, a lek of flies wheeling as one around a point
    const cx = W / 2, cy = H * 0.46;
    for (let i = 0; i < 26; i++) {
      const a = t * (1.2 + (i % 3) * 0.15) + i * 0.9;
      const r = 40 + (i % 5) * 18 + Math.sin(t * 2 + i) * 8;
      const x = cx + Math.cos(a) * r * 1.3;
      const y = cy + Math.sin(a) * r * 0.7;
      fly(ctx, x, y, 16, { wing: Math.abs(Math.sin(t * 30 + i)) * 0.5, angle: a + Math.PI / 2, color: '#3a2a22' });
    }
    ctx.fillStyle = '#2b2230';
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
  },

  wasp(ctx, t, W, H, r) {
    ctx.fillStyle = '#1f2a1a'; ctx.fillRect(0, 0, W, H);
    // a parasitoid wasp coming in over the leaves: the size is the loom
    ctx.fillStyle = '#2f4a26';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.ellipse(30 + i * 48, H * 0.85, 40, 16, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    const k = Math.min(1, t / r.dur);
    const s = 18 + k * k * 170;
    const cx = W / 2 + Math.sin(t * 3) * 10, cy = H * 0.45 + Math.cos(t * 4) * 6;
    ctx.fillStyle = 'rgba(220,230,255,0.45)';
    const beat = Math.sin(t * 50) * 0.3;
    ctx.beginPath(); ctx.ellipse(cx - s * 0.35, cy - s * 0.35, s * 0.18, s * 0.5, -0.8 + beat, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.35, cy - s * 0.35, s * 0.18, s * 0.5, 0.8 - beat, 0, Math.PI * 2); ctx.fill();
    // a black-and-yellow abdomen, a waist, the head
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#15120a' : '#e0b21c';
      ctx.beginPath(); ctx.ellipse(cx, cy + s * (0.15 + i * 0.13), s * (0.24 - i * 0.03), s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#15120a';
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.1, s * 0.14, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.32, s * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15120a';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath(); ctx.moveTo(cx - s * 0.05, cy - s * 0.4); ctx.lineTo(cx - s * 0.2, cy - s * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.05, cy - s * 0.4); ctx.lineTo(cx + s * 0.2, cy - s * 0.7); ctx.stroke();
  },

  zapper(ctx, t, W, H, r) {
    ctx.fillStyle = '#07061a'; ctx.fillRect(0, 0, W, H);
    // the UV tube glows; a fly is drawn in; at the end, the snap
    const k = Math.min(1, t / r.dur);
    const cx = W / 2, cy = H * 0.4;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
    glow.addColorStop(0, `rgba(125,108,240,${0.7 + 0.2 * Math.sin(t * 9)})`);
    glow.addColorStop(1, 'rgba(125,108,240,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b9b0ff';
    ctx.fillRect(cx - 70, cy - 8, 140, 16);
    ctx.strokeStyle = '#3a3a48';
    ctx.lineWidth = 3;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 18, cy - 70); ctx.lineTo(cx + i * 18, cy + 70); ctx.stroke(); }
    const fx = cx + (1 - k) * 90, fy = cy + 150 - k * 140;
    if (k < 0.92) fly(ctx, fx, fy, 30, { wing: Math.abs(Math.sin(t * 28)) * 0.5, angle: -1.1 });
    else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + t * 20;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * 40, fy + Math.sin(a) * 40); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, 0, W, H);
    }
  },
};

/** The app around the reel: status bar, side buttons, caption, progress. */
function chrome(ctx, f, duo, W, H) {
  const r = f.reel;
  const c = REELS[r.cat];
  // status bar
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = INK;
  ctx.font = `600 13px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(duo.clock, 14, 16);
  const b = f.battery;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W - 44, 10, 26, 12);
  ctx.fillStyle = b < 15 ? '#e0503a' : INK;
  ctx.fillRect(W - 42, 12, 22 * b / 100, 8);
  ctx.fillStyle = INK;
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(b)}%`, W - 50, 16);
  ctx.textAlign = 'left';

  // side buttons
  const bx = W - 30;
  ctx.fillStyle = INK;
  ctx.font = `600 11px ${SANS}`;
  ctx.textAlign = 'center';
  heart(ctx, bx, H * 0.56, 12, f.dopamine > 0.4 ? '#e0503a' : INK);
  ctx.fillText(short(r.likes), bx, H * 0.56 + 22);
  // the share arrow lights while the foreleg is on it
  ctx.fillStyle = f.tap > 0.2 ? '#de7a22' : INK;
  ctx.beginPath();
  ctx.moveTo(bx - 10, H * 0.66 + 8); ctx.lineTo(bx + 11, H * 0.66); ctx.lineTo(bx - 10, H * 0.66 - 8); ctx.lineTo(bx - 5, H * 0.66); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText('send', bx, H * 0.66 + 22);
  ctx.textAlign = 'left';

  // caption
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, H - 92, W, 92);
  if (r.from) {
    ctx.fillStyle = '#de7a22';
    roundRect(ctx, 12, H - 116, 118, 22, 11);
    ctx.fillStyle = '#1b130b';
    ctx.font = `700 11px ${SANS}`;
    ctx.fillText(`from ${r.from}`, 22, H - 105);
  }
  ctx.fillStyle = INK;
  ctx.font = `700 13px ${SANS}`;
  ctx.fillText(c.creator, 14, H - 72);
  ctx.font = `400 14px ${SANS}`;
  ctx.fillText(c.label, 14, H - 50, W - 28);
  // progress
  ctx.fillStyle = 'rgba(244,239,230,0.25)';
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 4, W * Math.min(1, f.reelT / r.dur), 4);

  // an incoming message drops in from the top
  if (f.buzz > 0.05 || (f.inbox.length && f.phase === PHASES.WATCHING)) {
    const y = 36 + (1 - Math.min(1, f.buzz * 3 + (f.inbox.length ? 1 : 0))) * -40;
    ctx.fillStyle = 'rgba(244,239,230,0.94)';
    roundRect(ctx, 10, y, W - 20, 50, 12);
    ctx.fillStyle = '#1b130b';
    ctx.font = `700 13px ${SANS}`;
    ctx.fillText(`${f.friend.name}`, 22, y + 17);
    ctx.font = `400 12px ${SANS}`;
    ctx.fillText('sent you a reel', 22, y + 35);
  }
  ctx.textBaseline = 'alphabetic';
}

function heart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.2, x, y + s * 0.8);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

const short = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/** Paints one fly's whole screen. */
export function drawPhone(ctx, f, duo) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.scale(W / SCREEN_W, H / SCREEN_H);
  const w = SCREEN_W, h = SCREEN_H;
  if (f.phase === PHASES.ASLEEP || f.phase === PHASES.DEAD) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (f.phase === PHASES.DEAD && f.t < 1.5) {
      ctx.strokeStyle = '#e0503a';
      ctx.lineWidth = 3;
      ctx.strokeRect(w / 2 - 30, h / 2 - 14, 54, 28);
      ctx.fillStyle = '#e0503a';
      ctx.fillRect(w / 2 + 24, h / 2 - 6, 5, 12);
    }
    ctx.restore();
    return;
  }
  // the swipe carries the reel up and off the top
  const lift = f.phase === PHASES.SWIPING ? f.swipe * h : 0;
  ctx.save();
  ctx.translate(0, -lift);
  PAINT[f.reel.cat](ctx, f.reelT + f.reel.seed * 0.01, w, h, f.reel);
  ctx.restore();
  if (lift > 0) {
    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, h - lift, w, lift);
  }
  chrome(ctx, f, duo, w, h);
  ctx.restore();
}
