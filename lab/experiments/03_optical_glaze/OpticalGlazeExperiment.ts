// Experiment 03: Optical Glaze Stacking & Saunderson Fresnel Transfer Matrices
// Side-by-Side: Saunderson Multi-Layer Glaze Stack (3-Layer Matrix + Fresnel k1, k2) vs. Single-Layer Kubelka-Munk

import { WebGPULabContext } from '../../harness/WebGPULabContext';
import { LabExperiment } from '../../harness/LabExperiment';
import { LabStrokePoint } from '../../harness/LabSplitCanvas';
import { TelemetryHUD } from '../../harness/TelemetryHUD';

const SHADER_SOURCE = `
struct GlazeParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  active_pigment_id: u32,
  target_layer_idx: u32,    // 0 = Layer 1 (Base), 1 = Layer 2 (Mid), 2 = Layer 3 (Top)
  glaze_thickness: f32,
  k1_surface_gloss: f32,    // External Fresnel reflection [0.0..0.08]
  k2_internal_bounce: f32,  // Internal total reflection [0.0..0.75]
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

@group(0) @binding(0) var<uniform> params: GlazeParams;
@group(0) @binding(1) var<uniform> stroke: StrokePoint;

// Multi-Layer Glaze Textures (R, G, B = K absorption, A = S scattering * thickness)
@group(0) @binding(2) var in_layer1: texture_2d<f32>;
@group(0) @binding(3) var out_layer1: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var in_layer2: texture_2d<f32>;
@group(0) @binding(5) var out_layer2: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var in_layer3: texture_2d<f32>;
@group(0) @binding(7) var out_layer3: texture_storage_2d<rgba16float, write>;

// Single-Layer Comparison Baseline
@group(0) @binding(8) var in_single_km: texture_2d<f32>;
@group(0) @binding(9) var out_single_km: texture_storage_2d<rgba16float, write>;

// 6 Master Nihonga Mineral Pigment Spectral Tables (K_r, K_g, K_b, S_scatter)
fn get_pigment_ks(id: u32) -> vec4<f32> {
  switch (id) {
    case 0u: { // 1. 墨 Sumi Black (High Absorption across all bands)
      return vec4<f32>(4.8, 4.8, 4.8, 0.05);
    }
    case 1u: { // 2. 本朱 Shu Vermilion (Cinnabar HgS: absorbs Blue/Green, scatters Red)
      return vec4<f32>(0.2, 3.4, 4.2, 0.55);
    }
    case 2u: { // 3. 本藍 Ai Indigo (Absorbs Red/Yellow, transmits Blue)
      return vec4<f32>(4.2, 2.8, 0.3, 0.35);
    }
    case 3u: { // 4. 天然黄土 Ōdo Ochre (Absorbs Blue, scatters Yellow/Orange)
      return vec4<f32>(0.3, 0.9, 4.5, 0.65);
    }
    case 4u: { // 5. 雲母胡粉 Gofun White (Crushed Oyster Shell: high scattering S, zero K)
      return vec4<f32>(0.02, 0.02, 0.02, 4.8);
    }
    case 5u: { // 6. 天然緑青 Rokushō Malachite (Copper Carbonate: absorbs Red/Blue, rich Green)
      return vec4<f32>(3.9, 0.4, 3.6, 0.45);
    }
    default: {
      return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }
  }
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

  var l1 = textureLoad(in_layer1, coord, 0);
  var l2 = textureLoad(in_layer2, coord, 0);
  var l3 = textureLoad(in_layer3, coord, 0);
  var single = textureLoad(in_single_km, coord, 0);

  // 1. Initial Swatch Setup
  if (params.init_trigger == 1u) {
    l1 = vec4<f32>(0.0);
    l2 = vec4<f32>(0.0);
    l3 = vec4<f32>(0.0);
    single = vec4<f32>(0.0);

    // Pre-bake Layer 1 Base: Ai (Indigo Blue) Top Stripe [y: 0.18..0.42]
    if (pos.y >= params.grid_size.y * 0.18 && pos.y <= params.grid_size.y * 0.42) {
      let ks = get_pigment_ks(2u);
      l1 = vec4<f32>(ks.rgb * 0.9, ks.a * 0.9);
      single = vec4<f32>(ks.rgb * 0.9, ks.a * 0.9);
    }
    // Pre-bake Layer 1 Base: Shu (Vermilion) Bottom Stripe [y: 0.58..0.82]
    if (pos.y >= params.grid_size.y * 0.58 && pos.y <= params.grid_size.y * 0.82) {
      let ks = get_pigment_ks(1u);
      l1 = vec4<f32>(ks.rgb * 0.9, ks.a * 0.9);
      single = vec4<f32>(ks.rgb * 0.9, ks.a * 0.9);
    }
  }

  // 2. Stroke Injection into Selected Multi-Layer Target
  if (stroke.is_active == 1u) {
    let norm_x0 = select(stroke.p0.x * 2.0, (stroke.p0.x - 0.5) * 2.0, stroke.p0.x >= 0.5);
    let norm_x1 = select(stroke.p1.x * 2.0, (stroke.p1.x - 0.5) * 2.0, stroke.p1.x >= 0.5);

    let p0_a = vec2<f32>(norm_x0 * 0.5 * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1_a = vec2<f32>(norm_x1 * 0.5 * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let p0_b = vec2<f32>((norm_x0 * 0.5 + 0.5) * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1_b = vec2<f32>((norm_x1 * 0.5 + 0.5) * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let dist_a = dist_to_segment(pos, p0_a, p1_a);
    let dist_b = dist_to_segment(pos, p0_b, p1_b);
    let r = stroke.radius;

    let ks = get_pigment_ks(params.active_pigment_id);

    if (dist_a < r) {
      let u = 1.0 - smoothstep(0.0, r, dist_a);
      let added_k = ks.rgb * u * params.glaze_thickness * 0.75;
      let added_s = ks.a * u * params.glaze_thickness * 0.75;

      if (params.target_layer_idx == 0u) {
        l1 = vec4<f32>(l1.rgb + added_k, l1.a + added_s);
      } else if (params.target_layer_idx == 1u) {
        l2 = vec4<f32>(l2.rgb + added_k, l2.a + added_s);
      } else {
        l3 = vec4<f32>(l3.rgb + added_k, l3.a + added_s);
      }
    }

    if (dist_b < r) {
      let u = 1.0 - smoothstep(0.0, r, dist_b);
      let added_k = ks.rgb * u * params.glaze_thickness * 0.75;
      let added_s = ks.a * u * params.glaze_thickness * 0.75;
      single = vec4<f32>(single.rgb + added_k, single.a + added_s);
    }
  }

  textureStore(out_layer1, coord, l1);
  textureStore(out_layer2, coord, l2);
  textureStore(out_layer3, coord, l3);
  textureStore(out_single_km, coord, single);
}
`;

