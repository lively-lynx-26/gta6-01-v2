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

// A car, built from boxes, cylinders and spheres. Faces +z (its heading).
// type is one of the CFG.cars keys; color is the paint colour.
export function buildCarMesh(type, color) {
  const group = new THREE.Group();
  const paint = std(color, 0.35, 0.45);
  const glass = std(0x1a2a33, 0.15, 0.6);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);

  if (type === 'sport') {
    // Comet GT: low, long hood, rear spoiler.
    group.add(box(1.9, 0.55, 4.6, paint, 0, 0.55, 0));
    group.add(box(1.7, 0.5, 2.0, glass, 0, 1.05, -0.3));
    group.add(box(1.8, 0.08, 0.5, dark, 0, 0.95, 2.05)); // spoiler
    group.add(box(0.5, 0.08, 0.08, dark, -0.6, 0.95, 2.28));
    group.add(box(0.5, 0.08, 0.08, dark, 0.6, 0.95, 2.28));
  } else if (type === 'van') {
    group.add(box(2.0, 1.5, 4.8, paint, 0, 1.05, 0));
    group.add(box(1.9, 0.6, 1.2, glass, 0, 1.55, 1.4));
    group.add(box(1.9, 0.5, 0.4, glass, 0, 1.5, -2.2));
  } else if (type === 'hauler') {
    // Vault Hauler: heavy armoured box with plate seams and a roof light bar.
    group.add(box(2.2, 1.7, 5.2, paint, 0, 1.15, 0));
    group.add(box(2.24, 0.3, 1.0, dark, 0, 1.15, 1.2));
    group.add(box(2.24, 0.3, 1.0, dark, 0, 1.15, -1.2));
    group.add(box(1.2, 0.25, 0.5, std(0x30343c, 0.5, 0.4), 0, 2.1, 0.6));
  } else {
    // Sedan / cab: classic three-box shape.
    group.add(box(1.9, 0.7, 4.4, paint, 0, 0.62, 0));
    group.add(box(1.7, 0.62, 2.2, glass, 0, 1.22, -0.25));
    group.add(box(1.72, 0.1, 2.0, paint, 0, 1.56, -0.25)); // roof
    if (type === 'cab') {
      group.add(box(0.9, 0.22, 0.4, std(0x111111, 0.6, 0.2), 0, 1.72, -0.25)); // taxi sign
    }
  }

  // Wheels: dark cylinders with chrome hubs.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.85, 0.36, 1.45],
    [0.85, 0.36, 1.45],
    [-0.85, 0.36, -1.45],
    [0.85, 0.36, -1.45],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, y, z);
    group.add(wheel);
    const hub = new THREE.Mesh(hubGeo, chrome);
    hub.position.set(x, y, z);
    group.add(hub);
  }

  // Headlights and tail lights.
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
  group.add(box(0.42, 0.16, 0.06, headMat, -0.6, 0.72, 2.21));
  group.add(box(0.42, 0.16, 0.06, headMat, 0.6, 0.72, 2.21));
  group.add(box(0.42, 0.14, 0.06, tailMat, -0.6, 0.72, -2.21));
  group.add(box(0.42, 0.14, 0.06, tailMat, 0.6, 0.72, -2.21));

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

// A Solmar Bay Police cruiser: a white sedan with black doors, a light bar
// and a push bumper. The light bar's two lamps are kept in userData so the
// police module can flash them red and blue.
export function buildPoliceCarMesh() {
  const group = new THREE.Group();
  const white = std(0xf2f2f2, 0.35, 0.4);
  const black = std(0x14161a, 0.5, 0.2);
  const glass = std(0x1a2a33, 0.15, 0.6);
  const dark = std(0x14161a, 0.9, 0.1);
  const chrome = std(0xc8ccd2, 0.25, 0.9);

  group.add(box(1.9, 0.7, 4.4, white, 0, 0.62, 0));
  group.add(box(1.7, 0.62, 2.2, glass, 0, 1.22, -0.25));
  group.add(box(1.72, 0.1, 2.0, white, 0, 1.56, -0.25)); // roof
  // Black doors and hood: the classic two-tone livery.
  group.add(box(1.92, 0.55, 1.5, black, 0, 0.62, -0.1));
  group.add(box(1.92, 0.2, 0.9, black, 0, 0.85, 1.75));
  // Push bumper at the front.
  group.add(box(1.7, 0.28, 0.18, dark, 0, 0.5, 2.24));

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateZ(Math.PI / 2);
  for (const [x, y, z] of [[-0.85, 0.36, 1.45], [0.85, 0.36, 1.45], [-0.85, 0.36, -1.45], [0.85, 0.36, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, y, z);
    group.add(wheel);
    const hub = new THREE.Mesh(hubGeo, chrome);
    hub.position.set(x, y, z);
    group.add(hub);
  }

  // Light bar: red on the driver's side, blue on the other, both glowing.
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0xff2222, emissiveIntensity: 0.6, roughness: 0.3 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1133cc, emissive: 0x2244ff, emissiveIntensity: 0.6, roughness: 0.3 });
  const redLamp = box(0.55, 0.18, 0.3, redMat, -0.42, 1.72, -0.25);
  const blueLamp = box(0.55, 0.18, 0.3, blueMat, 0.42, 1.72, -0.25);
  group.add(redLamp);
  group.add(blueLamp);
  group.add(box(1.2, 0.08, 0.36, dark, 0, 1.66, -0.25)); // bar base
  group.userData.lightRed = redLamp;
  group.userData.lightBlue = blueLamp;

  // Headlights and tail lights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xfff2b0, emissiveIntensity: 0.7, roughness: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xcc2222, emissiveIntensity: 0.6, roughness: 0.3 });
  group.add(box(0.42, 0.16, 0.06, headMat, -0.6, 0.72, 2.21));
  group.add(box(0.42, 0.16, 0.06, headMat, 0.6, 0.72, 2.21));
  group.add(box(0.42, 0.14, 0.06, tailMat, -0.6, 0.72, -2.21));
  group.add(box(0.42, 0.14, 0.06, tailMat, 0.6, 0.72, -2.21));

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
