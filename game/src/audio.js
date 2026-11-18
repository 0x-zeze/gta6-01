// Sound for Vice Shores, synthesized live with WebAudio — no audio files,
// no network. Engine hum, a two-tone police siren, gunshots, pickups and a
// mission jingle, plus a tiny bass-line music loop. Everything starts on the
// first user gesture (browsers block audio before one) and M mutes it all.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  // A lazy bass loop in A minor: root notes, one per beat, at 96 bpm.
  const BASS_LINE = [55, 0, 55, 65.41, 55, 0, 49, 55, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicTimer = window.setInterval(playMusicStep, 625);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function playMusicStep() {
    if (!ctx || muted) return;
    const freq = BASS_LINE[musicStep % BASS_LINE.length];
    musicStep += 1;
    if (!freq) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  }

  function blip(freq, duration, type, volume) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noiseBurst(duration, volume) {
    if (!ctx || muted) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Call on the first gesture; unlocks the audio context. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine pitch follows speed (0..1); silent on foot. */
    engine(speedRatio, inCar) {
      if (!ctx || muted) return;
      const target = inCar ? 0.05 + speedRatio * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speedRatio * 140, ctx.currentTime, 0.1);
    },
    /** Siren wails while any wanted level is active. */
    siren(active) {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(active ? 0.045 : 0, now, 0.2);
      if (active) sirenOsc.frequency.setTargetAtTime((Math.floor(now * 1.4) % 2 === 0 ? 700 : 950), now, 0.05);
    },
    shot() {
      noiseBurst(0.12, 0.35);
    },
    hit() {
      blip(160, 0.15, 'square', 0.2);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.25);
      window.setTimeout(() => blip(990, 0.18, 'sine', 0.25), 90);
    },
    mission() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.25, 'triangle', 0.3), i * 120);
      });
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.3, 'sawtooth', 0.22), i * 160);
      });
    },
    enterCar() {
      blip(220, 0.1, 'square', 0.15);
      window.setTimeout(() => blip(330, 0.12, 'square', 0.15), 80);
    },
  };
}
