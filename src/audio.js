/**
 * Tiny procedural sound engine. Everything is synthesized with Web Audio,
 * so the game stays a single self-contained bundle.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = 0;
    this.step = 0;
    this.nextNoteTime = 0;
    this.started = false;
    this.musicOn = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;

    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.03);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 55);
  }

  stopMusic() {
    this.musicOn = false;
    window.clearInterval(this.musicTimer);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    const stepDur = 60 / 128 / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.16) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextNoteTime += stepDur;
    }
  }

  playStep(step, time, dur) {
    const bassNotes = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    if (step % 8 === 0) {
      const note = bassNotes[(step / 8) % bassNotes.length];
      this.tone(note, time, dur * 6.4, 'sawtooth', 0.12, this.musicGain, 240);
      this.kick(time);
    }
    if (step % 4 === 2) this.hat(time, 0.03);
    if (step % 2 === 0) {
      const arp = [220, 261.63, 329.63, 392, 329.63, 261.63, 246.94, 293.66];
      const f = arp[(step / 2) % arp.length];
      this.tone(f, time, dur * 2.2, 'triangle', 0.028, this.musicGain, 1200);
    }
    if (step % 16 === 12) this.tone(110, time, dur * 3, 'sine', 0.035, this.musicGain, 600);
  }

  kick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
    osc.connect(gain).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  hat(time, volume) {
    if (!this.ctx) return;
    const buffer = this.noiseBuffer(0.05);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(time);
  }

  noiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  tone(freq, time, duration, type, volume, destination, lowpass = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    let tail = gain;
    if (lowpass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      gain.connect(filter);
      tail = filter;
    }
    osc.connect(gain);
    tail.connect(destination || this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  coin(streak = 0) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 880 * Math.pow(2, Math.min(streak, 8) / 24);
    this.tone(base, t, 0.08, 'sine', 0.15, this.sfxGain, 4500);
    this.tone(base * 1.5, t + 0.055, 0.12, 'sine', 0.1, this.sfxGain, 5000);
  }

  jump() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(t);
  }

  swipe(direction = 0) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(direction > 0 ? 240 : 330, t);
    osc.frequency.exponentialRampToValueAtTime(direction > 0 ? 390 : 180, t + 0.1);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  slide() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.32);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.28);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(t);
  }

  power() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.055, 0.22, 'triangle', 0.08, this.sfxGain, 4000));
  }

  crash() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1300, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.65);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(t);
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.55);
    g2.gain.setValueAtTime(0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    osc.connect(g2).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  click() {
    this.init();
    if (!this.ctx) return;
    this.tone(520, this.ctx.currentTime, 0.05, 'sine', 0.045, this.sfxGain, 2200);
  }
}
