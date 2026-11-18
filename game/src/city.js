// Solmar Bay — Neon Tide: city generation. The city is built from one fixed
// seed, so it is identical on every run: eight blocks by eight blocks of
// streets, a Bayfront Plaza with a fountain at the centre, the Docks on the
// south edge, the Marina on the east edge, and the beach and the ocean beyond
// the south edge. This module also owns the collision data: every building is
// an axis-aligned box the player and cars slide around.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range, int, pick, shuffled } from './random.js';
import { buildBuildingMesh, buildBikeMesh, buildCarMesh, buildFountainMesh, buildTreeMesh } from './models.js';
import { buildTextures } from './textures.js';
import { makeWaterMaterial } from './shaders.js';
import { resolveCircle, clampToBounds } from './physics.js';

// Re-exported for the modules that learned them from here (player, traffic).
export { resolveCircle, clampToBounds };

function flat(color, roughness = 0.95) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

export function buildCity(scene) {
  const rng = makeRng(CFG.seed);
  const colliders = [];
  const parkedCars = [];
  const trees = [];
  const textures = buildTextures(CFG.seed);
  const water = makeWaterMaterial();

  // --- Roads: the drivable lattice. Street centrelines run every 48 m and
  // each street is 12 m wide, so a point is on a road when it lies within
  // a street band (plus a small trunk clearance) on either axis — that
  // covers streets, driving lanes and intersections. No tree may stand in
  // a road: every tree planted below goes through plantTree, which nudges
  // any candidate off the road (and out of water and buildings) first.
  const STREET_LINES = [-192, -144, -96, -48, 0, 48, 96, 144, 192];
  const ROAD_HALF = CFG.streetWidth / 2; // 6 m
  const TREE_CLEARANCE = 0.5; // a trunk centre must clear the road edge by this
  function isOnRoad(x, z) {
    for (const line of STREET_LINES) {
      if (Math.abs(x - line) <= ROAD_HALF + TREE_CLEARANCE) return true;
      if (Math.abs(z - line) <= ROAD_HALF + TREE_CLEARANCE) return true;
    }
    return false;
  }
  // Open water: the Marina basin and the ocean. Trees never stand in it.
  function isWater(x, z) {
    if (z >= 216) return true; // the ocean, south of the beach
    return x >= 147 && x <= 193 && z >= -62 && z <= 14; // the Marina basin
  }
  // A spot is blocked for a tree when it is on a road, in water, or inside
  // a building (or pier) collider.
  function isBlocked(x, z) {
    if (isOnRoad(x, z) || isWater(x, z)) return true;
    for (const c of colliders) {
      if (x >= c.minX - 0.5 && x <= c.maxX + 0.5 && z >= c.minZ - 0.5 && z <= c.maxZ + 0.5) return true;
    }
    return false;
  }
  // Deterministically nudge a tree spot to the nearest free spot: try
  // offsets in a widening ring until one is free (roads are 12 m wide, so
  // a shift of at most ~8 m always escapes one; the ring reaches 16 m).
  // A spot already free is returned unchanged. Null only if nothing
  // nearby is free — then the tree is not planted at all.
  function offRoadSpot(x, z) {
    if (!isBlocked(x, z)) return { x, z };
    const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let r = 2; r <= 16; r += 2) {
      for (const [dx, dz] of steps) {
        const nx = x + dx * r;
        const nz = z + dz * r;
        if (!isBlocked(nx, nz)) return { x: nx, z: nz };
      }
    }
    return null;
  }
  // Plant one tree, but never in a road (nor in water or a building): the
  // candidate spot is nudged to the nearest free spot first. The mesh is
  // already built, so the seeded stream is untouched by the nudge.
  function plantTree(tree) {
    const spot = offRoadSpot(tree.position.x, tree.position.z);
    if (!spot) return false;
    tree.position.set(spot.x, tree.position.y, spot.z);
    scene.add(tree);
    trees.push(tree);
    return true;
  }

  // --- Ground: one asphalt sheet for the whole city, then raised concrete
  // pads for each block, sand for the beach and water for the ocean. The
  // ground material is kept so the weather can darken and slick it when
  // it rains.
  const groundMat = new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 26),
    new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.95, metalness: 0 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.06, 204);
  scene.add(beach);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), water);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.03, 366);
  scene.add(ocean);

  // Marina basin: open water cut into the east edge.
  const marinaWater = new THREE.Mesh(new THREE.PlaneGeometry(46, 76), water);
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(170, 0.08, -24);
  scene.add(marinaWater);

  // --- Lane dashes down the centre of every street, so the road lattice
  // reads as roads and not bare asphalt.
  const dashMat = new THREE.MeshBasicMaterial({ map: textures.laneDash, transparent: true, opacity: 0.85, depthWrite: false });
  const dashGeo = new THREE.PlaneGeometry(384, 0.35);
  for (const line of [-192, -144, -96, -48, 0, 48, 96, 144, 192]) {
    const alongZ = new THREE.Mesh(dashGeo, dashMat);
    alongZ.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    alongZ.position.set(line, 0.02, 0);
    scene.add(alongZ);
    const alongX = new THREE.Mesh(dashGeo, dashMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.02, line);
    scene.add(alongX);
  }

  // Block centres on the 48 m pitch.
  const centres = [];
  for (let i = 0; i < CFG.blocks; i++) centres.push(-168 + i * CFG.blockPitch);

  const inPlaza = (bx, bz) => Math.abs(bx) <= 24 && Math.abs(bz) <= 24;
  const inDocks = (bx, bz) => bz === 168 && bx >= -72 && bx <= 72;
  const inMarina = (bx, bz) => bx === 168 && bz === -24;

  // --- Blocks: concrete pads, buildings, pocket parks.
  for (const bx of centres) {
    for (const bz of centres) {
      if (inPlaza(bx, bz) || inDocks(bx, bz) || inMarina(bx, bz)) continue;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(36, 0.3, 36),
        new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.95, metalness: 0 }),
      );
      pad.position.set(bx, 0.15, bz);
      scene.add(pad);

      const roll = rng();
      if (roll < 0.1) {
        // Pocket park: trees and open grass.
        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(34, 0.35, 34),
          new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.95, metalness: 0 }),
        );
        grass.position.set(bx, 0.18, bz);
        scene.add(grass);
        const count = int(rng, 3, 5);
        for (let t = 0; t < count; t++) {
          const tree = buildTreeMesh(rng, 'shade', textures.bark);
          tree.position.set(bx + range(rng, -13, 13), 0.3, bz + range(rng, -13, 13));
          plantTree(tree);
        }
        continue;
      }
      const distCentre = Math.hypot(bx, bz);
      const tallness = 1 - distCentre / 300; // taller near the centre
      const buildings = roll < 0.62 ? 1 : 2;
      for (let b = 0; b < buildings; b++) {
        const w = range(rng, 14, 28);
        const d = range(rng, 14, 28);
        const h = Math.max(7, range(rng, 9, 20) + tallness * 18);
        const ox = buildings === 1 ? range(rng, -3, 3) : (b === 0 ? -8 : 8) + range(rng, -2, 2);
        const oz = buildings === 1 ? range(rng, -3, 3) : range(rng, -3, 3);
        const x = bx + ox;
        const z = bz + oz;
        const mesh = buildBuildingMesh(w, h, d, pick(rng, CFG.buildingColors), pick(rng, CFG.roofColors), pick(rng, textures.facades));
        mesh.position.set(x, 0.3, z);
        scene.add(mesh);
        // The height rides along so the helicopter knows where the roofs are.
        colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4, h });
      }
    }
  }

  // --- Bayfront Plaza: a stone disc, the fountain, and a ring of trees.
  const plazaDisc = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 0.3, 40), flat(0xd8cfc0));
  plazaDisc.position.set(0, 0.15, 0);
  scene.add(plazaDisc);
  const fountain = buildFountainMesh(water);
  fountain.position.set(0, 0.3, 0);
  scene.add(fountain);
  colliders.push({ minX: -4.6, maxX: 4.6, minZ: -4.6, maxZ: 4.6, h: 3.5 });
  for (let t = 0; t < 10; t++) {
    const angle = (t / 10) * Math.PI * 2;
    const tree = buildTreeMesh(rng, 'shade', textures.bark);
    tree.position.set(Math.cos(angle) * 34, 0.3, Math.sin(angle) * 34);
    plantTree(tree);
  }

  // --- The Docks: warehouses on the south edge and piers over the water.
  for (const wx of [-48, 0, 48]) {
    const warehouse = buildBuildingMesh(30, 9, 20, 0xb09a7a, 0x6f7d8c, pick(rng, textures.facades));
    warehouse.position.set(wx, 0.3, 168);
    scene.add(warehouse);
    colliders.push({ minX: wx - 15.4, maxX: wx + 15.4, minZ: 158, maxZ: 178.4, h: 9 });
  }
  for (const px of [-36, 0, 36]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 44), flat(0x8a6f4d));
    pier.position.set(px, 0.3, 214);
    scene.add(pier);
    // Piers are raised walkways: cars and people stay off them.
    colliders.push({ minX: px - 3, maxX: px + 3, minZ: 192, maxZ: 236, h: 0.6 });
  }

  // --- Street trees in planters along the sidewalks.
  for (let s = 0; s < 34; s++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, [-144, -96, -48, 0, 48, 96, 144]);
    const along = range(rng, -170, 170);
    const tree = buildTreeMesh(rng, 'planter', textures.bark);
    if (vertical) tree.position.set(line + pick(rng, [-7.5, 7.5]), 0, along);
    else tree.position.set(along, 0, line + pick(rng, [-7.5, 7.5]));
    // Keep trees out of the plaza disc and the docks.
    if (Math.hypot(tree.position.x, tree.position.z) < 42) continue;
    if (tree.position.z > 150) continue;
    plantTree(tree);
  }

  // --- Palms along the beach and the Marina: tall curved trunks and
  // fronds where the city meets the water.
  for (let p = 0; p < 10; p++) {
    const x = -170 + p * 36 + range(rng, -8, 8);
    if (Math.abs(x + 36) < 8 || Math.abs(x) < 8 || Math.abs(x - 36) < 8) continue; // keep the piers clear
    const palm = buildTreeMesh(rng, 'palm', textures.bark);
    palm.position.set(x, 0, p % 2 === 0 ? 198 : 210);
    plantTree(palm);
  }
  for (const [px, pz] of [[142, -52], [142, -24], [142, 4], [150, -38]]) {
    const palm = buildTreeMesh(rng, 'palm', textures.bark);
    palm.position.set(px, 0, pz);
    plantTree(palm);
  }

  // --- Parked cars: ten of them along the streets, one Comet GT and one
  // Bay Cab among them. A parked car is a stealable car. Each car retries
  // until its spot is clear of the plaza and the docks, so every type in
  // the fleet — the Comet GT included — is really parked somewhere.
  const types = shuffled(rng, ['comet', 'cab', 'sedan', 'sedan', 'sedan', 'van', 'sedan', 'hauler', 'sedan', 'van']);
  const lines = [-144, -96, -48, 0, 48, 96, 144];
  for (let i = 0; i < CFG.parkedCars; i++) {
    const type = types[i % types.length];
    let x = 0;
    let z = 0;
    let heading = 0;
    let placed = false;
    for (let attempt = 0; attempt < 12 && !placed; attempt++) {
      const vertical = rng() < 0.5;
      const line = pick(rng, lines);
      const along = range(rng, -160, 160);
      const side = pick(rng, [-1, 1]);
      x = vertical ? line + side * 4.2 : along;
      z = vertical ? along : line + side * 4.2;
      if (Math.hypot(x, z) < 44) continue; // keep the plaza clear
      if (z > 150) continue; // keep the docks clear
      heading = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      placed = true;
    }
    if (!placed) {
      // Fallback: a quiet stretch of the west edge, far from the plaza.
      x = -188;
      z = -160 + i * 8;
      heading = 0;
    }
    const spec = CFG.cars[type];
    const mesh = buildCarMesh(spec.body, spec.color, type);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    parkedCars.push({ type, spec, x, z, heading, mesh, taken: false });
  }

  // Two fixed vehicles give the Marina and the Docks their working
  // traffic: a cab waiting by the Marina basin, a delivery van at the
  // warehouses. Fixed spots, so the random stream is untouched.
  const fixedParked = [
    { type: 'cab', x: 140, z: -43.8, heading: Math.PI / 2 },
    { type: 'van', x: -52.2, z: 148, heading: 0 },
  ];
  for (const spot of fixedParked) {
    const spec = CFG.cars[spot.type];
    const mesh = buildCarMesh(spec.body, spec.color, spot.type);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    parkedCars.push({ type: spot.type, spec, x: spot.x, z: spot.z, heading: spot.heading, mesh, taken: false });
  }

  // Two bikes parked on the streets: the Nebula R sport bike east of the
  // plaza, the Ironhog cruiser on Sunset Row. They are parked cars, so
  // the player steals them with E like any other ride.
  const bikeSpots = [
    { type: 'sportbike', x: 52.2, z: -24, heading: Math.PI },
    { type: 'cruiser', x: 144, z: 100.2, heading: Math.PI / 2 },
  ];
  for (const spot of bikeSpots) {
    const spec = CFG.cars[spot.type];
    const mesh = buildBikeMesh(spot.type, spec.color);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    parkedCars.push({ type: spot.type, spec, x: spot.x, z: spot.z, heading: spot.heading, mesh, taken: false });
  }

  return {
    colliders,
    parkedCars,
    trees,
    plaza: { x: 0, z: 0 },
    docks: { x: 0, z: 168 },
    marina: { x: 168, z: -24 },
    water, // the shared water shader material; the main loop animates it
    groundMat, // the asphalt material; the weather darkens it when it rains
  };
}
