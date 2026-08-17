// Continuous Sweep Segment Brush Injection Shader
// Injects water, momentum, and exact spectral (K, S) Kubelka-Munk properties along smooth swept capsules
// Supports Maru-fude (Katabokashi asymmetric loading), Menso (hairline pinning), Hake (bristle striations), and Fuki-e (blown aerosol)

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> segments: array<BrushSegment>;

@group(0) @binding(2) var in_velocity: texture_2d<f32>;
@group(0) @binding(3) var out_velocity: texture_storage_2d<rgba16float, write>;

@group(0) @binding(4) var in_water: texture_2d<f32>;
@group(0) @binding(5) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(6) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(7) var out_pigment_susp_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(8) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(9) var out_pigment_susp_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(10) var in_pigment_pinned_k: texture_2d<f32>;
@group(0) @binding(11) var out_pigment_pinned_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(12) var in_pigment_pinned_s: texture_2d<f32>;
@group(0) @binding(13) var out_pigment_pinned_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(14) var in_parchment: texture_2d<f32>;


// Computes oriented elliptical contact patch distance for calligraphic angles
fn elliptical_dist(p: vec2<f32>, center: vec2<f32>, azimuth: f32, aspect: f32) -> f32 {
  let d = p - center;
  let c = cos(azimuth);
  let s = sin(azimuth);
  let rot_d = vec2<f32>(d.x * c + d.y * s, -d.x * s + d.y * c);
  let scaled = vec2<f32>(rot_d.x, rot_d.y / max(aspect, 0.2));
  return length(scaled);
}

