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
    this.ammo = CFG.pistol.magazine;
    this.carHealth = 100;
    this.reloadTimer = 0;
    this.onRam = null; // set by the main loop: a cruiser ram plays a crash
  }

  spawn(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
    this.carHealth = 100;
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
    this.carHealth = 100;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.mesh.visible = false;
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
      // A gentle walk bob while moving.
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
    } else if (this.car) {
      this.car.mesh.position.set(this.x, 0, this.z);
      this.car.mesh.rotation.y = this.carHeading;
    }
  }

  _updateFoot(dt, input, cameraYaw, world) {
    const axes = input.axes();
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
      this.x += mx * CFG.walkSpeed * dt;
      this.z += mz * CFG.walkSpeed * dt;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = lerpAngle(this.heading, targetHeading, Math.min(1, dt * 12));
      this.walkPhase += dt * 9;
      this.speed = CFG.walkSpeed;
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

    // The pistol: F or a mouse click fires, R reloads. A shot travels
    // toward where the camera looks; the world resolves the hit, the
    // noise, the fleeing pedestrians and the heat it raises.
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = CFG.pistol.magazine;
    }
    if (input.consume('KeyR') && this.ammo < CFG.pistol.magazine && this.reloadTimer <= 0) {
      this.reloadTimer = CFG.pistol.reloadSeconds;
    }
    const wantFire = (input.consume('KeyF') || input.consumeClick()) && this.reloadTimer <= 0;
    if (wantFire && this.ammo > 0) {
      this.ammo -= 1;
      const dx = -Math.sin(cameraYaw);
      const dz = -Math.cos(cameraYaw);
      if (world) world.fireShot(this.x, this.z, dx, dz);
    }
  }

  _updateCar(dt, input, world) {
    const spec = this.car.spec;
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
    };
  }

  restore(data) {
    this.cash = data.cash ?? 0;
    this.mission = data.mission ?? 0;
    this.stars = data.stars ?? 0;
    this.health = 100;
    this.ammo = CFG.pistol.magazine;
    this.carHealth = 100;
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
