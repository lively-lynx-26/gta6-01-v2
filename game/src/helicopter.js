// Solmar Bay — Neon Tide: the police helicopter. At four stars and up
// (and in mission 3) AIR-1 circles above the player: a white fuselage
// with a spinning main rotor and tail rotor, a searchlight cone that
// tracks the player and pools on the ground beneath them, and a soft
// shadow that follows it across the streets. It is a chaser in the sky,
// not a weapon: it watches, and its light gives the player away.

import * as THREE from 'three';
import { CFG } from './config.js';

function std(color, roughness = 0.5, metalness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class Helicopter {
  constructor(scene) {
    this.scene = scene;
    this.angle = 0; // orbit position around the player
    this.rotorAngle = 0;
    this.active = false;
    // The orbit height, smoothed: AIR-1 flies low (16 m) over open
    // ground so the chase camera can see it, and rises to clear the
    // roofs when its orbit carries it over a tall building.
    this.y = 16;
    // A staged orbit radius for screenshots: the live orbit (30 m) keeps
    // the helicopter small in the chase frame; a shot may pull it closer
    // so the mesh reads large against the skyline. Live play leaves it
    // null and flies the normal orbit.
    this.radiusOverride = null;

    const group = new THREE.Group();
    const white = std(0xf2f2f2, 0.4, 0.3);
    const dark = std(0x1a2a33, 0.3, 0.5);
    const stripe = std(0x2456a8, 0.4, 0.3);

    // Fuselage: a rounded body with a glass nose and a blue stripe.
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 4.6), white);
    body.position.y = 0;
    group.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), dark);
    nose.position.set(0, -0.1, 2.2);
    nose.scale.set(1, 0.85, 0.9);
    group.add(nose);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.35, 4.0), stripe);
    band.position.y = -0.35;
    group.add(band);
    // Tail boom and fin.
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), white);
    boom.position.set(0, 0.25, -4.2);
    group.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 1.1), stripe);
    fin.position.set(0, 0.7, -6.0);
    group.add(fin);
    // Landing skids.
    for (const s of [-0.9, 0.9]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
      skid.position.set(s, -1.05, 0.2);
      group.add(skid);
    }
    // Main rotor: two long blades on a mast, spinning fast.
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), dark);
    mast.position.y = 1.1;
    group.add(mast);
    this.rotor = new THREE.Group();
    this.rotor.position.y = 1.55;
    for (const a of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), dark);
      blade.rotation.y = a;
      this.rotor.add(blade);
    }
    group.add(this.rotor);
    // Tail rotor: a small cross at the fin, spinning sideways.
    this.tailRotor = new THREE.Group();
    this.tailRotor.position.set(0.35, 0.6, -6.0);
    for (const a of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.12), dark);
      blade.rotation.z = a;
      this.tailRotor.add(blade);
    }
    group.add(this.tailRotor);

    // Searchlight: a translucent cone from the belly to the ground, plus
    // the bright pool it throws on the street.
    this.lightGroup = new THREE.Group();
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(6, 1, 20, 1, true), coneMat);
    this.lightGroup.add(this.cone);
    // The light lives in the scene, not in the helicopter group: its aim
    // is computed in world space, and the helicopter's own heading must
    // not rotate it.
    scene.add(this.lightGroup);
    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(6, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.22,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.08;
    scene.add(this.pool);

    // Shadow: a soft dark ellipse on the ground under the helicopter.
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.06;
    scene.add(this.shadow);

    this.mesh = group;
    this.mesh.visible = false;
    this.pool.visible = false;
    this.shadow.visible = false;
    scene.add(this.mesh);
  }

  // One step. `active` is true while the heat calls for air support.
  // The helicopter orbits the player, its rotors spin, and its
  // searchlight tracks the player's position on the ground. `colliders`
  // (with `h`, building height) lets the orbit rise over tall roofs
  // instead of clipping them; without them the low orbit stands.
  update(dt, player, active, colliders = null) {
    this.active = active;
    this.mesh.visible = active;
    this.pool.visible = active;
    this.shadow.visible = active;
    this.lightGroup.visible = active;
    if (!active) return;
    const h = CFG.helicopter;
    this.angle += dt * h.orbitSpeed;
    // Chase mode: in a car at four stars and up, AIR-1 pulls its orbit
    // in close (20 m) and flies low (14–30 m), the way the staged chase
    // shot frames it — so the body reads in the chase-camera frame
    // instead of climbing out of it over the towers. The rooftop
    // clearance still applies, so it never clips a roof.
    const chase = !player.onFoot && !player.flying && (player.stars ?? 0) >= CFG.helicopter.minStars;
    const radius = this.radiusOverride ?? (chase ? 20 : h.circleRadius);
    const x = player.x + Math.cos(this.angle) * radius;
    const z = player.z + Math.sin(this.angle) * radius;
    // Rooftop clearance: the tallest roof near the helicopter sets the
    // orbit height (roof + 4 m), floored at the low orbit and capped so
    // it never climbs out of sight entirely. The height eases toward
    // its target so the helicopter does not pop between roofs. The
    // window is wide (16 m) so the helicopter starts climbing before it
    // reaches a tall tower, not as it arrives over it.
    let targetY = chase ? 14 : 16;
    if (colliders) {
      let maxH = 0;
      for (const b of colliders) {
        if (!b.h) continue;
        if (x >= b.minX - 16 && x <= b.maxX + 16 && z >= b.minZ - 16 && z <= b.maxZ + 16) {
          maxH = Math.max(maxH, b.h);
        }
      }
      if (maxH > 0) targetY = Math.max(targetY, maxH + 4);
    }
    targetY = Math.min(targetY, chase ? 30 : 46);
    this.y += (targetY - this.y) * Math.min(1, dt * 3);
    const y = (this.heightOverride ?? this.y) + Math.sin(this.angle * 0.7) * 2;
    this.mesh.position.set(x, y, z);
    // Face along the orbit, nose forward.
    this.mesh.rotation.y = Math.atan2(
      player.x + Math.cos(this.angle + 0.1) * radius - x,
      player.z + Math.sin(this.angle + 0.1) * radius - z,
    );
    this.rotorAngle += dt * 22;
    this.rotor.rotation.y = this.rotorAngle;
    this.tailRotor.rotation.x = this.rotorAngle * 1.7;
    // The searchlight points from the belly at the player: the cone's
    // apex sits at the helicopter and its base opens on the ground.
    const dx = player.x - x;
    const dy = 0 - y;
    const dz = player.z - z;
    const len = Math.hypot(dx, dy, dz);
    this.lightGroup.position.set(x, y, z);
    this.lightGroup.visible = active;
    this.cone.scale.set(1, len, 1);
    this.cone.position.y = -len / 2;
    const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
    this.lightGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.pool.position.set(player.x, 0.08, player.z);
    this.pool.material.opacity = 0.18 + Math.sin(this.rotorAngle * 0.5) * 0.04;
    this.shadow.position.set(x, 0.06, z);
  }
}
