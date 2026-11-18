// Solmar Bay — Neon Tide: Rosa's Garage, the gun shop and the safehouse.
// Near the garage, E opens the shop: engine and armour upgrades for the
// car Dario drives, nitro for a boost, a respray that clears the wanted
// level, the gun shop (SMG and shotgun, bought early or earned on jobs),
// and the safehouse — buy it once, and visiting it heals Dario and saves
// the game. Every purchase checks the cash first and says so when it
// cannot be afforded.

import { CFG } from './config.js';

function recolorCar(car, color) {
  const old = car.spec.color;
  car.mesh.traverse((child) => {
    if (!child.isMesh) return;
    const mat = child.material;
    if (mat && mat.isMeshStandardMaterial && mat.color && mat.color.getHex() === old) {
      mat.color.setHex(color);
    }
  });
  car.paint = color;
}

export class Garage {
  constructor(overlayEl, player, police, audio, properties = null) {
    this.overlay = overlayEl;
    this.player = player;
    this.police = police;
    this.audio = audio;
    this.properties = properties; // the penthouse and the taxi company
    this.msgEl = overlayEl.querySelector('#garage-msg');
    this.openFlag = false;
    this.paintIndex = 0;
    // Bind every buy button by its data-buy attribute.
    for (const btn of overlayEl.querySelectorAll('[data-buy]')) {
      btn.addEventListener('click', () => this.buy(btn.getAttribute('data-buy')));
    }
    overlayEl.querySelector('#garage-close').addEventListener('click', () => this.close());
  }

  open() {
    this.openFlag = true;
    this.overlay.style.display = 'flex';
    this.refresh();
  }

  close() {
    this.openFlag = false;
    this.overlay.style.display = 'none';
  }

  get isOpen() {
    return this.openFlag;
  }

  _say(text) {
    this.msgEl.textContent = text;
  }

  _spend(amount) {
    if (this.player.cash < amount) {
      this._say(`Not enough cash — need $${amount.toLocaleString('en-US')}.`);
      return false;
    }
    this.player.cash -= amount;
    return true;
  }

  refresh() {
    const p = this.player;
    const set = (kind, text, disabled) => {
      const btn = this.overlay.querySelector(`[data-buy="${kind}"]`);
      if (!btn) return;
      btn.textContent = text;
      btn.disabled = disabled;
    };
    set('engine', `ENGINE Lv${p.engineLevel}/3 — $${CFG.garage.enginePrice}`, p.engineLevel >= 3);
    set('armor', `ARMOR Lv${p.armorLevel}/3 — $${CFG.garage.armorPrice}`, p.armorLevel >= 3);
    set('nitro', p.nitro ? 'NITRO — OWNED' : `NITRO — $${CFG.garage.nitroPrice}`, p.nitro);
    set('respray', `RESPRAY — $${CFG.garage.resprayPrice} (clears wanted)`, false);
    set('smg', p.weapons.smg ? 'SQUALL SMG — OWNED' : `SQUALL SMG — $${CFG.smg.price}`, p.weapons.smg);
    set('shotgun', p.weapons.shotgun ? 'BREAKER 12 — OWNED' : `BREAKER 12 — $${CFG.shotgun.price}`, p.weapons.shotgun);
    set('bat', p.weapons.bat ? 'BASEBALL BAT — OWNED' : `BASEBALL BAT — $${CFG.bat.price}`, p.weapons.bat);
    set('rifle', p.weapons.rifle ? 'LONGSHOT RIFLE — OWNED' : `LONGSHOT RIFLE — $${CFG.rifle.price}`, p.weapons.rifle);
    set('safehouse', p.safehouse ? 'SAFEHOUSE — OWNED' : `SAFEHOUSE — $${CFG.garage.safehousePrice}`, p.safehouse);
    const props = this.properties;
    set('penthouse', !props ? 'PENTHOUSE — —' : props.penthouse ? 'PENTHOUSE — OWNED'
      : `PENTHOUSE — $${CFG.properties.penthouse.price} (heals + armour)`, !props || props.penthouse);
    set('taxico', !props ? 'BAY CAB CO. — —' : props.taxico ? 'BAY CAB CO. — OWNED'
      : `BAY CAB CO. — $${CFG.properties.taxico.price} (pays $${CFG.properties.taxico.payAmount} / ${CFG.properties.taxico.payEvery}s)`, !props || props.taxico);
    this._say(`Cash $${p.cash.toLocaleString('en-US')} — Rosa's Garage, Dario.`);
  }

