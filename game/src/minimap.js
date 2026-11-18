// Solmar Bay — Neon Tide: the live minimap. A small canvas in the HUD
// that draws the city as the player sees it from above: the street lattice,
// the ocean and the Marina basin, the plaza and the Docks, the mission
// waypoint, traffic cars, police cruisers and the player. North is up,
// the player is a yellow arrow that turns with their heading, and the
// waypoint pulses gold. It draws from live game state every frame, so it
// is a real minimap, not a picture — and in screenshot mode it draws the
// frozen frame, so the shots show it working.

import { STREETS } from './traffic.js';

// World bounds the map shows: the whole city plus the beach and ocean
// strip to the south.
const MIN_X = -210;
const MAX_X = 210;
const MIN_Z = -210;
const MAX_Z = 230;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.sx = this.w / (MAX_X - MIN_X);
    this.sy = this.h / (MAX_Z - MIN_Z);
  }

  _x(wx) {
    return (wx - MIN_X) * this.sx;
  }

  _y(wz) {
    return (wz - MIN_Z) * this.sy;
  }

  // `state` is { player, traffic, police, waypoint, time }.
  draw(state) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Panel: dark glass, so the map reads over any part of the city.
    ctx.fillStyle = 'rgba(8, 16, 24, 0.78)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ocean: the water south of the beach, and the Marina basin.
    ctx.fillStyle = 'rgba(47, 143, 196, 0.85)';
    ctx.fillRect(this._x(MIN_X), this._y(192), w, this._y(MAX_Z) - this._y(192));
    ctx.fillRect(this._x(147), this._y(-62), this._x(193) - this._x(147), this._y(14) - this._y(-62));
    // Beach: the sand strip between the city and the water.
    ctx.fillStyle = 'rgba(214, 193, 150, 0.6)';
    ctx.fillRect(this._x(MIN_X), this._y(192), w, this._y(216) - this._y(192));

    // Streets: the road lattice, light lines on the dark panel.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
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

    // Bayfront Plaza: a ring at the centre. The Docks: a bar on the south
    // edge. Both are landmarks the player navigates by.
    ctx.strokeStyle = 'rgba(255, 201, 62, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this._x(0), this._y(0), 40 * this.sx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.strokeRect(this._x(-72), this._y(158), (72 - -72) * this.sx, (178 - 158) * this.sy);

    // Mission waypoint: a pulsing gold diamond.
    const wp = state.waypoint;
    if (wp) {
      const px = this._x(wp.x);
      const py = this._y(wp.z);
      const pulse = 4 + Math.sin(state.time * 3) * 1.5;
      ctx.fillStyle = '#ffc93e';
      ctx.beginPath();
      ctx.moveTo(px, py - pulse - 2);
      ctx.lineTo(px + pulse + 2, py);
      ctx.lineTo(px, py + pulse + 2);
      ctx.lineTo(px - pulse - 2, py);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 201, 62, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, pulse + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Traffic: small white dots. Parked cars are not shown — the map would
    // drown in them; only moving cars matter.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const car of state.traffic.cars) {
      ctx.beginPath();
      ctx.arc(this._x(car.x), this._y(car.z), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boats: light-blue dots on the water. The helipad: a yellow H on
    // the beach by the Marina. Owned properties: green $ dots.
    if (state.vehicles) {
      ctx.fillStyle = 'rgba(127, 212, 255, 0.9)';
      for (const boat of state.vehicles.boats) {
        ctx.beginPath();
        ctx.arc(this._x(boat.x), this._y(boat.z), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      const hx = this._x(150);
      const hy = this._y(204);
      ctx.fillStyle = '#ffc93e';
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.font = 'bold 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', hx, hy + 2.5);
    }
    if (state.properties) {
      ctx.fillStyle = '#7dff9a';
      ctx.font = 'bold 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const m of state.properties.markers()) {
        const mx = this._x(m.x);
        const my = this._y(m.z);
        ctx.beginPath();
        ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#101820';
        ctx.fillText(m.icon, mx, my + 2.5);
        ctx.fillStyle = '#7dff9a';
      }
    }

    // Police cruisers: flashing red and blue, like their light bars.
    const flashRed = Math.sin(state.time * 11) > 0;
    ctx.fillStyle = flashRed ? '#ff3333' : '#3388ff';
    for (const c of state.police.cruisers) {
      if (c.state !== 'chase') continue;
      ctx.beginPath();
      ctx.arc(this._x(c.x), this._y(c.z), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player: a yellow arrow, turning with their heading. Heading 0
    // faces +z (south, down the map), so the arrow is drawn pointing down
    // and rotated by the negative heading.
    const p = state.player;
    ctx.save();
    ctx.translate(this._x(p.x), this._y(p.z));
    ctx.rotate(-p.heading);
    ctx.fillStyle = '#ffc93e';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(-4.5, -4);
    ctx.lineTo(0, -1.5);
    ctx.lineTo(4.5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label, so the map is readable at a glance in a screenshot.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', 7, 13);
  }
}
