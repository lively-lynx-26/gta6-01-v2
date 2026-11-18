// Solmar Bay — Neon Tide: procedural textures. Every surface the city shows
// is painted on a canvas in code — asphalt with cracks and patchwork, paver
// sidewalks, warm sand, park grass, and building facades with lit and dark
// windows — so the city feels photographed rather than flat-shaded. All
// textures are drawn from the fixed city seed, so they are identical on
// every run, and no image file is ever loaded.

import * as THREE from 'three';
import { makeRng, range, int } from './random.js';

// A canvas of the given size, with its 2D context.
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Speckle a context with dots of the given colours.
function speckle(ctx, rng, w, h, count, colors, sizeMax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = range(rng, 0.6, sizeMax);
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
}

// A wandering dark crack across the canvas.
function crack(ctx, rng, w, h) {
  ctx.strokeStyle = 'rgba(18, 20, 24, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  let x = rng() * w;
  let y = rng() * h;
  ctx.moveTo(x, y);
  for (let i = 0; i < 7; i++) {
    x += range(rng, -28, 28);
    y += range(rng, -28, 28);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Wrap a finished canvas as a repeating texture.
function textureFrom(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Asphalt: dark grey, speckled, patched, with a few cracks.
function makeAsphalt(rng) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(0, 0, 256, 256);
  // Patchwork rectangles, slightly lighter or darker than the base.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(52, 57, 63, 0.8)' : 'rgba(44, 48, 54, 0.8)';
    ctx.fillRect(rng() * 200, rng() * 200, range(rng, 30, 90), range(rng, 24, 70));
  }
  speckle(ctx, rng, 256, 256, 2600, ['#464c54', '#2f3338', '#4d535b', '#383d43'], 2.2);
  crack(ctx, rng, 256, 256);
  crack(ctx, rng, 256, 256);
  return textureFrom(c, 26, 26);
}

// Sidewalk pavers: pale concrete slabs with grout lines and speckle.
function makeSidewalk(rng) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#a8adb0';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, rng, 128, 128, 700, ['#b7bcc0', '#969ca1', '#c2c7ca'], 2);
  ctx.strokeStyle = 'rgba(70, 76, 82, 0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 128) / 4, 0);
    ctx.lineTo((i * 128) / 4, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * 128) / 4);
    ctx.lineTo(128, (i * 128) / 4);
    ctx.stroke();
  }
  return textureFrom(c, 9, 9);
}

// Beach sand: warm gold with dense speckle and a few darker grains.
function makeSand(rng) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#e0c98f';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, rng, 128, 128, 1600, ['#d3b878', '#ecd3a0', '#c8ab6d', '#f0dcae'], 2);
  return textureFrom(c, 14, 2);
}

// Park grass: green with lighter blades and a few worn patches.
function makeGrass(rng) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#6f9a55';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(140, 160, 90, 0.5)';
    ctx.beginPath();
    ctx.ellipse(rng() * 128, rng() * 128, range(rng, 10, 26), range(rng, 8, 18), rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, rng, 128, 128, 1400, ['#7fae62', '#5d8448', '#8cbb6d', '#6a8f4e'], 2);
  return textureFrom(c, 8, 8);
}

// A building facade: a base colour, a grid of windows — some warmly lit,
// some dark glass, some with a balcony rail — and a darker ground floor.
export function makeFacade(rng, baseColor) {
  const [c, ctx] = canvas(128, 256);
  const base = `#${baseColor.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so the wall is not perfectly flat.
  const shade = ctx.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
  shade.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 7;
  const ww = 20;
  const wh = 22;
  const gapX = (128 - cols * ww) / (cols + 1);
  const gapY = (256 - 34 - rows * wh) / (rows + 1);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = gapX + col * (ww + gapX);
      const y = 14 + gapY + r * (wh + gapY);
      const roll = rng();
      if (roll < 0.3) {
        // Warmly lit window.
        ctx.fillStyle = '#ffd98a';
      } else if (roll < 0.62) {
        // Dark glass with a sky reflection.
        const g = ctx.createLinearGradient(x, y, x, y + wh);
        g.addColorStop(0, '#2a3d4d');
        g.addColorStop(1, '#16222e');
        ctx.fillStyle = g;
      } else {
        // Shuttered or curtained window.
        ctx.fillStyle = '#5d6a72';
      }
      ctx.fillRect(x, y, ww, wh);
      ctx.strokeStyle = 'rgba(30, 30, 30, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, ww, wh);
      // A mullion cross on the glass.
      ctx.beginPath();
      ctx.moveTo(x + ww / 2, y);
      ctx.lineTo(x + ww / 2, y + wh);
      ctx.moveTo(x, y + wh / 2);
      ctx.lineTo(x + ww, y + wh / 2);
      ctx.stroke();
    }
  }
  // Ground floor: darker band with a door and a shopfront hint.
  ctx.fillStyle = 'rgba(40, 34, 28, 0.55)';
  ctx.fillRect(0, 222, 128, 34);
  ctx.fillStyle = '#3c2f24';
  ctx.fillRect(54, 226, 20, 30);
  ctx.fillStyle = 'rgba(150, 190, 210, 0.5)';
  ctx.fillRect(14, 228, 28, 16);
  ctx.fillRect(86, 228, 28, 16);
  return textureFrom(c, 1, 1);
}

// Tree bark: warm brown with vertical darker fissures and lighter ridges,
// so a trunk reads as bark instead of a flat brown tube.
function makeBark(rng) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 46; i++) {
    const x = rng() * 128;
    ctx.strokeStyle = rng() < 0.55 ? 'rgba(52, 32, 18, 0.6)' : 'rgba(146, 104, 62, 0.55)';
    ctx.lineWidth = range(rng, 1, 3.4);
    ctx.beginPath();
    ctx.moveTo(x, -4);
    let xx = x;
    for (let y = 0; y <= 128; y += 16) {
      xx += range(rng, -4, 4);
      ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  speckle(ctx, rng, 128, 128, 300, ['#7d5a3a', '#54371f', '#8a6a44'], 2);
  return textureFrom(c, 1, 2);
}

// A dashed centre line for the streets: a pale dash on transparency,
// repeated along the road. The dash runs along the canvas's width, which
// the street strips map to the road's length.
export function makeLaneDash() {
  const [c, ctx] = canvas(128, 16);
  ctx.clearRect(0, 0, 128, 16);
  ctx.fillStyle = 'rgba(240, 230, 180, 0.9)';
  ctx.fillRect(14, 6, 60, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 1);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build the whole texture set from the fixed city seed.
export function buildTextures(seed) {
  const rng = makeRng(seed);
  const facades = [];
  for (let i = 0; i < 6; i++) {
    const base = [0xe8dcc8, 0xd9c4a5, 0xc9b18c, 0xe5e0d5, 0xf0e6d2, 0xd8cdb8][i];
    facades.push(makeFacade(rng, base));
  }
  return {
    asphalt: makeAsphalt(rng),
    sidewalk: makeSidewalk(rng),
    sand: makeSand(rng),
    grass: makeGrass(rng),
    bark: makeBark(rng),
    facades,
    laneDash: makeLaneDash(),
  };
}
