// Solmar Bay — Neon Tide: model builders for cars, people, buildings and
// props. Everything is built from simple shapes with rounded proportions —
// nothing stiff or boxy where a curve belongs — and no model is loaded from a
// file. (The full models module grows in later chunks; this chunk covers the
// cars, the player figure, buildings, trees and the plaza fountain.)

import * as THREE from 'three';

function std(color, roughness = 0.85, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// --- Sculpted car bodies ----------------------------------------------------
// Real cars are not boxes: each body is an extruded side silhouette with
// rounded bevels (hood slope, cabin, trunk), a glass cabin with a roof
// panel, arched fenders over the wheels, and separate bumpers, grille,
// lights, mirrors and door lines. The outer envelope (length, width, top)
// of every type matches the old body exactly, so collision sizes and
// gameplay do not change; only the shape does. All numbers are constants,
// so the models are deterministic. The paint material is created fresh per
// car (the damage-smoke module darkens it by colour match, per car).

// Shared wheel and detail geometries: created once, reused by every car.
const _tireGeo = new THREE.TorusGeometry(0.26, 0.1, 8, 18);
_tireGeo.rotateY(Math.PI / 2);
const _tireGeoBig = new THREE.TorusGeometry(0.23, 0.13, 8, 18);
_tireGeoBig.rotateY(Math.PI / 2);
const _hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.3, 12);
_hubGeo.rotateZ(Math.PI / 2);
const _spokeGeo = new THREE.BoxGeometry(0.04, 0.3, 0.06);
const _capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10);
_capGeo.rotateZ(Math.PI / 2);
const _fenderGeo = new THREE.TorusGeometry(0.5, 0.09, 8, 12, Math.PI);
_fenderGeo.rotateY(Math.PI / 2);
const _lensGeo = new THREE.SphereGeometry(0.17, 12, 8);

// A side silhouette (rear to front, [length, height]) extruded across the
// car's width with rounded bevels. Ops: ['m', x, y], ['l', x, y],
// ['q', cx, cy, x, y]. Returns a centred geometry (length on z, width on x).
function extrudeProfile(ops, width, bevel = 0.06) {
  const shape = new THREE.Shape();
  shape.moveTo(ops[0][1], ops[0][2]);
  for (let i = 1; i < ops.length; i++) {
    const op = ops[i];
    if (op[0] === 'l') shape.lineTo(op[1], op[2]);
    else shape.quadraticCurveTo(op[1], op[2], op[3], op[4]);
  }
  shape.closePath();
  const depth = Math.max(0.05, width - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(depth / 2, 0, 0);
  return geo;
}

// A bar with rounded corners: width on x, height on y, depth on z.
function roundBar(w, h, d, material, r = 0.04) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, material);
}

// One wheel: a torus tyre, a hub, and a five-spoke star on the outboard
// face. The group faces +x; mirror it (rotation.y = PI) for the left side.
function buildWheel(dark, chrome, big = false) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(big ? _tireGeoBig : _tireGeo, dark));
  group.add(new THREE.Mesh(_hubGeo, chrome));
  for (let k = 0; k < 5; k++) {
    const spoke = new THREE.Mesh(_spokeGeo, dark);
    spoke.position.x = 0.16;
    spoke.rotation.x = (k * Math.PI * 2) / 5;
    group.add(spoke);
  }
  const cap = new THREE.Mesh(_capGeo, chrome);
  cap.position.x = 0.16;
  group.add(cap);
  return group;
}

