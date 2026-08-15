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

  // Master frame execution
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

    // --- PASS 1: Brush Injection (if segments exist) ---
    if (isDrawing && segCount > 0) {
      const vIn = this.pingPongVelocity === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const vOut = this.pingPongVelocity === 0 ? this.texVelocity.viewB : this.texVelocity.viewA;
      const wIn = this.pingPongWater === 0 ? this.texWater.viewA : this.texWater.viewB;
      const wOut = this.pingPongWater === 0 ? this.texWater.viewB : this.texWater.viewA;
      const sIn = this.pingPongSusp === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const sOut = this.pingPongSusp === 0 ? this.texPigmentSusp.viewB : this.texPigmentSusp.viewA;

      const bgBrush = this.ctx.device.createBindGroup({
        layout: this.pipeBrushInject.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: { buffer: this.uniforms.segmentStorageBuffer } },
          { binding: 2, resource: vIn },
          { binding: 3, resource: vOut },
          { binding: 4, resource: wIn },
          { binding: 5, resource: wOut },
          { binding: 6, resource: sIn },
          { binding: 7, resource: sOut }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'brush_inject_pass' });
      pass.setPipeline(this.pipeBrushInject);
      pass.setBindGroup(0, bgBrush);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      // Swap ping-pongs
      this.pingPongVelocity = 1 - this.pingPongVelocity;
      this.pingPongWater = 1 - this.pingPongWater;
      this.pingPongSusp = 1 - this.pingPongSusp;
    }

    // --- PASS 2: Advection ---
    {
      const vIn = this.pingPongVelocity === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const vOut = this.pingPongVelocity === 0 ? this.texVelocity.viewB : this.texVelocity.viewA;
      const wIn = this.pingPongWater === 0 ? this.texWater.viewA : this.texWater.viewB;
      const wOut = this.pingPongWater === 0 ? this.texWater.viewB : this.texWater.viewA;
      const sIn = this.pingPongSusp === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const sOut = this.pingPongSusp === 0 ? this.texPigmentSusp.viewB : this.texPigmentSusp.viewA;

      const bgAdvect = this.ctx.device.createBindGroup({
        layout: this.pipeAdvect.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: vIn },
          { binding: 2, resource: vOut },
          { binding: 3, resource: wIn },
          { binding: 4, resource: wOut },
          { binding: 5, resource: sIn },
          { binding: 6, resource: sOut },
          { binding: 7, resource: this.texParchment.view }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'advect_pass' });
      pass.setPipeline(this.pipeAdvect);
      pass.setBindGroup(0, bgAdvect);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongVelocity = 1 - this.pingPongVelocity;
      this.pingPongWater = 1 - this.pingPongWater;
      this.pingPongSusp = 1 - this.pingPongSusp;
    }

    // --- PASS 3: Divergence ---
    {
      const vIn = this.pingPongVelocity === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const pOut = this.texPressure.viewA;

      const bgDiv = this.ctx.device.createBindGroup({
        layout: this.pipeDivergence.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: vIn },
          { binding: 2, resource: pOut }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'divergence_pass' });
      pass.setPipeline(this.pipeDivergence);
      pass.setBindGroup(0, bgDiv);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongPressure = 0;
    }

    // --- PASS 4: 8-Iteration Porous Jacobi Pressure Solver ---
    for (let iter = 0; iter < 8; iter++) {
      const pIn = this.pingPongPressure === 0 ? this.texPressure.viewA : this.texPressure.viewB;
      const pOut = this.pingPongPressure === 0 ? this.texPressure.viewB : this.texPressure.viewA;

      const bgJacobi = this.ctx.device.createBindGroup({
        layout: this.pipeJacobiPressure.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: pIn },
          { binding: 2, resource: pOut }
        ]
      });

      const pass = encoder.beginComputePass({ label: `jacobi_pressure_pass_${iter}` });
      pass.setPipeline(this.pipeJacobiPressure);
      pass.setBindGroup(0, bgJacobi);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongPressure = 1 - this.pingPongPressure;
    }

    // --- PASS 5: Velocity Projection ---
    {
      const vIn = this.pingPongVelocity === 0 ? this.texVelocity.viewA : this.texVelocity.viewB;
      const pIn = this.pingPongPressure === 0 ? this.texPressure.viewA : this.texPressure.viewB;
      const vOut = this.pingPongVelocity === 0 ? this.texVelocity.viewB : this.texVelocity.viewA;

      const bgProject = this.ctx.device.createBindGroup({
        layout: this.pipeProject.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: vIn },
          { binding: 2, resource: pIn },
          { binding: 3, resource: vOut }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'project_pass' });
      pass.setPipeline(this.pipeProject);
      pass.setBindGroup(0, bgProject);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongVelocity = 1 - this.pingPongVelocity;
    }

    // --- PASS 6: Capillary Diffusion & Fiber Soaking ---
    {
      const wIn = this.pingPongWater === 0 ? this.texWater.viewA : this.texWater.viewB;
      const wOut = this.pingPongWater === 0 ? this.texWater.viewB : this.texWater.viewA;
      const sIn = this.pingPongSusp === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const sOut = this.pingPongSusp === 0 ? this.texPigmentSusp.viewB : this.texPigmentSusp.viewA;

      const bgCap = this.ctx.device.createBindGroup({
        layout: this.pipeCapillaryDiffusion.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: wIn },
          { binding: 2, resource: wOut },
          { binding: 3, resource: sIn },
          { binding: 4, resource: sOut },
          { binding: 5, resource: this.texParchment.view }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'capillary_pass' });
      pass.setPipeline(this.pipeCapillaryDiffusion);
      pass.setBindGroup(0, bgCap);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongWater = 1 - this.pingPongWater;
      this.pingPongSusp = 1 - this.pingPongSusp;
    }

    // --- PASS 7: Evaporation, Coffee-Ring & Zen Fade ---
    {
      const wIn = this.pingPongWater === 0 ? this.texWater.viewA : this.texWater.viewB;
      const wOut = this.pingPongWater === 0 ? this.texWater.viewB : this.texWater.viewA;
      const sIn = this.pingPongSusp === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const sOut = this.pingPongSusp === 0 ? this.texPigmentSusp.viewB : this.texPigmentSusp.viewA;
      const pIn = this.pingPongPinned === 0 ? this.texPigmentPinned.viewA : this.texPigmentPinned.viewB;
      const pOut = this.pingPongPinned === 0 ? this.texPigmentPinned.viewB : this.texPigmentPinned.viewA;

      const bgEvap = this.ctx.device.createBindGroup({
        layout: this.pipeEvaporatePinning.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: wIn },
          { binding: 2, resource: wOut },
          { binding: 3, resource: sIn },
          { binding: 4, resource: sOut },
          { binding: 5, resource: pIn },
          { binding: 6, resource: pOut },
          { binding: 7, resource: this.texParchment.view }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'evaporate_pinning_pass' });
      pass.setPipeline(this.pipeEvaporatePinning);
      pass.setBindGroup(0, bgEvap);
      pass.dispatchWorkgroups(workgroups, workgroups, 1);
      pass.end();

      this.pingPongWater = 1 - this.pingPongWater;
      this.pingPongSusp = 1 - this.pingPongSusp;
      this.pingPongPinned = 1 - this.pingPongPinned;
    }

    // --- PASS 8: Master Dual-Resolution Kubelka-Munk Render Pass ---
    {
      const currentTarget = this.ctx.context.getCurrentTexture().createView();
      const wIn = this.pingPongWater === 0 ? this.texWater.viewA : this.texWater.viewB;
      const sIn = this.pingPongSusp === 0 ? this.texPigmentSusp.viewA : this.texPigmentSusp.viewB;
      const pIn = this.pingPongPinned === 0 ? this.texPigmentPinned.viewA : this.texPigmentPinned.viewB;

      const bgRender = this.ctx.device.createBindGroup({
        layout: this.pipeRenderKM.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms.uniformBuffer } },
          { binding: 1, resource: wIn },
          { binding: 2, resource: sIn },
          { binding: 3, resource: pIn },
          { binding: 4, resource: this.texParchment.view }
        ]
      });

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
      renderPass.setBindGroup(0, bgRender);
      renderPass.draw(3, 1, 0, 0);
      renderPass.end();
    }

    this.ctx.device.queue.submit([encoder.finish()]);
  }
}
