// Synthesised sound: no audio files, everything is generated with WebAudio —
// engine hum that follows the throttle, wind that follows speed, a chime for
// each ring, a thud for a crash and a soft fanfare for a landing.
export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null;
  let windSrc = null, windGain = null, windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned sawtooths through a lowpass, pitch follows throttle.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth';
      engineOsc2.detune.value = 8;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start(); engineOsc2.start();
      // Wind: looped white noise through a bandpass, loudness follows speed.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
      windSrc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

  /** Call every frame with the flight state; drives engine + wind levels. */
  function update(s) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const running = s.mode === 'flying' || s.mode === 'crashed';
    const target = running ? 0.05 + s.throttle * 0.06 : 0;
    engineGain.gain.setTargetAtTime(target, t, 0.1);
    const freq = 55 + s.throttle * 75 + s.speed * 0.4;
    engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(freq * 1.005, t, 0.1);
    const wind = running ? Math.min(0.12, s.speed * 0.0016) : 0;
    windGain.gain.setTargetAtTime(wind, t, 0.15);
    windFilter.frequency.setTargetAtTime(400 + s.speed * 14, t, 0.2);
  }

  function blip(freq, delay, dur, type = 'sine', vol = 0.18) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    ensure, resume, update,
    get ready() { return started; },
    ring() { blip(880, 0, 0.5); blip(1318, 0.09, 0.6); blip(1760, 0.18, 0.7); },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.65);
      blip(70, 0, 0.4, 'square', 0.25);
    },
    land() { blip(523, 0, 0.4); blip(659, 0.12, 0.4); blip(784, 0.24, 0.6); },
    click() { blip(660, 0, 0.12, 'triangle', 0.12); },
    toggleMute() {
      muted = !muted;
      if (ctx) { engineGain.gain.value = 0; windGain.gain.value = 0; }
      return muted;
    },
  };
}
