// Generative Ambient Zen Audio Engine using Web Audio API
// Synthesizes Japanese garden soundscapes: Shishi-odoshi water drops, wind through pines,
// brush friction, salt crystal scattering, and cascading gravity trickle.

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

  // Gravity fluid trickle nodes
  private trickleGainNode: GainNode | null = null;
  private trickleFilterNode: BiquadFilterNode | null = null;

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
      this.setupTrickleSynthesizer();
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

  // Gravity fluid trickle synthesizer
  private setupTrickleSynthesizer(): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const trickleNoise = this.ctx.createBufferSource();
    trickleNoise.buffer = noiseBuffer;
    trickleNoise.loop = true;

    this.trickleFilterNode = this.ctx.createBiquadFilter();
    this.trickleFilterNode.type = 'bandpass';
    this.trickleFilterNode.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.trickleFilterNode.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.trickleGainNode = this.ctx.createGain();
    this.trickleGainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);

    trickleNoise.connect(this.trickleFilterNode);
    this.trickleFilterNode.connect(this.trickleGainNode);
    this.trickleGainNode.connect(this.masterGain);

    trickleNoise.start();
  }

  // Modulates brush sound based on stroke speed, pressure, brush profile, dilution, brush size, and paper tooth
  public updateBrushMotion(
    isDrawing: boolean,
    speed: number,
    pressure: number,
    brushType: number = 0,
    waterDilution: number = 0.5,
    brushSize: number = 22,
    paperType: number = 0
  ): void {
    if (!this.ctx || !this.brushGainNode || !this.brushFilterNode) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    if (isDrawing && speed > 0.05) {
      const sizeScale = 0.7 + (brushSize / 64) * 0.6;
      const drynessBoost = (1.0 - waterDilution) * 0.4;

      // Paper tooth acoustics: Echizen (2) & Mashi (4) have rough rasp; Torinoko (1) has silky whisper
      let paperGainMult = 1.0;
      let paperFreqOffset = 0;
      if (paperType === 1) {
        paperGainMult = 0.75;
        paperFreqOffset = 350; // silkier, higher whisper
      } else if (paperType === 2 || paperType === 4) {
        paperGainMult = 1.35;
        paperFreqOffset = -250; // earthy, deeper tooth rasp
      }

      if (brushType === 1) {
        // === Menso (Fine Liner): High delicate whisper ===
        const targetGain = Math.min((speed * 0.008 + pressure * 0.03 + drynessBoost * 0.02) * sizeScale * paperGainMult, 0.08);
        const targetFreq = 2600 + Math.min(speed * 60, 1600) + (1.0 - waterDilution) * 400 + paperFreqOffset;
        this.brushFilterNode.Q.setTargetAtTime(3.8, t, 0.02);
        this.brushGainNode.gain.setTargetAtTime(targetGain, t, 0.02);
        this.brushFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.02);
      } else if (brushType === 2) {
        // === Hake (Broad Flat Wash): Deep textured sweep ===
        const targetGain = Math.min((speed * 0.022 + pressure * 0.08 + drynessBoost * 0.05) * sizeScale * paperGainMult, 0.22);
        const targetFreq = 700 + Math.min(speed * 120, 1000) + pressure * 350 + (1.0 - waterDilution) * 500 + paperFreqOffset;
        this.brushFilterNode.Q.setTargetAtTime(1.5 + (1.0 - waterDilution) * 1.0, t, 0.02);
        this.brushGainNode.gain.setTargetAtTime(targetGain, t, 0.02);
        this.brushFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.02);
      } else {
        // === Fude (Classic Round) ===
        const targetGain = Math.min((speed * 0.015 + pressure * 0.06 + drynessBoost * 0.04) * sizeScale * paperGainMult, 0.16);
        const targetFreq = 1200 + Math.min(speed * 80, 1400) + pressure * 450 + (1.0 - waterDilution) * 600 + paperFreqOffset;
        this.brushFilterNode.Q.setTargetAtTime(2.0 + (1.0 - waterDilution) * 1.2, t, 0.02);
        this.brushGainNode.gain.setTargetAtTime(targetGain, t, 0.02);
        this.brushFilterNode.frequency.setTargetAtTime(targetFreq, t, 0.02);
      }
    } else {
      this.brushGainNode.gain.setTargetAtTime(0.0, t, 0.08);
    }
  }

  // Bamboo Brush Rest hollow knock (竹音 Take-oto)
  public playBambooKnock(pitchFactor: number = 1.0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;

    // Resonant hollow bamboo cavity mode
    const baseFreq = 420 * pitchFactor;
    const oscBody = this.ctx.createOscillator();
    const gainBody = this.ctx.createGain();
    const filterBody = this.ctx.createBiquadFilter();

    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(baseFreq, t);
    oscBody.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, t + 0.12);

    filterBody.type = 'bandpass';
    filterBody.frequency.setValueAtTime(baseFreq * 1.4, t);
    filterBody.Q.setValueAtTime(6.0, t);

    gainBody.gain.setValueAtTime(0.0, t);
    gainBody.gain.linearRampToValueAtTime(0.12, t + 0.004);
    gainBody.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    // Overtone click (wooden tip contact)
    const oscClick = this.ctx.createOscillator();
    const gainClick = this.ctx.createGain();
    oscClick.type = 'sine';
    oscClick.frequency.setValueAtTime(baseFreq * 3.2, t);
    gainClick.gain.setValueAtTime(0.06, t);
    gainClick.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    oscBody.connect(filterBody);
    filterBody.connect(gainBody);
    gainBody.connect(this.masterGain);

    oscClick.connect(gainClick);
    gainClick.connect(this.masterGain);

    oscBody.start(t);
    oscBody.stop(t + 0.15);
    oscClick.start(t);
    oscClick.stop(t + 0.04);
  }

  // Earthen Suzuri inkstone muted clay contact (土音 Tsuchi-oto)
  public playEarthenThud(pitchFactor: number = 1.0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    const baseFreq = 160 * pitchFactor;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Fuki-e Splatter breath puff and subtle droplet spray sound
  public playFukiePuff(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    // Soft air breath puff
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Salt Granulation sprinkle acoustics (crisp mineral crystal micro-clicks)
  public playSaltSprinkle(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const offset = i * (0.02 + Math.random() * 0.03);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400 + Math.random() * 2200, t + offset);

      gain.gain.setValueAtTime(0.0, t + offset);
      gain.gain.linearRampToValueAtTime(0.04, t + offset + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + offset);
      osc.stop(t + offset + 0.05);
    }
  }

  // Modulates fluid trickle based on canvas gravity tilt
  public updateGravityTrickle(gravityMagnitude: number): void {
    if (!this.ctx || !this.trickleGainNode || !this.trickleFilterNode) return;
    const t = this.ctx.currentTime;
    if (gravityMagnitude > 5.0 && !this.isMuted) {
      const norm = Math.min(gravityMagnitude / 60.0, 1.0);
      const gain = norm * 0.06;
      const freq = 900 + norm * 800;
      this.trickleGainNode.gain.setTargetAtTime(gain, t, 0.1);
      this.trickleFilterNode.frequency.setTargetAtTime(freq, t, 0.1);
    } else {
      this.trickleGainNode.gain.setTargetAtTime(0.0, t, 0.2);
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
