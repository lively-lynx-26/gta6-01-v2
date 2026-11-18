// Solmar Bay — Neon Tide: seeded random numbers. The whole city is built from
// one fixed seed, so the layout is identical on every run and every machine.

// mulberry32: a tiny, fast, deterministic PRNG with a good distribution.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Uniform integer in [min, max] inclusive.
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of an array, uniformly.
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

// A deterministic shuffle that returns a new array.
export function shuffled(rng, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
