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
    // =========================================================================
    // === 0. SHENG XUAN (生宣 - Raw Rice Paper) ===
    // =========================================================================
    // High porosity, long delicate mulberry/Qingtan fibers, rapid capillary bleeding, gentle surface tooth
    let base_height = fbm(pos * 0.04, 4);
    let fine_grain = fbm(pos * 0.22, 3);
    heightmap = clamp(base_height * 0.55 + fine_grain * 0.45, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.35, 1.0, 2.2);
    let fiber2 = washi_fiber(pos * 0.55, 3.1, 1.8);
    let fiber3 = washi_fiber(pos * 0.85, 5.7, 2.5);
    let total_fibers = clamp(fiber1 * 0.5 + fiber2 * 0.35 + fiber3 * 0.25, 0.0, 1.0);

    capillary_density = clamp(0.65 + heightmap * 0.2 + total_fibers * 0.45, 0.0, 1.0);
    granulation = clamp(0.25 + total_fibers * 0.25, 0.0, 1.0);

    // Dominant Kozo fiber directional current field guiding Hige-nijimi whiskers
    let stream_angle = (fbm(pos * 0.008 + 12.3, 3) - 0.5) * 3.14159 * 1.6;
    let local_curl = (value_noise(pos * 0.06 + 45.1) - 0.5) * 0.8;
    let fiber_angle = stream_angle + local_curl;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 1u) {
    // =========================================================================
    // === 1. TORINOKO (鳥の子 - Sized Eggshell Washi) ===
    // =========================================================================
    // Alum-gelatin sized surface (Dousa), dense Gampi weave, low porosity, smooth micro-tooth, crisp perimeters
    let base_height = fbm(pos * 0.02, 3);
    let micro_grain = fbm(pos * 0.35, 2);
    heightmap = clamp(0.5 + (base_height - 0.5) * 0.25 + (micro_grain - 0.5) * 0.18, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.2, 2.0, 1.2);
    let total_fibers = clamp(fiber1 * 0.2, 0.0, 1.0);

    capillary_density = clamp(0.18 + heightmap * 0.12 + total_fibers * 0.1, 0.0, 1.0);
    granulation = 0.12; // Minimal granulation on smooth sized surface

    let stream_angle = (fbm(pos * 0.012 + 7.8, 2) - 0.5) * 1.2;
    fiber_angle_norm = clamp((stream_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 2u) {
    // =========================================================================
    // === 2. ECHIZEN KOUZO (生漉楮紙 - Rough Heavy Cold-Press Mulberry) ===
    // =========================================================================
    // Deep structural relief, thick interwoven Kozo fiber clusters, extreme granulation tooth in valleys
    let macro_height = fbm(pos * 0.025, 5);
    let coarse_grain = fbm(pos * 0.12, 4);
    heightmap = clamp(macro_height * 0.7 + coarse_grain * 0.45, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.3, 1.2, 3.0);
    let fiber2 = washi_fiber(pos * 0.5, 4.4, 2.8);
    let fiber3 = washi_fiber(pos * 0.7, 7.8, 3.5);
    let total_fibers = clamp(fiber1 * 0.55 + fiber2 * 0.45 + fiber3 * 0.35, 0.0, 1.0);

    capillary_density = clamp(0.38 + heightmap * 0.35 + total_fibers * 0.45, 0.0, 1.0);
    // Deep valleys collect heavy pigment granulation
    granulation = clamp(pow(1.0 - heightmap, 1.3) * 1.6 + total_fibers * 0.35, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.006 + 88.1, 4) - 0.5) * 3.14159 * 2.0;
    let coarse_curl = (value_noise(pos * 0.04 + 19.3) - 0.5) * 1.2;
    let fiber_angle = stream_angle + coarse_curl;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else if (paper_type == 3u) {
    // =========================================================================
    // === 3. BAN-JUKU XUAN (半熟宣 - Semi-Sized Classical Landscape Paper) ===
    // =========================================================================
    // Light alum treatment, balanced absorbency, preserves stroke bone while allowing controlled soft bleeding
    let base_height = fbm(pos * 0.03, 4);
    let medium_grain = fbm(pos * 0.18, 3);
    heightmap = clamp(base_height * 0.5 + medium_grain * 0.35, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.28, 2.3, 1.9);
    let fiber2 = washi_fiber(pos * 0.48, 5.1, 2.1);
    let total_fibers = clamp(fiber1 * 0.4 + fiber2 * 0.3, 0.0, 1.0);

    capillary_density = clamp(0.42 + heightmap * 0.22 + total_fibers * 0.25, 0.0, 1.0);
    granulation = clamp(0.35 + total_fibers * 0.2, 0.0, 1.0);

    let stream_angle = (fbm(pos * 0.009 + 41.2, 3) - 0.5) * 3.14159 * 1.3;
    let local_curl = (value_noise(pos * 0.05 + 12.7) - 0.5) * 0.6;
    let fiber_angle = stream_angle + local_curl;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);

  } else {
    // =========================================================================
    // === 4. MASHI (生麻紙 - Wild Hemp Fiber Washi) ===
    // =========================================================================
    // Ancient coarse hemp fibers with prominent organic cross-hatch warp/weft lattice and rugged kasure
    let macro_height = fbm(pos * 0.02, 4);
    let hemp_grid = hemp_mesh(pos, 0.14);
    heightmap = clamp(macro_height * 0.55 + hemp_grid * 0.38 + fbm(pos * 0.2, 2) * 0.15, 0.0, 1.0);

    let fiber1 = washi_fiber(pos * 0.25, 6.2, 3.4);
    let fiber2 = washi_fiber(pos * 0.6, 9.4, 3.8);
    let total_fibers = clamp(fiber1 * 0.6 + fiber2 * 0.4 + hemp_grid * 0.3, 0.0, 1.0);

    capillary_density = clamp(0.48 + heightmap * 0.3 + total_fibers * 0.4, 0.0, 1.0);
    granulation = clamp(pow(1.0 - heightmap, 1.2) * 1.3 + hemp_grid * 0.3, 0.0, 1.0);

    // Hemp fibers form prominent orthogonal and diagonal warp directions
    let warp_angle = select(0.0, 1.5708, hash12(floor(pos * 0.05)) > 0.5);
    let natural_wobble = (value_noise(pos * 0.03 + 61.2) - 0.5) * 0.7;
    let fiber_angle = warp_angle + natural_wobble;
    fiber_angle_norm = clamp((fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);
  }

  // Pack into 4-channel texture:
  // R: Heightmap / Tooth (0..1)
  // G: Capillary absorption capacity (0..1)
  // B: Granulation valley depth (0..1)
  // A: Anisotropic fiber angle field theta in [0..1] mapped from [-PI..PI]
  let out_val = vec4<f32>(heightmap, capillary_density, granulation, fiber_angle_norm);
  textureStore(out_parchment, vec2<i32>(global_id.xy), out_val);
}
