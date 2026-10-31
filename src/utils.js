import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const invLerp = (a, b, v) => (v - a) / (b - a || 1);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const sign = (v) => (v < 0 ? -1 : 1);
export const smoothstep = (t) => t * t * (3 - 2 * t);

export function normalizeAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function weightedChoice(entries) {
  let total = 0;
  for (const e of entries) total += e.weight;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function textureFromCanvas(canvas, renderer, { srgb = true, repeat = null } = {}) {
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  if (repeat) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  if (renderer) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function shade(hex, amount) {
  const c = hex.toString(16).padStart(6, '0');
  let r = parseInt(c.slice(0, 2), 16);
  let g = parseInt(c.slice(2, 4), 16);
  let b = parseInt(c.slice(4, 6), 16);
  r = clamp(Math.round(r + 255 * amount), 0, 255);
  g = clamp(Math.round(g + 255 * amount), 0, 255);
  b = clamp(Math.round(b + 255 * amount), 0, 255);
  return (r << 16) | (g << 8) | b;
}
