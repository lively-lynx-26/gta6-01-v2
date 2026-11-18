// Solmar Bay — Neon Tide: the police and the wanted system. Stars run from
// zero to five; the wanted level rises when the player steals a car, fires
// the pistol, or runs a pedestrian over, and it falls one star at a time
// when no cruiser can see the player and none is close. More stars mean
// more cruisers and more aggression: faster pursuit, harder rams. A cruiser
// chases by steering toward the player's predicted position, rams when it
// gets close, and drives off and despawns when the heat is gone. Its light
// bar flashes red and blue, and its siren is loudest up close.

import { CFG } from './config.js';
import { makeRng, range } from './random.js';
import { buildPoliceCarMesh } from './models.js';
import { stepCar, segmentBlocked, collideCircles } from './physics.js';
import { STREETS } from './traffic.js';

function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Police {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.rng = makeRng(CFG.seed + 303); // its own stream, after the city's
    this.cruisers = [];
    this.heat = 0; // fractional heat; one whole star per unit
    this.coolTimer = 0;
    this.time = 0;
  }

  // Current wanted level, zero to five.
  get stars() {
    return Math.min(5, Math.floor(this.heat));
  }

  setStars(n) {
    this.heat = Math.max(0, Math.min(5, n));
    this.coolTimer = 0;
  }

  // Add heat: stealing a car is 1, a pistol shot is 1/3, a pedestrian is 1.
  addHeat(n) {
    this.heat = Math.min(5, this.heat + n);
    this.coolTimer = 0;
  }

  // Spawn one cruiser on a street about spawnDistance from the player.
  _spawnCruiser() {
    const spec = CFG.police.cruiser;
    const mesh = buildPoliceCarMesh();
    this.scene.add(mesh);
    // Pick a street point at roughly the spawn distance, in a random
    // direction from the player.
    let x = this.player.x;
    let z = this.player.z;
    for (let tries = 0; tries < 12; tries++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = CFG.police.spawnDistance + range(this.rng, -15, 25);
      const tx = this.player.x + Math.cos(angle) * dist;
      const tz = this.player.z + Math.sin(angle) * dist;
      // Snap to the nearest street so the cruiser starts on a road.
      const sx = STREETS.reduce((a, b) => (Math.abs(b - tx) < Math.abs(a - tx) ? b : a));
      const sz = STREETS.reduce((a, b) => (Math.abs(b - tz) < Math.abs(a - tz) ? b : a));
      if (Math.abs(tx - sx) < Math.abs(tz - sz)) {
        x = sx;
        z = tz;
      } else {
        x = tx;
        z = sz;
      }
      if (Math.abs(x) <= 192 && Math.abs(z) <= 192) break;
    }
    const cruiser = {
      spec,
      mesh,
      x,
      z,
      heading: Math.atan2(this.player.x - x, this.player.z - z),
      speed: 0,
      state: 'chase', // chase | leave
      lightRed: mesh.userData.lightRed,
      lightBlue: mesh.userData.lightBlue,
      ramCooldown: 0,
    };
    this.cruisers.push(cruiser);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = cruiser.heading;
    return cruiser;
  }

  // Spawn a fixed number of cruisers in a pursuit wedge around the player
  // (for screenshot scenes): two behind, one cutting in ahead.
  spawnForShot(count) {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = -fz;
    const rz = fx;
    const offsets = [
      { f: -40, r: -12, face: p.heading },
      { f: -48, r: 12, face: p.heading },
      { f: 18, r: 11, face: p.heading + Math.PI * 0.75 },
    ];
    for (let i = 0; i < count && i < offsets.length; i++) {
      const o = offsets[i];
      const cruiser = this._spawnCruiser();
      cruiser.x = p.x + fx * o.f + rx * o.r;
      cruiser.z = p.z + fz * o.f + rz * o.r;
      cruiser.heading = o.face;
      cruiser.speed = 26;
      cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
      cruiser.mesh.rotation.y = cruiser.heading;
    }
  }

  // Remove every cruiser (a new game, or a loaded save, starts clean).
  clearCruisers() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers.length = 0;
    this.heat = 0;
    this.coolTimer = 0;
  }

  // Distance to the nearest chasing cruiser, or null when none is chasing.
  nearestCruiserDistance() {
    let best = null;
    for (const c of this.cruisers) {
      if (c.state !== 'chase') continue;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  // Can any chasing cruiser see the player (close, and no building between)?
  _anyCruiserSees() {
    for (const c of this.cruisers) {
      if (c.state !== 'chase') continue;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d > CFG.police.coolRange) continue;
      if (!segmentBlocked(this.city.colliders, this.player.x, this.player.z, c.x, c.z)) {
        return true;
      }
    }
    return false;
  }

  update(dt) {
    this.time += dt;
    const p = this.player;
    const wanted = this.stars;

    // --- Wanted level: cool off when no cruiser can see the player, one
    // star at a time. A cruiser that sees the player resets the clock.
    if (wanted > 0) {
      if (!this._anyCruiserSees()) this.coolTimer += dt;
      else this.coolTimer = 0;
      const coolTime = CFG.police.coolTime[Math.min(4, wanted - 1)];
      if (this.coolTimer >= coolTime) {
        this.heat = Math.max(0, this.heat - 1);
        this.coolTimer = 0;
      }
    } else {
      this.coolTimer = 0;
    }
    p.stars = this.stars;

    // --- Cruiser count follows the wanted level: spawn up to it, and send
    // the farthest chaser away when it drops.
    const chasers = this.cruisers.filter((c) => c.state === 'chase');
    if (wanted > chasers.length) {
      this._spawnCruiser();
    } else if (wanted === 0) {
      for (const c of this.cruisers) c.state = 'leave';
    } else if (chasers.length > wanted) {
      let farthest = chasers[0];
      let farD = -1;
      for (const c of chasers) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d > farD) {
          farD = d;
          farthest = c;
        }
      }
      farthest.state = 'leave';
    }

    // --- Cruiser behaviour.
    const playerSpeed = p.onFoot ? p.speed : Math.abs(p.carSpeed);
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const c = this.cruisers[i];
      c.ramCooldown = Math.max(0, c.ramCooldown - dt);
      if (c.state === 'leave') {
        // Drive away from the player, then despawn.
        const away = Math.atan2(c.x - p.x, c.z - p.z);
        const steer = -Math.max(-1, Math.min(1, wrapAngle(away - c.heading) * 2));
        stepCar(c, c.spec, 1, steer, dt, this.city.colliders);
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d > CFG.police.despawnDistance) {
          this.scene.remove(c.mesh);
          this.cruisers.splice(i, 1);
        }
        continue;
      }
      // Chase: steer toward where the player will be, faster and harder
      // as the stars climb.
      const aggression = 0.7 + wanted * 0.12;
      const predict = Math.min(1.2, playerSpeed * 0.06);
      const tx = p.x + Math.sin(p.heading) * playerSpeed * predict;
      const tz = p.z + Math.cos(p.heading) * playerSpeed * predict;
      const desired = Math.atan2(tx - c.x, tz - c.z);
      const steer = -Math.max(-1, Math.min(1, wrapAngle(desired - c.heading) * 2.4 * aggression));
      const maxSpeed = Math.min(c.spec.maxSpeed, 26 + wanted * 4.5);
      const capped = { ...c.spec, maxSpeed };
      const throttle = c.speed < maxSpeed ? 1 : 0;
      const impact = stepCar(c, capped, throttle, steer, dt, this.city.colliders);
      if (impact > 18 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.5;
      }
      // Ram: close to the player's car, shove it and hurt it.
      if (!p.onFoot && p.car) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < CFG.police.ramDistance && c.speed > 8 && c.ramCooldown <= 0) {
          c.ramCooldown = 1.2;
          p.carSpeed *= 0.72;
          p.carHealth = Math.max(0, (p.carHealth ?? 100) - CFG.police.ramDamage);
          const pushX = (p.x - c.x) / (d || 1);
          const pushZ = (p.z - c.z) / (d || 1);
          p.x += pushX * 1.4;
          p.z += pushZ * 1.4;
          if (p.onRam) p.onRam();
        }
        collideCircles(c, p, CFG.carRadius, CFG.carRadius);
      }
      // Flash the light bar: red and blue alternate.
      const flash = Math.sin(this.time * 11) > 0;
      if (c.lightRed && c.lightBlue) {
        c.lightRed.material.emissiveIntensity = flash ? 2.2 : 0.15;
        c.lightBlue.material.emissiveIntensity = flash ? 0.15 : 2.2;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    // Cruisers also keep out of each other's way.
    for (let i = 0; i < this.cruisers.length; i++) {
      for (let j = i + 1; j < this.cruisers.length; j++) {
        collideCircles(this.cruisers[i], this.cruisers[j], CFG.carRadius, CFG.carRadius);
      }
    }
  }
}
