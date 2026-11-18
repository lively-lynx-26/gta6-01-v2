// Solmar Bay — Neon Tide: the small custom physics engine, written from
// scratch in this session — no physics library is vendored. It owns car
// movement (an arcade bicycle model: throttle, drag, speed-sensitive
// steering), collision of circles with the city's building boxes, circle
// against circle for cars and people, staying on the ground, and a line-of-
// sight test the police use to decide whether they can still see the player.
// Frame time is clamped by the caller so no step ever exceeds CFG.maxDt.

import { CFG } from './config.js';

// Keep a position inside the playable area: the city and the beach, not the
// open ocean.
export function clampToBounds(x, z) {
  return {
    x: Math.max(-200, Math.min(200, x)),
    z: Math.max(-200, Math.min(214, z)),
  };
}

// Push a circle (x, z, radius) out of every building box it overlaps.
// Returns the corrected position and whether any collision happened.
export function resolveCircle(colliders, x, z, radius) {
  let hit = false;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    let dx = x - cx;
    let dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      x += dx * push;
      z += dz * push;
    } else {
      // Centre inside the box: push out along the smallest penetration.
      const left = x - b.minX;
      const right = b.maxX - x;
      const top = z - b.minZ;
      const bottom = b.maxZ - z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.minX - radius;
      else if (m === right) x = b.maxX + radius;
      else if (m === top) z = b.minZ - radius;
      else z = b.maxZ + radius;
    }
  }
  return { x, z, hit };
}

// Push two circles apart (cars, or a car and a person). Both move half the
// overlap, and the function reports how deep the overlap was.
export function collideCircles(a, b, radiusA, radiusB) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  const min = radiusA + radiusB;
  if (d2 >= min * min || d2 < 1e-9) return 0;
  const d = Math.sqrt(d2);
  const overlap = min - d;
  const pushX = (dx / d) * (overlap / 2);
  const pushZ = (dz / d) * (overlap / 2);
  a.x -= pushX;
  a.z -= pushZ;
  b.x += pushX;
  b.z += pushZ;
  return overlap;
}

// The ground is flat: the city, the beach and the piers all sit at y = 0,
// and nothing in the world lets a car or a person leave it. This function is
// the one place that answers "how high is the ground here", so a later chunk
// can add hills or ramps without touching the callers.
export function groundHeight(x, z) {
  return 0;
}

// True when a building box blocks the straight line between two points on
// the ground (sampled every two metres, each sample tested against the
// boxes expanded by half a metre).
export function segmentBlocked(colliders, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    for (const b of colliders) {
      if (x >= b.minX - 0.5 && x <= b.maxX + 0.5 && z >= b.minZ - 0.5 && z <= b.maxZ + 0.5) {
        return true;
      }
    }
  }
  return false;
}

// The nearest other car ahead of a moving car, within maxDist and inside a
// narrow forward cone. Traffic uses it to brake for the car in front.
export function carAhead(cars, self, maxDist) {
  const fx = Math.sin(self.heading);
  const fz = Math.cos(self.heading);
  let best = null;
  let bestD = maxDist;
  for (const other of cars) {
    if (other === self) continue;
    const dx = other.x - self.x;
    const dz = other.z - self.z;
    const d = Math.hypot(dx, dz);
    if (d >= bestD || d < 0.01) continue;
    const along = (dx * fx + dz * fz) / d;
    if (along < 0.82) continue; // outside the forward cone
    bestD = d;
    best = other;
  }
  return best ? { car: best, dist: bestD } : null;
}

// One step of the arcade car model. `car` carries x, z, heading and speed;
// `spec` is a CFG.cars entry; throttle is -1..1 (reverse..forward) and
// steer is -1..1 (left..right). The car accelerates, drags, steers less at
// high speed, slides around building boxes (losing speed on a hard hit),
// and stays inside the playable bounds. `grip` (1 = dry, lower = wet)
// scales acceleration and steering authority, so rain makes the car
// slide. Returns the impact speed when a building was hit, else 0.
export function stepCar(car, spec, throttle, steer, dt, colliders, grip = 1) {
  const before = car.speed;
  const accel = spec.accel * (0.55 + 0.45 * grip);
  if (throttle > 0) {
    car.speed += accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= accel * 1.6 * -throttle * dt; // brake
    else car.speed -= accel * 0.55 * -throttle * dt; // reverse
  }
  car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
  if (car.speed > spec.maxSpeed) car.speed = spec.maxSpeed;
  if (car.speed < -spec.reverseSpeed) car.speed = -spec.reverseSpeed;
  if (Math.abs(car.speed) < 0.08 && throttle === 0) car.speed = 0;

  // Steering: sharper at low speed, steadier at high speed, weaker when
  // the road is wet.
  const steerAuthority = (1 / (1 + Math.abs(car.speed) * 0.045)) * (0.6 + 0.4 * grip);
  const turnRate = spec.turn * steerAuthority * (car.speed >= 0 ? 1 : -1);
  car.heading += -steer * turnRate * dt * Math.min(1, Math.abs(car.speed) / 4 + 0.25);

  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  let impact = 0;
  const fixed = resolveCircle(colliders, car.x, car.z, CFG.carRadius);
  if (fixed.hit) {
    impact = Math.abs(before);
    car.speed *= 0.35; // a thud, not a stop
    car.x = fixed.x;
    car.z = fixed.z;
  }
  const clampedX = Math.max(-200, Math.min(200, car.x));
  const clampedZ = Math.max(-200, Math.min(214, car.z));
  if (clampedX !== car.x || clampedZ !== car.z) {
    car.speed *= 0.5;
    car.x = clampedX;
    car.z = clampedZ;
  }
  return impact;
}

