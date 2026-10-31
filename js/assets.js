import * as THREE from '../vendor/three.module.min.js';

export const DISPLAY_FONT = '"Archivo Black", "Arial Black", sans-serif';
export const BODY_FONT = '"Rubik", "Segoe UI", sans-serif';

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function textureFromCanvas(canvas, { repeat = false, repeatX = 1, repeatY = 1 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
  }
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function makeGlowTexture() {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,240,190,0.85)');
  gradient.addColorStop(0.55, 'rgba(255,180,80,0.24)');
  gradient.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return textureFromCanvas(canvas);
}

const BUILDING_TINTS = [
  ['#222641', '#111226', '#ffd483', '#8de2ff'],
  ['#2b2340', '#141125', '#ffc978', '#ff9fb8'],
  ['#1b2d3a', '#0d1721', '#9be9ff', '#ffdc8a'],
  ['#32243c', '#171021', '#ffd18a', '#c9a7ff'],
  ['#252b3a', '#10131e', '#ffbd72', '#a7f3dd'],
];

export function makeBuildingTexture(rng, cols, rows) {
  const width = 160;
  const height = 320;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const [top, bottom, warm, cool] = BUILDING_TINTS[Math.floor(rng() * BUILDING_TINTS.length)];

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Facade edge shadows add a little volume.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, 10, height);
  ctx.fillRect(width - 7, 0, 7, height);

  const marginX = 18;
  const marginTop = 16;
  const marginBottom = 36;
  const cellW = (width - marginX * 2) / cols;
  const cellH = (height - marginTop - marginBottom) / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const lit = rng() < 0.44;
      const x = marginX + col * cellW + cellW * 0.2;
      const y = marginTop + row * cellH + cellH * 0.2;
      const w = Math.max(2, cellW * 0.6);
      const h = Math.max(2, cellH * 0.56);
      if (lit) {
        ctx.fillStyle = rng() < 0.62 ? warm : cool;
        ctx.globalAlpha = 0.55 + rng() * 0.45;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(8,10,22,0.62)';
        ctx.fillRect(x, y, w, h);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, marginTop + (row + 1) * cellH - 2, width, 2);
  }

  // Bright street-level storefront.
  const storeGradient = ctx.createLinearGradient(0, height - 30, 0, height);
  storeGradient.addColorStop(0, warm);
  storeGradient.addColorStop(1, 'rgba(255,120,60,0.18)');
  ctx.fillStyle = storeGradient;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(12, height - 28, width - 24, 20);
  ctx.globalAlpha = 1;

  if (rng() < 0.45) {
    ctx.fillStyle = cool;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(width - 24, 60, 4, height - 120);
    ctx.globalAlpha = 1;
  }

  return textureFromCanvas(canvas);
}

