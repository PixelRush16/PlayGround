// Tiny WebAudio sound engine: no external assets, everything synthesised.
const MUTE_KEY = 'neon-rails-muted';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.wind = null;
    this.windGain = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
  }

  get ready() {
    return Boolean(this.ctx);
  }

  init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime + 0.08);
    }
  }

  tone({ freq = 440, to = freq, duration = 0.12, type = 'sine', volume = 0.15, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise({ duration = 0.2, volume = 0.15, frequency = 1200, q = 0.8, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  coin(step = 0) {
    const base = 880 * Math.pow(1.0595, Math.min(step, 12));
    this.tone({ freq: base, to: base * 1.5, duration: 0.09, type: 'triangle', volume: 0.09 });
    this.tone({ freq: base * 2, to: base * 2.4, duration: 0.13, type: 'sine', volume: 0.045, delay: 0.035 });
  }

  jump() {
    this.tone({ freq: 210, to: 520, duration: 0.17, type: 'sine', volume: 0.1 });
    this.noise({ duration: 0.12, volume: 0.06, frequency: 900 });
  }

  slide() {
    this.noise({ duration: 0.3, volume: 0.13, frequency: 520, q: 0.7 });
    this.tone({ freq: 140, to: 80, duration: 0.2, type: 'sawtooth', volume: 0.035 });
  }

  swap() {
    this.tone({ freq: 300, to: 420, duration: 0.07, type: 'triangle', volume: 0.05 });
  }

  crash() {
    this.noise({ duration: 0.55, volume: 0.4, frequency: 260, q: 0.5 });
    this.noise({ duration: 0.25, volume: 0.2, frequency: 2400, q: 1.2, delay: 0.02 });
    this.tone({ freq: 130, to: 40, duration: 0.55, type: 'sawtooth', volume: 0.2 });
    this.tone({ freq: 60, to: 30, duration: 0.5, type: 'sine', volume: 0.25 });
  }

  start() {
    this.tone({ freq: 392, to: 392, duration: 0.1, type: 'triangle', volume: 0.09 });
    this.tone({ freq: 523, to: 523, duration: 0.1, type: 'triangle', volume: 0.09, delay: 0.1 });
    this.tone({ freq: 784, to: 784, duration: 0.24, type: 'triangle', volume: 0.11, delay: 0.2 });
    this.startWind();
  }

  click() {
    this.tone({ freq: 620, to: 680, duration: 0.05, type: 'square', volume: 0.04 });
  }

  startWind() {
    if (!this.ctx || this.wind) return;
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
      data[i] = last;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 460;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0001;
    this.windGain.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + 1.2);
    source.connect(filter).connect(this.windGain).connect(this.master);
    source.start();
    this.wind = source;
  }

  stopWind() {
    if (!this.wind || !this.ctx) return;
    const wind = this.wind;
    this.wind = null;
    this.windGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);
    setTimeout(() => {
      try {
        wind.stop();
      } catch {
        /* already stopped */
      }
    }, 420);
  }

  setIntensity(value) {
    if (!this.windGain || !this.ctx) return;
    const target = 0.06 + value * 0.08;
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }
}
