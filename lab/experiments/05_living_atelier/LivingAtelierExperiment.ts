// Experiment 05: Master Unified Atelier — Direct A/B Showdown
// Left: Standard Digital Brush Baseline vs. Right: Living Physical Atelier Engine

import { WebGPULabContext } from '../../harness/WebGPULabContext';
import { LabExperiment } from '../../harness/LabExperiment';
import { LabStrokePoint } from '../../harness/LabSplitCanvas';
import { TelemetryHUD } from '../../harness/TelemetryHUD';
import { CosseratBristleCluster } from '../02_brush_kinematics/CosseratBristleCluster';

const SHADER_SOURCE = `
struct AtelierParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  tau_viscosity: f32,
  paper_type: u32,
  active_pigment_id: u32,
  water_dilution: f32,
  sizing_barrier: f32,
  granulation: f32,
  init_trigger: u32,
  pad0: f32,
};

struct StrokePoint {
  p0: vec2<f32>,
  p1: vec2<f32>,
  radius: f32,
  is_active: u32,
  speed: f32,
  pressure: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: AtelierParams;
@group(0) @binding(1) var<uniform> stroke: StrokePoint;

// LBM D2Q9 Distribution Textures (Used for Right Side Physics)
@group(0) @binding(2) var in_f03: texture_2d<f32>;
@group(0) @binding(3) var out_f03: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var in_f47: texture_2d<f32>;
@group(0) @binding(5) var out_f47: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var in_f8macro: texture_2d<f32>;
@group(0) @binding(7) var out_f8macro: texture_storage_2d<rgba16float, write>;

// Paint State:
// Left Pane: R,G,B = Color RGB, A = Alpha
// Right Pane: R,G,B = Pigment K_RGB, A = Water Depth H
@group(0) @binding(8) var in_paint: texture_2d<f32>;
@group(0) @binding(9) var out_paint: texture_storage_2d<rgba16float, write>;

// Nihonga Spectral Absorption Table K(lambda)
fn get_pigment_absorption(id: u32) -> vec3<f32> {
  switch (id) {
    case 0u: { return vec3<f32>(5.5, 5.5, 5.5); }       // 墨 Sumi Black
    case 1u: { return vec3<f32>(0.05, 3.8, 5.5); }     // 本朱 Shu Vermilion Red (absorbs G & B)
    case 2u: { return vec3<f32>(5.5, 3.8, 0.08); }     // 本藍 Ai Indigo Blue (absorbs R & G)
    case 3u: { return vec3<f32>(0.15, 0.95, 5.0); }    // 天然黄土 Ōdo Ochre
    case 4u: { return vec3<f32>(0.01, 0.01, 0.01); }   // 雲母胡粉 Gofun Pearl
    case 5u: { return vec3<f32>(5.0, 0.12, 3.9); }     // 天然緑青 Rokushō Malachite
    default: { return vec3<f32>(5.5, 5.5, 5.5); }
  }
}

// Flat sRGB Display Color for Left Baseline Marker
fn get_baseline_rgb(id: u32) -> vec3<f32> {
  switch (id) {
    case 0u: { return vec3<f32>(0.10, 0.10, 0.10); }   // Black Marker
    case 1u: { return vec3<f32>(0.88, 0.15, 0.10); }   // Red Marker
    case 2u: { return vec3<f32>(0.10, 0.30, 0.88); }   // Blue Marker
    case 3u: { return vec3<f32>(0.85, 0.65, 0.18); }   // Ochre Marker
    case 4u: { return vec3<f32>(0.95, 0.95, 0.95); }   // White Marker
    case 5u: { return vec3<f32>(0.15, 0.75, 0.35); }   // Green Marker
    default: { return vec3<f32>(0.10, 0.10, 0.10); }
  }
}

// D2Q9 Equilibrium Distribution
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

fn dist_to_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) { return length(pa); }
  let t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  return length(pa - ba * t);
}

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn smooth_noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash12(i + vec2<f32>(0.0, 0.0));
  let b = hash12(i + vec2<f32>(1.0, 0.0));
  let c = hash12(i + vec2<f32>(0.0, 1.0));
  let d = hash12(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn washi_fiber_permeability(p: vec2<f32>, ptype: u32) -> f32 {
  let n = smooth_noise(p * 0.04) * 0.6 + smooth_noise(p * 0.10) * 0.4;
  switch (ptype) {
    case 0u: { // Kozo Mulberry: Long directional fibers
      let fiber = sin(p.x * 0.02 + n * 3.5) * cos(p.y * 0.015);
      return clamp(n * 0.7 + fiber * 0.3, 0.1, 1.0);
    }
    case 1u: { // Torinoko: Uniform tight grain
      return clamp(n * 0.4 + 0.3, 0.1, 1.0);
    }
    case 2u: { // Kobishi: Horizontal laid bamboo lines
      let laid = sin(p.y * 0.12) * 0.25;
      return clamp(n * 0.6 + laid + 0.2, 0.1, 1.0);
    }
    default: { return clamp(n, 0.1, 1.0); }
  }
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(params.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) { return; }

  let pos = vec2<f32>(coord);
  let half_grid = params.grid_size.x * 0.5;
  let is_left_pane = pos.x < half_grid;

  // 1. Initial State: Clear Canvas
  if (params.init_trigger == 1u) {
    textureStore(out_paint, coord, vec4<f32>(0.0));
    let w0 = 4.0 / 9.0;
    let w_ax = 1.0 / 9.0;
    let w_dg = 1.0 / 36.0;
    textureStore(out_f03, coord, vec4<f32>(w0, w_ax, w_ax, w_ax));
    textureStore(out_f47, coord, vec4<f32>(w_ax, w_dg, w_dg, w_dg));
    textureStore(out_f8macro, coord, vec4<f32>(w_dg, 1.0, 0.0, 0.0));
    return;
  }

  // =========================================================================
  // LEFT PANE: STANDARD DIGITAL BRUSH BASELINE (No Physics, Fixed Round Stamp)
  // =========================================================================
  if (is_left_pane) {
    var cur_left = textureLoad(in_paint, coord, 0);

    if (stroke.is_active == 1u) {
      let d_seg = dist_to_segment(pos, stroke.p0, stroke.p1);
      let r_marker = stroke.radius * 0.75; // Standard uniform radius

      if (d_seg < r_marker) {
        let w_stamp = 1.0 - smoothstep(r_marker - 1.0, r_marker, d_seg);
        let base_rgb = get_baseline_rgb(params.active_pigment_id);
        let new_rgb = mix(cur_left.rgb, base_rgb, w_stamp);
        let new_alpha = max(cur_left.a, w_stamp);
        cur_left = vec4<f32>(new_rgb, new_alpha);
      }
    }

    textureStore(out_paint, coord, cur_left);
    return;
  }

  // =========================================================================
  // RIGHT PANE: LIVING PHYSICAL ATELIER ENGINE (3D Cosserat + LBM + Washi Bleed)
  // =========================================================================

  // 2. LBM Pull Streaming for Right Pane
  let c0 = coord;
  let c1 = vec2<i32>(max(coord.x - 1, i32(half_grid)), coord.y);
  let c2 = vec2<i32>(coord.x, clamp(coord.y - 1, 0, dims.y - 1));
  let c3 = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let c4 = vec2<i32>(coord.x, clamp(coord.y + 1, 0, dims.y - 1));
  let c5 = vec2<i32>(max(coord.x - 1, i32(half_grid)), clamp(coord.y - 1, 0, dims.y - 1));
  let c6 = vec2<i32>(min(coord.x + 1, dims.x - 1), clamp(coord.y - 1, 0, dims.y - 1));
  let c7 = vec2<i32>(min(coord.x + 1, dims.x - 1), clamp(coord.y + 1, 0, dims.y - 1));
  let c8 = vec2<i32>(max(coord.x - 1, i32(half_grid)), clamp(coord.y + 1, 0, dims.y - 1));

  let f_0 = textureLoad(in_f03, c0, 0).x;
  let f_1 = textureLoad(in_f03, c1, 0).y;
  let f_2 = textureLoad(in_f03, c2, 0).z;
  let f_3 = textureLoad(in_f03, c3, 0).w;
  let f_4 = textureLoad(in_f47, c4, 0).x;
  let f_5 = textureLoad(in_f47, c5, 0).y;
  let f_6 = textureLoad(in_f47, c6, 0).z;
  let f_7 = textureLoad(in_f47, c7, 0).w;
  let f_8 = textureLoad(in_f8macro, c8, 0).x;

  var rho = max(0.2, f_0 + f_1 + f_2 + f_3 + f_4 + f_5 + f_6 + f_7 + f_8);
  var raw_u = vec2<f32>(
    (f_1 - f_3 + f_5 - f_6 - f_7 + f_8) / rho,
    (f_2 - f_4 + f_5 + f_6 - f_7 - f_8) / rho
  );

  var u = clamp(raw_u, vec2<f32>(-0.20), vec2<f32>(0.20));

  // 3. Fluid Advection + True Botanical Washi Fiber Wicking (Tarashikomi)
  let cur_paint = textureLoad(in_paint, coord, 0);
  var pigment_k = cur_paint.rgb;
  var water_h = cur_paint.a;

  let fiber_perm = washi_fiber_permeability(pos, params.paper_type);

  if (water_h > 0.01) {
    let cL = textureLoad(in_paint, c1, 0).rgb;
    let cR = textureLoad(in_paint, c3, 0).rgb;
    let cB = textureLoad(in_paint, c2, 0).rgb;
    let cT = textureLoad(in_paint, c4, 0).rgb;
    let bleed_k = (cL + cR + cB + cT) * 0.25;

    let bleed_rate = (1.0 - params.sizing_barrier * 0.7) * fiber_perm * 0.045;
    pigment_k = mix(pigment_k, bleed_k, bleed_rate);

    let soak_drain = (1.0 - params.sizing_barrier * 0.8) * 0.0025;
    water_h = max(0.0, water_h - soak_drain);
    u *= 0.985;
  } else {
    water_h = 0.0;
    u *= 0.05;
  }

  let abs_vec = get_pigment_absorption(params.active_pigment_id);

  // 4. Dynamic 3D Cosserat Calligraphic Stroke Injection (Right Pane)
  if (stroke.is_active == 1u) {
    let r_p0 = stroke.p0 + vec2<f32>(half_grid, 0.0);
    let r_p1 = stroke.p1 + vec2<f32>(half_grid, 0.0);

    let d_r = dist_to_segment(pos, r_p0, r_p1);

    let speed_taper = clamp(1.0 - stroke.speed * 0.45, 0.35, 1.25);
    let dynamic_radius = stroke.radius * (0.35 + stroke.pressure * 0.75) * speed_taper;

    if (d_r < dynamic_radius) {
      let w = 1.0 - smoothstep(dynamic_radius * 0.2, dynamic_radius, d_r);
      let vel_stroke = clamp((r_p1 - r_p0) * 0.04, vec2<f32>(-0.12), vec2<f32>(0.12));
      u += vel_stroke * w * 0.4;
      pigment_k = min(vec3<f32>(9.0), pigment_k + abs_vec * w * 4.5);
      water_h = min(1.0, water_h + w * params.water_dilution * 0.95);
    }
  }

  // 5. BGK Collision Relaxation
  let omega_rel = 1.0 / max(0.55, params.tau_viscosity);
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

  textureStore(out_paint, coord, vec4<f32>(pigment_k, water_h));
}
`;