// Pseudo-random hash for bristle noise & aerosol splatter
fn hash_f(p: vec2<f32>, seed: f32) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031 + seed * 0.017);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(coord.x), f32(coord.y));
  let parchment = textureLoad(in_parchment, coord, 0);
  let paper_height = parchment.r;
  let paper_fiber = parchment.g;

  var cur_vel = textureLoad(in_velocity, coord, 0);
  var cur_water = textureLoad(in_water, coord, 0);
  var cur_susp_k = textureLoad(in_pigment_susp_k, coord, 0);
  var cur_susp_s = textureLoad(in_pigment_susp_s, coord, 0);
  var cur_pinned_k = textureLoad(in_pigment_pinned_k, coord, 0);
  var cur_pinned_s = textureLoad(in_pigment_pinned_s, coord, 0);

  let seg_count = uniforms.segment_count;

  for (var i = 0u; i < seg_count; i = i + 1u) {
    let seg = segments[i];
    let seg_center = (seg.p0 + seg.p1) * 0.5;
    let max_r = max(seg.radius0, seg.radius1) * 2.8 + 12.0;

    // Fast bounding box rejection
    if (abs(pos.x - seg_center.x) > max_r || abs(pos.y - seg_center.y) > max_r) {
      continue;
    }

    var t: f32 = 0.0;
    let raw_dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
    let r = mix(seg.radius0, seg.radius1, t);
    let center_t = mix(seg.p0, seg.p1, t);

    // Stylus azimuth contact patch
    let eff_dist = elliptical_dist(pos, center_t, seg.azimuth, seg.aspect_ratio);
    let dist = mix(raw_dist, eff_dist, 0.45);

    if (dist > r) {
      continue;
    }

    // Smooth quintic polynomial falloff profile
    let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
    var weight = (1.0 - u * u * u * (u * (u * 6.0 - 15.0) + 10.0));

    // --- BRUSH TYPE SPECIFIC MECHANICS ---
    var transverse_norm = 0.0;
    let seg_vec = seg.p1 - seg.p0;
    let seg_len = length(seg_vec);
    if (seg_len > 0.001) {
      let seg_dir = seg_vec / seg_len;
      let perp = vec2<f32>(-seg_dir.y, seg_dir.x);
      let to_p = pos - center_t;
      transverse_norm = dot(to_p, perp) / max(r, 0.001); // [-1..1]
    }

    if (seg.brush_type == 0u) {
      // === 0. MARU-FUDE (丸筆): Dynamic Katabokashi Asymmetric Loading ===
      let kappa_bias = seg.curvature * 1.5 + (seg.tilt_x * 0.8);
      let kata_profile = clamp(0.5 + transverse_norm * kappa_bias * 0.5, 0.15, 1.35);
      weight = weight * kata_profile;

    } else if (seg.brush_type == 1u) {
      // === 1. MENSO (面相筆): Hairline Sable Needle with Fine Point Concentration ===
      let needle_weight = pow(1.0 - u, 1.8);
      weight = needle_weight * 1.35;

    } else if (seg.brush_type == 2u) {
      // === 2. HAKE (刷毛): Broad Wooden Flat Wash with Micro-Bristle Grooves ===
      let bristle_freq = 0.45;
      let bristle_noise = sin(dist * bristle_freq + seg.burst_seed * 4.2) * 0.28;
      let splay_split = select(1.0, clamp(1.0 + bristle_noise * seg.bristle_splay * 2.0, 0.05, 1.45), seg.bristle_splay > 0.1);
      weight = weight * splay_split;

    } else if (seg.brush_type == 3u) {
      // === 3. FUKI-E (吹き絵): Blown-Ink Aerosol Mist & Droplets ===
      let noise_val = hash_f(floor(pos * 0.4), seg.burst_seed);
      let drop_presence = select(0.0, 1.0, noise_val > 0.65);
      let spatter = drop_presence * (1.0 - u * u);
      weight = spatter * 1.6;
    }

    // --- PHYSICAL PAPER TOOTH KASURE (擦れ) GATING ---
    // Only engages when brush is genuinely dry (seg.dryness > 0.25)
    if (seg.dryness > 0.25 && seg.brush_type != 3u) {
      let d_factor = (seg.dryness - 0.25) / 0.75;
      let tooth_threshold = d_factor * 0.65 * uniforms.paper_roughness;
      let height_excess = paper_height - tooth_threshold;
      let tooth_gate = mix(1.0, smoothstep(-0.25, 0.25, height_excess), d_factor);
      weight = weight * tooth_gate;
    }

    if (weight <= 0.0001) {
      continue;
    }

    // --- WATER & VELOCITY INJECTION ---
    let water_inj = seg.water_amount * weight * 0.35;
    cur_water.r = clamp(cur_water.r + water_inj, 0.0, 1.05);
    cur_water.g = clamp(cur_water.g + water_inj * 0.55 * (1.0 + paper_fiber * 0.5), 0.0, 1.10);

    let vel_inj = seg.velocity * weight * 0.65;
    cur_vel = vec4<f32>(cur_vel.xy + vel_inj, 0.0, 0.0);

    // --- PIGMENT / SPECIAL MEDIUM INJECTION ---
    if (seg.pigment_id == 12u) {
      // Clean Water Wash (Mizu 水)
      cur_water.r = clamp(cur_water.r + water_inj * 1.4, 0.0, 1.35);
      cur_water.g = clamp(cur_water.g + water_inj * 1.1, 0.0, 1.35);
    } else if (seg.pigment_id == 13u) {
      // Shio (塩振り Sea Salt Granulation)
      let salt_inj = weight * uniforms.salt_intensity * 0.85;
      cur_water.b = clamp(cur_water.b + salt_inj, 0.0, 2.0);
    } else {
      // Authentic Japanese Mineral Pigment Injection
      let p_props = get_physical_pigment_km(seg.pigment_id);
      let pigment_conc = seg.pigment_density * weight * 0.60;

      let dK = p_props.K * pigment_conc;
      let dS = p_props.S * pigment_conc;

      if (seg.brush_type == 1u) {
        // Menso pins pigment directly into fiber grooves for razor bone lines
        cur_pinned_k = vec4<f32>(min(cur_pinned_k.rgb + dK * 0.85, vec3<f32>(12.0)), max(cur_pinned_k.a, p_props.coarse_ratio));
        cur_pinned_s = vec4<f32>(min(cur_pinned_s.rgb + dS * 0.85, vec3<f32>(12.0)), cur_pinned_s.a);
        cur_susp_k = vec4<f32>(min(cur_susp_k.rgb + dK * 0.15, vec3<f32>(12.0)), max(cur_susp_k.a, p_props.coarse_ratio));
        cur_susp_s = vec4<f32>(min(cur_susp_s.rgb + dS * 0.15, vec3<f32>(12.0)), max(cur_susp_s.a, p_props.stokes_settle));
      } else {
        // Standard pigment suspension into surface fluid
        cur_susp_k = vec4<f32>(min(cur_susp_k.rgb + dK, vec3<f32>(12.0)), max(cur_susp_k.a, p_props.coarse_ratio));
        cur_susp_s = vec4<f32>(min(cur_susp_s.rgb + dS, vec3<f32>(12.0)), max(cur_susp_s.a, p_props.stokes_settle));
      }
    }
  }

  textureStore(out_velocity, coord, cur_vel);
  textureStore(out_water, coord, cur_water);
  textureStore(out_pigment_susp_k, coord, cur_susp_k);
  textureStore(out_pigment_susp_s, coord, cur_susp_s);
  textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
  textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
}
