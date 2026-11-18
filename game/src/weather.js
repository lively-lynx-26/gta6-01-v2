// Solmar Bay — Neon Tide: the living sky. The clock drives a full
// day/night cycle — dawn, noon, sunset, night — and the weather rotates
// through clear, cloudy, rain and storm on a seeded schedule. At night
// the street lamps and the player's headlights come on (the headlight
// itself lives in main.js; this module reports how dark it is), rain
// falls in a sheet around the player and slickens the roads (lower
// grip), and storms flash lightning. Everything is driven by the fixed
// seed, so the same game minute always renders the same sky.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';

// Sky keyframes, one per time of day. The sun position is a world
// position; night uses the same light as moonlight, low and cool.
const KEYS = [
  { hour: 0, top: 0x0a1428, horizon: 0x1a2a44, sun: 0x8fa8d8, sunI: 0.35, sunPos: [60, 220, -80], hemiSky: 0x2a3a55, hemiGround: 0x1a1a22, hemiI: 0.35, fog: 0x141c2c },
  { hour: 5, top: 0x0a1428, horizon: 0x1a2a44, sun: 0x8fa8d8, sunI: 0.35, sunPos: [60, 220, -80], hemiSky: 0x2a3a55, hemiGround: 0x1a1a22, hemiI: 0.35, fog: 0x141c2c },
  { hour: 6.5, top: 0x7a9fd0, horizon: 0xffb27a, sun: 0xffc27a, sunI: 1.6, sunPos: [220, 40, 60], hemiSky: 0x9fb0d0, hemiGround: 0x8a7a6a, hemiI: 0.7, fog: 0xe8c9a8 },
  { hour: 8, top: 0x3a86e8, horizon: 0xcfe8f5, sun: 0xfff2cf, sunI: 2.4, sunPos: [200, 160, 40], hemiSky: 0xbfd9ff, hemiGround: 0x8a7a5f, hemiI: 1.0, fog: 0xd8e8f2 },
  { hour: 12, top: 0x2f7fe0, horizon: 0xbfe3f5, sun: 0xfff2cf, sunI: 2.6, sunPos: [140, 200, 80], hemiSky: 0xbfd9ff, hemiGround: 0x8a7a5f, hemiI: 1.05, fog: 0xcfe6f2 },
  { hour: 16, top: 0x2f7fe0, horizon: 0xcfe3f5, sun: 0xfff2cf, sunI: 2.6, sunPos: [-60, 170, 120], hemiSky: 0xbfd9ff, hemiGround: 0x8a7a5f, hemiI: 1.05, fog: 0xcfe6f2 },
  { hour: 18, top: 0x2a4d8f, horizon: 0xff9a52, sun: 0xffb45e, sunI: 2.2, sunPos: [-160, 70, 60], hemiSky: 0x8f9fd0, hemiGround: 0x7a5a3f, hemiI: 0.9, fog: 0xe8b98a },
  { hour: 19.5, top: 0x2a3a6a, horizon: 0xd86a7a, sun: 0xff8a5a, sunI: 1.2, sunPos: [-220, 30, 40], hemiSky: 0x6a7aa0, hemiGround: 0x5a4a3f, hemiI: 0.6, fog: 0x8a6a7a },
  { hour: 20.5, top: 0x0a1428, horizon: 0x1a2a44, sun: 0x8fa8d8, sunI: 0.35, sunPos: [60, 220, -80], hemiSky: 0x2a3a55, hemiGround: 0x1a1a22, hemiI: 0.35, fog: 0x141c2c },
  { hour: 24, top: 0x0a1428, horizon: 0x1a2a44, sun: 0x8fa8d8, sunI: 0.35, sunPos: [60, 220, -80], hemiSky: 0x2a3a55, hemiGround: 0x1a1a22, hemiI: 0.35, fog: 0x141c2c },
];

// How much each condition greys and darkens the sky, and its grip.
const CONDITION = {
  clear: { grey: 0, sunMul: 1, hemiMul: 1, grip: 1.0 },
  cloudy: { grey: 0.35, sunMul: 0.7, hemiMul: 0.9, grip: 0.9 },
  rain: { grey: 0.5, sunMul: 0.45, hemiMul: 0.8, grip: 0.72 },
  storm: { grey: 0.6, sunMul: 0.3, hemiMul: 0.7, grip: 0.68 },
};

const LABELS = { clear: '☀ CLEAR', cloudy: '☁ CLOUDY', rain: '☂ RAIN', storm: '⚡ STORM' };

