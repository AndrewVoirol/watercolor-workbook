// Experiment 01: Fluid Bleed Dynamics & Vorticity
// Side-by-Side: Darcy Anisotropic Porous Medium vs. True Lattice Boltzmann (LBM D2Q9) CFD with Vorticity

import { WebGPULabContext } from '../../harness/WebGPULabContext';
import { LabExperiment } from '../../harness/LabExperiment';
import { LabStrokePoint } from '../../harness/LabSplitCanvas';
import { TelemetryHUD } from '../../harness/TelemetryHUD';

const SHADER_SOURCE = `
struct FluidParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  tau_viscosity: f32,       // LBM relaxation time tau [0.55..1.8]
  fiber_anisotropy: f32,    // Darcy fiber ratio
  paper_permeability: f32,  // Darcy soak rate
  sizing_barrier: f32,      // Dosa resistance
  water_dilution: f32,      // Water volume
  show_vorticity: u32,      // 1 = visualize vorticity & streamlines
  init_trigger: u32,
  pad0: f32,
};

struct StrokePoint {
  p0: vec2<f32>,
  p1: vec2<f32>,
  radius: f32,
  speed: f32,
  force: vec2<f32>,
  is_active: u32,
  pad: f32,
};

@group(0) @binding(0) var<uniform> params: FluidParams;
@group(0) @binding(1) var<uniform> stroke: StrokePoint;

// Model A: Darcy Tensor Textures
@group(0) @binding(2) var in_darcy: texture_2d<f32>;
@group(0) @binding(3) var out_darcy: texture_storage_2d<rgba16float, write>;

// Model B: True LBM D2Q9 Distribution Textures
@group(0) @binding(4) var in_f03: texture_2d<f32>;       // f0, f1, f2, f3
@group(0) @binding(5) var out_f03: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var in_f47: texture_2d<f32>;       // f4, f5, f6, f7
@group(0) @binding(7) var out_f47: texture_storage_2d<rgba16float, write>;
@group(0) @binding(8) var in_f8macro: texture_2d<f32>;   // f8, rho, ux, uy
@group(0) @binding(9) var out_f8macro: texture_storage_2d<rgba16float, write>;
@group(0) @binding(10) var in_lbm_paint: texture_2d<f32>; // pigment, water, vorticity, obstacle
@group(0) @binding(11) var out_lbm_paint: texture_storage_2d<rgba16float, write>;

fn dist_to_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) { return length(pa); }
  let t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  return length(pa - ba * t);
}

// D2Q9 Equilibrium Distribution Function
fn feq(i: u32, rho: f32, u: vec2<f32>) -> f32 {
  let w0 = 4.0 / 9.0;
  let w_axial = 1.0 / 9.0;
  let w_diag = 1.0 / 36.0;

  var w = w0;
  var cx = 0.0;
  var cy = 0.0;

  switch (i) {
    case 0u: { w = w0; cx = 0.0; cy = 0.0; }
    case 1u: { w = w_axial; cx = 1.0; cy = 0.0; }
    case 2u: { w = w_axial; cx = 0.0; cy = 1.0; }
    case 3u: { w = w_axial; cx = -1.0; cy = 0.0; }
    case 4u: { w = w_axial; cx = 0.0; cy = -1.0; }
    case 5u: { w = w_diag; cx = 1.0; cy = 1.0; }
    case 6u: { w = w_diag; cx = -1.0; cy = 1.0; }
    case 7u: { w = w_diag; cx = -1.0; cy = -1.0; }
    case 8u: { w = w_diag; cx = 1.0; cy = -1.0; }
    default: { w = 0.0; }
  }

  let cu = 3.0 * (cx * u.x + cy * u.y);
  let u2 = 1.5 * (u.x * u.x + u.y * u.y);
  return w * rho * (1.0 + cu + 0.5 * cu * cu - u2);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(params.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) { return; }

  let pos = vec2<f32>(coord);

  // =========================================================================
  // 1. INITIALIZATION: Calligraphic Drops & Swirling Seed
  // =========================================================================
  if (params.init_trigger == 1u) {
    let p_a = vec2<f32>(params.grid_size.x * 0.25, params.grid_size.y * 0.5);
    let p_b = vec2<f32>(params.grid_size.x * 0.75, params.grid_size.y * 0.5);
    let d_a = length(pos - p_a);
    let d_b = length(pos - p_b);
    let r_init = params.grid_size.x * 0.09;

    var darcy_init = vec4<f32>(0.0);
    if (d_a < r_init) {
      let w = 1.0 - smoothstep(0.0, r_init, d_a);
      darcy_init = vec4<f32>(w * 0.85, w * 0.95, w * 0.7, 0.0);
    }
    textureStore(out_darcy, coord, darcy_init);

    // Initialize LBM to rest density rho = 1.0
    let w0 = 4.0 / 9.0;
    let w_ax = 1.0 / 9.0;
    let w_dg = 1.0 / 36.0;
    textureStore(out_f03, coord, vec4<f32>(w0, w_ax, w_ax, w_ax));
    textureStore(out_f47, coord, vec4<f32>(w_ax, w_dg, w_dg, w_dg));
    textureStore(out_f8macro, coord, vec4<f32>(w_dg, 1.0, 0.0, 0.0));

    var lbm_paint_init = vec4<f32>(0.0);
    if (d_b < r_init) {
      let w = 1.0 - smoothstep(0.0, r_init, d_b);
      lbm_paint_init = vec4<f32>(w * 0.95, w * 0.85, 0.0, 0.0);
    }
    textureStore(out_lbm_paint, coord, lbm_paint_init);
    return;
  }

  // =========================================================================
  // 2. MODEL A: DARCY ANISOTROPIC POROUS MEDIA BLEEDING
  // =========================================================================
  var darcy = textureLoad(in_darcy, coord, 0);

  if (stroke.is_active == 1u) {
    let norm_x0 = select(stroke.p0.x * 2.0, (stroke.p0.x - 0.5) * 2.0, stroke.p0.x >= 0.5);
    let norm_x1 = select(stroke.p1.x * 2.0, (stroke.p1.x - 0.5) * 2.0, stroke.p1.x >= 0.5);

    let p0_a = vec2<f32>(norm_x0 * 0.5 * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1_a = vec2<f32>(norm_x1 * 0.5 * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let d_a = dist_to_segment(pos, p0_a, p1_a);
    if (d_a < stroke.radius) {
      let w = 1.0 - smoothstep(0.0, stroke.radius, d_a);
      darcy.r = min(1.0, darcy.r + w * params.water_dilution * 0.8);
      darcy.g = min(1.0, darcy.g + w * 0.95);
      darcy.b = min(1.0, darcy.b + w * 0.7);
    }
  }

  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let d_L = textureLoad(in_darcy, L, 0);
  let d_R = textureLoad(in_darcy, R, 0);
  let d_B = textureLoad(in_darcy, B, 0);
  let d_T = textureLoad(in_darcy, T, 0);

  let lap_x = d_L.r + d_R.r - 2.0 * darcy.r;
  let lap_y = d_B.r + d_T.r - 2.0 * darcy.r;
  let lap_aniso = lap_x * params.fiber_anisotropy + lap_y;
  let soak = clamp((1.0 - params.sizing_barrier * 0.85) * params.paper_permeability * 0.045, 0.001, 0.05);

  darcy.r = clamp(darcy.r + lap_aniso * soak, 0.0, 1.0);
  let bleed_avail = clamp(darcy.r - darcy.b * 0.5, 0.0, 1.0);
  let lap_p_x = d_L.g + d_R.g - 2.0 * darcy.g;
  let lap_p_y = d_B.g + d_T.g - 2.0 * darcy.g;
  darcy.g = clamp(darcy.g + (lap_p_x * params.fiber_anisotropy + lap_p_y) * (soak * 0.35 * bleed_avail), 0.0, 1.0);

  textureStore(out_darcy, coord, darcy);

  // =========================================================================
  // 3. MODEL B: TRUE LATTICE BOLTZMANN (LBM D2Q9) WITH VORTICITY
  // =========================================================================
  let prev_paint = textureLoad(in_lbm_paint, coord, 0);
  var pigment = prev_paint.r;
  var water = prev_paint.g;

  // Pull Streaming: f_i comes from neighbor coord - e_i
  let c0 = coord;
  let c1 = vec2<i32>(clamp(coord.x - 1, 0, dims.x - 1), coord.y);
  let c2 = vec2<i32>(coord.x, clamp(coord.y - 1, 0, dims.y - 1));
  let c3 = vec2<i32>(clamp(coord.x + 1, 0, dims.x - 1), coord.y);
  let c4 = vec2<i32>(coord.x, clamp(coord.y + 1, 0, dims.y - 1));
  let c5 = vec2<i32>(clamp(coord.x - 1, 0, dims.x - 1), clamp(coord.y - 1, 0, dims.y - 1));
  let c6 = vec2<i32>(clamp(coord.x + 1, 0, dims.x - 1), clamp(coord.y - 1, 0, dims.y - 1));
  let c7 = vec2<i32>(clamp(coord.x + 1, 0, dims.x - 1), clamp(coord.y + 1, 0, dims.y - 1));
  let c8 = vec2<i32>(clamp(coord.x - 1, 0, dims.x - 1), clamp(coord.y + 1, 0, dims.y - 1));

  let f_0 = textureLoad(in_f03, c0, 0).x;
  let f_1 = textureLoad(in_f03, c1, 0).y;
  let f_2 = textureLoad(in_f03, c2, 0).z;
  let f_3 = textureLoad(in_f03, c3, 0).w;
  let f_4 = textureLoad(in_f47, c4, 0).x;
  let f_5 = textureLoad(in_f47, c5, 0).y;
  let f_6 = textureLoad(in_f47, c6, 0).z;
  let f_7 = textureLoad(in_f47, c7, 0).w;
  let f_8 = textureLoad(in_f8macro, c8, 0).x;

  // Macroscopic Density & Momentum
  var rho = f_0 + f_1 + f_2 + f_3 + f_4 + f_5 + f_6 + f_7 + f_8;
  rho = max(0.2, rho);

  var u = vec2<f32>(
    (f_1 - f_3 + f_5 - f_6 - f_7 + f_8) / rho,
    (f_2 - f_4 + f_5 + f_6 - f_7 - f_8) / rho
  );

  // Brush Body Force Injection into Fluid Momentum
  if (stroke.is_active == 1u) {
    let norm_x0 = select(stroke.p0.x * 2.0, (stroke.p0.x - 0.5) * 2.0, stroke.p0.x >= 0.5);
    let norm_x1 = select(stroke.p1.x * 2.0, (stroke.p1.x - 0.5) * 2.0, stroke.p1.x >= 0.5);

    let p0_b = vec2<f32>((norm_x0 * 0.5 + 0.5) * params.grid_size.x, stroke.p0.y * params.grid_size.y);
    let p1_b = vec2<f32>((norm_x1 * 0.5 + 0.5) * params.grid_size.x, stroke.p1.y * params.grid_size.y);

    let d_b = dist_to_segment(pos, p0_b, p1_b);
    if (d_b < stroke.radius) {
      let w = 1.0 - smoothstep(0.0, stroke.radius, d_b);
      // Inject hydrodynamic velocity swirl from trackpad swipe vector
      u += stroke.force * w * 0.45;
      pigment = min(1.0, pigment + w * 0.95);
      water = min(1.0, water + w * params.water_dilution * 0.85);
    }
  }

  // Semi-Lagrangian Advection in Fluid Layer
  if (water > 0.02) {
    let src_pos = vec2<f32>(coord) - u * 2.8;
    let src_coord = vec2<i32>(
      i32(clamp(src_pos.x, 0.0, f32(dims.x - 1))),
      i32(clamp(src_pos.y, 0.0, f32(dims.y - 1)))
    );
    let advected_p = textureLoad(in_lbm_paint, src_coord, 0).r;
    pigment = mix(pigment, advected_p, 0.45);
    u *= 0.985; // Viscous friction
  } else {
    u *= 0.1;
  }

  // BGK Collision Relaxation: f_i* = f_i - (f_i - f_i^eq) / tau
  let omega_rel = 1.0 / max(0.51, params.tau_viscosity);
  let f0_out = f_0 - (f_0 - feq(0u, rho, u)) * omega_rel;
  let f1_out = f_1 - (f_1 - feq(1u, rho, u)) * omega_rel;
  let f2_out = f_2 - (f_2 - feq(2u, rho, u)) * omega_rel;
  let f3_out = f_3 - (f_3 - feq(3u, rho, u)) * omega_rel;
  let f4_out = f_4 - (f_4 - feq(4u, rho, u)) * omega_rel;
  let f5_out = f_5 - (f_5 - feq(5u, rho, u)) * omega_rel;
  let f6_out = f_6 - (f_6 - feq(6u, rho, u)) * omega_rel;
  let f7_out = f_7 - (f_7 - feq(7u, rho, u)) * omega_rel;
  let f8_out = f_8 - (f_8 - feq(8u, rho, u)) * omega_rel;

  textureStore(out_f03, coord, vec4<f32>(f0_out, f1_out, f2_out, f3_out));
  textureStore(out_f47, coord, vec4<f32>(f4_out, f5_out, f6_out, f7_out));
  textureStore(out_f8macro, coord, vec4<f32>(f8_out, rho, u.x, u.y));

  // Compute Hydrodynamic Vorticity: omega = d(uy)/dx - d(ux)/dy
  var vorticity = 0.0;
  if (water > 0.04) {
    let u_R = textureLoad(in_f8macro, R, 0).zw;
    let u_L = textureLoad(in_f8macro, L, 0).zw;
    let u_T = textureLoad(in_f8macro, T, 0).zw;
    let u_B = textureLoad(in_f8macro, B, 0).zw;
    vorticity = ((u_R.y - u_L.y) - (u_T.x - u_B.x)) * 3.5;
  }

  textureStore(out_lbm_paint, coord, vec4<f32>(pigment, water, vorticity, 0.0));
}
`;

