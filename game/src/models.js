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

// --- Motorcycles ------------------------------------------------------------
// A bike, built to lean: two wheels, a tank, a seat, a tail and bars. The
// whole bike hangs in a `lean` child group, so the rider's physics can
// roll it into turns without touching its heading. Faces +z.
// `kind` is 'sportbike' (low, sleek, clip-on bars) or 'cruiser' (high
// bars, fat rear tyre, chrome). userData.lean is the tilt group.
const _bikeTireGeo = new THREE.TorusGeometry(0.3, 0.09, 8, 18);
_bikeTireGeo.rotateY(Math.PI / 2);
const _bikeTireGeoBig = new THREE.TorusGeometry(0.32, 0.12, 8, 18);
_bikeTireGeoBig.rotateY(Math.PI / 2);
const _bikeHubGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.14, 10);
_bikeHubGeo.rotateZ(Math.PI / 2);

export function buildBikeMesh(kind, color) {
  const group = new THREE.Group();
  const lean = new THREE.Group();
  group.add(lean);
  const paint = std(color, 0.35, 0.45);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);
  const glass = std(0x1a2a33, 0.15, 0.6);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c9, emissive: 0xfff2b0, emissiveIntensity: 0.7, roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xaa1111, emissive: 0xcc2222, emissiveIntensity: 0.6, roughness: 0.3,
  });
  const sport = kind === 'sportbike';
  const tireGeo = sport ? _bikeTireGeo : _bikeTireGeoBig;
  for (const z of [0.78, -0.78]) {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(tireGeo, dark));
    wheel.add(new THREE.Mesh(_bikeHubGeo, chrome));
    wheel.position.set(0, 0.3, z);
    lean.add(wheel);
  }
  // Frame: a sloped spine from the steering head to the tail.
  const spine = box(0.14, 0.14, 1.5, dark, 0, 0.55, 0);
  spine.rotation.x = sport ? 0.12 : 0.05;
  lean.add(spine);
  // Tank and seat: a sculpted teardrop over the frame.
  lean.add(new THREE.Mesh(extrudeProfile([
    ['m', -0.55, 0.55], ['l', 0.55, 0.55],
    ['q', 0.58, 0.72, 0.5, 0.85],
    ['l', -0.3, 0.92],
    ['q', -0.55, 0.92, -0.58, 0.75],
  ], 0.5), paint));
  const seat = box(0.42, 0.1, 0.62, dark, 0, 0.82, -0.55);
  lean.add(seat);
  // Tail: a short upswept cowl behind the seat.
  const tail = box(0.34, 0.09, 0.5, paint, 0, 0.86, -0.95);
  tail.rotation.x = sport ? -0.18 : -0.08;
  lean.add(tail);
  lean.add(lens(tailMat, 0, 0.82, -1.18, 0));
  // Front forks and bars.
  for (const side of [-1, 1]) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), chrome);
    fork.position.set(side * 0.09, 0.62, 0.72);
    fork.rotation.x = sport ? 0.42 : 0.28;
    lean.add(fork);
  }
  if (sport) {
    // Sport fairing: a nose cone with a smoked screen, low clip-on bars.
    lean.add(new THREE.Mesh(extrudeProfile([
      ['m', -0.28, 0.5], ['l', 0.28, 0.5],
      ['q', 0.3, 0.75, 0.22, 0.95],
      ['l', -0.22, 0.95],
      ['q', -0.3, 0.75, -0.28, 0.5],
    ], 0.42), paint));
    const screen = box(0.34, 0.05, 0.3, glass, 0, 0.98, 0.62);
    screen.rotation.x = -0.5;
    lean.add(screen);
    for (const side of [-1, 1]) {
      const bar = box(0.3, 0.04, 0.04, dark, side * 0.22, 0.86, 0.55);
      bar.rotation.z = side * 0.15;
      lean.add(bar);
    }
  } else {
    // Cruiser: a round headlamp, high swept bars, fat chrome exhaust.
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), headMat);
    lamp.position.set(0, 0.78, 0.86);
    lamp.scale.set(1, 1, 0.6);
    lean.add(lamp);
    for (const side of [-1, 1]) {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), chrome);
      riser.position.set(side * 0.16, 0.95, 0.5);
      lean.add(riser);
      const bar = box(0.34, 0.04, 0.04, chrome, side * 0.26, 1.12, 0.42);
      bar.rotation.z = side * 0.2;
      lean.add(bar);
    }
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 10), chrome);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.16, 0.28, -0.3);
    lean.add(exhaust);
  }
  lean.add(lens(headMat, 0, 0.72, 0.88, 0));
  group.userData.lean = lean;
  return group;
}

