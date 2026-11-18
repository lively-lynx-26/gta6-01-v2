// Solmar Bay — Neon Tide: the full city map screen. M opens a map of the
// whole city over the game: the street lattice, the districts with their
// names, the landmarks (garage, gun shop, safehouse, hospital, police,
// spray bay), the mission list with status and pay, and the player's
// stats — cash, REP, jobs done, cars stolen, cops lost, completion and
// shells. It is a real screen, not a picture: it draws from live game
// state, and the screenshot scene shows it open.

import { STREETS } from './traffic.js';
import { DISTRICTS, LANDMARKS, districtAt } from './districts.js';
import { MISSIONS } from './missions.js';
import { repTier, repProgress } from './rep.js';
import { CFG } from './config.js';

const MIN_X = -210;
const MAX_X = 210;
const MIN_Z = -210;
const MAX_Z = 230;

export class CityMap {
  constructor(overlayEl) {
    this.overlay = overlayEl;
    this.canvas = overlayEl.querySelector('#map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.sx = this.w / (MAX_X - MIN_X);
    this.sy = this.h / (MAX_Z - MIN_Z);
    this.missionsEl = overlayEl.querySelector('#map-missions');
    this.statsEl = overlayEl.querySelector('#map-stats');
    this.openFlag = false;
  }

  _x(wx) {
    return (wx - MIN_X) * this.sx;
  }

  _y(wz) {
    return (wz - MIN_Z) * this.sy;
  }

  open() {
    this.openFlag = true;
    this.overlay.style.display = 'flex';
  }

  close() {
    this.openFlag = false;
    this.overlay.style.display = 'none';
  }

  get isOpen() {
    return this.openFlag;
  }

  // Completion: the story jobs count most, the shells the rest.
  static completion(missionsDone, shellsFound) {
    return Math.min(100, Math.round((missionsDone / MISSIONS.length) * 85 + (shellsFound / CFG.shells) * 15));
  }

  // `state` is { player, traffic, police, missions, side, time,
  // carsStolen, copsLost, raceWon, safehouse }.
  draw(state) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a141c';
    ctx.fillRect(0, 0, w, h);

    // Ocean and beach, south of the city; the Marina basin on the east.
    ctx.fillStyle = 'rgba(47, 143, 196, 0.9)';
    ctx.fillRect(this._x(MIN_X), this._y(192), w, this._y(MAX_Z) - this._y(192));
    ctx.fillRect(this._x(147), this._y(-62), this._x(193) - this._x(147), this._y(14) - this._y(-62));
    ctx.fillStyle = 'rgba(214, 193, 150, 0.7)';
    ctx.fillRect(this._x(MIN_X), this._y(192), w, this._y(216) - this._y(192));

    // District blocks: faint fills.
    for (const d of DISTRICTS) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(this._x(d.x0), this._y(d.z0), (d.x1 - d.x0) * this.sx, (d.z1 - d.z0) * this.sy);
    }

