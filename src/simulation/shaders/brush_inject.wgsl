// Brush Ingestion Compute Shader
// Physically-based continuous swept envelope and organic multi-bristle fluid injection
// 0: Fude (標準筆 Classic Round), 1: Menso (面相筆 Fine Liner), 2: Hake (刷毛 Broad Flat Wash), 3: Fuki-e (吹き絵 Organic Splatter).

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

// 3x3 Worley cellular droplet synthesis for grid-free organic splatter
fn worley_droplets(pos: vec2<f32>, scale: f32, seed_offset: f32) -> f32 {
  let st = pos * scale;
  let i_st = floor(st);
  let f_st = fract(st);

  var max_droplet: f32 = 0.0;

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let neighbor = vec2<f32>(f32(x), f32(y));
      let cell_id = i_st + neighbor + vec2<f32>(seed_offset, seed_offset * 1.37);
      let point = hash22(cell_id);
      
      // Determine if this cell contains a droplet
      let has_drop = hash12(cell_id * 1.73);
      if (has_drop > 0.45) {
        let diff = neighbor + point - f_st;
        let dist = length(diff) / scale;
        let drop_radius = 0.6 + hash12(cell_id * 3.19) * 4.5;
        let w = smoothstep(drop_radius, 0.0, dist);
        max_droplet = max(max_droplet, w);
      }
    }
  }
  return max_droplet;
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = vec2<i32>(uniforms.grid_size);
  let coord = vec2<i32>(global_id.xy);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(coord.x) + 0.5, f32(coord.y) + 0.5);

  // Load existing simulation state
  var vel = textureLoad(in_velocity, coord, 0);
  var water = textureLoad(in_water, coord, 0);
  var susp = textureLoad(in_pigment_susp, coord, 0);

  let num_segments = uniforms.segment_count;
  if (num_segments > 0u) {
    var min_dist: f32 = 9999.0;
    var best_seg_idx: u32 = 0u;
    var best_t: f32 = 0.0;
    var best_weight: f32 = 0.0;

    for (var i = 0u; i < num_segments; i = i + 1u) {
      let seg = segments[i];
      var t: f32 = 0.0;
      let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
      let r = mix(seg.radius0, seg.radius1, t);

      var seg_weight: f32 = 0.0;

      if (seg.brush_type == 1u) {
        // === MENSO (面相筆 Fine Sable Liner) ===
        // Hairline precision: narrow elastic radius, crisp ink concentration
        let menso_r = max(r * 0.45, 1.2);
        if (dist <= menso_r) {
          let norm_d = dist / menso_r;
          seg_weight = pow(smoothstep(1.0, 0.0, norm_d), 1.8);
        }

      } else if (seg.brush_type == 2u) {
        // === HAKE (刷毛 Broad Flat Wash Ribbon) ===
        // Oriented swept ribbon with parallel mountain goat hair striations
        let seg_pt = mix(seg.p0, seg.p1, t);
        let delta = pos - seg_pt;
        let cos_a = cos(seg.azimuth);
        let sin_a = sin(seg.azimuth);
        
        let width_coord = delta.x * cos_a + delta.y * sin_a;
        let thick_coord = -delta.x * sin_a + delta.y * cos_a;

        let aspect = max(seg.aspect_ratio, 0.3);
        let norm_w = abs(width_coord) / max(r * 1.35, 0.001);
        let norm_h = abs(thick_coord) / max(r * 1.35 * aspect, 0.001);

        let elliptical_d = sqrt(norm_w * norm_w + norm_h * norm_h);
        if (elliptical_d <= 1.0) {
          var w = pow(1.0 - elliptical_d * elliptical_d, 1.5);
          
          // Organic bristle groove noise across ribbon width
          let bristle_freq = 0.65;
          let bristle_pattern = sin(width_coord * bristle_freq + hash12(vec2<f32>(floor(width_coord * 0.4), 0.0)) * 6.28) * 0.5 + 0.5;
          let kasure = seg.bristle_splay;
          w = w * mix(1.0, pow(bristle_pattern, 1.8), kasure * 0.75);
          seg_weight = w;
        }

      } else if (seg.brush_type == 3u) {
        // === FUKI-E (吹き絵 Organic Blown-Ink Splatter & Mist) ===
        let spray_r = r * 2.8;
        if (dist <= spray_r) {
          let norm_d = dist / spray_r;
          let mist_falloff = smoothstep(1.0, 0.0, norm_d) * 0.35;
          
          // Organic cellular droplets (Worley-based)
          let drops = worley_droplets(pos, 0.08, f32(i) * 13.7 + uniforms.time * 2.0);
          
          // Ambient aerosol mist
          let aerosol = hash12(pos * 0.35 + vec2<f32>(f32(i) * 7.9, 0.0));
          let mist_noise = smoothstep(0.45, 0.95, aerosol) * mist_falloff * 0.6;
          
          seg_weight = max(mist_noise, drops * smoothstep(1.0, 0.1, norm_d));
        }

      } else {
        // === FUDE (標準筆 Classic Calligraphic Round) ===
        if (dist <= r) {
          let norm_d = dist / max(r, 0.001);
          seg_weight = (1.0 - norm_d * norm_d) * (1.0 - norm_d * norm_d);
        }
      }

      if (seg_weight > best_weight) {
        best_weight = seg_weight;
        best_seg_idx = i;
        best_t = t;
      }
    }

    // Apply accumulated brush fluid deposit
    if (best_weight > 0.001) {
      let seg = segments[best_seg_idx];
      var weight = best_weight;

      // Dry Brush (Kasure 擦れ) fiber tooth granulation
      if (seg.bristle_splay > 0.12 && seg.brush_type != 3u) {
        let dry_noise = hash12(pos * 0.55);
        let kasure_thresh = seg.bristle_splay * 0.45;
        if (dry_noise < kasure_thresh) {
          weight = weight * smoothstep(0.0, kasure_thresh, dry_noise);
        }
      }

      if (seg.pigment_id == 6u) {
        // === SALT GRANULATION TOOL (塩) ===
        let salt_seed = hash12(pos * 0.73 + vec2<f32>(f32(best_seg_idx) * 17.3, uniforms.time * 23.1));
        if (salt_seed > 0.65) {
          let kernel_strength = (salt_seed - 0.65) * 2.85 * weight * uniforms.salt_intensity;
          water.b = min(water.b + kernel_strength * 1.5, 3.0);
        }
      } else {
        // === PIGMENT & FLUID INJECTION ===
        var vel_scale: f32 = 0.45;
        if (seg.brush_type == 1u) {
          vel_scale = 0.2;
        } else if (seg.brush_type == 2u) {
          vel_scale = 0.7;
        } else if (seg.brush_type == 3u) {
          vel_scale = 0.15;
        }
        let vel_boost = seg.velocity * weight * vel_scale;
        vel = vec4<f32>(vel.xy + vel_boost, vel.z, vel.w);

        var water_scale: f32 = 0.75;
        if (seg.brush_type == 1u) {
          water_scale = 0.35;
        } else if (seg.brush_type == 2u) {
          water_scale = 1.15;
        } else if (seg.brush_type == 3u) {
          water_scale = 0.5;
        }
        let water_add = seg.water_amount * weight * water_scale;
        water.r = min(water.r + water_add, 4.0);
        water.a = min(water.a + water_add * 0.5, 1.0);

        var dens_mult: f32 = 1.0;
        if (seg.brush_type == 1u) {
          dens_mult = 1.35; // Dense concentrated hairline
        } else if (seg.brush_type == 3u) {
          dens_mult = 1.1;
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
