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
import { DamageSmoke } from './effects.js';

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
scene.add(new THREE.HemisphereLight(CFG.sky.hemiSky, CFG.sky.hemiGround, CFG.sky.hemiIntensity));

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
const city = buildCity(scene);
const player = new Player(scene, city);
const input = new Input(window);
const traffic = new Traffic(scene, city);
const pedestrians = new Pedestrians(scene, city);
const police = new Police(scene, city, player);
const enemies = new Enemies(scene, city);
const missions = new Missions(scene, city, player, police, enemies);
const audio = new AudioEngine();

// The world the player acts on: a gunshot is heard, makes pedestrians flee
// and raises the heat; stealing a car raises the heat; a crash makes a
// sound; a car that hits a pedestrian knocks them down and raises the heat.
const world = {
  fireShot(x, z, dx, dz) {
    enemies.shootAt(x, z, dx, dz);
    audio.gunshot(1);
    pedestrians.onGunshot(x, z);
    police.addHeat(CFG.pistol.heatPerShot);
  },
  carStolen() {
    police.addHeat(1);
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
const el = (id) => document.getElementById(id);
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
  el('hud-health-fill').style.width = `${Math.max(0, player.health)}%`;
  el('hud-car-fill').style.width = player.onFoot ? '0%' : `${Math.max(0, player.carHealth)}%`;
  el('hud-speed').innerHTML = `${player.speedMph()} <small>MPH</small>`;
  el('hud-vehicle').textContent = player.vehicleName();
  el('hud-ammo').textContent = player.reloading ? 'RELOADING' : `PISTOL ${player.ammo}/12`;

  // The live minimap draws the city, the waypoint, traffic, cruisers and
  // the player every frame it is shown.
  minimap.draw({
    player,
    traffic,
    police,
    waypoint: missions.waypoint,
    time: skyTime,
  });

  // Sound the wanted sting when the heat climbs, and the mission sting
  // when a job pays out.
  if (player.stars > lastStars) audio.wantedSting();
  lastStars = player.stars;
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
  player.ammo = CFG.pistol.magazine;
  player.carHealth = 100;
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
  saveGame(player.snapshot());
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
  const dist = player.onFoot ? CFG.camera.footDistance : CFG.camera.carDistance;
  const height = player.onFoot ? CFG.camera.footHeight : CFG.camera.carHeight;
  // Ease the camera behind the player's heading while moving.
  if (state === 'playing') {
    const moving = player.onFoot ? player.speed > 0.5 : Math.abs(player.carSpeed) > 1;
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
  camTarget.set(px, 1.4, pz);
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
  player.ammo = CFG.pistol.magazine;
  player.carHealth = 100;
  shotTitle = shot.mission;
  shotObjective = shot.objective;
  // The minimap marks the shot's waypoint, as live play would.
  missions.waypoint = shot.waypoint ? { x: shot.waypoint.x, z: shot.waypoint.z } : null;
  cameraYaw = shot.heading + Math.PI;
  cameraPitch = shot.cameraPitch;
  cameraDistance = shot.cameraDistance;
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
  // Comet GT. The Docks shot shows the fight: two goons ahead of Dario.
  if (shotName === 'chase' && shot.stars >= 3) police.spawnForShot(3);
  if (shotName === 'mission') {
    const fx = Math.sin(shot.heading);
    const fz = Math.cos(shot.heading);
    const rx = -fz;
    const rz = fx;
    enemies.spawn(shot.x + fx * 10 + rx * 4, shot.z + fz * 10 + rz * 4);
    enemies.spawn(shot.x + fx * 12 - rx * 4, shot.z + fz * 12 - rz * 4);
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
  }
  updateCamera(0, true);
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
    animateSky(skyTime);
    animateWater(city.water, skyTime);
    if (input.consume('KeyM')) audio.setMuted(!audio.muted);
    const wasOnFoot = player.onFoot;
    player.update(dt, input, cameraYaw, world);
    if (player.onFoot !== wasOnFoot) audio.door();
    damageSmoke.update(dt, player.car, player.carHealth);
    missions.update(dt);
    const playerCar = player.onFoot
      ? null
      : { x: player.x, z: player.z, heading: player.carHeading, speed: player.carSpeed };
    traffic.update(dt, playerCar);
    pedestrians.update(dt);
    police.update(dt);
    enemies.update(dt, player, (dist) => audio.gunshot(Math.max(0.15, 1 - dist / 60)));
    audio.update({
      driving: !player.onFoot && Math.abs(player.carSpeed) > 0.5,
      speed01: player.onFoot ? player.speed / CFG.walkSpeed : Math.abs(player.carSpeed) / 55,
      sirenDistance: police.nearestCruiserDistance(),
      // Skid: handbrake on at speed, louder the faster the car goes.
      skid: !player.onFoot && input.down('Space') && Math.abs(player.carSpeed) > 10
        ? Math.min(1, Math.abs(player.carSpeed) / 30) : 0,
    });
    updateCamera(dt);
    updateHud();
    if (input.consume('Escape')) pauseGame();
  } else if (state === 'paused') {
    audio.update({ driving: false, speed01: 0, sirenDistance: null });
    if (input.consume('Escape') || input.consume('KeyP')) resumeGame();
  } else if (state === 'menu') {
    skyTime += dt;
    animateSky(skyTime);
    animateWater(city.water, skyTime);
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
  get cameraYaw() {
    return cameraYaw;
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