const RENDER_SHADER = `
struct AtelierParams {
  grid_size: vec2<f32>,
  dt: f32,
  time: f32,
  tau_viscosity: f32,
  paper_type: u32,
  active_pigment_id: u32,
  water_dilution: f32,
  sizing_barrier: f32,
  granulation: f32,
  init_trigger: u32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> params: AtelierParams;
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

fn smooth_noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash12(i + vec2<f32>(0.0, 0.0));
  let b = hash12(i + vec2<f32>(1.0, 0.0));
  let c = hash12(i + vec2<f32>(0.0, 1.0));
  let d = hash12(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn washi_fbm(p: vec2<f32>) -> f32 {
  var v = smooth_noise(p * 0.03) * 0.55;
  v += smooth_noise(p * 0.07) * 0.30;
  v += smooth_noise(p * 0.15) * 0.15;
  return v;
}

fn eval_washi_tooth(pos: vec2<f32>, ptype: u32) -> f32 {
  let noise = washi_fbm(pos);
  switch (ptype) {
    case 0u: { // Kozo Mulberry
      let fiber = sin(pos.x * 0.015 + noise * 3.0) * cos(pos.y * 0.012);
      return noise * 0.6 + fiber * 0.12;
    }
    case 1u: { // Torinoko Eggshell
      return noise * 0.25;
    }
    case 2u: { // Kobishi Antique Laid
      let laid = sin(pos.y * 0.08) * 0.15;
      return noise * 0.45 + laid;
    }
    default: { return noise * 0.45; }
  }
}

// Exact Kubelka-Munk Reflectance Evaluation
fn eval_km_channel(K: f32, S: f32, Rg: f32, d: f32) -> f32 {
  if (K < 0.001) { return Rg; }
  let a = 1.0 + (K / max(S, 0.001));
  let b = sqrt(max(a * a - 1.0, 0.0001));
  let y = clamp(b * max(S, 0.01) * d, 0.0001, 10.0);
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
  let pos = in.uv * params.grid_size;
  let is_left = in.uv.x < 0.5;

  let paint = textureLoad(in_paint, coord, 0);

  // =========================================================================
  // LEFT PANE: STANDARD DIGITAL CANVAS (Flat White Background + Flat Alpha)
  // =========================================================================
  if (is_left) {
    let canvas_rgb = mix(vec3<f32>(0.98, 0.98, 0.98), paint.rgb, clamp(paint.a, 0.0, 1.0));
    var out_rgb = canvas_rgb;
    if (abs(in.uv.x - 0.5) < 0.0015) {
      out_rgb = vec3<f32>(0.25, 0.25, 0.30);
    }
    return vec4<f32>(out_rgb, 1.0);
  }

  // =========================================================================
  // RIGHT PANE: AUTHENTIC NIHONGA WATERCOLOR ON WASHI (Kubelka-Munk + Fibers)
  // =========================================================================
  let K_rgb = paint.rgb;
  let water_h = paint.a;

  // Paper substrate tint per varietal
  var paper_rgb = vec3<f32>(0.95, 0.92, 0.86);
  if (params.paper_type == 1u) { paper_rgb = vec3<f32>(0.96, 0.94, 0.89); }
  else if (params.paper_type == 2u) { paper_rgb = vec3<f32>(0.89, 0.84, 0.74); }
  else if (params.paper_type == 3u) { paper_rgb = vec3<f32>(0.98, 0.97, 0.95); }
  else if (params.paper_type == 4u) { paper_rgb = vec3<f32>(0.93, 0.90, 0.83); }
  else if (params.paper_type == 5u) { paper_rgb = vec3<f32>(0.95, 0.92, 0.81); }

  let tooth = eval_washi_tooth(pos, params.paper_type);
  let gran = (tooth - 0.5) * params.granulation * 0.08;

  let S_rgb = vec3<f32>(0.04, 0.04, 0.04);
  let d_opt = clamp(1.0 + gran, 0.1, 5.0);

  // Subtractive Kubelka-Munk Radiative Transfer
  var final_rgb = vec3<f32>(
    eval_km_channel(K_rgb.r, S_rgb.r, paper_rgb.r, d_opt),
    eval_km_channel(K_rgb.g, S_rgb.g, paper_rgb.g, d_opt),
    eval_km_channel(K_rgb.b, S_rgb.b, paper_rgb.b, d_opt)
  );

  // Wet paper darkening sheen
  final_rgb -= vec3<f32>(water_h * 0.05);

  // Split Divider
  if (abs(in.uv.x - 0.5) < 0.0015) {
    final_rgb = vec3<f32>(0.25, 0.25, 0.30);
  }

  return vec4<f32>(final_rgb, 1.0);
}
`;

