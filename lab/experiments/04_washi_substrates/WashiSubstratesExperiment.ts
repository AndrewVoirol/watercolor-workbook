// Experiment 04: Washi Substrate Matrix & Fiber Topography

import { WebGPULabContext } from '../../harness/WebGPULabContext';
import { LabExperiment } from '../../harness/LabExperiment';
import { LabStrokePoint } from '../../harness/LabSplitCanvas';
import { TelemetryHUD } from '../../harness/TelemetryHUD';

const SHADER_SOURCE = `
struct PaperParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  paper_type: u32,
  fiber_length: f32,
  bark_specks: f32,
  sizing_barrier: f32,
  granulation: f32,
  init_trigger: u32,
  pad0: f32,
  pad1: f32,
};

struct StrokePoint {
  p0: vec2<f32>,
  p1: vec2<f32>,
  radius: f32,
  is_active: u32,
};

@group(0) @binding(0) var<uniform> params: PaperParams;
@group(0) @binding(1) var<uniform> stroke: StrokePoint;
@group(0) @binding(2) var in_paint: texture_2d<f32>;
@group(0) @binding(3) var out_paint: texture_storage_2d<rgba16float, write>;

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
  var paint = textureLoad(in_paint, coord, 0);

  if (params.init_trigger == 1u) {
    let center = vec2<f32>(params.grid_size.x * 0.75, params.grid_size.y * 0.5);
    let d = length(pos - center);
    let r_init = params.grid_size.x * 0.10;
    if (d < r_init) {
      let w = 1.0 - smoothstep(0.0, r_init, d);
      paint.r = w * 0.8;
      paint.g = w * 0.9;
    }
  }

  if (stroke.is_active == 1u) {
    let norm_x0 = select(stroke.p0.x * 2.0, (stroke.p0.x - 0.5) * 2.0, stroke.p0.x >= 0.5);
    let norm_x1 = select(stroke.p1.x * 2.0, (stroke.p1.x - 0.5) * 2.0, stroke.p1.x >= 0.5);

    let p0 = vec2<f32>((norm_x0 * 0.5 + 0.5) * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1 = vec2<f32>((norm_x1 * 0.5 + 0.5) * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let d = dist_to_segment(pos, p0, p1);
    if (d < stroke.radius) {
      let w = 1.0 - smoothstep(0.0, stroke.radius, d);
      paint.r = min(1.0, paint.r + w * 0.7);
      paint.g = min(1.0, paint.g + w * 0.9);
    }
  }

  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let p_L = textureLoad(in_paint, L, 0);
  let p_R = textureLoad(in_paint, R, 0);
  let p_B = textureLoad(in_paint, B, 0);
  let p_T = textureLoad(in_paint, T, 0);

  let lap_water = p_L.r + p_R.r + p_B.r + p_T.r - 4.0 * paint.r;
  let soak = clamp((1.0 - params.sizing_barrier * 0.85) * 0.04, 0.001, 0.05);
  paint.r = clamp(paint.r + lap_water * soak, 0.0, 1.0);

  textureStore(out_paint, coord, paint);
}
`;

