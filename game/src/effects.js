// Solmar Bay — Neon Tide: damage smoke and visual wear. When the car
// Dario drives is badly hurt, it shows it: grey smoke pours from the
// engine, thicker the lower the health, and the paint darkens toward
// soot. The smoke is a small pool of sprites with a procedural radial
// texture — no image file — and the wear only ever touches the paint
// material of the car being driven, restoring it when Dario changes cars.

import * as THREE from 'three';

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(200, 200, 200, 0.85)');
  g.addColorStop(0.5, 'rgba(150, 150, 150, 0.45)');
  g.addColorStop(1, 'rgba(120, 120, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

const SOOT = new THREE.Color(0x26262a);

export class DamageSmoke {
  constructor(scene) {
    this.scene = scene;
    this.texture = smokeTexture();
    this.puffs = [];
    this.emitAcc = 0;
    this.wornMesh = null; // the car mesh whose paint is darkened now
    this.wornPaint = []; // [{ mat, color }] original paint colours
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    }
  }

  // Remember a car's paint materials so wear can be undone later.
  _capturePaint(mesh, specColor) {
    const paints = [];
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      const mat = child.material;
      if (mat && mat.isMeshStandardMaterial && mat.color && mat.color.getHex() === specColor) {
        paints.push({ mat, color: mat.color.clone() });
      }
    });
    return paints;
  }

  // Darken the paint of `mesh` by `wear` (0 = showroom, 1 = burnt out),
  // restoring the previous car first.
  _applyWear(mesh, specColor, wear) {
    if (mesh !== this.wornMesh) {
      for (const { mat, color } of this.wornPaint) mat.color.copy(color);
      this.wornMesh = mesh;
      this.wornPaint = mesh ? this._capturePaint(mesh, specColor) : [];
    }
    for (const { mat, color } of this.wornPaint) {
      mat.color.copy(color).lerp(SOOT, wear * 0.75);
    }
  }

  // One step. `car` is the player's car record (or null on foot),
  // `carHealth` is 0-100. No smoke at all while the car is healthy, so
  // screenshot scenes (health 100) stay clean and deterministic.
  update(dt, car, carHealth) {
    const health = car ? carHealth : 100;
    const damaged = car && health < 45;
    const wear = damaged ? (45 - health) / 45 : 0;

    if (car) this._applyWear(car.mesh, car.spec.color, wear);
    else if (this.wornMesh) this._applyWear(null, 0, 0);

    // Emit from the engine bay: the front of the car, just above the hood.
    if (damaged) {
      const rate = wear * 16; // puffs per second at full damage
      this.emitAcc += rate * dt;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const puff = this.puffs.find((p) => p.life <= 0);
        if (!puff) break;
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        puff.sprite.position.set(car.x + fx * 2.0, 1.1, car.z + fz * 2.0);
        puff.life = 1.4;
        puff.maxLife = 1.4;
        puff.size = 1.1;
        puff.vx = (Math.random() - 0.5) * 0.6;
        puff.vy = 1.3 + Math.random() * 0.5;
        puff.vz = (Math.random() - 0.5) * 0.6;
        puff.sprite.visible = true;
      }
    }

    for (const puff of this.puffs) {
      if (puff.life <= 0) continue;
      puff.life -= dt;
      if (puff.life <= 0) {
        puff.sprite.visible = false;
        puff.sprite.material.opacity = 0;
        continue;
      }
      const t = 1 - puff.life / puff.maxLife;
      puff.sprite.position.x += puff.vx * dt;
      puff.sprite.position.y += puff.vy * dt;
      puff.sprite.position.z += puff.vz * dt;
      const size = puff.size + t * 2.6;
      puff.sprite.scale.set(size, size, 1);
      puff.sprite.material.opacity = 0.55 * (1 - t);
    }
  }
}
