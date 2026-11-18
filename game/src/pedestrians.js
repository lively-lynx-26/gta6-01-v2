// Solmar Bay — Neon Tide: pedestrians. About twenty-six residents stroll
// the sidewalks on the road lattice, turning at intersections, waiting at
// curbs, pausing in pairs to chat — and walking like people: legs and arms
// swing opposite, the body bobs and leans, every gait a little different.
// When a gunshot goes off nearby they run from it; when a car hits one they
// go down, get up, and run. Every resident is placed and every decision made
// from the fixed city seed.

import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { buildPedestrianMesh } from './models.js';
import { resolveCircle, clampToBounds } from './physics.js';
import { STREETS } from './traffic.js';

const SHIRTS = [0xc94f4f, 0x4f7dc9, 0x5da24f, 0xd9a441, 0x8a5fc9, 0xd97fb0, 0x4fb0a5, 0xe8e4da, 0x777777, 0x2e6f8e];
const PANTS = [0x2b2f38, 0x3a3f4a, 0x5a4a38, 0x27435a, 0x4a4a4a];
const SKINS = [0xc98e6b, 0x8a5a3b, 0xe8b88a, 0x6b4226, 0xd9a077];
const HAIRSTYLES = ['cap', 'short', 'long', 'bun', 'none'];

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
        hairStyle: pick(this.rng, HAIRSTYLES),
        height: range(this.rng, CFG.pedHeight[0], CFG.pedHeight[1]),
      });
      scene.add(mesh);
      const ped = {
        mesh,
        x,
        z,
        heading,
        speed: range(this.rng, CFG.pedWalkSpeed[0], CFG.pedWalkSpeed[1]),
        stride: range(this.rng, CFG.pedStride[0], CFG.pedStride[1]),
        gait: range(this.rng, CFG.pedGait[0], CFG.pedGait[1]),
        state: 'stroll', // stroll | wait | chat | flee | down
        timer: 0,
        phase: range(this.rng, 0, Math.PI * 2),
        fleeX: 0,
        fleeZ: 0,
        chatPartner: null,
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
      ped.chatPartner = null;
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
        this._resetLimbs(ped);
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.35;
        ped.chatPartner = null;
        hit.push(ped);
      }
    }
    return hit;
  }

  // Straighten every limb and the torso: a body at rest, or one lying down.
  _resetLimbs(ped) {
    const u = ped.mesh.userData;
    u.legL.rotation.x = 0;
    u.legR.rotation.x = 0;
    u.armL.rotation.x = 0;
    u.armR.rotation.x = 0;
    u.torso.rotation.x = 0;
    u.head.rotation.x = 0;
    u.head.rotation.y = 0;
  }

  // Ease the limbs back toward rest (standing still, chatting, waiting).
  _easeLimbs(ped, dt) {
    const k = Math.max(0, 1 - dt * 8);
    const u = ped.mesh.userData;
    u.legL.rotation.x *= k;
    u.legR.rotation.x *= k;
    u.armL.rotation.x *= k;
    u.armR.rotation.x *= k;
    u.torso.rotation.x *= k;
  }

  // The walk cycle: legs swing opposite, arms swing opposite to the legs,
  // the torso leans into the step and the body bobs. `swing` is the leg
  // amplitude in radians; `lean` the forward torso lean.
  _walkCycle(ped, swing, lean) {
    const s = Math.sin(ped.phase) * swing;
    const u = ped.mesh.userData;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.7;
    u.armR.rotation.x = s * 0.7;
    u.torso.rotation.x = lean;
    return Math.abs(Math.sin(ped.phase)) * 0.04;
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
      if (ped.state === 'chat') {
        // Standing with a neighbour, talking: small head nods, one hand
        // gesturing now and then, feet planted.
        ped.timer -= dt;
        ped.phase += dt * 2.5;
        const u = ped.mesh.userData;
        u.head.rotation.x = Math.sin(ped.phase) * 0.08;
        u.armL.rotation.x = -0.4 + Math.sin(ped.phase * 1.3) * 0.12;
        u.armR.rotation.x = 0;
        u.legL.rotation.x = 0;
        u.legR.rotation.x = 0;
        if (ped.timer <= 0) {
          ped.state = 'stroll';
          ped.chatPartner = null;
          u.head.rotation.x = 0;
          u.armL.rotation.x = 0;
        }
        ped.mesh.position.set(ped.x, 0, ped.z);
        continue;
      }
      if (ped.state === 'wait') {
        // Waiting at the curb before crossing: looking left, then right.
        ped.timer -= dt;
        ped.phase += dt * 1.5;
        this._easeLimbs(ped, dt);
        ped.mesh.userData.head.rotation.y = Math.sin(ped.phase) * 0.6;
        if (ped.timer <= 0) {
          ped.state = 'stroll';
          ped.mesh.userData.head.rotation.y = 0;
        }
        ped.mesh.position.set(ped.x, 0, ped.z);
        continue;
      }

      let speed = ped.speed;
      let targetHeading = ped.heading;
      let bob = 0;
      if (ped.state === 'flee') {
        speed = CFG.pedFleeSpeed;
        ped.timer -= dt;
        targetHeading = Math.atan2(ped.fleeX, ped.fleeZ);
        ped.phase += dt * 14 * ped.gait;
        bob = this._walkCycle(ped, ped.stride * 1.25, 0.14);
        if (ped.timer <= 0) ped.state = 'stroll';
      } else {
        // Strolling: at an intersection, sometimes wait at the curb, sometimes
        // turn onto the cross street, sometimes stop to chat with a neighbour.
        // "At an intersection" is judged on the axis the ped walks along: a
        // ped on a sidewalk is eight metres off its street line, so testing
        // both axes against the street lines would never fire at all.
        const movingVertical = Math.abs(Math.sin(ped.heading)) < 0.5;
        const alongCoord = movingVertical ? ped.z : ped.x;
        const atIntersection = STREETS.some((s) => Math.abs(alongCoord - s) < 2.5);
        if (atIntersection && this.rng() < dt * 0.05) {
          ped.state = 'wait';
          ped.timer = range(this.rng, 2, 3.5);
          ped.mesh.position.set(ped.x, 0, ped.z);
          continue;
        }
        if (atIntersection && this.rng() < dt * 0.06) {
          targetHeading = movingVertical
            ? pick(this.rng, [Math.PI / 2, -Math.PI / 2])
            : pick(this.rng, [0, Math.PI]);
        }
        // A neighbour close by on the sidewalk: stop and chat a while.
        for (const other of this.peds) {
          if (other === ped || other.state !== 'stroll') continue;
          if (Math.hypot(other.x - ped.x, other.z - ped.z) > 1.8) continue;
          if (this.rng() >= dt * 0.06) continue;
          const t = range(this.rng, 4, 7);
          ped.state = 'chat';
          ped.timer = t;
          ped.chatPartner = other;
          ped.heading = Math.atan2(other.x - ped.x, other.z - ped.z);
          other.state = 'chat';
          other.timer = t;
          other.chatPartner = ped;
          other.heading = Math.atan2(ped.x - other.x, ped.z - other.z);
          ped.mesh.rotation.y = ped.heading;
          other.mesh.rotation.y = other.heading;
          ped.mesh.position.set(ped.x, 0, ped.z);
          break;
        }
        if (ped.state !== 'stroll') continue;
        ped.phase += dt * 8 * ped.gait;
        bob = this._walkCycle(ped, ped.stride, 0.06);
      }
      ped.heading += wrapAngle(targetHeading - ped.heading) * Math.min(1, dt * 6);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      const fixed = resolveCircle(this.city.colliders, ped.x, ped.z, 0.5);
      ped.x = fixed.x;
      ped.z = fixed.z;
      const bounded = clampToBounds(ped.x, ped.z);
      ped.x = bounded.x;
      ped.z = bounded.z;
      ped.mesh.position.set(ped.x, bob, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }
}
