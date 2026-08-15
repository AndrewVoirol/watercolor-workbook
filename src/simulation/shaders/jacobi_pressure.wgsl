// Porous Fluid Pressure Solver (Jacobi Relaxation Iteration)
// Uses relaxation factor omega=0.85 to allow controlled residual divergence for organic fingering.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var in_pressure: texture_2d<f32>;
@group(0) @binding(2) var out_pressure: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let p_L = textureLoad(in_pressure, L, 0).r;
  let p_R = textureLoad(in_pressure, R, 0).r;
  let p_B = textureLoad(in_pressure, B, 0).r;
  let p_T = textureLoad(in_pressure, T, 0).r;

  let current = textureLoad(in_pressure, coord, 0);
  let p_old = current.r;
  let div = current.g;

  // Jacobi iteration step with porous relaxation factor
  let p_computed = (p_L + p_R + p_B + p_T - div) * 0.25;
  let omega = uniforms.omega_relaxation; // 0.85
  let p_relaxed = mix(p_old, p_computed, omega);

  // Preserve divergence in G channel while updating pressure in R channel
  textureStore(out_pressure, coord, vec4<f32>(p_relaxed, div, 0.0, 0.0));
}
