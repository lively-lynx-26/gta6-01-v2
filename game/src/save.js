// Solmar Bay — Neon Tide: saving. Progress is kept in the browser under one
// key; reloading the page offers CONTINUE when a save exists. Saving never
// throws: if storage is unavailable the game simply carries on unsaved.

import { CFG } from './config.js';

const KEY = CFG.saveKey;

export function hasSave() {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      mission: state.mission,
      stars: state.stars,
      onFoot: state.onFoot,
      carType: state.carType,
      x: state.x,
      z: state.z,
      heading: state.heading,
      rep: state.rep ?? 0,
      armor: state.armor ?? 0,
      weapons: state.weapons ?? { smg: false, shotgun: false, bat: false, rifle: false },
      engineLevel: state.engineLevel ?? 0,
      armorLevel: state.armorLevel ?? 0,
      nitro: state.nitro ?? false,
      safehouse: state.safehouse ?? false,
      properties: state.properties ?? { penthouse: false, taxico: false },
      bestJump: state.bestJump ?? { air: 0, dist: 0 },
      carsStolen: state.carsStolen ?? 0,
      copsLost: state.copsLost ?? 0,
      ownedCars: state.ownedCars ?? [],
      shellsFound: state.shellsFound ?? 0,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