const RENDER_SHADER = `
struct GlazeParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  active_pigment_id: u32,
  target_layer_idx: u32,
  glaze_thickness: f32,
  k1_surface_gloss: f32,
  k2_internal_bounce: f32,
  init_trigger: u32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: GlazeParams;
@group(0) @binding(1) var in_layer1: texture_2d<f32>;
@group(0) @binding(2) var in_layer2: texture_2d<f32>;
@group(0) @binding(3) var in_layer3: texture_2d<f32>;
@group(0) @binding(4) var in_single_km: texture_2d<f32>;

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

// Compute single layer (R, T) using exact hyperbolic functions
fn eval_layer_rt(K: f32, S: f32, d: f32) -> vec2<f32> {
  if (d <= 0.001 || (K <= 0.0001 && S <= 0.0001)) {
    return vec2<f32>(0.0, 1.0); // transparent
  }
  let a = 1.0 + (K / max(S, 0.001));
  let b = sqrt(max(a * a - 1.0, 0.0001));
  let y = clamp(b * max(S, 0.01) * d, 0.0001, 15.0);
  let ey = exp(-2.0 * y);
  let coth_val = (1.0 + ey) / max(1.0 - ey, 0.0001);
  let sinh_val = (exp(y) - exp(-y)) * 0.5;
  let b_coth = b * coth_val;

  let R = 1.0 / max(a + b_coth, 0.001);
  let T = b / max(a * sinh_val + b_coth * sinh_val, 0.001);
  return vec2<f32>(clamp(R, 0.0, 1.0), clamp(T, 0.0, 1.0));
}

// Compose two physical glaze layers using 2x2 Transfer Matrix
fn compose_layers(r1: f32, t1: f32, r2: f32, t2: f32) -> vec2<f32> {
  let den = max(1.0 - r1 * r2, 0.001);
  let r12 = r1 + (t1 * t1 * r2) / den;
  let t12 = (t1 * t2) / den;
  return vec2<f32>(clamp(r12, 0.0, 1.0), clamp(t12, 0.0, 1.0));
}

// Apply Saunderson Fresnel boundary reflection model:
// R_measured = k1 + ((1-k1)(1-k2) * R_int) / (1 - k2 * R_int)
fn apply_saunderson(R_int: f32, k1: f32, k2: f32) -> f32 {
  let num = (1.0 - k1) * (1.0 - k2) * R_int;
  let den = max(1.0 - k2 * R_int, 0.001);
  return clamp(k1 + num / den, 0.0, 1.0);
}

// Single channel KM baseline for Model B comparison
fn eval_single_km_channel(K: f32, S: f32, Rg: f32, d: f32) -> f32 {
  if (K < 0.001 && S < 0.001) { return Rg; }
  let a = 1.0 + (K / max(S, 0.001));
  let b = sqrt(max(a * a - 1.0, 0.0001));
  let y = clamp(b * max(S, 0.01) * d, 0.0001, 15.0);
  let ey = exp(-2.0 * y);
  let coth_val = (1.0 + ey) / max(1.0 - ey, 0.0001);
  let b_coth = b * coth_val;
  let num = 1.0 - Rg * (a - b_coth);
  let den = max(a - Rg + b_coth, 0.001);
  return clamp(num / den, 0.0, 1.0);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(in.uv * params.grid_size);
  let is_left = in.uv.x < 0.5;

  let paper_rgb = vec3<f32>(0.95, 0.92, 0.86);
  var final_rgb = paper_rgb;

  if (is_left) {
    // =======================================================================
    // MODEL A: Saunderson Multi-Layer Glaze Stack (3-Layer Matrix + Fresnel)
    // =======================================================================
    let l1 = textureLoad(in_layer1, coord, 0);
    let l2 = textureLoad(in_layer2, coord, 0);
    let l3 = textureLoad(in_layer3, coord, 0);

    let d1 = clamp(length(l1.rgb) * 0.7 + l1.a * 0.5, 0.0, 5.0);
    let d2 = clamp(length(l2.rgb) * 0.7 + l2.a * 0.5, 0.0, 5.0);
    let d3 = clamp(length(l3.rgb) * 0.7 + l3.a * 0.5, 0.0, 5.0);

    var R_out = vec3<f32>(0.0);
    let k1 = params.k1_surface_gloss;
    let k2 = params.k2_internal_bounce;

    // Process Red, Green, Blue spectral channels independently
    for (var c = 0; c < 3; c = c + 1) {
      var K1 = 0.0; var K2 = 0.0; var K3 = 0.0;
      var S1 = l1.a; var S2 = l2.a; var S3 = l3.a;
      var Rg = 0.0;

      if (c == 0) { K1 = l1.r; K2 = l2.r; K3 = l3.r; Rg = paper_rgb.r; }
      else if (c == 1) { K1 = l1.g; K2 = l2.g; K3 = l3.g; Rg = paper_rgb.g; }
      else { K1 = l1.b; K2 = l2.b; K3 = l3.b; Rg = paper_rgb.b; }

      // 1. Layer 1 (Bottom)
      let rt1 = eval_layer_rt(K1, S1, d1);
      // 2. Layer 2 (Mid)
      let rt2 = eval_layer_rt(K2, S2, d2);
      // 3. Layer 3 (Top)
      let rt3 = eval_layer_rt(K3, S3, d3);

      // Stack: Compose Layer 1 over Paper Substrate (Rg, T=0)
      let stack1 = compose_layers(rt1.x, rt1.y, Rg, 0.0);
      // Stack: Compose Layer 2 over Stack 1
      let stack2 = compose_layers(rt2.x, rt2.y, stack1.x, stack1.y);
      // Stack: Compose Layer 3 over Stack 2
      let stack3 = compose_layers(rt3.x, rt3.y, stack2.x, stack2.y);

      // Apply Saunderson Fresnel internal total reflection & surface gloss
      let R_saund = apply_saunderson(stack3.x, k1, k2);

      if (c == 0) { R_out.r = R_saund; }
      else if (c == 1) { R_out.g = R_saund; }
      else { R_out.b = R_saund; }
    }
    final_rgb = R_out;
  } else {
    // =======================================================================
    // MODEL B: Standard Single-Layer Kubelka-Munk (No Saunderson Internal Bounce)
    // =======================================================================
    let km = textureLoad(in_single_km, coord, 0);
    let K = km.rgb;
    let S = vec3<f32>(km.a + 0.001);
    let d = clamp(length(K) * 0.7 + km.a * 0.5, 0.0, 5.0);

    final_rgb = vec3<f32>(
      eval_single_km_channel(K.r, S.r, paper_rgb.r, d),
      eval_single_km_channel(K.g, S.g, paper_rgb.g, d),
      eval_single_km_channel(K.b, S.b, paper_rgb.b, d)
    );
  }

  // Divider bar
  if (abs(in.uv.x - 0.5) < 0.0015) {
    final_rgb = vec3<f32>(0.25, 0.25, 0.30);
  }

  return vec4<f32>(final_rgb, 1.0);
}
`;

