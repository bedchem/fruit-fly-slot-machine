/**
 * The reel faces, drawn into a canvas at load time.
 *
 * Orientation matters and is easy to get wrong, so it is written down here:
 * the drum is a cylinder whose axis has been turned to lie along +Z, and the
 * face the camera sees is the one at world +X. For that face,
 *
 *   texture +u  ->  screen up      (u wraps around the circumference)
 *   texture +v  ->  screen left    (v runs along the drum's width)
 *
 * so a symbol drawn the normal way up in canvas space would appear lying on its
 * side. Each symbol is therefore drawn rotated a quarter turn, and the strip
 * runs left-to-right across the canvas with one symbol per slot.
 */
import * as THREE from 'three';
import { SYMBOLS } from '../game/machine.js';

const CELL = 256;

const INK = '#2b2622';
const FACE = '#e8e0d0';
const ACCENT = '#b4772a';
const RULE = '#b8ab95';

function symbolFly(c, s) {
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = s * 0.028; c.lineCap = 'round';
  // wings
  c.save(); c.globalAlpha = 0.5;
  for (const dir of [-1, 1]) {
    c.beginPath();
    c.ellipse(dir * s * 0.20, -s * 0.06, s * 0.23, s * 0.10, dir * -0.5, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  // body
  c.beginPath(); c.ellipse(0, s * 0.13, s * 0.11, s * 0.20, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(0, -s * 0.09, s * 0.10, s * 0.10, 0, 0, Math.PI * 2); c.fill();
  // head + eyes
  c.beginPath(); c.arc(0, -s * 0.25, s * 0.085, 0, Math.PI * 2); c.fill();
  c.fillStyle = ACCENT;
  c.beginPath(); c.arc(-s * 0.07, -s * 0.27, s * 0.045, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(s * 0.07, -s * 0.27, s * 0.045, 0, Math.PI * 2); c.fill();
  // legs
  c.strokeStyle = INK; c.lineWidth = s * 0.02;
  for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(dir * s * 0.06, -s * 0.05 + i * s * 0.09);
    c.quadraticCurveTo(dir * s * 0.22, s * 0.02 + i * s * 0.10, dir * s * 0.26, s * 0.16 + i * s * 0.08);
    c.stroke();
  }
}

function symbolWing(c, s) {
  c.strokeStyle = INK; c.lineWidth = s * 0.026; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-s * 0.30, s * 0.10);
  c.bezierCurveTo(-s * 0.10, -s * 0.34, s * 0.24, -s * 0.26, s * 0.31, s * 0.02);
  c.bezierCurveTo(s * 0.22, s * 0.22, -s * 0.10, s * 0.24, -s * 0.30, s * 0.10);
  c.stroke();
  c.lineWidth = s * 0.013; c.strokeStyle = RULE;
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    c.beginPath();
    c.moveTo(-s * 0.27, s * 0.10 - k * s * 0.03);
    c.quadraticCurveTo(s * 0.0 + k * s * 0.05, -s * 0.22 + k * s * 0.26, s * 0.27, -s * 0.02 + k * s * 0.10);
    c.stroke();
  }
}

function symbolEye(c, s) {
  // a compound eye: hex packing, warm centre
  const r = s * 0.045;
  const h = r * Math.sqrt(3);
  c.lineWidth = s * 0.012;
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = col * r * 1.5;
      const y = row * h + (col % 2 ? h / 2 : 0);
      const d = Math.hypot(x / (s * 0.30), y / (s * 0.34));
      if (d > 1) continue;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        const px = x + r * 0.92 * Math.cos(a);
        const py = y + r * 0.92 * Math.sin(a);
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      c.fillStyle = d < 0.45 ? ACCENT : INK;
      c.globalAlpha = d < 0.45 ? 0.85 : 0.18 + 0.5 * (1 - d);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = INK;
      c.stroke();
    }
  }
}

