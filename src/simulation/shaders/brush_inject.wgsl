// WebGPU Compute Shader for Swept Spline Ribbon & 3D Elastic Guide Bristle Injection
// Rasterizes Catmull-Rom sub-step spline segments and 3D guide rods with maximum envelope weighting,
// multi-harmonic micro-striations (Sujime), directional bast fiber tooth gating (Kasure),
// curvature Katabokashi lateral modulation, and two-tier moisture-coupled physical pigment transport.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> segments: array<BrushSegment, 512>;
@group(0) @binding(2) var<storage, read> guide_segments: array<GuideBristleSegment, 48>;

@group(0) @binding(3) var in_velocity: texture_2d<f32>;
@group(0) @binding(4) var out_velocity: texture_storage_2d<rgba16float, write>;

@group(0) @binding(5) var in_water: texture_2d<f32>;
@group(0) @binding(6) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(7) var in_pigment_susp_k: texture_2d<f32>;
@group(0) @binding(8) var out_pigment_susp_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(9) var in_pigment_susp_s: texture_2d<f32>;
@group(0) @binding(10) var out_pigment_susp_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(11) var in_pigment_pinned_k: texture_2d<f32>;
@group(0) @binding(12) var out_pigment_pinned_k: texture_storage_2d<rgba16float, write>;

@group(0) @binding(13) var in_pigment_pinned_s: texture_2d<f32>;
@group(0) @binding(14) var out_pigment_pinned_s: texture_storage_2d<rgba16float, write>;

