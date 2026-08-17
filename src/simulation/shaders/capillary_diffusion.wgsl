// 2-Layer Darcy Porous Media Simulation & Anisotropic Capillary Diffusion
// Simulates Lucas-Washburn vertical imbibition into paper matrix, CFL-stabilized anisotropic fiber tensor flow (Hige-nijimi),
// chromatographic separation of fine dyes vs coarse minerals, and dynamic water dilution blooming.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(4) var out_pigment_susp_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(6) var out_pigment_susp_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(7) var in_parchment: texture_2d<f32>;

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

  let TL = vec2<i32>(max(coord.x - 1, 0), min(coord.y + 1, dims.y - 1));
  let TR = vec2<i32>(min(coord.x + 1, dims.x - 1), min(coord.y + 1, dims.y - 1));
  let BL = vec2<i32>(max(coord.x - 1, 0), max(coord.y - 1, 0));
  let BR = vec2<i32>(min(coord.x + 1, dims.x - 1), max(coord.y - 1, 0));

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
  let fiber_angle = parchment.a * (2.0 * 3.14159265) - 3.14159265;
  let cos_t = cos(fiber_angle);
  let sin_t = sin(fiber_angle);

  let dt = uniforms.dt;
  let aspect = uniforms.aspect_ratio;

  // --- 1. Lucas-Washburn Vertical Imbibition (Surface Pool -> Fiber Capillary) ---
  let cos_theta = max(uniforms.paper_contact_angle, 0.05);
  let fiber_capacity = (0.65 + paper_fiber * 0.45) * uniforms.paper_capillary_rate;
  let deficit = max(fiber_capacity - current_water.g, 0.0);
  let soak_rate = uniforms.capillary_strength * uniforms.paper_capillary_rate * cos_theta * 3.5;
  let J_vert = min(current_water.r, deficit * soak_rate * dt);

  var h_surf = max(current_water.r - J_vert, 0.0);
  var h_cap = current_water.g + J_vert;

  // --- 2. Lateral Anisotropic Darcy Porous Flow in Paper Matrix (Hige-nijimi 髭滲み) ---
  let tooth_factor = 0.35 * uniforms.paper_roughness;
  
  // Hydraulic potential: tooth height modulates potential where paper is wet
  let wet_tooth_center = (paper_height - 0.5) * tooth_factor * clamp(h_cap * 2.5, 0.0, 1.0);
  let wet_tooth_L = (parchment_L.r - 0.5) * tooth_factor * clamp(water_L.g * 2.5, 0.0, 1.0);
  let wet_tooth_R = (parchment_R.r - 0.5) * tooth_factor * clamp(water_R.g * 2.5, 0.0, 1.0);
  let wet_tooth_B = (parchment_B.r - 0.5) * tooth_factor * clamp(water_B.g * 2.5, 0.0, 1.0);
  let wet_tooth_T = (parchment_T.r - 0.5) * tooth_factor * clamp(water_T.g * 2.5, 0.0, 1.0);

  let phi_center = h_cap + wet_tooth_center;
  let phi_L = water_L.g + wet_tooth_L;
  let phi_R = water_R.g + wet_tooth_R;
  let phi_B = water_B.g + wet_tooth_B;
  let phi_T = water_T.g + wet_tooth_T;

  let water_TL = textureLoad(in_water, TL, 0);
  let water_TR = textureLoad(in_water, TR, 0);
  let water_BL = textureLoad(in_water, BL, 0);
  let water_BR = textureLoad(in_water, BR, 0);
  let parchment_TL = textureLoad(in_parchment, TL, 0);
  let parchment_TR = textureLoad(in_parchment, TR, 0);
  let parchment_BL = textureLoad(in_parchment, BL, 0);
  let parchment_BR = textureLoad(in_parchment, BR, 0);

  let phi_TL = water_TL.g + (parchment_TL.r - 0.5) * tooth_factor * clamp(water_TL.g * 2.5, 0.0, 1.0);
  let phi_TR = water_TR.g + (parchment_TR.r - 0.5) * tooth_factor * clamp(water_TR.g * 2.5, 0.0, 1.0);
  let phi_BL = water_BL.g + (parchment_BL.r - 0.5) * tooth_factor * clamp(water_BL.g * 2.5, 0.0, 1.0);
  let phi_BR = water_BR.g + (parchment_BR.r - 0.5) * tooth_factor * clamp(water_BR.g * 2.5, 0.0, 1.0);

  // Aspect-corrected discrete 2nd derivatives of hydraulic potential
  let d2_phi_x = (phi_R + phi_L - 2.0 * phi_center) * (aspect * aspect);
  let d2_phi_y = (phi_T + phi_B - 2.0 * phi_center);
  let d2_phi_xy = (phi_TR + phi_BL - phi_TL - phi_BR) * (0.25 * aspect);

  // Anisotropic tensor components along and across bast fibers
  let d2_phi_fiber = cos_t * cos_t * d2_phi_x + sin_t * sin_t * d2_phi_y + 2.0 * cos_t * sin_t * d2_phi_xy;
  let d2_phi_perp = sin_t * sin_t * d2_phi_x + cos_t * cos_t * d2_phi_y - 2.0 * cos_t * sin_t * d2_phi_xy;

  let aniso_ratio = mix(1.20, 3.4, clamp(uniforms.paper_permeability * 0.35 + paper_fiber * 0.65, 0.0, 1.0));
  let lap_phi_aniso = d2_phi_fiber * aniso_ratio + d2_phi_perp * (1.0 / aniso_ratio);

  // Saturation gating: Darcy flow only conducts where fluid is present
  let local_water_avail = max(h_cap, max(max(water_L.g, water_R.g), max(water_B.g, water_T.g)));
  let sat_conductivity = smoothstep(0.004, 0.10, local_water_avail);

  // Dynamic water dilution scaling: high dilution sustains bleeding bloom over 1-3 seconds
  let dilution_boost = 0.5 + uniforms.water_dilution * 1.0;

  // Meniscus Pinning with CFL Stability Limiter (Guarantees zero checkerboard/diamond artifacts)
  let raw_K_perm = uniforms.capillary_strength * uniforms.paper_permeability * cos_theta * (0.35 + paper_fiber * 0.65) * sat_conductivity * dt * 1.5 * dilution_boost;
  let max_safe_K = 0.22 / (max(aspect * aspect, 1.0) * aniso_ratio);
  let K_perm = min(raw_K_perm, max_safe_K);

  h_cap = clamp(h_cap + lap_phi_aniso * K_perm, 0.0, fiber_capacity * 1.15);

  // --- 3. Suspended Pigment (K, S) Anisotropic Bleeding & Chromatographic Sieving ---
  let susp_k = textureLoad(in_pigment_susp_k, coord, 0);
  let susp_s = textureLoad(in_pigment_susp_s, coord, 0);

  var new_susp_k_rgb = susp_k.rgb;
  var new_susp_s_rgb = susp_s.rgb;

  let fluid_presence = h_surf * 0.75 + h_cap * 0.35;
  if (fluid_presence > 0.004) {
    let susp_k_L = textureLoad(in_pigment_susp_k, L, 0);
    let susp_k_R = textureLoad(in_pigment_susp_k, R, 0);
    let susp_k_B = textureLoad(in_pigment_susp_k, B, 0);
    let susp_k_T = textureLoad(in_pigment_susp_k, T, 0);

    let susp_k_TL = textureLoad(in_pigment_susp_k, TL, 0);
    let susp_k_TR = textureLoad(in_pigment_susp_k, TR, 0);
    let susp_k_BL = textureLoad(in_pigment_susp_k, BL, 0);
    let susp_k_BR = textureLoad(in_pigment_susp_k, BR, 0);

    let susp_s_L = textureLoad(in_pigment_susp_s, L, 0);
    let susp_s_R = textureLoad(in_pigment_susp_s, R, 0);
    let susp_s_B = textureLoad(in_pigment_susp_s, B, 0);
    let susp_s_T = textureLoad(in_pigment_susp_s, T, 0);

    let susp_s_TL = textureLoad(in_pigment_susp_s, TL, 0);
    let susp_s_TR = textureLoad(in_pigment_susp_s, TR, 0);
    let susp_s_BL = textureLoad(in_pigment_susp_s, BL, 0);
    let susp_s_BR = textureLoad(in_pigment_susp_s, BR, 0);

    // Chromatographic mobility: fine dyes (low coarse_ratio in susp_k.a) wick along fibers
    let coarse_ratio = susp_k.a;
    let dye_boost = 1.0 + (1.0 - coarse_ratio) * 0.95;
    let raw_mobility = (fluid_presence * uniforms.viscosity * 24.0 * dye_boost * dilution_boost + h_surf * 0.15) * dt;
    let mobility = clamp(raw_mobility, 0.0, 0.075 / (max(aspect * aspect, 1.0)));
    let effective_aniso = mix(1.2, aniso_ratio * 1.25, (1.0 - coarse_ratio) * (0.4 + paper_fiber * 0.6));

    // Anisotropic Diffusion for K along Sinuous Bast Fibers (Hige-nijimi 髭滲み)
    let d2_k_x = (susp_k_R.rgb + susp_k_L.rgb - 2.0 * susp_k.rgb) * (aspect * aspect);
    let d2_k_y = (susp_k_T.rgb + susp_k_B.rgb - 2.0 * susp_k.rgb);
    let d2_k_xy = (susp_k_TR.rgb + susp_k_BL.rgb - susp_k_TL.rgb - susp_k_BR.rgb) * (0.25 * aspect);

    let d2_k_fiber = cos_t * cos_t * d2_k_x + sin_t * sin_t * d2_k_y + 2.0 * cos_t * sin_t * d2_k_xy;
    let d2_k_perp = sin_t * sin_t * d2_k_x + cos_t * cos_t * d2_k_y - 2.0 * cos_t * sin_t * d2_k_xy;
    let lap_k_aniso = d2_k_fiber * effective_aniso + d2_k_perp * (1.0 / effective_aniso);
    new_susp_k_rgb = max(susp_k.rgb + lap_k_aniso * mobility, vec3<f32>(0.0));

    // Anisotropic Diffusion for S
    let d2_s_x = (susp_s_R.rgb + susp_s_L.rgb - 2.0 * susp_s.rgb) * (aspect * aspect);
    let d2_s_y = (susp_s_T.rgb + susp_s_B.rgb - 2.0 * susp_s.rgb);
    let d2_s_xy = (susp_s_TR.rgb + susp_s_BL.rgb - susp_s_TL.rgb - susp_s_BR.rgb) * (0.25 * aspect);

    let d2_s_fiber = cos_t * cos_t * d2_s_x + sin_t * sin_t * d2_s_y + 2.0 * cos_t * sin_t * d2_s_xy;
    let d2_s_perp = sin_t * sin_t * d2_s_x + cos_t * cos_t * d2_s_y - 2.0 * cos_t * sin_t * d2_s_xy;
    let lap_s_aniso = d2_s_fiber * effective_aniso + d2_s_perp * (1.0 / effective_aniso);
    new_susp_s_rgb = max(susp_s.rgb + lap_s_aniso * mobility, vec3<f32>(0.0));
  }

  let saturation_state = clamp(h_cap / max(fiber_capacity, 0.001), 0.0, 1.0);

  textureStore(out_water, coord, vec4<f32>(h_surf, h_cap, 0.0, saturation_state));
  textureStore(out_pigment_susp_k, coord, vec4<f32>(new_susp_k_rgb, susp_k.a));
  textureStore(out_pigment_susp_s, coord, vec4<f32>(new_susp_s_rgb, susp_s.a));
}
