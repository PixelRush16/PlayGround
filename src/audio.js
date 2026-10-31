import { clamp } from './utils.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.engine = null;
    this.boostNoise = null;
    this.crowd = null;
    this.started = false;
  }

  init() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.createEngine();
      this.createCrowd();
      this.started = true;
    } catch (error) {
      console.warn('Audio unavailable', error);
    }
  }

  createEngine() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 2.5;

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 48;
    const oscB = ctx.createOscillator();
    oscB.type = 'square';
    oscB.frequency.value = 96;

    const gainA = ctx.createGain();
    gainA.gain.value = 0.55;
    const gainB = ctx.createGain();
    gainB.gain.value = 0.2;

    oscA.connect(gainA).connect(filter);
    oscB.connect(gainB).connect(filter);
    filter.connect(out).connect(this.master);
    oscA.start();
    oscB.start();

    this.engine = { out, filter, oscA, oscB };

    const boost = ctx.createBufferSource();
    boost.buffer = this.noiseBuffer;
    boost.loop = true;
    const boostFilter = ctx.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.value = 900;
    boostFilter.Q.value = 0.7;
    const boostGain = ctx.createGain();
    boostGain.gain.value = 0;
    boost.connect(boostFilter).connect(boostGain).connect(this.master);
    boost.start();
    this.boostNoise = { gain: boostGain, filter: boostFilter };
  }

  createCrowd() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.45;
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.crowd = { gain, filter };
  }

  setEngine(speed, boosting, throttle, active) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const target = active ? clamp(0.025 + speed * 0.0015 + Math.abs(throttle) * 0.02, 0, 0.14) : 0;
    this.engine.out.gain.setTargetAtTime(target, t, 0.08);
    this.engine.oscA.frequency.setTargetAtTime(42 + speed * 2.1 + (boosting ? 28 : 0), t, 0.07);
    this.engine.oscB.frequency.setTargetAtTime(84 + speed * 4.1 + (boosting ? 55 : 0), t, 0.07);
    this.engine.filter.frequency.setTargetAtTime(380 + speed * 22 + (boosting ? 900 : 0), t, 0.1);
    if (this.boostNoise) {
      this.boostNoise.gain.gain.setTargetAtTime(boosting ? 0.13 : 0, t, 0.05);
      this.boostNoise.filter.frequency.setTargetAtTime(700 + speed * 12, t, 0.1);
    }
  }

  tone({ freq = 440, endFreq = null, dur = 0.2, type = 'sine', vol = 0.2, delay = 0, filter = null }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 1;
      node.connect(f);
      node = f;
    }
    node.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 800, q = 1, type = 'bandpass', delay = 0, sweep = null }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t0 + dur);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone({ freq: 620, endFreq: 880, dur: 0.08, type: 'triangle', vol: 0.12 });
  }

  countdown(final = false) {
    this.tone({ freq: final ? 880 : 520, dur: final ? 0.4 : 0.14, type: 'square', vol: 0.12, filter: { type: 'lowpass', freq: 2400 } });
  }

  go() {
    this.tone({ freq: 440, dur: 0.5, type: 'sawtooth', vol: 0.16, filter: { type: 'lowpass', freq: 1800 } });
    this.tone({ freq: 660, dur: 0.5, type: 'sawtooth', vol: 0.12, delay: 0.02, filter: { type: 'lowpass', freq: 2000 } });
    this.tone({ freq: 880, dur: 0.5, type: 'triangle', vol: 0.1, delay: 0.04 });
    this.cheer(0.7);
  }

  hit(power = 1) {
    const p = clamp(power, 0.3, 1.8);
    this.noise({ dur: 0.12 + p * 0.1, vol: 0.18 * p, freq: 1400, q: 0.8, sweep: 300 });
    this.tone({ freq: 120, endFreq: 45, dur: 0.16 + p * 0.1, type: 'sine', vol: 0.25 * p });
    this.tone({ freq: 320, endFreq: 180, dur: 0.07, type: 'square', vol: 0.06 * p });
  }

  wallHit() {
    this.noise({ dur: 0.1, vol: 0.1, freq: 900, q: 1.5 });
  }

  jump() {
    this.tone({ freq: 300, endFreq: 620, dur: 0.12, type: 'triangle', vol: 0.09 });
  }

  flip() {
    this.tone({ freq: 420, endFreq: 900, dur: 0.18, type: 'sawtooth', vol: 0.07, filter: { type: 'lowpass', freq: 1800 } });
    this.noise({ dur: 0.2, vol: 0.06, freq: 1200, q: 1, sweep: 500 });
  }

  land() {
    this.tone({ freq: 90, endFreq: 45, dur: 0.12, type: 'sine', vol: 0.15 });
  }

  pickup() {
    [660, 880, 1174].forEach((f, i) => this.tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.1, delay: i * 0.055 }));
    this.tone({ freq: 1760, dur: 0.22, type: 'sine', vol: 0.05, delay: 0.16 });
  }

  itemUse(type) {
    if (type === 'mushroom') {
      this.noise({ dur: 0.5, vol: 0.16, freq: 500, q: 0.7, sweep: 2600 });
      this.tone({ freq: 180, endFreq: 520, dur: 0.4, type: 'sawtooth', vol: 0.1, filter: { type: 'lowpass', freq: 1600 } });
    } else if (type === 'green' || type === 'red') {
      this.tone({ freq: type === 'red' ? 540 : 700, endFreq: 160, dur: 0.24, type: 'square', vol: 0.09, filter: { type: 'lowpass', freq: 2200 } });
      this.noise({ dur: 0.3, vol: 0.1, freq: 1800, q: 1.2, sweep: 500 });
    } else if (type === 'banana') {
      this.tone({ freq: 320, endFreq: 120, dur: 0.18, type: 'triangle', vol: 0.12 });
      this.tone({ freq: 180, endFreq: 80, dur: 0.12, type: 'sine', vol: 0.1, delay: 0.08 });
    } else if (type === 'star') {
      [880, 1108, 1318, 1760].forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.08, delay: i * 0.07 }));
    } else if (type === 'lightning') {
      this.noise({ dur: 0.45, vol: 0.22, freq: 2400, q: 0.6, sweep: 120 });
      this.tone({ freq: 900, endFreq: 90, dur: 0.4, type: 'sawtooth', vol: 0.12 });
    } else if (type === 'bomb') {
      this.tone({ freq: 220, endFreq: 440, dur: 0.25, type: 'triangle', vol: 0.08 });
      this.noise({ dur: 0.12, vol: 0.06, freq: 1200, q: 1 });
    }
  }

  explosion() {
    this.noise({ dur: 0.8, vol: 0.32, freq: 900, q: 0.5, sweep: 60 });
    this.tone({ freq: 90, endFreq: 28, dur: 0.7, type: 'sine', vol: 0.35 });
    this.tone({ freq: 240, endFreq: 50, dur: 0.5, type: 'sawtooth', vol: 0.12, filter: { type: 'lowpass', freq: 800 } });
    this.cheer(0.25);
  }

  hurt() {
    this.tone({ freq: 380, endFreq: 70, dur: 0.5, type: 'sawtooth', vol: 0.12, filter: { type: 'lowpass', freq: 900 } });
    this.noise({ dur: 0.3, vol: 0.1, freq: 700, q: 0.8, sweep: 200 });
  }

  botHit() {
    this.tone({ freq: 260, endFreq: 90, dur: 0.2, type: 'square', vol: 0.05, filter: { type: 'lowpass', freq: 800 } });
  }

  star() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.08, delay: i * 0.06 }));
  }

  goal() {
    if (!this.ctx || this.muted) return;
    const notes = [196, 246.9, 293.7, 392];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 1.3, type: 'sawtooth', vol: 0.12, delay: i * 0.06, filter: { type: 'lowpass', freq: 1200 } });
      this.tone({ freq: f * 2, dur: 1.1, type: 'square', vol: 0.04, delay: i * 0.06, filter: { type: 'lowpass', freq: 1600 } });
    });
    this.noise({ dur: 0.6, vol: 0.12, freq: 300, q: 0.6, sweep: 900 });
    this.cheer(1.3);
  }

  whistle() {
    this.tone({ freq: 1800, endFreq: 2100, dur: 0.3, type: 'sine', vol: 0.09 });
    this.tone({ freq: 2100, endFreq: 1800, dur: 0.3, type: 'sine', vol: 0.07, delay: 0.18 });
  }

  cheer(amount = 0.8) {
    if (!this.crowd) return;
    const t = this.ctx.currentTime;
    this.crowd.gain.gain.cancelScheduledValues(t);
    this.crowd.gain.gain.setValueAtTime(this.crowd.gain.gain.value, t);
    this.crowd.gain.gain.linearRampToValueAtTime(0.09 * amount, t + 0.25);
    this.crowd.gain.gain.exponentialRampToValueAtTime(0.028, t + 2.8);
    this.crowd.filter.frequency.setTargetAtTime(1300, t, 0.3);
    this.crowd.filter.frequency.setTargetAtTime(620, t + 1.5, 1.2);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