const RENDER_SHADER = `
struct PaperParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  paper_type: u32,
  fiber_length: f32,
  bark_specks: f32,
  sizing_barrier: f32,
  granulation: f32,
  init_trigger: u32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: PaperParams;
@group(0) @binding(1) var in_paint: texture_2d<f32>;

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

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 6 Botanical Fiber Generators
fn eval_washi_topology(pos: vec2<f32>, ptype: u32, fiber_scale: f32) -> vec4<f32> {
  // Returns vec4(fiber_density, screen_lines, bark_speck, tooth_granulation)
  switch (ptype) {
    case 0u: { // 1. 楮 Kōzo (Long Mulberry Fibers, Raw Organic Grain)
      let f_curl = sin(pos.x * 0.02 * fiber_scale + pos.y * 0.015) * 22.0;
      let f_strand = 1.0 - smoothstep(0.0, 3.5, abs(fract((pos.y + f_curl) * 0.04) * 16.0 - 8.0));
      let sukime = sin(pos.y * 0.35) * 0.12;
      let speck_pos = floor(pos * 0.08);
      let speck = select(0.0, 0.8, hash12(speck_pos) > 0.96);
      let tooth = hash12(pos * 0.4) * 0.35;
      return vec4<f32>(f_strand, sukime, speck, tooth);
    }
    case 1u: { // 2. 鳥の子 Torinoko (Eggshell Smooth, Extremely Fine Grain, Dōsa Hard Sized)
      let eggshell = (sin(pos.x * 0.08) * cos(pos.y * 0.08)) * 0.08;
      let micro_tooth = hash12(pos * 0.8) * 0.15;
      return vec4<f32>(eggshell, 0.0, 0.0, micro_tooth);
    }
    case 2u: { // 3. 古美 Kobishi (Antique Laid Lines, Aged Iron Oxidation, Heavy Tooth)
      let laid_chains = sin(pos.x * 0.035) * 0.35;
      let wire_ribs = sin(pos.y * 0.6) * 0.25;
      let patina = hash12(floor(pos * 0.04)) * 0.4;
      let tooth = hash12(pos * 0.5) * 0.45;
      return vec4<f32>(laid_chains + wire_ribs, wire_ribs, patina, tooth);
    }
    case 3u: { // 4. 奉書 Hōsho (Unsized Raw Cloud White, Fluffy Porous Absorbency)
      let fluff = (sin(pos.x * 0.03) + cos(pos.y * 0.03)) * 0.25;
      let soft_tooth = hash12(pos * 0.25) * 0.28;
      return vec4<f32>(fluff, 0.0, 0.0, soft_tooth);
    }
    case 4u: { // 5. 雲竜 Unryū (Cloud Dragon, Drifting Mulberry Ribbons, Visible Bark Chiri)
      let drift = sin(pos.x * 0.01 * fiber_scale + sin(pos.y * 0.02) * 4.0) * 45.0;
      let thick_ribbon = 1.0 - smoothstep(0.0, 6.0, abs(fract((pos.y + drift) * 0.025) * 24.0 - 12.0));
      let bark_chiri = select(0.0, 1.0, hash12(floor(pos * 0.06)) > 0.94);
      let tooth = hash12(pos * 0.35) * 0.3;
      return vec4<f32>(thick_ribbon * 1.5, 0.0, bark_chiri, tooth);
    }
    case 5u: { // 6. 雁皮 Gampi (Wild Daphne, Glossy Silk Parchment, Water Resistant)
      let silk = sin(pos.x * 0.15 + pos.y * 0.15) * 0.1;
      let sheen = sin(pos.x * 0.02) * 0.08;
      let tight_tooth = hash12(pos * 0.9) * 0.12;
      return vec4<f32>(silk, sheen, 0.0, tight_tooth);
    }
    default: {
      return vec4<f32>(0.0);
    }
  }
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(in.uv * params.grid_size);
  let pos = in.uv * params.grid_size;
  let is_left = in.uv.x < 0.5;

  let topo = eval_washi_topology(pos, params.paper_type, params.fiber_length);
  let fiber_density = topo.x;
  let screen_lines = topo.y;
  let bark_speck = topo.z * params.bark_specks;
  let tooth = topo.w;

  // Botanical substrate color tint per varietal
  var paper_base: vec3<f32>;
  switch (params.paper_type) {
    case 0u: { paper_base = vec3<f32>(0.94, 0.91, 0.84); } // Kozo Warm Ecru
    case 1u: { paper_base = vec3<f32>(0.96, 0.94, 0.89); } // Torinoko Cream
    case 2u: { paper_base = vec3<f32>(0.88, 0.83, 0.73); } // Kobishi Antique Tea
    case 3u: { paper_base = vec3<f32>(0.98, 0.97, 0.95); } // Hosho Pure Snow
    case 4u: { paper_base = vec3<f32>(0.93, 0.90, 0.83); } // Unryu Ecru
    case 5u: { paper_base = vec3<f32>(0.95, 0.92, 0.81); } // Gampi Amber Silk
    default: { paper_base = vec3<f32>(0.95, 0.92, 0.86); }
  }

  if (is_left) {
    // Left: Microscopic Fiber & Tooth Topography Analysis
    let topo_height = fiber_density * 0.55 + screen_lines + (tooth - 0.15) * 0.3 - bark_speck * 0.6;
    let fiber_contrast = mix(vec3<f32>(0.12, 0.14, 0.18), vec3<f32>(0.92, 0.89, 0.82), clamp(topo_height + 0.4, 0.0, 1.0));
    let final_topo = mix(fiber_contrast, vec3<f32>(0.08, 0.06, 0.05), bark_speck * 0.8);
    return vec4<f32>(final_topo, 1.0);
  } else {
    // Right: Live Mineral Ink Bleed on the Botanical Substrate
    let paint = textureLoad(in_paint, coord, 0);
    let water = paint.r;
    let pigment = paint.g;

    let gran_effect = (1.0 - tooth * 2.5) * params.granulation * pigment * 0.45;
    let ink = vec3<f32>(0.11, 0.10, 0.09);
    let wet_darken = water * 0.09;

    let paper_surface = paper_base - vec3<f32>(wet_darken) + (tooth - 0.15) * 0.04 - vec3<f32>(bark_speck * 0.18);
    var final_color = mix(paper_surface, ink, clamp(pigment * 1.4 + gran_effect, 0.0, 1.0));

    if (abs(in.uv.x - 0.5) < 0.0015) {
      final_color = vec3<f32>(0.25, 0.25, 0.30);
    }
    return vec4<f32>(final_color, 1.0);
  }
}
`;

