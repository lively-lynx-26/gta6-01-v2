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
  // panel; the helicopter always lists as AIR-1 when it flies. The
  // panel shows the five nearest units, then a "+N more units in the
  // search zone" line — the top entries do the same, and a seven-row
  // panel would run into the health bars.
  update(units) {
    if (!units || units.length === 0) {
      this.panel.style.display = 'none';
      return;
    }
    this.panel.style.display = 'block';
    const sorted = [...units].sort((a, b) => a.distance - b.distance);
    const shown = sorted.slice(0, 5);
    let html = '';
    for (const u of shown) {
      html += `<div class="resp-row"><span class="resp-unit">${u.callsign}</span>`
        + `<span class="resp-status">${u.status}</span>`
        + `<span class="resp-dist">${Math.round(u.distance)}m</span></div>`;
    }
    if (sorted.length > shown.length) {
      html += `<div class="resp-more">+${sorted.length - shown.length} more units in the search zone</div>`;
    }
    this.listEl.innerHTML = html;
  }
}
