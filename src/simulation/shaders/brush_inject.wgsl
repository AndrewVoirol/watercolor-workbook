// Brush Ingestion Compute Shader
// Physically-based continuous swept envelope, dynamic ink reservoir depletion,
// Washi paper tooth kasure gating, Menso direct fiber pinning, and coherent Hake ribbon striations.
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

@group(0) @binding(8) var in_pigment_pinned: texture_2d<f32>;
@group(0) @binding(9) var out_pigment_pinned: texture_storage_2d<rgba16float, write>;

@group(0) @binding(10) var in_parchment: texture_2d<f32>;

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

// Deterministic Worley cellular droplet synthesis with directional elongation
fn directional_droplets(pos: vec2<f32>, center: vec2<f32>, vel_dir: vec2<f32>, scale: f32, seed: f32) -> f32 {
  let delta = pos - center;
  // Elongate droplets along flight velocity vector
  let v_len = length(vel_dir);
  var stretch = 1.0;
  var proj_delta = delta;
  if (v_len > 0.1) {
    let u_dir = vel_dir / v_len;
    let perp_dir = vec2<f32>(-u_dir.y, u_dir.x);
    let par = dot(delta, u_dir);
    let perp = dot(delta, perp_dir);
    proj_delta = u_dir * (par * 0.65) + perp_dir * (perp * 1.35);
  }

  let st = (center + proj_delta) * scale;
  let i_st = floor(st);
  let f_st = fract(st);

  var max_droplet: f32 = 0.0;

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let neighbor = vec2<f32>(f32(x), f32(y));
      let cell_id = i_st + neighbor + vec2<f32>(seed * 11.3, seed * 17.7);
      let point = hash22(cell_id);
      
      let has_drop = hash12(cell_id * 1.73);
      if (has_drop > 0.42) {
        let diff = neighbor + point - f_st;
        let dist = length(diff) / scale;
        // Multi-scale droplet sizes (power-law distribution)
        let drop_size_rnd = hash12(cell_id * 3.19);
        var drop_radius: f32 = 0.8;
        if (drop_size_rnd > 0.88) {
          drop_radius = 3.5 + drop_size_rnd * 4.5; // Heavy core droplet
        } else if (drop_size_rnd > 0.55) {
          drop_radius = 1.6 + drop_size_rnd * 1.8; // Medium droplet
        } else {
          drop_radius = 0.6 + drop_size_rnd * 0.8; // Satellite bead
        }

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
  var pinned = textureLoad(in_pigment_pinned, coord, 0);
  let parchment = textureLoad(in_parchment, coord, 0);

  let paper_height = parchment.r;
  let paper_fiber = parchment.g;

  let num_segments = uniforms.segment_count;
  if (num_segments > 0u) {
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
        // === 1. MENSO (面相筆 Fine Sable Detail Liner) ===
        // Hairline precision with needle-sharp profile
        let menso_r = max(r, 0.9);
        if (dist <= menso_r) {
          let norm_d = dist / menso_r;
          seg_weight = pow(smoothstep(1.0, 0.0, norm_d), 2.2);
        }

      } else if (seg.brush_type == 2u) {
        // === 2. HAKE (刷毛 Broad Flat Wash Ribbon) ===
        // Coherent multi-bristle parametric tracks across ribbon width
        let seg_pt = mix(seg.p0, seg.p1, t);
        let delta = pos - seg_pt;
        let cos_a = cos(seg.azimuth);
        let sin_a = sin(seg.azimuth);
        
        let width_coord = delta.x * cos_a + delta.y * sin_a;
        let thick_coord = -delta.x * sin_a + delta.y * cos_a;

        let aspect = max(seg.aspect_ratio, 0.22);
        let norm_w = abs(width_coord) / max(r * 1.25, 0.001);
        let norm_h = abs(thick_coord) / max(r * 1.25 * aspect, 0.001);

        let elliptical_d = sqrt(norm_w * norm_w + norm_h * norm_h);
        if (elliptical_d <= 1.0) {
          var w = pow(1.0 - elliptical_d * elliptical_d, 1.4);
          
          // Coherent bristle bundle tracks across flat ribbon
          let bristle_freq = 0.55;
          let bristle_ridge = sin(width_coord * bristle_freq) * 0.5 + 0.5;
          let kasure = seg.bristle_splay;
          
          // Striations become distinct grooves as brush dries out
          let bristle_mod = mix(1.0, pow(bristle_ridge, 1.6), clamp(kasure * 1.2, 0.0, 0.95));
          seg_weight = w * bristle_mod;
        }

      } else if (seg.brush_type == 3u) {
        // === 3. FUKI-E (吹き絵 Organic Splatter & Aerosol Mist) ===
        let spray_r = r * 2.4;
        if (dist <= spray_r) {
          let norm_d = dist / spray_r;
          let mist_falloff = smoothstep(1.0, 0.0, norm_d);
          let seg_pt = mix(seg.p0, seg.p1, t);
          
          // Deterministic seed based on segment position (no time-based boiling)
          let seed = hash12(seg.p0 * 0.17 + vec2<f32>(f32(i) * 13.7, 0.0));
          
          // Directional teardrop splatter droplets
          let drops = directional_droplets(pos, seg_pt, seg.velocity, 0.06, seed);
          
          // Ambient aerosol mist
          let aerosol_hash = hash12(pos * 0.28 + vec2<f32>(seed * 23.1, 0.0));
          let mist = smoothstep(0.55, 0.95, aerosol_hash) * mist_falloff * 0.35;
          
          seg_weight = max(mist, drops * smoothstep(1.0, 0.05, norm_d));
        }

      } else {
        // === 0. FUDE (標準筆 Classic Calligraphic Round) ===
        if (dist <= r) {
          let norm_d = dist / max(r, 0.001);
          seg_weight = pow(1.0 - norm_d * norm_d, 2.0);
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

      // --- PHYSICAL PAPER TOOTH KASURE (擦れ) GATING ---
      // When brush is drying or low dilution, pigment only catches on paper heightmap peaks
      if (seg.dryness > 0.06 && seg.brush_type != 3u) {
        let tooth_threshold = clamp(seg.dryness * 0.65, 0.0, 0.7);
        let height_excess = paper_height - tooth_threshold;
        let tooth_gate = smoothstep(-0.15, 0.25, height_excess);
        weight = weight * tooth_gate;
      }

      if (seg.pigment_id == 6u) {
        // === SALT GRANULATION TOOL (塩) ===
        let salt_seed = hash12(pos * 0.73 + vec2<f32>(f32(best_seg_idx) * 17.3, 0.0));
        if (salt_seed > 0.62) {
          let kernel_strength = (salt_seed - 0.62) * 3.2 * weight * uniforms.salt_intensity;
          water.b = min(water.b + kernel_strength * 1.6, 3.0);
        }
      } else {
        // === PIGMENT & FLUID INJECTION ===
        var vel_scale: f32 = 0.35;
        if (seg.brush_type == 1u) {
          vel_scale = 0.05; // Menso has negligible fluid momentum
        } else if (seg.brush_type == 2u) {
          vel_scale = 0.45; // Hake has smooth laminar wash flow
        } else if (seg.brush_type == 3u) {
          vel_scale = 0.12;
        }
        let vel_boost = seg.velocity * weight * vel_scale;
        vel = vec4<f32>(vel.xy + vel_boost, vel.z, vel.w);

        var water_scale: f32 = 0.65;
        if (seg.brush_type == 1u) {
          water_scale = 0.08; // Menso injects minimal free water to prevent smudging
        } else if (seg.brush_type == 2u) {
          water_scale = 0.95;
        } else if (seg.brush_type == 3u) {
          water_scale = 0.45;
        }
        let water_add = seg.water_amount * weight * water_scale;
        water.r = min(water.r + water_add, 4.0);
        water.a = min(water.a + water_add * 0.5, 1.0);

        var dens_mult: f32 = 1.0;
        if (seg.brush_type == 1u) {
          dens_mult = 1.65; // High optical density for hairlines
        } else if (seg.brush_type == 3u) {
          dens_mult = 1.25;
        }
        let total_dens = seg.pigment_density * weight * dens_mult;

        // --- DIRECT FIBER PINNING VS SUSPENSION ---
        // Menso and dry-brush strokes bind directly to fibers (pinned layer) to prevent fluid blur
        var pin_ratio: f32 = 0.0;
        if (seg.brush_type == 1u) {
          pin_ratio = 0.88; // 88% direct fiber pinning for Menso
        } else if (seg.dryness > 0.4) {
          pin_ratio = clamp((seg.dryness - 0.4) * 1.5, 0.0, 0.85); // Dry brush catches and pins to paper peaks
        }

        let pinned_dens = total_dens * pin_ratio;
        let susp_dens = total_dens * (1.0 - pin_ratio);

        // Apply to pinned layer
        if (pinned_dens > 0.0001) {
          if (seg.pigment_id == 0u) { // Sumi
            pinned.r = min(pinned.r + pinned_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 1u) { // Shu
            pinned.g = min(pinned.g + pinned_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 2u) { // Ai
            pinned.b = min(pinned.b + pinned_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 3u) { // Oudo
            pinned.a = min(pinned.a + pinned_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 4u) { // Rokusho
            pinned.r = min(pinned.r + pinned_dens * 0.35, 4.0);
            pinned.g = min(pinned.g + pinned_dens * 0.35, 4.0);
            pinned.b = min(pinned.b + pinned_dens * 0.15, 4.0);
          }
        }

        // Apply to suspended layer
        if (susp_dens > 0.0001) {
          if (seg.pigment_id == 0u) { // Sumi
            susp.r = min(susp.r + susp_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 1u) { // Shu
            susp.g = min(susp.g + susp_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 2u) { // Ai
            susp.b = min(susp.b + susp_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 3u) { // Oudo
            susp.a = min(susp.a + susp_dens * 0.85, 4.0);
          } else if (seg.pigment_id == 4u) { // Rokusho
            susp.r = min(susp.r + susp_dens * 0.35, 4.0);
            susp.g = min(susp.g + susp_dens * 0.35, 4.0);
            susp.b = min(susp.b + susp_dens * 0.15, 4.0);
          }
        }
      }
    }
  }

  // Store updated buffers
  textureStore(out_velocity, coord, vel);
  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp, coord, susp);
  textureStore(out_pigment_pinned, coord, pinned);
}