// One step of the bike model. A bike is the same bicycle model as a car,
// but it accelerates harder, steers sharper, leans into turns, and gets
// twitchy at high speed: above ~70% of top speed the steering wobbles a
// little, so holding a straight line at full throttle takes work. Returns
// { impact, lean } — lean is the visual roll in radians (negative leans
// left into a left turn), used by the mesh.
export function stepBike(bike, spec, throttle, steer, dt, colliders, grip = 1) {
  const before = bike.speed;
  const accel = spec.accel * (0.55 + 0.45 * grip);
  if (throttle > 0) {
    bike.speed += accel * throttle * dt;
  } else if (throttle < 0) {
    if (bike.speed > 0.5) bike.speed -= accel * 1.6 * -throttle * dt;
    else bike.speed -= accel * 0.55 * -throttle * dt;
  }
  bike.speed -= bike.speed * 0.5 * dt;
  if (bike.speed > spec.maxSpeed) bike.speed = spec.maxSpeed;
  if (bike.speed < -spec.reverseSpeed) bike.speed = -spec.reverseSpeed;
  if (Math.abs(bike.speed) < 0.08 && throttle === 0) bike.speed = 0;

  // Sharper steering than a car, and a high-speed wobble: the heading
  // drifts a little side to side when the bike is flat out. The wobble
  // is a sine of the distance travelled, so it is deterministic.
  const steerAuthority = (1 / (1 + Math.abs(bike.speed) * 0.03)) * (0.6 + 0.4 * grip);
  const turnRate = spec.turn * steerAuthority * (bike.speed >= 0 ? 1 : -1);
  bike.heading += -steer * turnRate * dt * Math.min(1, Math.abs(bike.speed) / 4 + 0.25);
  const speedFrac = Math.abs(bike.speed) / spec.maxSpeed;
  if (speedFrac > 0.7) {
    const wobble = (speedFrac - 0.7) * 0.9 * Math.sin((bike.x + bike.z) * 0.35);
    bike.heading += wobble * dt;
  }
  // Lean: proportional to the steering input and the speed, up to ~0.5 rad.
  const lean = -steer * 0.5 * Math.min(1, Math.abs(bike.speed) / 18) * (bike.speed >= 0 ? 1 : -1);

  bike.x += Math.sin(bike.heading) * bike.speed * dt;
  bike.z += Math.cos(bike.heading) * bike.speed * dt;

  let impact = 0;
  const fixed = resolveCircle(colliders, bike.x, bike.z, CFG.bikeRadius);
  if (fixed.hit) {
    impact = Math.abs(before);
    bike.speed *= 0.3;
    bike.x = fixed.x;
    bike.z = fixed.z;
  }
  const clampedX = Math.max(-200, Math.min(200, bike.x));
  const clampedZ = Math.max(-200, Math.min(214, bike.z));
  if (clampedX !== bike.x || clampedZ !== bike.z) {
    bike.speed *= 0.5;
    bike.x = clampedX;
    bike.z = clampedZ;
  }
  return { impact, lean };
}

// Water a boat may sail in: the Marina basin, or the open ocean south of
// the beach. A boat stays in its own water.
export const WATER = {
  marina: { x0: 148, x1: 192, z0: -61, z1: 13 },
  ocean: { x0: -200, x1: 200, z0: 200, z1: 400 },
};

// True when a point is over open water (the Marina basin or the ocean).
export function isWater(x, z) {
  if (z >= 216) return true;
  return x >= 147 && x <= 193 && z >= -62 && z <= 14;
}

