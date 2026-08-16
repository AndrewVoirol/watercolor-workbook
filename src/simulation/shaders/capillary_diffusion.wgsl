// 2-Layer Darcy Porous Media Simulation & Capillary Diffusion
// Simulates vertical liquid absorption into paper matrix, lateral Darcy porous flow,
// and Salt Granulation (塩振り) hygroscopic suction & outward osmotic pigment repulsion.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(4) var out_pigment_susp: texture_storage_2d<rgba16float, write>;

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
  let parchment_L = textureLoad(in_parchment, L, 0);
  let parchment_R = textureLoad(in_parchment, R, 0);
  let parchment_B = textureLoad(in_parchment, B, 0);
  let parchment_T = textureLoad(in_parchment, T, 0);

  let paper_height = parchment.r;
  let paper_fiber = parchment.g;
  let dt = uniforms.dt;

  // --- 1. Vertical Fluid Absorption Transfer (Surface Pool -> Fiber Capillary) ---
  let fiber_capacity = (0.65 + paper_fiber * 0.35) * uniforms.paper_capillary_rate;
  let deficit = max(fiber_capacity - current_water.g, 0.0);
  let J_vert = min(current_water.r, deficit * uniforms.capillary_strength * uniforms.paper_capillary_rate * dt * 2.8);

  var h_surf = max(current_water.r - J_vert, 0.0);
  var h_cap = current_water.g + J_vert;
  var salt_conc = current_water.b; // Active salt crystals

  // --- 2. Lateral Darcy Porous Flow in Paper Fiber Matrix ---
  // Hydraulic potential: Φ = h_cap + topography tooth
  let tooth_factor = 0.35 * uniforms.paper_roughness;
  let phi_center = h_cap + (paper_height - 0.5) * tooth_factor;
  let phi_L = water_L.g + (parchment_L.r - 0.5) * tooth_factor;
  let phi_R = water_R.g + (parchment_R.r - 0.5) * tooth_factor;
  let phi_B = water_B.g + (parchment_B.r - 0.5) * tooth_factor;
  let phi_T = water_T.g + (parchment_T.r - 0.5) * tooth_factor;

  // Permeability modulated by Kozo fiber alignment and local capillary strength
  let K_perm = uniforms.capillary_strength * uniforms.paper_permeability * (0.35 + paper_fiber * 0.65) * dt * 1.8;
  let lap_phi = (phi_L + phi_R + phi_B + phi_T - 4.0 * phi_center);
  h_cap = max(h_cap + lap_phi * K_perm, 0.0);

  // --- 3. Salt Hygroscopic Water Absorption ---
  if (salt_conc > 0.01 && (h_surf > 0.001 || h_cap > 0.001)) {
    // Salt crystal acts as a powerful local water sink, drawing water from surrounding cells
    let lap_salt = (water_L.b + water_R.b + water_B.b + water_T.b - 4.0 * salt_conc);
    let salt_wick = clamp(salt_conc * 0.45 * dt * uniforms.salt_intensity, 0.0, 0.1);
    h_surf = max(h_surf - salt_wick * 0.4, 0.0);
    h_cap = max(h_cap - salt_wick * 0.2, 0.0);
  }

  // --- 4. Suspended Pigment Capillary Bleeding & Salt Osmotic Repulsion ---
  let susp = textureLoad(in_pigment_susp, coord, 0);
  let susp_L = textureLoad(in_pigment_susp, L, 0);
  let susp_R = textureLoad(in_pigment_susp, R, 0);
  let susp_B = textureLoad(in_pigment_susp, B, 0);
  let susp_T = textureLoad(in_pigment_susp, T, 0);

  // Mobility is driven by surface free water and capillary moisture
  let mobility = clamp((h_surf * 0.7 + h_cap * 0.3) * uniforms.viscosity * 20.0 + (h_surf * 0.05) * dt, 0.0, 0.25);
  let lap_susp = (susp_L + susp_R + susp_B + susp_T - 4.0 * susp);
  var new_susp = max(susp + lap_susp * mobility, vec4<f32>(0.0));

  // Salt Osmotic Starburst: Salt crystals repel suspended pigment radially away from their center
  let grad_salt = vec2<f32>(water_R.b - water_L.b, water_T.b - water_B.b) * 0.5;
  let salt_repulsion = length(grad_salt);
  if (salt_conc > 0.05 && (h_surf > 0.001 || h_cap > 0.001)) {
    let repel_rate = clamp(salt_conc * 2.8 * dt * uniforms.salt_intensity, 0.0, 0.4);
    // Suspended pigment is pushed away, clearing the core of the salt crystal
    new_susp = new_susp * (1.0 - repel_rate);
  }

  let saturation_state = clamp(h_cap / max(fiber_capacity, 0.001), 0.0, 1.0);

  // Store updated water (R: surface, G: capillary, B: salt, A: saturation) and pigment
  textureStore(out_water, coord, vec4<f32>(h_surf, h_cap, salt_conc, saturation_state));
  textureStore(out_pigment_susp, coord, new_susp);
}