// --- Boats ------------------------------------------------------------------
// A boat, floating at y = 0 with its hull in the water. Faces +z.
// `kind` is 'speedboat' (a white runabout with a windshield and an
// outboard) or 'jetski' (a small personal watercraft).
export function buildBoatMesh(kind, color) {
  const group = new THREE.Group();
  const paint = std(color, 0.35, 0.4);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);
  const glass = std(0x1a2a33, 0.15, 0.6);
  if (kind === 'speedboat') {
    // Hull: a sculpted V-bottom runabout, 5.4 m long.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -2.7, 0.05], ['l', 2.7, 0.05],
      ['q', 2.75, 0.45, 2.55, 0.75],
      ['l', -2.5, 0.75],
      ['q', -2.72, 0.75, -2.7, 0.3],
    ], 2.1), paint));
    const stripe = box(2.0, 0.12, 4.6, std(0x2fd4c4, 0.4, 0.3), 0, 0.42, 0);
    group.add(stripe);
    // Deck, windshield, seats and console.
    group.add(box(1.9, 0.1, 4.4, std(0xe8e8e8, 0.8, 0), 0, 0.78, 0));
    const shield = box(1.5, 0.55, 0.04, glass, 0, 1.1, 0.9);
    shield.rotation.x = -0.35;
    group.add(shield);
    group.add(box(1.5, 0.5, 0.5, dark, 0, 1.0, 0.55)); // console
    for (const z of [-0.4, -1.1]) {
      group.add(box(1.5, 0.45, 0.55, std(0x2b2f38, 0.85, 0), 0, 1.0, z)); // seats
    }
    // Outboard motor at the transom.
    group.add(box(0.5, 0.7, 0.4, dark, 0, 0.45, -2.75));
    group.add(box(0.44, 0.25, 0.5, chrome, 0, 0.05, -2.78));
    // Bow rail.
    for (const side of [-1, 1]) {
      group.add(box(0.04, 0.04, 1.6, chrome, side * 0.85, 1.0, 1.7));
    }
  } else {
    // Jet ski: a compact hull, a saddle seat and a handlebar.
    group.add(new THREE.Mesh(extrudeProfile([
      ['m', -1.5, 0.05], ['l', 1.5, 0.05],
      ['q', 1.55, 0.4, 1.35, 0.6],
      ['l', -1.4, 0.6],
      ['q', -1.52, 0.6, -1.5, 0.3],
    ], 1.05), paint));
    group.add(box(0.9, 0.12, 2.2, dark, 0, 0.62, -0.1)); // saddle
    const bars = box(0.7, 0.06, 0.06, dark, 0, 0.85, 0.95);
    group.add(bars);
    group.add(box(0.08, 0.3, 0.08, chrome, 0, 0.7, 0.95));
    group.add(box(0.5, 0.3, 0.5, dark, 0, 0.75, 1.15)); // nose cowl
  }
  return group;
}