// A lens (headlight or tail light): a flattened, slightly wrapped sphere.
function lens(mat, x, y, z, ry) {
  const m = new THREE.Mesh(_lensGeo, mat);
  m.scale.set(1.3, 0.5, 0.45);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

// Fenders, wheels, lights, grille, bumpers and mirrors shared by every
// car. `dims` carries the type's envelope; `mats` the shared materials.
// `opts.bigWheels` fits the hauler's chunkier tyres; `opts.doorLines`
// adds the sedan's door seams and handles.
function addRunningGear(group, dims, mats, opts = {}) {
  const { L, W, headY, grilleY, bumperY } = dims;
  const { paint, dark, chrome, headMat, tailMat } = mats;
  const half = L / 2;

  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const fender = new THREE.Mesh(_fenderGeo, paint);
    fender.scale.x = 0.6;
    fender.position.set(Math.sign(x) * (W / 2 - 0.02), 0.36, z);
    group.add(fender);
    const wheel = buildWheel(dark, chrome, !!opts.bigWheels);
    wheel.position.set(x, 0.36, z);
    if (x < 0) wheel.rotation.y = Math.PI;
    group.add(wheel);
  }

  group.add(lens(headMat, -0.62, headY, half - 0.06, 0.25));
  group.add(lens(headMat, 0.62, headY, half - 0.06, -0.25));
  group.add(lens(tailMat, -0.62, headY, -(half - 0.06), -0.25));
  group.add(lens(tailMat, 0.62, headY, -(half - 0.06), 0.25));

  const grille = roundBar(1.1, 0.2, 0.08, dark, 0.03);
  grille.position.set(0, grilleY, half);
  group.add(grille);
  for (const dy of [-0.06, 0.06]) {
    group.add(box(1.0, 0.03, 0.02, chrome, 0, grilleY + dy, half + 0.04));
  }

  const bumperF = roundBar(1.7, 0.2, 0.1, dark, 0.05);
  bumperF.position.set(0, bumperY, half);
  group.add(bumperF);
  const bumperR = roundBar(1.7, 0.2, 0.1, dark, 0.05);
  bumperR.position.set(0, bumperY, -half);
  group.add(bumperR);

  const mirrorY = opts.mirrorY || 1.05;
  const mirrorZ = opts.mirrorZ || 0.62;
  for (const side of [-1, 1]) {
    group.add(box(0.22, 0.03, 0.04, dark, side * (W / 2), mirrorY, mirrorZ));
    const head = roundBar(0.06, 0.09, 0.12, paint, 0.02);
    head.position.set(side * (W / 2 + 0.12), mirrorY + 0.02, mirrorZ);
    group.add(head);
  }

  if (opts.doorLines) {
    for (const side of [-1, 1]) {
      const sx = side * (W / 2 + 0.003);
      group.add(box(0.012, 0.55, 0.02, dark, sx, 0.62, -0.55));
      group.add(box(0.012, 0.55, 0.02, dark, sx, 0.62, 0.45));
      group.add(box(0.012, 0.025, 2.4, dark, sx, 0.8, -0.05));
      group.add(box(0.02, 0.035, 0.16, chrome, side * (W / 2 + 0.006), 0.88, -0.35));
      group.add(box(0.02, 0.035, 0.16, chrome, side * (W / 2 + 0.006), 0.88, 0.25));
    }
  }
}

