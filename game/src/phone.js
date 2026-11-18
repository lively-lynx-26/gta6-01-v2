// Solmar Bay — Neon Tide: the in-game phone. P opens it over the live
// game (the world keeps moving — the phone pauses nothing). Three apps:
// Contacts — call Rosa for a hint on the current job, Vince for a street
// tip, or Sgt. Fenn for the SBPD line; Messages — Rosa's thread, which
// grows as the story moves; Camera — a shutter that photographs the live
// 3D view into a small gallery. Calls also queue a spoken line in the
// dialogue box, so the phone talks like the rest of the game.

const ROSA_HINTS = [
  "First job's a fare — pick up the Bay Cab and take the rider where they need to go.",
  'Borrowed Wheels: grab a fast car and lose the heat. The Comet GT is the one you want.',
  "The Drop: the package goes to the Docks. Don't stop for anyone in blue.",
  'Dockside Heat: clear the goons at the Docks, then get out clean.',
  'Double Cross: Vince set you up. Watch the rooftops.',
  'Payback: Vince is at the warehouse. Finish it.',
  'King of Solmar: one last job. The whole city is watching.',
  "That's the whole story, Dario. The city's yours now — go enjoy it.",
];

const VINCE_TIPS = [
  'Tip: golden shells on the beach pay $50 a pop. Twelve of them out there.',
  'Tip: the Bay Cab earns fares — pick up riders in the cab and drive them across town.',
  'Tip: Spray Bay clears your wanted level for $200. Drive in with the heat on.',
  'Tip: stunt ramps pay by the metre. Hit one flat out and fly.',
];

const ROSA_MSGS = [
  { at: 0, text: "Dario. You're back. Come see me at the garage — first job's a fare. — Rosa" },
  { at: 1, text: "Nice driving. The SMG's in the locker. Take it — slot 4. — Rosa" },
  { at: 2, text: 'The Drop pays $1,240. Don\'t get cute with the cops. — Rosa' },
  { at: 3, text: "Docks are hot. Breaker 12 is yours now — slot 5. — Rosa" },
  { at: 4, text: "Vince sold us out. I should've seen it. Be careful, Dario. — Rosa" },
  { at: 5, text: "Payback time. He's at the warehouse. End it. — Rosa" },
  { at: 6, text: 'One last job and the city is ours. King of Solmar. — Rosa' },
];

const CONTACTS = [
  { key: 'rosa', name: 'Rosa — Garage', portrait: 'rosa' },
  { key: 'vince', name: 'Vince Marlowe', portrait: 'vince' },
  { key: 'fenn', name: 'Sgt. Fenn — SBPD', portrait: 'fenn' },
];

export class Phone {
  constructor(overlayEl, { player, missions, dialogue }) {
    this.overlay = overlayEl;
    this.player = player;
    this.missions = missions;
    this.dialogue = dialogue;
    this.body = overlayEl.querySelector('#phone-body');
    this.clockEl = overlayEl.querySelector('#phone-clock');
    this.badgeEl = overlayEl.querySelector('#phone-msg-badge');
    this.openFlag = false;
    this.app = 'contacts';
    this.photos = []; // data URLs, newest first, at most six
    this.captureRequested = false; // the main loop photographs after a render
    this.vinceTip = 0; // rotates through Vince's tips
    this.callText = null; // the last call's line, shown in the body
    for (const btn of overlayEl.querySelectorAll('[data-app]')) {
      btn.addEventListener('click', () => {
        this.app = btn.getAttribute('data-app');
        this.callText = null;
        this._render();
      });
    }
    overlayEl.querySelector('#phone-close').addEventListener('click', () => this.close());
    this.body.addEventListener('click', (event) => {
      const contact = event.target.closest('[data-contact]');
      if (contact) {
        this._call(contact.getAttribute('data-contact'));
        return;
      }
      if (event.target.closest('[data-action="shutter"]')) {
        this.captureRequested = true;
      }
    });
  }

  open() {
    this.openFlag = true;
    this.overlay.style.display = 'flex';
    this._render();
  }

  close() {
    this.openFlag = false;
    this.overlay.style.display = 'none';
  }

  get isOpen() {
    return this.openFlag;
  }

  updateClock(text) {
    if (this.clockEl) this.clockEl.textContent = text;
  }

  // The main loop hands a photograph (a data URL of the live view) to
  // the camera roll after the frame it was taken in.
  addPhoto(dataUrl) {
    this.photos.unshift(dataUrl);
    if (this.photos.length > 6) this.photos.length = 6;
    if (this.openFlag && this.app === 'camera') this._render();
  }

  // The line a contact gives when called.
  _hint(key) {
    const index = Math.min(this.missions.index, ROSA_HINTS.length - 1);
    if (key === 'rosa') return ROSA_HINTS[index];
    if (key === 'vince') {
      const tip = VINCE_TIPS[this.vinceTip % VINCE_TIPS.length];
      this.vinceTip += 1;
      return tip;
    }
    const stars = this.player.stars;
    if (stars > 0) {
      return `SBPD dispatch: you're at ${stars} star${stars > 1 ? 's' : ''}, Cruz. Break line of sight and the heat cools off — or pay Spray Bay to wash it.`;
    }
    return 'SBPD dispatch: keep it clean, Cruz. We are watching.';
  }

  _call(key) {
    const contact = CONTACTS.find((c) => c.key === key);
    if (!contact) return;
    const text = this._hint(key);
    this.callText = { name: contact.name, text };
    this.dialogue.show(contact.name, text, contact.portrait);
    this._render();
  }

  // Messages Rosa has sent so far in the story.
  _messages() {
    return ROSA_MSGS.filter((m) => m.at <= this.missions.index);
  }

  _render() {
    for (const btn of this.overlay.querySelectorAll('[data-app]')) {
      btn.classList.toggle('phone-tab-active', btn.getAttribute('data-app') === this.app);
    }
    const fresh = ROSA_MSGS.some((m) => m.at === this.missions.index);
    this.badgeEl.textContent = fresh ? 'NEW' : '';
    if (this.app === 'contacts') {
      let html = '';
      for (const c of CONTACTS) {
        html += `<button class="phone-contact" data-contact="${c.key}">${c.name}</button>`;
      }
      if (this.callText) {
        html += `<div class="phone-call"><b>${this.callText.name}</b><br>${this.callText.text}</div>`;
      }
      this.body.innerHTML = html;
    } else if (this.app === 'msgs') {
      let html = '';
      for (const m of this._messages()) {
        html += `<div class="phone-msg">${m.text}</div>`;
      }
      this.body.innerHTML = html || '<div class="phone-msg">No messages yet.</div>';
    } else {
      let html = '<div class="phone-viewfinder">◉ LIVE VIEW — press the shutter to take a photo</div>'
        + '<button class="phone-shutter" data-action="shutter">SHUTTER</button>';
      if (this.photos.length > 0) {
        html += '<div class="phone-gallery">';
        for (const p of this.photos) html += `<img src="${p}" alt="photo">`;
        html += '</div>';
      }
      this.body.innerHTML = html;
    }
  }
}
