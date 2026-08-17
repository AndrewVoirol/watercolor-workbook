// Procedural Handmade Washi Parchment Compute Generator
// Generates authentic Japanese plant bast fibers (Kozo, Gampi, Hemp), Sukime screen chain lines,
// Chiri bark inclusions, microscopic tooth heightmap, capillary absorption capacity, granulation valleys, and orientation tensor field
// Parameterized for 6 master Japanese papers:
// 0: Unryū-shi (雲竜紙 - Cloud Dragon Mulberry)
// 1: Torinoko (鳥の子 - Sized Eggshell Washi)
// 2: Echizen Kōzo (生漉楮紙 - Rough Heavy Mulberry)
// 3: Kin-sunago (金砂子 - 24k Gold-Leaf Dusted Washi)
// 4: Aizome-shi (藍染紙 - Midnight Indigo Washi)
// 5: Kobishi (古美紙 - Antique Edo Tea-Patina Washi)

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

// High-Fidelity Sinuous Kozo/Gampi Bast Fiber Generator
fn washi_sinuous_fiber(pos: vec2<f32>, stream_angle: f32, seed: f32, length_scale: f32, width: f32) -> f32 {
  let c = cos(stream_angle);
  let s = sin(stream_angle);
  let rot_pos = vec2<f32>(pos.x * c + pos.y * s, -pos.x * s + pos.y * c);

  // Sinuous transverse undulation via coupled harmonics
  let curl = sin(rot_pos.x * 0.04 + seed * 17.3) * 12.0 + 
             sin(rot_pos.x * 0.12 + seed * 31.7) * 4.5;
  let dist_to_spine = abs(rot_pos.y * length_scale + curl);
  
  let fiber_core = 1.0 - smoothstep(0.0, width, dist_to_spine);
  let longitudinal_mod = value_noise(vec2<f32>(rot_pos.x * 0.08, seed * 19.1));
  return fiber_core * smoothstep(0.15, 0.85, longitudinal_mod);
}

// Sukime (Reed-Screen Bamboo Sieve Lines)
fn sukime_screen_mesh(pos: vec2<f32>) -> f32 {
  let chain_wire = pow(cos(pos.x * 0.08) * 0.5 + 0.5, 6.0) * 0.12;
  let reed_lines = (sin(pos.y * 0.45) * 0.5 + 0.5) * 0.06;
  return chain_wire + reed_lines;
}

