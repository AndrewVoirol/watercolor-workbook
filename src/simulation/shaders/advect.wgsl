// Navier-Stokes Semi-Lagrangian Advection with RK2 Backtracing & Gravity Body Acceleration
// Advects velocity, water volume, and suspended pigments across the 2D grid with paper friction and canvas tilt gravity.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_velocity: texture_2d<f32>;
@group(0) @binding(2) var out_velocity: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_water: texture_2d<f32>;
@group(0) @binding(4) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(6) var out_pigment_susp: texture_storage_2d<rgba16float, write>;

@group(0) @binding(7) var in_parchment: texture_2d<f32>;

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

  // 1. Fetch local velocity and paper fiber properties
  let current_vel = textureLoad(in_velocity, coord, 0).xy;
  let parchment = textureLoad(in_parchment, coord, 0);
  let fiber_density = parchment.g;

  // 2. Runge-Kutta 2nd Order (RK2) Backtracing in grid pixel coordinates
  let mid_pos = pos - 0.5 * dt * current_vel;
  let mid_vel = sample_bilinear(in_velocity, mid_pos, dims).xy;
  let trace_pos = pos - dt * mid_vel;

  // 3. Advect quantities from traced position
  var advected_vel = sample_bilinear(in_velocity, trace_pos, dims).xy;
  var advected_water = sample_bilinear(in_water, trace_pos, dims);
  var advected_susp = sample_bilinear(in_pigment_susp, trace_pos, dims);

  // Preserve stationary salt concentration from moving rapidly with high-velocity advection
  let current_water = textureLoad(in_water, coord, 0);
  advected_water.b = mix(current_water.b, advected_water.b, 0.2); // Salt crystals remain largely grounded

  // 4. Gravity & Canvas Tilt Body Acceleration
  // Wet surface water pools accelerate downhill based on tilt vector g
  let surf_depth = advected_water.r;
  if (surf_depth > 0.005) {
    let fluid_mobility = clamp(surf_depth * 1.6, 0.0, 1.2);
    let gravity_force = uniforms.gravity * dt * fluid_mobility * (1.0 - fiber_density * 0.25);
    advected_vel = advected_vel + gravity_force;
  }

  // 5. Paper drag and viscous friction damping against fibrous parchment
  let effective_drag = uniforms.paper_drag * uniforms.paper_roughness * (1.0 + fiber_density * 0.8) + uniforms.viscosity;
  let drag_factor = clamp(1.0 - effective_drag * dt * 3.0, 0.0, 1.0);
  advected_vel = advected_vel * drag_factor;

  // Boundary damping
  if (coord.x <= 1 || coord.x >= dims.x - 2 || coord.y <= 1 || coord.y >= dims.y - 2) {
    advected_vel = vec2<f32>(0.0, 0.0);
  }

  // Water volume height slight diffusion/damping
  advected_water.r = max(advected_water.r * 0.9995, 0.0);

  // Store output
  textureStore(out_velocity, coord, vec4<f32>(advected_vel, 0.0, 0.0));
  textureStore(out_water, coord, advected_water);
  textureStore(out_pigment_susp, coord, advected_susp);
}
