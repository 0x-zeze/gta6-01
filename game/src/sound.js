// Solstice City — every sound is synthesized live with WebAudio: no audio files,
// no network. Engine hum, siren wail, gunshots, pickups, jingles and stingers are
// all oscillators and filtered noise, started only after the first user gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (_err) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
    if (m) this.engine(false, 0);
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (_err) { /* audio is best-effort */ }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (_err) { /* ignore */ }
  }

  shot() {
    this.noise(0.12, 0.5, 2400);
    this.tone(180, 0.08, 'square', 0.16, 60);
  }

  thud() {
    this.tone(90, 0.18, 'sine', 0.3, 45);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.22);
    setTimeout(() => this.tone(990, 0.12, 'sine', 0.22), 70);
  }

  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.22), i * 90));
  }

  fanfare() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.24), i * 110));
  }

  explosion() {
    this.noise(0.7, 0.7, 500);
    this.tone(70, 0.6, 'sine', 0.5, 30);
  }

  crash() {
    this.noise(0.18, 0.35, 900);
  }

  sirenBlip() {
    this.tone(880, 0.12, 'sine', 0.18, 1174);
    setTimeout(() => this.tone(1174, 0.12, 'sine', 0.18, 880), 120);
  }

  busted() {
    [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sawtooth', 0.16), i * 200));
  }

  wasted() {
    [392, 311, 233, 175].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'sawtooth', 0.16), i * 220));
  }

  engine(on, speedRatio) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch (_e) { /* already stopped */ }
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      try {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.04;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        this.engineOsc.connect(f);
        f.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      } catch (_err) { /* ignore */ }
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speedRatio * 130;
      this.engineGain.gain.value = 0.03 + speedRatio * 0.05;
    }
  }

  // A distant two-tone siren that swells while police are close.
  updateSiren(dt, wanted, nearestCop) {
    if (!this.ctx || this.muted) return;
    this.sirenTimer -= dt;
    if (wanted > 0 && nearestCop < 700 && this.sirenTimer <= 0) {
      this.sirenTimer = 0.9;
      const vol = 0.05 + 0.06 * (1 - nearestCop / 700);
      this.tone(740, 0.42, 'sine', vol, 980);
      setTimeout(() => this.tone(980, 0.42, 'sine', vol, 740), 430);
    }
  }
}
