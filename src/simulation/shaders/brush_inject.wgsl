// WebGPU Compute Shader for 3D Elastic Guide Bristle Injection & Micro-Tooth Dynamics
// Rasterizes 48 continuous swept guide-hair segments, multi-filament sub-bristle striations (Sujime),
// true zero-floor paper tooth gating (Kasure), and two-tier moisture-coupled physical pigment transport.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> guide_segments: array<GuideBristleSegment, 48>;

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

const NUM_RODS: u32 = 48u;

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

  if (uniforms.brush_active == 0u) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  var max_hair_weight: f32 = 0.0;
  var accum_water: f32 = 0.0;
  var accum_pigment: f32 = 0.0;
  var accum_vel = vec2<f32>(0.0);
  var active_pigment_id: u32 = 0u;
  var active_brush_type: u32 = 0u;

  var active_count: f32 = 0.0;
  var centroid_p0 = vec2<f32>(0.0);
  var centroid_p1 = vec2<f32>(0.0);
  var centroid_r0: f32 = 0.0;
  var centroid_r1: f32 = 0.0;
  var centroid_press: f32 = 0.0;
  var centroid_flow = vec2<f32>(0.0);

  // --- PASS 0: Gather Active Cluster Statistics ---
  for (var i = 0u; i < NUM_RODS; i = i + 1u) {
    let seg = guide_segments[i];
    if (seg.meta_u.y == 1u) {
      active_brush_type = seg.meta_u.z;
      active_pigment_id = seg.meta_u.w;

      centroid_p0 = centroid_p0 + seg.p0;
      centroid_p1 = centroid_p1 + seg.p1;
      centroid_r0 = centroid_r0 + seg.radii.x;
      centroid_r1 = centroid_r1 + seg.radii.y;
      centroid_press = centroid_press + (seg.pressures.x + seg.pressures.y) * 0.5;
      centroid_flow = centroid_flow + seg.flow_props;
      active_count = active_count + 1.0;
    }
  }

  if (active_count <= 0.0) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  let cp0 = centroid_p0 / active_count;
  let cp1 = centroid_p1 / active_count;
  let avg_r0 = centroid_r0 / active_count;
  let avg_r1 = centroid_r1 / active_count;
  let avg_press = centroid_press / active_count;
  let avg_flow = centroid_flow / active_count;

  let water_dil = uniforms.water_dilution;
  let is_wet_wash = water_dil > 0.50;

  // Wet Wash Meniscus: only creates a master liquid pool when water dilution > 0.50
  if (is_wet_wash && (active_brush_type == 0u || active_brush_type == 1u)) {
    var max_spread_r0: f32 = avg_r0;
    var max_spread_r1: f32 = avg_r1;
    for (var k = 0u; k < NUM_RODS; k = k + 1u) {
      let g_seg = guide_segments[k];
      if (g_seg.meta_u.y == 1u) {
        max_spread_r0 = max(max_spread_r0, length(g_seg.p0 - cp0) + g_seg.radii.x * 0.65);
        max_spread_r1 = max(max_spread_r1, length(g_seg.p1 - cp1) + g_seg.radii.y * 0.65);
      }
    }

    var t_tuft: f32 = 0.0;
    let dist_tuft = dist_and_t_to_segment(pos, cp0, cp1, &t_tuft);
    let r_tuft = mix(max_spread_r0, max_spread_r1, t_tuft);
    if (dist_tuft < r_tuft) {
      let u_tuft = dist_tuft / max(r_tuft, 0.001);
      let tuft_mask = (1.0 - u_tuft * u_tuft) * (1.0 - u_tuft * u_tuft);
      let cohesion_gate = clamp((water_dil - 0.50) / 0.35, 0.0, 1.0);
      let tooth_penetration = avg_press * 0.90 + (paper_height - 0.5) * 0.8;
      let tooth_gate = smoothstep(0.15, 0.85, tooth_penetration);

      let w_tuft = tuft_mask * tooth_gate * cohesion_gate * 0.85;
      if (w_tuft > max_hair_weight) {
        max_hair_weight = w_tuft;
      }
      let w_dep = w_tuft * clamp(avg_press, 0.20, 1.4);
      accum_water = max(accum_water, avg_flow.x * w_dep);
      accum_pigment = max(accum_pigment, avg_flow.y * w_dep);
    }
  }

  // --- PASS 1: Discrete Guide-Hair Swept Micro-Capsules & Multi-Filament Striations ---
  for (var i = 0u; i < NUM_RODS; i = i + 1u) {
    let seg = guide_segments[i];
    if (seg.meta_u.y == 0u) {
      continue;
    }

    let seg_r = max(seg.radii.x, seg.radii.y) * 1.5 + 4.0;
    let min_x = min(seg.p0.x, seg.p1.x) - seg_r;
    let max_x = max(seg.p0.x, seg.p1.x) + seg_r;
    let min_y = min(seg.p0.y, seg.p1.y) - seg_r;
    let max_y = max(seg.p0.y, seg.p1.y) + seg_r;

    if (pos.x < min_x || pos.x > max_x || pos.y < min_y || pos.y > max_y) {
      continue;
    }

    var t: f32 = 0.0;
    let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
    let r = mix(seg.radii.x, seg.radii.y, t);
    let press = mix(seg.pressures.x, seg.pressures.y, t);

    if (dist < r) {
      let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
      
      // Multi-filament micro-striations with organic clumping & stochastic hair crossing (Sujime 筋目)
      let rod_vec = seg.p1 - seg.p0;
      let rod_len = length(rod_vec);
      var transverse_coord: f32 = u;
      var long_coord: f32 = 0.0;
      var rod_normal = vec2<f32>(0.0, 1.0);
      if (rod_len > 0.1) {
        let rod_dir = rod_vec / rod_len;
        rod_normal = vec2<f32>(-rod_dir.y, rod_dir.x);
        transverse_coord = dot(pos - seg.p0, rod_normal) / max(r, 0.001);
        long_coord = dot(pos - seg.p0, rod_dir);
      }
      
      let rod_phase = f32(seg.meta_u.x) * 13.3718;
      let filament_count = select(3.6, 2.0, active_brush_type == 1u);
      
      // Longitudinal wave drift: subtle microscopic fiber waviness along stroke arc length
      let micro_wave = sin(long_coord * 0.38 + rod_phase * 1.618) * 0.14;
      let perturbed_trans = transverse_coord + micro_wave;
      
      // Multi-harmonic clumping profile: breaks uniform parallel comb into irregular hair bundles
      let h1 = cos(perturbed_trans * filament_count * 3.14159265 + rod_phase);
      let h2 = cos(perturbed_trans * (filament_count * 1.732) * 3.14159265 + rod_phase * 2.718 + long_coord * 0.18);
      let clump_profile = clamp((h1 * 0.62 + h2 * 0.38) * 0.44 + 0.56, 0.0, 1.0);
      
      let hair_core = (1.0 - u * u) * clump_profile;

      // Authentic Zero-Floor Paper Tooth Gating (Kasure 渇筆)
      // Balanced tooth penetration: confident stroke body under normal pressure; tooth skipping on fast flicks / light pressure
      let tooth_penetration = press * 1.35 + (paper_height - 0.5) * 0.70;
      let dry_gate_thresh = select(0.28 - water_dil * 0.20, 0.04, is_wet_wash);
      let tooth_gate = smoothstep(dry_gate_thresh, 0.90, tooth_penetration);

      let w = hair_core * tooth_gate;

      if (w > max_hair_weight) {
        max_hair_weight = w;
      }

      let w_deposit = w * clamp(press * 1.25, 0.35, 1.6);
      accum_water = max(accum_water, seg.flow_props.x * w_deposit);
      accum_pigment = max(accum_pigment, seg.flow_props.y * w_deposit);

      let gv = seg.velocity;
      let gv_len = length(gv);
      if (gv_len > 0.001) {
        accum_vel = accum_vel + (gv / gv_len) * min(gv_len, 2.0) * (w * 0.35);
      }
    }
  }

  // --- PASS 2: Hake Flat Wash Continuous Ribbon Mesh Interpolation (Hake Only) ---
  if (active_brush_type == 2u) {
    for (var i = 0u; i < 47u; i = i + 1u) {
      let segA = guide_segments[i];
      let segB = guide_segments[i + 1u];

      if (segA.meta_u.y == 1u && segB.meta_u.y == 1u) {
        let mid_p0 = (segA.p0 + segB.p0) * 0.5;
        let mid_p1 = (segA.p1 + segB.p1) * 0.5;
        let span_dist = length(segB.p1 - segA.p1);

        let max_allowed_span = max(segA.radii.y, segB.radii.y) * 2.2;
        let span_r = min(max(span_dist * 0.75, max(segA.radii.y, segB.radii.y)), max_allowed_span);
        let min_x = min(mid_p0.x, mid_p1.x) - span_r;
        let max_x = max(mid_p0.x, mid_p1.x) + span_r;
        let min_y = min(mid_p0.y, mid_p1.y) - span_r;
        let max_y = max(mid_p0.y, mid_p1.y) + span_r;

        if (pos.x >= min_x && pos.x <= max_x && pos.y >= min_y && pos.y <= max_y) {
          var t_mid: f32 = 0.0;
          let dist_mid = dist_and_t_to_segment(pos, mid_p0, mid_p1, &t_mid);

          if (dist_mid < span_r) {
            let u_span = dist_mid / max(span_r, 0.001);
            let ribbon_core = 1.0 - u_span * u_span;

            let striation = cos(u_span * 32.0 * 3.14159) * 0.22 + 0.78;

            let avg_press = (segA.pressures.y + segB.pressures.y) * 0.5;
            let tooth_penetration = avg_press * 1.2 + (paper_height - 0.5) * 1.5;
            let tooth_gate = smoothstep(0.30, 1.0, tooth_penetration);

            let w_ribbon = ribbon_core * striation * tooth_gate * 0.85;
            if (w_ribbon > max_hair_weight) {
              max_hair_weight = w_ribbon;
            }

            accum_water = max(accum_water, (segA.flow_props.x + segB.flow_props.x) * 0.5 * w_ribbon);
            accum_pigment = max(accum_pigment, (segA.flow_props.y + segB.flow_props.y) * 0.5 * w_ribbon);
          }
        }
      }
    }
  }

  if (max_hair_weight <= 0.0001) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  // --- TWO-TIER MOISTURE & MASS-CONSERVING PIGMENT INJECTION ---
  var target_surf_water: f32 = 0.0;
  var target_cap_water: f32 = 0.0;

  if (is_wet_wash) {
    let excess_water = (water_dil - 0.50) / 0.50;
    target_surf_water = accum_water * (0.15 + excess_water * 0.65);
    target_cap_water = accum_water * 0.55 * (1.0 + paper_fiber * 0.35);
  } else {
    // Dry / Standard calligraphy regime: ZERO surface fluid puddle!
    // Moisture enters directly into fiber capillaries; bristle marks remain unblurred
    target_surf_water = 0.0;
    target_cap_water = accum_water * 0.12;
  }

  cur_water.r = clamp(max(cur_water.r, target_surf_water), 0.0, 1.20);
  cur_water.g = clamp(max(cur_water.g, target_cap_water), 0.0, 1.20);

  // Velocity injection: only for surface water when wet
  let vel_mag = length(accum_vel);
  if (vel_mag > 0.001 && is_wet_wash) {
    let forward_dir = accum_vel / vel_mag;
    let forward_speed = min(vel_mag * 0.22, 1.2);
    let target_vel = forward_dir * forward_speed;
    let vel_blend = clamp(max_hair_weight * 0.65, 0.0, 1.0);
    cur_vel = vec4<f32>(mix(cur_vel.xy, target_vel, vel_blend), 0.0, 0.0);
  }

  // Yobitsugi: Re-solubilization of pinned pigment by fresh surface water
  let pinned_density = length(cur_pinned_k.rgb);
  if (pinned_density > 0.005 && target_surf_water > 0.005) {
    let coarse_lock = clamp(1.0 - cur_pinned_k.a * 0.65, 0.25, 1.0);
    let remobilize_rate = clamp(target_surf_water * 0.40 * coarse_lock, 0.0, 0.35);
    let remobilized_k = cur_pinned_k.rgb * remobilize_rate;
    let remobilized_s = cur_pinned_s.rgb * remobilize_rate;

    cur_pinned_k = vec4<f32>(max(cur_pinned_k.rgb - remobilized_k, vec3<f32>(0.0)), cur_pinned_k.a);
    cur_pinned_s = vec4<f32>(max(cur_pinned_s.rgb - remobilized_s, vec3<f32>(0.0)), cur_pinned_s.a);
    cur_susp_k = vec4<f32>(min(cur_susp_k.rgb + remobilized_k, vec3<f32>(12.0)), cur_susp_k.a);
    cur_susp_s = vec4<f32>(min(cur_susp_s.rgb + remobilized_s, vec3<f32>(12.0)), cur_susp_s.a);
  }

  // Pigment deposition
  if (active_pigment_id >= 5u) {
    // Clear water wash
    cur_water.r = clamp(max(cur_water.r, accum_water * (0.30 + water_dil * 0.70)), 0.0, 1.50);
    cur_water.g = clamp(max(cur_water.g, accum_water * 0.65), 0.0, 1.50);
  } else {
    let p_props = get_physical_pigment_km(active_pigment_id);
    let wash_conc = accum_pigment * (0.45 + (1.0 - clamp(target_surf_water, 0.0, 1.0)) * 0.55);
    let target_k = p_props.K * wash_conc;
    let target_s = p_props.S * wash_conc;

    // Basal fiber binding:
    // In dry/standard mode: 98% pins directly to paper peaks!
    // In wet wash mode: 65% pins, 35% suspended in surface pool for Tarashikomi & bleed
    let pin_fraction = select(0.98, select(0.65, 0.85, active_brush_type == 1u), is_wet_wash);
    let susp_fraction = 1.0 - pin_fraction;

    let needed_pinned_k = max(target_k * pin_fraction - cur_pinned_k.rgb, vec3<f32>(0.0));
    let needed_pinned_s = max(target_s * pin_fraction - cur_pinned_s.rgb, vec3<f32>(0.0));
    cur_pinned_k = vec4<f32>(cur_pinned_k.rgb + needed_pinned_k, max(cur_pinned_k.a, p_props.coarse_ratio));
    cur_pinned_s = vec4<f32>(cur_pinned_s.rgb + needed_pinned_s, cur_pinned_s.a);

    let needed_susp_k = max(target_k * susp_fraction - cur_susp_k.rgb, vec3<f32>(0.0));
    let needed_susp_s = max(target_s * susp_fraction - cur_susp_s.rgb, vec3<f32>(0.0));
    cur_susp_k = vec4<f32>(cur_susp_k.rgb + needed_susp_k, max(cur_susp_k.a, p_props.coarse_ratio));
    cur_susp_s = vec4<f32>(cur_susp_s.rgb + needed_susp_s, max(cur_susp_s.a, p_props.stokes_settle));
  }

  textureStore(out_velocity, coord, cur_vel);
  textureStore(out_water, coord, cur_water);
  textureStore(out_pigment_susp_k, coord, cur_susp_k);
  textureStore(out_pigment_susp_s, coord, cur_susp_s);
  textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
  textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
}
