// Solmar Bay — Neon Tide: the player. On foot Dario walks the streets; near a
// parked car, E steals it and he drives. The same module owns both modes and
// the switch between them, plus the small collision step that keeps feet and
// tyres out of the buildings.

import * as THREE from 'three';
import { CFG } from './config.js';
import { buildPersonMesh } from './models.js';
import { resolveCircle, clampToBounds } from './city.js';
import { stepCar } from './physics.js';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = buildPersonMesh();
    scene.add(this.mesh);

    this.x = 0;
    this.z = -60;
    this.heading = 0; // facing +z (south, towards the plaza)
    this.speed = 0;
    this.onFoot = true;
    this.car = null; // the parked-car record being driven, if any
    this.carSpeed = 0;
    this.carHeading = 0;
    this.walkPhase = 0;
    this.cash = CFG.startCash;
    this.stars = 0;
    this.mission = 0;
    this.health = 100;
    this.armor = 0; // body armour: absorbs half of incoming damage
    this.stamina = 100; // sprint fuel, drains on Shift, refills at rest
    this.ammo = CFG.pistol.magazine;
    this.carHealth = 100;
    this.carHealthMax = 100;
    this.reloadTimer = 0;
    this.onRam = null; // set by the main loop: a cruiser ram plays a crash
    // Weapons in slots 1-3: the pistol Dario starts with, the Squall SMG
    // (mission 2 or the gun shop) and the Breaker 12 shotgun (mission 4
    // or the gun shop). Slot 4 stays empty.
    this.weapon = 'pistol';
    this.weapons = { smg: false, shotgun: false };
    this.ammoSmg = 0;
    this.ammoShotgun = 0;
    this.fireTimer = 0; // SMG hold-to-fire cooldown
    // Progression: REP and its rank, the garage upgrades, the safehouse,
    // and the cars Dario has driven (the garage collection).
    this.rep = 0;
    this.engineLevel = 0; // 0-3, +15% speed and acceleration each
    this.armorLevel = 0; // 0-3, +50 max car health each
    this.nitro = false; // Shift for a boost while driving
    this.safehouse = false;
    this.carsStolen = 0;
    this.copsLost = 0;
    this.ownedCars = new Set();
  }

  // Damage with armour: armour absorbs half until it is gone.
  hurt(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.5);
      this.armor -= absorbed;
      this.health = Math.max(0, this.health - (amount - absorbed));
    } else {
      this.health = Math.max(0, this.health - amount);
    }
  }

  // The car's spec with the garage upgrades applied: engine levels raise
  // top speed and acceleration, and nitro (Shift) boosts both further.
  effectiveSpec(nitroActive) {
    const spec = this.car.spec;
    const engineBoost = 1 + 0.15 * this.engineLevel;
    const nitroBoost = nitroActive && this.nitro ? 1.5 : 1;
    return {
      ...spec,
      maxSpeed: spec.maxSpeed * engineBoost * nitroBoost,
      accel: spec.accel * engineBoost * nitroBoost,
    };
  }

  // Gear 1-5 from the speed, for the HUD gauge.
  gear() {
    if (this.onFoot) return this.speed > 0 ? 1 : 0;
    const spec = this.car ? this.car.spec : null;
    const top = spec ? spec.maxSpeed : 55;
    const ratio = Math.min(1, Math.abs(this.carSpeed) / top);
    return Math.abs(this.carSpeed) < 0.5 ? 0 : 1 + Math.floor(ratio * 4.99);
  }

  // Switch to a weapon slot: 1 pistol, 2 SMG, 3 shotgun. Locked slots
  // stay on the current weapon.
  selectWeapon(slot) {
    if (slot === 1) this.weapon = 'pistol';
    else if (slot === 2 && this.weapons.smg) this.weapon = 'smg';
    else if (slot === 3 && this.weapons.shotgun) this.weapon = 'shotgun';
  }

  // Ammunition of the current weapon, for the HUD.
  weaponAmmo() {
    if (this.weapon === 'smg') return this.ammoSmg;
    if (this.weapon === 'shotgun') return this.ammoShotgun;
    return this.ammo;
  }

  weaponMagazine() {
    if (this.weapon === 'smg') return CFG.smg.magazine;
    if (this.weapon === 'shotgun') return CFG.shotgun.magazine;
    return CFG.pistol.magazine;
  }

  weaponName() {
    if (this.weapon === 'smg') return CFG.smg.name.toUpperCase();
    if (this.weapon === 'shotgun') return CFG.shotgun.name.toUpperCase();
    return 'PISTOL';
  }

  spawn(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
    this.carHealth = this.carHealthMax;
    this.reloadTimer = 0;
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  // The nearest parked car within reach, if any.
  nearestCar(maxDist = 3.6) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.city.parkedCars) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car, world) {
    car.taken = true;
    this.car = car;
    this.onFoot = false;
    this.carHeading = car.heading;
    this.carSpeed = 0;
    this.carHealth = this.carHealthMax;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.mesh.visible = false;
    this.ownedCars.add(car.type);
    if (world) world.carStolen();
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.taken = false;
    this.car = null;
    this.onFoot = true;
    this.carSpeed = 0;
    // Step out to the driver's side.
    this.x = car.x + Math.cos(car.heading) * 2.2;
    this.z = car.z - Math.sin(car.heading) * 2.2;
    const fixed = clampToBounds(this.x, this.z);
    this.x = fixed.x;
    this.z = fixed.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, input, cameraYaw, world) {
    if (this.onFoot) this._updateFoot(dt, input, cameraYaw, world);
    else this._updateCar(dt, input, world);
    // Write the visible transform.
    if (this.onFoot) {
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      // A gentle walk bob while moving, with the same walk cycle the
      // residents use: legs and arms swing opposite, torso leans in.
      if (this.speed > 0) {
        this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
        const s = Math.sin(this.walkPhase) * 0.55;
        const u = this.mesh.userData;
        u.legL.rotation.x = s;
        u.legR.rotation.x = -s;
        u.armL.rotation.x = -s * 0.7;
        u.armR.rotation.x = s * 0.7;
        u.torso.rotation.x = 0.06;
      } else {
        const u = this.mesh.userData;
        const k = 0.8;
        u.legL.rotation.x *= k;
        u.legR.rotation.x *= k;
        u.armL.rotation.x *= k;
        u.armR.rotation.x *= k;
        u.torso.rotation.x *= k;
      }
    } else if (this.car) {
      this.car.mesh.position.set(this.x, 0, this.z);
      this.car.mesh.rotation.y = this.carHeading;
    }
  }

  _updateFoot(dt, input, cameraYaw, world) {
    const axes = input.axes();
    // Sprint: hold Shift to run faster, draining stamina; it refills
    // when Dario walks or stands still.
    const sprinting = input.down('ShiftLeft') && this.stamina > 0 && (axes.x !== 0 || axes.y !== 0);
    const moveSpeed = sprinting ? CFG.walkSpeed * 1.4 : CFG.walkSpeed;
    if (sprinting) this.stamina = Math.max(0, this.stamina - 20 * dt);
    else this.stamina = Math.min(100, this.stamina + 12 * dt);
    if (axes.x !== 0 || axes.y !== 0) {
      // Movement is relative to the camera: forward is where the camera looks.
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const forwardX = -sin;
      const forwardZ = -cos;
      const rightX = cos;
      const rightZ = -sin;
      let mx = forwardX * axes.y + rightX * axes.x;
      let mz = forwardZ * axes.y + rightZ * axes.x;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.x += mx * moveSpeed * dt;
      this.z += mz * moveSpeed * dt;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = lerpAngle(this.heading, targetHeading, Math.min(1, dt * 12));
      this.walkPhase += dt * (sprinting ? 12 : 9);
      this.speed = moveSpeed;
    } else {
      this.speed = 0;
    }
    const fixed = resolveCircle(this.city.colliders, this.x, this.z, CFG.playerRadius);
    this.x = fixed.x;
    this.z = fixed.z;
    const bounded = clampToBounds(this.x, this.z);
    this.x = bounded.x;
    this.z = bounded.z;

    if (input.consume('KeyE')) {
      const car = this.nearestCar();
      if (car) this.enterCar(car, world);
    }

    // Weapon slots: 1 pistol, 2 SMG, 3 shotgun. Locked slots are ignored.
    if (input.consume('Digit1')) this.selectWeapon(1);
    if (input.consume('Digit2')) this.selectWeapon(2);
    if (input.consume('Digit3')) this.selectWeapon(3);

    // Firing: the pistol and shotgun fire once per press (F or a mouse
    // click), the SMG fires while the key is held. A shot travels toward
    // where the camera looks; the world resolves the hit, the noise, the
    // fleeing pedestrians and the heat it raises.
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        if (this.weapon === 'smg') this.ammoSmg = CFG.smg.magazine;
        else if (this.weapon === 'shotgun') this.ammoShotgun = CFG.shotgun.magazine;
        else this.ammo = CFG.pistol.magazine;
      }
    }
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    const mag = this.weaponMagazine();
    const ammoNow = this.weaponAmmo();
    if (input.consume('KeyR') && ammoNow < mag && this.reloadTimer <= 0) {
      this.reloadTimer = this.weapon === 'smg' ? CFG.smg.reloadSeconds
        : this.weapon === 'shotgun' ? CFG.shotgun.reloadSeconds
        : CFG.pistol.reloadSeconds;
    }
    const wantFire = this.weapon === 'smg'
      ? (input.down('KeyF') || input.dragging) && this.fireTimer <= 0 && this.reloadTimer <= 0
      : (input.consume('KeyF') || input.consumeClick()) && this.reloadTimer <= 0;
    if (wantFire && ammoNow > 0) {
      if (this.weapon === 'smg') {
        this.ammoSmg -= 1;
        this.fireTimer = CFG.smg.fireInterval;
      } else if (this.weapon === 'shotgun') {
        this.ammoShotgun -= 1;
      } else {
        this.ammo -= 1;
      }
      const dx = -Math.sin(cameraYaw);
      const dz = -Math.cos(cameraYaw);
      if (world) world.fireShot(this.x, this.z, dx, dz, this.weapon);
    }
  }

  _updateCar(dt, input, world) {
    const nitroActive = input.down('ShiftLeft') && this.nitro;
    const spec = this.effectiveSpec(nitroActive);
    const axes = input.axes();
    // W/S: throttle and brake/reverse. S from a stop reverses.
    let throttle = 0;
    if (axes.y > 0) throttle = 1;
    else if (axes.y < 0) throttle = -1;
    if (this.carHealth <= 0) throttle = 0; // stalled: the car is wrecked
    // Space is the handbrake: scrub speed before the physics step.
    if (input.down('Space')) this.carSpeed *= Math.max(0, 1 - 3.2 * dt);

    const carState = { x: this.x, z: this.z, heading: this.carHeading, speed: this.carSpeed };
    const impact = stepCar(carState, spec, throttle, axes.x, dt, this.city.colliders);
    this.x = carState.x;
    this.z = carState.z;
    this.carHeading = carState.heading;
    this.carSpeed = carState.speed;
    this.heading = this.carHeading;
    // Keep the car record in step with the car itself: exitCar, nearestCar
    // and the mission waypoints all read car.x / car.z / car.heading, so a
    // stale record would drop the player (or the waypoint) back where the
    // car was entered instead of where it is now.
    this.car.x = this.x;
    this.car.z = this.z;
    this.car.heading = this.carHeading;

    // A hard hit hurts the car and makes a sound.
    if (impact > 15) {
      this.carHealth = Math.max(0, this.carHealth - 5);
      if (world) world.carCrashed(Math.min(1, impact / 55));
    }
    // Running a pedestrian over: they go down, and the heat rises.
    if (Math.abs(this.carSpeed) > 3 && world) {
      const hit = world.pedsHit(this.x, this.z, 1.6);
      if (hit.length > 0) this.carSpeed *= 0.6;
    }

    if (input.consume('KeyE')) this.exitCar();
  }

  // True while a reload is in progress.
  get reloading() {
    return this.reloadTimer > 0;
  }

  // Speed in miles per hour for the HUD.
  speedMph() {
    const v = this.onFoot ? this.speed : Math.abs(this.carSpeed);
    return Math.round(v * 2.23694);
  }

  vehicleName() {
    if (this.onFoot) return 'On foot';
    return this.car ? this.car.spec.name : 'On foot';
  }

  // Plain state for saving.
  snapshot() {
    return {
      cash: this.cash,
      mission: this.mission,
      stars: this.stars,
      onFoot: this.onFoot,
      carType: this.car ? this.car.type : null,
      x: this.x,
      z: this.z,
      heading: this.heading,
      rep: this.rep,
      armor: this.armor,
      weapons: { smg: this.weapons.smg, shotgun: this.weapons.shotgun },
      engineLevel: this.engineLevel,
      armorLevel: this.armorLevel,
      nitro: this.nitro,
      safehouse: this.safehouse,
      carsStolen: this.carsStolen,
      copsLost: this.copsLost,
      ownedCars: [...this.ownedCars],
    };
  }

  restore(data) {
    this.cash = data.cash ?? 0;
    this.mission = data.mission ?? 0;
    this.stars = data.stars ?? 0;
    this.health = 100;
    this.ammo = CFG.pistol.magazine;
    this.carHealthMax = 100 + 50 * (data.armorLevel ?? 0);
    this.carHealth = this.carHealthMax;
    this.rep = data.rep ?? 0;
    this.armor = data.armor ?? 0;
    this.weapons = {
      smg: data.weapons?.smg ?? false,
      shotgun: data.weapons?.shotgun ?? false,
    };
    this.ammoSmg = this.weapons.smg ? CFG.smg.magazine : 0;
    this.ammoShotgun = this.weapons.shotgun ? CFG.shotgun.magazine : 0;
    this.engineLevel = data.engineLevel ?? 0;
    this.armorLevel = data.armorLevel ?? 0;
    this.nitro = data.nitro ?? false;
    this.safehouse = data.safehouse ?? false;
    this.carsStolen = data.carsStolen ?? 0;
    this.copsLost = data.copsLost ?? 0;
    this.ownedCars = new Set(data.ownedCars ?? []);
    if (data.onFoot || !data.carType) {
      this.spawn(data.x ?? 0, data.z ?? -60, data.heading ?? 0);
      return;
    }
    const car = this.city.parkedCars.find((c) => c.type === data.carType && !c.taken);
    this.spawn(data.x ?? 0, data.z ?? -60, data.heading ?? 0);
    if (car) {
      car.x = this.x;
      car.z = this.z;
      car.heading = this.heading;
      this.enterCar(car);
    }
  }
}
