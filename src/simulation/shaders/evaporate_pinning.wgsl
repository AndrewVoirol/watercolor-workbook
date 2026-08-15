// Evaporation, Coffee-Ring Edge Pinning & Zen Impermanence Lifecycle
// Simulates drying, outward capillary mass transfer (coffee ring), pigment fiber deposition, and sublime fading.

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
  let granulation = parchment.b;

  var water = textureLoad(in_water, coord, 0);
  var susp = textureLoad(in_pigment_susp, coord, 0);
  var pinned = textureLoad(in_pigment_pinned, coord, 0);

  // water.r = surface height, water.g = Rokusho susp, water.b = Rokusho pinned, water.a = fiber moisture

  // 1. Evaporation Dynamics
  if (uniforms.spring_rain_active == 1u) {
    // Spring Rain wash effect: dissolves pinned ink back into water, washes canvas
    let dissolve_rate = 1.8 * dt;
    susp = susp + pinned * dissolve_rate;
    pinned = pinned * max(1.0 - dissolve_rate, 0.0);
    
    // Dissolve Rokusho
    water.g = water.g + water.b * dissolve_rate;
    water.b = water.b * max(1.0 - dissolve_rate, 0.0);

    water.r = max(water.r * 0.92 - 0.02 * dt, 0.0);
    susp = susp * max(1.0 - 0.8 * dt, 0.0);
    water.g = water.g * max(1.0 - 0.8 * dt, 0.0);
  } else {
    // Ambient evaporation rate modulated by fiber structure
    let evap = uniforms.evaporation_rate * (1.0 + (1.0 - paper_fiber) * 0.5) * dt;
    water.r = max(water.r - evap, 0.0);
    water.a = max(water.a - evap * 0.35, 0.0);
  }

  // 2. Coffee-Ring Outward Convective Mass Transfer
  let water_L = textureLoad(in_water, L, 0).r;
  let water_R = textureLoad(in_water, R, 0).r;
  let water_B = textureLoad(in_water, B, 0).r;
  let water_T = textureLoad(in_water, T, 0).r;

  let grad_water = vec2<f32>(water_R - water_L, water_T - water_B) * 0.5;
  let grad_mag = length(grad_water);

  if (grad_mag > 0.01 && water.r > 0.01) {
    let ring_boost = clamp(grad_mag * uniforms.coffee_ring_flux * dt * 2.0, 0.0, 0.25);
    let edge_deposition = susp * ring_boost * (1.0 + paper_fiber * 0.5);
    let edge_rokusho = water.g * ring_boost * (1.0 + paper_fiber * 0.5);
    
    pinned = pinned + edge_deposition;
    susp = max(susp - edge_deposition, vec4<f32>(0.0));

    water.b = water.b + edge_rokusho;
    water.g = max(water.g - edge_rokusho, 0.0);
  }

  // 3. Fiber Pinning (Transition from suspended to pinned as liquid thins)
  let pin_thresh = uniforms.pinning_threshold;
  if (water.r < pin_thresh) {
    let dryness = 1.0 - (water.r / max(pin_thresh, 0.001));
    let pin_rate = clamp(dryness * dryness * (0.85 + granulation * 0.35) * 12.0 * dt, 0.0, 1.0);

    let transfer = susp * pin_rate;
    let transfer_rokusho = water.g * pin_rate;

    pinned = pinned + transfer;
    susp = max(susp - transfer, vec4<f32>(0.0));

    water.b = water.b + transfer_rokusho;
    water.g = max(water.g - transfer_rokusho, 0.0);
  }

  // 4. Zen Impermanence Sublime Fading
  if (uniforms.breathe_active == 0u && uniforms.spring_rain_active == 0u) {
    let fade_factor = exp(-uniforms.zen_fade_rate * dt);
    pinned = pinned * fade_factor;
    susp = susp * fade_factor;
    water.g = water.g * fade_factor;
    water.b = water.b * fade_factor;
    
    if (pinned.r < 0.001) { pinned.r = 0.0; }
    if (pinned.g < 0.001) { pinned.g = 0.0; }
    if (pinned.b < 0.001) { pinned.b = 0.0; }
    if (pinned.a < 0.001) { pinned.a = 0.0; }
    if (water.b < 0.001) { water.b = 0.0; }
  }

  // Store output
  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp, coord, susp);
  textureStore(out_pigment_pinned, coord, pinned);
}
