// Mass-Conserving Free-Surface Fluid Pressure Solver (Jacobi Poisson Relaxation)
// Solves ∇²p = ∇⋅u on surface water sheets with Dirichlet p=0 free-surface boundaries on dry paper.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var in_pressure: texture_2d<f32>;
@group(0) @binding(2) var out_pressure: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var in_water: texture_2d<f32>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let water_center = textureLoad(in_water, coord, 0).r;
  // Free-surface Dirichlet boundary condition: dry cells have 0 pressure
  if (water_center <= 0.001) {
    textureStore(out_pressure, coord, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    return;
  }

  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let w_L = textureLoad(in_water, L, 0).r;
  let w_R = textureLoad(in_water, R, 0).r;
  let w_B = textureLoad(in_water, B, 0).r;
  let w_T = textureLoad(in_water, T, 0).r;

  let current = textureLoad(in_pressure, coord, 0);
  let div = current.g;

  // Neighbor pressures: if neighbor is dry, p=0 (free surface); if boundary wall, Neumann p_neighbor = p_center
  let p_L = select(0.0, textureLoad(in_pressure, L, 0).r, w_L > 0.001);
  let p_R = select(0.0, textureLoad(in_pressure, R, 0).r, w_R > 0.001);
  let p_B = select(0.0, textureLoad(in_pressure, B, 0).r, w_B > 0.001);
  let p_T = select(0.0, textureLoad(in_pressure, T, 0).r, w_T > 0.001);

  // Exact 5-point Laplacian inverse step: p = (p_L + p_R + p_B + p_T - div) / 4
  let p_computed = (p_L + p_R + p_B + p_T - div) * 0.25;

  // Preserve divergence in G channel while writing updated pressure to R channel
  textureStore(out_pressure, coord, vec4<f32>(p_computed, div, 0.0, 0.0));
}
