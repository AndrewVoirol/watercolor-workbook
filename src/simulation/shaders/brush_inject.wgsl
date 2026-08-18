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

  // --- PASS 1: Find Closest Swept Capsule / Envelope Weight ---
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
    let raw_dist = dist_and_t_to_segment_iso(pos, seg.p0, seg.p1, aspect, &t);
    let r = mix(seg.radius0, seg.radius1, t);
    let center_t = mix(seg.p0, seg.p1, t);

    var dist = raw_dist;
    if (seg.brush_type == 2u) {
      let eff_dist = elliptical_dist(pos, center_t, seg.azimuth, seg.aspect_ratio);
      dist = mix(raw_dist, eff_dist, 0.45);
    }

    if (dist > r) {
      continue;
    }

    // Normalized radial distance from centerline [0..1]
    let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
    // Smooth quintic polynomial falloff profile
    let w = (1.0 - u * u * u * (u * (u * 6.0 - 15.0) + 10.0));

    // Calculate transverse coordinate across stroke ribbon [-1..1]
    var transverse_norm = 0.0;
    let seg_vec = (seg.p1 - seg.p0) * vec2<f32>(aspect, 1.0);
    let seg_len = length(seg_vec);
    if (seg_len > 0.001) {
      let seg_dir = seg_vec / seg_len;
      let perp = vec2<f32>(-seg_dir.y, seg_dir.x);
      let to_p = (pos - center_t) * vec2<f32>(aspect, 1.0);
      transverse_norm = dot(to_p, perp) / max(r, 0.001);
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

  // --- BRUSH TYPE SPECIFIC MECHANICS & SMOOTH CONTINUOUS GRAIN ---
  if (seg.brush_type == 0u) {
    // === 0. MARU-FUDE (丸筆 / 太筆): 3D Conical Animal-Hair Calligraphy Tuft ===
    // Deep, saturated mass-tone core in u in [0, 0.70]
    let core_density = smoothstep(1.0, 0.12, u);
    let belly_mass = pow(core_density, 0.70);

    // Authentic Katabokashi (片ぼかし): Centrifugal curvature & stylus tilt shift mass tone
    let kappa_shift = seg.curvature * 1.4 + seg.tilt_x * 0.70;
    let kata_factor = clamp(1.0 + transverse_norm * kappa_shift * 0.35, 0.50, 1.50);

    // Natural paper fiber capillary modulation at wet stroke edge
    let edge_feather = 1.0 + (paper_fiber - 0.5) * 0.20 * smoothstep(0.35, 0.95, u);

    // Smooth C1 Hermite dry splay splitting (never jumps or pops on speed changes)
    let splay_intensity = clamp((seg.dryness - 0.18) / 0.70 + (seg.bristle_splay - 0.25) / 0.75, 0.0, 1.0);
    let hair_phase = transverse_norm * 12.0 * 3.14159;
    let hair_gaps = smoothstep(0.15, 0.80, abs(sin(hair_phase * 0.5)));
    let dry_split = mix(1.0, hair_gaps, splay_intensity * 0.75);

    weight = belly_mass * kata_factor * edge_feather * dry_split;

  } else if (seg.brush_type == 1u) {
    // === 1. MENSO (面相筆): Fine Sable Hairline Needle ===
    let needle_weight = pow(1.0 - u, 1.7);
    weight = needle_weight * 1.50;

  } else {
    // === 2. HAKE (刷毛): Broad Flat Wash with Parallel Bristle Bundles (筋目 Sujime) ===
    let hake_phase = transverse_norm * 14.0 * 3.14159;
    let hake_phase_sub = transverse_norm * 28.0 * 3.14159;
    let bundle_groove = cos(hake_phase) * 0.26 + cos(hake_phase_sub) * 0.08;

    let hake_intensity = clamp((seg.dryness - 0.10) / 0.80 + (seg.bristle_splay - 0.15) / 0.85, 0.0, 1.0);
    let bundle_gaps = smoothstep(0.20, 0.75, abs(sin(hake_phase * 0.5)));
    let splay_gaps = mix(1.0, bundle_gaps, hake_intensity * 0.80);
    let striation_amp = clamp(0.18 + hake_intensity * 0.60, 0.15, 0.75);
    let hake_profile = clamp(1.0 + bundle_groove * striation_amp, 0.25, 1.55) * splay_gaps;

    weight = weight * hake_profile;
  }

  // --- PHYSICAL PAPER TOOTH KASURE (飛白 / 擦れ) CONTINUOUS GATING ---
  // Continuous smooth Hermite blend based on dryness (no conditional step jump)
  let tooth_intensity = clamp((seg.dryness - 0.12) / 0.88, 0.0, 1.0);
  let tooth_threshold = 0.20 + (tooth_intensity * 0.35) * uniforms.paper_roughness;
  let height_excess = paper_height - tooth_threshold;
  let tooth_gate = mix(1.0, smoothstep(-0.20, 0.20, height_excess), tooth_intensity * 0.82);
  weight = weight * tooth_gate;

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
  let target_water = seg.water_amount * weight * 0.70;
  cur_water.r = clamp(max(cur_water.r, target_water), 0.0, 1.50);
  cur_water.g = clamp(max(cur_water.g, target_water * 0.75 * (1.0 + paper_fiber * 0.5)), 0.0, 1.50);

  // Target velocity envelope: smoothly aligns fluid momentum with brush motion
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
    cur_water.r = clamp(max(cur_water.r, target_water * 1.6), 0.0, 1.80);
    cur_water.g = clamp(max(cur_water.g, target_water * 1.3), 0.0, 1.80);
  } else {
    // Authentic Japanese Mineral Pigment Injection with physical Curtis 1997 optical depth
    let p_props = get_physical_pigment_km(seg.pigment_id);
    let wash_concentration = clamp(seg.pigment_density * (0.32 + (1.0 - clamp(seg.water_amount, 0.0, 1.0)) * 0.68), 0.18, 1.20);
    let target_k = p_props.K * wash_concentration * weight;
    let target_s = p_props.S * wash_concentration * weight;

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
