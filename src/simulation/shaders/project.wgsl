// Pressure Gradient Subtraction & Velocity Projection
// u <- u - grad(p)

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var in_velocity: texture_2d<f32>;
@group(0) @binding(2) var in_pressure: texture_2d<f32>;
@group(0) @binding(3) var out_velocity: texture_storage_2d<rgba16float, write>;

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

  let grad_p = 0.5 * vec2<f32>(p_R - p_L, p_T - p_B);
  let current_vel = textureLoad(in_velocity, coord, 0).xy;

  var new_vel = current_vel - grad_p;

  // Boundary conditions
  if (coord.x == 0 || coord.x == dims.x - 1) {
    new_vel.x = 0.0;
  }
  if (coord.y == 0 || coord.y == dims.y - 1) {
    new_vel.y = 0.0;
  }

  textureStore(out_velocity, coord, vec4<f32>(new_vel, 0.0, 0.0));
}
