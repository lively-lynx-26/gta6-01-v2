// Solmar Bay — Neon Tide: side activities. Between story jobs Dario can
// earn on the side: taxi fares in the Bay Cab (pick up a waiting rider,
// drop them off, get paid), the Boulevard Sprint street race from the
// Marina to the Docks corner against the clock, and twelve golden shells
// hidden on the beach, each worth cash and REP. Everything is placed from
// the fixed seed, so the shells and the fare spots are the same every run.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range } from './random.js';
import { buildPedestrianMesh } from './models.js';
import { STREETS } from './traffic.js';

function streetPoint(rng) {
  const line = STREETS[Math.floor(rng() * STREETS.length)];
  const along = range(rng, -170, 170);
  if (rng() < 0.5) return { x: line + 8, z: along };
  return { x: along, z: line + 8 };
}

function markerMesh(color) {
  const geo = new THREE.OctahedronGeometry(1.1);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

export class SideActivities {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.rng = makeRng(CFG.seed + 505);
    this.time = 0;

    // --- Golden shells: twelve on the beach, fixed spots from the seed.
    this.shells = [];
    this.shellsFound = 0;
    const shellGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xffc93e, roughness: 0.25, metalness: 0.7, emissive: 0x664400, emissiveIntensity: 0.4,
    });
    for (let i = 0; i < CFG.shells; i++) {
      const x = range(this.rng, -180, 180);
      const z = range(this.rng, 196, 212);
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.position.set(x, 0.35, z);
      mesh.scale.y = 0.55;
      scene.add(mesh);
      this.shells.push({ x, z, mesh, taken: false });
    }

    // --- Taxi fares: one rider at a time, waiting on a sidewalk.
    this.fare = null; // { stage, pickup, drop, ped, marker }
    this.fareCooldown = 8; // seconds after starting before the first fare
    this.fareMarker = null;

    // --- The Boulevard Sprint: a timed run, Marina to the Docks corner.
    this.race = null; // { timeLeft }
    this.raceMarker = markerMesh(0xff5a3c);
    this.raceMarker.position.set(CFG.raceStart.x, 2.2, CFG.raceStart.z);
    scene.add(this.raceMarker);
    this.raceTargetMarker = markerMesh(0x7dff9a);
    this.raceTargetMarker.position.set(CFG.raceTarget.x, 2.2, CFG.raceTarget.z);
    scene.add(this.raceTargetMarker);
    this.raceCooldown = 0;

    // --- Stunt jumps: three ramps around the city, each with a marker.
    // Cross one fast in a car or on a bike and the jump is scored.
    this.ramps = [];
    this.bestJump = { air: 0, dist: 0 };
    for (const r of CFG.jumps) {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.6, metalness: 0.1 }),
      );
      ramp.position.set(r.x, 0.55, r.z);
      ramp.rotation.y = r.heading;
      ramp.rotation.x = -0.42;
      scene.add(ramp);
      const marker = markerMesh(0xff5a3c);
      marker.position.set(r.x, 3.4, r.z);
      scene.add(marker);
      this.ramps.push({ ...r, mesh: ramp, marker });
    }

    // --- Random events: a mugging to interrupt, a hitchhiker to drive.
    // One at a time, after the first job, on a seeded gap.
    this.event = null; // { type, ped, mugger, x, z, drop, stage, timer }
    this.eventTimer = CFG.events.firstAfter;

    // Callbacks the main loop wires up: onPay(amount, label) and
    // onRep(amount, label) for cash and REP, onPopup for floating text.
    this.onPay = null;
    this.onRep = null;
    this.onPopup = null;
  }

  // What the HUD and the map screen read.
  get fareLabel() {
    if (!this.fare) return null;
    if (this.fare.stage === 'pickup') return 'Pick up the fare';
    return 'Drop off the fare';
  }

  get raceLabel() {
    if (!this.race) return null;
    return `Boulevard Sprint — ${Math.ceil(this.race.timeLeft)}s`;
  }

  // Reset for a new game: shells return to the beach, the fare and the
  // race clear, and the cooldowns start over.
  reset() {
    for (const s of this.shells) {
      s.taken = false;
      s.mesh.visible = true;
    }
    this.shellsFound = 0;
    this._clearFare();
    this.fareCooldown = 8;
    this.race = null;
    this.raceCooldown = 0;
    this.bestJump = { air: 0, dist: 0 };
    this._clearEvent();
    this.eventTimer = CFG.events.firstAfter;
  }

  // A jump just landed: score it on distance, pay by the metre, and
  // keep the best one for the stats.
  recordJump(airTime, dist) {
    const metres = Math.round(dist);
    const pay = Math.min(CFG.jumpPayCap, Math.round(dist * CFG.jumpPayPerMetre));
    if (metres > this.bestJump.dist) this.bestJump = { air: Math.round(airTime * 10) / 10, dist: metres };
    if (this.onPay) this.onPay(pay, 'Stunt jump');
    if (this.onRep) this.onRep(CFG.repJump, 'Stunt jump');
    if (this.onPopup) {
      this.onPopup(this.player.x, 2.2, this.player.z, `STUNT JUMP ${metres}m +$${pay}`, 'stunt');
    }
  }

  // Restore shells from a save: the first `found` shells (in seed order)
  // are already collected.
  restoreShells(found) {
    for (let i = 0; i < this.shells.length; i++) {
      if (i < found) {
        this.shells[i].taken = true;
        this.shells[i].mesh.visible = false;
      }
    }
    this.shellsFound = Math.min(found, this.shells.length);
  }

  // A fare at fixed spots (the drive screenshot): a rider waits at the
  // pickup curb, the drop-off across town.
  spawnFareAt(pickupX, pickupZ, dropX, dropZ) {
    this._clearFare();
    const ped = buildPedestrianMesh({
      shirt: 0xd9a441, pants: 0x2b2f38, skin: 0x8a5a3b, hairStyle: 'short',
    });
    ped.position.set(pickupX, 0, pickupZ);
    this.scene.add(ped);
    const marker = markerMesh(0xffc93e);
    marker.position.set(pickupX, 2.4, pickupZ);
    this.scene.add(marker);
    this.fare = { stage: 'pickup', pickup: { x: pickupX, z: pickupZ }, drop: { x: dropX, z: dropZ }, ped, marker };
  }

  // Start a fare: a rider waits on a sidewalk; the drop-off is a second
  // street point across town.
  _spawnFare() {
    const pickup = streetPoint(this.rng);
    let drop = streetPoint(this.rng);
    while (Math.hypot(drop.x - pickup.x, drop.z - pickup.z) < 120) {
      drop = streetPoint(this.rng);
    }
    const ped = buildPedestrianMesh({
      shirt: 0xd9a441, pants: 0x2b2f38, skin: 0x8a5a3b, hairStyle: 'short',
    });
    ped.position.set(pickup.x, 0, pickup.z);
    this.scene.add(ped);
    const marker = markerMesh(0xffc93e);
    marker.position.set(pickup.x, 2.4, pickup.z);
    this.scene.add(marker);
    this.fare = { stage: 'pickup', pickup, drop, ped, marker };
  }

  _clearFare() {
    if (!this.fare) return;
    this.scene.remove(this.fare.ped);
    this.scene.remove(this.fare.marker);
    this.fare = null;
    this.fareCooldown = 10;
  }

  // --- Random events -------------------------------------------------------
  _clearEvent() {
    if (!this.event) return;
    if (this.event.ped) this.scene.remove(this.event.ped);
    if (this.event.mugger) this.scene.remove(this.event.mugger);
    if (this.event.marker) this.scene.remove(this.event.marker);
    this.event = null;
  }

  // Start one event: a mugging (a mugger corners a resident) or a
  // hitchhiker (a resident waving for a lift), at a street point.
  _spawnEvent() {
    const spot = streetPoint(this.rng);
    if (this.rng() < 0.5) {
      const victim = buildPedestrianMesh({
        shirt: 0xd9a441, pants: 0x2b2f38, skin: 0xc98e6b, hairStyle: 'short',
      });
      victim.position.set(spot.x, 0, spot.z);
      this.scene.add(victim);
      const mugger = buildPedestrianMesh({
        shirt: 0x1c1c22, pants: 0x222226, skin: 0x8a5a3b, hairStyle: 'short', armed: true,
      });
      mugger.position.set(spot.x + 1.5, 0, spot.z + 1);
      this.scene.add(mugger);
      this.event = { type: 'mugging', ped: victim, mugger, x: spot.x, z: spot.z, timer: 0, fled: false, fleeTimer: 0 };
    } else {
      const ped = buildPedestrianMesh({
        shirt: 0x7fd4ff, pants: 0x2b2f38, skin: 0xb98a68, hairStyle: 'short',
      });
      ped.position.set(spot.x, 0, spot.z);
      this.scene.add(ped);
      const marker = markerMesh(0x7fd4ff);
      marker.position.set(spot.x, 2.4, spot.z);
      this.scene.add(marker);
      let drop = streetPoint(this.rng);
      while (Math.hypot(drop.x - spot.x, drop.z - spot.z) < 100) {
        drop = streetPoint(this.rng);
      }
      this.event = { type: 'hitch', ped, marker, x: spot.x, z: spot.z, drop, stage: 'waiting', timer: 0, waitTimer: 0 };
    }
  }

  // One event step. A mugging pays when Dario gets close and the mugger
  // runs; a hitchhiker pays when Dario stops in a car, then drives them
  // to the drop-off.
  _updateEvent(dt) {
    const p = this.player;
    const ev = this.event;
    if (!ev) return;
    ev.timer += dt;
    if (ev.type === 'mugging') {
      if (!ev.fled) {
        // Dario shows up: the mugger runs for it.
        if (Math.hypot(p.x - ev.x, p.z - ev.z) < 8) {
          ev.fled = true;
          ev.fleeTimer = 6;
          if (this.onPay) this.onPay(CFG.events.muggingReward, 'Mugging stopped');
          if (this.onRep) this.onRep(CFG.repJump, 'Mugging stopped');
          if (this.onPopup) this.onPopup(p.x, 2.2, p.z, `MUGGING STOPPED +$${CFG.events.muggingReward}`, 'rep');
        } else if (ev.timer > 60) {
          this._clearEvent();
        }
        return;
      }
      // The mugger flees from the player, then disappears.
      const dx = ev.mugger.position.x - p.x;
      const dz = ev.mugger.position.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ev.mugger.position.x += (dx / d) * 5 * dt;
      ev.mugger.position.z += (dz / d) * 5 * dt;
      ev.fleeTimer -= dt;
      if (ev.fleeTimer <= 0) this._clearEvent();
      return;
    }
    // Hitchhiker.
    if (ev.stage === 'waiting') {
      ev.marker.rotation.y += dt * 1.5;
      ev.marker.position.y = 2.4 + Math.sin(this.time * 2.5) * 0.3;
      const inCar = !p.onFoot && p.car;
      const near = Math.hypot(p.x - ev.x, p.z - ev.z) < 5;
      if (inCar && near && Math.abs(p.carSpeed) < 1) {
        ev.waitTimer += dt;
        if (ev.waitTimer >= 1.5) {
          ev.stage = 'aboard';
          this.scene.remove(ev.ped);
          ev.ped = null;
          ev.marker.position.set(ev.drop.x, 2.4, ev.drop.z);
          if (this.onPopup) this.onPopup(p.x, 2, p.z, 'HITCHHIKER ON BOARD', 'rep');
        }
      } else {
        ev.waitTimer = 0;
      }
      if (ev.timer > 90) this._clearEvent();
      return;
    }
    // Aboard: drive them to the drop-off. Leaving the car cancels it.
    if (p.onFoot) {
      this._clearEvent();
      return;
    }
    ev.marker.rotation.y += dt * 1.5;
    if (Math.hypot(p.x - ev.drop.x, p.z - ev.drop.z) < 10) {
      if (this.onPay) this.onPay(CFG.events.hitchReward, 'Hitchhiker');
      if (this.onRep) this.onRep(CFG.repFare, 'Hitchhiker');
      if (this.onPopup) this.onPopup(p.x, 2, p.z, `HITCHHIKER +$${CFG.events.hitchReward}`, 'rep');
      this._clearEvent();
    } else if (ev.timer > 180) {
      this._clearEvent();
    }
  }

  update(dt, missionIndex) {
    this.time += dt;
    const p = this.player;

    // Stunt jumps: the ramp markers bob; crossing one fast in a car or
    // on a bike, roughly along its direction, launches the jump.
    for (const r of this.ramps) {
      r.marker.rotation.y += dt * 1.5;
      r.marker.position.y = 3.4 + Math.sin(this.time * 2 + r.x) * 0.3;
      if (p.airborne || p.onFoot || p.boat || p.flying) continue;
      const speed = Math.abs(p.carSpeed);
      if (speed < r.minSpeed) continue;
      const d = Math.hypot(p.x - r.x, p.z - r.z);
      if (d > 7) continue;
      const along = Math.sin(p.carHeading) * Math.sin(r.heading)
        + Math.cos(p.carHeading) * Math.cos(r.heading);
      if (along < 0.6) continue;
      p.startJump(8 + speed * 0.18);
    }

    // Random events: one at a time, after the first job, on a gap.
    if (missionIndex >= 1) {
      if (!this.event) {
        this.eventTimer -= dt;
        if (this.eventTimer <= 0) this._spawnEvent();
      } else {
        this._updateEvent(dt);
        if (!this.event) {
          this.eventTimer = CFG.events.gap[0] + this.rng() * (CFG.events.gap[1] - CFG.events.gap[0]);
        }
      }
    }

    // Shells bob and shine; walking or driving over one collects it.
    for (const s of this.shells) {
      if (s.taken) continue;
      s.mesh.position.y = 0.35 + Math.sin(this.time * 2 + s.x) * 0.12;
      s.mesh.rotation.y += dt * 0.8;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 2.2) {
        s.taken = true;
        s.mesh.visible = false;
        this.shellsFound += 1;
        if (this.onPay) this.onPay(CFG.shellPay, 'Golden shell');
        if (this.onRep) this.onRep(CFG.repShell, 'Golden shell');
        if (this.onPopup) this.onPopup(s.x, 1.5, s.z, `SHELL ${this.shellsFound}/12 +$${CFG.shellPay}`, 'rep');
      }
    }

    // The race markers bob; the sprint starts when Dario drives through
    // the start marker in any car (after the first job), and pays when he
    // reaches the Docks corner before the clock runs out.
    this.raceMarker.rotation.y += dt * 1.5;
    this.raceMarker.position.y = 2.2 + Math.sin(this.time * 2) * 0.3;
    this.raceTargetMarker.rotation.y += dt * 1.5;
    this.raceTargetMarker.position.y = 2.2 + Math.sin(this.time * 2 + 1) * 0.3;
    this.raceCooldown = Math.max(0, this.raceCooldown - dt);
    if (!this.race && !p.onFoot && missionIndex >= 1 && this.raceCooldown <= 0) {
      if (Math.hypot(p.x - CFG.raceStart.x, p.z - CFG.raceStart.z) < 8) {
        this.race = { timeLeft: CFG.raceTimeLimit };
        if (this.onPopup) this.onPopup(p.x, 2, p.z, 'BOULEVARD SPRINT — GO!', 'stunt');
      }
    } else if (this.race) {
      this.race.timeLeft -= dt;
      if (Math.hypot(p.x - CFG.raceTarget.x, p.z - CFG.raceTarget.z) < 10) {
        if (this.onPay) this.onPay(CFG.racePay, 'Boulevard Sprint');
        if (this.onRep) this.onRep(CFG.raceRace, 'Boulevard Sprint');
        if (this.onPopup) this.onPopup(p.x, 2, p.z, `SPRINT WON +$${CFG.racePay}`, 'rep');
        this.race = null;
        this.raceCooldown = 20;
      } else if (this.race.timeLeft <= 0) {
        this.race = null;
        this.raceCooldown = 20;
        if (this.onPopup) this.onPopup(p.x, 2, p.z, 'SPRINT FAILED — too slow', 'dmg');
      }
    }

    // Taxi fares: only in the Bay Cab, and not during the first job (it
    // already is a fare). A fare waits, Dario picks them up, then drops
    // them off across town for cash and REP.
    const inCab = !p.onFoot && p.car && p.car.type === 'cab';
    if (!this.fare) {
      this.fareCooldown -= dt;
      if (inCab && missionIndex >= 1 && this.fareCooldown <= 0) this._spawnFare();
      return;
    }
    this.fare.marker.rotation.y += dt * 1.5;
    this.fare.marker.position.y = 2.4 + Math.sin(this.time * 2.5) * 0.3;
    if (this.fare.stage === 'pickup') {
      if (inCab && Math.hypot(p.x - this.fare.pickup.x, p.z - this.fare.pickup.z) < 7) {
        this.fare.stage = 'dropoff';
        this.scene.remove(this.fare.ped);
        this.fare.marker.position.set(this.fare.drop.x, 2.4, this.fare.drop.z);
        if (this.onPopup) this.onPopup(p.x, 2, p.z, 'FARE ON BOARD', 'rep');
      }
    } else if (inCab && Math.hypot(p.x - this.fare.drop.x, p.z - this.fare.drop.z) < 9) {
      if (this.onPay) this.onPay(CFG.farePay, 'Taxi fare');
      if (this.onRep) this.onRep(CFG.repFare, 'Taxi fare');
      if (this.onPopup) this.onPopup(p.x, 2, p.z, `FARE +$${CFG.farePay}`, 'rep');
      this._clearFare();
    }
    // Leaving the cab abandons the fare.
    if (!inCab) this._clearFare();
  }
}