// A car, sculpted to read as a real car. Faces +z (its heading).
// `body` is one of the CFG.cars body keys ('sedan', 'sport', 'van',
// 'hauler'); `color` is the paint colour; `kind` is the CFG car key
// ('sedan', 'cab', 'comet', 'van', 'hauler') for type-specific details.
export function buildCarMesh(body, color, kind = body) {
  const group = new THREE.Group();
  const paint = std(color, 0.35, 0.45);
  const glass = std(0x1a2a33, 0.15, 0.6);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c9,
    emissive: 0xfff2b0,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xaa1111,
    emissive: 0xcc2222,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const mats = { paint, dark, chrome, headMat, tailMat };

  // Per-type envelope — matches the old boxy bodies, so nothing in the
  // physics changes.
  const dims = {
    sedan: { L: 4.4, W: 1.9, headY: 0.68, grilleY: 0.55, bumperY: 0.42 },
    sport: { L: 4.6, W: 1.9, headY: 0.55, grilleY: 0.45, bumperY: 0.38 },
    van: { L: 4.8, W: 2.0, headY: 0.75, grilleY: 0.7, bumperY: 0.45 },
    hauler: { L: 5.2, W: 2.2, headY: 0.85, grilleY: 0.8, bumperY: 0.45 },
  }[body] || { L: 4.4, W: 1.9, headY: 0.68, grilleY: 0.55, bumperY: 0.42 };

  if (body === 'sport') {
    // Comet GT: low, long hood, swept cabin, rear wing.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -2.3, 0.28], ['l', 2.3, 0.28],
      ['q', 2.34, 0.45, 2.24, 0.58],
      ['l', 0.75, 0.78], ['l', -1.65, 0.78],
      ['q', -2.24, 0.78, -2.3, 0.6],
    ], 1.9), paint));
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -1.4, 0.7], ['l', 0.8, 0.7],
      ['q', 0.65, 1.05, 0.15, 1.26],
      ['l', -0.85, 1.26],
      ['q', -1.2, 1.26, -1.4, 0.95],
    ], 1.58), glass));
    group.add(box(1.66, 0.05, 1.05, paint, 0, 1.27, -0.35)); // roof
    const wing = roundBar(1.7, 0.05, 0.38, dark, 0.02);
    wing.position.set(0, 0.98, -2.02);
    group.add(wing);
    group.add(box(0.07, 0.22, 0.1, dark, -0.55, 0.86, -2.02));
    group.add(box(0.07, 0.22, 0.1, dark, 0.55, 0.86, -2.02));
    group.add(box(0.05, 0.09, 2.9, dark, -0.94, 0.32, 0)); // skirts
    group.add(box(0.05, 0.09, 2.9, dark, 0.94, 0.32, 0));
    group.add(box(1.5, 0.1, 0.05, tailMat, 0, 0.62, -2.28)); // rear light bar
    addRunningGear(group, dims, mats, { doorLines: true, mirrorY: 1.0, mirrorZ: 0.55 });
  } else if (body === 'van') {
    // Panel van: one tall rounded silhouette, glass on the sloped nose.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -2.4, 0.3], ['l', 2.4, 0.3],
      ['q', 2.44, 0.7, 2.36, 1.05],
      ['l', 1.55, 1.78], ['l', -2.28, 1.78],
      ['q', -2.42, 1.78, -2.42, 1.55],
      ['l', -2.4, 0.3],
    ], 2.0), paint));
    const shield = box(1.5, 0.95, 0.03, glass, 0, 1.435, 1.975);
    shield.rotation.x = -Math.atan2(0.73, 0.81);
    group.add(shield);
    for (const side of [-1, 1]) {
      group.add(box(0.02, 0.5, 2.6, glass, side * 1.005, 1.35, -0.5)); // side windows
      group.add(box(0.02, 0.5, 0.55, glass, side * 1.005, 1.32, 1.15)); // cab window
      group.add(box(0.7, 0.6, 0.03, glass, side * 0.45, 1.3, -2.42)); // rear windows
    }
    group.add(box(0.03, 1.3, 0.02, dark, 0, 1.1, -2.43)); // rear door seam
    group.add(box(1.6, 0.03, 0.02, dark, 0, 1.15, -2.43));
    addRunningGear(group, dims, mats, { mirrorY: 1.25, mirrorZ: 1.3 });
  } else if (body === 'hauler') {
    // Vault Hauler: armoured cab plus a tall cargo box.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -0.6, 0.3], ['l', 2.6, 0.3],
      ['q', 2.64, 0.7, 2.56, 1.0],
      ['l', 1.95, 1.28],
      ['q', 1.8, 1.55, 1.35, 1.85],
      ['l', -0.6, 1.85], ['l', -0.6, 0.3],
    ], 2.2), paint));
    const shield = box(1.5, 0.8, 0.03, glass, 0, 1.585, 1.672);
    shield.rotation.x = -Math.atan2(0.57, 0.6);
    group.add(shield);
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -2.55, 0.3], ['l', -0.75, 0.3],
      ['q', -0.7, 0.3, -0.7, 0.38],
      ['l', -0.7, 1.92],
      ['q', -0.7, 2.0, -0.78, 2.0],
      ['l', -2.52, 2.0],
      ['q', -2.6, 2.0, -2.6, 1.92],
      ['l', -2.6, 0.38],
      ['q', -2.6, 0.3, -2.55, 0.3],
    ], 2.16, 0.08), paint));
    for (const side of [-1, 1]) {
      for (const z of [-1.3, -1.9]) {
        group.add(box(0.02, 1.3, 0.04, dark, side * 1.09, 1.15, z)); // plate seams
      }
    }
    const barBase = roundBar(1.1, 0.08, 0.3, dark, 0.03);
    barBase.position.set(0, 1.9, 0.6);
    group.add(barBase);
    const amber = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff9900,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const lamp = roundBar(0.4, 0.1, 0.24, amber, 0.03);
      lamp.position.set(side * 0.3, 1.97, 0.6);
      group.add(lamp);
    }
    group.add(box(0.09, 0.75, 0.07, dark, -0.62, 0.72, 2.62)); // grille guard
    group.add(box(0.09, 0.75, 0.07, dark, 0.62, 0.72, 2.62));
    group.add(box(1.5, 0.09, 0.07, dark, 0, 1.02, 2.62));
    addRunningGear(group, dims, mats, { bigWheels: true, mirrorY: 1.25, mirrorZ: 1.5 });
  } else {
    // Sedan / cab: classic three-box shape, sculpted.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -2.2, 0.3], ['l', 2.2, 0.3],
      ['q', 2.24, 0.55, 2.16, 0.72],
      ['l', 0.95, 0.9], ['l', -1.55, 0.9],
      ['q', -2.16, 0.9, -2.2, 0.72],
    ], 1.9), paint));
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -1.2, 0.8], ['l', 1.0, 0.8],
      ['q', 0.85, 1.15, 0.4, 1.5],
      ['l', -0.7, 1.5],
      ['q', -1.05, 1.5, -1.2, 1.15],
    ], 1.62), glass));
    group.add(box(1.66, 0.05, 1.15, paint, 0, 1.52, -0.15)); // roof
    if (kind === 'cab') {
      // Taxi sign on the roof (the old code never reached this branch:
      // callers passed the body key, not the car key).
      const sign = roundBar(0.9, 0.2, 0.4, std(0x111111, 0.6, 0.2), 0.05);
      sign.position.set(0, 1.68, -0.15);
      group.add(sign);
      group.add(box(0.8, 0.08, 0.02, new THREE.MeshStandardMaterial({
        color: 0xffcc33,
        emissive: 0xffbb00,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }), 0, 1.68, 0.06));
    }
    addRunningGear(group, dims, mats, { doorLines: true });
  }

  return group;
}

