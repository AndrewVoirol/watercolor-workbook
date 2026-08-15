// Velocity Divergence Calculation
// Computes divergence = (u_R.x - u_L.x + u_T.y - u_B.y) * 0.5

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var in_velocity: texture_2d<f32>;
@group(0) @binding(2) var out_pressure: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  // Neighbor coordinates with boundary clamping
  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let vel_L = textureLoad(in_velocity, L, 0).xy;
  let vel_R = textureLoad(in_velocity, R, 0).xy;
  let vel_B = textureLoad(in_velocity, B, 0).xy;
  let vel_T = textureLoad(in_velocity, T, 0).xy;

  // Discrete divergence
  let div = 0.5 * ((vel_R.x - vel_L.x) + (vel_T.y - vel_B.y));

  // Write divergence into G channel, initialize pressure in R channel to 0.0
  textureStore(out_pressure, coord, vec4<f32>(0.0, div, 0.0, 0.0));
}
