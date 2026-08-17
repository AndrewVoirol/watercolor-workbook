// Uniforms and Dynamic Storage Buffer Manager for WebGPU Simulation
// Strictly type-safe validation schema with 16-byte WGSL memory alignment.

import { SegmentOutput } from '../input/SplineEngine';

export interface SimParameters {
  viscosity: number;              // 0.001..0.05
  paperDrag: number;              // 0.05..0.50
  capillaryStrength: number;      // 0.1..1.5
  evaporationRate: number;        // 0.005..0.08
  coffeeRingFlux: number;         // 0.1..2.0
  pinningThreshold: number;       // 0.02..0.4
  zenFadeRate: number;            // 0.001..0.03
  omegaRelaxation: number;        // 0.5..0.95
  breatheActive: boolean;         // Pause fading
  clearCanvasActive: boolean;     // Reset canvas
  // Advanced Physics: Gravity, Paper Substrate & Fluid Dynamics
  gravity: [number, number];      // [gx, gy] in pixels/s^2
  paperType: number;              // 0=Raw Mulberry (Kōzo), 1=Sized Eggshell (Torinoko), 2=Antique Edo (Kobishi)
  waterDilution: number;          // 0.1..1.0
  paperRoughness: number;         // 0.2..2.5
  paperPermeability: number;      // 0.2..3.0
  paperCapillaryRate: number;     // 0.2..3.0
  granulationRate: number;        // 0.0..2.5
  paperContactAngle: number;      // 0.05..1.0 (cos of contact angle)
  paperBucklingRate: number;      // 0.0..2.0 (hygroscopic swelling amplitude)
  marangoniFlowRate: number;      // 0.1..2.5 (solutocapillary surface tension gradient force)
  stokesSettlingRate: number;     // 0.2..3.0 (mineral valley sedimentation)
  wetDarkeningStrength: number;   // 0.1..1.5 (refractive index matching optical depth)
}

export class UniformsManager {
  private device: GPUDevice;
  public uniformBuffer: GPUBuffer;
  public segmentStorageBuffer: GPUBuffer;

  // 144 bytes = 36 floats / uint32 (16-byte aligned)
  public static readonly UNIFORMS_BYTE_SIZE = 144;
  private uniformData = new ArrayBuffer(UniformsManager.UNIFORMS_BYTE_SIZE);
  private uniformFloatView: Float32Array;
  private uniformUintView: Uint32Array;

  public static readonly MAX_SEGMENTS = 512;
  // 80 bytes (20 floats) per segment
  public static readonly SEGMENT_BYTE_SIZE = 80;
  private segmentArrayBuffer = new ArrayBuffer(UniformsManager.MAX_SEGMENTS * UniformsManager.SEGMENT_BYTE_SIZE);
  private segmentFloatView: Float32Array;
  private segmentUintView: Uint32Array;

  public params: SimParameters = {
    viscosity: 0.004,
    paperDrag: 0.14,
    capillaryStrength: 0.38,
    evaporationRate: 0.012,
    coffeeRingFlux: 0.75,
    pinningThreshold: 0.10,
    zenFadeRate: 0.0035, // gentle ~4-5 minute fade
    omegaRelaxation: 0.85,
    breatheActive: false,
    clearCanvasActive: false,
    gravity: [0.0, 0.0],
    paperType: 0, // Raw Mulberry (Kōzo) default
    waterDilution: 0.50,
    paperRoughness: 0.95,
    paperPermeability: 1.75,
    paperCapillaryRate: 1.65,
    granulationRate: 0.45,
    paperContactAngle: 0.98,
    paperBucklingRate: 0.95,
    marangoniFlowRate: 0.85,
    stokesSettlingRate: 1.0,
    wetDarkeningStrength: 1.0
  };

