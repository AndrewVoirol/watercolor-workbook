// Evaporation, Coffee-Ring Edge Pinning, Continuous Stokes Granulation, Salt Halo & Zen Impermanence Lifecycle
// Simulates 2-layer water evaporation, differential Stokes settling in paper valleys,
// contact-line coffee-ring convective transfer, salt starburst halo crystallization, and sublime fading.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(3) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(4) var out_pigment_susp_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(6) var out_pigment_susp_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(7) var in_pigment_pinned_k: texture_2d<f32>;
@group(0) @binding(8) var out_pigment_pinned_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(9) var in_pigment_pinned_s: texture_2d<f32>;
@group(0) @binding(10) var out_pigment_pinned_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(11) var in_parchment: texture_2d<f32>;

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
  var susp_k = textureLoad(in_pigment_susp_k, coord, 0);
  var susp_s = textureLoad(in_pigment_susp_s, coord, 0);
  var pinned_k = textureLoad(in_pigment_pinned_k, coord, 0);
  var pinned_s = textureLoad(in_pigment_pinned_s, coord, 0);

  let water_L = textureLoad(in_water, L, 0);
  let water_R = textureLoad(in_water, R, 0);
  let water_B = textureLoad(in_water, B, 0);
  let water_T = textureLoad(in_water, T, 0);

  let grad_water = vec2<f32>(water_R.r - water_L.r, water_T.r - water_B.r) * 0.5;
  let grad_mag = length(grad_water);

  // --- 1. Evaporation & Spring Rain Dynamics ---
  if (uniforms.spring_rain_active == 1u) {
    let rain_fade = max(1.0 - 6.5 * dt, 0.0);
    pinned_k = vec4<f32>(pinned_k.rgb * rain_fade, pinned_k.a * rain_fade);
    pinned_s = vec4<f32>(pinned_s.rgb * rain_fade, pinned_s.a * rain_fade);
    susp_k = vec4<f32>(susp_k.rgb * rain_fade, susp_k.a * rain_fade);
    susp_s = vec4<f32>(susp_s.rgb * rain_fade, susp_s.a * rain_fade);
    water = vec4<f32>(water.r * rain_fade, water.g * rain_fade, water.b * rain_fade, water.a * rain_fade);
  } else {
    // Physical perimeter-accelerated evaporation at contact line (1 / sqrt(R - r))
    let evap_contact_boost = 1.0 + grad_mag * 3.5;
    let evap_surf = uniforms.evaporation_rate * (1.0 + (1.0 - paper_fiber) * 0.35) * evap_contact_boost * dt * 1.5;
    let evap_cap = uniforms.evaporation_rate * 0.30 * dt;

    water.r = max(water.r - evap_surf, 0.0);
    water.g = max(water.g - evap_cap, 0.0);
    water.a = clamp(water.g / 0.8, 0.0, 1.0);
  }

  let total_water = water.r + water.g * 0.5;

  // --- 2. Critical Height Desiccation & Complete Pinning ---
  if (total_water < 0.001) {
    pinned_k = vec4<f32>(pinned_k.rgb + susp_k.rgb, pinned_k.a);
    pinned_s = vec4<f32>(pinned_s.rgb + susp_s.rgb, pinned_s.a);
    susp_k = vec4<f32>(0.0);
    susp_s = vec4<f32>(0.0);
    water.r = 0.0;
    water.g = 0.0;
    water.a = 0.0;
  } else {
    // --- 3. Continuous Stokes Sedimentation / Chromatographic Granulation in Paper Valleys ---
    let coarse_ratio = susp_k.a;
    let settle_rate_prop = susp_s.a;
    let gran_mult = granulation_tooth * uniforms.granulation_rate * uniforms.stokes_settling_rate;

    if (gran_mult > 0.006) {
      // Dense mineral particles settle rapidly; remaining fluid skews toward mobile dye
      let stokes_flux = gran_mult * (0.15 + coarse_ratio * 1.85) * settle_rate_prop * 3.6 * dt;
      let settled_k = min(susp_k.rgb, susp_k.rgb * stokes_flux);
      let settled_s = min(susp_s.rgb, susp_s.rgb * stokes_flux);

      pinned_k = vec4<f32>(pinned_k.rgb + settled_k, max(pinned_k.a, select(0.0, 1.0, coarse_ratio > 0.8)));
      pinned_s = vec4<f32>(pinned_s.rgb + settled_s, min(pinned_s.a + stokes_flux * 0.5, 1.0));
      susp_k = vec4<f32>(max(susp_k.rgb - settled_k, vec3<f32>(0.0)), max(susp_k.a - stokes_flux * 0.45, 0.02));
      susp_s = vec4<f32>(max(susp_s.rgb - settled_s, vec3<f32>(0.0)), susp_s.a);
    }

    // --- 4. Coffee-Ring Outward Convective Edge Pinning (Fuchidori 縁取り) ---
    if (water.r > 0.001 && water.r < 0.12 && grad_mag > 0.006) {
      let ring_boost = clamp(grad_mag * uniforms.coffee_ring_flux * dt * 3.8, 0.0, 0.70);
      let edge_k = susp_k.rgb * (ring_boost * (1.0 + paper_fiber * 0.5));
      let edge_s = susp_s.rgb * (ring_boost * (1.0 + paper_fiber * 0.5));
      let transfer_k = min(susp_k.rgb, edge_k);
      let transfer_s = min(susp_s.rgb, edge_s);
      
      pinned_k = vec4<f32>(pinned_k.rgb + transfer_k, pinned_k.a);
      pinned_s = vec4<f32>(pinned_s.rgb + transfer_s, pinned_s.a);
      susp_k = vec4<f32>(susp_k.rgb - transfer_k, susp_k.a);
      susp_s = vec4<f32>(susp_s.rgb - transfer_s, susp_s.a);
    }

    // --- 5. Salt Starburst Perimeter Halo Pinning ---
    let grad_salt = vec2<f32>(water_R.b - water_L.b, water_T.b - water_B.b) * 0.5;
    let salt_edge = length(grad_salt);
    if (salt_edge > 0.02 && water.b > 0.01) {
      let salt_halo_pin = clamp(salt_edge * 4.5 * uniforms.salt_intensity * dt, 0.0, 0.65);
      let halo_transfer_k = min(susp_k.rgb, susp_k.rgb * salt_halo_pin);
      let halo_transfer_s = min(susp_s.rgb, susp_s.rgb * salt_halo_pin);
      pinned_k = vec4<f32>(pinned_k.rgb + halo_transfer_k, pinned_k.a);
      pinned_s = vec4<f32>(pinned_s.rgb + halo_transfer_s, pinned_s.a);
      susp_k = vec4<f32>(susp_k.rgb - halo_transfer_k, susp_k.a);
      susp_s = vec4<f32>(susp_s.rgb - halo_transfer_s, susp_s.a);
    }

    // --- 6. Dryness Tooth Pinning at Low Water Volume ---
    let pin_thresh = uniforms.pinning_threshold;
    if (total_water < pin_thresh) {
      let dryness = 1.0 - (total_water / max(pin_thresh, 0.001));
      let pin_rate = clamp(dryness * dryness * (0.85 + gran_mult * 0.65) * 15.0 * dt, 0.0, 1.0);

      let transfer_k = min(susp_k.rgb, susp_k.rgb * pin_rate);
      let transfer_s = min(susp_s.rgb, susp_s.rgb * pin_rate);
      pinned_k = vec4<f32>(pinned_k.rgb + transfer_k, pinned_k.a);
      pinned_s = vec4<f32>(pinned_s.rgb + transfer_s, pinned_s.a);
      susp_k = vec4<f32>(susp_k.rgb - transfer_k, susp_k.a);
      susp_s = vec4<f32>(susp_s.rgb - transfer_s, susp_s.a);
    }
  }

  // --- 7. Zen Impermanence Sublime Fading ---
  if (uniforms.breathe_active == 0u && uniforms.spring_rain_active == 0u) {
    let fade_factor = exp(-uniforms.zen_fade_rate * dt);
    pinned_k = vec4<f32>(pinned_k.rgb * fade_factor, pinned_k.a * fade_factor);
    pinned_s = vec4<f32>(pinned_s.rgb * fade_factor, pinned_s.a * fade_factor);
    susp_k = vec4<f32>(susp_k.rgb * fade_factor, susp_k.a);
    susp_s = vec4<f32>(susp_s.rgb * fade_factor, susp_s.a);
    water.b = water.b * fade_factor;
    
    if (length(pinned_k.rgb) < 0.0004) { pinned_k = vec4<f32>(0.0); }
    if (length(pinned_s.rgb) < 0.0004) { pinned_s = vec4<f32>(0.0); }
  }

  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp_k, coord, susp_k);
  textureStore(out_pigment_susp_s, coord, susp_s);
  textureStore(out_pigment_pinned_k, coord, pinned_k);
  textureStore(out_pigment_pinned_s, coord, pinned_s);
}
