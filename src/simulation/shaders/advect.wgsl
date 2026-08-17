// Navier-Stokes Semi-Lagrangian Advection with RK2 Backtracing & Gravity Body Acceleration
// Advects velocity, water volume, and suspended pigments (K, S) across the 2D grid with Brinkman paper friction,
// Solutocapillary Marangoni flow in wet puddles (Tarashikomi), and canvas tilt gravity.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_velocity: texture_2d<f32>;
@group(0) @binding(2) var out_velocity: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_water: texture_2d<f32>;
@group(0) @binding(4) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(6) var out_pigment_susp_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(7) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(8) var out_pigment_susp_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(9) var in_parchment: texture_2d<f32>;

// Manual 4-tap Bilinear Texture Sampler
fn sample_bilinear(tex: texture_2d<f32>, p: vec2<f32>, dims: vec2<i32>) -> vec4<f32> {
  let clamped_p = clamp(p - 0.5, vec2<f32>(0.0, 0.0), vec2<f32>(dims) - 1.001);
  let i0 = vec2<i32>(floor(clamped_p));
  let i1 = min(i0 + vec2<i32>(1, 1), dims - vec2<i32>(1, 1));
  let f = fract(clamped_p);

  let c00 = textureLoad(tex, vec2<i32>(i0.x, i0.y), 0);
  let c10 = textureLoad(tex, vec2<i32>(i1.x, i0.y), 0);
  let c01 = textureLoad(tex, vec2<i32>(i0.x, i1.y), 0);
  let c11 = textureLoad(tex, vec2<i32>(i1.x, i1.y), 0);

  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(coord.x) + 0.5, f32(coord.y) + 0.5);
  let dt = uniforms.dt;

  // 1. Fetch local velocity and parchment properties
  let current_vel = textureLoad(in_velocity, coord, 0).xy;
  let parchment = textureLoad(in_parchment, coord, 0);
  let paper_height = parchment.r;
  let fiber_density = parchment.g;

  // 2. Runge-Kutta 2nd Order (RK2) Backtracing in grid pixel coordinates
  let mid_pos = pos - 0.5 * dt * current_vel;
  let mid_vel = sample_bilinear(in_velocity, mid_pos, dims).xy;
  let trace_pos = pos - dt * mid_vel;

  // 3. Advect quantities from traced position with differential particulate shear slip
  var advected_vel = sample_bilinear(in_velocity, trace_pos, dims).xy;
  var advected_water = sample_bilinear(in_water, trace_pos, dims);

  // Particulate slip: Coarse minerals experience basal tooth shear and advect slower;
  // Molecular dyes ride the surface velocity faster.
  let cur_susp_k_local = textureLoad(in_pigment_susp_k, coord, 0);
  let coarse_val = cur_susp_k_local.a;
  let slip_factor = mix(1.10, 1.0 - 0.28 * paper_height, coarse_val);
  let trace_pos_pigment = pos - dt * (mid_vel * slip_factor);

  var advected_susp_k = sample_bilinear(in_pigment_susp_k, trace_pos_pigment, dims);
  var advected_susp_s = sample_bilinear(in_pigment_susp_s, trace_pos_pigment, dims);

  // Preserve stationary salt concentration from moving rapidly with high-velocity advection
  let current_water = textureLoad(in_water, coord, 0);
  advected_water.b = mix(current_water.b, advected_water.b, 0.15);

  // 4. Gravity & Canvas Tilt Body Acceleration
  let surf_depth = advected_water.r;
  if (surf_depth > 0.003) {
    let fluid_mobility = clamp(pow(surf_depth * 1.8, 1.3), 0.0, 1.5);
    let gravity_force = uniforms.gravity * dt * fluid_mobility * (1.0 - fiber_density * 0.2);
    advected_vel = advected_vel + gravity_force;
  }

  // 5. Solutocapillary Marangoni Stress & Vortex Swirling (Tarashikomi 垂らし込み Wet Marbling)
  if (surf_depth > 0.012) {
    let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
    let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
    let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
    let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

    let k_L = textureLoad(in_pigment_susp_k, L, 0).rgb;
    let k_R = textureLoad(in_pigment_susp_k, R, 0).rgb;
    let k_B = textureLoad(in_pigment_susp_k, B, 0).rgb;
    let k_T = textureLoad(in_pigment_susp_k, T, 0).rgb;

    let total_c_L = dot(k_L, vec3<f32>(0.333));
    let total_c_R = dot(k_R, vec3<f32>(0.333));
    let total_c_B = dot(k_B, vec3<f32>(0.333));
    let total_c_T = dot(k_T, vec3<f32>(0.333));

    let grad_c = 0.5 * vec2<f32>(total_c_R - total_c_L, total_c_T - total_c_B);
    let curl_vortex = vec2<f32>(-grad_c.y, grad_c.x) * 0.35;
    
    let marangoni_force = -(grad_c + curl_vortex) * (uniforms.marangoni_flow_rate / max(surf_depth, 0.04)) * dt * 9.5;
    advected_vel = advected_vel + marangoni_force;
  }

  // 6. Brinkman Height-Clearance Drag & Wet-on-Wet Frictionless Slip
  let clearance = max(surf_depth - (paper_height - 0.5) * 0.15 * uniforms.paper_roughness, 0.001);
  let tooth_drag = uniforms.paper_drag * uniforms.paper_roughness * (0.5 + 0.5 / (1.0 + clearance * 12.0));
  
  let wet_slip = clamp(1.0 - advected_water.g * 0.65, 0.35, 1.0);
  let effective_drag = (tooth_drag * wet_slip * (1.0 + fiber_density * 0.5)) + uniforms.viscosity;
  let drag_factor = clamp(1.0 - effective_drag * dt * 2.8, 0.0, 1.0);
  advected_vel = advected_vel * drag_factor;

  // Boundary damping
  if (coord.x <= 1 || coord.x >= dims.x - 2 || coord.y <= 1 || coord.y >= dims.y - 2) {
    advected_vel = vec2<f32>(0.0, 0.0);
  }

  // Water volume height damping
  advected_water.r = max(advected_water.r * 0.9997, 0.0);

  textureStore(out_velocity, coord, vec4<f32>(advected_vel, 0.0, 0.0));
  textureStore(out_water, coord, advected_water);
  textureStore(out_pigment_susp_k, coord, advected_susp_k);
  textureStore(out_pigment_susp_s, coord, advected_susp_s);
}
