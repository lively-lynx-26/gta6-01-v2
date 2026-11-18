// Solmar Bay — Neon Tide: properties and businesses. Dario can buy a
// Harbor Heights penthouse — visiting it heals him and refills his
// armour — and a stake in the Bay Cab Co., which pays passive income
// every 45 real seconds. Each property has a beacon in the world: gold
// while it is for sale, green once it is owned. The map and the minimap
// draw owned properties from markers(), so they read as yours.

import * as THREE from 'three';
import { CFG } from './config.js';

function beaconMesh(color) {
  const geo = new THREE.OctahedronGeometry(1.1);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false });
  return new THREE.Mesh(geo, mat);
}

export class Properties {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.time = 0;
    this.penthouse = false; // Harbor Heights penthouse owned
    this.taxico = false; // Bay Cab Co. stake owned
    this.incomeTimer = 0;
    this.penthouseSaved = false; // saved once per penthouse visit
    // Callbacks the main loop wires up: onIncome(amount, label) for the
    // cash and onPopup for the floating text.
    this.onIncome = null;
    this.onPopup = null;
    // One beacon per property, bobbing over its spot.
    this.penthouseBeacon = beaconMesh(0xffc93e);
    this.penthouseBeacon.position.set(CFG.properties.penthouse.x, 2.5, CFG.properties.penthouse.z);
    scene.add(this.penthouseBeacon);
    this.taxicoBeacon = beaconMesh(0xffc93e);
    this.taxicoBeacon.position.set(CFG.properties.taxico.x, 2.5, CFG.properties.taxico.z);
    scene.add(this.taxicoBeacon);
  }

  buyPenthouse() {
    this.penthouse = true;
    this.penthouseBeacon.material.color.setHex(0x7dff9a);
  }

  buyTaxico() {
    this.taxico = true;
    this.incomeTimer = 0;
    this.taxicoBeacon.material.color.setHex(0x7dff9a);
  }

  // Reset for a new game: both properties return to the market.
  reset() {
    this.penthouse = false;
    this.taxico = false;
    this.incomeTimer = 0;
    this.penthouseSaved = false;
    this.penthouseBeacon.material.color.setHex(0xffc93e);
    this.taxicoBeacon.material.color.setHex(0xffc93e);
  }

  // Plain state for saving.
  snapshot() {
    return { penthouse: this.penthouse, taxico: this.taxico };
  }

  restore(data) {
    if (!data) return;
    if (data.penthouse) this.buyPenthouse();
    if (data.taxico) this.buyTaxico();
  }

  // True while Dario stands at the penthouse door.
  nearPenthouse() {
    const ph = CFG.properties.penthouse;
    return Math.hypot(this.player.x - ph.x, this.player.z - ph.z) < ph.radius;
  }

  // Markers for the map screen and the minimap: owned properties only.
  markers() {
    const list = [];
    if (this.penthouse) {
      list.push({ x: CFG.properties.penthouse.x, z: CFG.properties.penthouse.z, icon: '$', label: 'Penthouse' });
    }
    if (this.taxico) {
      list.push({ x: CFG.properties.taxico.x, z: CFG.properties.taxico.z, icon: '$', label: 'Bay Cab Co.' });
    }
    return list;
  }

  // A short label for the map stats: what Dario owns.
  ownedLabel() {
    const owned = [];
    if (this.penthouse) owned.push('Penthouse');
    if (this.taxico) owned.push('Bay Cab Co.');
    return owned.length > 0 ? owned.join(' · ') : '—';
  }

  update(dt) {
    this.time += dt;
    this.penthouseBeacon.position.y = 2.5 + Math.sin(this.time * 2) * 0.3;
    this.penthouseBeacon.rotation.y += dt * 1.5;
    this.taxicoBeacon.position.y = 2.5 + Math.sin(this.time * 2 + 1) * 0.3;
    this.taxicoBeacon.rotation.y += dt * 1.5;
    // The taxi company pays while Dario does anything else.
    if (this.taxico) {
      this.incomeTimer += dt;
      if (this.incomeTimer >= CFG.properties.taxico.payEvery) {
        this.incomeTimer -= CFG.properties.taxico.payEvery;
        const amount = CFG.properties.taxico.payAmount;
        this.player.cash += amount;
        if (this.onIncome) this.onIncome(amount, 'Bay Cab Co.');
        if (this.onPopup) {
          this.onPopup(this.player.x, 2.6, this.player.z, `BAY CAB CO. +$${amount}`, 'rep');
        }
      }
    }
  }
}
