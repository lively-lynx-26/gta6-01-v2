// Solmar Bay — Neon Tide: the radio. Three stations, each with a song
// title shown in the HUD; V switches station, and each station plays its
// own short procedural jingle on a loop — four notes, bright and light,
// through the audio engine. The radio is silent until the browser's audio
// unlocks on the first gesture, like every other sound.

import { CFG } from './config.js';

export class Radio {
  constructor() {
    this.stations = CFG.radio;
    this.index = 0;
    this.noteTimer = 0; // seconds until the next jingle note
    this.notePos = 0; // position inside the station's note loop
  }

  get station() {
    return this.stations[this.index];
  }

  // "SOLMAR FM 96.4 · Sunset Drive — The Solmarines" — what the HUD shows.
  label() {
    const s = this.station;
    return `${s.name} · ${s.song} — ${s.artist}`;
  }

  next() {
    this.index = (this.index + 1) % this.stations.length;
    this.notePos = 0;
    this.noteTimer = 0;
  }

  // One step: schedule the station's jingle notes, one every 0.45 s,
  // looping through its four notes. The audio engine plays each note;
  // nothing happens while the audio is locked or muted.
  update(dt, audio) {
    if (!audio || !audio.unlocked || audio.muted) return;
    this.noteTimer -= dt;
    if (this.noteTimer > 0) return;
    const notes = this.station.notes;
    const freq = notes[this.notePos % notes.length];
    audio.radioNote(freq);
    this.notePos += 1;
    this.noteTimer = 0.45;
  }
}