    // Streets: the road lattice.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.5;
    for (const line of STREETS) {
      ctx.beginPath();
      ctx.moveTo(this._x(line), this._y(-192));
      ctx.lineTo(this._x(line), this._y(192));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this._x(-192), this._y(line));
      ctx.lineTo(this._x(192), this._y(line));
      ctx.stroke();
    }

    // Plaza ring and the Docks bar.
    ctx.strokeStyle = 'rgba(255, 201, 62, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this._x(0), this._y(0), 40 * this.sx, 0, Math.PI * 2);
    ctx.stroke();

    // District names, drawn after the ring so the ring never strikes
    // through them. Each label is clamped by its measured width so it
    // cannot run off the canvas edge (Sunset Row, the Marina), kept
    // above the bottom strip (Coral Shore), and nudged up when a
    // landmark badge would sit on it (the Safehouse badge on Sunset Row).
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const tw = ctx.measureText(d.name).width;
      let cx = this._x((d.x0 + d.x1) / 2);
      let cy = this._y((d.z0 + d.z1) / 2);
      cx = Math.max(tw / 2 + 8, Math.min(w - tw / 2 - 8, cx));
      cy = Math.max(14, Math.min(h - 34, cy));
      for (const lm of LANDMARKS) {
        const lx = this._x(lm.x);
        const ly = this._y(lm.z);
        if (Math.abs(lx - cx) < tw / 2 + 14 && Math.abs(ly - cy) < 16) cy -= 24;
      }
      cy = Math.max(14, Math.min(h - 34, cy));
      ctx.strokeStyle = 'rgba(10, 20, 28, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(d.name, cx, cy);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(d.name, cx, cy);
    }

    // Landmarks: letter badges.
    ctx.font = 'bold 12px system-ui, sans-serif';
    for (const lm of LANDMARKS) {
      const px = this._x(lm.x);
      const py = this._y(lm.z);
      ctx.fillStyle = '#ffc93e';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.fillText(lm.icon, px, py + 4);
    }

    // Mission waypoint: a pulsing gold diamond.
    const wp = state.missions.waypoint;
    if (wp) {
      const px = this._x(wp.x);
      const py = this._y(wp.z);
      const pulse = 6 + Math.sin(state.time * 3) * 2;
      ctx.fillStyle = '#ffc93e';
      ctx.beginPath();
      ctx.moveTo(px, py - pulse - 3);
      ctx.lineTo(px + pulse + 3, py);
      ctx.lineTo(px, py + pulse + 3);
      ctx.lineTo(px - pulse - 3, py);
      ctx.closePath();
      ctx.fill();
    }

    // Traffic dots, police cruisers, and the player arrow.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const car of state.traffic.cars) {
      ctx.beginPath();
      ctx.arc(this._x(car.x), this._y(car.z), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const flashRed = Math.sin(state.time * 11) > 0;
    ctx.fillStyle = flashRed ? '#ff3333' : '#3388ff';
    for (const c of state.police.cruisers) {
      if (c.state !== 'chase') continue;
      ctx.beginPath();
      ctx.arc(this._x(c.x), this._y(c.z), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(this._x(p.x), this._y(p.z));
    ctx.rotate(-p.heading);
    ctx.fillStyle = '#ffc93e';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(-6.5, -6);
    ctx.lineTo(0, -2);
    ctx.lineTo(6.5, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // District under the player, on its own dark strip at the bottom
    // of the canvas, so it never collides with a district label.
    const d = districtAt(p.x, p.z);
    ctx.fillStyle = 'rgba(8, 16, 24, 0.92)';
    ctx.fillRect(0, h - 24, w, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d ? `${d.name} — ${d.tagline}` : 'SOLMAR BAY', 10, h - 8);

    // Mission list with status and pay.
    let html = '';
    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const status = i < state.missions.index ? 'DONE' : (i === state.missions.index ? 'ACTIVE' : 'LOCKED');
      const cls = status === 'DONE' ? 'map-done' : (status === 'ACTIVE' ? 'map-active' : 'map-locked');
      html += `<div class="map-job ${cls}"><span>${m.title}</span><span>$${m.pay.toLocaleString('en-US')}</span><span>${status}</span></div>`;
    }
    this.missionsEl.innerHTML = html;

    // Stats.
    const tier = repTier(p.rep);
    const done = state.missions.index;
    const comp = CityMap.completion(done, state.side.shellsFound);
    this.statsEl.innerHTML = `
      <div>CASH <b>$${p.cash.toLocaleString('en-US')}</b></div>
      <div>REP <b>${p.rep.toLocaleString('en-US')} — ${tier.name}</b> (${Math.round(repProgress(p.rep) * 100)}% to next)</div>
      <div>JOBS DONE <b>${done} / ${MISSIONS.length}</b></div>
      <div>CARS STOLEN <b>${state.carsStolen}</b></div>
      <div>COPS LOST <b>${state.copsLost}</b></div>
      <div>GOLDEN SHELLS <b>${state.side.shellsFound} / ${CFG.shells}</b></div>
      <div>COMPLETION <b>${comp}%</b></div>
      <div>SAFEHOUSE <b>${state.safehouse ? 'OWNED' : '—'}</b></div>`;
  }
}
