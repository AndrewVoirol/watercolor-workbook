// Dual-Resolution Kubelka-Munk Optical Compositor & Screen Renderer
// Combines 4-tap Bicubic Catmull-Rom simulation sampling, native Retina fiber edge perturbation,
// physical 2-flux Kubelka-Munk radiative transfer, paper bump normals, and wet specular sheen.

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
  // Invert Y for standard texture UV
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

  // Catmull-Rom cubic weights
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

// Hyperbolic cotangent for Kubelka-Munk
fn coth_safe(x: vec3<f32>) -> vec3<f32> {
  let ax = clamp(abs(x), vec3<f32>(0.001), vec3<f32>(20.0));
  let exp_pos = exp(ax);
  let exp_neg = exp(-ax);
  return (exp_pos + exp_neg) / max(exp_pos - exp_neg, vec3<f32>(0.0001));
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

  // 2. High-Frequency Paper Fiber & Normal Calculations
  let paper_height = parchment.r;
  let paper_fiber = parchment.g;

  let dH_dx = dpdx(paper_height);
  let dH_dy = dpdy(paper_height);
  let paper_normal = normalize(vec3<f32>(-dH_dx * 3.0, -dH_dy * 3.0, 1.0));

  // Parchment paper background reflectance with heightmap tooth
  let paper_tooth = (paper_height - 0.5) * 0.05;
  let R_g = clamp(WASHI_PAPER_REFLECTANCE + vec3<f32>(paper_tooth * 0.8, paper_tooth * 0.9, paper_tooth * 1.1), vec3<f32>(0.1), vec3<f32>(1.0));

  // Effective optical pigment concentrations (pinned + suspended diluted by water)
  let water_depth = water.r;
  let dilution = 1.0 / (1.0 + 0.65 * water_depth);

  var c_sumi    = max(pinned.r + susp.r * dilution, 0.0);
  var c_shu     = max(pinned.g + susp.g * dilution, 0.0);
  var c_ai      = max(pinned.b + susp.b * dilution, 0.0);
  var c_oudo    = max(pinned.a + susp.a * dilution, 0.0);
  var c_rokusho = max(water.b  + water.g * dilution, 0.0);

  let total_pigment = c_sumi + c_shu + c_ai + c_oudo + c_rokusho;

  var final_rgb = R_g;

  // 3. Kubelka-Munk 2-Flux Optical Color Compositing
  if (total_pigment > 0.002) {
    let fiber_mod = (paper_fiber - 0.5) * 0.22 + (paper_height - 0.5) * 0.18;
    let edge_factor = smoothstep(0.002, 0.02, total_pigment + fiber_mod * 0.15);

    c_sumi    = c_sumi * edge_factor;
    c_shu     = c_shu * edge_factor;
    c_ai      = c_ai * edge_factor;
    c_oudo    = c_oudo * edge_factor;
    c_rokusho = c_rokusho * edge_factor;

    let km_sumi    = get_pigment_km(0u);
    let km_shu     = get_pigment_km(1u);
    let km_ai      = get_pigment_km(2u);
    let km_oudo    = get_pigment_km(3u);
    let km_rokusho = get_pigment_km(4u);

    // Total absorption K and scattering S
    let K_mix = c_sumi * km_sumi.K +
                c_shu * km_shu.K +
                c_ai * km_ai.K +
                c_oudo * km_oudo.K +
                c_rokusho * km_rokusho.K;

    let S_mix = c_sumi * km_sumi.S +
                c_shu * km_shu.S +
                c_ai * km_ai.S +
                c_oudo * km_oudo.S +
                c_rokusho * km_rokusho.S;

    let S_clamped = max(S_mix, vec3<f32>(0.02));
    let a = vec3<f32>(1.0) + (K_mix / S_clamped);
    let b = sqrt(max(a * a - vec3<f32>(1.0), vec3<f32>(0.0001)));

    let layer_thickness = 1.0;
    let bSx = b * S_clamped * layer_thickness;
    let coth_val = coth_safe(bSx);

    // Kubelka-Munk Reflectance equation
    let numerator = vec3<f32>(1.0) - R_g * (a - b * coth_val);
    let denominator = a - R_g + b * coth_val;

    let km_rgb = clamp(numerator / max(denominator, vec3<f32>(0.0001)), vec3<f32>(0.0), vec3<f32>(1.0));
    final_rgb = mix(R_g, km_rgb, edge_factor);
  }

  // 4. Paper Surface Lighting & Wet Specular Sheen
  let light_dir = normalize(vec3<f32>(-0.3, -0.5, 0.8));
  let diffuse = clamp(dot(paper_normal, light_dir), 0.78, 1.08);
  final_rgb = final_rgb * diffuse;

  // Wet puddles produce specular sheen and glossy reflection
  if (water_depth > 0.02) {
    let view_dir = vec3<f32>(0.0, 0.0, 1.0);
    let half_vec = normalize(light_dir + view_dir);
    let spec = pow(max(dot(paper_normal, half_vec), 0.0), 32.0);
    let wetness = smoothstep(0.02, 0.4, water_depth);
    let sheen = vec3<f32>(1.0, 0.98, 0.94) * spec * wetness * 0.3;
    
    final_rgb = final_rgb * (1.0 - wetness * 0.06) + sheen;
  }

  // Spring Rain gentle ripple sheen
  if (uniforms.spring_rain_active == 1u) {
    let wave = sin(uv.x * 40.0 + uv.y * 30.0 + uniforms.time * 6.0) * 0.03;
    final_rgb = final_rgb + vec3<f32>(wave * 0.5, wave * 0.7, wave * 0.9);
  }

  return vec4<f32>(final_rgb, 1.0);
}
