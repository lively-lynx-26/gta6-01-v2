// Solmar Bay — Neon Tide: dialogue. Named characters brief the missions
// in a dialogue box at the bottom of the screen, with a drawn portrait:
// Rosa runs the garage, Vince Marlowe is the fixer who betrays her, and
// Sergeant Fenn runs police dispatch. Portraits are painted on a small
// canvas with flat shapes — no image file — so each face is drawn the same
// way on every run. Lines queue up and dismiss themselves after a few
// seconds, or sooner on a key press.

const PORTRAITS = {
  rosa: { skin: '#c98e6b', hair: '#2a1a12', hairStyle: 'long', shirt: '#8e2f2f', bg: '#5a1f1f' },
  dario: { skin: '#b98a68', hair: '#14100c', hairStyle: 'cap', shirt: '#2e6f8e', bg: '#1d3a4a' },
  vince: { skin: '#d9a583', hair: '#6b6b6b', hairStyle: 'short', shirt: '#1c1c22', bg: '#2a2a30' },
  fenn: { skin: '#a87c5a', hair: '#3a2a1a', hairStyle: 'bun', shirt: '#2456a8', bg: '#1a2a4a' },
};

// Paint one portrait on a 72x72 canvas: background, shoulders, head,
// hair, eyes and mouth. Flat and stylised, like a character card.
function paintPortrait(canvas, spec) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 72, 72);
  ctx.fillStyle = spec.bg;
  ctx.fillRect(0, 0, 72, 72);
  // Shoulders.
  ctx.fillStyle = spec.shirt;
  ctx.beginPath();
  ctx.moveTo(8, 72);
  ctx.quadraticCurveTo(36, 46, 64, 72);
  ctx.closePath();
  ctx.fill();
  // Head.
  ctx.fillStyle = spec.skin;
  ctx.beginPath();
  ctx.arc(36, 32, 17, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = spec.hair;
  if (spec.hairStyle === 'cap') {
    ctx.beginPath();
    ctx.arc(36, 28, 17.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(36, 12, 20, 5);
  } else if (spec.hairStyle === 'long') {
    ctx.beginPath();
    ctx.arc(36, 27, 18, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(18, 26, 6, 26);
    ctx.fillRect(48, 26, 6, 26);
  } else if (spec.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.arc(36, 27, 17.5, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(36, 10, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(36, 26, 17.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  // Eyes and mouth.
  ctx.fillStyle = '#14100c';
  ctx.beginPath();
  ctx.arc(29, 32, 2, 0, Math.PI * 2);
  ctx.arc(43, 32, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a30';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(36, 41, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

export class Dialogue {
  constructor(boxEl) {
    this.box = boxEl;
    this.nameEl = boxEl.querySelector('#dlg-name');
    this.textEl = boxEl.querySelector('#dlg-text');
    this.portraitEl = boxEl.querySelector('#dlg-portrait');
    this.queue = []; // [{ name, text, portrait, ms }]
    this.current = null;
    this.timer = 0;
    this.box.style.display = 'none';
  }

  // Queue a line: `portrait` is a key of PORTRAITS. Later lines wait
  // their turn; the box shows one line at a time.
  show(name, text, portrait, ms = 4200) {
    this.queue.push({ name, text, portrait, ms });
  }

  // True while a line is on screen.
  get visible() {
    return this.current !== null;
  }

  // Skip the current line (a key press dismisses it early).
  skip() {
    if (this.current) {
      this.timer = 0;
    }
  }

  hide() {
    this.current = null;
    this.queue.length = 0;
    this.box.style.display = 'none';
  }

  update(dt) {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return;
      this.current = next;
      this.timer = next.ms / 1000;
      const spec = PORTRAITS[next.portrait] || PORTRAITS.rosa;
      paintPortrait(this.portraitEl, spec);
      this.nameEl.textContent = next.name;
      this.textEl.textContent = next.text;
      this.box.style.display = 'flex';
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.current = null;
      this.box.style.display = 'none';
    }
  }
}
