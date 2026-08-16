// Uniforms and Dynamic Storage Buffer Manager for WebGPU Simulation

import { SegmentOutput } from '../input/SplineEngine';

export interface SimParameters {
  viscosity: number;          // 0.001..0.02
  paperDrag: number;          // 0.05..0.35
  capillaryStrength: number;  // 0.1..0.8
  evaporationRate: number;    // 0.005..0.05
  coffeeRingFlux: number;     // 0.2..1.5
  pinningThreshold: number;   // 0.05..0.3
  zenFadeRate: number;        // 0.002..0.02
  omegaRelaxation: number;    // 0.85
  breatheActive: boolean;     // Pause fading
  springRainActive: boolean;  // Clear / wash canvas
  // Advanced Physics
  gravity: [number, number];  // [gx, gy] in pixels/s^2 (e.g. [0, 18.0] for tilt)
  paperType: number;          // 0 = Sheng Xuan (raw), 1 = Torinoko (smooth), 2 = Echizen (rough)
  saltIntensity: number;      // 0.5..2.5
  paperRoughness: number;     // 0.2..1.8
  paperPermeability: number;  // 0.4..2.0
  paperCapillaryRate: number; // 0.5..2.0
  granulationRate: number;    // 0.0..1.5
}

export class UniformsManager {
  private device: GPUDevice;
  public uniformBuffer: GPUBuffer;
  public segmentStorageBuffer: GPUBuffer;

  private uniformData = new ArrayBuffer(128); // 32 floats / uints (128 bytes)
  private uniformFloatView: Float32Array;
  private uniformUintView: Uint32Array;

  public static readonly MAX_SEGMENTS = 512;
  // 80 bytes (20 floats) per segment
  private segmentArrayBuffer = new ArrayBuffer(UniformsManager.MAX_SEGMENTS * 80);
  private segmentFloatView: Float32Array;
  private segmentUintView: Uint32Array;

  public params: SimParameters = {
    viscosity: 0.004,
    paperDrag: 0.15,
    capillaryStrength: 0.35,
    evaporationRate: 0.015,
    coffeeRingFlux: 0.75,
    pinningThreshold: 0.12,
    zenFadeRate: 0.0045, // gentle ~3-4 minute fade
    omegaRelaxation: 0.85,
    breatheActive: false,
    springRainActive: false,
    gravity: [0.0, 0.0],
    paperType: 0, // Sheng Xuan default
    saltIntensity: 1.2,
    paperRoughness: 1.0,
    paperPermeability: 1.0,
    paperCapillaryRate: 1.0,
    granulationRate: 0.6
  };

  constructor(device: GPUDevice) {
    this.device = device;
    this.uniformFloatView = new Float32Array(this.uniformData);
    this.uniformUintView = new Uint32Array(this.uniformData);

    this.segmentFloatView = new Float32Array(this.segmentArrayBuffer);
    this.segmentUintView = new Uint32Array(this.segmentArrayBuffer);

    // Create GPU Uniform Buffer (128 bytes)
    this.uniformBuffer = this.device.createBuffer({
      label: 'sim_uniforms_buffer',
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create GPU Storage Buffer for segments (80 bytes per segment)
    this.segmentStorageBuffer = this.device.createBuffer({
      label: 'brush_segments_storage_buffer',
      size: UniformsManager.MAX_SEGMENTS * 80,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
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
    // Offset 8: breathe_active, spring_rain_active (u32)
    this.uniformUintView[8] = this.params.breatheActive ? 1 : 0;
    this.uniformUintView[9] = this.params.springRainActive ? 1 : 0;
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
    // Offset 20: dpr, screen_time
    this.uniformFloatView[20] = dpr;
    this.uniformFloatView[21] = time;

    // Offset 22: gravity (vec2)
    this.uniformFloatView[22] = this.params.gravity[0];
    this.uniformFloatView[23] = this.params.gravity[1];
    // Offset 24: paper_type (u32)
    this.uniformUintView[24] = this.params.paperType;
    // Offset 25: salt_intensity (f32)
    this.uniformFloatView[25] = this.params.saltIntensity;
    // Offset 26: paper_roughness (f32)
    this.uniformFloatView[26] = this.params.paperRoughness;
    // Offset 27: paper_permeability (f32)
    this.uniformFloatView[27] = this.params.paperPermeability;
    // Offset 28: paper_capillary_rate (f32)
    this.uniformFloatView[28] = this.params.paperCapillaryRate;
    // Offset 29: granulation_rate (f32)
    this.uniformFloatView[29] = this.params.granulationRate;
    // Offset 30 & 31: padding
    this.uniformFloatView[30] = 0.0;
    this.uniformFloatView[31] = 0.0;

    // Write to GPU
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
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
      // pad (f32)
      this.segmentFloatView[offset + 19] = 0.0;
    }

    // Write slice to GPU
    this.device.queue.writeBuffer(
      this.segmentStorageBuffer,
      0,
      this.segmentArrayBuffer,
      0,
      count * 80
    );

    return count;
  }
}
