// Solmar Bay — Neon Tide: procedural audio. Every sound is synthesised with
// WebAudio — engine hum, police sirens, gunshots, crashes and interface
// clicks — and no audio file is ever loaded. The engine is only created on
// the first user gesture (a browser rule), every method is a no-op until
// then, and nothing here ever throws: a headless browser or a muted tab
// simply stays silent.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.muted = false;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
    this.skidGain = null;
    this.noiseBuffer = null;
  }

  // Create the context on a user gesture. Safe to call repeatedly.
  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // A one-second white-noise buffer, reused by gunshots and crashes.
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._buildEngine();
      this._buildSiren();
      this._buildSkid();
      this.unlocked = true;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      // Audio stays off; the game plays on silently.
      this.ctx = null;
      this.unlocked = false;
    }
  }

  // The engine hum: a sawtooth and a sub-octave sine through a low-pass
  // filter. Its pitch and loudness follow the car's speed.
  _buildEngine() {
    const ctx = this.ctx;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'sine';
    this.engineSub.frequency.value = 28;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(subGain);
    subGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineSub.start();
  }

  // The police siren: a triangle wave wailing between two tones on a slow
  // LFO, the classic two-tone wail. Its gain follows the nearest cruiser.
  _buildSiren() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 170;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  // The tyre skid: the same white noise, looped through a band-pass.
  // Its gain follows the handbrake at speed, so a slide hisses.
  _buildSkid() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 800;
    band.Q.value = 0.7;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    src.connect(band);
    band.connect(this.skidGain);
    this.skidGain.connect(this.master);
    src.start();
  }

  // Per-frame update: engine pitch by speed, siren loudness by distance.
  // `state` is { driving, speed01, sirenDistance, skid } — sirenDistance
  // is null when no cruiser is chasing, skid is 0..1 while sliding.
  update(state) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const driving = state.driving && !this.muted;
    // The engine steps through gears: its pitch quantises to small steps
    // as the speed climbs, instead of sliding smoothly the whole way.
    const engineFreq = Math.round((55 + state.speed01 * 95) / 7) * 7;
    this.engineOsc.frequency.setTargetAtTime(engineFreq, t, 0.08);
    this.engineSub.frequency.setTargetAtTime(28 + state.speed01 * 45, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + state.speed01 * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(driving ? 0.03 + state.speed01 * 0.075 : 0, t, 0.1);
    const sirenOn = state.sirenDistance !== null && state.sirenDistance !== undefined && !this.muted;
    const sirenLevel = sirenOn ? 0.14 * Math.max(0, 1 - state.sirenDistance / 130) : 0;
    this.sirenGain.gain.setTargetAtTime(sirenLevel, t, 0.2);
    const skidLevel = !this.muted && state.skid ? state.skid * 0.12 : 0;
    this.skidGain.gain.setTargetAtTime(skidLevel, t, 0.08);
  }

  // A gunshot: a short noise burst through a band-pass, plus a low thump.
  gunshot(volume = 1) {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 950;
      band.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5 * volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      src.connect(band);
      band.connect(gain);
      gain.connect(this.master);
      src.start(t, Math.random());
      src.stop(t + 0.2);
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(110, t);
      thump.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.35 * volume, t);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      thump.connect(thumpGain);
      thumpGain.connect(this.master);
      thump.start(t);
      thump.stop(t + 0.16);
    } catch {
      // A failed shot sound never stops the game.
    }
  }

  // A crash: low noise, longer than a gunshot, through a low-pass.
  crash(strength = 1) {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 320;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4 * strength, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      src.connect(low);
      low.connect(gain);
      gain.connect(this.master);
      src.start(t, Math.random());
      src.stop(t + 0.32);
    } catch {
      // Silence is fine.
    }
  }

  // An interface click: a short square blip.
  click() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1250;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.07);
    } catch {
      // Silence is fine.
    }
  }

  // The cash-register chime when a mission pays: two rising notes.
  chime() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      for (const [offset, freq] of [[0, 880], [0.09, 1318]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.22);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.24);
      }
    } catch {
      // Silence is fine.
    }
  }

  // The mission sting when a job pays out: four rising notes, bright
  // and short, over the cash-register chime.
  missionSting() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      for (const [offset, freq] of [[0, 523.25], [0.1, 659.25], [0.2, 783.99], [0.3, 1046.5]]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.14, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.32);
      }
    } catch {
      // Silence is fine.
    }
  }

  // The wanted sting when the heat climbs: two low notes, a short warning.
  wantedSting() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      for (const [offset, freq] of [[0, 196], [0.14, 147]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.09, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.18);
      }
    } catch {
      // Silence is fine.
    }
  }

  // One radio jingle note: a soft triangle tone, the station's melody
  // one note at a time.
  radioNote(freq) {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.42);
    } catch {
      // Silence is fine.
    }
  }

  // The pickup chime for a shell, a fare or a race win: one bright note.
  pickup() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1568;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.27);
    } catch {
      // Silence is fine.
    }
  }

  // The door thunk when Dario gets in or out of a car: a low thump.
  door() {
    if (!this.unlocked || !this.ctx || this.muted) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.14);
    } catch {
      // Silence is fine.
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }
}