// One step of the boat model. Boats have no brakes and no buildings to
// hit: they accelerate, drag through the water, turn more slowly than a
// car, and drift a little sideways in a turn. `water` is the WATER rect
// the boat belongs to; a boat that reaches the edge of its water slows
// to a stop instead of beaching itself.
export function stepBoat(boat, spec, throttle, steer, dt, water) {
  if (throttle > 0) {
    boat.speed += spec.accel * throttle * dt;
  } else if (throttle < 0) {
    if (boat.speed > 0.5) boat.speed -= spec.accel * 1.4 * -throttle * dt;
    else boat.speed -= spec.accel * 0.5 * -throttle * dt;
  }
  boat.speed -= boat.speed * 0.85 * dt; // water drag is heavy
  if (boat.speed > spec.maxSpeed) boat.speed = spec.maxSpeed;
  if (boat.speed < -spec.reverseSpeed) boat.speed = -spec.reverseSpeed;
  if (Math.abs(boat.speed) < 0.08 && throttle === 0) boat.speed = 0;

  const steerAuthority = 1 / (1 + Math.abs(boat.speed) * 0.03);
  const turnRate = spec.turn * steerAuthority * (boat.speed >= 0 ? 1 : -1);
  boat.heading += -steer * turnRate * dt * Math.min(1, Math.abs(boat.speed) / 4 + 0.25);

  boat.x += Math.sin(boat.heading) * boat.speed * dt;
  boat.z += Math.cos(boat.heading) * boat.speed * dt;

  // The water's edge: stop at the shore instead of driving onto land.
  const cx = Math.max(water.x0, Math.min(water.x1, boat.x));
  const cz = Math.max(water.z0, Math.min(water.z1, boat.z));
  if (cx !== boat.x || cz !== boat.z) {
    boat.speed *= 0.4;
    boat.x = cx;
    boat.z = cz;
  }
}

// One step of the flyable helicopter. `heli` carries x, z, y (altitude),
// heading, vx, vz and vy. W/S flies forward and back along the heading,
// A/D yaws, Shift climbs and Space descends. The helicopter drifts with
// momentum, drags in the air, cannot leave the city, cannot land on
// water (it holds at 2 m over water), and cannot descend through a
// building: over a building its floor is the roof plus a margin.
// `colliders` carry `h` (building height) where known. Returns nothing.
export function stepHeli(heli, spec, forward, yaw, climb, dt, colliders) {
  const fx = Math.sin(heli.heading);
  const fz = Math.cos(heli.heading);
  // Forward / back thrust along the heading.
  heli.vx += fx * forward * spec.accel * dt;
  heli.vz += fz * forward * spec.accel * dt;
  // Vertical thrust.
  heli.vy += climb * spec.climbSpeed * dt * 0.9;
  // Air drag on every axis, plus gravity settling the hover.
  heli.vx -= heli.vx * 0.9 * dt;
  heli.vz -= heli.vz * 0.9 * dt;
  heli.vy -= heli.vy * 1.6 * dt;
  heli.vy -= 1.2 * dt; // a helicopter sinks gently without power
  // Yaw.
  heli.heading += -yaw * spec.turn * 0.55 * dt;
  // Cap the horizontal speed.
  const hSpeed = Math.hypot(heli.vx, heli.vz);
  if (hSpeed > spec.maxSpeed) {
    heli.vx *= spec.maxSpeed / hSpeed;
    heli.vz *= spec.maxSpeed / hSpeed;
  }
  if (heli.vy > spec.climbSpeed) heli.vy = spec.climbSpeed;
  if (heli.vy < -spec.climbSpeed) heli.vy = -spec.climbSpeed;

  heli.x += heli.vx * dt;
  heli.z += heli.vz * dt;
  heli.y += heli.vy * dt;

  // Stay over the city and the beach, under the ceiling.
  heli.x = Math.max(-200, Math.min(200, heli.x));
  heli.z = Math.max(-200, Math.min(214, heli.z));
  if (heli.y > spec.ceiling) {
    heli.y = spec.ceiling;
    heli.vy = Math.min(0, heli.vy);
  }
  // The floor: the ground, a roof plus a margin when over a building,
  // or 2 m over water. Landing is a soft touch: kill the descent.
  let floor = 0;
  if (isWater(heli.x, heli.z)) floor = 2;
  for (const b of colliders) {
    if (b.h && heli.x >= b.minX && heli.x <= b.maxX && heli.z >= b.minZ && heli.z <= b.maxZ) {
      floor = Math.max(floor, b.h + 1.5);
    }
  }
  if (heli.y <= floor) {
    heli.y = floor;
    if (heli.vy < 0) heli.vy = 0;
  }
}