const RENDER_SHADER = `
struct FluidParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  tau_viscosity: f32,
  fiber_anisotropy: f32,
  paper_permeability: f32,
  sizing_barrier: f32,
  water_dilution: f32,
  show_vorticity: u32,
  init_trigger: u32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> params: FluidParams;
@group(0) @binding(1) var in_darcy: texture_2d<f32>;
@group(0) @binding(2) var in_lbm_macro: texture_2d<f32>;
@group(0) @binding(3) var in_lbm_paint: texture_2d<f32>;

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

  let paper = vec3<f32>(0.95, 0.92, 0.86);
  let ink = vec3<f32>(0.12, 0.11, 0.10);

  var final_color = paper;

  if (is_left) {
    // Model A: Darcy Porous Tensor
    let darcy = textureLoad(in_darcy, coord, 0);
    let water = darcy.r;
    let pigment = darcy.g;
    let wet_darken = water * 0.08;
    let base = paper - vec3<f32>(wet_darken);
    final_color = mix(base, ink, clamp(pigment * 1.35, 0.0, 1.0));
  } else {
    // Model B: True LBM D2Q9 with Vorticity & Eddy Visualizer
    let lbm_macro = textureLoad(in_lbm_macro, coord, 0);
    let paint = textureLoad(in_lbm_paint, coord, 0);
    let pigment = paint.r;
    let water = paint.g;
    let vorticity = paint.b;
    let vel = lbm_macro.zw;
    let speed = length(vel);

    let wet_darken = water * 0.08;
    let base = paper - vec3<f32>(wet_darken);
    final_color = mix(base, ink, clamp(pigment * 1.35, 0.0, 1.0));

    // Optional Vorticity & Streamline Overlay (only in wet regions)
    if (params.show_vorticity == 1u && water > 0.05) {
      if (vorticity > 0.03) {
        // Counter-clockwise vortex (Cyan glow)
        final_color = mix(final_color, vec3<f32>(0.15, 0.85, 1.0), clamp(vorticity * 2.0, 0.0, 0.75));
      } else if (vorticity < -0.03) {
        // Clockwise vortex (Amber glow)
        final_color = mix(final_color, vec3<f32>(1.0, 0.55, 0.1), clamp(-vorticity * 2.0, 0.0, 0.75));
      }
    }
  }

  // Center divider bar
  if (abs(in.uv.x - 0.5) < 0.0015) {
    final_color = vec3<f32>(0.25, 0.25, 0.30);
  }

  return vec4<f32>(final_color, 1.0);
}
`;