export class WashiSubstratesExperiment implements LabExperiment {
  public id = 4;
  public title = "Washi Substrate Matrix";
  public subtitle = "6 Botanical Fiber Topologies & Sizing Wettability";
  public sideALabel = "Left: Fiber & Tooth Topography";
  public sideBLabel = "Right: Live Ink Wash & Granulation";

  private ctx!: WebGPULabContext;
  private hud!: TelemetryHUD;

  private pipeSim!: GPUComputePipeline;
  private pipeRender!: GPURenderPipeline;

  private texPaint!: ReturnType<WebGPULabContext['createTexturePair']>;
  private bufParams!: GPUBuffer;
  private bufStroke!: GPUBuffer;

  private bgSim!: GPUBindGroup[];
  private bgRender!: GPUBindGroup[];

  private stateIdx = 0;
  private isDrawing = false;
  private p0 = { x: 0.75, y: 0.5 };
  private p1 = { x: 0.75, y: 0.5 };
  private radius = 22;
  private initTrigger = 1;

  public paperType = 0;
  public fiberLength = 1.8;
  public barkSpecks = 0.35;
  public sizingBarrier = 0.10;
  public granulation = 0.70;

  private readonly N = 512;

  public async init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void> {
    this.ctx = ctx;
    this.hud = hud;
    const d = ctx.device;

    this.texPaint = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'paper_paint');

    this.bufParams = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bufStroke = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modSim = ctx.createShaderModule(SHADER_SOURCE, 'sim_washi_substrates');
    this.pipeSim = d.createComputePipeline({
      layout: 'auto',
      compute: { module: modSim, entryPoint: 'main' }
    });