function symbolNeuron(c, s) {
  c.strokeStyle = INK; c.lineWidth = s * 0.022; c.lineCap = 'round';
  // axon
  c.beginPath();
  c.moveTo(-s * 0.02, s * 0.04);
  c.bezierCurveTo(s * 0.06, s * 0.16, s * 0.04, s * 0.26, s * 0.16, s * 0.33);
  c.stroke();
  // dendrites
  const arms = 7;
  for (let i = 0; i < arms; i++) {
    const a = -Math.PI * 0.95 + (i / (arms - 1)) * Math.PI * 1.25;
    const len = s * (0.20 + 0.10 * Math.sin(i * 2.1));
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(Math.cos(a) * len * 0.6, Math.sin(a) * len * 0.6 - s * 0.04,
      Math.cos(a) * len, Math.sin(a) * len);
    c.stroke();
    c.lineWidth = s * 0.014;
    for (const spread of [-0.4, 0.4]) {
      c.beginPath();
      c.moveTo(Math.cos(a) * len, Math.sin(a) * len);
      c.lineTo(Math.cos(a + spread) * len * 1.28, Math.sin(a + spread) * len * 1.28);
      c.stroke();
    }
    c.lineWidth = s * 0.022;
  }
  // soma
  c.fillStyle = ACCENT;
  c.beginPath(); c.arc(0, 0, s * 0.075, 0, Math.PI * 2); c.fill();
  c.strokeStyle = INK; c.lineWidth = s * 0.018; c.stroke();
  // terminal
  c.beginPath(); c.arc(s * 0.16, s * 0.33, s * 0.032, 0, Math.PI * 2); c.fill(); c.stroke();
}

function symbolCherry(c, s) {
  c.strokeStyle = INK; c.lineWidth = s * 0.026; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-s * 0.16, s * 0.16);
  c.quadraticCurveTo(s * 0.02, -s * 0.12, s * 0.06, -s * 0.30);
  c.moveTo(s * 0.17, s * 0.13);
  c.quadraticCurveTo(s * 0.14, -s * 0.10, s * 0.06, -s * 0.30);
  c.stroke();
  c.fillStyle = ACCENT;
  for (const [x, y] of [[-s * 0.16, s * 0.20], [s * 0.17, s * 0.17]]) {
    c.beginPath(); c.arc(x, y, s * 0.115, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = s * 0.02; c.stroke();
  }
  // leaf
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(s * 0.06, -s * 0.30);
  c.quadraticCurveTo(s * 0.24, -s * 0.38, s * 0.30, -s * 0.22);
  c.quadraticCurveTo(s * 0.16, -s * 0.20, s * 0.06, -s * 0.30);
  c.fill();
}

function symbolSeven(c, s) {
  c.fillStyle = ACCENT;
  c.font = `700 ${s * 0.72}px "Cormorant Garamond", Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('7', 0, s * 0.03);
  c.strokeStyle = INK;
  c.lineWidth = s * 0.012;
  c.strokeText('7', 0, s * 0.03);
}

const PAINTERS = {
  fly: symbolFly, wing: symbolWing, eye: symbolEye,
  neuron: symbolNeuron, cherry: symbolCherry, seven: symbolSeven,
};

/** Draws one symbol centred in a CELL×CELL box at (x0, 0). */
function drawCell(c, index, x0) {
  c.save();
  c.translate(x0 + CELL / 2, CELL / 2);

  // the cell's own background and detent rules, drawn before the quarter turn
  c.fillStyle = FACE;
  c.fillRect(-CELL / 2, -CELL / 2, CELL, CELL);
  c.strokeStyle = RULE;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-CELL / 2 + 1.5, -CELL / 2); c.lineTo(-CELL / 2 + 1.5, CELL / 2);
  c.stroke();

  c.rotate(Math.PI / 2);          // see the orientation note at the top
  const painter = PAINTERS[SYMBOLS[index].id];
  if (painter) painter(c, CELL);
  c.restore();
}

let cached = null;

export function reelTexture() {
  if (cached) return cached;
  const n = SYMBOLS.length;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * n;
  canvas.height = CELL;
  const c = canvas.getContext('2d');
  c.fillStyle = FACE;
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < n; i++) drawCell(c, i, i * CELL);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  cached = tex;
  return tex;
}

/**
 * Draws one symbol on its own, for the UI. The reel strip needs them rotated
 * a quarter turn to sit right on the drum; here they are drawn upright.
 */
export function symbolCanvas(id, size = 64, ink = INK) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.translate(size / 2, size / 2);
  const painter = PAINTERS[id];
  if (painter) painter(c, size);
  void ink;
  return canvas;
}