export class Weather {
  constructor({ scene, skyMat, sun, hemi, clouds, groundMat }) {
    this.scene = scene;
    this.skyMat = skyMat;
    this.sun = sun;
    this.hemi = hemi;
    this.groundMat = groundMat;
    this.rng = makeRng(CFG.seed + 777);
    this.condition = 'clear';
    this.timer = 240; // first change after four minutes of play
    this.darkness = 0; // 0 = day, 1 = night
    this.flash = 0; // lightning flash, seconds left
    this.flashTimer = 8;
    this.rainTime = 0;

    // Stars: a dome of points, visible only at night.
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    const srng = makeRng(CFG.seed + 778);
    for (let i = 0; i < starCount; i++) {
      const a = srng() * Math.PI * 2;
      const e = 0.12 + srng() * 0.75; // elevation above the horizon
      const r = 700;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Rain: 900 drops in a box that follows the player. Drops fall at a
    // fixed speed and wrap to the top of the box, so the rain is
    // deterministic for a given elapsed time.
    const dropCount = 900;
    this.dropCount = dropCount;
    this.dropPos = new Float32Array(dropCount * 3);
    const drng = makeRng(CFG.seed + 779);
    for (let i = 0; i < dropCount; i++) {
      this.dropPos[i * 3] = (drng() - 0.5) * 60;
      this.dropPos[i * 3 + 1] = drng() * 30;
      this.dropPos[i * 3 + 2] = (drng() - 0.5) * 60;
    }
    const dropGeo = new THREE.BufferGeometry();
    dropGeo.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0x9fb8cc, size: 0.14, transparent: true, opacity: 0.55, depthWrite: false,
    });
    this.rain = new THREE.Points(dropGeo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // Street lamps along the two main avenues, outside the plaza disc.
    this.lampBulbs = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7, metalness: 0.4 });
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 8);
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.2);
    const bulbGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const lampSpots = [];
    for (const z of [-144, -96, -48, 48, 96, 144]) lampSpots.push([7.5, z, 0]);
    for (const x of [-144, -96, -48, 48, 96, 144]) lampSpots.push([x, -7.5, 1]);
    for (const [x, z, alongX] of lampSpots) {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3;
      lamp.add(pole);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(alongX ? 0 : 0.5, 5.9, alongX ? -0.5 : 0);
      lamp.add(arm);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfff2b0, emissive: 0xffd970, emissiveIntensity: 0.15, roughness: 0.3,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(alongX ? 0 : 1.0, 5.8, alongX ? -1.0 : 0);
      lamp.add(bulb);
      lamp.position.set(x, 0, z);
      scene.add(lamp);
      this.lampBulbs.push(bulbMat);
    }

    // The clouds share one material: tint it with the weather and the dark.
    this.cloudMat = clouds.length > 0 ? clouds[0].children[0].material : null;
    this._top = new THREE.Color();
    this._horizon = new THREE.Color();
    this._sun = new THREE.Color();
    this._hemiSky = new THREE.Color();
    this._hemiGround = new THREE.Color();
    this._fog = new THREE.Color();
    this._grey = new THREE.Color(0x8a94a0);
    this._white = new THREE.Color(0xffffff);
    this._ca = new THREE.Color();
    this._cb = new THREE.Color();
  }

  // The HUD label for the current weather.
  label() {
    return LABELS[this.condition];
  }

  get gripFactor() {
    return CONDITION[this.condition].grip;
  }

  // Test seam (and a debug hook): force a condition for a while.
  force(condition, seconds = 120) {
    if (CONDITION[condition]) {
      this.condition = condition;
      this.timer = seconds;
    }
  }

  _nextCondition() {
    const r = this.rng();
    if (this.condition === 'clear') return r < 0.6 ? 'cloudy' : 'clear';
    if (this.condition === 'cloudy') return r < 0.5 ? 'rain' : 'clear';
    if (this.condition === 'rain') return r < 0.35 ? 'storm' : 'cloudy';
    return 'cloudy'; // storm always breaks into cloud
  }

  // One step. `gameMinutes` is the in-game clock.
  update(dt, px, pz, gameMinutes) {
    // Weather rotation.
    this.timer -= dt;
    if (this.timer <= 0) {
      this.condition = this._nextCondition();
      const [lo, hi] = CFG.weather.durations[this.condition];
      this.timer = range(this.rng, lo, hi);
    }
    const cond = CONDITION[this.condition];

    // Sky palette for this hour, interpolated between keyframes.
    const hour = ((gameMinutes % 1440) + 1440) % 1440 / 60;
    let a = KEYS[0];
    let b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (hour >= KEYS[i].hour && hour <= KEYS[i + 1].hour) {
        a = KEYS[i];
        b = KEYS[i + 1];
        break;
      }
    }
    const span = Math.max(1e-6, b.hour - a.hour);
    const t = Math.max(0, Math.min(1, (hour - a.hour) / span));
    const lerpHex = (out, aHex, bHex) => {
      this._ca.setHex(aHex);
      this._cb.setHex(bHex);
      out.lerpColors(this._ca, this._cb, t);
    };
    lerpHex(this._top, a.top, b.top);
    lerpHex(this._horizon, a.horizon, b.horizon);
    lerpHex(this._sun, a.sun, b.sun);
    lerpHex(this._hemiSky, a.hemiSky, b.hemiSky);
    lerpHex(this._hemiGround, a.hemiGround, b.hemiGround);
    lerpHex(this._fog, a.fog, b.fog);
    const sunI = (a.sunI + (b.sunI - a.sunI) * t) * cond.sunMul;
    const hemiI = (a.hemiI + (b.hemiI - a.hemiI) * t) * cond.hemiMul;
    const sunPos = [
      a.sunPos[0] + (b.sunPos[0] - a.sunPos[0]) * t,
      a.sunPos[1] + (b.sunPos[1] - a.sunPos[1]) * t,
      a.sunPos[2] + (b.sunPos[2] - a.sunPos[2]) * t,
    ];
    // Grey the sky out when the weather turns.
    if (cond.grey > 0) {
      this._top.lerp(this._grey, cond.grey * 0.7);
      this._horizon.lerp(this._grey, cond.grey * 0.7);
      this._fog.lerp(this._grey, cond.grey * 0.6);
    }
    // Lightning: a brief flash of the whole sky during storms.
    let flashStrength = 0;
    if (this.condition === 'storm') {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash = 0.16;
        this.flashTimer = 6 + this.rng() * 8;
      }
    }
    if (this.flash > 0) {
      this.flash -= dt;
      flashStrength = Math.max(0, this.flash) / 0.16;
      this._horizon.lerp(this._white, flashStrength * 0.5);
    }
    this.skyMat.uniforms.top.value.copy(this._top);
    this.skyMat.uniforms.horizon.value.copy(this._horizon);
    this.sun.color.copy(this._sun);
    this.sun.intensity = sunI + flashStrength * 2.0;
    this.sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
    this.hemi.color.copy(this._hemiSky);
    this.hemi.groundColor.copy(this._hemiGround);
    this.hemi.intensity = hemiI + flashStrength * 1.5;
    this.scene.fog.color.copy(this._fog);

    // How dark it is: 0 by day, 1 deep at night.
    this.darkness = Math.max(0, Math.min(1, (0.9 - hemiI) / 0.55));
    this.starMat.opacity = this.darkness * 0.9;
    for (const bulb of this.lampBulbs) {
      bulb.emissiveIntensity = 0.15 + this.darkness * 2.4;
    }
    if (this.cloudMat) {
      this.cloudMat.color.setHex(0xffffff);
      this.cloudMat.color.lerp(this._grey, cond.grey * 0.5 + this.darkness * 0.45);
      this.cloudMat.opacity = 0.92 - this.darkness * 0.35;
    }
    // Wet roads: darker and shinier asphalt while it rains.
    if (this.groundMat) {
      const wet = this.condition === 'rain' || this.condition === 'storm' ? 1
        : this.condition === 'cloudy' ? 0.25 : 0;
      const shade = 1 - wet * 0.35;
      this.groundMat.color.setRGB(shade, shade, shade);
      this.groundMat.roughness = 0.95 - wet * 0.45;
    }

    // Rain: the sheet follows the player and falls around them.
    const raining = this.condition === 'rain' || this.condition === 'storm';
    this.rain.visible = raining;
    if (raining) {
      this.rainTime += dt;
      this.rain.position.set(px, 0, pz);
      const fall = 28 * dt;
      const slant = -2.5 * dt;
      for (let i = 0; i < this.dropCount; i++) {
        let y = this.dropPos[i * 3 + 1] - fall;
        let x = this.dropPos[i * 3] + slant;
        if (y < 0) y += 30;
        if (x < -30) x += 60;
        this.dropPos[i * 3] = x;
        this.dropPos[i * 3 + 1] = y;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}