    const modRender = ctx.createShaderModule(RENDER_SHADER, 'render_washi_substrates');
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
    this.initTrigger = 1;
  }

  private initBindGroups(): void {
    const d = this.ctx.device;
    this.bgSim = [
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texPaint.viewA },
          { binding: 3, resource: this.texPaint.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texPaint.viewB },
          { binding: 3, resource: this.texPaint.viewA }
        ]
      })
    ];

    this.bgRender = [
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texPaint.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texPaint.viewA }
        ]
      })
    ];
  }

  public renderUI(container: HTMLElement): void {
    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-header-title">6 Master Washi Varietals</div>

        <div class="control-row">
          <div class="radio-group-segmented" id="group-washi-type" style="flex-wrap: wrap; gap: 4px;">
            <div class="segmented-option ${this.paperType === 0 ? 'active' : ''}" data-val="0" style="flex: 1 1 30%;">楮 Kōzo</div>
            <div class="segmented-option ${this.paperType === 1 ? 'active' : ''}" data-val="1" style="flex: 1 1 30%;">鳥の子 Torinoko</div>
            <div class="segmented-option ${this.paperType === 2 ? 'active' : ''}" data-val="2" style="flex: 1 1 30%;">古美 Kobishi</div>
            <div class="segmented-option ${this.paperType === 3 ? 'active' : ''}" data-val="3" style="flex: 1 1 30%;">奉書 Hōsho</div>
            <div class="segmented-option ${this.paperType === 4 ? 'active' : ''}" data-val="4" style="flex: 1 1 30%;">雲竜 Unryū</div>
            <div class="segmented-option ${this.paperType === 5 ? 'active' : ''}" data-val="5" style="flex: 1 1 30%;">雁皮 Gampi</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Fiber Length Scale</span>
            <span class="control-value" id="val-fiber-len">${this.fiberLength.toFixed(2)}x</span>
          </div>
          <input type="range" class="lab-slider" id="slide-fiber-len" min="0.3" max="2.5" step="0.1" value="${this.fiberLength}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Valley Granulation Tooth</span>
            <span class="control-value" id="val-gran">${this.granulation.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-gran" min="0.0" max="1.0" step="0.05" value="${this.granulation}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Sizing Barrier (Dōsa)</span>
            <span class="control-value" id="val-paper-sizing">${this.sizingBarrier.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-paper-sizing" min="0.0" max="1.0" step="0.05" value="${this.sizingBarrier}">
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-header-title">Substrate Inspection</div>
        <p style="font-size: 0.76rem; line-height: 1.5; color: var(--lab-text-muted); margin-bottom: 0.75rem;">
          Click any of the 6 washi varietals above. The <strong>Left half</strong> renders the botanical fiber skeleton under microscope illumination. The <strong>Right half</strong> demonstrates pigment valley granulation and sizing bleed.
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-purple);">
          🔬 Press 'L' to toggle the 8x Loupe.
        </p>
      </div>
    `;

    container.querySelectorAll('#group-washi-type .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-washi-type .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.paperType = parseInt(opt.getAttribute('data-val') || '0', 10);
        this.applyPaperPreset(this.paperType);
      });
    });

    const sLen = container.querySelector('#slide-fiber-len') as HTMLInputElement;
    const vLen = container.querySelector('#val-fiber-len') as HTMLElement;
    sLen?.addEventListener('input', () => {
      this.fiberLength = parseFloat(sLen.value);
      vLen.textContent = `${this.fiberLength.toFixed(2)}x`;
    });

    const sGran = container.querySelector('#slide-gran') as HTMLInputElement;
    const vGran = container.querySelector('#val-gran') as HTMLElement;
    sGran?.addEventListener('input', () => {
      this.granulation = parseFloat(sGran.value);
      vGran.textContent = this.granulation.toFixed(2);
    });

    const sSizing = container.querySelector('#slide-paper-sizing') as HTMLInputElement;
    const vSizing = container.querySelector('#val-paper-sizing') as HTMLElement;
    sSizing?.addEventListener('input', () => {
      this.sizingBarrier = parseFloat(sSizing.value);
      vSizing.textContent = this.sizingBarrier.toFixed(2);
    });
  }

  private applyPaperPreset(p: number): void {
    if (p === 0) { // Kozo
      this.fiberLength = 1.8;
      this.barkSpecks = 0.4;
      this.sizingBarrier = 0.10;
      this.granulation = 0.70;
    } else if (p === 1) { // Torinoko
      this.fiberLength = 0.4;
      this.barkSpecks = 0.0;
      this.sizingBarrier = 0.85;
      this.granulation = 0.15;
    } else if (p === 2) { // Kobishi
      this.fiberLength = 1.2;
      this.barkSpecks = 0.6;
      this.sizingBarrier = 0.35;
      this.granulation = 0.85;
    } else if (p === 3) { // Hosho
      this.fiberLength = 0.6;
      this.barkSpecks = 0.0;
      this.sizingBarrier = 0.02;
      this.granulation = 0.40;
    } else if (p === 4) { // Unryu
      this.fiberLength = 2.4;
      this.barkSpecks = 0.9;
      this.sizingBarrier = 0.20;
      this.granulation = 0.50;
    } else if (p === 5) { // Gampi
      this.fiberLength = 0.3;
      this.barkSpecks = 0.0;
      this.sizingBarrier = 0.95;
      this.granulation = 0.05;
    }

    const panel = document.getElementById('controls-panel');
    if (panel) this.renderUI(panel);
  }

  public onStrokeStart(pt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: pt.x, y: pt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.radius = Math.max(14, pt.pressure * 30);
  }

  public onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: prevPt.x, y: prevPt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.radius = Math.max(14, pt.pressure * 30);
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
  }

  public reset(): void {
    const d = this.ctx.device;
    const zeroData = new Float32Array(this.N * this.N * 4);
    d.queue.writeTexture({ texture: this.texPaint.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texPaint.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    this.initTrigger = 1;
  }

  public step(_w: number, _h: number, _dpr: number): void {
    const d = this.ctx.device;
    const now = performance.now();

    const paramsData = new ArrayBuffer(48);
    const f32 = new Float32Array(paramsData);
    const u32 = new Uint32Array(paramsData);
    f32[0] = this.N;
    f32[1] = this.N;
    f32[2] = 0.016;
    f32[3] = now * 0.001;
    u32[4] = this.paperType;
    f32[5] = this.fiberLength;
    f32[6] = this.barkSpecks;
    f32[7] = this.sizingBarrier;
    f32[8] = this.granulation;
    u32[9] = this.initTrigger;
    f32[10] = 0;
    f32[11] = 0;
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
    su32[5] = this.isDrawing ? 1 : 0;
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
        clearValue: { r: 0.95, g: 0.92, b: 0.85, a: 1.0 },
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

  public destroy(): void {}
}