export class FluidBleedExperiment implements LabExperiment {
  public id = 1;
  public title = "Fluid Bleed & Porous Dynamics";
  public subtitle = "Darcy Porous Tensor vs. True Lattice Boltzmann (LBM D2Q9) with Vorticity";
  public sideALabel = "Model A: Darcy Anisotropic Tensor";
  public sideBLabel = "Model B: True LBM D2Q9 CFD (Vorticity Swirl)";

  private ctx!: WebGPULabContext;
  private hud!: TelemetryHUD;

  private pipeSim!: GPUComputePipeline;
  private pipeRender!: GPURenderPipeline;

  // Textures
  private texDarcy!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texF03!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texF47!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texF8Macro!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texLBMPaint!: ReturnType<WebGPULabContext['createTexturePair']>;

  private bufParams!: GPUBuffer;
  private bufStroke!: GPUBuffer;

  private bgSim!: GPUBindGroup[];
  private bgRender!: GPUBindGroup[];

  private stateIdx = 0;
  private isDrawing = false;
  private p0 = { x: 0.25, y: 0.5 };
  private p1 = { x: 0.25, y: 0.5 };
  private radius = 22;
  private speed = 0.5;
  private force = { x: 0, y: 0 };
  private initTrigger = 1;

  // Parameters
  public fiberAnisotropy = 2.8;
  public paperPermeability = 0.70;
  public sizingBarrier = 0.10;
  public waterDilution = 0.75;
  public tauViscosity = 0.85;
  public showVorticity = true;