@group(0) @binding(15) var in_parchment: texture_2d<f32>;

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

  if (uniforms.brush_active == 0u && uniforms.segment_count == 0u) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  var max_stroke_weight: f32 = 0.0;
  var accum_water: f32 = 0.0;
  var accum_pigment: f32 = 0.0;
  var accum_vel = vec2<f32>(0.0);
  var active_pigment_id: u32 = 0u;
  var active_brush_type: u32 = 0u;

  // --- PASS 1: Continuous Catmull-Rom Swept Spline Ribbon Segments ---
  let seg_limit = min(uniforms.segment_count, 512u);
  if (seg_limit > 0u) {
    for (var i = 0u; i < seg_limit; i = i + 1u) {
      let seg = segments[i];
      let b_type = seg.brush_type & 0x0fu;
      let is_stroke_start = (seg.brush_type & 0x10u) != 0u;
      let is_stroke_end = (seg.brush_type & 0x20u) != 0u;

      let rod_vec = seg.p1 - seg.p0;
      let rod_len = length(rod_vec);
      let max_r = max(seg.radius0, seg.radius1);
      let seg_r = max_r * 1.6 + 6.0;
      let min_x = min(seg.p0.x, seg.p1.x) - seg_r;
      let max_x = max(seg.p0.x, seg.p1.x) + seg_r;
      let min_y = min(seg.p0.y, seg.p1.y) - seg_r;
      let max_y = max(seg.p0.y, seg.p1.y) + seg_r;

      if (pos.x < min_x || pos.x > max_x || pos.y < min_y || pos.y > max_y) {
        continue;
      }

      var t: f32 = 0.0;
      let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
      let r = mix(seg.radius0, seg.radius1, t);

      // Longitudinal and transverse coordinate tracking along the continuous swept ribbon
      var transverse_coord: f32 = 0.0;
      var long_coord: f32 = 0.0;
      let is_stationary_tap = (rod_len < 1.0);
      var cap_angle: f32 = 0.0;
      var is_in_cap: bool = false;

      if (is_stationary_tap) {
        let p_vec = pos - seg.p0;
        cap_angle = atan2(p_vec.y, p_vec.x);
        is_in_cap = true;
      } else {
        let rod_dir = rod_vec / rod_len;
        let rod_norm = vec2<f32>(-rod_dir.y, rod_dir.x);
        long_coord = dot(pos - seg.p0, rod_dir);

        if (t <= 0.0) {
          let p0_vec = pos - seg.p0;
          cap_angle = atan2(p0_vec.y, p0_vec.x);
          transverse_coord = sin(cap_angle - atan2(rod_dir.y, rod_dir.x));
          is_in_cap = true;
        } else if (t >= 1.0) {
          let p1_vec = pos - seg.p1;
          cap_angle = atan2(p1_vec.y, p1_vec.x);
          transverse_coord = sin(cap_angle - atan2(rod_dir.y, rod_dir.x));
          is_in_cap = true;
        } else {
          transverse_coord = clamp(dot(pos - seg.p0, rod_norm) / max(r, 0.001), -1.0, 1.0);
        }
      }
      let stroke_arc_len = seg.burst_seed + long_coord;

      // 1. Multi-Harmonic Bristle Perimeter Fringe (Fude-ashi 筆足)
      // Preserves organic tuft irregularity without geometric pill/capsule vectors
      let fringe_noise = value_noise(pos * 0.12 + vec2<f32>(seg.burst_seed * 0.02, 11.3));
      var bristle_ripple: f32 = 0.0;
      if (is_in_cap) {
        bristle_ripple = sin(cap_angle * 9.0 + stroke_arc_len * 0.04) * 0.05 +
                         cos(cap_angle * 19.0 - stroke_arc_len * 0.03) * 0.03;
      } else {
        bristle_ripple = sin(transverse_coord * 8.0 + stroke_arc_len * 0.08) * 0.05 +
                         cos(transverse_coord * 16.0 - stroke_arc_len * 0.05) * 0.03;
      }
      let edge_roughness = (fringe_noise - 0.5) * 0.18 + bristle_ripple;
      let r_eff = max(r * (1.0 + edge_roughness), 0.4);

      if (dist < r_eff * 1.12) {
        let u = clamp(dist / max(r_eff, 0.001), 0.0, 1.0);

        // 2. Multi-filament micro-striations (Sujime 筋目)
        var striation = 1.0;
        if (is_stationary_tap) {
          // Radial bristle dispersion for stationary tuft contact
          let radial_h = cos(cap_angle * 8.0) * 0.5 + 0.5;
          striation = 1.0 - 0.16 * (1.0 - radial_h);
        } else {
          let filament_freq = select(4.2, select(2.8, 11.0, b_type == 2u), b_type == 1u);
          let micro_wave = sin(stroke_arc_len * 0.045 + transverse_coord * 1.5) * 0.07;
          let perturbed_trans = transverse_coord + micro_wave;

          let h1 = cos(perturbed_trans * filament_freq * 3.14159265);
          let h2 = cos(perturbed_trans * (filament_freq * 1.732) * 3.14159265 + stroke_arc_len * 0.018);
          let h3 = sin(perturbed_trans * (filament_freq * 2.85) * 3.14159265 - stroke_arc_len * 0.03);

          let striation_depth = clamp(0.18 + seg.bristle_splay * 0.40 + seg.dryness * 0.35, 0.12, 0.70);
          let raw_striation = (h1 * 0.50 + h2 * 0.35 + h3 * 0.15) * 0.5 + 0.5;
          striation = clamp(1.0 - striation_depth * (1.0 - raw_striation), 0.05, 1.0);
        }

        // Curvature Katabokashi lateral modulation
        let curvature_mod = clamp(1.0 + transverse_coord * seg.curvature * 0.35, 0.70, 1.30);

        // 3. Directional Bast Fiber Tooth Gating with Substrate Grain Anisotropy (Kasure 渇筆)
        let fiber_angle = parchment.a * 6.2831853 - 3.14159265;
        let stroke_angle = select(atan2(rod_vec.y, rod_vec.x), 0.0, rod_len <= 0.01);
        let cross_grain_shear = abs(sin(stroke_angle - fiber_angle));
        let anisotropic_tooth_height = paper_height + cross_grain_shear * 0.14 * (parchment.g - 0.5);

        // Physical contact pressure: high at core (u < 0.45), tapering at perimeter (u -> 1.0)
        let dry_factor = clamp(max(seg.dryness, select(0.0, (0.22 - uniforms.water_dilution) / 0.22, uniforms.water_dilution < 0.22)), 0.0, 1.0);
        let local_pressure = (1.0 - u * u) * clamp(1.0 - dry_factor * 0.65, 0.05, 1.0);

        // Tooth penetration:
        // Dense stroke core (local_pressure > 0.45) covers paper solidly;
        // Outer perimeter (u > 0.55) adheres to bast fiber peaks
        let tooth_peak_contact = (anisotropic_tooth_height - 0.5) * 0.90 + (parchment.g - 0.5) * 0.40;
        let penetration = local_pressure * 1.5 + tooth_peak_contact;
        let tooth_gate = smoothstep(0.12, 0.68, penetration);

        // 4. Multi-Filament Flick & Liftoff Dynamics (Inochi-ge 命毛)
        // Engages strictly on high-speed low-pressure liftoffs (FLAG_STROKE_END)
        let is_flick_tail = is_stroke_end && (r < 4.0);
        var flick_modifier: f32 = 1.0;
        if (is_flick_tail) {
          let liftoff_progress = clamp(t, 0.0, 1.0);
          let sheer_fade = clamp(r / 2.2, 0.15, 1.0) * (1.0 - liftoff_progress * liftoff_progress * 0.35);
          flick_modifier = sheer_fade;
        }

        let core_profile = (1.0 - u * u);
        let w_seg = core_profile * striation * curvature_mod * tooth_gate * flick_modifier;

        if (w_seg > max_stroke_weight) {
          max_stroke_weight = w_seg;
          active_pigment_id = seg.pigment_id;
          active_brush_type = b_type;
        }

        accum_water = max(accum_water, seg.water_amount * w_seg);
        accum_pigment = max(accum_pigment, seg.pigment_density * w_seg);

        let gv = seg.velocity;
        let gv_len = length(gv);
        if (gv_len > 0.001) {
          accum_vel = accum_vel + (gv / gv_len) * min(gv_len, 2.0) * (w_seg * 0.35);
        }
      }
    }
  }

  // --- PASS 2: 3D Guide Bristle Rods (For stationary dwell / contact blooms only) ---
  let g_vel_mag = length(guide_segments[0].velocity);
  if (seg_limit == 0u && uniforms.brush_active == 1u && g_vel_mag < 0.001) {
    for (var k = 0u; k < NUM_RODS; k = k + 1u) {
      let g_seg = guide_segments[k];
      if (g_seg.meta_u.y == 0u) {
        continue;
      }

      let seg_r = max(g_seg.radii.x, g_seg.radii.y) * 1.5 + 4.0;
      let min_x = min(g_seg.p0.x, g_seg.p1.x) - seg_r;
      let max_x = max(g_seg.p0.x, g_seg.p1.x) + seg_r;
      let min_y = min(g_seg.p0.y, g_seg.p1.y) - seg_r;
      let max_y = max(g_seg.p0.y, g_seg.p1.y) + seg_r;

      if (pos.x < min_x || pos.x > max_x || pos.y < min_y || pos.y > max_y) {
        continue;
      }

      var t_g: f32 = 0.0;
      let dist_g = dist_and_t_to_segment(pos, g_seg.p0, g_seg.p1, &t_g);
      let r_g = mix(g_seg.radii.x, g_seg.radii.y, t_g);
      let press_g = mix(g_seg.pressures.x, g_seg.pressures.y, t_g);

      if (dist_g < r_g && press_g > 0.02) {
        let u_g = clamp(dist_g / max(r_g, 0.001), 0.0, 1.0);
        let tooth_penetration = press_g * 1.2 + (paper_height - 0.5) * 0.8;
        let tooth_gate = smoothstep(0.20, 0.80, tooth_penetration);
        let w_g = (1.0 - u_g * u_g) * tooth_gate * clamp(press_g * 1.1, 0.0, 1.5);

        if (w_g > max_stroke_weight) {
          max_stroke_weight = w_g;
          active_pigment_id = g_seg.meta_u.w;
          active_brush_type = g_seg.meta_u.z;
        }

        accum_water = max(accum_water, g_seg.flow_props.x * w_g);
        accum_pigment = max(accum_pigment, g_seg.flow_props.y * w_g);
      }
    }
  }

  if (max_stroke_weight <= 0.0001) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  // --- TWO-TIER MOISTURE & MASS-CONSERVING PIGMENT INJECTION ---
  let water_dil = uniforms.water_dilution;
  let is_wet_wash = water_dil > 0.40;

  var target_surf_water: f32 = 0.0;
  var target_cap_water: f32 = 0.0;

  if (is_wet_wash) {
    let excess_water = (water_dil - 0.40) / 0.60;
    target_surf_water = accum_water * (0.10 + excess_water * 0.70);
    target_cap_water = accum_water * 0.60 * (1.0 + paper_fiber * 0.30);
  } else {
    // Semi-dry / Dry calligraphy regime:
    // Minimal surface fluid puddle to preserve crisp linework while allowing capillary wicking into fibers
    target_surf_water = accum_water * 0.02 * water_dil;
    target_cap_water = accum_water * 0.35;
  }

  cur_water.r = clamp(max(cur_water.r, target_surf_water), 0.0, 1.30);
  cur_water.g = clamp(max(cur_water.g, target_cap_water), 0.0, 1.30);

  // Velocity injection for surface fluid
  let vel_mag = length(accum_vel);
  if (vel_mag > 0.001 && target_surf_water > 0.01) {
    let forward_dir = accum_vel / vel_mag;
    let forward_speed = min(vel_mag * 0.22, 1.2);
    let target_vel = forward_dir * forward_speed;
    let vel_blend = clamp(max_stroke_weight * 0.65, 0.0, 1.0);
    cur_vel = vec4<f32>(mix(cur_vel.xy, target_vel, vel_blend), 0.0, 0.0);
  }

  // Yobitsugi: Re-solubilization of pinned pigment by fresh surface water
  let pinned_density = length(cur_pinned_k.rgb);
  if (pinned_density > 0.005 && target_surf_water > 0.005) {
    let coarse_lock = clamp(1.0 - cur_pinned_k.a * 0.65, 0.25, 1.0);
    let remobilize_rate = select(
      clamp(target_surf_water * 0.35 * coarse_lock, 0.0, 0.30),
      clamp(target_surf_water * 1.50, 0.0, 0.95),
      uniforms.brush_active == 1u
    );
    let remobilized_k = cur_pinned_k.rgb * remobilize_rate;
    let remobilized_s = cur_pinned_s.rgb * remobilize_rate;

    cur_pinned_k = vec4<f32>(max(cur_pinned_k.rgb - remobilized_k, vec3<f32>(0.0)), cur_pinned_k.a);
    cur_pinned_s = vec4<f32>(max(cur_pinned_s.rgb - remobilized_s, vec3<f32>(0.0)), cur_pinned_s.a);
    cur_susp_k = vec4<f32>(min(cur_susp_k.rgb + remobilized_k, vec3<f32>(12.0)), cur_susp_k.a);
    cur_susp_s = vec4<f32>(min(cur_susp_s.rgb + remobilized_s, vec3<f32>(12.0)), cur_susp_s.a);
  }

  // Pigment deposition
  if (active_pigment_id >= 5u) {
    // Clear water wash (Mizu)
    cur_water.r = clamp(max(cur_water.r, accum_water * (0.35 + water_dil * 0.65)), 0.0, 1.50);
    cur_water.g = clamp(max(cur_water.g, accum_water * 0.70), 0.0, 1.50);
  } else {
    let p_props = get_physical_pigment_km(active_pigment_id);
    let wash_conc = accum_pigment * (0.50 + (1.0 - clamp(target_surf_water, 0.0, 1.0)) * 0.50);
    let target_k = p_props.K * wash_conc;
    let target_s = p_props.S * wash_conc;

    // Dynamic Pinning vs Suspension Partitioning:
    // Wet wash allows 35% in suspension for Marangoni flows & Tarashikomi bleed;
    // Dry / Calligraphy pins 88% immediately to fibers, retaining 12% in capillary suspension for subtle fiber wicking.
    let pin_fraction = select(0.88, select(0.65, 0.82, active_brush_type == 1u), is_wet_wash);
    let susp_fraction = 1.0 - pin_fraction;

    // Total headroom injection to prevent frame-boundary ratcheting (Skill 5.E)
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
