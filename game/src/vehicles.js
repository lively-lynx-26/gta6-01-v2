// Solmar Bay — Neon Tide: the other vehicles. Two boats (a speedboat in
// the Marina basin, a jet ski off the beach) and the flyable civilian
// helicopter on the helipad at the east end of the beach. This module owns
// the world objects — their meshes, the helipad, the wake a boat leaves —
// while the player owns the driving state (boat, flying, altitude) and
// the physics steps live in physics.js.

import * as THREE from 'three';
import { CFG } from './config.js';
import { buildBoatMesh, buildHeliMesh } from './models.js';
import { WATER } from './physics.js';

function flat(color, roughness = 0.95) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

// The nearest shore point for a boat that is being left: the closest edge
// of the Marina basin, or the beach for the open ocean.
export function shoreFor(boat) {
  if (boat.water === 'marina') {
    const edges = [
      { x: 146, z: boat.z },
      { x: 194, z: boat.z },
      { x: boat.x, z: -63 },
      { x: boat.x, z: 15 },
    ];
    let best = edges[0];
    let bestD = Infinity;
    for (const e of edges) {
      const d = Math.hypot(e.x - boat.x, e.z - boat.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
  return { x: boat.x, z: 212 }; // the beach, south of the city
}

export class Vehicles {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.time = 0;

    // --- The helipad: a dark circle on the sand with a yellow ring and
    // an H, at the east end of the beach by the Marina.
    const pad = CFG.helipad;
    const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius, 0.18, 32), flat(0x3a3f45));
    padMesh.position.set(pad.x, 0.09, pad.z);
    scene.add(padMesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(pad.radius - 0.7, pad.radius - 0.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xffc93e, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, 0.19, pad.z);
    scene.add(ring);
    const hMat = new THREE.MeshBasicMaterial({ color: 0xffc93e });
    const hLeft = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 5.4), hMat);
    hLeft.position.set(pad.x - 1.6, 0.19, pad.z);
    scene.add(hLeft);
    const hRight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 5.4), hMat);
    hRight.position.set(pad.x + 1.6, 0.19, pad.z);
    scene.add(hRight);
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.9), hMat);
    hBar.position.set(pad.x, 0.19, pad.z);
    scene.add(hBar);

    // --- Boats: the speedboat moored just off the Marina quay, the jet
    // ski in the surf off the beach.
    this.boats = [];
    const boatSpots = [
      { type: 'speedboat', x: 150, z: -24, heading: 0, water: 'marina' },
      { type: 'jetski', x: 44, z: 218, heading: 0, water: 'ocean' },
    ];
    for (const spot of boatSpots) {
      const spec = CFG.boats[spot.type];
      const mesh = buildBoatMesh(spot.type, spec.color);
      mesh.position.set(spot.x, 0.05, spot.z);
      mesh.rotation.y = spot.heading;
      scene.add(mesh);
      this.boats.push({
        type: spot.type, spec, mesh,
        x: spot.x, z: spot.z, heading: spot.heading, speed: 0,
        water: spot.water, rect: WATER[spot.water], taken: false,
      });
    }

    // --- The flyable helicopter, parked on the helipad.
    const heliSpec = CFG.heli;
    const heliMesh = buildHeliMesh(heliSpec.color, heliSpec.stripe);
    heliMesh.position.set(pad.x, 0, pad.z);
    heliMesh.rotation.y = Math.PI / 2;
    scene.add(heliMesh);
    this.heli = {
      type: 'maverick', spec: heliSpec, mesh: heliMesh,
      x: pad.x, z: pad.z, heading: Math.PI / 2,
      y: 0, vx: 0, vz: 0, vy: 0, taken: false,
    };
    this.rotorAngle = 0;

    // --- Wake: a pool of flat foam rings that bloom and fade behind a
    // moving boat. Plain circle meshes, no textures needed.
    this.wakePool = [];
    const wakeGeo = new THREE.CircleGeometry(1, 12);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      });
      const mesh = new THREE.Mesh(wakeGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.12;
      mesh.visible = false;
      scene.add(mesh);
      this.wakePool.push({ mesh, age: 0, life: 1.2, active: false });
    }
    this.wakeTimer = 0;
  }

  // The nearest free boat within reach, if any.
  nearestBoat(x, z, maxDist = 6) {
    let best = null;
    let bestD = maxDist;
    for (const boat of this.boats) {
      if (boat.taken) continue;
      const d = Math.hypot(boat.x - x, boat.z - z);
      if (d < bestD) {
        bestD = d;
        best = boat;
      }
    }
    return best;
  }

  // The helicopter, when it is parked on the helipad and within reach.
  nearestHeli(x, z, maxDist = 4.5) {
    if (this.heli.taken) return null;
    const d = Math.hypot(this.heli.x - x, this.heli.z - z);
    return d < maxDist ? this.heli : null;
  }

  // One step: boats bob on the water, the wake blooms behind a moving
  // boat, and the helicopter follows the player's flight (or sits on its
  // pad, rotors still).
  update(dt) {
    this.time += dt;
    const p = this.player;
    for (const boat of this.boats) {
      const bob = Math.sin(this.time * 1.5 + boat.x * 0.3) * 0.05;
      boat.mesh.position.set(boat.x, 0.05 + bob, boat.z);
      boat.mesh.rotation.y = boat.heading;
      // A boat under way rolls a little into its turns.
      const roll = boat === p.boat ? -p.boatSteer * 0.06 * Math.min(1, Math.abs(boat.speed) / 20) : 0;
      boat.mesh.rotation.z = roll;
    }
    // Wake: a new ring at the stern every 0.09 s while the boat moves.
    if (p.boat && Math.abs(p.boat.speed) > 3) {
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.09;
        const ring = this.wakePool.find((r) => !r.active);
        if (ring) {
          const bx = Math.sin(p.boat.heading);
          const bz = Math.cos(p.boat.heading);
          ring.mesh.position.set(p.boat.x - bx * 2.6, 0.12, p.boat.z - bz * 2.6);
          ring.age = 0;
          ring.active = true;
          ring.mesh.visible = true;
        }
      }
    }
    for (const ring of this.wakePool) {
      if (!ring.active) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const s = 0.7 + t * 2.4;
      ring.mesh.scale.set(s, s, 1);
      ring.mesh.material.opacity = 0.4 * (1 - t);
    }
    // The helicopter: parked on its pad, or following the player's
    // flight with its rotors spinning and its nose pitched forward.
    const h = this.heli;
    if (p.flying) {
      h.mesh.position.set(p.x, p.altitude, p.z);
      h.mesh.rotation.y = p.heading;
      const hSpeed = Math.hypot(h.vx, h.vz);
      h.mesh.rotation.x = Math.min(0.14, hSpeed * 0.003);
      this.rotorAngle += dt * 22;
    } else {
      h.mesh.position.set(h.x, 0, h.z);
      h.mesh.rotation.y = h.heading;
      h.mesh.rotation.x = 0;
      this.rotorAngle += dt * 0.6; // a slow idle turn on the pad
    }
    h.mesh.userData.rotor.rotation.y = this.rotorAngle;
    h.mesh.userData.tailRotor.rotation.x = this.rotorAngle * 1.7;
  }
}