  constructor(device: GPUDevice) {
    this.device = device;
    this.uniformFloatView = new Float32Array(this.uniformData);
    this.uniformUintView = new Uint32Array(this.uniformData);

    this.segmentFloatView = new Float32Array(this.segmentArrayBuffer);
    this.segmentUintView = new Uint32Array(this.segmentArrayBuffer);

    // Create GPU Uniform Buffer (144 bytes)
    this.uniformBuffer = this.device.createBuffer({
      label: 'sim_uniforms_buffer',
      size: UniformsManager.UNIFORMS_BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create GPU Storage Buffer for segments (80 bytes per segment)
    this.segmentStorageBuffer = this.device.createBuffer({
      label: 'brush_segments_storage_buffer',
      size: UniformsManager.MAX_SEGMENTS * UniformsManager.SEGMENT_BYTE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
  }

  // Strictly validates and clamps all parameters to prevent NaN or simulation divergence
  public validateParameters(): void {
    const p = this.params;
    p.viscosity = Math.max(0.0005, Math.min(0.05, p.viscosity));
    p.paperDrag = Math.max(0.01, Math.min(0.50, p.paperDrag));
    p.capillaryStrength = Math.max(0.05, Math.min(2.0, p.capillaryStrength));
    p.evaporationRate = Math.max(0.001, Math.min(0.10, p.evaporationRate));
    p.coffeeRingFlux = Math.max(0.05, Math.min(3.0, p.coffeeRingFlux));
    p.pinningThreshold = Math.max(0.01, Math.min(0.50, p.pinningThreshold));
    p.zenFadeRate = Math.max(0.0001, Math.min(0.05, p.zenFadeRate));
    p.omegaRelaxation = Math.max(0.40, Math.min(0.98, p.omegaRelaxation));
    p.waterDilution = Math.max(0.05, Math.min(1.0, p.waterDilution));
    p.paperRoughness = Math.max(0.1, Math.min(3.0, p.paperRoughness));
    p.paperPermeability = Math.max(0.1, Math.min(3.0, p.paperPermeability));
    p.paperCapillaryRate = Math.max(0.1, Math.min(3.0, p.paperCapillaryRate));
    p.granulationRate = Math.max(0.0, Math.min(3.0, p.granulationRate));
    p.paperContactAngle = Math.max(0.05, Math.min(1.0, p.paperContactAngle));
    p.paperBucklingRate = Math.max(0.0, Math.min(2.5, p.paperBucklingRate));
    p.marangoniFlowRate = Math.max(0.0, Math.min(3.0, p.marangoniFlowRate));
    p.stokesSettlingRate = Math.max(0.1, Math.min(3.0, p.stokesSettlingRate));
    p.wetDarkeningStrength = Math.max(0.1, Math.min(2.0, p.wetDarkeningStrength));
  }

  public updateUniforms(
    gridWidth: number,
    gridHeight: number,
    dt: number,
    time: number,
    isDrawing: boolean,
    segmentCount: number,
    screenWidth: number,
    screenHeight: number,
    dpr: number
  ): void {
    this.validateParameters();

    const aspect = screenWidth / Math.max(screenHeight, 1.0);

    // Offset 0: grid_size (vec2)
    this.uniformFloatView[0] = gridWidth;
    this.uniformFloatView[1] = gridHeight;
    // Offset 2: texel_size (vec2)
    this.uniformFloatView[2] = 1.0 / gridWidth;
    this.uniformFloatView[3] = 1.0 / gridHeight;
    // Offset 4: dt, time
    this.uniformFloatView[4] = dt;
    this.uniformFloatView[5] = time;
    // Offset 6: brush_active, segment_count (u32)
    this.uniformUintView[6] = (isDrawing || segmentCount > 0) ? 1 : 0;
    this.uniformUintView[7] = segmentCount;
    // Offset 8: breathe_active, clear_canvas_active (u32)
    this.uniformUintView[8] = this.params.breatheActive ? 1 : 0;
    this.uniformUintView[9] = this.params.clearCanvasActive ? 1 : 0;
    // Offset 10: viscosity, paper_drag
    this.uniformFloatView[10] = this.params.viscosity;
    this.uniformFloatView[11] = this.params.paperDrag;
    // Offset 12: capillary_strength, evaporation_rate
    this.uniformFloatView[12] = this.params.capillaryStrength;
    this.uniformFloatView[13] = this.params.evaporationRate;
    // Offset 14: coffee_ring_flux, pinning_threshold
    this.uniformFloatView[14] = this.params.coffeeRingFlux;
    this.uniformFloatView[15] = this.params.pinningThreshold;
    // Offset 16: zen_fade_rate, omega_relaxation
    this.uniformFloatView[16] = this.params.zenFadeRate;
    this.uniformFloatView[17] = this.params.omegaRelaxation;
    // Offset 18: screen_size (vec2)
    this.uniformFloatView[18] = screenWidth;
    this.uniformFloatView[19] = screenHeight;
    // Offset 20: dpr, aspect_ratio
    this.uniformFloatView[20] = dpr;
    this.uniformFloatView[21] = aspect;

    // Offset 22: gravity (vec2)
    this.uniformFloatView[22] = this.params.gravity[0];
    this.uniformFloatView[23] = this.params.gravity[1];
    // Offset 24: paper_type (u32)
    this.uniformUintView[24] = this.params.paperType;
    // Offset 25: water_dilution (f32)
    this.uniformFloatView[25] = this.params.waterDilution;
    // Offset 26: paper_roughness (f32)
    this.uniformFloatView[26] = this.params.paperRoughness;
    // Offset 27: paper_permeability (f32)
    this.uniformFloatView[27] = this.params.paperPermeability;
    // Offset 28: paper_capillary_rate (f32)
    this.uniformFloatView[28] = this.params.paperCapillaryRate;
    // Offset 29: granulation_rate (f32)
    this.uniformFloatView[29] = this.params.granulationRate;
    // Offset 30: paper_contact_angle (f32)
    this.uniformFloatView[30] = this.params.paperContactAngle;
    // Offset 31: paper_buckling_rate (f32)
    this.uniformFloatView[31] = this.params.paperBucklingRate;
    // Offset 32: marangoni_flow_rate (f32)
    this.uniformFloatView[32] = this.params.marangoniFlowRate;
    // Offset 33: stokes_settling_rate (f32)
    this.uniformFloatView[33] = this.params.stokesSettlingRate;
    // Offset 34: wet_darkening_strength (f32)
    this.uniformFloatView[34] = this.params.wetDarkeningStrength;
    // Offset 35: pad (f32)
    this.uniformFloatView[35] = 0.0;

    // Write strictly 144 aligned bytes to GPU
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  // Returns physical parameter overrides per authentic Washi paper substrate
  public static getPaperPresetParams(paperType: number): Partial<SimParameters> {
    switch (paperType) {
      case 0:
        // 0: Kizuki Kōzo (生漉楮 - Raw Mulberry Washi): Unsized raw bast fibers, intense anisotropic wicking (Hige-nijimi)
        return {
          paperRoughness: 1.15,
          paperPermeability: 2.20,
          paperCapillaryRate: 2.00,
          granulationRate: 0.65,
          capillaryStrength: 0.50,
          paperDrag: 0.12,
          paperContactAngle: 0.98,
          paperBucklingRate: 0.95,
          stokesSettlingRate: 0.95,
          wetDarkeningStrength: 1.10
        };
      case 1:
        // 1: Torinoko (鳥の子 - Sized Eggshell Washi): Alum-gelatin Dōsa sized, crisp bone line perimeters (Fuchidori)
        return {
          paperRoughness: 0.30,
          paperPermeability: 0.35,
          paperCapillaryRate: 0.25,
          granulationRate: 0.10,
          capillaryStrength: 0.12,
          paperDrag: 0.22,
          paperContactAngle: 0.20,
          paperBucklingRate: 0.20,
          stokesSettlingRate: 0.40,
          wetDarkeningStrength: 0.55
        };
      case 2:
      default:
        // 2: Kobishi (古美紙 - Antique Edo Tea-Patina Washi): Naturally aged tea-tannin patina with balanced sumi-e wash
        return {
          paperRoughness: 0.85,
          paperPermeability: 1.25,
          paperCapillaryRate: 1.15,
          granulationRate: 0.75,
          capillaryStrength: 0.36,
          paperDrag: 0.16,
          paperContactAngle: 0.75,
          paperBucklingRate: 0.70,
          stokesSettlingRate: 0.90,
          wetDarkeningStrength: 0.95
        };
    }
  }

  // Builds an independent 144-byte uniform ArrayBuffer for pre-generating specific paper presets
  public buildPresetUniformData(paperType: number, gridWidth: number, gridHeight: number): ArrayBuffer {
    const buf = new ArrayBuffer(UniformsManager.UNIFORMS_BYTE_SIZE);
    const fView = new Float32Array(buf);
    const uView = new Uint32Array(buf);
    const preset = UniformsManager.getPaperPresetParams(paperType);

    fView[0] = gridWidth;
    fView[1] = gridHeight;
    fView[2] = 1.0 / gridWidth;
    fView[3] = 1.0 / gridHeight;
    fView[4] = 0.016;
    fView[5] = 0.0;
    uView[6] = 0;
    uView[7] = 0;
    uView[8] = 0;
    uView[9] = 0;
    fView[10] = this.params.viscosity;
    fView[11] = preset.paperDrag ?? this.params.paperDrag;
    fView[12] = preset.capillaryStrength ?? this.params.capillaryStrength;
    fView[13] = this.params.evaporationRate;
    fView[14] = this.params.coffeeRingFlux;
    fView[15] = this.params.pinningThreshold;
    fView[16] = this.params.zenFadeRate;
    fView[17] = this.params.omegaRelaxation;
    fView[18] = 1440;
    fView[19] = 900;
    fView[20] = 2.0;
    fView[21] = 1.6; // aspect ratio default
    fView[22] = 0.0;
    fView[23] = 0.0;
    uView[24] = paperType;
    fView[25] = this.params.waterDilution;
    fView[26] = preset.paperRoughness ?? this.params.paperRoughness;
    fView[27] = preset.paperPermeability ?? this.params.paperPermeability;
    fView[28] = preset.paperCapillaryRate ?? this.params.paperCapillaryRate;
    fView[29] = preset.granulationRate ?? this.params.granulationRate;
    fView[30] = preset.paperContactAngle ?? this.params.paperContactAngle;
    fView[31] = preset.paperBucklingRate ?? this.params.paperBucklingRate;
    fView[32] = this.params.marangoniFlowRate;
    fView[33] = preset.stokesSettlingRate ?? this.params.stokesSettlingRate;
    fView[34] = preset.wetDarkeningStrength ?? this.params.wetDarkeningStrength;
    fView[35] = 0.0;

    return buf;
  }

  public uploadSegments(segments: SegmentOutput[]): number {
    const count = Math.min(segments.length, UniformsManager.MAX_SEGMENTS);
    if (count === 0) return 0;

    for (let i = 0; i < count; i++) {
      const seg = segments[i];
      const offset = i * 20; // 20 floats = 80 bytes

      // p0 (vec2)
      this.segmentFloatView[offset + 0] = seg.p0[0];
      this.segmentFloatView[offset + 1] = seg.p0[1];
      // p1 (vec2)
      this.segmentFloatView[offset + 2] = seg.p1[0];
      this.segmentFloatView[offset + 3] = seg.p1[1];
      // velocity (vec2)
      this.segmentFloatView[offset + 4] = seg.velocity[0];
      this.segmentFloatView[offset + 5] = seg.velocity[1];
      // radius0, radius1
      this.segmentFloatView[offset + 6] = seg.radius0;
      this.segmentFloatView[offset + 7] = seg.radius1;
      // water_amount (f32)
      this.segmentFloatView[offset + 8] = seg.waterAmount;
      // pigment_id (u32)
      this.segmentUintView[offset + 9] = seg.pigmentId;
      // pigment_density (f32)
      this.segmentFloatView[offset + 10] = seg.pigmentDensity;
      // brush_type (u32)
      this.segmentUintView[offset + 11] = seg.brushType;
      // azimuth (f32)
      this.segmentFloatView[offset + 12] = seg.azimuth;
      // aspect_ratio (f32)
      this.segmentFloatView[offset + 13] = seg.aspectRatio;
      // bristle_splay (f32)
      this.segmentFloatView[offset + 14] = seg.bristleSplay;
      // dryness (f32)
      this.segmentFloatView[offset + 15] = seg.dryness;
      // curvature (f32)
      this.segmentFloatView[offset + 16] = seg.curvature ?? 0.0;
      // tilt_x (f32)
      this.segmentFloatView[offset + 17] = seg.tiltX ?? 0.0;
      // tilt_y (f32)
      this.segmentFloatView[offset + 18] = seg.tiltY ?? 0.0;
      // burst_seed (f32)
      this.segmentFloatView[offset + 19] = seg.burstSeed ?? 0.0;
    }

    this.device.queue.writeBuffer(
      this.segmentStorageBuffer,
      0,
      this.segmentArrayBuffer,
      0,
      count * UniformsManager.SEGMENT_BYTE_SIZE
    );

    return count;
  }
}
