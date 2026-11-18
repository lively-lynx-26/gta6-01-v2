// Solmar Bay — Neon Tide: floating popups. Damage numbers, drift and
// near-miss bonuses and REP gains appear where they happen: a world
// position is projected through the camera onto the screen, then the text
// floats up and fades. The layer is plain DOM over the canvas, so the
// screenshots show the popups exactly as the player sees them.

import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Popups {
  constructor(layerEl) {
    this.layer = layerEl;
    this.items = []; // [{ el, x, y, z, life, maxLife, screen }]
  }

  // A popup at a world position: `text` is the label, `cls` picks the
  // colour ('dmg' gold, 'rep' green, 'stunt' orange). When a camera is
  // passed, the popup is placed on screen at once (a frozen screenshot
  // frame never runs update, so it would otherwise sit unplaced).
  spawn(x, y, z, text, cls = 'dmg', camera = null) {
    const el = document.createElement('div');
    el.className = `popup popup-${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    const item = { el, x, y, z, life: 1.1, maxLife: 1.1, screen: false };
    this.items.push(item);
    if (camera) this._place(item, camera);
  }

  // A popup at a fixed screen position (fractions of the viewport):
  // used by the screenshot scenes, where the frame is frozen.
  spawnScreen(fx, fy, text, cls = 'stunt') {
    const el = document.createElement('div');
    el.className = `popup popup-${cls}`;
    el.textContent = text;
    el.style.left = `${fx * 100}%`;
    el.style.top = `${fy * 100}%`;
    el.style.opacity = '1';
    this.layer.appendChild(el);
    this.items.push({ el, x: 0, y: 0, z: 0, life: 999, maxLife: 999, screen: true });
  }

  // Project one world popup onto the screen.
  _place(item, camera) {
    _v.set(item.x, item.y + (1 - item.life / item.maxLife) * 1.6, item.z);
    _v.project(camera);
    if (_v.z > 1) {
      item.el.style.display = 'none';
      return;
    }
    item.el.style.display = 'block';
    item.el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`;
    item.el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
    item.el.style.opacity = String(Math.min(1, (item.life / item.maxLife) * 2));
  }

  clear() {
    for (const item of this.items) item.el.remove();
    this.items.length = 0;
  }

  // One step: project each world popup to the screen, float it up and
  // fade it out. Screen-fixed popups stay where they were put.
  update(dt, camera) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.screen) {
        item.life -= dt;
        if (item.life <= 0) {
          item.el.remove();
          this.items.splice(i, 1);
          continue;
        }
        this._place(item, camera);
      }
    }
  }
}