  buy(kind) {
    const p = this.player;
    if (kind === 'engine') {
      if (p.engineLevel >= 3) return;
      if (!this._spend(CFG.garage.enginePrice)) return;
      p.engineLevel += 1;
      this._say(`Engine Lv${p.engineLevel} — faster off the line.`);
    } else if (kind === 'armor') {
      if (p.armorLevel >= 3) return;
      if (!this._spend(CFG.garage.armorPrice)) return;
      p.armorLevel += 1;
      p.carHealthMax = 100 + 50 * p.armorLevel;
      this._say(`Armor Lv${p.armorLevel} — max car health ${p.carHealthMax}.`);
    } else if (kind === 'nitro') {
      if (p.nitro) return;
      if (!this._spend(CFG.garage.nitroPrice)) return;
      p.nitro = true;
      this._say('Nitro fitted — hold Shift while driving.');
    } else if (kind === 'respray') {
      if (!this._spend(CFG.garage.resprayPrice)) return;
      this.paintIndex = (this.paintIndex + 1) % CFG.garage.paintColors.length;
      const color = CFG.garage.paintColors[this.paintIndex];
      if (p.car) recolorCar(p.car, color);
      this.police.setStars(0);
      this._say('Fresh paint — the heat is off, for now.');
    } else if (kind === 'smg') {
      if (p.weapons.smg) return;
      if (!this._spend(CFG.smg.price)) return;
      p.weapons.smg = true;
      p.ammoSmg = CFG.smg.magazine;
      this._say('Squall SMG — slot 4. Keep it clean.');
    } else if (kind === 'shotgun') {
      if (p.weapons.shotgun) return;
      if (!this._spend(CFG.shotgun.price)) return;
      p.weapons.shotgun = true;
      p.ammoShotgun = CFG.shotgun.magazine;
      this._say('Breaker 12 — slot 5. Close range only.');
    } else if (kind === 'bat') {
      if (p.weapons.bat) return;
      if (!this._spend(CFG.bat.price)) return;
      p.weapons.bat = true;
      this._say('Baseball bat — slot 2. Quiet work.');
    } else if (kind === 'rifle') {
      if (p.weapons.rifle) return;
      if (!this._spend(CFG.rifle.price)) return;
      p.weapons.rifle = true;
      p.ammoRifle = CFG.rifle.magazine;
      this._say('Longshot Rifle — slot 6. Two hits drop a goon.');
    } else if (kind === 'safehouse') {
      if (p.safehouse) return;
      if (!this._spend(CFG.garage.safehousePrice)) return;
      p.safehouse = true;
      this._say('Safehouse yours — visit it to heal and save.');
    } else if (kind === 'penthouse') {
      if (!this.properties || this.properties.penthouse) return;
      if (!this._spend(CFG.properties.penthouse.price)) return;
      this.properties.buyPenthouse();
      this._say('Harbor Heights penthouse yours — visit it to heal and refill armour.');
    } else if (kind === 'taxico') {
      if (!this.properties || this.properties.taxico) return;
      if (!this._spend(CFG.properties.taxico.price)) return;
      this.properties.buyTaxico();
      this._say(`Bay Cab Co. yours — $${CFG.properties.taxico.payAmount} every ${CFG.properties.taxico.payEvery}s, hands free.`);
    }
    if (this.audio) this.audio.chime();
    this.refresh();
  }
}
