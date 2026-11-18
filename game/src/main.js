// Solmar Bay — Neon Tide: the main loop. Sets up the renderer, the sky, the
// sun and the city, runs the menu / playing / paused states, follows the
// player with a third-person camera, and renders the four screenshot scenes
// deterministically when asked through ?shot=.

import * as THREE from 'three';
import { CFG } from './config.js';
import { Input } from './input.js';
import { hasSave, saveGame, loadGame } from './save.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { SHOTS } from './shots.js';
import { animateWater } from './shaders.js';
import { AudioEngine } from './audio.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Enemies } from './enemies.js';
import { Missions } from './missions.js';
import { Minimap } from './minimap.js';
import { DamageSmoke, MuzzleFlash } from './effects.js';
import { Helicopter } from './helicopter.js';
import { Radio } from './radio.js';
import { Dialogue } from './dialogue.js';
import { ResponsePanel } from './response.js';
import { Garage } from './garage.js';
import { SideActivities } from './side.js';
import { CityMap } from './map.js';
import { Popups } from './popups.js';
import { repTier, repProgress } from './rep.js';
import { districtAt } from './districts.js';
import { Vehicles } from './vehicles.js';
import { Weather } from './weather.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shot = shotName && SHOTS[shotName] ? SHOTS[shotName] : null;

// --- Renderer, scene, camera -------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CFG.sky.fog, CFG.sky.fogNear, CFG.sky.fogFar);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Sky: a gradient dome, golden sun, soft hemisphere light ----------------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color(CFG.sky.top) },
    horizon: { value: new THREE.Color(CFG.sky.horizon) },
  },
  vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main() { float h = normalize(vPos).y; float t = smoothstep(-0.05, 0.45, h); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16), skyMat);
skyDome.renderOrder = -1;
skyDome.frustumCulled = false;
scene.add(skyDome);

const sun = new THREE.DirectionalLight(CFG.sky.sun, CFG.sky.sunIntensity);
sun.position.set(140, 200, 80);
scene.add(sun);
const hemi = new THREE.HemisphereLight(CFG.sky.hemiSky, CFG.sky.hemiGround, CFG.sky.hemiIntensity);
scene.add(hemi);

// --- Clouds: flattened white spheres, drifting slowly -----------------------
const clouds = [];
{
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const positions = [
    [-160, 120, -140, 1.4], [-40, 135, -180, 1.8], [90, 110, -120, 1.2], [170, 128, -40, 1.6],
    [-180, 118, 40, 1.1], [30, 142, 60, 1.9], [150, 115, 120, 1.3], [-90, 130, 160, 1.5],
    [-20, 108, -60, 1.0], [110, 138, -160, 1.4], [-140, 122, 100, 1.2], [60, 125, 170, 1.5],
  ];
  for (const [x, y, z, s] of positions) {
    const group = new THREE.Group();
    for (const [ox, oy, oz, r] of [[0, 0, 0, 9], [9, -1, 2, 6.5], [-8, -1, -2, 7], [3, 2, -3, 5.5]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.y = 0.42;
      group.add(puff);
    }
    group.position.set(x, y, z);
    group.scale.setScalar(s);
    scene.add(group);
    clouds.push(group);
  }
}

// --- Birds: small dark V shapes circling high over the plaza -----------------
const birds = [];
{
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1e2a33, fog: false });
  for (let i = 0; i < 7; i++) {
    const bird = new THREE.Group();
    const wingGeo = new THREE.BoxGeometry(1.1, 0.06, 0.28);
    const left = new THREE.Mesh(wingGeo, birdMat);
    left.position.x = -0.55;
    left.rotation.z = 0.5;
    const right = new THREE.Mesh(wingGeo, birdMat);
    right.position.x = 0.55;
    right.rotation.z = -0.5;
    bird.add(left);
    bird.add(right);
    scene.add(bird);
    birds.push({ mesh: bird, radius: 55 + i * 7, height: 78 + (i % 3) * 9, phase: (i / 7) * Math.PI * 2, speed: 0.05 + (i % 3) * 0.012 });
  }
}

function animateSky(time) {
  for (const cloud of clouds) {
    cloud.position.x += 0.008;
    if (cloud.position.x > 240) cloud.position.x = -240;
  }
  for (const bird of birds) {
    const a = bird.phase + time * bird.speed;
    bird.mesh.position.set(Math.cos(a) * bird.radius, bird.height + Math.sin(time * 0.7 + bird.phase) * 2, Math.sin(a) * bird.radius - 30);
    bird.mesh.rotation.y = -a;
  }
}