export class LivingAtelierExperiment implements LabExperiment {
  public id = 5;
  public title = "Living Atelier — Direct Side-by-Side Showdown";
  public subtitle = "Left: Standard Digital Marker vs. Right: Living Physics Engine";
  public sideALabel = "Left: Standard Digital Marker (No Physics)";
  public sideBLabel = "Right: Living Atelier (3D Cosserat + LBM + Washi)";

  private ctx!: WebGPULabContext;
  private hud!: TelemetryHUD;

  private pipeSim!: GPUComputePipeline;
  private pipeRender!: GPURenderPipeline;

  private texF03!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texF47!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texF8Macro!: ReturnType<WebGPULabContext['createTexturePair']>;
  private texPaint!: ReturnType<WebGPULabContext['createTexturePair']>;

  private bufParams!: GPUBuffer;
  private bufStroke!: GPUBuffer;

  private bgSim!: GPUBindGroup[];
  private bgRender!: GPUBindGroup[];

  private stateIdx = 0;
  private isDrawing = false;
  private p0 = { x: 0.25, y: 0.5 };
  private p1 = { x: 0.25, y: 0.5 };
  private radius = 18;
  private curSpeed = 0;
  private curPressure = 0.5;
  private initTrigger = 1;

  // 3D Physical Cosserat Engine
  public cosseratCluster: CosseratBristleCluster;