// Chiri Bark Specks (Unrefined Mulberry Inclusions)
fn chiri_bark_speck(pos: vec2<f32>, seed: f32) -> f32 {
  let grid_p = pos * 0.06;
  let cell_id = floor(grid_p);
  let cell_uv = fract(grid_p);
  let prob = hash12(cell_id + vec2<f32>(seed * 13.7, seed * 29.3));
  if (prob > 0.982) {
    let center = hash22(cell_id + 5.7);
    let d = length((cell_uv - center) * vec2<f32>(1.4, 0.7));
    return (1.0 - smoothstep(0.0, 0.28, d)) * (prob - 0.982) * 45.0;
  }
  return 0.0;
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

  let stream_angle = (fbm(pos * 0.008 + 14.1, 3) - 0.5) * 3.14159 * 1.6;
  fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  if (paper_type == 0u) {
    // === 0. UNRYŪ-SHI (雲竜紙 - Cloud Dragon Mulberry) ===
    // Long floating Kozo bast fibers that create dramatic capillary bleeding channels (Hige-nijimi)
    let macro_pulp = fbm(pos * 0.03, 4);
    let fine_grain = fbm(pos * 0.18, 3);
    
    let fiber1 = washi_sinuous_fiber(pos, stream_angle, 1.2, 0.45, 1.8);
    let fiber2 = washi_sinuous_fiber(pos, stream_angle + 0.3, 4.7, 0.75, 1.2);
    let fiber3 = washi_sinuous_fiber(pos, stream_angle - 0.2, 9.1, 1.10, 0.9);
    let total_fibers = clamp(fiber1 * 0.65 + fiber2 * 0.45 + fiber3 * 0.30, 0.0, 1.0);
    let sukime = sukime_screen_mesh(pos);

    heightmap = clamp(macro_pulp * 0.45 + fine_grain * 0.35 + total_fibers * 0.20 + sukime * 0.5, 0.0, 1.0);
    capillary_density = clamp(0.65 + macro_pulp * 0.20 + total_fibers * 0.55, 0.0, 1.0);
    granulation = clamp(0.25 + total_fibers * 0.30 + (1.0 - heightmap) * 0.25, 0.0, 1.0);

  } else if (paper_type == 1u) {
    // === 1. TORINOKO (鳥の子 - Sized Eggshell Washi) ===
    // Alum-gelatin Dōsa sized Gampi, dense smooth weave, crisp razor stroke perimeters
    let base_height = fbm(pos * 0.02, 3);
    let micro_grain = fbm(pos * 0.35, 2);
    heightmap = clamp(0.5 + (base_height - 0.5) * 0.25 + (micro_grain - 0.5) * 0.15, 0.0, 1.0);

    let fiber1 = washi_sinuous_fiber(pos, stream_angle, 2.0, 0.8, 0.8);
    let total_fibers = fiber1 * 0.15;

    capillary_density = clamp(0.18 + heightmap * 0.12 + total_fibers * 0.1, 0.0, 1.0);
    granulation = 0.12;

  } else if (paper_type == 2u) {
    // === 2. ECHIZEN KŌZO (生漉楮 - Rough Heavy Mulberry) ===
    // Deep structural relief, thick interwoven pulp, natural chiri bark inclusions, extreme valley granulation
    let macro_height = fbm(pos * 0.022, 5);
    let coarse_grain = fbm(pos * 0.11, 4);
    
    let fiber1 = washi_sinuous_fiber(pos, stream_angle, 1.5, 0.35, 2.4);
    let fiber2 = washi_sinuous_fiber(pos, stream_angle + 0.4, 6.2, 0.65, 1.8);
    let fiber3 = washi_sinuous_fiber(pos, stream_angle - 0.3, 11.8, 0.95, 1.4);
    let total_fibers = clamp(fiber1 * 0.6 + fiber2 * 0.45 + fiber3 * 0.35, 0.0, 1.0);
    let chiri = chiri_bark_speck(pos, 3.14);

    heightmap = clamp(macro_height * 0.55 + coarse_grain * 0.35 + total_fibers * 0.25 + chiri * 0.6, 0.0, 1.0);
    capillary_density = clamp(0.40 + macro_height * 0.30 + total_fibers * 0.45, 0.0, 1.0);
    granulation = clamp(pow(1.0 - heightmap, 1.4) * 1.75 + total_fibers * 0.40, 0.0, 1.0);

  } else if (paper_type == 3u) {
    // === 3. KIN-SUNAGO (金砂子 - 24k Gold-Leaf Dusted Washi) ===
    // Handmade washi embedded with glittering 24k gold foil flakes
    let base_height = fbm(pos * 0.028, 4);
    let medium_grain = fbm(pos * 0.16, 3);
    heightmap = clamp(base_height * 0.50 + medium_grain * 0.35, 0.0, 1.0);

    let gold_flake_noise = hash12(floor(pos * 0.08) + 42.1);
    let gold_presence = select(0.0, 0.85, gold_flake_noise > 0.88);

    capillary_density = clamp(0.38 + heightmap * 0.20, 0.0, 1.0);
    granulation = clamp(0.28 + gold_presence * 0.45, 0.0, 1.0);

  } else if (paper_type == 4u) {
    // === 4. AIZOME-SHI (藍染紙 - Midnight Indigo Washi) ===
    // Fermented indigo botanical ground, smooth fiber lattice
    let macro_height = fbm(pos * 0.022, 4);
    let fine_grain = fbm(pos * 0.15, 3);
    heightmap = clamp(macro_height * 0.48 + fine_grain * 0.32, 0.0, 1.0);

    let fiber1 = washi_sinuous_fiber(pos, stream_angle, 3.4, 0.6, 1.4);
    capillary_density = clamp(0.35 + heightmap * 0.25 + fiber1 * 0.25, 0.0, 1.0);
    granulation = clamp(0.25 + fiber1 * 0.20, 0.0, 1.0);

  } else {
    // === 5. KOBISHI (古美紙 - Antique Edo Tea-Patina Washi) ===
    // Aged organic washi with tea tannin patina and mellow vintage absorption
    let macro_height = fbm(pos * 0.02, 4);
    let vintage_tooth = fbm(pos * 0.15, 3);
    
    let fiber1 = washi_sinuous_fiber(pos, stream_angle, 5.1, 0.5, 1.6);
    let fiber2 = washi_sinuous_fiber(pos, stream_angle + 0.25, 8.3, 0.8, 1.2);
    let total_fibers = clamp(fiber1 * 0.50 + fiber2 * 0.35, 0.0, 1.0);

    heightmap = clamp(macro_height * 0.52 + vintage_tooth * 0.38 + total_fibers * 0.20, 0.0, 1.0);
    capillary_density = clamp(0.55 + heightmap * 0.25 + total_fibers * 0.35, 0.0, 1.0);
    granulation = clamp(0.42 + total_fibers * 0.28, 0.0, 1.0);
  }

  // Pack into 4-channel texture:
  // R: Heightmap / Tooth (0..1)
  // G: Capillary absorption capacity (0..1)
  // B: Granulation valley depth (0..1)
  // A: Anisotropic fiber angle field theta in [0..1] mapped from [-PI..PI]
  let out_val = vec4<f32>(heightmap, capillary_density, granulation, fiber_angle_norm);
  textureStore(out_parchment, vec2<i32>(global_id.xy), out_val);
}
