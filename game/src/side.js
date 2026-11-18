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

  update(dt, missionIndex) {
    this.time += dt;
    const p = this.player;

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
