// Dual-Resolution Kubelka-Munk Optical Compositor & Screen Renderer
// Combines 4-tap Bicubic Catmull-Rom simulation reconstruction, dynamic hygroscopic paper buckling (Washi Hawa),
// refractive-index matching wet-darkening, physical 2-flux Kubelka-Munk radiative transfer with exact spectral (K, S),
// paper bump normals, wet specular sheen, and Salt Starburst Crystalline Granulation rendering.

#include "common.wgsl"

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
  out.uv = pos[vertex_index] * 0.5 + vec2<f32>(0.5, 0.5);
  out.uv.y = 1.0 - out.uv.y;
  return out;
}

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;

@group(0) @binding(1) var in_water: texture_2d<f32>;
@group(0) @binding(2) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(3) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(4) var in_pigment_pinned_k: texture_2d<f32>;
@group(0) @binding(5) var in_pigment_pinned_s: texture_2d<f32>;
@group(0) @binding(6) var in_parchment: texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let grid_dims = uniforms.grid_size;
  let dims = vec2<i32>(grid_dims);
  let uv = in.uv;
  let coord = clamp(vec2<i32>(floor(uv * grid_dims)), vec2<i32>(0), dims - vec2<i32>(1));

  // 1. Reconstruct continuous fields via 4-tap bicubic Catmull-Rom filter
  let water = sample_bicubic_4tap(in_water, uv, grid_dims);
  let susp_k = sample_bicubic_4tap(in_pigment_susp_k, uv, grid_dims);
  let susp_s = sample_bicubic_4tap(in_pigment_susp_s, uv, grid_dims);
  let pinned_k = sample_bicubic_4tap(in_pigment_pinned_k, uv, grid_dims);
  let pinned_s = sample_bicubic_4tap(in_pigment_pinned_s, uv, grid_dims);
  let parchment = sample_bicubic_4tap(in_parchment, uv, grid_dims);

  let paper_height = parchment.r;
  let paper_fiber = parchment.g;
  let paper_tooth_gran = parchment.b;

  // 2. Base Paper Reflectance tailored to Master Washi Variety
  var base_paper_rgb = vec3<f32>(0.95, 0.93, 0.87);
  let p_type = uniforms.paper_type;
  if (p_type == 0u) {
    // 0: Unryū-shi (Cloud Dragon Mulberry — Warm Translucent Parchment)
    base_paper_rgb = vec3<f32>(0.95, 0.93, 0.87);
  } else if (p_type == 1u) {
    // 1: Torinoko (Smooth Golden Eggshell Gampi)
    base_paper_rgb = vec3<f32>(0.96, 0.94, 0.89);
  } else if (p_type == 2u) {
    // 2: Echizen Kouzo (Rustic Unbleached Mulberry)
    base_paper_rgb = vec3<f32>(0.93, 0.89, 0.81);
  } else if (p_type == 3u) {
    // 3: Kin-sunago (Gold-Leaf Dusted Washi)
    base_paper_rgb = vec3<f32>(0.94, 0.91, 0.83);
  } else if (p_type == 4u) {
    // 4: Aizome-shi (Deep Fermented Botanical Indigo Ground)
    base_paper_rgb = vec3<f32>(0.11, 0.15, 0.22);
  } else {
    // 5: Kobishi (Aged Edo Antique Tea-Tannin Patina)
    base_paper_rgb = vec3<f32>(0.91, 0.85, 0.74);
  }

  // --- 3. Refractive Index Matching & Optical Wet-Darkening ---
  let total_moisture = water.r * 0.8 + water.g * 1.4;
  let wet_darken_factor = clamp(total_moisture / (0.35 + total_moisture), 0.0, 0.85) * uniforms.wet_darkening_strength;
  
  let darken_tint = select(vec3<f32>(0.16, 0.18, 0.22), vec3<f32>(0.75, 0.82, 0.90), p_type == 4u);
  let wet_paper_rgb = base_paper_rgb * (vec3<f32>(1.0) - darken_tint * wet_darken_factor);

  let paper_tooth = (paper_height - 0.5) * 0.04 * uniforms.paper_roughness;
  let R_g = clamp(wet_paper_rgb + vec3<f32>(paper_tooth * 0.8, paper_tooth * 0.9, paper_tooth * 1.1), vec3<f32>(0.02), vec3<f32>(1.0));

  // --- 4. Authentic Washi Substrate Surface Normals ---
  // Paper tooth relief from procedural parchment heightmap
  let c_R = vec2<i32>(min(coord.x + 1, dims.x - 1), coord.y);
  let c_L = vec2<i32>(max(coord.x - 1, 0), coord.y);
  let c_T = vec2<i32>(coord.x, min(coord.y + 1, dims.y - 1));
  let c_B = vec2<i32>(coord.x, max(coord.y - 1, 0));

  let dH_dx = (textureLoad(in_parchment, c_R, 0).r - textureLoad(in_parchment, c_L, 0).r) * 0.5;
  let dH_dy = (textureLoad(in_parchment, c_T, 0).r - textureLoad(in_parchment, c_B, 0).r) * 0.5;
  let paper_normal = normalize(vec3<f32>(-dH_dx * 1.5 * uniforms.paper_roughness, -dH_dy * 1.5 * uniforms.paper_roughness, 1.0));

  // --- 5. Effective Optical (K, S) Spectral Concentrations & Dry Matte Shift (Kasshoku 渇色) ---
  let total_water = water.r + water.g * 0.5;
  let dilution = 1.0 / (1.0 + 0.65 * total_water);

  // Optical Dry Shift: In wet state, refractive index matching (n ≈ 1.33) reduces backscatter S;
  // in dry state (n → 1.0), Rayleigh/Mie air-particle micro-scattering increases S by 22%,
  // creating the authentic soft velvety matte dry watercolor finish.
  let dryness_factor = clamp(1.0 - total_water / 0.25, 0.0, 1.0);
  let dry_scatter_boost = 1.0 + 0.22 * dryness_factor;

  let total_K = pinned_k.rgb + susp_k.rgb * dilution;
  let total_S = (pinned_s.rgb + susp_s.rgb * dilution) * dry_scatter_boost;

  let total_optical_weight = length(total_K) + length(total_S);

  // Soft organic fiber edge fringing (smooth physical transition, NO harsh step polygons)
  let fiber_mod = (paper_fiber - 0.5) * 0.15 + (paper_height - 0.5) * 0.10;
  let edge_factor = smoothstep(0.0005, 0.035, total_optical_weight + fiber_mod * 0.015);

  var final_rgb = R_g;

  // --- 6. Kubelka-Munk 2-Flux Optical Color Compositing ---
  if (total_optical_weight > 0.0002 && edge_factor > 0.001) {
    let layer_thickness = edge_factor;
    let km_rgb = eval_km_rgb(total_K, total_S, R_g, layer_thickness);
    final_rgb = mix(R_g, km_rgb, edge_factor);
  }

  // --- 7. Kindei 24k Gold Metallic Luster & Kin-sunago Foil Glint ---
  let gold_glint_pinned = pinned_k.a;
  let is_gold_paper = (p_type == 3u && paper_tooth_gran > 0.58);
  let gold_presence = gold_glint_pinned * 0.85 + select(0.0, 0.75, is_gold_paper);

  if (gold_presence > 0.02) {
    let view_tilt = normalize(vec3<f32>(uniforms.gravity.x * 0.15, -uniforms.gravity.y * 0.15, 1.0));
    let light_dir_gold = normalize(vec3<f32>(-0.42, -0.62, 0.72));
    let half_vec = normalize(light_dir_gold + view_tilt);
    let NdotH = max(dot(paper_normal, half_vec), 0.0);
    
    // Smooth continuous metallic specular luster (Fresnel sheen without cellular disc artifacts)
    let gold_spec = pow(NdotH, 20.0) * 0.65 + pow(NdotH, 5.0) * 0.25;
    let gold_tint = vec3<f32>(0.96, 0.82, 0.42);
    let gold_reflection = gold_tint * (gold_spec * 0.60 + 0.15) * clamp(gold_presence, 0.0, 1.0);
    final_rgb = final_rgb + gold_reflection * 0.45;
  }

  // --- 8. Salt Crystal Granulation & Osmotic Starburst Bleaching ---
  let salt_conc = water.b;
  if (salt_conc > 0.015) {
    let salt_bleach = smoothstep(0.015, 0.35, salt_conc);
    let light_dir_salt = normalize(vec3<f32>(-0.42, -0.62, 0.72));
    let bleach_color = mix(final_rgb, vec3<f32>(0.98, 0.97, 0.94), salt_bleach * 0.62);
    let crystal_shimmer = pow(max(dot(paper_normal, light_dir_salt), 0.0), 16.0) * 0.10 * salt_bleach;
    final_rgb = bleach_color + vec3<f32>(crystal_shimmer);
  }

  // --- 9. Paper Surface Grazing Lighting & Specular Sheen ---
  let light_dir = normalize(vec3<f32>(-0.42, -0.62, 0.72));
  let diffuse = clamp(dot(paper_normal, light_dir), 0.94, 1.06);
  final_rgb = final_rgb * diffuse;

  // Wet surface water puddles produce specular sheen
  let surface_water_depth = water.r;
  if (surface_water_depth > 0.015) {
    let view_dir = vec3<f32>(0.0, 0.0, 1.0);
    let half_vec = normalize(light_dir + view_dir);
    let spec = pow(max(dot(paper_normal, half_vec), 0.0), 32.0);
    let wetness = smoothstep(0.015, 0.35, surface_water_depth);
    let sheen = vec3<f32>(1.0, 0.98, 0.94) * spec * wetness * 0.35;
    
    final_rgb = final_rgb * (1.0 - wetness * 0.05) + sheen;
  }

  // Spring Rain gentle ripple sheen
  if (uniforms.spring_rain_active == 1u) {
    let wave = sin(uv.x * 40.0 + uv.y * 30.0 + uniforms.time * 6.0) * 0.03;
    final_rgb = final_rgb + vec3<f32>(wave * 0.5, wave * 0.7, wave * 0.9);
  }

  return vec4<f32>(final_rgb, 1.0);
}
