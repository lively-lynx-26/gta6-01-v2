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
let missionTitle = 'Free roam';
let missionObjective = 'Explore Solmar Bay';
let skyTime = 0;

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
  el('hud-mission').textContent = missionTitle;
  el('hud-objective').textContent = missionObjective;
  el('hud-cash').textContent = `$${player.cash.toLocaleString('en-US')}`;
  el('hud-stars').textContent = '★'.repeat(player.stars) + '☆'.repeat(5 - player.stars);
  el('hud-health-fill').style.width = `${Math.max(0, player.health)}%`;
  el('hud-car-fill').style.width = player.onFoot ? '0%' : '100%';
  el('hud-speed').innerHTML = `${player.speedMph()} <small>MPH</small>`;
  el('hud-vehicle').textContent = player.vehicleName();
  el('hud-ammo').textContent = `PISTOL ${player.ammo}/12`;
}

function newGame() {
  player.cash = CFG.startCash;
  player.mission = 0;
  player.stars = 0;
  player.health = 100;
  player.ammo = 12;
  missionTitle = 'Free roam';
  missionObjective = 'Explore Solmar Bay';
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
  missionTitle = data.mission > 0 ? `Mission ${data.mission + 1}` : 'Free roam';
  missionObjective = 'Explore Solmar Bay';
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
  player.ammo = 12;
  missionTitle = shot.mission;
  missionObjective = shot.objective;
  cameraYaw = shot.heading + Math.PI;
  cameraPitch = shot.cameraPitch;
  cameraDistance = shot.cameraDistance;
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
      player.car.mesh.position.set(player.x, 0, player.z);
      player.car.mesh.rotation.y = player.carHeading;
    }
    animateSky(skyTime);
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
    player.update(dt, input, cameraYaw);
    updateCamera(dt);
    updateHud();
    if (input.consume('Escape')) pauseGame();
  } else if (state === 'paused') {
    if (input.consume('Escape') || input.consume('KeyP')) resumeGame();
  } else if (state === 'menu') {
    skyTime += dt;
    animateSky(skyTime);
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
window.__game = { player, city, input };

document.getElementById('loading').style.display = 'none';
if (shot) {
  applyShot();
} else {
  player.spawn(0, -60, 0);
  showMenu();
  requestAnimationFrame(loop);
}