// --- Civilian helicopter -----------------------------------------------------
// The flyable "Maverick": a yellow helicopter with a dark stripe, the same
// silhouette as the police AIR-1 but a civilian paint job. Faces +z.
// userData.rotor and userData.tailRotor spin while it flies.
export function buildHeliMesh(color, stripeColor) {
  const group = new THREE.Group();
  const paint = std(color, 0.4, 0.3);
  const dark = std(0x1a2a33, 0.3, 0.5);
  const stripe = std(stripeColor, 0.4, 0.3);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 4.6), paint);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), dark);
  nose.position.set(0, -0.1, 2.2);
  nose.scale.set(1, 0.85, 0.9);
  group.add(nose);
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.35, 4.0), stripe);
  band.position.y = -0.35;
  group.add(band);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), paint);
  boom.position.set(0, 0.25, -4.2);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 1.1), stripe);
  fin.position.set(0, 0.7, -6.0);
  group.add(fin);
  for (const s of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skid.position.set(s, -1.05, 0.2);
    group.add(skid);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), dark);
  mast.position.y = 1.1;
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.55;
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), dark);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  group.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 0.6, -6.0);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.12), dark);
    blade.rotation.z = a;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  group.userData.rotor = rotor;
  group.userData.tailRotor = tailRotor;
  return group;
}

// Dario on foot: a rounded, stylised figure, about 1.8 m tall, facing +z.
export function buildPersonMesh() {
  return buildPedestrianMesh({ shirt: 0x2e6f8e, pants: 0x2b2f38, skin: 0xc98e6b, hair: true });
}

// A resident (or a goon): a human figure with a head, torso, arms and legs
// in varied heights and clothes, built to walk — every limb hangs from a
// pivot at its joint, and the pivots are kept in userData so the walk cycle
// can swing them. Faces +z. `hair` true means Dario's cap; `hairStyle`
// picks one of 'cap' | 'short' | 'long' | 'bun' | 'none'. `armed` adds a
// pistol in the right hand.
export function buildPedestrianMesh({ shirt, pants, skin, hair = false, armed = false, height = 1, hairStyle = null }) {
  const group = new THREE.Group();
  const skinMat = std(skin, 0.7, 0);
  const shirtMat = std(shirt, 0.8, 0);
  const pantsMat = std(pants, 0.85, 0);
  const shoeMat = std(0x1c1a18, 0.9, 0);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.72, 12), shirtMat);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skinMat);
  head.position.y = 1.62;
  group.add(head);

  const style = hairStyle || (hair ? 'cap' : 'none');
  const hairMat = std(0x1c1410, 0.9, 0);
  if (style === 'cap' || style === 'short') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = 1.65;
    if (style === 'short') cap.scale.y = 0.7;
    group.add(cap);
  } else if (style === 'long') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = 1.65;
    group.add(cap);
    // Hair down to the shoulders at the back.
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.1), hairMat);
    back.position.set(0, 1.38, -0.18);
    group.add(back);
  } else if (style === 'bun') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = 1.65;
    group.add(cap);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    bun.position.set(0, 1.78, -0.16);
    group.add(bun);
  }

  // Legs hang from hip pivots; arms from shoulder pivots. The cylinder
  // sits below its pivot so rotating the pivot swings the limb.
  const limbs = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'L' : 'R';
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.13, 0.68, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.68, 8), pantsMat);
    leg.position.y = -0.34;
    legPivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.3), shoeMat);
    shoe.position.set(0, -0.66, 0.06);
    legPivot.add(shoe);
    group.add(legPivot);
    limbs[`leg${key}`] = legPivot;
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.34, 1.32, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8), shirtMat);
    arm.position.y = -0.3;
    armPivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
    hand.position.y = -0.62;
    armPivot.add(hand);
    group.add(armPivot);
    limbs[`arm${key}`] = armPivot;
  }
  if (armed) {
    // A pistol in the right hand, so it follows the arm's swing.
    const gun = box(0.07, 0.09, 0.34, std(0x14161a, 0.6, 0.4), 0, -0.6, 0.2);
    limbs.armR.add(gun);
  }
  group.userData = { ...limbs, torso, head };
  group.scale.setScalar(height);
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

// --- Realistic trees --------------------------------------------------------
// A street tree is not a lollipop: a tapered trunk with bark, a few branches,
// and a canopy of several foliage clusters of varied size and shade. Palms
// get a curved trunk of stacked segments, a crown of drooping fronds and a
// coconut cluster. Street trees sit in concrete planters. Geometries and
// foliage materials are shared across every tree, so the extra detail costs
// almost no memory; only positions, scales and rotations vary, all from the
// seeded stream the caller passes in.

