// Dual-Resolution Kubelka-Munk Optical Compositor & Screen Renderer
// Combines 4-tap Bicubic Catmull-Rom simulation reconstruction, dynamic hygroscopic paper buckling (Washi Hawa),
// refractive-index matching wet-darkening, physical 2-flux Kubelka-Munk radiative transfer,
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
@group(0) @binding(2) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(3) var in_pigment_pinned: texture_2d<f32>;
@group(0) @binding(4) var in_parchment: texture_2d<f32>;

// Fast 4-Tap Bicubic Catmull-Rom Texture Sampler
fn sample_bicubic(tex: texture_2d<f32>, uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let p = uv * dims - 0.5;
  let f = fract(p);
  let i = floor(p);

  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);

  let g0 = w0 + w1;
  let g1 = w2 + w3;

  let h0 = (w1 / max(g0, vec2<f32>(0.0001))) - 0.5;
  let h1 = (w3 / max(g1, vec2<f32>(0.0001))) + 1.5;

  let texel = 1.0 / dims;
  let p0 = (i + vec2<f32>(h0.x, h0.y)) * texel;
  let p1 = (i + vec2<f32>(h1.x, h0.y)) * texel;
  let p2 = (i + vec2<f32>(h0.x, h1.y)) * texel;
  let p3 = (i + vec2<f32>(h1.x, h1.y)) * texel;

  let c0 = textureLoad(tex, vec2<i32>(clamp(p0 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c1 = textureLoad(tex, vec2<i32>(clamp(p1 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c2 = textureLoad(tex, vec2<i32>(clamp(p2 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c3 = textureLoad(tex, vec2<i32>(clamp(p3 * dims, vec2<f32>(0.0), dims - 1.0)), 0);

  return (c0 * g0.x + c1 * g1.x) * g0.y + (c2 * g0.x + c3 * g1.x) * g1.y;
}

// Hyperbolic cotangent for Kubelka-Munk with Taylor series expansion branch for small arguments
fn coth_safe(x: vec3<f32>) -> vec3<f32> {
  let ax = abs(x);
  var result = vec3<f32>(0.0);
  
  for (var i = 0; i < 3; i = i + 1) {
    let u = ax[i];
    if (u < 0.001) {
      let u_safe = max(u, 0.00001);
      result[i] = 1.0 / u_safe + u_safe / 3.0;
    } else if (u > 20.0) {
      result[i] = 1.0;
    } else {
      let exp_pos = exp(u);
      let exp_neg = exp(-u);
      result[i] = (exp_pos + exp_neg) / max(exp_pos - exp_neg, 0.0001);
    }
  }
  return result;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let grid_dims = uniforms.grid_size;
  let uv = in.uv;

  // 1. Reconstruct continuous fields via 4-tap bicubic Catmull-Rom filter
  let water = sample_bicubic(in_water, uv, grid_dims);
  let susp = sample_bicubic(in_pigment_susp, uv, grid_dims);
  let pinned = sample_bicubic(in_pigment_pinned, uv, grid_dims);
  let parchment = sample_bicubic(in_parchment, uv, grid_dims);

  let paper_height = parchment.r;
  let paper_fiber = parchment.g;
  let paper_tooth_gran = parchment.b;

  // 2. Base Paper Reflectance tailored to Master Washi Variety
  var base_paper_rgb = WASHI_PAPER_REFLECTANCE;
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
  // When cellulose fibers (n=1.53) are saturated with water (n=1.33), scattering plummets
  let total_moisture = water.r * 0.8 + water.g * 1.4;
  let wet_darken_factor = clamp(total_moisture / (0.35 + total_moisture), 0.0, 0.85);
  
  // Wetted paper shifts to a deeper, richer tone (Aizome deepens to indigo midnight)
  let darken_tint = select(vec3<f32>(0.14, 0.16, 0.18), vec3<f32>(0.05, 0.08, 0.12), p_type == 4u);
  let wet_paper_rgb = base_paper_rgb * (vec3<f32>(1.0) - darken_tint * wet_darken_factor);

  let paper_tooth = (paper_height - 0.5) * 0.05 * uniforms.paper_roughness;
  let R_g = clamp(wet_paper_rgb + vec3<f32>(paper_tooth * 0.8, paper_tooth * 0.9, paper_tooth * 1.1), vec3<f32>(0.05), vec3<f32>(1.0));

  // --- 4. Dynamic 3D Paper Buckling (Cocking / Washi Hawa) & Surface Normals ---
  let buckle_height = water.g * 0.15 * uniforms.paper_buckling_rate;
  let total_effective_height = paper_height + buckle_height;

  let normal_scale = mix(2.2, 4.8, uniforms.paper_roughness * 0.7);
  let dH_dx = dpdx(total_effective_height);
  let dH_dy = dpdy(total_effective_height);
  let paper_normal = normalize(vec3<f32>(-dH_dx * normal_scale, -dH_dy * normal_scale, 1.0));

  // Effective optical pigment concentrations
  let total_water = water.r + water.g * 0.5;
  let dilution = 1.0 / (1.0 + 0.65 * total_water);

  var c_sumi = max(pinned.r + susp.r * dilution, 0.0);
  var c_shu  = max(pinned.g + susp.g * dilution, 0.0);
  var c_ai   = max(pinned.b + susp.b * dilution, 0.0);
  var c_oudo = max(pinned.a + susp.a * dilution, 0.0);

  let total_pigment = c_sumi + c_shu + c_ai + c_oudo;

  // --- 5. Screen-Space Euclidean Edge Anti-Aliasing & Fiber Fringing ---
  let fiber_mod = (paper_fiber - 0.5) * 0.22 + (paper_height - 0.5) * 0.18;
  let edge_val = total_pigment + fiber_mod * 0.12;
  let grad_w = max(length(vec2<f32>(dpdx(edge_val), dpdy(edge_val))), 0.0005) * 1.25;
  let edge_factor = smoothstep(0.002 - grad_w, 0.002 + grad_w, edge_val);

  var final_rgb = R_g;

  // --- 6. Kubelka-Munk 2-Flux Optical Color Compositing ---
  if (edge_factor > 0.001) {
    let km_sumi = get_pigment_km(0u);
    let km_shu  = get_pigment_km(1u);
    let km_ai   = get_pigment_km(8u);
    let km_oudo = get_pigment_km(4u);

    let K_mix = (c_sumi * km_sumi.K +
                 c_shu * km_shu.K +
                 c_ai * km_ai.K +
                 c_oudo * km_oudo.K) * edge_factor;

    let S_mix = (c_sumi * km_sumi.S +
                 c_shu * km_shu.S +
                 c_ai * km_ai.S +
                 c_oudo * km_oudo.S) * edge_factor;

    let layer_thickness = 1.0;
    let Sx = S_mix * layer_thickness;

    if (dot(Sx, vec3<f32>(1.0)) < 0.0001 && dot(K_mix, vec3<f32>(1.0)) < 0.0001) {
      final_rgb = R_g;
    } else {
      let S_clamped = max(S_mix, vec3<f32>(0.005));
      let a = vec3<f32>(1.0) + (K_mix / S_clamped);
      let b = sqrt(max(a * a - vec3<f32>(1.0), vec3<f32>(0.00001)));

      let bSx = b * S_clamped * layer_thickness;
      let coth_val = coth_safe(bSx);

      // Kubelka-Munk Reflectance: R = (1 - R_g(a - b coth)) / (a - R_g + b coth)
      let b_coth = b * coth_val;
      let numerator = vec3<f32>(1.0) - R_g * (a - b_coth);
      let denominator = a - R_g + b_coth;

      let km_rgb = clamp(numerator / max(denominator, vec3<f32>(0.0001)), vec3<f32>(0.0), vec3<f32>(1.0));
      final_rgb = mix(R_g, km_rgb, edge_factor);
    }
  }

  // --- 7. Kindei 24k Gold Micro-Flake & Kin-sunago Gold Dust Glint ---
  let is_gold_paper = (p_type == 3u && paper_tooth_gran > 0.62);
  let gold_density = c_oudo * 0.75 + select(0.0, 0.7, is_gold_paper);
  if (gold_density > 0.04) {
    let glint_noise = sin(uv.x * 1280.0 + uv.y * 940.0) * cos(uv.x * 730.0 - uv.y * 1420.0);
    let view_tilt = normalize(vec3<f32>(uniforms.gravity.x * 0.15, -uniforms.gravity.y * 0.15, 1.0));
    let gold_spec = pow(clamp(dot(paper_normal, view_tilt) * 0.65 + glint_noise * 0.35, 0.0, 1.0), 16.0);
    let gold_color = vec3<f32>(0.96, 0.82, 0.44) * (gold_spec * 0.55 + 0.12) * clamp(gold_density, 0.0, 1.0);
    final_rgb = final_rgb + gold_color * 0.42;
  }

  // --- 8. Salt Crystal Granulation & Starburst Shimmer ---
  let salt_conc = water.b;
  if (salt_conc > 0.02) {
    let sparkle_noise = sin(uv.x * 420.0 + uv.y * 360.0) * cos(uv.x * 260.0 - uv.y * 480.0);
    let crystal_glint = clamp(sparkle_noise * 1.6, 0.0, 1.0);
    let salt_whiteness = clamp(salt_conc * 0.85, 0.0, 0.95);
    
    let salt_rgb = vec3<f32>(0.98, 0.97, 0.94) + vec3<f32>(crystal_glint * 0.14);
    final_rgb = mix(final_rgb, salt_rgb, salt_whiteness * 0.72);
  }

  // --- 9. Paper Surface Lighting & Specular Sheen ---
  let light_dir = normalize(vec3<f32>(-0.3, -0.5, 0.8));
  let diffuse = clamp(dot(paper_normal, light_dir), 0.78, 1.12);
  final_rgb = final_rgb * diffuse;

  // Wet surface water puddles produce specular sheen and glossy reflection
  let surface_water_depth = water.r;
  if (surface_water_depth > 0.015) {
    let view_dir = vec3<f32>(0.0, 0.0, 1.0);
    let half_vec = normalize(light_dir + view_dir);
    let spec = pow(max(dot(paper_normal, half_vec), 0.0), 28.0);
    let wetness = smoothstep(0.015, 0.35, surface_water_depth);
    let sheen = vec3<f32>(1.0, 0.98, 0.94) * spec * wetness * 0.32;
    
    final_rgb = final_rgb * (1.0 - wetness * 0.05) + sheen;
  }

  // Spring Rain gentle ripple sheen
  if (uniforms.spring_rain_active == 1u) {
    let wave = sin(uv.x * 40.0 + uv.y * 30.0 + uniforms.time * 6.0) * 0.03;
    final_rgb = final_rgb + vec3<f32>(wave * 0.5, wave * 0.7, wave * 0.9);
  }

  return vec4<f32>(final_rgb, 1.0);
}
