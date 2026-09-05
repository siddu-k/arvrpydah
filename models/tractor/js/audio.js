/**
 * MTZ-80 Diesel Procedural Web Audio Synthesizer
 * RPM-responsive 4-cyl diesel knock + turbo whistle + assembly FX.
 */

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Muted by default to respect browser autoplay policies
    this.initialized = false;

    // Audio nodes
    this.masterGain = null;
    this.rumbleOsc = null;
    this.rumbleGain = null;
    this.noiseNode = null;
    this.noiseFilter = null;
    this.noiseGain = null;

    this.lastSparkState = false;
    this.lastIntakeState = 0;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Low frequency crankshaft rumble oscillator
      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'sawtooth';
      this.rumbleOsc.frequency.setValueAtTime(25, this.ctx.currentTime);

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.rumbleOsc.connect(rumbleFilter);
      rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.masterGain);
      this.rumbleOsc.start();

      // Exhaust burst noise generator
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.noiseFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

      whiteNoise.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);
      whiteNoise.start();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.initialized && !this.isMuted) {
      this.init();
    }
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.45, now, 0.05);
    }
    return this.isMuted;
  }

  update(kinematicsState, rpm, isRunning) {
    if (!this.initialized || this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;

    if (!isRunning || rpm <= 0) {
      this.rumbleGain.gain.setTargetAtTime(0, now, 0.1);
      this.noiseGain.gain.setTargetAtTime(0, now, 0.1);
      return;
    }

    // 4-cyl 4-stroke diesel: combustion freq = (RPM/60) * 2
    const crankFreq = Math.max(12, rpm / 60);
    const knockFreq = crankFreq * 2;

    this.rumbleOsc.frequency.setTargetAtTime(crankFreq, now, 0.05);
    this.noiseFilter.frequency.setTargetAtTime(150 + rpm * 0.30, now, 0.05);

    // Diesel knock intensity scales with load/rpm + exhaust puff pulse
    const puff = kinematicsState.exhaustPuff || 0;
    const strokeVolume = 0.22 + Math.min(0.45, rpm / 2200 * 0.45) + puff * 0.15;

    this.rumbleGain.gain.setTargetAtTime(strokeVolume * 0.35, now, 0.04);
    this.noiseGain.gain.setTargetAtTime(strokeVolume * 0.16, now, 0.04);

    // Diesel knock snap trigger on puff peak
    const puffHit = puff > 0.85;
    if (puffHit && !this.lastSparkState) {
      this.playSparkSnap();
    }
    this.lastSparkState = puffHit;
  }

  playSparkSnap() {
    if (!this.initialized || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (_) {}
  }

  playMechanicalClick() {
    if (!this.initialized || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (_) {}
  }
}