const _trunkGeo = new THREE.CylinderGeometry(0.12, 0.24, 2.2, 8);
const _branchGeo = new THREE.CylinderGeometry(0.04, 0.09, 1.1, 6);
const _clusterGeo = new THREE.IcosahedronGeometry(1, 0);
const _palmSegGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.5, 8);
_palmSegGeo.translate(0, 0.75, 0); // the segment's base is its origin, so
// stacked segments join end to end without gaps
const _coconutGeo = new THREE.SphereGeometry(0.14, 8, 6);
const _planterGeo = new THREE.BoxGeometry(1.3, 0.55, 1.3);
const _soilGeo = new THREE.BoxGeometry(1.15, 0.1, 1.15);
const _foliageMats = [0x3f7d44, 0x4c9153, 0x2f6b35, 0x5da24f].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, flatShading: true }),
);
const _frondMat = new THREE.MeshStandardMaterial({
  color: 0x3e8f46, roughness: 0.85, metalness: 0, flatShading: true, side: THREE.DoubleSide,
});
const _palmGreenMat = new THREE.MeshStandardMaterial({ color: 0x57a05a, roughness: 0.9, metalness: 0, flatShading: true });
const _concreteMat = std(0x9aa0a3, 0.95, 0);
const _soilMat = std(0x3d2b1d, 1, 0);
const _coconutMat = std(0x6b4a2f, 0.9, 0);

// A palm frond: a long pointed leaf blade, base at the origin, tip at +y.
const _frondShape = new THREE.Shape();
_frondShape.moveTo(0, 0);
_frondShape.quadraticCurveTo(0.36, 0.7, 0.2, 1.5);
_frondShape.quadraticCurveTo(0.09, 2.0, 0, 2.3);
_frondShape.quadraticCurveTo(-0.09, 2.0, -0.2, 1.5);
_frondShape.quadraticCurveTo(-0.36, 0.7, 0, 0);
const _frondGeo = new THREE.ExtrudeGeometry(_frondShape, { depth: 0.02, bevelEnabled: false, curveSegments: 6 });

// One bark material per texture object, cached: every tree shares the one
// bark texture the city builds, so this stays a single material.
const _barkMats = new Map();
function barkMaterial(barkTex) {
  if (!barkTex) return std(0x6b4a2f, 0.95, 0);
  if (!_barkMats.has(barkTex)) {
    _barkMats.set(barkTex, new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.95, metalness: 0 }));
  }
  return _barkMats.get(barkTex);
}

function pickGreen(rng) {
  return _foliageMats[Math.floor(rng() * _foliageMats.length)];
}

// A broadleaf shade tree: tapered bark trunk, branches, and a canopy of
// several clusters. `scale` sizes the whole tree; `clusters` counts the
// canopy blobs. Returns the group, trunk base at the origin.
function shadeTree(rng, barkMat, scale, clusters) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(_trunkGeo, barkMat);
  trunk.position.y = 1.1;
  trunk.rotation.z = (rng() - 0.5) * 0.08; // a trunk is never perfectly straight
  group.add(trunk);
  const branchCount = 2 + Math.floor(rng() * 2);
  for (let b = 0; b < branchCount; b++) {
    const branch = new THREE.Mesh(_branchGeo, barkMat);
    const angle = (b / branchCount) * Math.PI * 2 + rng() * 0.8;
    branch.position.set(Math.cos(angle) * 0.25, 2.1, Math.sin(angle) * 0.25);
    branch.rotation.set(Math.sin(angle) * 0.9, 0, Math.cos(angle) * 0.9);
    group.add(branch);
  }
  // The canopy: one crown cluster on top, the rest spread around it, each
  // a different size and shade so the silhouette is lumpy, not a ball.
  const crownY = 2.9;
  for (let i = 0; i < clusters; i++) {
    const blob = new THREE.Mesh(_clusterGeo, pickGreen(rng));
    const r = 0.55 + rng() * 0.5;
    const a = rng() * Math.PI * 2;
    const rad = i === 0 ? 0 : 0.55 + rng() * 0.45;
    blob.position.set(Math.cos(a) * rad, crownY + (i === 0 ? 0.45 : (rng() - 0.5) * 0.8), Math.sin(a) * rad);
    blob.scale.set(r, r * (0.75 + rng() * 0.2), r);
    blob.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    group.add(blob);
  }
  group.scale.setScalar(scale);
  group.rotation.y = rng() * Math.PI * 2;
  return group;
}