export function makeTrainTextures(base, accent, rng) {
  const width = 1024;
  const height = 256;
  const side = makeCanvas(width, height);
  const emissive = makeCanvas(width, height);
  const front = makeCanvas(256, 256);

  const sctx = side.getContext('2d');
  const ectx = emissive.getContext('2d');
  const fctx = front.getContext('2d');

  const bodyGradient = sctx.createLinearGradient(0, 0, 0, height);
  bodyGradient.addColorStop(0, base);
  bodyGradient.addColorStop(0.5, base);
  bodyGradient.addColorStop(1, '#101322');
  sctx.fillStyle = bodyGradient;
  sctx.fillRect(0, 0, width, height);

  sctx.fillStyle = 'rgba(0,0,0,0.28)';
  sctx.fillRect(0, height - 30, width, 30);
  sctx.fillStyle = accent;
  sctx.fillRect(0, 180, width, 13);

  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, width, height);
  ectx.fillStyle = accent;
  ectx.globalAlpha = 0.9;
  ectx.fillRect(0, 180, width, 13);
  ectx.globalAlpha = 1;

  const windowCount = 12;
  const cell = width / windowCount;
  for (let i = 0; i < windowCount; i += 1) {
    const isDoor = i === 3 || i === 8;
    const x = i * cell + cell * 0.18;
    const w = cell * 0.64;
    if (isDoor) {
      sctx.fillStyle = 'rgba(8,10,20,0.85)';
      roundRect(sctx, x - 2, 38, w + 4, 136, 8);
      sctx.fill();
      sctx.strokeStyle = accent;
      sctx.lineWidth = 3;
      sctx.stroke();
      sctx.fillStyle = 'rgba(255,240,190,0.55)';
      sctx.fillRect(x + w * 0.28, 64, w * 0.44, 70);
      ectx.fillStyle = 'rgba(255,214,150,0.4)';
      ectx.fillRect(x + w * 0.28, 64, w * 0.44, 70);
      sctx.strokeStyle = 'rgba(0,0,0,0.4)';
      sctx.beginPath();
      sctx.moveTo(x + w / 2, 38);
      sctx.lineTo(x + w / 2, 174);
      sctx.stroke();
    } else {
      sctx.fillStyle = 'rgba(9,12,24,0.92)';
      roundRect(sctx, x, 54, w, 70, 5);
      sctx.fill();
      const lit = 0.65 + rng() * 0.35;
      sctx.fillStyle = `rgba(255,219,150,${lit})`;
      sctx.fillRect(x + 5, 60, w - 10, 58);
      ectx.fillStyle = `rgba(255,210,130,${lit})`;
      ectx.fillRect(x + 5, 60, w - 10, 58);
    }
  }

  // Custom graffiti scribbles make each carriage feel hand-tagged.
  for (let i = 0; i < 3; i += 1) {
    const gx = 40 + rng() * (width - 220);
    const gy = 205 + rng() * 22;
    sctx.strokeStyle = ['#ff5d63', '#ffcc4d', '#31e7c9', '#8a6bff'][Math.floor(rng() * 4)];
    sctx.lineWidth = 5 + rng() * 5;
    sctx.lineCap = 'round';
    sctx.beginPath();
    sctx.moveTo(gx, gy);
    sctx.bezierCurveTo(gx + 30, gy - 25, gx + 70, gy + 26, gx + 100 + rng() * 70, gy - 6);
    sctx.stroke();
  }

  // Roof and window shading.
  sctx.fillStyle = 'rgba(255,255,255,0.09)';
  sctx.fillRect(0, 0, width, 10);
  sctx.fillStyle = 'rgba(0,0,0,0.2)';
  sctx.fillRect(0, 138, width, 4);

  // Front face.
  const fGradient = fctx.createLinearGradient(0, 0, 0, 256);
  fGradient.addColorStop(0, base);
  fGradient.addColorStop(1, '#111422');
  fctx.fillStyle = fGradient;
  fctx.fillRect(0, 0, 256, 256);

  fctx.fillStyle = 'rgba(8,10,18,0.94)';
  roundRect(fctx, 34, 52, 188, 82, 14);
  fctx.fill();
  fctx.strokeStyle = 'rgba(255,255,255,0.28)';
  fctx.lineWidth = 3;
  fctx.stroke();

  const glass = fctx.createLinearGradient(0, 54, 0, 132);
  glass.addColorStop(0, 'rgba(140,200,255,0.42)');
  glass.addColorStop(0.55, 'rgba(25,40,70,0.18)');
  glass.addColorStop(1, 'rgba(255,180,90,0.1)');
  fctx.fillStyle = glass;
  roundRect(fctx, 40, 58, 176, 70, 10);
  fctx.fill();

  fctx.fillStyle = accent;
  fctx.fillRect(0, 176, 256, 12);

  fctx.fillStyle = '#0b0d18';
  fctx.fillRect(0, 218, 256, 38);
  fctx.fillStyle = 'rgba(255,255,255,0.18)';
  fctx.fillRect(0, 218, 256, 3);

  // Destination board.
  fctx.fillStyle = '#10131e';
  roundRect(fctx, 74, 16, 108, 26, 6);
  fctx.fill();
  fctx.fillStyle = '#ffd47e';
  fctx.font = `400 17px ${DISPLAY_FONT}`;
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.fillText('N · 03', 128, 30);

  // Headlights.
  for (const x of [56, 200]) {
    fctx.fillStyle = '#fff6c8';
    fctx.beginPath();
    fctx.arc(x, 166, 13, 0, Math.PI * 2);
    fctx.fill();
    fctx.fillStyle = 'rgba(255,190,70,0.35)';
    fctx.beginPath();
    fctx.arc(x, 166, 22, 0, Math.PI * 2);
    fctx.fill();
  }

  return {
    side: textureFromCanvas(side),
    sideEmissive: textureFromCanvas(emissive),
    front: textureFromCanvas(front),
  };
}