export class OpticalGlazeExperiment implements LabExperiment {
  public id = 3;
  public title = "Optical Glazing & Saunderson Stacks";
  public subtitle = "Saunderson 3-Layer Glaze Matrix vs. Single-Layer Kubelka-Munk";
  public sideALabel = "Model A: Saunderson Multi-Layer Matrix (Fresnel k1, k2)";
  public sideBLabel = "Model B: Single-Layer Kubelka-Munk (No Internal Bounce)";

  private ctx!: WebGPULabContext;
  private hud!: TelemetryHUD;

  private pipeSim!: GPUComputePipeline;
  private pipeRender!: GPURenderPipeline;

  private texLayer1!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texLayer2!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texLayer3!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texSingleKM!: ReturnType<WebGPULabContext['createTexturePair']>;

  private bufParams!: GPUBuffer;
  private bufStroke!: GPUBuffer;

  private bgSim!: GPUBindGroup[];
  private bgRender!: GPUBindGroup[];

  private stateIdx = 0;
  private isDrawing = false;
  private p0 = { x: 0.25, y: 0.5 };
  private p1 = { x: 0.25, y: 0.5 };
  private radius = 24;
  private initTrigger = 1;

  public activePigmentId = 3;   // 3 = Ōdo (Yellow Ochre) default glaze
  public targetLayerIdx = 1;     // 0 = Layer 1, 1 = Layer 2 (Mid), 2 = Layer 3 (Top)
  public glazeThickness = 0.70;
  public k1SurfaceGloss = 0.04;  // Fresnel air-varnish interface ~4%
  public k2InternalBounce = 0.60; // Diffuse internal total reflection ~60%

