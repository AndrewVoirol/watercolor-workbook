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
  let uv = in.uv;

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

  let paper_tooth = (paper_height - 0.5) * 0.05 * uniforms.paper_roughness;
  let R_g = clamp(wet_paper_rgb + vec3<f32>(paper_tooth * 0.8, paper_tooth * 0.9, paper_tooth * 1.1), vec3<f32>(0.02), vec3<f32>(1.0));

  // --- 4. Dynamic 3D Paper Buckling (Washi Hawa) & Surface Normals ---
  let buckle_height = water.g * 0.18 * uniforms.paper_buckling_rate;
  let total_effective_height = paper_height + buckle_height;

  let normal_scale = mix(2.5, 5.2, uniforms.paper_roughness * 0.7);
  let dH_dx = dpdx(total_effective_height);
  let dH_dy = dpdy(total_effective_height);
  let paper_normal = normalize(vec3<f32>(-dH_dx * normal_scale, -dH_dy * normal_scale, 1.0));

  // --- 5. Effective Optical (K, S) Spectral Concentrations ---
  let total_water = water.r + water.g * 0.5;
  let dilution = 1.0 / (1.0 + 0.65 * total_water);

  let total_K = pinned_k.rgb + susp_k.rgb * dilution;
  let total_S = pinned_s.rgb + susp_s.rgb * dilution;

  let total_optical_weight = length(total_K) + length(total_S);

  // Screen-space edge anti-aliasing & fiber fringing
  let fiber_mod = (paper_fiber - 0.5) * 0.22 + (paper_height - 0.5) * 0.18;
  let edge_val = total_optical_weight + fiber_mod * 0.12;
  let grad_w = max(length(vec2<f32>(dpdx(edge_val), dpdy(edge_val))), 0.0005) * 1.25;
  let edge_factor = smoothstep(0.002 - grad_w, 0.002 + grad_w, edge_val);

  var final_rgb = R_g;

  // --- 6. Kubelka-Munk 2-Flux Optical Color Compositing ---
  if (total_optical_weight > 0.0005 && edge_factor > 0.001) {
    let layer_thickness = edge_factor;
    let km_rgb = eval_km_rgb(total_K, total_S, R_g, layer_thickness);
    final_rgb = mix(R_g, km_rgb, edge_factor);
  }

  // --- 7. Kindei 24k Gold Micro-Flake & Kin-sunago Gold Dust Glint ---
  let gold_glint_pinned = pinned_k.a;
  let is_gold_paper = (p_type == 3u && paper_tooth_gran > 0.62);
  let gold_presence = gold_glint_pinned * 0.85 + select(0.0, 0.75, is_gold_paper);

  if (gold_presence > 0.03) {
    let glint_noise = sin(uv.x * 1280.0 + uv.y * 940.0) * cos(uv.x * 730.0 - uv.y * 1420.0);
    let view_tilt = normalize(vec3<f32>(uniforms.gravity.x * 0.15, -uniforms.gravity.y * 0.15, 1.0));
    let gold_spec = pow(clamp(dot(paper_normal, view_tilt) * 0.65 + glint_noise * 0.35, 0.0, 1.0), 16.0);
    let gold_color = vec3<f32>(0.96, 0.82, 0.44) * (gold_spec * 0.55 + 0.14) * clamp(gold_presence, 0.0, 1.0);
    final_rgb = final_rgb + gold_color * 0.45;
  }

  // --- 8. Salt Crystal Granulation & Dendritic Starburst Shimmer ---
  let salt_conc = water.b;
  if (salt_conc > 0.015) {
    let crystal_dendrite = pow(sin(uv.x * 640.0 + sin(uv.y * 520.0) * 2.0) * cos(uv.y * 640.0 + cos(uv.x * 520.0) * 2.0) * 0.5 + 0.5, 3.5);
    let sparkle_noise = sin(uv.x * 420.0 + uv.y * 360.0) * cos(uv.x * 260.0 - uv.y * 480.0);
    let crystal_glint = clamp(crystal_dendrite * 1.8 + sparkle_noise * 0.8, 0.0, 1.0);
    let salt_whiteness = clamp(salt_conc * 0.90, 0.0, 0.95);
    
    let salt_rgb = vec3<f32>(0.98, 0.97, 0.94) + vec3<f32>(crystal_glint * 0.18);
    final_rgb = mix(final_rgb, salt_rgb, salt_whiteness * 0.78);
  }

  // --- 9. Paper Surface Grazing Lighting & Specular Sheen ---
  let light_dir = normalize(vec3<f32>(-0.42, -0.62, 0.72));
  let diffuse = clamp(dot(paper_normal, light_dir), 0.74, 1.16);
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