// --- World -------------------------------------------------------------------
const el = (id) => document.getElementById(id);
const city = buildCity(scene);
const player = new Player(scene, city);
const input = new Input(window);
const traffic = new Traffic(scene, city);
const pedestrians = new Pedestrians(scene, city);
const police = new Police(scene, city, player);
const enemies = new Enemies(scene, city);
const missions = new Missions(scene, city, player, police, enemies);
const audio = new AudioEngine();
const helicopter = new Helicopter(scene);
const radio = new Radio();
const dialogue = new Dialogue(el('hud-dialogue'));
const response = new ResponsePanel(el('hud-response-list'));
const garage = new Garage(el('garage-overlay'), player, police, audio);
const side = new SideActivities(scene, city, player);
const cityMap = new CityMap(el('map-overlay'));
const popups = new Popups(el('hud-popups'));
const muzzle = new MuzzleFlash(scene);
// Boats, the flyable helicopter and the helipad; the day/night cycle
// and the weather. The player learns about the vehicles here.
const vehicles = new Vehicles(scene, city, player);
player.vehicles = vehicles;
const weather = new Weather({ scene, skyMat, sun, hemi, clouds, groundMat: city.groundMat });

// The player's headlight: one spotlight that follows the car or bike
// after dark, so night driving reads.
const headlight = new THREE.SpotLight(0xfff2b0, 0, 45, 0.55, 0.5, 1);
headlight.target = new THREE.Object3D();
scene.add(headlight);
scene.add(headlight.target);

// The clock: Friday 17:24 at the start, one game minute per real second.
let gameMinutes = CFG.clock.startMinutes;
let currentDistrict = null; // name of the district Dario stands in
let districtTimer = 0; // seconds left on the district name card
let nearMissCooldown = 0; // seconds until another near-miss can pay
let driftTime = 0; // seconds of continuous handbrake sliding
let driftPaid = false; // this slide already paid out
let safehouseSaved = false; // saved once per safehouse visit

// Dialogue and REP hooks: missions brief through Rosa, Vince and
// dispatch, and job pay also pays respect (shown as a popup).
missions.onLine = (name, text, portrait) => dialogue.show(name, text, portrait);
missions.onRep = (amount, label) => {
  popups.spawn(player.x, 2.6, player.z, `+${amount} REP — ${label}`, 'rep');
};
side.onPay = (amount, label) => {
  player.cash += amount;
  audio.pickup();
};
side.onRep = (amount, label) => {
  player.rep += amount;
};
side.onPopup = (x, y, z, text, cls) => popups.spawn(x, y, z, text, cls);

// Golden hour: the sunset palette for the chase screenshot — warm sky,
// low sun, long light. The day palette stays the default everywhere else.
function applyGoldenHour() {
  skyMat.uniforms.top.value.setHex(CFG.golden.top);
  skyMat.uniforms.horizon.value.setHex(CFG.golden.horizon);
  sun.color.setHex(CFG.golden.sun);
  sun.intensity = CFG.golden.sunIntensity;
  sun.position.set(-160, 70, 60);
  hemi.color.setHex(CFG.golden.hemiSky);
  hemi.groundColor.setHex(CFG.golden.hemiGround);
  hemi.intensity = CFG.golden.hemiIntensity;
  scene.fog.color.setHex(CFG.golden.fog);
}

