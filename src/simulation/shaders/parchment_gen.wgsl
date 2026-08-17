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

struct FiberSample {
  density: f32,
  angle: f32,
};

// High-Fidelity Sinuous Kozo/Gampi Bast Fiber Generator with Physical Tangent Tracking
fn washi_sinuous_fiber_ex(pos: vec2<f32>, stream_angle: f32, seed: f32, length_scale: f32, width: f32) -> FiberSample {
  let c = cos(stream_angle);
  let s = sin(stream_angle);
  let rot_pos = vec2<f32>(pos.x * c + pos.y * s, -pos.x * s + pos.y * c);

  // Sinuous transverse undulation via coupled harmonics
  let curl = sin(rot_pos.x * 0.035 + seed * 17.3) * 14.0 + 
             sin(rot_pos.x * 0.11 + seed * 31.7) * 5.0;
  let dcurl_dx = cos(rot_pos.x * 0.035 + seed * 17.3) * 0.49 +
                 cos(rot_pos.x * 0.11 + seed * 31.7) * 0.55;
  let dist_to_spine = abs(rot_pos.y * length_scale + curl);
  
  let fiber_core = 1.0 - smoothstep(0.0, width, dist_to_spine);
  let longitudinal_mod = value_noise(vec2<f32>(rot_pos.x * 0.07, seed * 19.1));
  let density = fiber_core * smoothstep(0.12, 0.88, longitudinal_mod);
  let tangent_angle = stream_angle + atan2(dcurl_dx, 1.0);
  
  return FiberSample(density, tangent_angle);
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

  // Isotropic aspect ratio scaling for procedural paper fibers
  let aspect = uniforms.aspect_ratio;
  let pos = vec2<f32>(f32(global_id.x) * aspect, f32(global_id.y));
  let paper_type = uniforms.paper_type;

  var heightmap: f32 = 0.5;
  var capillary_density: f32 = 0.5;
  var granulation: f32 = 0.5;
  var dominant_fiber_angle: f32 = (fbm(pos * 0.008 + 14.1, 3) - 0.5) * 3.14159 * 1.6;

  let stream_angle = dominant_fiber_angle;

  if (paper_type == 0u) {
    // === 0. KIZUKI KŌZO (生漉楮 - Pure Raw Mulberry Washi) ===
    // Unsized handmade Mulberry with long interwoven bast fibers that guide anisotropic capillary tendrils (Hige-nijimi 髭滲み)
    let macro_pulp = fbm(pos * 0.025, 4);
    let fine_grain = fbm(pos * 0.16, 3);
    
    let f1 = washi_sinuous_fiber_ex(pos, stream_angle, 1.2, 0.40, 2.4);
    let f2 = washi_sinuous_fiber_ex(pos, stream_angle + 0.35, 4.7, 0.65, 1.6);
    let f3 = washi_sinuous_fiber_ex(pos, stream_angle - 0.25, 9.1, 0.95, 1.2);
    let total_fibers = clamp(f1.density * 0.70 + f2.density * 0.45 + f3.density * 0.35, 0.0, 1.0);
    
    if (f1.density > 0.3) {
      dominant_fiber_angle = f1.angle;
    } else if (f2.density > 0.3) {
      dominant_fiber_angle = f2.angle;
    }

    let sukime = sukime_screen_mesh(pos);
    let chiri = chiri_bark_speck(pos, 5.18);

    heightmap = clamp(macro_pulp * 0.42 + fine_grain * 0.28 + total_fibers * 0.30 + sukime * 0.45 + chiri * 0.5, 0.0, 1.0);
    capillary_density = clamp(0.70 + macro_pulp * 0.15 + total_fibers * 0.75, 0.0, 1.0);
    granulation = clamp(0.35 + total_fibers * 0.35 + (1.0 - heightmap) * 0.30, 0.0, 1.0);

  } else if (paper_type == 1u) {
    // === 1. TORINOKO (鳥の子 - Sized Eggshell Washi) ===
    // Alum-gelatin Dōsa sized (礬水引) Gampi parchment with dense smooth surface, high contact angle, and sharp calligraphic contour edges
    let base_height = fbm(pos * 0.02, 3);
    let micro_grain = fbm(pos * 0.35, 2);
    heightmap = clamp(0.5 + (base_height - 0.5) * 0.22 + (micro_grain - 0.5) * 0.12, 0.0, 1.0);

    let f1 = washi_sinuous_fiber_ex(pos, stream_angle, 2.0, 0.8, 0.7);
    let total_fibers = f1.density * 0.12;

    capillary_density = clamp(0.15 + heightmap * 0.10 + total_fibers * 0.08, 0.0, 1.0);
    granulation = 0.10;

  } else {
    // === 2. KOBISHI (古美紙 - Antique Edo Tea-Patina Washi) ===
    // Naturally aged antique washi with warm tea tannin patina (渋引) and balanced, mellow sumi-e absorption
    let macro_height = fbm(pos * 0.02, 4);
    let vintage_tooth = fbm(pos * 0.14, 3);
    
    let f1 = washi_sinuous_fiber_ex(pos, stream_angle, 4.2, 0.5, 1.5);
    let f2 = washi_sinuous_fiber_ex(pos, stream_angle + 0.25, 7.6, 0.75, 1.1);
    let total_fibers = clamp(f1.density * 0.55 + f2.density * 0.35, 0.0, 1.0);

    if (f1.density > 0.3) {
      dominant_fiber_angle = f1.angle;
    }

    heightmap = clamp(macro_height * 0.50 + vintage_tooth * 0.35 + total_fibers * 0.22, 0.0, 1.0);
    capillary_density = clamp(0.50 + heightmap * 0.20 + total_fibers * 0.30, 0.0, 1.0);
    granulation = clamp(0.38 + total_fibers * 0.25, 0.0, 1.0);
  }

  // Pack into 4-channel texture:
  // R: Heightmap / Tooth (0..1)
  // G: Capillary absorption capacity (0..1)
  // B: Granulation valley depth (0..1)
  // A: Anisotropic fiber angle field theta in [0..1] mapped from [-PI..PI]
  let fiber_angle_norm = clamp((dominant_fiber_angle + 3.14159265) / (2.0 * 3.14159265), 0.0, 1.0);
  let out_val = vec4<f32>(heightmap, capillary_density, granulation, fiber_angle_norm);
  textureStore(out_parchment, vec2<i32>(global_id.xy), out_val);
}
