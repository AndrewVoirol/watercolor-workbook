// Generative Ambient Zen Audio Engine using Web Audio API
// Synthesizes Japanese garden soundscapes: Shishi-odoshi water drops, wind through pines, and brush friction

export class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  
  // Brush friction nodes
  private brushNoiseNode: AudioBufferSourceNode | null = null;
  private brushGainNode: GainNode | null = null;
  private brushFilterNode: BiquadFilterNode | null = null;

  // Ambient wind nodes
  private windGainNode: GainNode | null = null;

  // Periodic droplet timer
  private dropletTimer: number | null = null;

  constructor() {}

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupWindAmbience();
      this.setupBrushFrictionSynthesizer();
      this.startShishiOdoshiSchedule();

      this.isInitialized = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  public ensureContext(): void {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.7, this.ctx.currentTime, 0.08);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Generative subtle wind through pine branches
  private setupWindAmbience(): void {
    if (!this.ctx || !this.masterGain) return;

    // Generate 4 seconds of white noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to soft low-mid wind frequencies
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // Slow LFO to modulate wind frequency and breathing swells
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // 12-second cycle

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    this.windGainNode = this.ctx.createGain();
    this.windGainNode.gain.setValueAtTime(0.04, this.ctx.currentTime);

    whiteNoise.connect(windFilter);
    windFilter.connect(this.windGainNode);
    this.windGainNode.connect(this.masterGain);

    whiteNoise.start();
    lfo.start();
  }

  // Brush contact & friction synthesizer modulated by pointer movement
  private setupBrushFrictionSynthesizer(): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.brushNoiseNode = this.ctx.createBufferSource();
    this.brushNoiseNode.buffer = noiseBuffer;
    this.brushNoiseNode.loop = true;

    this.brushFilterNode = this.ctx.createBiquadFilter();
    this.brushFilterNode.type = 'bandpass';
    this.brushFilterNode.frequency.setValueAtTime(1800, this.ctx.currentTime);
    this.brushFilterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.brushGainNode = this.ctx.createGain();
    this.brushGainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.brushNoiseNode.connect(this.brushFilterNode);
    this.brushFilterNode.connect(this.brushGainNode);
    this.brushGainNode.connect(this.masterGain);

    this.brushNoiseNode.start();
  }

  // Modulates brush sound based on stroke speed and pressure
  public updateBrushMotion(isDrawing: boolean, speed: number, pressure: number): void {
    if (!this.ctx || !this.brushGainNode || !this.brushFilterNode) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    if (isDrawing && speed > 0.05) {
      const targetGain = Math.min(speed * 0.015 + pressure * 0.06, 0.14);
      const targetFreq = 1200 + Math.min(speed * 80, 1800) + pressure * 600;
      this.brushGainNode.gain.setTargetAtTime(targetGain, t, 0.03);
      this.brushFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.03);
    } else {
      this.brushGainNode.gain.setTargetAtTime(0.0, t, 0.08);
    }
  }

  // Meditative water droplet / Shishi-odoshi bamboo clack
  public playWaterDrop(pitchFactor: number = 1.0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = (600 + Math.random() * 400) * pitchFactor;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.18);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Meditative Singing Bowl Chime (Breathe / Preserve trigger)
  public playSingingBowl(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const freqs = [384, 768, 1152, 1600]; // Harmonic series of F#
    const weights = [0.15, 0.08, 0.04, 0.02];

    freqs.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 2, t);

      gain.gain.setValueAtTime(0.0, t);
      gain.gain.linearRampToValueAtTime(weights[i], t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 5.0);
    });
  }

  // Spring Rain soothing water rush (Canvas wash trigger)
  public playSpringRain(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    // Series of soft water splashes
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.playWaterDrop(0.7 + Math.random() * 0.6);
      }, i * 140);
    }
  }

  // Automatic periodic soothing garden droplets (every 8..18 seconds)
  private startShishiOdoshiSchedule(): void {
    const scheduleNext = () => {
      const delay = 8000 + Math.random() * 12000;
      this.dropletTimer = window.setTimeout(() => {
        if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
          this.playWaterDrop();
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  public dispose(): void {
    if (this.dropletTimer) {
      clearTimeout(this.dropletTimer);
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