function formatClock(minutes) {
  const total = Math.floor(minutes) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${CFG.clock.day} ${hh}:${mm}`;
}

// The world the player acts on: a gunshot is heard, makes pedestrians flee
// and raises the heat; stealing a car raises the heat; a crash makes a
// sound; a car that hits a pedestrian knocks them down and raises the heat.
const world = {
  fireShot(x, z, dx, dz, weapon = 'pistol') {
    let hit = null;
    let heat = CFG.pistol.heatPerShot;
    if (weapon === 'smg') {
      hit = enemies.shootAt(x, z, dx, dz, CFG.smg.damage, CFG.smg.range, 1);
      heat = CFG.smg.heatPerShot;
    } else if (weapon === 'shotgun') {
      hit = enemies.shootAt(x, z, dx, dz, CFG.shotgun.damage, CFG.shotgun.range, CFG.shotgun.pellets);
      heat = CFG.shotgun.heatPerShot;
    } else {
      hit = enemies.shootAt(x, z, dx, dz);
    }
    audio.gunshot(1);
    // The muzzle flash at the gun, in the direction of the shot.
    muzzle.showAt(x + dx * 0.9, 1.35, z + dz * 0.9);
    pedestrians.onGunshot(x, z);
    police.addHeat(heat);
    if (hit) {
      popups.spawn(hit.enemy.x, 1.9, hit.enemy.z, `-${hit.damage}`, 'dmg', camera);
      if (hit.killed) {
        player.rep += CFG.repTakedown;
        popups.spawn(hit.enemy.x, 2.5, hit.enemy.z, `TAKEDOWN +${CFG.repTakedown} REP`, 'rep', camera);
      }
    }
  },
  carStolen() {
    police.addHeat(1);
    player.carsStolen += 1;
  },
  carCrashed(strength) {
    audio.crash(strength);
  },
  pedsHit(x, z, radius) {
    const hit = pedestrians.checkVehicleHit(x, z, radius);
    for (const ped of hit) police.addHeat(1);
    return hit;
  },
};
player.onRam = () => audio.crash(0.7);

// Audio unlocks on the first gesture (a browser rule), and M mutes.
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

// --- HUD and menus ------------------------------------------------------------
const hud = el('hud');
const menuEl = el('menu');
const pauseEl = el('pause');
const btnNew = el('btn-new');
const btnContinue = el('btn-continue');
const btnResume = el('btn-resume');
const btnQuit = el('btn-quit');

let state = 'menu'; // menu | playing | paused | shot
let cameraYaw = Math.PI;
let cameraPitch = -0.3;
let cameraDistance = 8;
// Screenshot scenes carry their own HUD text; live play reads it from the
// missions (title, objective, banner), so these two only serve shot mode.
let shotTitle = 'Free roam';
let shotObjective = 'Explore Solmar Bay';
let skyTime = 0;
let lastStars = 0; // for the wanted sting when the heat climbs
let lastBanner = null; // for the mission sting when a job pays out

const minimap = new Minimap(el('hud-minimap'));
const damageSmoke = new DamageSmoke(scene);
const gaugeCtx = el('hud-gauge').getContext('2d');

// The speedometer gauge: a 240-degree arc around the speed, filling with
// speed, with the gear in the middle.
function drawGauge() {
  const c = gaugeCtx;
  const w = 110;
  const h = 110;
  c.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const r = 46;
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  const top = player.onFoot ? CFG.walkSpeed : (player.car ? player.car.spec.maxSpeed : 55);
  const frac = Math.min(1, (player.onFoot ? player.speed : Math.abs(player.carSpeed)) / top);
  c.lineWidth = 7;
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.beginPath();
  c.arc(cx, cy, r, start, start + sweep);
  c.stroke();
  c.strokeStyle = frac > 0.85 ? '#ff5a3c' : '#7dff9a';
  c.beginPath();
  c.arc(cx, cy, r, start, start + sweep * frac);
  c.stroke();
  const gear = player.gear();
  c.fillStyle = '#eef4f6';
  c.font = 'bold 20px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(typeof gear === 'string' ? gear : (gear === 0 ? 'N' : `G${gear}`), cx, cy + 8);
  c.font = '9px system-ui, sans-serif';
  c.fillStyle = 'rgba(238, 244, 246, 0.75)';
  c.fillText(player.flying ? 'ALT' : 'GEAR', cx, cy + 22);
}

function showHud() {
  hud.style.display = 'block';
  menuEl.style.display = 'none';
  pauseEl.style.display = 'none';
}

function showMenu() {
  state = 'menu';
  hud.style.display = 'none';
  pauseEl.style.display = 'none';
  menuEl.style.display = 'flex';
  btnContinue.style.display = hasSave() ? 'block' : 'none';
}

function updateHud() {
  if (state === 'shot') {
    el('hud-mission').textContent = shotTitle;
    el('hud-objective').textContent = shotObjective;
  } else {
    el('hud-mission').textContent = missions.title;
    const dist = missions.waypointDistance;
    el('hud-objective').textContent = missions.objective + (dist !== null ? ` — ${Math.round(dist)}m` : '');
  }
  const bannerEl = el('hud-banner');
  if (state !== 'shot' && missions.bannerText) {
    bannerEl.textContent = missions.bannerText;
    bannerEl.style.display = 'block';
  } else {
    bannerEl.style.display = 'none';
  }
  el('hud-cash').textContent = `$${player.cash.toLocaleString('en-US')}`;
  el('hud-stars').textContent = '★'.repeat(player.stars) + '☆'.repeat(5 - player.stars);
  el('hud-clock').textContent = formatClock(gameMinutes);
  el('hud-weather').textContent = weather.label();
  el('hud-radio').textContent = `♪ ${radio.label()}`;
  // REP: the tier name and the progress to the next tier.
  const tier = repTier(player.rep);
  el('hud-rep').textContent = `REP ${player.rep.toLocaleString('en-US')} · ${tier.name}`;
  el('hud-rep-fill').style.width = `${Math.round(repProgress(player.rep) * 100)}%`;
  // Weapon slots 1-4: the current weapon is lit, locked ones are dim.
  const slots = el('hud-weapons').children;
  const slotInfo = [
    { label: '1 PISTOL', active: player.weapon === 'pistol', locked: false },
    { label: '2 SMG', active: player.weapon === 'smg', locked: !player.weapons.smg },
    { label: '3 SHOTGUN', active: player.weapon === 'shotgun', locked: !player.weapons.shotgun },
    { label: '4 —', active: false, locked: true },
  ];
  for (let i = 0; i < slots.length; i++) {
    slots[i].textContent = slotInfo[i].label;
    slots[i].className = `wslot${slotInfo[i].active ? ' wslot-active' : ''}${slotInfo[i].locked ? ' wslot-locked' : ''}`;
  }
  el('hud-health-fill').style.width = `${Math.max(0, player.health)}%`;
  el('hud-armor-fill').style.width = `${Math.max(0, player.armor)}%`;
  el('hud-stamina-fill').style.width = `${Math.max(0, player.stamina)}%`;
  el('hud-car-fill').style.width = player.onFoot ? '0%' : `${Math.max(0, (player.carHealth / player.carHealthMax) * 100)}%`;
  el('hud-speed').innerHTML = `${player.speedMph()} <small>MPH</small>`;
  el('hud-vehicle').textContent = player.vehicleName() + (player.nitro && !player.onFoot ? ' · NITRO' : '');
  el('hud-ammo').textContent = player.reloading ? 'RELOADING' : `${player.weaponName()} ${player.weaponAmmo()}/${player.weaponMagazine()}`;
  el('hud-side').textContent = side.fareLabel || side.raceLabel || (side.shellsFound > 0 ? `Golden shells ${side.shellsFound}/${CFG.shells}` : '');
  drawGauge();
  // The response panel lists the chasing units by callsign.
  response.update(police.units(helicopter));

  // The live minimap draws the city, the waypoint, traffic, cruisers and
  // the player every frame it is shown.
  minimap.draw({
    player,
    traffic,
    police,
    vehicles,
    waypoint: missions.waypoint,
    time: skyTime,
  });

  // Sound the wanted sting when the heat climbs, and the mission sting
  // when a job pays out.
  if (player.stars > lastStars) audio.wantedSting();
  // Losing every star is an escape: it counts, and it pays REP. A forced
  // clear — a mission starting, a job failing, a respray — is not an
  // escape, and the police module says so with clearedStars, which this
  // frame consumes.
  if (state === 'playing' && lastStars > 0 && player.stars === 0 && !police.clearedStars) {
    player.copsLost += 1;
    player.rep += CFG.repEscape;
    popups.spawn(player.x, 2.6, player.z, `ESCAPED +${CFG.repEscape} REP`, 'rep');
  }
  lastStars = player.stars;
  police.clearedStars = false;
  const banner = missions.bannerText;
  if (banner && banner !== lastBanner
    && (banner.startsWith('MISSION COMPLETE') || banner.startsWith('KING OF SOLMAR'))) {
    audio.missionSting();
    audio.chime();
  }
  lastBanner = banner;
}

function newGame() {
  player.cash = CFG.startCash;
  player.mission = 0;
  player.stars = 0;
  player.health = 100;
  player.armor = 0;
  player.stamina = 100;
  player.ammo = CFG.pistol.magazine;
  player.carHealthMax = 100;
  player.carHealth = 100;
  player.rep = 0;
  player.weapon = 'pistol';
  player.weapons = { smg: false, shotgun: false };
  player.ammoSmg = 0;
  player.ammoShotgun = 0;
  player.engineLevel = 0;
  player.armorLevel = 0;
  player.nitro = false;
  player.safehouse = false;
  player.carsStolen = 0;
  player.copsLost = 0;
  player.ownedCars = new Set();
  lastStars = 0;
  gameMinutes = CFG.clock.startMinutes;
  currentDistrict = null;
  districtTimer = 0;
  side.reset();
  helicopter.update(0, player, false);
  dialogue.hide();
  popups.clear();
  police.clearCruisers();
  police.setStars(0);
  enemies.clear();
  missions.reset();
  player.spawn(0, -60, 0);
  cameraYaw = player.heading + Math.PI;
  cameraPitch = -0.3;
  cameraDistance = 8;
  state = 'playing';
  showHud();
  updateHud();
}

function continueGame() {
  const data = loadGame();
  if (!data) {
    newGame();
    return;
  }
  player.restore(data);
  side.restoreShells(data.shellsFound ?? 0);
  lastStars = 0;
  gameMinutes = CFG.clock.startMinutes;
  currentDistrict = null;
  districtTimer = 0;
  dialogue.hide();
  popups.clear();
  police.clearCruisers();
  police.setStars(data.stars ?? 0);
  enemies.clear();
  missions.restore(data.mission ?? 0);
  cameraYaw = player.heading + Math.PI;
  cameraPitch = -0.3;
  state = 'playing';
  showHud();
  updateHud();
}

function pauseGame() {
  state = 'paused';
  pauseEl.style.display = 'flex';
}

function resumeGame() {
  state = 'playing';
  pauseEl.style.display = 'none';
}

function quitToMenu() {
  saveGame({ ...player.snapshot(), shellsFound: side.shellsFound });
  missions.suspend();
  showMenu();
}

btnNew.addEventListener('click', newGame);
btnContinue.addEventListener('click', continueGame);
btnResume.addEventListener('click', resumeGame);
btnQuit.addEventListener('click', quitToMenu);

// --- Camera follow -------------------------------------------------------------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const desiredPos = new THREE.Vector3();

function updateCamera(dt, instant = false) {
  const px = player.x;
  const pz = player.z;
  // In the air the camera pulls back and up, and looks at the helicopter
  // itself. While AIR-1 is overhead the camera tilts up a little, rides
  // a little higher, and widens its field of view, so the helicopter's
  // low orbit reads in the frame with the car still in it. The nudge is
  // deliberately small: a bigger tilt would push the car out of the
  // bottom of the frame.
  const heliUp = helicopter.active ? 1 : 0;
  const dist = player.flying ? 16 : player.onFoot ? CFG.camera.footDistance : CFG.camera.carDistance;
  const height = (player.flying ? 8 : player.onFoot ? CFG.camera.footHeight : CFG.camera.carHeight) + heliUp * 1;
  const targetFov = helicopter.active ? 68 : 62;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  // Ease the camera behind the player's heading while moving.
  if (state === 'playing') {
    const moving = player.onFoot ? player.speed > 0.5 : player.flying ? true : Math.abs(player.carSpeed) > 1;
    if (moving) {
      let target = player.heading + Math.PI;
      let d = (target - cameraYaw) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      cameraYaw += d * Math.min(1, dt * 1.1);
    }
  }
  const cx = px + Math.sin(cameraYaw) * dist;
  const cz = pz + Math.cos(cameraYaw) * dist;
  const cy = height;
  desiredPos.set(cx, cy, cz);
  if (instant) {
    camPos.copy(desiredPos);
  } else {
    camPos.lerp(desiredPos, Math.min(1, dt * CFG.camera.lerp));
  }
  camera.position.copy(camPos);
  camTarget.set(px, (player.flying ? player.altitude : 0) + 1.4 + heliUp * 3, pz);
  camera.lookAt(camTarget);
  // Mouse drag orbits the camera.
  const mouse = input.takeMouse();
  if (mouse.dx !== 0 || mouse.dy !== 0) {
    cameraYaw -= mouse.dx * 0.004;
    cameraPitch = Math.max(-0.62, Math.min(-0.08, cameraPitch - mouse.dy * 0.002));
  }
}

// --- Screenshot mode -----------------------------------------------------------
function applyShot() {
  state = 'shot';
  menuEl.style.display = 'none';
  pauseEl.style.display = 'none';
  player.cash = shot.cash;
  player.stars = shot.stars;
  player.health = 100;
  player.armor = shot.armor ?? 0;
  player.stamina = 100;
  player.rep = shot.rep ?? 0;
  player.ammo = CFG.pistol.magazine;
  player.carHealth = 100;
  player.carHealthMax = 100;
  player.weapons = { smg: !!shot.smg, shotgun: !!shot.shotgun };
  player.ammoSmg = player.weapons.smg ? CFG.smg.magazine : 0;
  player.ammoShotgun = player.weapons.shotgun ? CFG.shotgun.magazine : 0;
  player.weapon = shot.weapon || 'pistol';
  gameMinutes = CFG.clock.startMinutes + (shot.clockMinutes ?? 0);
  shotTitle = shot.mission;
  shotObjective = shot.objective;
  // The minimap marks the shot's waypoint, as live play would.
  missions.waypoint = shot.waypoint ? { x: shot.waypoint.x, z: shot.waypoint.z } : null;
  missions.index = shot.missionIndex ?? 0;
  cameraYaw = shot.heading + Math.PI;
  cameraPitch = shot.cameraPitch;
  cameraDistance = shot.cameraDistance;
  if (shot.golden) applyGoldenHour();
  police.setStars(shot.stars);
  if (shot.mode === 'car') {
    // Find a parked car of the wanted type, or take the nearest one.
    let car = city.parkedCars.find((c) => c.type === shot.carType && !c.taken);
    if (!car) car = player.nearestCar(1000);
    player.spawn(shot.x, shot.z, shot.heading);
    if (car) {
      car.x = shot.x;
      car.z = shot.z;
      car.heading = shot.heading;
      player.enterCar(car);
      player.carSpeed = shot.speed;
    }
  } else {
    player.spawn(shot.x, shot.z, shot.heading);
  }
  // The chase shot shows the pursuit: three cruisers in a wedge around the
  // Comet GT, the helicopter overhead, and traffic on the avenue.
  if (shotName === 'chase' && shot.stars >= 3) police.spawnForShot(3);
  if (shot.heli) {
    // Ahead and to the side of the player, so it reads in the frame.
    // Staged low and near-centre for the shot: the chase camera sits
    // at 4.2 m and looks down at the car, so at orbit height the
    // helicopter would sit above the frame (the live game flies it
    // higher, clear of the towers, and its cone, pool and shadow
    // still show from below). 10 m over the open plaza puts the whole
    // mesh, rotor included, in the upper frame against the skyline.
    helicopter.angle = 1.35;
    helicopter.heightOverride = 10;
    helicopter.update(1 / 60, player, true);
  }
  if (shot.trafficNear) {
    // Three traffic cars on the avenue ahead, so the chase has company.
    const fx = Math.sin(shot.heading);
    const fz = Math.cos(shot.heading);
    for (let i = 0; i < 3 && i < traffic.cars.length; i++) {
      const c = traffic.cars[i];
      const ahead = 26 + i * 16;
      const side = i % 2 === 0 ? 3 : -3;
      c.x = shot.x + fx * ahead + (-fz) * side;
      c.z = shot.z + fz * ahead + fx * side;
      c.heading = shot.heading;
      c.speed = 10;
      c.waypoint = { x: c.x + fx * 48, z: c.z + fz * 48, grid: { x: c.x + fx * 48, z: c.z + fz * 48 } };
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
  }
  // The foot shot shows the fight: two goons ahead of Dario, one straight
  // in the line of fire.
  if (shotName === 'foot') {
    const fx = Math.sin(shot.heading);
    const fz = Math.cos(shot.heading);
    const rx = -fz;
    const rz = fx;
    enemies.spawn(shot.x + fx * 10, shot.z + fz * 10);
    enemies.spawn(shot.x + fx * 12 - rx * 4, shot.z + fz * 12 - rz * 4);
  }
  if (shotName === 'map') {
    // The map screen over the city, with a representative mid-game state.
    side.restoreShells(3);
    player.carsStolen = 5;
    player.copsLost = 2;
    cityMap.draw({
      player, traffic, police, missions, side, vehicles,
      carsStolen: player.carsStolen, copsLost: player.copsLost,
      safehouse: false, time: skyTime,
    });
    cityMap.open();
  }
  // Advance a fixed number of fixed-length steps: no wall clock, so the
  // frame is identical on every run.
  const fixedDt = 1 / 60;
  for (let i = 0; i < shot.steps; i++) {
    skyTime += fixedDt;
    if (shot.mode === 'car' && player.car) {
      const spec = player.car.spec;
      player.carSpeed = Math.max(0, player.carSpeed - player.carSpeed * 0.55 * fixedDt);
      if (player.carSpeed > spec.maxSpeed) player.carSpeed = spec.maxSpeed;
      player.x += Math.sin(player.carHeading) * player.carSpeed * fixedDt;
      player.z += Math.cos(player.carHeading) * player.carSpeed * fixedDt;
      player.car.x = player.x;
      player.car.z = player.z;
      player.car.heading = player.carHeading;
      player.car.mesh.position.set(player.x, 0, player.z);
      player.car.mesh.rotation.y = player.carHeading;
    }
    animateSky(skyTime);
    animateWater(city.water, skyTime);
    const playerCar = player.onFoot
      ? null
      : { x: player.x, z: player.z, heading: player.carHeading, speed: player.carSpeed };
    traffic.update(fixedDt, playerCar);
    pedestrians.update(fixedDt);
    police.update(fixedDt);
    enemies.update(fixedDt, player, null);
    if (shot.heli) helicopter.update(fixedDt, player, true);
    // The foot shot fires on the last step, so the muzzle flash, the
    // tracer and the damage number are fresh in the frozen frame.
    if (shotName === 'foot' && i === shot.steps - 1) {
      const dx = Math.sin(shot.heading);
      const dz = Math.cos(shot.heading);
      world.fireShot(player.x, player.z, dx, dz, 'pistol');
    }
    // The chase shot carries a drift popup, like the top entries do.
    if (shotName === 'chase' && i === shot.steps - 1) {
      popups.spawnScreen(0.62, 0.38, 'DRIFT x3 +$250', 'stunt');
      popups.spawnScreen(0.68, 0.46, 'NEAR MISS +25 REP', 'stunt');
    }
  }
  updateCamera(0, true);
  // The shot's popups were placed while the camera still sat at its
  // boot position, so re-project them now that the camera is framed:
  // otherwise a damage number can end up hidden behind the camera.
  // updateMatrixWorld first: the render has not run yet, so the
  // camera's inverse matrix is still the stale boot one.
  camera.updateMatrixWorld(true);
  popups.update(0, camera);
  updateHud();
  hud.style.display = 'block';
  renderer.render(scene, camera);
  window.__shotReady = true;
}

// --- Main loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let menuAngle = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), CFG.maxDt);

  if (state === 'playing') {
    skyTime += dt;
    gameMinutes += dt * CFG.clock.rate; // about one game-hour per two real minutes
    animateSky(skyTime);
    animateWater(city.water, skyTime);
    // The sky and the weather move with the clock; the rain sets the
    // grip for the player and the traffic before either of them drives.
    weather.update(dt, player.x, player.z, gameMinutes);
    player.gripFactor = weather.gripFactor;
    traffic.gripFactor = weather.gripFactor;
    // N mutes; M opens the full city map; V switches the radio station.
    if (input.consume('KeyN')) audio.setMuted(!audio.muted);
    if (input.consume('KeyV')) radio.next();
    if (input.consume('KeyM')) {
      state = 'map';
      cityMap.open();
      cityMap.draw({
        player, traffic, police, missions, side, vehicles,
        carsStolen: player.carsStolen, copsLost: player.copsLost,
        safehouse: player.safehouse, time: skyTime,
      });
    }
    // E near Rosa's Garage opens the shop instead of entering a car.
    const nearGarage = player.onFoot
      && Math.hypot(player.x - CFG.garage.position.x, player.z - CFG.garage.position.z) < 7;
    if (nearGarage && input.consume('KeyE')) {
      state = 'garage';
      garage.open();
    }
    const wasOnFoot = player.onFoot;
    player.update(dt, input, cameraYaw, world);
    if (player.onFoot !== wasOnFoot) audio.door();
    vehicles.update(dt);
    damageSmoke.update(dt, player.car, player.carHealth);
    muzzle.update(dt);
    missions.update(dt);
    const playerCar = player.onFoot
      ? null
      : { x: player.x, z: player.z, heading: player.carHeading, speed: player.carSpeed };
    traffic.update(dt, playerCar);
    pedestrians.update(dt);
    police.update(dt);
    enemies.update(dt, player, (dist) => audio.gunshot(Math.max(0.15, 1 - dist / 60)));
    // The helicopter flies at four stars and up, and in mission 3. It
    // gets the building heights so its low orbit clears the roofs.
    const heliActive = player.stars >= CFG.helicopter.minStars || missions.index === 2;
    helicopter.update(dt, player, heliActive, city.colliders);
    // The headlight follows the car or bike after dark.
    if (!player.onFoot && weather.darkness > 0.35) {
      headlight.intensity = weather.darkness * 80;
      headlight.position.set(player.x, 1.2, player.z);
      const fx = Math.sin(player.carHeading);
      const fz = Math.cos(player.carHeading);
      headlight.target.position.set(player.x + fx * 25, 0.5, player.z + fz * 25);
    } else {
      headlight.intensity = 0;
    }
    side.update(dt, missions.index);
    radio.update(dt, audio);
    dialogue.update(dt);
    popups.update(dt, camera);
    if (dialogue.visible && (input.consume('KeyF') || input.consumeClick())) dialogue.skip();
    // Near misses and drifts pay REP: a fast pass within a few metres of
    // a traffic car, or a handbrake slide held for a second.
    nearMissCooldown = Math.max(0, nearMissCooldown - dt);
    if (!player.onFoot && Math.abs(player.carSpeed) > 20 && nearMissCooldown <= 0) {
      for (const car of traffic.cars) {
        const d = Math.hypot(car.x - player.x, car.z - player.z);
        if (d < 3.5) {
          nearMissCooldown = 2;
          player.rep += CFG.repNearMiss;
          popups.spawn(player.x, 2.2, player.z, `NEAR MISS +${CFG.repNearMiss} REP`, 'stunt');
          break;
        }
      }
    }
    if (!player.onFoot && input.down('Space') && Math.abs(player.carSpeed) > 15) {
      driftTime += dt;
      if (driftTime > 0.8 && !driftPaid) {
        driftPaid = true;
        player.rep += CFG.repDrift;
        popups.spawn(player.x, 2.2, player.z, `DRIFT +${CFG.repDrift} REP`, 'stunt');
      }
    } else {
      driftTime = 0;
      driftPaid = false;
    }
    // The district name card: a new district shows its name and tagline
    // for three seconds.
    const here = districtAt(player.x, player.z);
    if (here && here.name !== currentDistrict) {
      currentDistrict = here.name;
      districtTimer = 3;
      el('hud-district-name').textContent = here.name;
      el('hud-district-tag').textContent = here.tagline;
      el('hud-district').style.display = 'block';
    }
    if (districtTimer > 0) {
      districtTimer -= dt;
      if (districtTimer <= 0) el('hud-district').style.display = 'none';
    }
    // The safehouse heals Dario and saves the game, once per visit.
    const nearSafehouse = player.safehouse
      && Math.hypot(player.x - 144, player.z - 96) < 8;
    if (nearSafehouse) {
      player.health = Math.min(100, player.health + 20 * dt);
      if (!safehouseSaved) {
        safehouseSaved = true;
        saveGame({ ...player.snapshot(), shellsFound: side.shellsFound });
      }
    } else {
      safehouseSaved = false;
    }
    // The driven speed, whatever the vehicle: car, bike, boat or heli.
    const drivenSpeed = player.flying && player.heli
      ? Math.hypot(player.heli.vx, player.heli.vz)
      : player.boat ? Math.abs(player.boatSpeed) : Math.abs(player.carSpeed);
    audio.update({
      driving: !player.onFoot && drivenSpeed > 0.5,
      speed01: player.onFoot ? player.speed / CFG.walkSpeed : drivenSpeed / 55,
      sirenDistance: police.nearestCruiserDistance(),
      // Skid: handbrake on at speed, louder the faster the car goes.
      skid: !player.onFoot && input.down('Space') && drivenSpeed > 10
        ? Math.min(1, drivenSpeed / 30) : 0,
    });
    updateCamera(dt);
    updateHud();
    if (input.consume('Escape')) pauseGame();
  } else if (state === 'map') {
    // The map screen over the frozen city: M or Escape closes it.
    audio.update({ driving: false, speed01: 0, sirenDistance: null });
    if (input.consume('KeyM') || input.consume('Escape')) {
      cityMap.close();
      state = 'playing';
    }
  } else if (state === 'garage') {
    // The garage shop over the frozen city: Escape closes it.
    audio.update({ driving: false, speed01: 0, sirenDistance: null });
    if (input.consume('Escape')) {
      garage.close();
      state = 'playing';
    }
  } else if (state === 'paused') {
    audio.update({ driving: false, speed01: 0, sirenDistance: null });
    if (input.consume('Escape') || input.consume('KeyP')) resumeGame();
  } else if (state === 'menu') {
    skyTime += dt;
    animateSky(skyTime);
    animateWater(city.water, skyTime);
    // The sky lives behind the menu too, on the 17:24 sunset palette.
    weather.update(dt, 0, -60, gameMinutes);
    // The city lives behind the menu: traffic cruises, residents stroll.
    traffic.update(dt, null);
    pedestrians.update(dt);
    menuAngle += dt * 0.045;
    camera.position.set(Math.cos(menuAngle) * 120, 42, Math.sin(menuAngle) * 120);
    camera.lookAt(0, 4, 0);
  } else if (state === 'shot') {
    // Frozen frame: render once more so the shot is stable, then idle.
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  input.endFrame();
  renderer.render(scene, camera);
}

// --- Boot ------------------------------------------------------------------------
// In shot mode the frame is rendered once, deterministically, and no loop
// runs: the harness screenshots the frozen frame. In live mode the loop runs.
// Debug hook for automated verification (harmless in the shipped game).
window.__game = {
  player, city, input, traffic, pedestrians, police, enemies, audio, missions, damageSmoke,
  helicopter, radio, dialogue, response, garage, side, cityMap, popups, muzzle,
  vehicles, weather,
  setGameMinutes(m) {
    gameMinutes = m;
  },
  get cameraYaw() {
    return cameraYaw;
  },
  get gameMinutes() {
    return gameMinutes;
  },
  get skyTime() {
    return skyTime;
  },
  get state() {
    return state;
  },
};

document.getElementById('loading').style.display = 'none';
if (shot) {
  applyShot();
} else {
  player.spawn(0, -60, 0);
  showMenu();
  requestAnimationFrame(loop);
}
