// Experiment 02: Brush Kinematics & Tactile Feel (Swept Ribbon with Striations vs. 3D Cosserat Elastic Bristles)

import { WebGPULabContext } from '../../harness/WebGPULabContext';
import { LabExperiment } from '../../harness/LabExperiment';
import { LabStrokePoint } from '../../harness/LabSplitCanvas';
import { TelemetryHUD } from '../../harness/TelemetryHUD';
import { CosseratBristleCluster } from './CosseratBristleCluster';

const SHADER_SOURCE = `
struct BrushParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  brush_type: u32,
  bristle_stiffness: f32,
  tooth_skip_dryness: f32,
  init_trigger: u32,
};

struct StrokePoint {
  p0: vec2<f32>,
  p1: vec2<f32>,
  radius: f32,
  speed: f32,
  azimuth: f32,
  is_active: u32,
};

struct BristleContact {
  pos: vec2<f32>,
  pressure: f32,
  is_active: u32,
};

struct BristleContactsUniform {
  contacts: array<BristleContact, 48>,
};

@group(0) @binding(0) var<uniform> params: BrushParams;
@group(0) @binding(1) var<uniform> stroke: StrokePoint;
@group(0) @binding(2) var in_ribbon: texture_2d<f32>;
@group(0) @binding(3) var out_ribbon: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var in_strands: texture_2d<f32>;
@group(0) @binding(5) var out_strands: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var<uniform> bristle_data: BristleContactsUniform;

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn dist_to_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) { return length(pa); }
  let t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  return length(pa - ba * t);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(params.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) { return; }

  let pos = vec2<f32>(coord);
  var ribbon = textureLoad(in_ribbon, coord, 0);
  var strands = textureLoad(in_strands, coord, 0);

  // Initial calligraphic sample "心"
  if (params.init_trigger == 1u) {
    let p_a = vec2<f32>(params.grid_size.x * 0.25, params.grid_size.y * 0.5);
    let p_b = vec2<f32>(params.grid_size.x * 0.75, params.grid_size.y * 0.5);
    let d_a = length(pos - p_a);
    let d_b = length(pos - p_b);
    let r_init = params.grid_size.x * 0.09;

    if (d_a < r_init) {
      let u = d_a / r_init;
      let w = (1.0 - u * u) * (cos(pos.y * 0.4) * 0.3 + 0.7);
      ribbon.r = max(ribbon.r, w * 0.9);
    }
    if (d_b < r_init) {
      let u = d_b / r_init;
      let w = (1.0 - u * u);
      strands.r = max(strands.r, w * 0.9);
    }
  }

  // --- MODEL A: Continuous Swept Ribbon with Sujime Striation Grooves ---
  if (stroke.is_active == 1u) {
    let norm_x0 = select(stroke.p0.x * 2.0, (stroke.p0.x - 0.5) * 2.0, stroke.p0.x >= 0.5);
    let norm_x1 = select(stroke.p1.x * 2.0, (stroke.p1.x - 0.5) * 2.0, stroke.p1.x >= 0.5);

    let p0_a = vec2<f32>(norm_x0 * 0.5 * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1_a = vec2<f32>(norm_x1 * 0.5 * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let r = stroke.radius;
    let dist_a = dist_to_segment(pos, p0_a, p1_a);
    if (dist_a < r) {
      let u = dist_a / max(r, 0.001);
      let ba = p1_a - p0_a;
      let perp = vec2<f32>(-ba.y, ba.x);
      let trans = dot(pos - p0_a, normalize(perp + vec2<f32>(0.0001))) / max(r, 0.001);
      let striation = cos(trans * 12.0 * 3.14159) * 0.35 + 0.65;
      let tooth_noise = hash12(pos * 0.35);
      let tooth_gate = select(1.0, smoothstep(0.3, 0.7, tooth_noise), params.tooth_skip_dryness > 0.3);

      let w = (1.0 - u * u) * striation * tooth_gate;
      ribbon.r = min(1.0, ribbon.r + w * 0.75);
    }
  }

  // --- MODEL B: 3D Cosserat Elastic Bristle Cluster Contact Deposition ---
  for (var i = 0u; i < 48u; i = i + 1u) {
    let c = bristle_data.contacts[i];
    if (c.is_active == 1u) {
      let d_hair = length(pos - c.pos);
      let r_hair = max(1.8, c.pressure * 4.0);
      if (d_hair < r_hair) {
        let w_hair = (1.0 - d_hair / r_hair) * c.pressure * 0.35;
        strands.r = min(1.0, strands.r + w_hair);
      }
    }
  }

  textureStore(out_ribbon, coord, ribbon);
  textureStore(out_strands, coord, strands);
}
`;

