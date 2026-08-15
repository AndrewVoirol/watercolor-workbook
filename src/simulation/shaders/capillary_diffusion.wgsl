// Capillary Action & Paper Fiber Diffusion
// Simulates liquid capillary suction into porous washi paper fibers and outward perimeter soaking.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var out_water: texture_storage_2d<rgba32float, write>;

@group(0) @binding(3) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(4) var out_pigment_susp: texture_storage_2d<rgba32float, write>;

@group(0) @binding(5) var in_parchment: texture_2d<f32>;

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

  let current_water = textureLoad(in_water, coord, 0);
  let water_L = textureLoad(in_water, L, 0);
  let water_R = textureLoad(in_water, R, 0);
  let water_B = textureLoad(in_water, B, 0);
  let water_T = textureLoad(in_water, T, 0);

  let parchment = textureLoad(in_parchment, coord, 0);
  let fiber_suction = parchment.g * uniforms.capillary_strength;

  let dt = uniforms.dt;

  // 1. Capillary Laplacian diffusion
  let lap_water = (water_L.r + water_R.r + water_B.r + water_T.r - 4.0 * current_water.r);
  let capillary_flux = lap_water * fiber_suction * dt * 3.5;
  var new_water_height = max(current_water.r + capillary_flux, 0.0);

  // 2. Paper fiber internal absorption
  let absorption = min(new_water_height * 0.12 * dt, 0.5 - current_water.a);
  let new_internal_moisture = clamp(current_water.a + max(absorption, 0.0), 0.0, 1.0);
  new_water_height = max(new_water_height - max(absorption, 0.0), 0.0);

  // 3. Suspended Pigment Capillary Diffusion
  let susp = textureLoad(in_pigment_susp, coord, 0);
  let susp_L = textureLoad(in_pigment_susp, L, 0);
  let susp_R = textureLoad(in_pigment_susp, R, 0);
  let susp_B = textureLoad(in_pigment_susp, B, 0);
  let susp_T = textureLoad(in_pigment_susp, T, 0);

  // Diffusion rate is proportional to fluid mobility (water height)
  let diff_rate = clamp(new_water_height * 0.08 * dt, 0.0, 0.2);
  let lap_susp = (susp_L + susp_R + susp_B + susp_T - 4.0 * susp);
  let new_susp = max(susp + lap_susp * diff_rate, vec4<f32>(0.0));

  // Also diffuse suspended Rokusho (in water.g)
  let lap_rokusho_susp = (water_L.g + water_R.g + water_B.g + water_T.g - 4.0 * current_water.g);
  let new_rokusho_susp = max(current_water.g + lap_rokusho_susp * diff_rate, 0.0);

  textureStore(out_water, coord, vec4<f32>(new_water_height, new_rokusho_susp, current_water.b, new_internal_moisture));
  textureStore(out_pigment_susp, coord, new_susp);
}
