// WebGPU Compute Shader for Hybrid Dual-Layer Brush Injection
// Layer 1: Continuous Catmull-Rom sub-pixel swept capsule envelopes for unbroken stroke flow at all gesture speeds.
// Layer 2: 3D PBD elastic guide bristle clusters for authentic paper tooth skip (Kasure) and striations (Sujime).

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> guide_segments: array<GuideBristleSegment, 48>;
@group(0) @binding(2) var<storage, read> brush_segments: array<BrushSegment, 512>;

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

  var max_envelope_weight: f32 = 0.0;
  var accum_water: f32 = 0.0;
  var accum_pigment: f32 = 0.0;
  var accum_vel = vec2<f32>(0.0);
  var active_pigment_id: u32 = 0u;
  var active_brush_type: u32 = 0u;

  // --- PASS 1: Continuous Catmull-Rom Spline Swept Capsule Envelopes (Core Continuous Layer) ---
  let seg_count = min(uniforms.segment_count, 512u);
  for (var i = 0u; i < seg_count; i = i + 1u) {
    let seg = brush_segments[i];
    active_brush_type = seg.brush_type;
    active_pigment_id = seg.pigment_id;

    let seg_r = max(seg.radius0, seg.radius1) * 1.5 + 4.0;
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

    if (dist < r) {
      let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
      let core = (1.0 - u * u) * (1.0 - u * u);

      // Micro-tooth paper interaction (Kasure dry brush tooth skip)
      let tooth_factor = 1.0 - seg.dryness * (1.0 - paper_height) * 0.85;
      let tooth_gate = clamp(tooth_factor, 0.05, 1.0);

      let w = core * tooth_gate;
      if (w > max_envelope_weight) {
        max_envelope_weight = w;
      }

      accum_water = max(accum_water, seg.water_amount * w);
      accum_pigment = max(accum_pigment, seg.pigment_density * w);

      // Tangential velocity accumulation
      let seg_v = seg.velocity;
      let v_len = length(seg_v);
      if (v_len > 0.001) {
        accum_vel = accum_vel + (seg_v / v_len) * min(v_len, 2.0) * (w * 0.40);
      }
    }
  }

  // --- PASS 2: Discrete Guide-Hair Swept Micro-Capsules & Micro-Tooth Gating ---
  for (var i = 0u; i < NUM_RODS; i = i + 1u) {
    let gseg = guide_segments[i];
    if (gseg.meta_u.y == 0u) { // not in contact
      continue;
    }

    if (seg_count == 0u) {
      active_brush_type = gseg.meta_u.z;
      active_pigment_id = gseg.meta_u.w;
    }

    let gseg_r = max(gseg.radii.x, gseg.radii.y) * 1.6 + 4.0;
    let min_x = min(gseg.p0.x, gseg.p1.x) - gseg_r;
    let max_x = max(gseg.p0.x, gseg.p1.x) + gseg_r;
    let min_y = min(gseg.p0.y, gseg.p1.y) - gseg_r;
    let max_y = max(gseg.p0.y, gseg.p1.y) + gseg_r;

    if (pos.x < min_x || pos.x > max_x || pos.y < min_y || pos.y > max_y) {
      continue;
    }

    var t: f32 = 0.0;
    let dist = dist_and_t_to_segment(pos, gseg.p0, gseg.p1, &t);
    let r = mix(gseg.radii.x, gseg.radii.y, t);
    let press = mix(gseg.pressures.x, gseg.pressures.y, t);

    if (dist < r) {
      let u = clamp(dist / max(r, 0.001), 0.0, 1.0);
      let hair_core = (1.0 - u * u) * (1.0 - u * u);

      let tooth_penetration = press * 0.90 - (1.0 - paper_height) * 0.45;
      let tooth_gate = clamp(tooth_penetration * 2.2 + 0.35, 0.05, 1.0);

      let w = hair_core * tooth_gate;
      if (w > max_envelope_weight) {
        max_envelope_weight = w;
      }

      let w_deposit = w * clamp(press, 0.20, 1.4);
      accum_water = max(accum_water, gseg.flow_props.x * w_deposit);
      accum_pigment = max(accum_pigment, gseg.flow_props.y * w_deposit);

      let gv = gseg.velocity;
      let gv_len = length(gv);
      if (gv_len > 0.001) {
        accum_vel = accum_vel + (gv / gv_len) * min(gv_len, 2.0) * (w * 0.35);
      }
    }
  }

  // --- PASS 3: Guide-Hair Continuous Ribbon Mesh Interpolation (Hake Rake Fix) ---
  if (active_brush_type == 2u || active_brush_type == 0u) {
    let rod_limit = select(35u, 47u, active_brush_type == 2u);

    for (var i = 0u; i < rod_limit; i = i + 1u) {
      let segA = guide_segments[i];
      let segB = guide_segments[i + 1u];

      if (segA.meta_u.y == 1u && segB.meta_u.y == 1u) {
        let mid_p0 = (segA.p0 + segB.p0) * 0.5;
        let mid_p1 = (segA.p1 + segB.p1) * 0.5;
        let span_dist = length(segB.p1 - segA.p1);

        let span_r = max(span_dist * 0.75, max(segA.radii.y, segB.radii.y) * 1.2);
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

            let striation_freq = select(18.0, 32.0, active_brush_type == 2u);
            let striation = cos(u_span * striation_freq * 3.14159) * 0.22 + 0.78;

            let avg_press = (segA.pressures.y + segB.pressures.y) * 0.5;
            let tooth_gate = clamp(avg_press * 1.5 - (1.0 - paper_height) * 0.5 + 0.3, 0.0, 1.0);

            let w_ribbon = ribbon_core * striation * tooth_gate * 0.85;
            if (w_ribbon > max_envelope_weight) {
              max_envelope_weight = w_ribbon;
            }

            accum_water = max(accum_water, (segA.flow_props.x + segB.flow_props.x) * 0.5 * w_ribbon);
            accum_pigment = max(accum_pigment, (segA.flow_props.y + segB.flow_props.y) * 0.5 * w_ribbon);
          }
        }
      }
    }
  }

  if (max_envelope_weight <= 0.0001) {
    textureStore(out_velocity, coord, cur_vel);
    textureStore(out_water, coord, cur_water);
    textureStore(out_pigment_susp_k, coord, cur_susp_k);
    textureStore(out_pigment_susp_s, coord, cur_susp_s);
    textureStore(out_pigment_pinned_k, coord, cur_pinned_k);
    textureStore(out_pigment_pinned_s, coord, cur_pinned_s);
    return;
  }

  // --- STRICT MASS-CONSERVING FLUID & PIGMENT INJECTION ---
  let target_water = accum_water * 0.85;
  cur_water.r = clamp(max(cur_water.r, target_water), 0.0, 1.60);
  cur_water.g = clamp(max(cur_water.g, target_water * 0.75 * (1.0 + paper_fiber * 0.5)), 0.0, 1.60);

  // Forward-only momentum coupling with smooth damping (eliminates reverse recoil)
  let vel_mag = length(accum_vel);
  if (vel_mag > 0.001) {
    let forward_dir = accum_vel / vel_mag;
    let forward_speed = min(vel_mag * 0.20, 1.2);
    let target_vel = forward_dir * forward_speed;
    let vel_blend = clamp(max_envelope_weight * 0.65, 0.0, 1.0);
    cur_vel = vec4<f32>(mix(cur_vel.xy, target_vel, vel_blend), 0.0, 0.0);
  }

  // Yobitsugi: Re-solubilization of pinned pigment by fresh water
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

  // Pigment deposition
  if (active_pigment_id >= 5u) {
    // Clear water wash
    cur_water.r = clamp(max(cur_water.r, target_water * 1.6), 0.0, 1.80);
    cur_water.g = clamp(max(cur_water.g, target_water * 1.3), 0.0, 1.80);
  } else {
    let p_props = get_physical_pigment_km(active_pigment_id);
    let wash_conc = accum_pigment * (0.35 + (1.0 - clamp(target_water, 0.0, 1.0)) * 0.65);
    let target_k = p_props.K * wash_conc;
    let target_s = p_props.S * wash_conc;

    if (active_brush_type == 1u) {
      // Menso fine liner pins directly into paper fibers
      let needed_pinned_k = max(target_k * 0.85 - cur_pinned_k.rgb, vec3<f32>(0.0));
      let needed_pinned_s = max(target_s * 0.85 - cur_pinned_s.rgb, vec3<f32>(0.0));
      cur_pinned_k = vec4<f32>(cur_pinned_k.rgb + needed_pinned_k, max(cur_pinned_k.a, p_props.coarse_ratio));
      cur_pinned_s = vec4<f32>(cur_pinned_s.rgb + needed_pinned_s, cur_pinned_s.a);

      let needed_susp_k = max(target_k * 0.15 - cur_susp_k.rgb, vec3<f32>(0.0));
      let needed_susp_s = max(target_s * 0.15 - cur_susp_s.rgb, vec3<f32>(0.0));
      cur_susp_k = vec4<f32>(cur_susp_k.rgb + needed_susp_k, max(cur_susp_k.a, p_props.coarse_ratio));
      cur_susp_s = vec4<f32>(cur_susp_s.rgb + needed_susp_s, max(cur_susp_s.a, p_props.stokes_settle));
    } else {
      // Standard pigment suspension into surface water
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