const RENDER_SHADER = `
struct BrushParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  brush_type: u32,
  bristle_stiffness: f32,
  tooth_skip_dryness: f32,
  init_trigger: u32,
};

@group(0) @binding(0) var<uniform> params: BrushParams;
@group(0) @binding(1) var in_ribbon: texture_2d<f32>;
@group(0) @binding(2) var in_strands: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 3.0,  1.0),
    vec2<f32>(-1.0, -3.0)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
  out.uv = vec2<f32>(
    pos[vertex_index].x * 0.5 + 0.5,
    -pos[vertex_index].y * 0.5 + 0.5
  );
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(in.uv * params.grid_size);
  let is_left = in.uv.x < 0.5;

  var density = 0.0;
  if (is_left) {
    density = textureLoad(in_ribbon, coord, 0).r;
  } else {
    density = textureLoad(in_strands, coord, 0).r;
  }

  let paper = vec3<f32>(0.96, 0.93, 0.88);
  let ink = vec3<f32>(0.14, 0.12, 0.11);
  var final_color = mix(paper, ink, clamp(density * 1.4, 0.0, 1.0));

  if (abs(in.uv.x - 0.5) < 0.0015) {
    final_color = vec3<f32>(0.25, 0.25, 0.30);
  }

  return vec4<f32>(final_color, 1.0);
}
`;

export class BrushKinematicsExperiment implements LabExperiment {
  public id = 2;
  public title = "Brush Kinematics & 3D Cosserat Rods";
  public subtitle = "Continuous Swept Ribbon vs. 3D Physical Cosserat Elastic Bristles";
  public sideALabel = "Model A: Swept Ribbon with Sujime Striations";
  public sideBLabel = "Model B: 3D Cosserat Elastic Bristle Cluster";

  private ctx!: WebGPULabContext;
  private hud!: TelemetryHUD;

  private pipeSim!: GPUComputePipeline;
  private pipeRender!: GPURenderPipeline;

  private texRibbon!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texStrands!: ReturnType<WebGPULabContext['createTexturePair']>;

  private bufParams!: GPUBuffer;
  private bufStroke!: GPUBuffer;
  private bufBristles!: GPUBuffer;

  private bgSim!: GPUBindGroup[];
  private bgRender!: GPUBindGroup[];

  private stateIdx = 0;
  private isDrawing = false;
  private p0 = { x: 0.25, y: 0.5 };
  private p1 = { x: 0.25, y: 0.5 };
  private radius = 18;
  private speed = 0.5;
  private azimuth = 0;
  private initTrigger = 1;

  // 3D Physical Cosserat Engine
  public cosseratCluster: CosseratBristleCluster;
  public show3DWireframe: boolean = true;
  private wireframeCanvas: HTMLCanvasElement | null = null;
  private wireframeCtx: CanvasRenderingContext2D | null = null;

  public brushType = 0;
  public bristleStiffness = 0.75;
  public capillaryClumping = 0.60;
  public toothSkipDryness = 0.25;
  public paperFriction = 0.45;

  private readonly N = 512;

  constructor() {
    this.cosseratCluster = new CosseratBristleCluster(36, 0);
  }

