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
// and stays inside the playable bounds. Returns the impact speed when a
// building was hit, else 0.
export function stepCar(car, spec, throttle, steer, dt, colliders) {
  const before = car.speed;
  if (throttle > 0) {
    car.speed += spec.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= spec.accel * 1.6 * -throttle * dt; // brake
    else car.speed -= spec.accel * 0.55 * -throttle * dt; // reverse
  }
  car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
  if (car.speed > spec.maxSpeed) car.speed = spec.maxSpeed;
  if (car.speed < -spec.reverseSpeed) car.speed = -spec.reverseSpeed;
  if (Math.abs(car.speed) < 0.08 && throttle === 0) car.speed = 0;

  // Steering: sharper at low speed, steadier at high speed.
  const steerAuthority = 1 / (1 + Math.abs(car.speed) * 0.045);
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
