// Solmar Bay — Neon Tide: traffic. About twelve civilian cars cruise the
// road lattice — the streets run on a 48-metre grid — following waypoints
// from intersection to intersection, turning left, right or straight on,
// braking for the car ahead and for the player's car. Every car is placed
// and every turn decided from the fixed city seed, so the traffic is the
// same at the start of every run.

import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { buildCarMesh } from './models.js';
import { resolveCircle, carAhead, stepCar } from './physics.js';

// Street centrelines, both directions: the streets between the blocks.
export const STREETS = [-192, -144, -96, -48, 0, 48, 96, 144, 192];

function wrapAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(CFG.seed + 101); // its own stream, after the city's
    this.cars = [];
    // Two cars work the Marina and two work the Docks, so those districts
    // have their own traffic: cabs by the basin, delivery vans and a
    // hauler at the warehouses. The rest roam the whole city.
    const zones = ['marina', 'marina', 'docks', 'docks'];
    const zoneTypes = { marina: ['cab', 'sedan'], docks: ['van', 'hauler'] };
    const types = ['sedan', 'sedan', 'sedan', 'van', 'sedan', 'cab', 'van', 'sedan', 'comet', 'sedan', 'van', 'sedan'];
    for (let i = 0; i < CFG.trafficCars; i++) {
      const zone = zones[i] || null;
      const type = zone ? zoneTypes[zone][i % 2] : types[i % types.length];
      const spec = CFG.cars[type];
      // Start at a random intersection, heading down a random street — in
      // the car's own district when it has one.
      const ix = zone === 'marina' ? pick(this.rng, [144, 192])
        : zone === 'docks' ? pick(this.rng, [-96, -48, 0, 48, 96])
        : pick(this.rng, STREETS);
      const iz = zone === 'marina' ? pick(this.rng, [-72, -24, 24])
        : zone === 'docks' ? pick(this.rng, [144, 192])
        : pick(this.rng, STREETS);
      const heading = pick(this.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      const mesh = buildCarMesh(spec.body, spec.color, type);
      scene.add(mesh);
      const car = {
        type,
        spec,
        mesh,
        x: ix,
        z: iz,
        heading,
        speed: range(this.rng, 6, 10),
        cruise: zone === 'docks' ? range(this.rng, 6, 9)
          : zone === 'marina' ? range(this.rng, 7, 11)
          : range(this.rng, 8, 14),
        waypoint: null,
        zone,
      };
      car.waypoint = this._nextWaypoint(car);
      this.cars.push(car);
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
    }
  }

  // The next intersection after this one: straight on most of the time,
  // a turn either way sometimes, never off the edge of the city.
  _nextWaypoint(car) {
    const cur = car.waypoint ? car.waypoint.grid : { x: car.x, z: car.z };
    // Snap the current grid point to the nearest street lines.
    const gx = STREETS.reduce((a, b) => (Math.abs(b - cur.x) < Math.abs(a - cur.x) ? b : a));
    const gz = STREETS.reduce((a, b) => (Math.abs(b - cur.z) < Math.abs(a - cur.z) ? b : a));
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const straight = { x: gx + Math.round(fx) * 48, z: gz + Math.round(fz) * 48 };
    const left = { x: gx + Math.round(fz) * 48, z: gz + Math.round(-fx) * 48 };
    const right = { x: gx + Math.round(-fz) * 48, z: gz + Math.round(fx) * 48 };
    const inside = (p) => p.x >= -192 && p.x <= 192 && p.z >= -192 && p.z <= 192;
    const options = [];
    if (inside(straight)) for (let i = 0; i < 6; i++) options.push(straight);
    if (inside(left)) for (let i = 0; i < 2; i++) options.push(left);
    if (inside(right)) for (let i = 0; i < 2; i++) options.push(right);
    if (options.length === 0) {
      // At a corner with nowhere to go but back: turn around.
      return { x: gx - Math.round(fx) * 48, z: gz - Math.round(fz) * 48, grid: { x: gx - Math.round(fx) * 48, z: gz - Math.round(fz) * 48 } };
    }
    // A district car stays in its district: keep only the turns inside
    // its streets, falling back to the whole city when none is.
    if (car.zone) {
      const inZone = car.zone === 'marina'
        ? (p) => p.x >= 144 && p.x <= 192 && p.z >= -72 && p.z <= 24
        : (p) => p.x >= -96 && p.x <= 96 && p.z >= 144 && p.z <= 192;
      const zoned = options.filter(inZone);
      if (zoned.length > 0) options.splice(0, options.length, ...zoned);
    }
    const pickPoint = pick(this.rng, options);
    // Drive on the right-hand side of the road: offset the waypoint by
    // three metres to the right of the direction of travel.
    const dx = pickPoint.x - gx;
    const dz = pickPoint.z - gz;
    const len = Math.hypot(dx, dz) || 1;
    const rx = -dz / len;
    const rz = dx / len;
    return { x: pickPoint.x + rx * 3, z: pickPoint.z + rz * 3, grid: pickPoint };
  }

  // One step. `playerCar` is the player's car ({x, z, heading, speed}) or
  // null when the player is on foot; traffic brakes for it too.
  update(dt, playerCar) {
    for (const car of this.cars) {
      const wx = car.waypoint.x;
      const wz = car.waypoint.z;
      const dx = wx - car.x;
      const dz = wz - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.waypoint = this._nextWaypoint(car);
        continue;
      }
      const desired = Math.atan2(dx, dz);
      // stepCar steers with a negative sign (as the player's D key does),
      // so the steering input is the negative of the heading error.
      const steer = -Math.max(-1, Math.min(1, wrapAngle(desired - car.heading) * 2.2));
      // Brake for the car ahead — another traffic car, or the player's.
      let target = car.cruise;
      const ahead = carAhead(this.cars, car, 11);
      if (ahead && ahead.dist < 9) target = Math.min(target, Math.max(0, ahead.car.speed * 0.7));
      if (playerCar) {
        const px = playerCar.x - car.x;
        const pz = playerCar.z - car.z;
        const pd = Math.hypot(px, pz);
        if (pd < 10) {
          const fx = Math.sin(car.heading);
          const fz = Math.cos(car.heading);
          if ((px * fx + pz * fz) / (pd || 1) > 0.8) {
            target = Math.min(target, Math.max(0, Math.abs(playerCar.speed) * 0.7));
            if (pd < 5.5) target = 0;
          }
        }
      }
      const throttle = car.speed < target ? 1 : 0;
      stepCar(car, car.spec, throttle, steer, dt, this.city.colliders);
      // Traffic never reverses and never exceeds its cruise speed.
      if (car.speed < 0) car.speed = 0;
      if (car.speed > car.cruise) car.speed = car.cruise;
      const fixed = resolveCircle(this.city.colliders, car.x, car.z, CFG.carRadius);
      car.x = fixed.x;
      car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // Keep the cars from overlapping each other at intersections.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 4.6 * 4.6 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (4.6 - d) / 2 / d;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
        }
      }
    }
  }
}