  private readonly N = 512;

  public async init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void> {
    this.ctx = ctx;
    this.hud = hud;
    const d = ctx.device;

    this.texDarcy = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'darcy');
    this.texF03 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'lbm_f03');
    this.texF47 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'lbm_f47');
    this.texF8Macro = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'lbm_f8macro');
    this.texLBMPaint = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'lbm_paint');

    this.bufParams = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bufStroke = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modSim = ctx.createShaderModule(SHADER_SOURCE, 'sim_fluid_bleed');
    this.pipeSim = d.createComputePipeline({
      layout: 'auto',
      compute: { module: modSim, entryPoint: 'main' }
    });

    const modRender = ctx.createShaderModule(RENDER_SHADER, 'render_fluid_bleed');
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
          { binding: 2, resource: this.texDarcy.viewA },
          { binding: 3, resource: this.texDarcy.viewB },
          { binding: 4, resource: this.texF03.viewA },
          { binding: 5, resource: this.texF03.viewB },
          { binding: 6, resource: this.texF47.viewA },
          { binding: 7, resource: this.texF47.viewB },
          { binding: 8, resource: this.texF8Macro.viewA },
          { binding: 9, resource: this.texF8Macro.viewB },
          { binding: 10, resource: this.texLBMPaint.viewA },
          { binding: 11, resource: this.texLBMPaint.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texDarcy.viewB },
          { binding: 3, resource: this.texDarcy.viewA },
          { binding: 4, resource: this.texF03.viewB },
          { binding: 5, resource: this.texF03.viewA },
          { binding: 6, resource: this.texF47.viewB },
          { binding: 7, resource: this.texF47.viewA },
          { binding: 8, resource: this.texF8Macro.viewB },
          { binding: 9, resource: this.texF8Macro.viewA },
          { binding: 10, resource: this.texLBMPaint.viewB },
          { binding: 11, resource: this.texLBMPaint.viewA }
        ]
      })
    ];

    this.bgRender = [
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texDarcy.viewB },
          { binding: 2, resource: this.texF8Macro.viewB },
          { binding: 3, resource: this.texLBMPaint.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeRender.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: this.texDarcy.viewA },
          { binding: 2, resource: this.texF8Macro.viewA },
          { binding: 3, resource: this.texLBMPaint.viewA }
        ]
      })
    ];
  }

  public renderUI(container: HTMLElement): void {
    container.innerHTML = `
      <div class="panel-section">
        <div class="panel-header-title">Fluid Physics Controls</div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">LBM Viscosity (&tau;)</span>
            <span class="control-value" id="val-tau">${this.tauViscosity.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-tau" min="0.55" max="1.6" step="0.05" value="${this.tauViscosity}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Darcy Fiber Anisotropy</span>
            <span class="control-value" id="val-aniso">${this.fiberAnisotropy.toFixed(2)}x</span>
          </div>
          <input type="range" class="lab-slider" id="slide-aniso" min="1.0" max="5.0" step="0.1" value="${this.fiberAnisotropy}">
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Water Dilution Volume</span>
            <span class="control-value" id="val-water">${this.waterDilution.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-water" min="0.1" max="1.0" step="0.05" value="${this.waterDilution}">
        </div>

        <div class="control-row" style="margin-top: 0.5rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; cursor: pointer; color: var(--lab-cyan);">
            <input type="checkbox" id="check-vorticity" ${this.showVorticity ? 'checked' : ''} style="cursor: pointer;">
            Show LBM Vorticity & Eddy Curls (Right Pane)
          </label>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-header-title">Vorticity & Bleed Comparison</div>
        <p style="font-size: 0.76rem; line-height: 1.5; color: var(--lab-text-muted); margin-bottom: 0.75rem;">
          Draw quick swirling circles or vigorous zigzag strokes on your trackpad.
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-green);">
          🌀 <strong>Right (LBM D2Q9)</strong>: Generates real hydrodynamic counter-rotating vortex pairs (Cyan = CCW, Amber = CW) and fluid wake turbulence.<br>
          🌾 <strong>Left (Darcy)</strong>: Wicks smoothly along botanical paper fiber channels without fluid inertia.
        </p>
      </div>
    `;

    const sTau = container.querySelector('#slide-tau') as HTMLInputElement;
    const vTau = container.querySelector('#val-tau') as HTMLElement;
    sTau?.addEventListener('input', () => {
      this.tauViscosity = parseFloat(sTau.value);
      vTau.textContent = this.tauViscosity.toFixed(2);
    });

    const sAniso = container.querySelector('#slide-aniso') as HTMLInputElement;
    const vAniso = container.querySelector('#val-aniso') as HTMLElement;
    sAniso?.addEventListener('input', () => {
      this.fiberAnisotropy = parseFloat(sAniso.value);
      vAniso.textContent = `${this.fiberAnisotropy.toFixed(2)}x`;
    });

    const sWater = container.querySelector('#slide-water') as HTMLInputElement;
    const vWater = container.querySelector('#val-water') as HTMLElement;
    sWater?.addEventListener('input', () => {
      this.waterDilution = parseFloat(sWater.value);
      vWater.textContent = this.waterDilution.toFixed(2);
    });

    const cVort = container.querySelector('#check-vorticity') as HTMLInputElement;
    cVort?.addEventListener('change', () => {
      this.showVorticity = cVort.checked;
    });
  }

  public onStrokeStart(pt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: pt.x, y: pt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.speed = pt.speed;
    this.force = { x: 0, y: 0 };
    this.radius = Math.max(14, pt.pressure * 28);
  }

  public onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void {
    this.isDrawing = true;
    this.p0 = { x: prevPt.x, y: prevPt.y };
    this.p1 = { x: pt.x, y: pt.y };
    this.speed = pt.speed;
    this.force = {
      x: (pt.x - prevPt.x) * 12.0,
      y: (pt.y - prevPt.y) * 12.0
    };
    this.radius = Math.max(14, pt.pressure * 28);
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
    this.force = { x: 0, y: 0 };
  }

  public reset(): void {
    const d = this.ctx.device;
    const zeroData = new Float32Array(this.N * this.N * 4);
    d.queue.writeTexture({ texture: this.texDarcy.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texDarcy.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLBMPaint.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texLBMPaint.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
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
    f32[4] = this.tauViscosity;
    f32[5] = this.fiberAnisotropy;
    f32[6] = this.paperPermeability;
    f32[7] = this.sizingBarrier;
    f32[8] = this.waterDilution;
    u32[9] = this.showVorticity ? 1 : 0;
    u32[10] = this.initTrigger;
    f32[11] = 0;
    d.queue.writeBuffer(this.bufParams, 0, paramsData);
    this.initTrigger = 0;

    const strokeData = new ArrayBuffer(48);
    const sf32 = new Float32Array(strokeData);
    const su32 = new Uint32Array(strokeData);
    sf32[0] = this.p0.x;
    sf32[1] = this.p0.y;
    sf32[2] = this.p1.x;
    sf32[3] = this.p1.y;
    sf32[4] = this.radius;
    sf32[5] = this.speed;
    sf32[6] = this.force.x;
    sf32[7] = this.force.y;
    su32[8] = this.isDrawing ? 1 : 0;
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
    this.hud.recordFrame(dtCompute, this.N * this.N * 8 * 8);

    this.stateIdx = 1 - this.stateIdx;
    this.p0 = { ...this.p1 };
  }

  public destroy(): void {}
}
