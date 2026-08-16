// Brush Ingestion Compute Shader
// Ingests continuous swept-capsule and ribbon segments from Catmull-Rom spline interpolation,
// evaluating analytical distance unions for 4 authentic Japanese brush profiles:
// 0: Fude (標準筆 Classic Round), 1: Menso (面相筆 Fine Liner), 2: Hake (刷毛 Broad Flat Wash), 3: Fuki-e (吹き絵 Splatter).

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> segments: array<BrushSegment>;

@group(0) @binding(2) var in_velocity: texture_2d<f32>;
@group(0) @binding(3) var out_velocity: texture_storage_2d<rgba16float, write>;

@group(0) @binding(4) var in_water: texture_2d<f32>;
@group(0) @binding(5) var out_water: texture_storage_2d<rgba16float, write>;

@group(0) @binding(6) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(7) var out_pigment_susp: texture_storage_2d<rgba16float, write>;

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(coord.x) + 0.5, f32(coord.y) + 0.5);

  // Load existing values from input textures
  var vel = textureLoad(in_velocity, coord, 0);
  var water = textureLoad(in_water, coord, 0);
  var susp = textureLoad(in_pigment_susp, coord, 0);

  let num_segments = uniforms.segment_count;
  if (num_segments > 0u) {
    var min_norm_dist: f32 = 9999.0;
    var best_seg_idx: u32 = 0u;
    var best_t: f32 = 0.0;

    // Find closest segment in the continuous stroke envelope
    for (var i = 0u; i < num_segments; i = i + 1u) {
      let seg = segments[i];
      var t: f32 = 0.0;
      let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
      let r = mix(seg.radius0, seg.radius1, t);
      
      var norm_d = dist / max(r, 0.001);

      // Elliptical deformation for Hake flat brush (brush_type == 2)
      if (seg.brush_type == 2u) {
        let seg_mid = mix(seg.p0, seg.p1, t);
        let delta = pos - seg_mid;
        let cos_a = cos(seg.azimuth);
        let sin_a = sin(seg.azimuth);
        let rot_x = delta.x * cos_a + delta.y * sin_a;
        let rot_y = -delta.x * sin_a + delta.y * cos_a;
        let aspect = max(seg.aspect_ratio, 0.25);
        norm_d = sqrt((rot_x * rot_x) / max(r * r, 0.001) + (rot_y * rot_y) / max(r * r * aspect * aspect, 0.001));
      }

      if (norm_d < min_norm_dist) {
        min_norm_dist = norm_d;
        best_seg_idx = i;
        best_t = t;
      }
    }

    // Apply continuous brush envelope deposit
    if (min_norm_dist <= 1.0) {
      let seg = segments[best_seg_idx];
      var weight = (1.0 - min_norm_dist * min_norm_dist) * (1.0 - min_norm_dist * min_norm_dist);

      // --- 1. Brush Profile Specializations ---
      if (seg.brush_type == 1u) {
        // === MENSO (面相筆 Fine Detail Liner) ===
        // Needle precision: sharper falloff, tight edge definition
        weight = smoothstep(1.0, 0.15, min_norm_dist);
      } else if (seg.brush_type == 2u) {
        // === HAKE (刷毛 Broad Flat Wash) ===
        // Parallel bristle striation grooves
        let seg_mid = mix(seg.p0, seg.p1, best_t);
        let delta = pos - seg_mid;
        let cos_a = cos(seg.azimuth);
        let sin_a = sin(seg.azimuth);
        let rot_x = delta.x * cos_a + delta.y * sin_a;
        
        let bristle_freq = 0.85;
        let bristle_noise = sin(rot_x * bristle_freq + hash12(vec2<f32>(floor(rot_x * 0.5), 0.0)) * 6.28) * 0.5 + 0.5;
        let kasure_factor = seg.bristle_splay;
        weight = weight * mix(1.0, pow(bristle_noise, 1.6), kasure_factor * 0.7);

      } else if (seg.brush_type == 3u) {
        // === FUKI-E (吹き絵 Aerosol Ink Splatter) ===
        // Ballistic droplet dispersion and aerosol mist
        let spray_noise = hash12(pos * 0.65 + vec2<f32>(f32(best_seg_idx) * 19.3, uniforms.time * 29.0));
        let mist_density = (1.0 - min_norm_dist) * 0.45;
        let droplet_seed = hash12(floor(pos * 0.35) + vec2<f32>(f32(best_seg_idx) * 7.1, 0.0));
        
        if (droplet_seed > 0.78) {
          // Discrete satellite ink splatter droplet
          let drop_center = (floor(pos * 0.35) + 0.5) / 0.35;
          let drop_dist = length(pos - drop_center);
          let drop_r = 1.0 + (droplet_seed - 0.78) * 16.0;
          let drop_w = smoothstep(drop_r, 0.0, drop_dist);
          weight = max(mist_density, drop_w * 1.5);
        } else if (spray_noise > 0.60) {
          weight = mist_density * (spray_noise - 0.60) * 2.5;
        } else {
          weight = mist_density * 0.15;
        }
      }

      // Dry Brush (Kasure 擦れ) fiber tooth masking
      if (seg.bristle_splay > 0.15 && seg.brush_type != 3u) {
        let dry_noise = hash12(pos * 0.45);
        let kasure_thresh = seg.bristle_splay * 0.5;
        if (dry_noise < kasure_thresh) {
          weight = weight * smoothstep(0.0, kasure_thresh, dry_noise);
        }
      }

      if (seg.pigment_id == 6u) {
        // === SALT GRANULATION TOOL (塩) ===
        let salt_seed = hash12(pos * 0.73 + vec2<f32>(f32(best_seg_idx) * 17.3, uniforms.time * 23.1));
        if (salt_seed > 0.70) {
          let kernel_strength = (salt_seed - 0.70) * 3.33 * weight * uniforms.salt_intensity;
          water.b = min(water.b + kernel_strength * 1.5, 3.0);
        }
      } else {
        // === PIGMENT & WATER INJECTION ===
        var vel_scale: f32 = 0.45;
        if (seg.brush_type == 1u) {
          vel_scale = 0.25;
        } else if (seg.brush_type == 2u) {
          vel_scale = 0.65;
        }
        let vel_boost = seg.velocity * weight * vel_scale;
        vel = vec4<f32>(vel.xy + vel_boost, vel.z, vel.w);

        var water_scale: f32 = 0.75;
        if (seg.brush_type == 1u) {
          water_scale = 0.4;
        } else if (seg.brush_type == 2u) {
          water_scale = 1.1;
        }
        let water_add = seg.water_amount * weight * water_scale;
        water.r = min(water.r + water_add, 4.0);
        water.a = min(water.a + water_add * 0.5, 1.0);

        var dens_mult: f32 = 1.0;
        if (seg.brush_type == 1u) {
          dens_mult = 1.25;
        }
        let dens = seg.pigment_density * weight * dens_mult;
        if (seg.pigment_id == 0u) { // Sumi (Carbon Soot)
          susp.r = min(susp.r + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 1u) { // Shu (Vermilion)
          susp.g = min(susp.g + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 2u) { // Ai (Indigo)
          susp.b = min(susp.b + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 3u) { // Oudo (Yellow Ochre)
          susp.a = min(susp.a + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 4u) { // Rokusho (Malachite Green)
          susp.r = min(susp.r + dens * 0.35, 4.0);
          susp.g = min(susp.g + dens * 0.35, 4.0);
          susp.b = min(susp.b + dens * 0.15, 4.0);
        }
      }
    }
  }

  // Store updated buffers
  textureStore(out_velocity, coord, vel);
  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp, coord, susp);
}
