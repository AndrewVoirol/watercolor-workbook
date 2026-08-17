// Master Simulation Engine for WebGPU Watercolor Engine
// Coordinates ping-pong buffers, compute dispatches, dual-resolution Kubelka-Munk rendering with full (K, S) transport,
// and advanced physics (Stokes sedimentation, Tarashikomi Marangoni marbling, gravity/tilt flow, and 6 Washi papers).

import { WebGPUContext } from './WebGPUContext';
import { UniformsManager } from './UniformsManager';
import { SegmentOutput } from '../input/SplineEngine';

// Import raw WGSL shader code
import commonWGSL from './shaders/common.wgsl?raw';
import parchmentGenWGSL from './shaders/parchment_gen.wgsl?raw';
import brushInjectWGSL from './shaders/brush_inject.wgsl?raw';
import advectWGSL from './shaders/advect.wgsl?raw';
import divergenceWGSL from './shaders/divergence.wgsl?raw';
import jacobiPressureWGSL from './shaders/jacobi_pressure.wgsl?raw';
import projectWGSL from './shaders/project.wgsl?raw';
import capillaryDiffusionWGSL from './shaders/capillary_diffusion.wgsl?raw';
import evaporatePinningWGSL from './shaders/evaporate_pinning.wgsl?raw';
import renderKMWGSL from './shaders/render_km.wgsl?raw';

export class SimulationEngine {
  public static readonly GRID_SIZE = 1024;
  private ctx: WebGPUContext;
  public uniforms: UniformsManager;

  // Textures (Ping-Pong pairs)
  private texVelocity: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texWater: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPigmentSuspK: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPigmentSuspS: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPigmentPinnedK: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPigmentPinnedS: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPressure: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texParchment: ReturnType<WebGPUContext['createTexture8']>;
  private texParchmentCache: GPUTexture[] = [];

  // Exact State Tracking Indices (0 = ViewA active, 1 = ViewB active)
  private vState = 0; // Velocity
  private wState = 0; // Water & Suspended Pigment (K, S)
  private pState = 0; // Pinned Pigment (K, S)
  private prState = 0; // Pressure

  // Compute Pipelines
  private pipeParchmentGen!: GPUComputePipeline;
  private pipeBrushInject!: GPUComputePipeline;
  private pipeAdvect!: GPUComputePipeline;
  private pipeDivergence!: GPUComputePipeline;
  private pipeJacobiPressure!: GPUComputePipeline;
  private pipeProject!: GPUComputePipeline;
  private pipeCapillaryDiffusion!: GPUComputePipeline;
  private pipeEvaporatePinning!: GPUComputePipeline;

  // Render Pipeline
  private pipeRenderKM!: GPURenderPipeline;

  // Pre-allocated static BindGroups matrix
  private bgBrushInject: GPUBindGroup[][][] = []; // [v][w][p]
  private bgAdvect: GPUBindGroup[][] = [];        // [v][w]
  private bgDivergence: GPUBindGroup[] = [];      // [v]
  private bgJacobi: GPUBindGroup[][] = [];        // [w][pr]
  private bgProject: GPUBindGroup[][] = [];       // [v][pr]
  private bgCapillary: GPUBindGroup[] = [];       // [w]
  private bgEvaporate: GPUBindGroup[][] = [];     // [w][p]
  private bgRenderKM: GPUBindGroup[][] = [];      // [w][p]

  private startTime = performance.now();
  private lastFrameTime = performance.now();
  private springRainFramesRemaining = 0;

