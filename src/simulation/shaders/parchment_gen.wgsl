// Procedural Handmade Washi Parchment Compute Generator
// Generates natural plant fibers, paper heightmap, capillary absorption capacity, granulation valleys, and orientation tensor field
// Parameterized for 5 authentic Japanese papers:
// 0: Sheng Xuan (生宣 - Raw Rice Paper)
// 1: Torinoko (鳥の子 - Sized Eggshell Washi)
// 2: Echizen Kouzo (生漉楮紙 - Rough Heavy Mulberry)
// 3: Ban-Juku Xuan (半熟宣 - Semi-Sized Classical Landscape Washi)
// 4: Mashi (生麻紙 - Wild Hemp Fiber Washi)

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var out_parchment: texture_storage_2d<rgba8unorm, write>;

// Permutation polynomial hash
fn hash22(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D Value Noise with smooth Hermite interpolation
fn value_noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash12(i + vec2<f32>(0.0, 0.0));
  let b = hash12(i + vec2<f32>(1.0, 0.0));
  let c = hash12(i + vec2<f32>(0.0, 1.0));
  let d = hash12(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion for paper organic surface variation
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2<f32>(100.0, 100.0);
  var pos = p;
  
  let rot = mat2x2<f32>(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  
  for (var i = 0; i < octaves; i = i + 1) {
    v = v + a * value_noise(pos);
    pos = rot * pos * 2.02 + shift;
    a = a * 0.5;
  }
  return v;
}

// Long interwoven plant fibers (Kozo, Gampi, Hemp)
fn washi_fiber(p: vec2<f32>, seed: f32, stretch: f32) -> f32 {
  var fiber = 0.0;
  let angle = (hash12(floor(p * 0.08) + seed) - 0.5) * 3.14159;
  let dir = vec2<f32>(cos(angle), sin(angle));
  
  let uv_fiber = vec2<f32>(
    dot(p, dir) * 0.12,
    dot(p, vec2<f32>(-dir.y, dir.x)) * stretch
  );
  
  let f = abs(value_noise(uv_fiber + seed * 17.1) - 0.5) * 2.0;
  fiber = 1.0 - smoothstep(0.0, 0.18, f);
  return fiber;
}

// Cross-hatched hemp fiber mesh for Mashi
fn hemp_mesh(p: vec2<f32>, scale: f32) -> f32 {
  let p_sc = p * scale;
  let warp = sin(p_sc.x * 0.8 + value_noise(p_sc * 0.2) * 2.5);
  let weft = sin(p_sc.y * 0.8 + value_noise(p_sc * 0.2 + 33.1) * 2.5);
  return (warp * warp * 0.5 + weft * weft * 0.5);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = textureDimensions(out_parchment);
  if (global_id.x >= dims.x || global_id.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(global_id.x), f32(global_id.y));
  let paper_type = uniforms.paper_type;

  var heightmap: f32 = 0.5;
  var capillary_density: f32 = 0.5;
  var granulation: f32 = 0.5;
  var fiber_angle_norm: f32 = 0.5;

  if (paper_type == 0u) {
    // === 0. UNRYU-SHI (雲竜紙 - Cloud Dragon Mulberry) ===
    // Long floating Kozo bast fibers that create dramatic capillary bleeding channels
    let base_height = fbm(pos * 0.035, 4);
    let fine_grain = fbm(pos * 0.2, 3);
    heightmap = clamp(base_height * 0.5 + fine_grain * 0.5, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.25, 1.2, 3.8); // Long floating bast fiber
    let fiber2 = washi_fiber(pos * 0.45, 4.3, 2.9);
    let fiber3 = washi_fiber(pos * 0.75, 8.1, 4.2);
    let total_fibers = clamp(fiber1 * 0.65 + fiber2 * 0.4 + fiber3 * 0.3, 0.0, 1.0);

    capillary_density = clamp(0.68 + heightmap * 0.2 + total_fibers * 0.5, 0.0, 1.0);
    granulation = clamp(0.3 + total_fibers * 0.35, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.007 + 14.1, 3) - 0.5) * 3.14159 * 1.8;
    let local_curl = (value_noise(pos * 0.05 + 31.4) - 0.5) * 0.9;
    let fiber_angle = stream_angle + local_curl;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 1u) {
    // === 1. TORINOKO (鳥の子 - Sized Eggshell Washi) ===
    // Alum-sized Gampi (Dousa), dense smooth weave, crisp stroke perimeters
    let base_height = fbm(pos * 0.02, 3);
    let micro_grain = fbm(pos * 0.35, 2);
    heightmap = clamp(0.5 + (base_height - 0.5) * 0.25 + (micro_grain - 0.5) * 0.18, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.2, 2.0, 1.2);
    let total_fibers = clamp(fiber1 * 0.2, 0.0, 1.0);

    capillary_density = clamp(0.18 + heightmap * 0.12 + total_fibers * 0.1, 0.0, 1.0);
    granulation = 0.12;

    let stream_angle = (fbm(pos * 0.012 + 7.8, 2) - 0.5) * 1.2;
    fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 2u) {
    // === 2. ECHIZEN KOUZO (生漉楮 - Rough Heavy Mulberry) ===
    // Deep structural relief, thick interwoven pulp, extreme granulation tooth in valleys
    let macro_height = fbm(pos * 0.025, 5);
    let coarse_grain = fbm(pos * 0.12, 4);
    heightmap = clamp(macro_height * 0.7 + coarse_grain * 0.45, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.3, 1.2, 3.0);
    let fiber2 = washi_fiber(pos * 0.5, 4.4, 2.8);
    let fiber3 = washi_fiber(pos * 0.7, 7.8, 3.5);
    let total_fibers = clamp(fiber1 * 0.55 + fiber2 * 0.45 + fiber3 * 0.35, 0.0, 1.0);

    capillary_density = clamp(0.42 + heightmap * 0.35 + total_fibers * 0.45, 0.0, 1.0);
    granulation = clamp(pow(1.0 - heightmap, 1.3) * 1.6 + total_fibers * 0.35, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.006 + 88.1, 4) - 0.5) * 3.14159 * 2.0;
    let coarse_curl = (value_noise(pos * 0.04 + 19.3) - 0.5) * 1.2;
    let fiber_angle = stream_angle + coarse_curl;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 3u) {
    // === 3. KIN-SUNAGO (金砂子 - Gold-Leaf Dusted Washi) ===
    // Handmade washi embedded with glittering 24k gold foil flakes
    let base_height = fbm(pos * 0.03, 4);
    let medium_grain = fbm(pos * 0.18, 3);
    heightmap = clamp(base_height * 0.5 + medium_grain * 0.35, 0.0, 1.0);

    let gold_flake_noise = hash12(floor(pos * 0.09) + 42.1);
    let gold_presence = select(0.0, 0.8, gold_flake_noise > 0.88);

    capillary_density = clamp(0.38 + heightmap * 0.2, 0.0, 1.0);
    granulation = clamp(0.3 + gold_presence * 0.4, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.009 + 41.2, 3) - 0.5) * 3.14159 * 1.3;
    fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 4u) {
    // === 4. AIZOME-SHI (藍染紙 - Midnight Indigo Washi) ===
    // Fermented indigo botanical ground, smooth fiber lattice
    let macro_height = fbm(pos * 0.022, 4);
    let fine_grain = fbm(pos * 0.15, 3);
    heightmap = clamp(macro_height * 0.48 + fine_grain * 0.32, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.3, 3.4, 2.2);
    capillary_density = clamp(0.35 + heightmap * 0.25 + fiber1 * 0.2, 0.0, 1.0);
    granulation = clamp(0.25 + fiber1 * 0.2, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.01 + 61.2, 3) - 0.5) * 3.14159;
    fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else {
    // === 5. KOBISHI (古美紙 - Antique Edo Tea-Patina Washi) ===
    // Aged organic washi with tea tannin patina and gentle vintage absorption
    let macro_height = fbm(pos * 0.02, 4);
    let vintage_tooth = fbm(pos * 0.16, 3);
    heightmap = clamp(macro_height * 0.52 + vintage_tooth * 0.42, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.22, 5.1, 2.6);
    let fiber2 = washi_fiber(pos * 0.52, 8.3, 3.1);
    let total_fibers = clamp(fiber1 * 0.5 + fiber2 * 0.35, 0.0, 1.0);

    capillary_density = clamp(0.55 + heightmap * 0.25 + total_fibers * 0.35, 0.0, 1.0);
    granulation = clamp(0.42 + total_fibers * 0.28, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.008 + 23.9, 3) - 0.5) * 3.14159 * 1.4;
    fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);
  }

  // Pack into 4-channel texture:
  // R: Heightmap / Tooth (0..1)
  // G: Capillary absorption capacity (0..1)
  // B: Granulation valley depth (0..1)
  // A: Anisotropic fiber angle field theta in [0..1] mapped from [-PI..PI]
  let out_val = vec4<f32>(heightmap, capillary_density, granulation, fiber_angle_norm);
  textureStore(out_parchment, vec2<i32>(global_id.xy), out_val);
}
