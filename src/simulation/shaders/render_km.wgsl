// Dual-Resolution Kubelka-Munk Optical Compositor & Screen Renderer
// Combines 4-tap Bicubic Catmull-Rom simulation reconstruction, dynamic hygroscopic paper tooth normals,
// refractive-index matching wet-darkening, physical 2-flux Kubelka-Munk radiative transfer with exact spectral (K, S),
// grazing paper relief diffuse lighting, and subtle wet specular sheen.

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

  // 2. Base Paper Reflectance tailored to the 3 Master Washi Varieties
  var base_paper_rgb = vec3<f32>(0.94, 0.91, 0.84);
  let p_type = uniforms.paper_type;
  if (p_type == 0u) {
    // 0: Kizuki Kōzo (生漉楮 - Raw Unbleached Mulberry Washi)
    base_paper_rgb = vec3<f32>(0.94, 0.91, 0.84);
  } else if (p_type == 1u) {
    // 1: Torinoko (鳥の子 - Smooth Sized Eggshell Gampi)
    base_paper_rgb = vec3<f32>(0.96, 0.94, 0.88);
  } else {
    // 2: Kobishi (古美紙 - Aged Edo Antique Tea-Tannin Patina)
    base_paper_rgb = vec3<f32>(0.91, 0.85, 0.74);
  }

  // --- 3. Refractive Index Matching & Optical Wet-Darkening ---
  let total_moisture = water.r * 0.8 + water.g * 1.4;
  let wet_darken_factor = clamp(total_moisture / (0.35 + total_moisture), 0.0, 0.85) * uniforms.wet_darkening_strength;
  let darken_tint = vec3<f32>(0.16, 0.18, 0.22);
  let wet_paper_rgb = base_paper_rgb * (vec3<f32>(1.0) - darken_tint * wet_darken_factor);

  let paper_tooth = (paper_height - 0.5) * 0.035 * uniforms.paper_roughness;
  let R_g = clamp(wet_paper_rgb + vec3<f32>(paper_tooth * 0.85, paper_tooth * 0.95, paper_tooth * 1.05), vec3<f32>(0.02), vec3<f32>(1.0));

  // --- 4. Authentic Washi Substrate 3D Normals & Hygroscopic Swelling ---
  let buckle_height = water.g * 0.16 * uniforms.paper_buckling_rate;
  let total_height = paper_height + buckle_height;
  let normal_scale = mix(2.2, 4.2, uniforms.paper_roughness * 0.75);
  let dH_dx = dpdx(total_height);
  let dH_dy = dpdy(total_height);
  let paper_normal = normalize(vec3<f32>(-dH_dx * normal_scale, -dH_dy * normal_scale, 1.0));

  // --- 5. Effective Optical (K, S) Spectral Concentrations & Dry Matte Shift (Kasshoku 渇色) ---
  let total_water = water.r + water.g * 0.5;
  let dilution = 1.0 / (1.0 + 0.55 * total_water);

  // Optical Dry Shift: Rayleigh/Mie air scattering increases S by 18% in dry film
  let dryness_factor = clamp(1.0 - total_water / 0.20, 0.0, 1.0);
  let dry_scatter_boost = 1.0 + 0.18 * dryness_factor;

  let total_K = pinned_k.rgb + susp_k.rgb * dilution;
  let total_S = (pinned_s.rgb + susp_s.rgb * dilution) * dry_scatter_boost;

  let total_optical_weight = length(total_K) + length(total_S);
  var final_rgb = R_g;

  // --- 6. True Non-Linear Kubelka-Munk 2-Flux Optical Radiative Transfer ---
  if (total_optical_weight > 0.0001) {
    // Physical variable film thickness modulated by paper bast fiber texture
    let fiber_mod = (paper_fiber - 0.5) * 0.14 + (paper_height - 0.5) * 0.08;
    let effective_d = max(1.0 + fiber_mod, 0.10);
    
    // Radiative transfer through layer thickness effective_d
    let km_rgb = eval_km_rgb(total_K, total_S, R_g, effective_d);
    
    // Sub-pixel continuous edge reconstruction
    let edge_blend = smoothstep(0.0001, 0.004, total_optical_weight);
    final_rgb = mix(R_g, km_rgb, edge_blend);
  }

  // --- 7. Paper Surface Grazing Diffuse Lighting ---
  let light_dir = normalize(vec3<f32>(-0.42, -0.62, 0.72));
  let diffuse = clamp(dot(paper_normal, light_dir), 0.86, 1.14);
  final_rgb = final_rgb * diffuse;

  // --- 8. Wet Puddle Specular Sheen (Dynamic liquid gloss that softens on drying) ---
  let surface_water_depth = water.r;
  if (surface_water_depth > 0.012) {
    let view_dir = vec3<f32>(0.0, 0.0, 1.0);
    let half_vec = normalize(light_dir + view_dir);
    let spec = pow(max(dot(paper_normal, half_vec), 0.0), 28.0);
    let wetness = smoothstep(0.012, 0.32, surface_water_depth);
    let sheen = vec3<f32>(1.0, 0.98, 0.94) * spec * wetness * 0.32;
    
    final_rgb = final_rgb * (1.0 - wetness * 0.04) + sheen;
  }

  return vec4<f32>(final_rgb, 1.0);
}