  constructor(ctx: WebGPUContext) {
    this.ctx = ctx;
    this.uniforms = new UniformsManager(ctx.device);

    const N = SimulationEngine.GRID_SIZE;
    this.texVelocity = ctx.createSimulationTexturePair(N, N, 'velocity');
    this.texWater = ctx.createSimulationTexturePair(N, N, 'water');
    this.texPigmentSuspK = ctx.createSimulationTexturePair(N, N, 'pigment_susp_k');
    this.texPigmentSuspS = ctx.createSimulationTexturePair(N, N, 'pigment_susp_s');
    this.texPigmentPinnedK = ctx.createSimulationTexturePair(N, N, 'pigment_pinned_k');
    this.texPigmentPinnedS = ctx.createSimulationTexturePair(N, N, 'pigment_pinned_s');
    this.texPressure = ctx.createSimulationTexturePair(N, N, 'pressure');
    this.texParchment = ctx.createTexture8(N, N, 'parchment');

    for (let p = 0; p < 6; p++) {
      const cached = ctx.createTexture8(N, N, `parchment_cache_${p}`);
      this.texParchmentCache[p] = cached.texture;
    }

    this.initPipelines();
    this.initStaticBindGroups();
    this.pregenerateAllParchments();
  }

  private initPipelines(): void {
    const d = this.ctx.device;

    // 1. Parchment Generator Pipeline
    const modParchment = this.ctx.createShaderModule(parchmentGenWGSL, commonWGSL, 'mod_parchment_gen');
    this.pipeParchmentGen = d.createComputePipeline({
      label: 'pipe_parchment_gen',
      layout: 'auto',
      compute: { module: modParchment, entryPoint: 'main' }
    });

    // 2. Brush Injection Pipeline
    const modBrush = this.ctx.createShaderModule(brushInjectWGSL, commonWGSL, 'mod_brush_inject');
    this.pipeBrushInject = d.createComputePipeline({
      label: 'pipe_brush_inject',
      layout: 'auto',
      compute: { module: modBrush, entryPoint: 'main' }
    });

    // 3. Advection Pipeline
    const modAdvect = this.ctx.createShaderModule(advectWGSL, commonWGSL, 'mod_advect');
    this.pipeAdvect = d.createComputePipeline({
      label: 'pipe_advect',
      layout: 'auto',
      compute: { module: modAdvect, entryPoint: 'main' }
    });

    // 4. Divergence Pipeline
    const modDiv = this.ctx.createShaderModule(divergenceWGSL, commonWGSL, 'mod_divergence');
    this.pipeDivergence = d.createComputePipeline({
      label: 'pipe_divergence',
      layout: 'auto',
      compute: { module: modDiv, entryPoint: 'main' }
    });

    // 5. Jacobi Pressure Solver Pipeline
    const modJacobi = this.ctx.createShaderModule(jacobiPressureWGSL, commonWGSL, 'mod_jacobi_pressure');
    this.pipeJacobiPressure = d.createComputePipeline({
      label: 'pipe_jacobi_pressure',
      layout: 'auto',
      compute: { module: modJacobi, entryPoint: 'main' }
    });

    // 6. Project Pipeline
    const modProject = this.ctx.createShaderModule(projectWGSL, commonWGSL, 'mod_project');
    this.pipeProject = d.createComputePipeline({
      label: 'pipe_project',
      layout: 'auto',
      compute: { module: modProject, entryPoint: 'main' }
    });

    // 7. Capillary Diffusion Pipeline
    const modCapillary = this.ctx.createShaderModule(capillaryDiffusionWGSL, commonWGSL, 'mod_capillary');
    this.pipeCapillaryDiffusion = d.createComputePipeline({
      label: 'pipe_capillary',
      layout: 'auto',
      compute: { module: modCapillary, entryPoint: 'main' }
    });

    // 8. Evaporation & Pinning Pipeline
    const modEvap = this.ctx.createShaderModule(evaporatePinningWGSL, commonWGSL, 'mod_evaporate_pinning');
    this.pipeEvaporatePinning = d.createComputePipeline({
      label: 'pipe_evaporate_pinning',
      layout: 'auto',
      compute: { module: modEvap, entryPoint: 'main' }
    });

    // 9. Master Dual-Resolution Kubelka-Munk Render Pipeline
    const modRender = this.ctx.createShaderModule(renderKMWGSL, commonWGSL, 'mod_render_km');
    this.pipeRenderKM = d.createRenderPipeline({
      label: 'pipe_render_km',
      layout: 'auto',
      vertex: {
        module: modRender,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: modRender,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.ctx.presentationFormat
          }
        ]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  // Pre-creates all static ping-pong GPUBindGroup variations at startup
  private initStaticBindGroups(): void {
    const d = this.ctx.device;
    const uBuf = { buffer: this.uniforms.uniformBuffer };
    const sBuf = { buffer: this.uniforms.segmentStorageBuffer };
    const parchmentView = this.texParchment.view;

    // Helper getters for view pairs
    const getVelIn = (v: number) => (v === 0 ? this.texVelocity.viewA : this.texVelocity.viewB);
    const getVelOut = (v: number) => (v === 0 ? this.texVelocity.viewB : this.texVelocity.viewA);
    const getWaterIn = (w: number) => (w === 0 ? this.texWater.viewA : this.texWater.viewB);
    const getWaterOut = (w: number) => (w === 0 ? this.texWater.viewB : this.texWater.viewA);
    const getSuspKIn = (w: number) => (w === 0 ? this.texPigmentSuspK.viewA : this.texPigmentSuspK.viewB);
    const getSuspKOut = (w: number) => (w === 0 ? this.texPigmentSuspK.viewB : this.texPigmentSuspK.viewA);
    const getSuspSIn = (w: number) => (w === 0 ? this.texPigmentSuspS.viewA : this.texPigmentSuspS.viewB);
    const getSuspSOut = (w: number) => (w === 0 ? this.texPigmentSuspS.viewB : this.texPigmentSuspS.viewA);
    const getPinnedKIn = (p: number) => (p === 0 ? this.texPigmentPinnedK.viewA : this.texPigmentPinnedK.viewB);
    const getPinnedKOut = (p: number) => (p === 0 ? this.texPigmentPinnedK.viewB : this.texPigmentPinnedK.viewA);
    const getPinnedSIn = (p: number) => (p === 0 ? this.texPigmentPinnedS.viewA : this.texPigmentPinnedS.viewB);
    const getPinnedSOut = (p: number) => (p === 0 ? this.texPigmentPinnedS.viewB : this.texPigmentPinnedS.viewA);
    const getPressIn = (pr: number) => (pr === 0 ? this.texPressure.viewA : this.texPressure.viewB);
    const getPressOut = (pr: number) => (pr === 0 ? this.texPressure.viewB : this.texPressure.viewA);

    // 1. Brush Injection Matrix: [v][w][p]
    this.bgBrushInject = [];
    for (let v = 0; v < 2; v++) {
      this.bgBrushInject[v] = [];
      for (let w = 0; w < 2; w++) {
        this.bgBrushInject[v][w] = [];
        for (let p = 0; p < 2; p++) {
          this.bgBrushInject[v][w][p] = d.createBindGroup({
            label: `bg_brush_inject_v${v}_w${w}_p${p}`,
            layout: this.pipeBrushInject.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: uBuf },
              { binding: 1, resource: sBuf },
              { binding: 2, resource: getVelIn(v) },
              { binding: 3, resource: getVelOut(v) },
              { binding: 4, resource: getWaterIn(w) },
              { binding: 5, resource: getWaterOut(w) },
              { binding: 6, resource: getSuspKIn(w) },
              { binding: 7, resource: getSuspKOut(w) },
              { binding: 8, resource: getSuspSIn(w) },
              { binding: 9, resource: getSuspSOut(w) },
              { binding: 10, resource: getPinnedKIn(p) },
              { binding: 11, resource: getPinnedKOut(p) },
              { binding: 12, resource: getPinnedSIn(p) },
              { binding: 13, resource: getPinnedSOut(p) },
              { binding: 14, resource: parchmentView }
            ]
          });
        }
      }
    }

    // 2. Advection Matrix: [v][w]
    this.bgAdvect = [];
    for (let v = 0; v < 2; v++) {
      this.bgAdvect[v] = [];
      for (let w = 0; w < 2; w++) {
        this.bgAdvect[v][w] = d.createBindGroup({
          label: `bg_advect_v${v}_w${w}`,
          layout: this.pipeAdvect.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: getVelIn(v) },
            { binding: 2, resource: getVelOut(v) },
            { binding: 3, resource: getWaterIn(w) },
            { binding: 4, resource: getWaterOut(w) },
            { binding: 5, resource: getSuspKIn(w) },
            { binding: 6, resource: getSuspKOut(w) },
            { binding: 7, resource: getSuspSIn(w) },
            { binding: 8, resource: getSuspSOut(w) },
            { binding: 9, resource: parchmentView }
          ]
        });
      }
    }

    // 3. Divergence: [v]
    this.bgDivergence = [];
    for (let v = 0; v < 2; v++) {
      this.bgDivergence[v] = d.createBindGroup({
        label: `bg_divergence_v${v}`,
        layout: this.pipeDivergence.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: getVelIn(v) },
          { binding: 2, resource: this.texPressure.viewA }
        ]
      });
    }

    // 4. Jacobi Solver: [w][pr]
    this.bgJacobi = [];
    for (let w = 0; w < 2; w++) {
      this.bgJacobi[w] = [];
      for (let pr = 0; pr < 2; pr++) {
        this.bgJacobi[w][pr] = d.createBindGroup({
          label: `bg_jacobi_w${w}_pr${pr}`,
          layout: this.pipeJacobiPressure.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: getPressIn(pr) },
            { binding: 2, resource: getPressOut(pr) },
            { binding: 3, resource: getWaterIn(w) }
          ]
        });
      }
    }

    // 5. Velocity Project: [v][pr]
    this.bgProject = [];
    for (let v = 0; v < 2; v++) {
      this.bgProject[v] = [];
      for (let pr = 0; pr < 2; pr++) {
        this.bgProject[v][pr] = d.createBindGroup({
          label: `bg_project_v${v}_pr${pr}`,
          layout: this.pipeProject.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: getVelIn(v) },
            { binding: 2, resource: getPressIn(pr) },
            { binding: 3, resource: getVelOut(v) }
          ]
        });
      }
    }

    // 6. Capillary Diffusion: [w]
    this.bgCapillary = [];
    for (let w = 0; w < 2; w++) {
      this.bgCapillary[w] = d.createBindGroup({
        label: `bg_capillary_w${w}`,
        layout: this.pipeCapillaryDiffusion.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: getWaterIn(w) },
          { binding: 2, resource: getWaterOut(w) },
          { binding: 3, resource: getSuspKIn(w) },
          { binding: 4, resource: getSuspKOut(w) },
          { binding: 5, resource: getSuspSIn(w) },
          { binding: 6, resource: getSuspSOut(w) },
          { binding: 7, resource: parchmentView }
        ]
      });
    }

    // 7. Evaporate Matrix: [w][p] & 8. Render KM Matrix: [w][p]
    this.bgEvaporate = [];
    this.bgRenderKM = [];
    for (let w = 0; w < 2; w++) {
      this.bgEvaporate[w] = [];
      this.bgRenderKM[w] = [];
      for (let p = 0; p < 2; p++) {
        this.bgEvaporate[w][p] = d.createBindGroup({
          label: `bg_evaporate_w${w}_p${p}`,
          layout: this.pipeEvaporatePinning.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: getWaterIn(w) },
            { binding: 2, resource: getWaterOut(w) },
            { binding: 3, resource: getSuspKIn(w) },
            { binding: 4, resource: getSuspKOut(w) },
            { binding: 5, resource: getSuspSIn(w) },
            { binding: 6, resource: getSuspSOut(w) },
            { binding: 7, resource: getPinnedKIn(p) },
            { binding: 8, resource: getPinnedKOut(p) },
            { binding: 9, resource: getPinnedSIn(p) },
            { binding: 10, resource: getPinnedSOut(p) },
            { binding: 11, resource: parchmentView }
          ]
        });

        this.bgRenderKM[w][p] = d.createBindGroup({
          label: `bg_render_km_w${w}_p${p}`,
          layout: this.pipeRenderKM.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: getWaterIn(w) },
            { binding: 2, resource: getSuspKIn(w) },
            { binding: 3, resource: getSuspSIn(w) },
            { binding: 4, resource: getPinnedKIn(p) },
            { binding: 5, resource: getPinnedSIn(p) },
            { binding: 6, resource: parchmentView }
          ]
        });
      }
    }
  }

  // Trigger Spring Rain clear lifecycle
  public triggerSpringRain(): void {
    this.springRainFramesRemaining = 60; // 1 second at 60fps
  }

  // Pre-computes all 6 authentic Washi parchment textures at initialization into GPU cache pool
  private pregenerateAllParchments(): void {
    const N = SimulationEngine.GRID_SIZE;
    const workgroups = N / 16;
    const d = this.ctx.device;

    const encoder = d.createCommandEncoder({ label: 'pregen_parchments_encoder' });

    for (let p = 0; p < 6; p++) {
      this.uniforms.params.paperType = p;
      this.applyPaperPresetParams(p);
      
      const presetData = this.uniforms.buildPresetUniformData(p, N, N);
      const tempBuf = d.createBuffer({
        label: `temp_preset_uniform_${p}`,
        size: UniformsManager.UNIFORMS_BYTE_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      d.queue.writeBuffer(tempBuf, 0, presetData);

      const cacheBindGroup = d.createBindGroup({
        label: `bg_parchment_gen_cache_${p}`,
        layout: this.pipeParchmentGen.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: tempBuf } },
          { binding: 1, resource: this.texParchmentCache[p].createView() }
        ]
      });

      const pass = encoder.beginComputePass({ label: `parchment_gen_pass_${p}` });
      pass.setPipeline(this.pipeParchmentGen);
      pass.setBindGroup(0, cacheBindGroup);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();
    }

    d.queue.submit([encoder.finish()]);

    // Set initial paper preset 0
    this.setPaperType(0);
  }

  private applyPaperPresetParams(typeId: number): void {
    const preset = UniformsManager.getPaperPresetParams(typeId);
    Object.assign(this.uniforms.params, preset);
  }

  // Instant O(1) Paper Substrate Switch via fast GPU texture copy (< 0.05ms)
  public setPaperType(typeId: number): void {
    this.uniforms.params.paperType = typeId;
    this.applyPaperPresetParams(typeId);

    if (this.texParchmentCache[typeId]) {
      const encoder = this.ctx.device.createCommandEncoder({ label: 'parchment_copy_encoder' });
      encoder.copyTextureToTexture(
        { texture: this.texParchmentCache[typeId] },
        { texture: this.texParchment.texture },
        [SimulationEngine.GRID_SIZE, SimulationEngine.GRID_SIZE, 1]
      );
      this.ctx.device.queue.submit([encoder.finish()]);
    }
  }

  // Set canvas tilt gravity acceleration
  public setGravity(gx: number, gy: number): void {
    this.uniforms.params.gravity = [gx, gy];
  }

  // Master frame execution: 0-allocation command dispatch inside consolidated single compute pass
  public step(
    isDrawing: boolean,
    segments: SegmentOutput[],
    screenWidth: number,
    screenHeight: number,
    dpr: number
  ): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) * 0.001, 0.033);
    this.lastFrameTime = now;
    const elapsed = (now - this.startTime) * 0.001;

    // Frame-accurate spring rain countdown
    if (this.springRainFramesRemaining > 0) {
      this.springRainFramesRemaining--;
      this.uniforms.params.springRainActive = true;
    } else {
      this.uniforms.params.springRainActive = false;
    }

    // 1. Upload segments & update uniforms
    const segCount = this.uniforms.uploadSegments(segments);
    this.uniforms.updateUniforms(
      SimulationEngine.GRID_SIZE,
      SimulationEngine.GRID_SIZE,
      dt,
      elapsed,
      isDrawing,
      segCount,
      screenWidth,
      screenHeight,
      dpr
    );

    const encoder = this.ctx.device.createCommandEncoder({ label: 'sim_frame_encoder' });
    const N = SimulationEngine.GRID_SIZE;
    const workgroups = N / 16;

    // Consolidated single compute pass for all simulation phases
    const computePass = encoder.beginComputePass({ label: 'sim_compute_pass' });

    // --- PHASE 1: Brush Injection (if drawing segments exist) ---
    if (segCount > 0) {
      computePass.setPipeline(this.pipeBrushInject);
      computePass.setBindGroup(0, this.bgBrushInject[this.vState][this.wState][this.pState]);
      computePass.dispatchWorkgroups(workgroups, workgroups, 1);

      this.vState = 1 - this.vState;
      this.wState = 1 - this.wState;
      this.pState = 1 - this.pState;
    }

    // --- PHASE 2: Navier-Stokes Advection with Tilt Gravity & Marangoni flow ---
    computePass.setPipeline(this.pipeAdvect);
    computePass.setBindGroup(0, this.bgAdvect[this.vState][this.wState]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);

    this.vState = 1 - this.vState;
    this.wState = 1 - this.wState;

    // --- PHASE 3: Velocity Divergence ---
    computePass.setPipeline(this.pipeDivergence);
    computePass.setBindGroup(0, this.bgDivergence[this.vState]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);
    this.prState = 0; // divergence was stored into pressure.viewA

    // --- PHASE 4: 32-Iteration Mass-Conserving Free-Surface Jacobi Pressure Solver ---
    computePass.setPipeline(this.pipeJacobiPressure);
    for (let iter = 0; iter < 32; iter++) {
      computePass.setBindGroup(0, this.bgJacobi[this.wState][this.prState]);
      computePass.dispatchWorkgroups(workgroups, workgroups, 1);
      this.prState = 1 - this.prState;
    }

    // --- PHASE 5: Velocity Projection ---
    computePass.setPipeline(this.pipeProject);
    computePass.setBindGroup(0, this.bgProject[this.vState][this.prState]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);
    this.vState = 1 - this.vState;

    // --- PHASE 6: Capillary Diffusion & Salt Hygroscopic Suction ---
    computePass.setPipeline(this.pipeCapillaryDiffusion);
    computePass.setBindGroup(0, this.bgCapillary[this.wState]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);
    this.wState = 1 - this.wState;

    // --- PHASE 7: Evaporation, Salt Halo Pinning, Stokes Sedimentation & Zen Fade ---
    computePass.setPipeline(this.pipeEvaporatePinning);
    computePass.setBindGroup(0, this.bgEvaporate[this.wState][this.pState]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);

    this.wState = 1 - this.wState;
    this.pState = 1 - this.pState;

    // End single compute pass
    computePass.end();

    // --- PHASE 8: Master Dual-Resolution Kubelka-Munk Render Pass ---
    const currentTarget = this.ctx.context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      label: 'render_km_pass',
      colorAttachments: [
        {
          view: currentTarget,
          clearValue: { r: 0.95, g: 0.92, b: 0.85, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });

    renderPass.setPipeline(this.pipeRenderKM);
    renderPass.setBindGroup(0, this.bgRenderKM[this.wState][this.pState]);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    // Submit single command buffer for the frame
    this.ctx.device.queue.submit([encoder.finish()]);
  }
}