  public async init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void> {
    this.ctx = ctx;
    this.hud = hud;
    const d = ctx.device;

    this.texRibbon = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'ribbon');
    this.texStrands = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'strands');

    this.bufParams = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bufStroke = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 48 bristles * 16 bytes (vec2 pos, f32 pressure, u32 is_active) = 768 bytes
    this.bufBristles = d.createBuffer({
      size: 768,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modSim = ctx.createShaderModule(SHADER_SOURCE, 'sim_brush_kinematics');
    this.pipeSim = d.createComputePipeline({
      layout: 'auto',
      compute: { module: modSim, entryPoint: 'main' }
    });

    const modRender = ctx.createShaderModule(RENDER_SHADER, 'render_brush_kinematics');
    this.pipeRender = d.createRenderPipeline({
      layout: 'auto',
      vertex: { module: modRender, entryPoint: 'vs_main' },
      fragment: {
        module: modRender,
        entryPoint: 'fs_main',
        targets: [{ format: ctx.presentationFormat }]
      },
      primitive: { topology: 'triangle-list' }
    });

    this.initBindGroups();
    this.initWireframeCanvas();
    this.initTrigger = 1;
  }

  private initWireframeCanvas(): void {
    let overlay = document.getElementById('cosserat-overlay') as HTMLCanvasElement;
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'cosserat-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '20';
      const container = document.getElementById('viewport-container') || document.body;
      container.appendChild(overlay);
    }
    this.wireframeCanvas = overlay;
    this.wireframeCtx = overlay.getContext('2d');
  }

  private initBindGroups(): void {
    const d = this.ctx.device;
    this.bgSim = [
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texRibbon.viewA },
          { binding: 3, resource: this.texRibbon.viewB },
          { binding: 4, resource: this.texStrands.viewA },
          { binding: 5, resource: this.texStrands.viewB },
          { binding: 6, resource: { buffer: this.bufBristles } }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texRibbon.viewB },
          { binding: 3, resource: this.texRibbon.viewA },
          { binding: 4, resource: this.texStrands.viewB },
          { binding: 5, resource: this.texStrands.viewA },
          { binding: 6, resource: { buffer: this.bufBristles } }
        ]
      })
    ];

    this.bgRender = [
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texRibbon.viewB },
          { binding: 2, resource: this.texStrands.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texRibbon.viewA },
          { binding: 2, resource: this.texStrands.viewA }
        ]
      })
    ];
  }

  public renderUI(container: HTMLElement): void {
    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-header-title">3D Cosserat Hair Physics</div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Brush Type</span>
          </div>
          <div class="radio-group-segmented" id="group-brush-type">
            <div class="segmented-option ${this.brushType === 0 ? 'active' : ''}" data-val="0">丸筆 Maru (36)</div>
            <div class="segmented-option ${this.brushType === 1 ? 'active' : ''}" data-val="1">面相 Menso (16)</div>
            <div class="segmented-option ${this.brushType === 2 ? 'active' : ''}" data-val="2">刷毛 Hake (48)</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Bending Rigidity (EI)</span>
            <span class="control-value" id="val-stiff">${this.bristleStiffness.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-stiff" min="0.1" max="1.0" step="0.05" value="${this.bristleStiffness}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Capillary Clumping (Wetness)</span>
            <span class="control-value" id="val-clump">${this.capillaryClumping.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-clump" min="0.0" max="1.0" step="0.05" value="${this.capillaryClumping}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Paper Coulomb Friction (&mu;)</span>
            <span class="control-value" id="val-fric">${this.paperFriction.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-fric" min="0.0" max="1.0" step="0.05" value="${this.paperFriction}">
        </div>

        <div class="control-row" style="margin-top: 0.5rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; cursor: pointer; color: var(--lab-cyan);">
            <input type="checkbox" id="check-wireframe" ${this.show3DWireframe ? 'checked' : ''} style="cursor: pointer;">
            Show 3D Bristle Skeleton (Right Pane)
          </label>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-header-title">Physical Hair Comparison</div>
        <p style="font-size: 0.76rem; line-height: 1.5; color: var(--lab-text-muted); margin-bottom: 0.75rem;">
          Draw with your trackpad. On the <strong>Right</strong>, a bundle of 36–48 3D elastic rods physically bends against the paper plane. On the <strong>Left</strong>, a continuous swept ribbon interpolates your stroke.
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-amber);">
          🎯 Look for bristle splay on hard presses and individual hair trails (*kasure*).
        </p>
      </div>
    `;

    container.querySelectorAll('#group-brush-type .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-brush-type .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.brushType = parseInt(opt.getAttribute('data-val') || '0', 10);
        this.cosseratCluster.setBrushType(this.brushType);
      });
    });

    const sStiff = container.querySelector('#slide-stiff') as HTMLInputElement;
    const vStiff = container.querySelector('#val-stiff') as HTMLElement;
    sStiff?.addEventListener('input', () => {
      this.bristleStiffness = parseFloat(sStiff.value);
      this.cosseratCluster.bendingStiffness = this.bristleStiffness;
      vStiff.textContent = this.bristleStiffness.toFixed(2);
    });

    const sClump = container.querySelector('#slide-clump') as HTMLInputElement;
    const vClump = container.querySelector('#val-clump') as HTMLElement;
    sClump?.addEventListener('input', () => {
      this.capillaryClumping = parseFloat(sClump.value);
      this.cosseratCluster.capillaryClumping = this.capillaryClumping;
      vClump.textContent = this.capillaryClumping.toFixed(2);
    });

    const sFric = container.querySelector('#slide-fric') as HTMLInputElement;
    const vFric = container.querySelector('#val-fric') as HTMLElement;
    sFric?.addEventListener('input', () => {
      this.paperFriction = parseFloat(sFric.value);
      this.cosseratCluster.frictionCoeff = this.paperFriction;
      vFric.textContent = this.paperFriction.toFixed(2);
    });

    const cWire = container.querySelector('#check-wireframe') as HTMLInputElement;
    cWire?.addEventListener('change', () => {
      this.show3DWireframe = cWire.checked;
      if (this.wireframeCanvas) {
        this.wireframeCanvas.style.display = this.show3DWireframe ? 'block' : 'none';
      }
    });
  }

  public onStrokeStart(pt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: pt.x, y: pt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.speed = pt.speed;
    this.azimuth = pt.azimuth;
    this.radius = Math.max(8, pt.pressure * (this.brushType === 2 ? 36 : this.brushType === 1 ? 8 : 22));

    const normX = pt.x >= 0.5 ? pt.x : (pt.x + 0.5);
    this.cosseratCluster.updateHandleFromTrackpad(
      normX * this.N,
      pt.y * this.N,
      pt.speed,
      pt.pressure,
      true
    );
  }

  public onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: prevPt.x, y: prevPt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.speed = pt.speed;
    this.azimuth = pt.azimuth;
    this.radius = Math.max(8, pt.pressure * (this.brushType === 2 ? 36 : this.brushType === 1 ? 8 : 22));

    const normX = pt.x >= 0.5 ? pt.x : (pt.x + 0.5);
    this.cosseratCluster.updateHandleFromTrackpad(
      normX * this.N,
      pt.y * this.N,
      pt.speed,
      pt.pressure,
      true
    );
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
    this.cosseratCluster.updateHandleFromTrackpad(
      this.p1.x >= 0.5 ? this.p1.x * this.N : (this.p1.x + 0.5) * this.N,
      this.p1.y * this.N,
      0,
      0,
      false
    );
  }

  public reset(): void {
    const d = this.ctx.device;
    const zeroData = new Float32Array(this.N * this.N * 4);
    d.queue.writeTexture({ texture: this.texRibbon.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texRibbon.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texStrands.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texStrands.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    this.cosseratCluster.initBristles();
    this.initTrigger = 1;
  }

  public step(_w: number, _h: number, _dpr: number): void {
    const d = this.ctx.device;
    const now = performance.now();

    // 1. Step 3D Cosserat Physical Simulation
    this.cosseratCluster.stepPhysics(0.016);

    // 2. Prepare 48 bristle contact nodes for GPU shader
    const bristleBuffer = new ArrayBuffer(768);
    const bf32 = new Float32Array(bristleBuffer);
    const bu32 = new Uint32Array(bristleBuffer);

    let contactIdx = 0;
    for (const rod of this.cosseratCluster.bristles) {
      if (contactIdx >= 48) break;
      const tip = rod.nodes[rod.nodes.length - 1];
      const baseIdx = contactIdx * 4;
      bf32[baseIdx] = tip.pos[0];
      bf32[baseIdx + 1] = tip.pos[1];
      bf32[baseIdx + 2] = tip.isContact ? tip.contactPressure : 0.0;
      bu32[baseIdx + 3] = (this.isDrawing && tip.isContact) ? 1 : 0;
      contactIdx++;
    }
    d.queue.writeBuffer(this.bufBristles, 0, bristleBuffer);

    // 3. Render 3D Wireframe Overlay
    if (this.show3DWireframe) {
      this.draw3DBristleSkeleton();
    }

    const paramsData = new ArrayBuffer(48);
    const f32 = new Float32Array(paramsData);
    const u32 = new Uint32Array(paramsData);
    f32[0] = this.N;
    f32[1] = this.N;
    f32[2] = 0.016;
    f32[3] = now * 0.001;
    u32[4] = this.brushType;
    f32[5] = this.bristleStiffness;
    f32[6] = this.toothSkipDryness;
    u32[7] = this.initTrigger;
    d.queue.writeBuffer(this.bufParams, 0, paramsData);
    this.initTrigger = 0;

    const strokeData = new ArrayBuffer(32);
    const sf32 = new Float32Array(strokeData);
    const su32 = new Uint32Array(strokeData);
    sf32[0] = this.p0.x;
    sf32[1] = this.p0.y;
    sf32[2] = this.p1.x;
    sf32[3] = this.p1.y;
    sf32[4] = this.radius;
    sf32[5] = this.speed;
    sf32[6] = this.azimuth;
    su32[7] = this.isDrawing ? 1 : 0;
    d.queue.writeBuffer(this.bufStroke, 0, strokeData);

    const encoder = d.createCommandEncoder();
    const t0 = performance.now();

    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeSim);
    pass.setBindGroup(0, this.bgSim[this.stateIdx]);
    pass.dispatchWorkgroups(this.N / 16, this.N / 16, 1);
    pass.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.ctx.context.getCurrentTexture().createView(),
        clearValue: { r: 0.96, g: 0.93, b: 0.88, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    renderPass.setPipeline(this.pipeRender);
    renderPass.setBindGroup(0, this.bgRender[this.stateIdx]);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();

    d.queue.submit([encoder.finish()]);

    const dtCompute = performance.now() - t0;
    this.hud.recordFrame(dtCompute, this.N * this.N * 8 * 4);

    this.stateIdx = 1 - this.stateIdx;
    this.p0 = { ...this.p1 };
  }

  // Draw 3D Physical Bristle Skeleton wireframe on the overlay canvas
  private draw3DBristleSkeleton(): void {
    if (!this.wireframeCanvas || !this.wireframeCtx) return;
    const ctx = this.wireframeCtx;
    const rect = this.wireframeCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (this.wireframeCanvas.width !== Math.floor(rect.width * dpr)) {
      this.wireframeCanvas.width = Math.floor(rect.width * dpr);
      this.wireframeCanvas.height = Math.floor(rect.height * dpr);
    }

    ctx.clearRect(0, 0, this.wireframeCanvas.width, this.wireframeCanvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const scaleX = rect.width / this.N;
    const scaleY = rect.height / this.N;

    // 1. Draw Ferrule Ring in 3D Perspective
    const ferrule = this.cosseratCluster.ferrulePos;
    const fx = ferrule[0] * scaleX;
    const fy = (ferrule[1] - ferrule[2] * 0.35) * scaleY;

    ctx.strokeStyle = 'rgba(229, 83, 61, 0.9)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(fx, fy, this.cosseratCluster.brushRadius * scaleX, 0, Math.PI * 2);
    ctx.stroke();

    // Ferrule handle axis line
    ctx.strokeStyle = 'rgba(229, 83, 61, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(
      fx + this.cosseratCluster.ferruleDir[0] * 35.0,
      fy + this.cosseratCluster.ferruleDir[1] * 35.0
    );
    ctx.stroke();

    // 2. Draw Each 3D Elastic Bristle Rod
    for (const rod of this.cosseratCluster.bristles) {
      ctx.beginPath();
      const root = rod.nodes[0];
      const rx = root.pos[0] * scaleX;
      const ry = (root.pos[1] - root.pos[2] * 0.35) * scaleY;
      ctx.moveTo(rx, ry);

      for (let i = 1; i < rod.nodes.length; i++) {
        const node = rod.nodes[i];
        const nx = node.pos[0] * scaleX;
        const ny = (node.pos[1] - node.pos[2] * 0.35) * scaleY;
        ctx.lineTo(nx, ny);
      }

      // Tip contact coloring: cyan if hovering, glowing gold if compressing paper
      const tip = rod.nodes[rod.nodes.length - 1];
      if (tip.isContact) {
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + tip.contactPressure * 0.5})`;
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();

      // Highlight contact point on paper
      if (tip.isContact) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(tip.pos[0] * scaleX, tip.pos[1] * scaleY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  public destroy(): void {
    if (this.wireframeCanvas && this.wireframeCanvas.parentElement) {
      this.wireframeCanvas.parentElement.removeChild(this.wireframeCanvas);
      this.wireframeCanvas = null;
      this.wireframeCtx = null;
    }
  }
}
