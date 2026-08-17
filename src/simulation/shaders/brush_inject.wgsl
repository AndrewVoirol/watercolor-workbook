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
  if (seg_count == 0u) {
    return;
  }

  // --- PASS 1: Find the Closest Swept Capsule / Maximum Envelope Weight ---
  var best_weight: f32 = 0.0;
  var best_seg_idx: u32 = 0u;
  var best_transverse: f32 = 0.0;
  var best_u: f32 = 1.0;
  let aspect = uniforms.aspect_ratio;

  for (var i = 0u; i < seg_count; i = i + 1u) {
    let seg = segments[i];
    let seg_r = max(seg.radius0, seg.radius1) * 1.5 + 4.0;
    let min_x = min(seg.p0.x, seg.p1.x) - seg_r;
    let max_x = max(seg.p0.x, seg.p1.x) + seg_r;
    let min_y = min(seg.p0.y, seg.p1.y) - seg_r;
    let max_y = max(seg.p0.y, seg.p1.y) + seg_r;

    // Fast tight capsule AABB bounding box rejection
    if (pos.x < min_x || pos.x > max_x || pos.y < min_y || pos.y > max_y) {
      continue;
    }

    var t: f32 = 0.0;
    // Isotropic distance calculation to preserve circular brush profiles across any aspect ratio
    let raw_dist = dist_and_t_to_segment_iso(pos, seg.p0, seg.p1, aspect, &t);
    let r = mix(seg.radius0, seg.radius1, t);
    let center_t = mix(seg.p0, seg.p1, t);

    // Pure isotropic circular distance for Maru-fude and Menso; elliptical ribbon for Hake
    var dist = raw_dist;
    if (seg.brush_type == 2u) {
      let eff_dist = elliptical_dist(pos, center_t, seg.azimuth, seg.aspect_ratio);
      dist = mix(raw_dist, eff_dist, 0.45);
    }

    if (dist > r) {
      continue;
    }

    // Smooth quintic polynomial falloff profile
    let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
    let w = (1.0 - u * u * u * (u * (u * 6.0 - 15.0) + 10.0));

    // Calculate transverse coordinate across stroke ribbon
    var transverse_norm = 0.0;
    let seg_vec = (seg.p1 - seg.p0) * vec2<f32>(aspect, 1.0);
    let seg_len = length(seg_vec);
    if (seg_len > 0.001) {
      let seg_dir = seg_vec / seg_len;
      let perp = vec2<f32>(-seg_dir.y, seg_dir.x);
      let to_p = (pos - center_t) * vec2<f32>(aspect, 1.0);
      transverse_norm = dot(to_p, perp) / max(r, 0.001); // [-1..1]
    }

    if (w > best_weight) {
      best_weight = w;
      best_seg_idx = i;
      best_transverse = transverse_norm;
      best_u = u;
    }
  }

  if (best_weight <= 0.0001) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  let seg = segments[best_seg_idx];
  var weight = best_weight;
  let transverse_norm = best_transverse;
  let u = best_u;

  // --- BRUSH TYPE SPECIFIC MECHANICS & ORGANIC BRISTLE GRAIN ---
  if (seg.brush_type == 0u) {
    // === 0. MARU-FUDE (丸筆): Classic Round Animal-Hair Calligraphy Tuft ===
    let paper_grain = (paper_fiber - 0.5) * 0.12;
    let fude_grain = 1.0 + paper_grain * (0.40 + seg.dryness * 0.60);
    
    let kappa_bias = seg.curvature * 1.5 + (seg.tilt_x * 0.8);
    let kata_profile = clamp(1.0 + transverse_norm * kappa_bias * 0.35, 0.65, 1.35);
    weight = weight * fude_grain * kata_profile;

  } else if (seg.brush_type == 1u) {
    // === 1. MENSO (面相筆): Hairline Sable Needle with Crisp Center Point ===
    let needle_weight = pow(1.0 - u, 1.6);
    weight = needle_weight * 1.35;

  } else {
    // === 2. HAKE (刷毛): Broad Flat Wash with Longitudinal Bristle Striation Grooves (筋目 Sujime) ===
    let bristle_phase = transverse_norm * 16.0 * 3.14159;
    let bristle_striation = cos(bristle_phase) * 0.38 + cos(bristle_phase * 2.13 + 1.2) * 0.18;
    let striation_amp = clamp(0.30 + seg.dryness * 0.60 + seg.bristle_splay * 0.35, 0.15, 0.95);
    let hake_profile = clamp(1.0 + bristle_striation * striation_amp, 0.15, 1.55);
    weight = weight * hake_profile;
  }

  // --- PHYSICAL PAPER TOOTH KASURE (擦れ) GATING ---
  if (seg.dryness > 0.15) {
    let d_factor = (seg.dryness - 0.15) / 0.85;
    let tooth_threshold = 0.30 + (d_factor * 0.28) * uniforms.paper_roughness;
    let height_excess = paper_height - tooth_threshold;
    let tooth_gate = mix(1.0, smoothstep(-0.20, 0.20, height_excess), d_factor * 0.75);
    weight = weight * tooth_gate;
  }

  if (weight <= 0.0001) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  // --- WATER & TARGET VELOCITY ENVELOPE INJECTION ---
  let target_water = seg.water_amount * weight * 0.60;
  cur_water.r = clamp(max(cur_water.r, target_water), 0.0, 1.20);
  cur_water.g = clamp(max(cur_water.g, target_water * 0.70 * (1.0 + paper_fiber * 0.5)), 0.0, 1.20);

  // Target velocity envelope: smoothly aligns fluid momentum with brush motion without unbounded additive stacking
  let target_vel = seg.velocity * 0.65;
  let vel_blend = clamp(weight * 0.70, 0.0, 1.0);
  cur_vel = vec4<f32>(mix(cur_vel.xy, target_vel, vel_blend), 0.0, 0.0);

  // --- YOBITSUGI (呼び継ぎ): Re-solubilization of pinned pigment by fresh solvent ---
  let pinned_density = length(cur_pinned_k.rgb);
  if (pinned_density > 0.005 && target_water > 0.005) {
    let coarse_lock = clamp(1.0 - cur_pinned_k.a * 0.65, 0.25, 1.0);
    let remobilize_rate = clamp(target_water * 0.50 * coarse_lock, 0.0, 0.40);
    let remobilized_k = cur_pinned_k.rgb * remobilize_rate;
    let remobilized_s = cur_pinned_s.rgb * remobilize_rate;
    
    cur_pinned_k = vec4<f32>(max(cur_pinned_k.rgb - remobilized_k, vec3<f32>(0.0)), cur_pinned_k.a);
    cur_pinned_s = vec4<f32>(max(cur_pinned_s.rgb - remobilized_s, vec3<f32>(0.0)), cur_pinned_s.a);
    cur_susp_k = vec4<f32>(min(cur_susp_k.rgb + remobilized_k, vec3<f32>(12.0)), cur_susp_k.a);
    cur_susp_s = vec4<f32>(min(cur_susp_s.rgb + remobilized_s, vec3<f32>(12.0)), cur_susp_s.a);
  }

  // --- PIGMENT / CLEAR WATER INJECTION ---
  if (seg.pigment_id >= 5u) {
    // Clean Water Wash (Mizu 清水)
    cur_water.r = clamp(max(cur_water.r, target_water * 1.5), 0.0, 1.50);
    cur_water.g = clamp(max(cur_water.g, target_water * 1.2), 0.0, 1.50);
  } else {
    // Authentic Japanese Mineral Pigment Injection with physical target saturation envelope
    let p_props = get_physical_pigment_km(seg.pigment_id);
    let target_k = p_props.K * seg.pigment_density * weight;
    let target_s = p_props.S * seg.pigment_density * weight;

    if (seg.brush_type == 1u) {
      // Menso pins pigment directly into fiber grooves for razor bone lines
      let needed_pinned_k = max(target_k * 0.85 - cur_pinned_k.rgb, vec3<f32>(0.0));
      let needed_pinned_s = max(target_s * 0.85 - cur_pinned_s.rgb, vec3<f32>(0.0));
      cur_pinned_k = vec4<f32>(cur_pinned_k.rgb + needed_pinned_k, max(cur_pinned_k.a, p_props.coarse_ratio));
      cur_pinned_s = vec4<f32>(cur_pinned_s.rgb + needed_pinned_s, cur_pinned_s.a);
      
      let needed_susp_k = max(target_k * 0.15 - cur_susp_k.rgb, vec3<f32>(0.0));
      let needed_susp_s = max(target_s * 0.15 - cur_susp_s.rgb, vec3<f32>(0.0));
      cur_susp_k = vec4<f32>(cur_susp_k.rgb + needed_susp_k, max(cur_susp_k.a, p_props.coarse_ratio));
      cur_susp_s = vec4<f32>(cur_susp_s.rgb + needed_susp_s, max(cur_susp_s.a, p_props.stokes_settle));
    } else {
      // Standard pigment suspension into surface fluid: respects total concentration headroom
      let headroom_k = max(target_k - cur_pinned_k.rgb, vec3<f32>(0.0));
      let headroom_s = max(target_s - cur_pinned_s.rgb, vec3<f32>(0.0));
      cur_susp_k = vec4<f32>(max(cur_susp_k.rgb, headroom_k), max(cur_susp_k.a, p_props.coarse_ratio));
      cur_susp_s = vec4<f32>(max(cur_susp_s.rgb, headroom_s), max(cur_susp_s.a, p_props.stokes_settle));
    }
  }

  textureStore(out_velocity, coord, cur_vel);
  textureStore(out_water, coord, cur_water);
  textureStore(out_pigment_susp_k, coord, cur_susp_k);
  textureStore(out_pigment_susp_s, coord, cur_susp_s);
  textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
  textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
}