  private readonly N = 512;

  public async init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void> {
    this.ctx = ctx;
    this.hud = hud;
    const d = ctx.device;

    this.texLayer1 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'layer1');
    this.texLayer2 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'layer2');
    this.texLayer3 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'layer3');
    this.texSingleKM = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'single_km');

    this.bufParams = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bufStroke = d.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modSim = ctx.createShaderModule(SHADER_SOURCE, 'sim_optical_glaze');
    this.pipeSim = d.createComputePipeline({
      layout: 'auto',
      compute: { module: modSim, entryPoint: 'main' }
    });

    const modRender = ctx.createShaderModule(RENDER_SHADER, 'render_optical_glaze');
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
          { binding: 2, resource: this.texLayer1.viewA },
          { binding: 3, resource: this.texLayer1.viewB },
          { binding: 4, resource: this.texLayer2.viewA },
          { binding: 5, resource: this.texLayer2.viewB },
          { binding: 6, resource: this.texLayer3.viewA },
          { binding: 7, resource: this.texLayer3.viewB },
          { binding: 8, resource: this.texSingleKM.viewA },
          { binding: 9, resource: this.texSingleKM.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texLayer1.viewB },
          { binding: 3, resource: this.texLayer1.viewA },
          { binding: 4, resource: this.texLayer2.viewB },
          { binding: 5, resource: this.texLayer2.viewA },
          { binding: 6, resource: this.texLayer3.viewB },
          { binding: 7, resource: this.texLayer3.viewA },
          { binding: 8, resource: this.texSingleKM.viewB },
          { binding: 9, resource: this.texSingleKM.viewA }
        ]
      })
    ];

    this.bgRender = [
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texLayer1.viewB },
          { binding: 2, resource: this.texLayer2.viewB },
          { binding: 3, resource: this.texLayer3.viewB },
          { binding: 4, resource: this.texSingleKM.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texLayer1.viewA },
          { binding: 2, resource: this.texLayer2.viewA },
          { binding: 3, resource: this.texLayer3.viewA },
          { binding: 4, resource: this.texSingleKM.viewA }
        ]
      })
    ];
  }

  public renderUI(container: HTMLElement): void {
    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-header-title">Glaze Layer & Pigment Palette</div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Target Glaze Stack Layer</span>
          </div>
          <div class="radio-group-segmented" id="group-target-layer">
            <div class="segmented-option ${this.targetLayerIdx === 0 ? 'active' : ''}" data-val="0">Layer 1 (Base)</div>
            <div class="segmented-option ${this.targetLayerIdx === 1 ? 'active' : ''}" data-val="1">Layer 2 (Mid Glaze)</div>
            <div class="segmented-option ${this.targetLayerIdx === 2 ? 'active' : ''}" data-val="2">Layer 3 (Overglaze)</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Nihonga Mineral Pigment</span>
          </div>
          <div class="radio-group-segmented" id="group-glaze-pigment" style="flex-wrap: wrap; gap: 4px;">
            <div class="segmented-option ${this.activePigmentId === 3 ? 'active' : ''}" data-val="3" style="flex: 1 1 30%;">天然黄土 Ōdo</div>
            <div class="segmented-option ${this.activePigmentId === 1 ? 'active' : ''}" data-val="1" style="flex: 1 1 30%;">本朱 Shu</div>
            <div class="segmented-option ${this.activePigmentId === 2 ? 'active' : ''}" data-val="2" style="flex: 1 1 30%;">本藍 Ai</div>
            <div class="segmented-option ${this.activePigmentId === 5 ? 'active' : ''}" data-val="5" style="flex: 1 1 30%;">天然緑青 Rokushō</div>
            <div class="segmented-option ${this.activePigmentId === 4 ? 'active' : ''}" data-val="4" style="flex: 1 1 30%;">雲母胡粉 Gofun</div>
            <div class="segmented-option ${this.activePigmentId === 0 ? 'active' : ''}" data-val="0" style="flex: 1 1 30%;">墨 Sumi</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Internal Total Reflection (k2)</span>
            <span class="control-value" id="val-k2">${this.k2InternalBounce.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-k2" min="0.0" max="0.80" step="0.05" value="${this.k2InternalBounce}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Surface Specular Gloss (k1)</span>
            <span class="control-value" id="val-k1">${this.k1SurfaceGloss.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-k1" min="0.0" max="0.08" step="0.01" value="${this.k1SurfaceGloss}">
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-header-title">Saunderson Optics Inspection</div>
        <p style="font-size: 0.76rem; line-height: 1.5; color: var(--lab-text-muted); margin-bottom: 0.75rem;">
          Drag Yellow Ochre (Ōdo) or Malachite Green (Rokushō) over the pre-painted Blue/Red swatches.
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-green);">
          ✨ <strong>Left (Saunderson Multi-Layer)</strong>: Internal total reflection ($k_2 = 0.60$) traps scattered photons inside the glaze, producing jewel-like deep saturation and rich subtractive color depth.
        </p>
      </div>
    `;

    container.querySelectorAll('#group-target-layer .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-target-layer .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.targetLayerIdx = parseInt(opt.getAttribute('data-val') || '1', 10);
      });
    });

    container.querySelectorAll('#group-glaze-pigment .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-glaze-pigment .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.activePigmentId = parseInt(opt.getAttribute('data-val') || '3', 10);
      });
    });

    const sK2 = container.querySelector('#slide-k2') as HTMLInputElement;
    const vK2 = container.querySelector('#val-k2') as HTMLElement;
    sK2?.addEventListener('input', () => {
      this.k2InternalBounce = parseFloat(sK2.value);
      vK2.textContent = this.k2InternalBounce.toFixed(2);
    });

    const sK1 = container.querySelector('#slide-k1') as HTMLInputElement;
    const vK1 = container.querySelector('#val-k1') as HTMLElement;
    sK1?.addEventListener('input', () => {
      this.k1SurfaceGloss = parseFloat(sK1.value);
      vK1.textContent = this.k1SurfaceGloss.toFixed(2);
    });
  }

  public onStrokeStart(pt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: pt.x, y: pt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.radius = Math.max(16, pt.pressure * 32);
  }

  public onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: prevPt.x, y: prevPt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.radius = Math.max(16, pt.pressure * 32);
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
  }

  public reset(): void {
    const d = this.ctx.device;
    const zeroData = new Float32Array(this.N * this.N * 4);
    d.queue.writeTexture({ texture: this.texLayer1.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLayer1.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLayer2.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLayer2.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLayer3.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLayer3.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texSingleKM.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texSingleKM.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
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
    u32[4] = this.activePigmentId;
    u32[5] = this.targetLayerIdx;
    f32[6] = this.glazeThickness;
    f32[7] = this.k1SurfaceGloss;
    f32[8] = this.k2InternalBounce;
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
        clearValue: { r: 0.95, g: 0.92, b: 0.86, a: 1.0 },
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
    this.hud.recordFrame(dtCompute, this.N * this.N * 8 * 6);

    this.stateIdx = 1 - this.stateIdx;
    this.p0 = { ...this.p1 };
  }

  public destroy(): void {}
}
