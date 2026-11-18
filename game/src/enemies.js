// Solmar Bay — Neon Tide: mission enemies and the player's pistol. Goons
// spawn where a mission puts them, close in until they are in range, then
// strafe and shoot at the player with a visible tracer — and the player
// shoots back: a pistol shot is a ray against every live goon, three hits
// drop one. Enemies arrive with the missions in a later chunk; this module
// is the reusable combat they stand on, and it is testable on its own:
// spawn two goons, walk into range, and trade fire.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range } from './random.js';
import { buildPedestrianMesh } from './models.js';
import { resolveCircle, segmentBlocked } from './physics.js';

function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Enemies {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(CFG.seed + 404); // its own stream, after the city's
    this.list = [];
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.9 });
  }

  // Spawn a goon at (x, z), facing the player. Returns the enemy record.
  spawn(x, z) {
    const mesh = buildPedestrianMesh({
      shirt: 0x1c1c22,
      pants: 0x222226,
      skin: 0xc98e6b,
      armed: true,
    });
    this.scene.add(mesh);
    const enemy = {
      mesh,
      x,
      z,
      heading: 0,
      health: CFG.enemy.health,
      state: 'alive', // alive | dead
      shootTimer: range(this.rng, 0.8, 1.6),
      strafePhase: range(this.rng, 0, Math.PI * 2),
      walkPhase: range(this.rng, 0, Math.PI * 2),
      deadTimer: 0,
    };
    this.list.push(enemy);
    mesh.position.set(x, 0, z);
    return enemy;
  }

  // Remove every goon and tracer (a new game starts clean).
  clear() {
    for (const e of this.list) this.scene.remove(e.mesh);
    this.list.length = 0;
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
    this.tracers.length = 0;
  }

  // The player's shot: a ray from (ox, oz) along direction (dx, dz).
  // `damage` and `range` come from the weapon fired (the pistol's
  // defaults keep the old callers working); `pellets` fires that many
  // rays with a small spread, for the shotgun. Returns the goon hit and
  // the damage dealt, or null — the caller shows the damage number.
  shootAt(ox, oz, dx, dz, damage = CFG.pistol.damage, range = CFG.pistol.range, pellets = 1) {
    let best = null;
    let bestAlong = range;
    for (const e of this.list) {
      if (e.state !== 'alive') continue;
      const ex = e.x - ox;
      const ez = e.z - oz;
      const along = ex * dx + ez * dz;
      if (along < 0 || along > bestAlong) continue;
      const perp = Math.abs(ex * dz - ez * dx);
      if (perp > 1.1) continue; // the shot passed wide of the goon
      if (segmentBlocked(this.city.colliders, ox, oz, e.x, e.z)) continue;
      bestAlong = along;
      best = e;
    }
    if (!best) return null;
    // A shotgun's pellets spread with distance: all three land up
    // close, two at mid range, one at the edge of the pattern.
    let hits = pellets;
    if (pellets > 1) {
      const d = Math.hypot(best.x - ox, best.z - oz);
      hits = d < range * 0.5 ? 3 : d < range * 0.8 ? 2 : 1;
    }
    const total = damage * hits;
    best.health -= total;
    if (best.health <= 0) {
      best.state = 'dead';
      best.deadTimer = 4;
      const u = best.mesh.userData;
      u.legL.rotation.x = 0;
      u.legR.rotation.x = 0;
      u.armL.rotation.x = 0;
      u.armR.rotation.x = 0;
      u.torso.rotation.x = 0;
      best.mesh.rotation.x = -Math.PI / 2;
      best.mesh.position.y = 0.35;
    }
    return { enemy: best, damage: total, killed: best.state === 'dead' };
  }

  // A short-lived tracer line from the shooter toward the player.
  _tracer(fromX, fromY, fromZ, toX, toY, toZ) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(fromX, fromY, fromZ),
      new THREE.Vector3(toX, toY, toZ),
    ]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  // One step. `player` is the player; `onShotFired` is called with the
  // distance when a goon shoots, so the caller can play the sound.
  update(dt, player, onShotFired) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.state === 'dead') {
        e.deadTimer -= dt;
        if (e.deadTimer <= 0) {
          this.scene.remove(e.mesh);
          this.list.splice(i, 1);
        }
        continue;
      }
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      const seesPlayer = dist < CFG.enemy.engageRange && !segmentBlocked(this.city.colliders, e.x, e.z, player.x, player.z);
      if (!seesPlayer) {
        // Idle: face the player's general direction, slowly.
        const desired = Math.atan2(dx, dz);
        e.heading += wrapAngle(desired - e.heading) * Math.min(1, dt * 2);
        e.mesh.rotation.y = e.heading;
        e.shootTimer = Math.max(e.shootTimer - dt * 0.5, 0.4);
        continue;
      }
      // Close in until shooting range, then strafe side to side. Walking
      // swings the legs and arms like any resident on the street.
      let moveX = 0;
      let moveZ = 0;
      if (dist > CFG.enemy.shootRange * 0.7) {
        const speed = 3.4;
        moveX = (dx / dist) * speed * dt;
        moveZ = (dz / dist) * speed * dt;
      } else {
        e.strafePhase += dt * 1.6;
        const strafe = Math.sin(e.strafePhase) * 1.6 * dt;
        moveX = (-dz / dist) * strafe;
        moveZ = (dx / dist) * strafe;
      }
      const moved = Math.hypot(moveX, moveZ);
      if (moved > 0) {
        e.walkPhase += dt * 9;
        const s = Math.sin(e.walkPhase) * 0.5;
        const u = e.mesh.userData;
        u.legL.rotation.x = s;
        u.legR.rotation.x = -s;
        u.armL.rotation.x = -s * 0.7;
        u.armR.rotation.x = s * 0.7;
        u.torso.rotation.x = 0.06;
      }
      e.x += moveX;
      e.z += moveZ;
      const fixed = resolveCircle(this.city.colliders, e.x, e.z, 0.5);
      e.x = fixed.x;
      e.z = fixed.z;
      e.heading = Math.atan2(dx, dz);
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      // Shoot on a timer, only with a clear line of fire.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < CFG.enemy.shootRange) {
        e.shootTimer = CFG.enemy.shootInterval + range(this.rng, -0.4, 0.6);
        const gx = e.x + Math.sin(e.heading) * 0.4;
        const gz = e.z + Math.cos(e.heading) * 0.4;
        this._tracer(gx, 1.35, gz, player.x, player.onFoot ? 1.2 : 0.9, player.z);
        // Armour absorbs half of the hit, when Dario wears any.
        if (player.onFoot) player.hurt(CFG.enemy.damageOnFoot);
        else player.carHealth = Math.max(0, (player.carHealth ?? 100) - CFG.enemy.damageInCar);
        if (onShotFired) onShotFired(dist);
      }
    }
    // Fade the tracers out.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
