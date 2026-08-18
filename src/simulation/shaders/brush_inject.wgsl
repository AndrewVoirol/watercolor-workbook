// Continuous Sweep Segment Brush Injection Shader
// Injects water, hydrodynamic wake momentum (vortex dipole, wake suction, bristle micro-eddies),
// and exact spectral (K, S) Kubelka-Munk properties along smooth swept capsules.
// Supports Maru-fude (Katabokashi & multi-strand bristle tuft), Menso (hairline pinning), Hake (Sujime striations), and Fuki-e.

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

    // Calculate transverse coordinate across stroke ribbon [-1..1]
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
  let transverse_norm = clamp(best_transverse, -1.0, 1.0);
  let u = best_u;

  // --- BRUSH TYPE SPECIFIC MECHANICS & ORGANIC BRISTLE GRAIN ---
  if (seg.brush_type == 0u) {
    // === 0. MARU-FUDE (丸筆): Dynamic Animal-Hair Calligraphy Tuft with Clumping, Splay & Katabokashi ===
    // Continuous phase-locked hair bundle coordinates across the transverse ribbon
    let hair_phase = transverse_norm * 10.0 * 3.14159;
    let hair_phase_sub = transverse_norm * 18.0 * 3.14159;
    let bristle_groove = cos(hair_phase) * 0.22 + cos(hair_phase_sub) * 0.08;

    // Capillary clumping when wet vs splay & splitting when dry or moving fast
    let wet_clump = clamp(1.0 - seg.dryness * 1.2 - seg.bristle_splay * 0.6, 0.0, 1.0);
    let bristle_amp = (1.0 - wet_clump * 0.75) * (0.25 + seg.dryness * 0.65);
    let bristle_profile = 1.0 + bristle_groove * bristle_amp;

    // Split-hair filament gaps (Kasure 擦れ)
    let hair_split = smoothstep(0.15, 0.70, abs(sin(hair_phase * 0.5)));
    let splay_split = mix(1.0, hair_split, seg.bristle_splay * 0.65);

    // Authentic Katabokashi (片ぼかし): Trajectory curvature & stylus tilt shift pigment density to outer turn
    let kappa_shift = seg.curvature * 1.4 + seg.tilt_x * 0.75;
    let kata_profile = clamp(1.0 + transverse_norm * kappa_shift * 0.45, 0.45, 1.55);

    // Subtle paper grain modulation
    let paper_grain = 1.0 + (paper_fiber - 0.5) * 0.15 * (0.4 + seg.dryness * 0.6);

    weight = weight * bristle_profile * splay_split * kata_profile * paper_grain;

  } else if (seg.brush_type == 1u) {
    // === 1. MENSO (面相筆): Hairline Sable Needle with Tight Cohesive Core ===
    let needle_core = pow(1.0 - u, 1.6);
    weight = needle_core * 1.35;

  } else {
    // === 2. HAKE (刷毛): Broad Flat Wash with Discrete Parallel Bristle Bundles (筋目 Sujime) ===
    let hake_phase = transverse_norm * 14.0 * 3.14159;
    let hake_phase_sub = transverse_norm * 28.0 * 3.14159;
    let bundle_groove = cos(hake_phase) * 0.30 + cos(hake_phase_sub) * 0.12;

    let bundle_gaps = smoothstep(0.20, 0.75, abs(sin(hake_phase * 0.5)));
    let splay_gaps = mix(1.0, bundle_gaps, clamp(seg.dryness * 0.65 + seg.bristle_splay * 0.45, 0.0, 0.90));
    let striation_amp = clamp(0.25 + seg.dryness * 0.55 + seg.bristle_splay * 0.30, 0.15, 0.85);
    let hake_profile = clamp(1.0 + bundle_groove * striation_amp, 0.20, 1.60) * splay_gaps;

    weight = weight * hake_profile;
  }

  // --- PHYSICAL PAPER TOOTH KASURE (擦れ) GATING ---
  if (seg.dryness > 0.10) {
    let d_factor = (seg.dryness - 0.10) / 0.90;
    let tooth_threshold = 0.25 + (d_factor * 0.32) * uniforms.paper_roughness;
    let height_excess = paper_height - tooth_threshold;
    let tooth_gate = mix(1.0, smoothstep(-0.18, 0.18, height_excess), d_factor * 0.80);
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

  // --- WATER DEPOSITION ENVELOPE ---
  let target_water = seg.water_amount * weight * 0.60;
  cur_water.r = clamp(max(cur_water.r, target_water), 0.0, 1.25);
  cur_water.g = clamp(max(cur_water.g, target_water * 0.70 * (1.0 + paper_fiber * 0.5)), 0.0, 1.25);

  // =========================================================================
  // HYDRODYNAMIC WAKE VORTEX CIRCULATION & MOMENTUM INJECTION
  // =========================================================================
  let seg_vel = seg.velocity;
  let vel_mag = length(seg_vel);

  if (vel_mag > 0.001) {
    let dir_fwd = seg_vel / vel_mag;
    let dir_perp = vec2<f32>(-dir_fwd.y, dir_fwd.x);

    // 1. Forward displacement drag
    let u_fwd = seg_vel * (1.0 - u * u) * 0.45;

    // 2. Counter-Rotating Flank Vortex Pair (Tip Vortex Dipole)
    // Left flank (transverse < 0) curls CW, Right flank (transverse > 0) curls CCW
    let dipole_shape = -transverse_norm * exp(-2.5 * transverse_norm * transverse_norm);
    let u_dipole = dir_perp * (dipole_shape * vel_mag * 0.40 * weight);

    // 3. Trailing low-pressure wake suction
    let wake_shape = exp(-3.0 * transverse_norm * transverse_norm) * (1.0 - u);
    let u_wake = -dir_fwd * (wake_shape * vel_mag * 0.15 * weight);

    // 4. Multi-strand bristle micro-eddies
    let bristle_vort_phase = transverse_norm * 10.0 * 3.14159;
    let u_bristle = dir_perp * (sin(bristle_vort_phase) * 0.08 * vel_mag * weight);

    // 5. Curvature centrifugal curl
    let u_curve = dir_perp * (seg.curvature * 0.25 * vel_mag * weight);

    // Total hydrodynamic velocity contribution with non-zero curl (∇ × u ≠ 0)
    let u_hydro = u_fwd + u_dipole + u_wake + u_bristle + u_curve;
    let vel_blend = clamp(weight * 0.70, 0.0, 1.0);
    cur_vel = vec4<f32>(mix(cur_vel.xy, u_hydro, vel_blend), 0.0, 0.0);
  }

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
      // Balanced core anchoring and suspended wake flow
      let pin_ratio = clamp(0.35 + (1.0 - seg.water_amount) * 0.35, 0.20, 0.65);
      let target_pin_k = target_k * pin_ratio;
      let target_pin_s = target_s * pin_ratio;
      let target_susp_k = target_k * (1.0 - pin_ratio);
      let target_susp_s = target_s * (1.0 - pin_ratio);

      let needed_pin_k = max(target_pin_k - cur_pinned_k.rgb, vec3<f32>(0.0));
      let needed_pin_s = max(target_pin_s - cur_pinned_s.rgb, vec3<f32>(0.0));
      cur_pinned_k = vec4<f32>(cur_pinned_k.rgb + needed_pin_k, max(cur_pinned_k.a, p_props.coarse_ratio));
      cur_pinned_s = vec4<f32>(cur_pinned_s.rgb + needed_pin_s, cur_pinned_s.a);

      let headroom_k = max(target_susp_k - cur_pinned_k.rgb, vec3<f32>(0.0));
      let headroom_s = max(target_susp_s - cur_pinned_s.rgb, vec3<f32>(0.0));
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
