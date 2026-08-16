// Evaporation, Coffee-Ring Edge Pinning, Continuous Stokes Granulation, Salt Halo & Zen Impermanence Lifecycle
// Simulates 2-layer water evaporation, continuous Stokes settling in paper valleys,
// contact-line coffee-ring convective transfer, salt starburst halo crystallization, and sublime fading.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(4) var out_pigment_susp: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_pigment_pinned: texture_2d<f32>;
@group(0) @binding(6) var out_pigment_pinned: texture_storage_2d<rgba16float, write>;

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

  let dt = uniforms.dt;
  let parchment = textureLoad(in_parchment, coord, 0);
  let paper_fiber = parchment.g;
  let granulation_tooth = parchment.b;

  var water = textureLoad(in_water, coord, 0);
  var susp = textureLoad(in_pigment_susp, coord, 0);
  var pinned = textureLoad(in_pigment_pinned, coord, 0);

  // water.r = surface height (h_surf)
  // water.g = capillary height (h_cap)
  // water.b = salt crystal density (S_salt)
  // water.a = saturation state

  // --- 1. Evaporation Dynamics ---
  if (uniforms.spring_rain_active == 1u) {
    let dissolve_rate = clamp(2.2 * dt, 0.0, 1.0);
    let dissolved = pinned * dissolve_rate;
    pinned = pinned - dissolved;
    susp = susp + dissolved;

    water.r = max(water.r * 0.90 - 0.03 * dt, 0.0);
    water.g = max(water.g * 0.90 - 0.03 * dt, 0.0);
    water.b = max(water.b * 0.80 - 0.12 * dt, 0.0);
    susp = susp * max(1.0 - 0.85 * dt, 0.0);
  } else {
    // Surface water evaporates faster than capillary water in fibers
    let evap_surf = uniforms.evaporation_rate * (1.0 + (1.0 - paper_fiber) * 0.35) * dt * 1.5;
    let evap_cap = uniforms.evaporation_rate * 0.30 * dt;

    water.r = max(water.r - evap_surf, 0.0);
    water.g = max(water.g - evap_cap, 0.0);
    water.a = clamp(water.g / 0.8, 0.0, 1.0);
  }

  let total_water = water.r + water.g * 0.5;

  // --- 2. Critical Height Desiccation & Complete Pinning ---
  if (total_water < 0.001) {
    pinned = pinned + susp;
    susp = vec4<f32>(0.0);
    water.r = 0.0;
    water.g = 0.0;
    water.a = 0.0;
  } else {
    // --- 3. Continuous Stokes Sedimentation / Granulation in Paper Valleys ---
    // Heavy mineral pigments (Oudo clay, Rokusho malachite, Shu cinnabar) settle continuously into valleys
    let gran_mult = granulation_tooth * uniforms.granulation_rate;
    if (gran_mult > 0.02) {
      let stokes_sumi = 0.05;  // Colloidal carbon soot barely settles
      let stokes_shu  = 0.45;  // Cinnabar is dense mineral
      let stokes_ai   = 0.15;  // Indigo is organic
      let stokes_oudo = 0.75;  // Yellow ochre granulates heavily

      let settle_rates = vec4<f32>(stokes_sumi, stokes_shu, stokes_ai, stokes_oudo) * gran_mult * 2.8 * dt;
      let settled = min(susp, susp * settle_rates);
      pinned = pinned + settled;
      susp = susp - settled;
    }

    // --- 4. Coffee-Ring Outward Convective Edge Pinning ---
    let water_L = textureLoad(in_water, L, 0);
    let water_R = textureLoad(in_water, R, 0);
    let water_B = textureLoad(in_water, B, 0);
    let water_T = textureLoad(in_water, T, 0);

    let grad_water = vec2<f32>(water_R.r - water_L.r, water_T.r - water_B.r) * 0.5;
    let grad_mag = length(grad_water);

    if (water.r > 0.001 && water.r < 0.09 && grad_mag > 0.008) {
      let ring_boost = clamp(grad_mag * uniforms.coffee_ring_flux * dt * 3.0, 0.0, 0.55);
      let edge_deposition = susp * (ring_boost * (1.0 + paper_fiber * 0.5));
      let transferred = min(susp, edge_deposition);
      
      pinned = pinned + transferred;
      susp = susp - transferred;
    }

    // --- 5. Salt Starburst Perimeter Halo Pinning ---
    let grad_salt = vec2<f32>(water_R.b - water_L.b, water_T.b - water_B.b) * 0.5;
    let salt_edge = length(grad_salt);
    if (salt_edge > 0.02 && water.b > 0.01) {
      let salt_halo_pin = clamp(salt_edge * 4.5 * uniforms.salt_intensity * dt, 0.0, 0.65);
      let halo_transfer = min(susp, susp * salt_halo_pin);
      pinned = pinned + halo_transfer;
      susp = susp - halo_transfer;
    }

    // --- 6. Dryness Tooth Pinning at Low Water Volume ---
    let pin_thresh = uniforms.pinning_threshold;
    if (total_water < pin_thresh) {
      let dryness = 1.0 - (total_water / max(pin_thresh, 0.001));
      let pin_rate = clamp(dryness * dryness * (0.85 + gran_mult * 0.65) * 15.0 * dt, 0.0, 1.0);

      let transfer = min(susp, susp * pin_rate);
      pinned = pinned + transfer;
      susp = susp - transfer;
    }
  }

  // --- 7. Zen Impermanence Sublime Fading ---
  if (uniforms.breathe_active == 0u && uniforms.spring_rain_active == 0u) {
    let fade_factor = exp(-uniforms.zen_fade_rate * dt);
    pinned = pinned * fade_factor;
    susp = susp * fade_factor;
    water.b = water.b * fade_factor;
    
    if (pinned.r < 0.0004) { pinned.r = 0.0; }
    if (pinned.g < 0.0004) { pinned.g = 0.0; }
    if (pinned.b < 0.0004) { pinned.b = 0.0; }
    if (pinned.a < 0.0004) { pinned.a = 0.0; }
  }

  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp, coord, susp);
  textureStore(out_pigment_pinned, coord, pinned);
}