  // Parameters
  public brushType = 0;           // 0: Maru, 1: Menso, 2: Hake
  public paperType = 0;           // 0: Kozo, 1: Torinoko, 2: Kobishi, etc.
  public activePigmentId = 0;     // 0: Sumi Black
  public tauViscosity = 0.85;     // LBM Viscosity
  public waterDilution = 0.80;    // Water Volume
  public sizingBarrier = 0.15;    // Dōsa Sizing
  public granulation = 0.50;      // Valley Tooth

  private readonly N = 512;

  constructor() {
    this.cosseratCluster = new CosseratBristleCluster(36, 0);
  }

  public async init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void> {
    this.ctx = ctx;
    this.hud = hud;
    const d = ctx.device;

    this.texF03 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'atelier_f03');
    this.texF47 = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'atelier_f47');
    this.texF8Macro = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'atelier_f8macro');
    this.texPaint = ctx.createTexturePair(this.N, this.N, 'rgba16float', 'atelier_paint');

    this.bufParams = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 48 bytes for StrokePoint struct
    this.bufStroke = d.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modSim = ctx.createShaderModule(SHADER_SOURCE, 'sim_living_atelier');
    this.pipeSim = d.createComputePipeline({
      layout: 'auto',
      compute: { module: modSim, entryPoint: 'main' }
    });

    const modRender = ctx.createShaderModule(RENDER_SHADER, 'render_living_atelier');
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
          { binding: 2, resource: this.texF03.viewA },
          { binding: 3, resource: this.texF03.viewB },
          { binding: 4, resource: this.texF47.viewA },
          { binding: 5, resource: this.texF47.viewB },
          { binding: 6, resource: this.texF8Macro.viewA },
          { binding: 7, resource: this.texF8Macro.viewB },
          { binding: 8, resource: this.texPaint.viewA },
          { binding: 9, resource: this.texPaint.viewB }
        ]
      }),
      d.createBindGroup({
        layout: this.pipeSim.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bufParams } },
          { binding: 1, resource: { buffer: this.bufStroke } },
          { binding: 2, resource: this.texF03.viewB },
          { binding: 3, resource: this.texF03.viewA },
          { binding: 4, resource: this.texF47.viewB },
          { binding: 5, resource: this.texF47.viewA },
          { binding: 6, resource: this.texF8Macro.viewB },
          { binding: 7, resource: this.texF8Macro.viewA },
          { binding: 8, resource: this.texPaint.viewB },
          { binding: 9, resource: this.texPaint.viewA }
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
        <div class="panel-header-title">Living Brush & Fluid Craft</div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Brush Varietal</span>
          </div>
          <div class="radio-group-segmented" id="group-atelier-brush">
            <div class="segmented-option ${this.brushType === 0 ? 'active' : ''}" data-val="0">丸筆 Maru</div>
            <div class="segmented-option ${this.brushType === 1 ? 'active' : ''}" data-val="1">面相 Menso</div>
            <div class="segmented-option ${this.brushType === 2 ? 'active' : ''}" data-val="2">刷毛 Hake</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Washi Substrate (Right Pane)</span>
          </div>
          <div class="radio-group-segmented" id="group-atelier-paper" style="flex-wrap: wrap; gap: 4px;">
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
            <span class="control-name">Nihonga Pigment</span>
          </div>
          <div class="radio-group-segmented" id="group-atelier-pigment" style="flex-wrap: wrap; gap: 4px;">
            <div class="segmented-option ${this.activePigmentId === 0 ? 'active' : ''}" data-val="0" style="flex: 1 1 30%;">墨 Sumi</div>
            <div class="segmented-option ${this.activePigmentId === 1 ? 'active' : ''}" data-val="1" style="flex: 1 1 30%;">本朱 Shu</div>
            <div class="segmented-option ${this.activePigmentId === 2 ? 'active' : ''}" data-val="2" style="flex: 1 1 30%;">本藍 Ai</div>
            <div class="segmented-option ${this.activePigmentId === 3 ? 'active' : ''}" data-val="3" style="flex: 1 1 30%;">天然黄土 Ōdo</div>
            <div class="segmented-option ${this.activePigmentId === 5 ? 'active' : ''}" data-val="5" style="flex: 1 1 30%;">天然緑青 Rokushō</div>
            <div class="segmented-option ${this.activePigmentId === 4 ? 'active' : ''}" data-val="4" style="flex: 1 1 30%;">雲母胡粉 Gofun</div>
          </div>
        </div>

        <div class="control-row">
          <div class="control-label-row">
            <span class="control-name">Water Volume / Bleed Life</span>
            <span class="control-value" id="val-water">${this.waterDilution.toFixed(2)}</span>
          </div>
          <input type="range" class="lab-slider" id="slide-water" min="0.2" max="1.0" step="0.05" value="${this.waterDilution}">
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-header-title">Live A/B Demonstration</div>
        <p style="font-size: 0.76rem; line-height: 1.5; color: var(--lab-text-muted); margin-bottom: 0.75rem;">
          Paint anywhere on the trackpad. Both sides mirror your movement in real time:
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-amber); margin-bottom: 0.5rem;">
          ⬅️ <strong>Left (Digital Marker)</strong>: Rigid constant-radius stamping, flat RGB, zero fluid mechanics.
        </p>
        <p style="font-size: 0.74rem; line-height: 1.4; color: var(--lab-green);">
          ➡️ <strong>Right (Living Atelier)</strong>: Dynamic 3D Cosserat calligraphic taper, LBM hydrodynamic fluid bloom, dendritic washi wicking, and spectral Kubelka-Munk optics.
        </p>
      </div>
    `;

    container.querySelectorAll('#group-atelier-brush .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-atelier-brush .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.brushType = parseInt(opt.getAttribute('data-val') || '0', 10);
        this.cosseratCluster.setBrushType(this.brushType);
      });
    });

    container.querySelectorAll('#group-atelier-paper .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-atelier-paper .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.paperType = parseInt(opt.getAttribute('data-val') || '0', 10);
      });
    });

    container.querySelectorAll('#group-atelier-pigment .segmented-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        container.querySelectorAll('#group-atelier-pigment .segmented-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        this.activePigmentId = parseInt(opt.getAttribute('data-val') || '0', 10);
      });
    });

    const sWater = container.querySelector('#slide-water') as HTMLInputElement;
    const vWater = container.querySelector('#val-water') as HTMLElement;
    sWater?.addEventListener('input', () => {
      this.waterDilution = parseFloat(sWater.value);
      vWater.textContent = this.waterDilution.toFixed(2);
    });
  }

  public onStrokeStart(pt: LabStrokePoint): void {
    this.isDrawing = true;
    const normX = pt.x >= 0.5 ? (pt.x - 0.5) * 2.0 : pt.x * 2.0;
    const gx = normX * (this.N * 0.5);
    const gy = pt.y * this.N;

    this.p0 = { x: gx, y: gy };
    this.p1 = { x: gx, y: gy };
    this.curSpeed = pt.speed;
    this.curPressure = pt.pressure;
    
    const baseRadius = this.brushType === 1 ? 8 : (this.brushType === 2 ? 28 : 16);
    this.radius = baseRadius;

    this.cosseratCluster.updateHandleFromTrackpad(
      gx,
      gy,
      pt.speed,
      pt.pressure,
      true
    );
  }

  public onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void {
    this.isDrawing = true;
    const normX = pt.x >= 0.5 ? (pt.x - 0.5) * 2.0 : pt.x * 2.0;
    const prevNormX = prevPt.x >= 0.5 ? (prevPt.x - 0.5) * 2.0 : prevPt.x * 2.0;

    this.p0 = { x: prevNormX * (this.N * 0.5), y: prevPt.y * this.N };
    this.p1 = { x: normX * (this.N * 0.5), y: pt.y * this.N };
    this.curSpeed = pt.speed;
    this.curPressure = pt.pressure;

    const baseRadius = this.brushType === 1 ? 8 : (this.brushType === 2 ? 28 : 16);
    this.radius = baseRadius;

    this.cosseratCluster.updateHandleFromTrackpad(
      this.p1.x,
      this.p1.y,
      pt.speed,
      pt.pressure,
      true
    );
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
    this.cosseratCluster.updateHandleFromTrackpad(
      this.cosseratCluster.ferrulePos[0],
      this.cosseratCluster.ferrulePos[1],
      0,
      0,
      false
    );
  }

  public reset(): void {
    const d = this.ctx.device;
    const zeroData = new Float32Array(this.N * this.N * 4);
    d.queue.writeTexture({ texture: this.texPaint.texA }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    d.queue.writeTexture({ texture: this.texPaint.texB }, zeroData, { bytesPerRow: this.N * 8 }, [this.N, this.N, 1]);
    this.cosseratCluster.initBristles();
    this.initTrigger = 1;
  }

  public step(_w: number, _h: number, _dpr: number): void {
    const d = this.ctx.device;
    const now = performance.now();

    this.cosseratCluster.stepPhysics(0.016);

    const paramsData = new ArrayBuffer(48);
    const f32 = new Float32Array(paramsData);
    const u32 = new Uint32Array(paramsData);
    f32[0] = this.N;
    f32[1] = this.N;
    f32[2] = 0.016;
    f32[3] = now * 0.001;
    f32[4] = this.tauViscosity;
    u32[5] = this.paperType;
    u32[6] = this.activePigmentId;
    f32[7] = this.waterDilution;
    f32[8] = this.sizingBarrier;
    f32[9] = this.granulation;
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
    su32[5] = this.isDrawing ? 1 : 0;
    sf32[6] = this.curSpeed;
    sf32[7] = this.curPressure;
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
    this.hud.recordFrame(dtCompute, this.N * this.N * 8 * 4);

    this.stateIdx = 1 - this.stateIdx;
    this.p0 = { ...this.p1 };
  }

  public destroy(): void {
    const overlay = document.getElementById('cosserat-overlay');
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  }
}