// A palm: a trunk of stacked segments that curves as it rises, a crown of
// drooping fronds and a coconut cluster underneath. Each segment starts
// where the last one ends (stepped back a little along the next segment's
// axis so the joints overlap), so the curve has no gaps.
function palmTree(rng, barkMat) {
  const group = new THREE.Group();
  let bx = 0;
  let by = 0;
  let angle = 0;
  let topX = 0;
  let topY = 0;
  for (let s = 0; s < 4; s++) {
    const seg = new THREE.Mesh(_palmSegGeo, barkMat);
    seg.position.set(bx, by, 0);
    seg.rotation.z = angle;
    group.add(seg);
    topX = bx - 1.5 * Math.sin(angle);
    topY = by + 1.5 * Math.cos(angle);
    const nextAngle = angle - 0.09;
    bx = topX + 0.3 * Math.sin(nextAngle);
    by = topY - 0.3 * Math.cos(nextAngle);
    angle = nextAngle;
  }
  const crown = new THREE.Group();
  crown.position.set(topX, topY - 0.1, 0);
  const fronds = 8;
  for (let f = 0; f < fronds; f++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (f / fronds) * Math.PI * 2 + rng() * 0.3;
    const frond = new THREE.Mesh(_frondGeo, f % 2 === 0 ? _frondMat : _palmGreenMat);
    frond.rotation.x = 1.85 + rng() * 0.35; // arch out and droop
    pivot.add(frond);
    crown.add(pivot);
  }
  // A second, shorter ring of fronds standing more upright fills the crown.
  for (let f = 0; f < 4; f++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (f / 4) * Math.PI * 2 + 0.4 + rng() * 0.3;
    const frond = new THREE.Mesh(_frondGeo, _palmGreenMat);
    frond.scale.setScalar(0.65);
    frond.rotation.x = 1.25 + rng() * 0.25;
    pivot.add(frond);
    crown.add(pivot);
  }
  for (let c = 0; c < 3; c++) {
    const nut = new THREE.Mesh(_coconutGeo, _coconutMat);
    nut.position.set((rng() - 0.5) * 0.4, -0.25, (rng() - 0.5) * 0.4);
    crown.add(nut);
  }
  group.add(crown);
  group.rotation.y = rng() * Math.PI * 2;
  return group;
}

// A tree. `kind` is 'shade' (broadleaf), 'palm' (beach and Marina) or
// 'planter' (a small shade tree in a concrete planter box on the sidewalk).
// `rng` is the caller's seeded stream; `barkTex` the city's bark texture.
export function buildTreeMesh(rng, kind = 'shade', barkTex = null) {
  const barkMat = barkMaterial(barkTex);
  let group;
  if (kind === 'palm') group = palmTree(rng, barkMat);
  else if (kind === 'planter') {
    group = new THREE.Group();
    const planter = new THREE.Mesh(_planterGeo, _concreteMat);
    planter.position.y = 0.275;
    group.add(planter);
    const soil = new THREE.Mesh(_soilGeo, _soilMat);
    soil.position.y = 0.55;
    group.add(soil);
    const tree = shadeTree(rng, barkMat, 0.55 + rng() * 0.15, 4);
    tree.position.y = 0.55;
    group.add(tree);
    group.rotation.y = rng() * Math.PI * 2;
  } else {
    group = shadeTree(rng, barkMat, 0.9 + rng() * 0.45, 5 + Math.floor(rng() * 3));
  }
  group.userData.kind = kind;
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