// Dario on foot: a rounded, stylised figure, about 1.8 m tall, facing +z.
export function buildPersonMesh() {
  return buildPedestrianMesh({ shirt: 0x2e6f8e, pants: 0x2b2f38, skin: 0xc98e6b, hair: true });
}

// A resident (or a goon): the same rounded figure in different clothes.
// `armed` adds a pistol in the right hand. Faces +z.
export function buildPedestrianMesh({ shirt, pants, skin, hair = false, armed = false }) {
  const group = new THREE.Group();
  const skinMat = std(skin, 0.7, 0);
  const shirtMat = std(shirt, 0.8, 0);
  const pantsMat = std(pants, 0.85, 0);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.72, 12), shirtMat);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skinMat);
  head.position.y = 1.62;
  group.add(head);
  if (hair) {
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std(0x1c1410, 0.9, 0));
    hairCap.position.y = 1.65;
    group.add(hairCap);
  }
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.68, 8), pantsMat);
    leg.position.set(side * 0.13, 0.34, 0);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8), shirtMat);
    arm.position.set(side * 0.34, 1.05, 0);
    group.add(arm);
  }
  if (armed) {
    // A pistol held out in front, in the right hand.
    const gun = box(0.07, 0.09, 0.34, std(0x14161a, 0.6, 0.4), 0.34, 0.82, 0.3);
    group.add(gun);
  }
  return group;
}

