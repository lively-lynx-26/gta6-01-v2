// Solmar Bay — Neon Tide: pedestrians. About twenty-six residents stroll
// the sidewalks on the road lattice, turning at intersections, sliding
// around buildings. When a gunshot goes off nearby they run from it; when
// a car hits one they go down, get up, and run. Every resident is placed
// and every decision made from the fixed city seed.

import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { buildPedestrianMesh } from './models.js';
import { resolveCircle, clampToBounds } from './physics.js';
import { STREETS } from './traffic.js';

const SHIRTS = [0xc94f4f, 0x4f7dc9, 0x5da24f, 0xd9a441, 0x8a5fc9, 0xd97fb0, 0x4fb0a5, 0xe8e4da, 0x777777, 0x2e6f8e];
const PANTS = [0x2b2f38, 0x3a3f4a, 0x5a4a38, 0x27435a, 0x4a4a4a];
const SKINS = [0xc98e6b, 0x8a5a3b, 0xe8b88a, 0x6b4226, 0xd9a077];

function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(CFG.seed + 202); // its own stream, after the city's
    this.peds = [];
    for (let i = 0; i < CFG.pedestrians; i++) {
      const vertical = this.rng() < 0.5;
      const line = pick(this.rng, STREETS);
      const along = range(this.rng, -180, 180);
      const side = pick(this.rng, [-1, 1]) * 8; // on the sidewalk
      const x = vertical ? line + side : along;
      const z = vertical ? along : line + side;
      const heading = vertical ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const mesh = buildPedestrianMesh({
        shirt: pick(this.rng, SHIRTS),
        pants: pick(this.rng, PANTS),
        skin: pick(this.rng, SKINS),
      });
      scene.add(mesh);
      const ped = {
        mesh,
        x,
        z,
        heading,
        speed: range(this.rng, CFG.pedWalkSpeed[0], CFG.pedWalkSpeed[1]),
        state: 'stroll', // stroll | flee | down
        timer: 0,
        phase: range(this.rng, 0, Math.PI * 2),
        fleeX: 0,
        fleeZ: 0,
      };
      this.peds.push(ped);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
    }
  }

  // A gunshot at (x, z): everyone nearby runs away from it.
  onGunshot(x, z) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.hypot(dx, dz);
      if (d > CFG.pedFleeRadius) continue;
      ped.state = 'flee';
      ped.timer = range(this.rng, 3, 5);
      ped.fleeX = dx / (d || 1);
      ped.fleeZ = dz / (d || 1);
    }
  }

  // A vehicle at (x, z) with the given radius: anyone it touches goes down.
  // Returns the peds it hit, so the caller can raise the wanted level.
  checkVehicleHit(x, z, radius) {
    const hit = [];
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius + 0.5) {
        ped.state = 'down';
        ped.timer = 6;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.35;
        hit.push(ped);
      }
    }
    return hit;
  }

  update(dt) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          // Get up and run from the spot.
          ped.state = 'flee';
          ped.timer = 3;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          const away = Math.atan2(ped.x, ped.z);
          ped.fleeX = Math.sin(away);
          ped.fleeZ = Math.cos(away);
        }
        continue;
      }
      let speed = ped.speed;
      let targetHeading = ped.heading;
      if (ped.state === 'flee') {
        speed = CFG.pedFleeSpeed;
        ped.timer -= dt;
        targetHeading = Math.atan2(ped.fleeX, ped.fleeZ);
        if (ped.timer <= 0) ped.state = 'stroll';
      } else {
        // Strolling: at an intersection, sometimes turn onto the cross street.
        const nearX = STREETS.some((s) => Math.abs(ped.x - s) < 2.5);
        const nearZ = STREETS.some((s) => Math.abs(ped.z - s) < 2.5);
        if (nearX && nearZ && this.rng() < dt * 0.25) {
          const vertical = Math.abs(Math.sin(ped.heading)) < 0.5;
          targetHeading = vertical
            ? pick(this.rng, [Math.PI / 2, -Math.PI / 2])
            : pick(this.rng, [0, Math.PI]);
        }
      }
      ped.heading += wrapAngle(targetHeading - ped.heading) * Math.min(1, dt * 6);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.phase += dt * (ped.state === 'flee' ? 14 : 8);
      const fixed = resolveCircle(this.city.colliders, ped.x, ped.z, 0.5);
      ped.x = fixed.x;
      ped.z = fixed.z;
      const bounded = clampToBounds(ped.x, ped.z);
      ped.x = bounded.x;
      ped.z = bounded.z;
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.04, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }
}
