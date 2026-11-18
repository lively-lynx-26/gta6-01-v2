// Solmar Bay — Neon Tide: the player. On foot Dario walks the streets; near a
// parked car, E steals it and he drives. The same module owns both modes and
// the switch between them, plus the small collision step that keeps feet and
// tyres out of the buildings.

import * as THREE from 'three';
import { CFG } from './config.js';
import { buildPersonMesh } from './models.js';
import { resolveCircle, clampToBounds } from './city.js';

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
    this.ammo = 12;
  }

  spawn(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
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

  enterCar(car) {
    car.taken = true;
    this.car = car;
    this.onFoot = false;
    this.carHeading = car.heading;
    this.carSpeed = 0;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.mesh.visible = false;
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

  update(dt, input, cameraYaw) {
    if (this.onFoot) this._updateFoot(dt, input, cameraYaw);
    else this._updateCar(dt, input);
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

  _updateFoot(dt, input, cameraYaw) {
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
      if (car) this.enterCar(car);
    }
  }

  _updateCar(dt, input) {
    const spec = this.car.spec;
    const axes = input.axes();
    // W/S: throttle and brake/reverse. S from a stop reverses.
    if (axes.y > 0) {
      this.carSpeed += spec.accel * dt;
    } else if (axes.y < 0) {
      if (this.carSpeed > 0.5) this.carSpeed -= spec.accel * 1.6 * dt; // brake
      else this.carSpeed -= spec.accel * 0.55 * dt; // reverse
    }
    // Space is the handbrake.
    if (input.down('Space')) this.carSpeed *= Math.max(0, 1 - 3.2 * dt);
    // Drag and rolling resistance, then clamp to the car's limits.
    this.carSpeed -= this.carSpeed * 0.55 * dt;
    if (this.carSpeed > spec.maxSpeed) this.carSpeed = spec.maxSpeed;
    if (this.carSpeed < -spec.reverseSpeed) this.carSpeed = -spec.reverseSpeed;
    if (Math.abs(this.carSpeed) < 0.08 && axes.y === 0) this.carSpeed = 0;

    // Steering: sharper at low speed, steadier at high speed.
    const steerAuthority = 1 / (1 + Math.abs(this.carSpeed) * 0.045);
    const turnRate = spec.turn * steerAuthority * (this.carSpeed >= 0 ? 1 : -1);
    this.carHeading += -axes.x * turnRate * dt * Math.min(1, Math.abs(this.carSpeed) / 4 + 0.25);

    const fx = Math.sin(this.carHeading);
    const fz = Math.cos(this.carHeading);
    this.x += fx * this.carSpeed * dt;
    this.z += fz * this.carSpeed * dt;
    this.heading = this.carHeading;

    const fixed = resolveCircle(this.city.colliders, this.x, this.z, CFG.carRadius);
    if (fixed.hit) {
      this.carSpeed *= 0.35; // a thud, not a stop
      this.x = fixed.x;
      this.z = fixed.z;
    }
    const bounded = clampToBounds(this.x, this.z);
    if (bounded.x !== this.x || bounded.z !== this.z) {
      this.carSpeed *= 0.5;
      this.x = bounded.x;
      this.z = bounded.z;
    }

    if (input.consume('KeyE')) this.exitCar();
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
    this.ammo = 12;
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
