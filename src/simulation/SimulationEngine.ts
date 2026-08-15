// Master Simulation Engine for WebGPU Watercolor Engine
// Coordinates ping-pong buffers, compute dispatches, and dual-resolution Kubelka-Munk rendering

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
  private texPigmentSusp: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPigmentPinned: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texPressure: ReturnType<WebGPUContext['createSimulationTexturePair']>;
  private texParchment: ReturnType<WebGPUContext['createTexture8']>;

  // Ping-pong state indices (0 = A is input, B is output; 1 = B is input, A is output)
  private pingPongVelocity = 0;
  private pingPongWater = 0;
  private pingPongSusp = 0;
  private pingPongPinned = 0;
  private pingPongPressure = 0;

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

  // Pre-allocated static BindGroups to eliminate per-frame allocations & GC churn
  private bgBrushInject: GPUBindGroup[] = [];
  private bgAdvect: GPUBindGroup[] = [];
  private bgDivergence: GPUBindGroup[] = [];
  private bgJacobi: GPUBindGroup[][] = []; // [wIndex][pIndex]
  private bgProject: GPUBindGroup[][] = []; // [vIndex][pIndex]
  private bgCapillary: GPUBindGroup[] = [];
  private bgEvaporate: GPUBindGroup[] = [];
  private bgRenderKM: GPUBindGroup[] = [];

  private startTime = performance.now();
  private lastFrameTime = performance.now();

  constructor(ctx: WebGPUContext) {
    this.ctx = ctx;
    this.uniforms = new UniformsManager(ctx.device);

    const N = SimulationEngine.GRID_SIZE;
    this.texVelocity = ctx.createSimulationTexturePair(N, N, 'velocity');
    this.texWater = ctx.createSimulationTexturePair(N, N, 'water');
    this.texPigmentSusp = ctx.createSimulationTexturePair(N, N, 'pigment_susp');
    this.texPigmentPinned = ctx.createSimulationTexturePair(N, N, 'pigment_pinned');
    this.texPressure = ctx.createSimulationTexturePair(N, N, 'pressure');
    this.texParchment = ctx.createTexture8(N, N, 'parchment');

    this.initPipelines();
    this.initStaticBindGroups();
    this.generateParchment();
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

    // Ping-pong variations: 0 = (A in, B out), 1 = (B in, A out)
    for (let i = 0; i < 2; i++) {
      const vIn = i === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const vOut = i === 0 ? this.texVelocity.viewB : this.texVelocity.viewA;
      const wIn = i === 0 ? this.texWater.viewA : this.texWater.viewB;
      const wOut = i === 0 ? this.texWater.viewB : this.texWater.viewA;
      const sIn = i === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const sOut = i === 0 ? this.texPigmentSusp.viewB : this.texPigmentSusp.viewA;
      const pIn = i === 0 ? this.texPigmentPinned.viewA : this.texPigmentPinned.viewB;
      const pOut = i === 0 ? this.texPigmentPinned.viewB : this.texPigmentPinned.viewA;

      // 1. Brush Injection
      this.bgBrushInject[i] = d.createBindGroup({
        label: `bg_brush_inject_${i}`,
        layout: this.pipeBrushInject.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: sBuf },
          { binding: 2, resource: vIn },
          { binding: 3, resource: vOut },
          { binding: 4, resource: wIn },
          { binding: 5, resource: wOut },
          { binding: 6, resource: sIn },
          { binding: 7, resource: sOut }
        ]
      });

      // 2. Advection
      this.bgAdvect[i] = d.createBindGroup({
        label: `bg_advect_${i}`,
        layout: this.pipeAdvect.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: vIn },
          { binding: 2, resource: vOut },
          { binding: 3, resource: wIn },
          { binding: 4, resource: wOut },
          { binding: 5, resource: sIn },
          { binding: 6, resource: sOut },
          { binding: 7, resource: parchmentView }
        ]
      });

      // 3. Divergence (vIn -> texPressure.viewA)
      this.bgDivergence[i] = d.createBindGroup({
        label: `bg_divergence_${i}`,
        layout: this.pipeDivergence.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: vIn },
          { binding: 2, resource: this.texPressure.viewA }
        ]
      });

      // 6. Capillary Diffusion
      this.bgCapillary[i] = d.createBindGroup({
        label: `bg_capillary_${i}`,
        layout: this.pipeCapillaryDiffusion.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: wIn },
          { binding: 2, resource: wOut },
          { binding: 3, resource: sIn },
          { binding: 4, resource: sOut },
          { binding: 5, resource: parchmentView }
        ]
      });

      // 7. Evaporation & Pinning
      this.bgEvaporate[i] = d.createBindGroup({
        label: `bg_evaporate_${i}`,
        layout: this.pipeEvaporatePinning.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: wIn },
          { binding: 2, resource: wOut },
          { binding: 3, resource: sIn },
          { binding: 4, resource: sOut },
          { binding: 5, resource: pIn },
          { binding: 6, resource: pOut },
          { binding: 7, resource: parchmentView }
        ]
      });

      // 8. Render KM
      this.bgRenderKM[i] = d.createBindGroup({
        label: `bg_render_km_${i}`,
        layout: this.pipeRenderKM.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: uBuf },
          { binding: 1, resource: wIn },
          { binding: 2, resource: sIn },
          { binding: 3, resource: pIn },
          { binding: 4, resource: parchmentView }
        ]
      });
    }

    // 4. Jacobi Pressure Solver (Matrix of wState [0,1] x pState [0,1])
    this.bgJacobi = [[], []];
    for (let w = 0; w < 2; w++) {
      const wIn = w === 0 ? this.texWater.viewA : this.texWater.viewB;
      for (let p = 0; p < 2; p++) {
        const prIn = p === 0 ? this.texPressure.viewA : this.texPressure.viewB;
        const prOut = p === 0 ? this.texPressure.viewB : this.texPressure.viewA;
        this.bgJacobi[w][p] = d.createBindGroup({
          label: `bg_jacobi_w${w}_p${p}`,
          layout: this.pipeJacobiPressure.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: prIn },
            { binding: 2, resource: prOut },
            { binding: 3, resource: wIn }
          ]
        });
      }
    }

    // 5. Velocity Projection (Matrix of vState [0,1] x pState [0,1])
    this.bgProject = [[], []];
    for (let v = 0; v < 2; v++) {
      const vIn = v === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const vOut = v === 0 ? this.texVelocity.viewB : this.texVelocity.viewA;
      for (let p = 0; p < 2; p++) {
        const prIn = p === 0 ? this.texPressure.viewA : this.texPressure.viewB;
        this.bgProject[v][p] = d.createBindGroup({
          label: `bg_project_v${v}_p${p}`,
          layout: this.pipeProject.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: uBuf },
            { binding: 1, resource: vIn },
            { binding: 2, resource: prIn },
            { binding: 3, resource: vOut }
          ]
        });
      }
    }
  }

  // Runs once on startup to synthesize procedural handmade Washi parchment texture
  private generateParchment(): void {
    const encoder = this.ctx.device.createCommandEncoder({ label: 'parchment_gen_encoder' });
    const pass = encoder.beginComputePass({ label: 'parchment_gen_pass' });

    const bindGroup = this.ctx.device.createBindGroup({
      label: 'bg_parchment_gen',
      layout: this.pipeParchmentGen.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texParchment.view }
      ]
    });

    pass.setPipeline(this.pipeParchmentGen);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(SimulationEngine.GRID_SIZE / 16, SimulationEngine.GRID_SIZE / 16, 1);
    pass.end();

    this.ctx.device.queue.submit([encoder.finish()]);
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
    if (isDrawing && segCount > 0) {
      computePass.setPipeline(this.pipeBrushInject);
      computePass.setBindGroup(0, this.bgBrushInject[this.pingPongVelocity]);
      computePass.dispatchWorkgroups(workgroups, workgroups, 1);

      this.pingPongVelocity = 1 - this.pingPongVelocity;
      this.pingPongWater = 1 - this.pingPongWater;
      this.pingPongSusp = 1 - this.pingPongSusp;
    }

    // --- PHASE 2: Navier-Stokes Advection ---
    computePass.setPipeline(this.pipeAdvect);
    computePass.setBindGroup(0, this.bgAdvect[this.pingPongVelocity]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);

    this.pingPongVelocity = 1 - this.pingPongVelocity;
    this.pingPongWater = 1 - this.pingPongWater;
    this.pingPongSusp = 1 - this.pingPongSusp;

    // --- PHASE 3: Velocity Divergence ---
    computePass.setPipeline(this.pipeDivergence);
    computePass.setBindGroup(0, this.bgDivergence[this.pingPongVelocity]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);
    this.pingPongPressure = 0; // divergence was stored into pressure.viewA

    // --- PHASE 4: 32-Iteration Mass-Conserving Free-Surface Jacobi Pressure Solver ---
    computePass.setPipeline(this.pipeJacobiPressure);
    const wState = this.pingPongWater;
    for (let iter = 0; iter < 32; iter++) {
      computePass.setBindGroup(0, this.bgJacobi[wState][this.pingPongPressure]);
      computePass.dispatchWorkgroups(workgroups, workgroups, 1);
      this.pingPongPressure = 1 - this.pingPongPressure;
    }

    // --- PHASE 5: Velocity Projection ---
    computePass.setPipeline(this.pipeProject);
    computePass.setBindGroup(0, this.bgProject[this.pingPongVelocity][this.pingPongPressure]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);
    this.pingPongVelocity = 1 - this.pingPongVelocity;

    // --- PHASE 6: Capillary Diffusion & Fiber Soaking ---
    computePass.setPipeline(this.pipeCapillaryDiffusion);
    computePass.setBindGroup(0, this.bgCapillary[this.pingPongWater]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);

    this.pingPongWater = 1 - this.pingPongWater;
    this.pingPongSusp = 1 - this.pingPongSusp;

    // --- PHASE 7: Evaporation, Coffee-Ring & Zen Fade ---
    computePass.setPipeline(this.pipeEvaporatePinning);
    computePass.setBindGroup(0, this.bgEvaporate[this.pingPongWater]);
    computePass.dispatchWorkgroups(workgroups, workgroups, 1);

    this.pingPongWater = 1 - this.pingPongWater;
    this.pingPongSusp = 1 - this.pingPongSusp;
    this.pingPongPinned = 1 - this.pingPongPinned;

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
    renderPass.setBindGroup(0, this.bgRenderKM[this.pingPongWater]);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    // Submit single command buffer for the frame
    this.ctx.device.queue.submit([encoder.finish()]);
  }
}
