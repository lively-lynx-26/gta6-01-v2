// Solmar Bay — Neon Tide: the police response panel. While the heat is
// on, the left side of the HUD lists the active units by callsign, with
// their distance and what they are doing: PURSUING, RAMMING, ROADBLOCK
// or SEARCHLIGHT. It turns a star count into a chase the player can read.

export class ResponsePanel {
  constructor(listEl) {
    this.listEl = listEl;
    this.panel = listEl.parentElement;
    this.panel.style.display = 'none';
  }

  // `units` is [{ callsign, distance, status }]. An empty list hides the
  // panel; the helicopter always lists as AIR-1 when it flies.
  update(units) {
    if (!units || units.length === 0) {
      this.panel.style.display = 'none';
      return;
    }
    this.panel.style.display = 'block';
    let html = '';
    for (const u of units) {
      html += `<div class="resp-row"><span class="resp-unit">${u.callsign}</span>`
        + `<span class="resp-status">${u.status}</span>`
        + `<span class="resp-dist">${Math.round(u.distance)}m</span></div>`;
    }
    this.listEl.innerHTML = html;
  }
}
