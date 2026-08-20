// Evaporation, Coffee-Ring Edge Pinning, Continuous Stokes Granulation & Zen Impermanence Lifecycle
// Simulates 2-layer water evaporation, differential Stokes settling in paper valleys,
// contact-line coffee-ring convective transfer, and sublime zen fading.

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

  // --- Clear Canvas / Reset ---
  if (uniforms.clear_canvas_active == 1u) {
    textureStore(out_water, coord, vec4<f32>(0.0));
    textureStore(out_pigment_susp_k, coord, vec4<f32>(0.0));
    textureStore(out_pigment_susp_s, coord, vec4<f32>(0.0));
    textureStore(out_pigment_pinned_k, coord, vec4<f32>(0.0));
    textureStore(out_pigment_pinned_s, coord, vec4<f32>(0.0));
    return;
  }

  let L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let B = vec2<i32>(coord.x, max(coord.y - 1, 0));
  let T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));

  let dt = uniforms.dt;
  let aspect = uniforms.aspect_ratio;
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

  // --- 1. Evaporation Dynamics ---
  // Physical contact-line singular evaporation: thin meniscus edges (water < 0.15) evaporate 4x faster than deep puddle centers
  let thin_film_boost = select(1.0, 1.0 + (0.15 - water.r) * 18.0, water.r > 0.0001 && water.r < 0.15);
  let evap_contact_boost = (1.0 + grad_mag * 4.5) * thin_film_boost;
  let brush_evap_damp = select(1.0, 0.15, uniforms.brush_active == 1u);
  let evap_surf = uniforms.evaporation_rate * (1.0 + (1.0 - paper_fiber) * 0.35) * evap_contact_boost * dt * 2.2 * brush_evap_damp;
  let evap_cap = uniforms.evaporation_rate * 0.30 * dt * brush_evap_damp;

  water.r = max(water.r - evap_surf, 0.0);
  water.g = max(water.g - evap_cap, 0.0);
  water.a = clamp(water.g / 0.8, 0.0, 1.0);

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
    let stroke_active_damp = select(1.0, 0.08, uniforms.brush_active == 1u);

    if (gran_mult > 0.006) {
      // Dense mineral particles settle into paper valleys; lighter dye continues wicking
      let stokes_flux = gran_mult * (0.15 + coarse_ratio * 1.85) * settle_rate_prop * 2.0 * dt * stroke_active_damp;
      let settled_k = min(susp_k.rgb, susp_k.rgb * stokes_flux);
      let settled_s = min(susp_s.rgb, susp_s.rgb * stokes_flux);

      pinned_k = vec4<f32>(pinned_k.rgb + settled_k, max(pinned_k.a, select(0.0, 1.0, coarse_ratio > 0.8)));
      pinned_s = vec4<f32>(pinned_s.rgb + settled_s, min(pinned_s.a + stokes_flux * 0.5, 1.0));
      susp_k = vec4<f32>(max(susp_k.rgb - settled_k, vec3<f32>(0.0)), max(susp_k.a - stokes_flux * 0.45, 0.02));
      susp_s = vec4<f32>(max(susp_s.rgb - settled_s, vec3<f32>(0.0)), susp_s.a);
    }

    // --- 4. Curtis 1997 Coffee-Ring Outward Convective Edge Pinning (Fuchidori 縁取り) ---
    // Strictly mass-conserving advection of suspended pigment to evaporating contact boundary
    let pin_active_damp = select(1.0, 0.25, uniforms.brush_active == 1u);
    if (water.r > 0.0005 && water.r < 0.25 && grad_mag > 0.001) {
      let ring_deposit_rate = clamp(grad_mag * uniforms.coffee_ring_flux * 4.0 * dt * pin_active_damp, 0.0, 0.35);
      let edge_transfer_k = min(susp_k.rgb, susp_k.rgb * ring_deposit_rate * (1.0 + paper_fiber * 0.3));
      let edge_transfer_s = min(susp_s.rgb, susp_s.rgb * ring_deposit_rate * (1.0 + paper_fiber * 0.3));

      pinned_k = vec4<f32>(pinned_k.rgb + edge_transfer_k, pinned_k.a);
      pinned_s = vec4<f32>(pinned_s.rgb + edge_transfer_s, pinned_s.a);
      susp_k = vec4<f32>(susp_k.rgb - edge_transfer_k, susp_k.a);
      susp_s = vec4<f32>(susp_s.rgb - edge_transfer_s, susp_s.a);
    }

    // --- 5. Dryness Tooth Pinning at Low Water Volume ---
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

  // --- 6. Zen Impermanence Sublime Organic Fading (Mujōkan 無常観) ---
  if (uniforms.zen_fade_rate > 0.00005 && uniforms.breathe_active == 0u) {
    let opt_len = length(pinned_k.rgb) + length(susp_k.rgb);
    if (opt_len > 0.0001) {
      // Strokes in active drawing motion are protected; dry thinned edges dissolve softly into fibers first
      let stroke_draw_guard = select(1.0, 0.05, uniforms.brush_active == 1u);
      let edge_dissolve = 1.0 + (1.0 - clamp(opt_len * 1.5, 0.0, 1.0)) * 1.35;
      let effective_fade = uniforms.zen_fade_rate * edge_dissolve * stroke_draw_guard;
      let fade_factor = exp(-effective_fade * dt);

      pinned_k = vec4<f32>(pinned_k.rgb * fade_factor, pinned_k.a);
      pinned_s = vec4<f32>(pinned_s.rgb * fade_factor, pinned_s.a);
      susp_k = vec4<f32>(susp_k.rgb * fade_factor, susp_k.a);
      susp_s = vec4<f32>(susp_s.rgb * fade_factor, susp_s.a);
      
      if (length(pinned_k.rgb) < 0.0002) { pinned_k = vec4<f32>(0.0); }
      if (length(pinned_s.rgb) < 0.0002) { pinned_s = vec4<f32>(0.0); }
    }
  }

  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp_k, coord, susp_k);
  textureStore(out_pigment_susp_s, coord, susp_s);
  textureStore(out_pigment_pinned_k, coord, pinned_k);
  textureStore(out_pigment_pinned_s, coord, pinned_s);
}