export function makeBarrierTexture() {
  const canvas = makeCanvas(512, 160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, 512, 160);
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 8, 496, 144);
  ctx.clip();
  ctx.fillStyle = '#ffb638';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#241a12';
  for (let x = -160; x < 560; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 160);
    ctx.lineTo(x + 58, 160);
    ctx.lineTo(x + 158, 0);
    ctx.lineTo(x + 100, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#07060f';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 148);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(8, 8, 496, 6);

  const glow = makeCanvas(512, 160);
  const gctx = glow.getContext('2d');
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, 512, 160);
  gctx.fillStyle = 'rgba(255,170,50,0.35)';
  gctx.fillRect(10, 10, 492, 140);
  return { map: textureFromCanvas(canvas), emissive: textureFromCanvas(glow) };
}

export function makeGateTexture() {
  const canvas = makeCanvas(640, 240);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#171126';
  ctx.fillRect(0, 0, 640, 240);
  ctx.strokeStyle = '#ffbf47';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 624, 224);

  ctx.fillStyle = '#ffbf47';
  for (let i = 0; i < 5; i += 1) {
    const x = 52 + i * 112;
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x + 66, 44);
    ctx.lineTo(x + 33, 104);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#fff4dc';
  ctx.font = `400 64px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROLL', 320, 168);

  ctx.fillStyle = 'rgba(255,191,71,0.45)';
  ctx.font = `600 20px ${BODY_FONT}`;
  ctx.fillText('LOW CLEARANCE', 320, 216);

  const glow = makeCanvas(640, 240);
  const gctx = glow.getContext('2d');
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, 640, 240);
  gctx.fillStyle = 'rgba(255,180,60,0.28)';
  gctx.fillRect(8, 8, 624, 224);
  return { map: textureFromCanvas(canvas), emissive: textureFromCanvas(glow) };
}

export function makeSignTexture(text, subtitle, accent) {
  const canvas = makeCanvas(640, 320);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 640, 320);

  const gradient = ctx.createLinearGradient(0, 0, 640, 320);
  gradient.addColorStop(0, '#161129');
  gradient.addColorStop(1, '#0b0917');
  ctx.fillStyle = gradient;
  roundRect(ctx, 10, 10, 620, 300, 26);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 34;
  ctx.fillStyle = accent;
  ctx.font = `400 104px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 320, 140);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,247,232,0.72)';
  ctx.font = `600 26px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(subtitle.toUpperCase(), 320, 228);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 264);
  ctx.lineTo(490, 264);
  ctx.stroke();

  return textureFromCanvas(canvas);
}

export function makeBannerTexture(text, subtitle, accent) {
  const canvas = makeCanvas(1024, 256);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(10,8,20,0.88)';
  roundRect(ctx, 8, 8, 1008, 240, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.fillStyle = accent;
  ctx.font = `400 92px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 102);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,247,232,0.66)';
  ctx.font = `600 26px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(subtitle.toUpperCase(), 512, 176);

  ctx.fillStyle = 'rgba(255,204,77,0.5)';
  ctx.fillRect(362, 204, 300, 3);
  return textureFromCanvas(canvas);
}

export function makeGraffitiTexture(rng) {
  const canvas = makeCanvas(1024, 320);
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, 320);
  base.addColorStop(0, '#5b5366');
  base.addColorStop(1, '#3a3245');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 320);

  // Concrete panel seams.
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  for (const y of [78, 158, 238]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 2;
  for (const y of [81, 161, 241]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.045})`;
    ctx.fillRect(rng() * 1024, rng() * 320, 3 + rng() * 20, 2 + rng() * 12);
  }
  ctx.fillStyle = 'rgba(8,7,15,0.5)';
  ctx.fillRect(0, 0, 1024, 18);
  ctx.fillRect(0, 302, 1024, 18);

  const colors = ['#ff5d63', '#31e7c9', '#ffcc4d', '#8a6bff', '#ff7b3d'];
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(60 + rng() * 700, 130 + rng() * 100);
    ctx.rotate((rng() - 0.5) * 0.32);
    const color = colors[Math.floor(rng() * colors.length)];
    ctx.strokeStyle = color;
    ctx.lineWidth = 12 + rng() * 9;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(45, -55, 90, 52, 150, -8);
    ctx.bezierCurveTo(175, -30, 200, 20, 235, 6);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  return textureFromCanvas(canvas);
}

export function makeDestinationTexture(text) {
  const canvas = makeCanvas(256, 64);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0c16';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffd47e';
  ctx.font = `400 28px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  return textureFromCanvas(canvas);
}