// A Solmar Bay Police cruiser: a sculpted white sedan with black doors, a
// light bar and a push bumper. The light bar's two lamps are kept in
// userData so the police module can flash them red and blue.
export function buildPoliceCarMesh() {
  const group = new THREE.Group();
  const white = std(0xf2f2f2, 0.35, 0.4);
  const black = std(0x14161a, 0.5, 0.2);
  const glass = std(0x1a2a33, 0.15, 0.6);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c9,
    emissive: 0xfff2b0,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xaa1111,
    emissive: 0xcc2222,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });

  group.add(new THREE.Mesh(extrudeProfile([
    ['m', -2.2, 0.3], ['l', 2.2, 0.3],
    ['q', 2.24, 0.55, 2.16, 0.72],
    ['l', 0.95, 0.9], ['l', -1.55, 0.9],
    ['q', -2.16, 0.9, -2.2, 0.72],
  ], 1.9), white));
  group.add(new THREE.Mesh(extrudeProfile([
    ['m', -1.2, 0.8], ['l', 1.0, 0.8],
    ['q', 0.85, 1.15, 0.4, 1.5],
    ['l', -0.7, 1.5],
    ['q', -1.05, 1.5, -1.2, 1.15],
  ], 1.62), glass));
  group.add(box(1.66, 0.05, 1.15, white, 0, 1.52, -0.15)); // roof
  // Black doors and hood: the classic two-tone livery.
  for (const side of [-1, 1]) {
    group.add(box(0.02, 0.5, 1.5, black, side * 0.955, 0.62, -0.1));
    group.add(box(0.012, 0.025, 2.4, black, side * 0.953, 0.8, -0.05));
  }
  const hoodStrip = box(1.5, 0.02, 0.8, black, 0, 0.92, 1.55);
  hoodStrip.rotation.x = 0.148; // follows the hood slope
  group.add(hoodStrip);
  // Push bumper at the front.
  const push = roundBar(1.6, 0.3, 0.16, dark, 0.05);
  push.position.set(0, 0.5, 2.22);
  group.add(push);

  addRunningGear(group, { L: 4.4, W: 1.9, headY: 0.68, grilleY: 0.55, bumperY: 0.42 },
    { paint: white, dark, chrome, headMat, tailMat }, { doorLines: false });

  // Light bar: red on the driver's side, blue on the other, both glowing.
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0xff2222, emissiveIntensity: 0.6, roughness: 0.3 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1133cc, emissive: 0x2244ff, emissiveIntensity: 0.6, roughness: 0.3 });
  const barBase = roundBar(1.15, 0.07, 0.34, dark, 0.03);
  barBase.position.set(0, 1.64, -0.25);
  group.add(barBase);
  const redLamp = roundBar(0.48, 0.16, 0.26, redMat, 0.05);
  redLamp.position.set(-0.32, 1.74, -0.25);
  group.add(redLamp);
  const blueLamp = roundBar(0.48, 0.16, 0.26, blueMat, 0.05);
  blueLamp.position.set(0.32, 1.74, -0.25);
  group.add(blueLamp);
  group.userData.lightRed = redLamp;
  group.userData.lightBlue = blueLamp;

  return group;
}

// A building: a coloured box with a procedural facade texture (lit and dark
// windows, a darker ground floor), a roof slab and a darker base trim.
export function buildBuildingMesh(width, height, depth, color, roofColor, facadeTexture = null) {
  const group = new THREE.Group();
  let wallMat;
  if (facadeTexture) {
    // The facade canvas is painted for a ~14 m wide, ~18 m tall face; repeat
    // it so wider and taller buildings keep the same window density.
    const tex = facadeTexture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(width / 14)), Math.max(1, Math.round(height / 18)));
    wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
  } else {
    wallMat = std(color, 0.9, 0);
  }
  group.add(box(width, height, depth, wallMat, 0, height / 2, 0));
  group.add(box(width + 0.5, 0.5, depth + 0.5, std(roofColor, 0.9, 0), 0, height + 0.25, 0));
  group.add(box(width + 0.2, 0.9, depth + 0.2, std(0x5a5148, 0.95, 0), 0, 0.45, 0));
  // A small roof box so the skyline is not perfectly flat.
  if (height > 14) {
    group.add(box(width * 0.3, 1.6, depth * 0.3, std(roofColor, 0.9, 0), width * 0.2, height + 1.3, -depth * 0.15));
  }
  return group;
}

// A street tree: a trunk and two rounded foliage spheres.
export function buildTreeMesh() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 8), std(0x6b4a2f, 0.95, 0));
  trunk.position.y = 0.8;
  group.add(trunk);
  const leaves = std(0x3f7d44, 0.9, 0);
  const low = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), leaves);
  low.position.y = 2.2;
  low.scale.y = 0.85;
  group.add(low);
  const high = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), std(0x4c9153, 0.9, 0));
  high.position.set(0.3, 3.1, 0.2);
  group.add(high);
  return group;
}

// The Bayfront Plaza fountain: a stone basin, still blue water, a centre
// column and a top dish. `waterMaterial` may carry the shared water shader.
export function buildFountainMesh(waterMaterial = null) {
  const group = new THREE.Group();
  const stone = std(0xd8cfc0, 0.85, 0);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 24), stone);
  basin.position.y = 0.45;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.9, 3.9, 0.2, 24),
    waterMaterial ||
      new THREE.MeshStandardMaterial({ color: 0x2f8fc4, roughness: 0.15, metalness: 0.1 }),
  );
  water.position.y = 0.85;
  group.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 12), stone);
  column.position.y = 1.9;
  group.add(column);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 0.5, 16), stone);
  dish.position.y = 3.1;
  group.add(dish);
  return group;
}
