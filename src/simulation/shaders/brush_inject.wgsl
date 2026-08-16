// Brush Ingestion Compute Shader
// Ingests continuous swept-capsule segments from Catmull-Rom spline interpolation,
// evaluating the analytical stroke envelope distance union to prevent curve-overlap bulging.
// Supports traditional mineral pigments, clear water washes, and coarse sea salt crystal scattering.

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

    // Find closest segment in the continuous stroke envelope
    for (var i = 0u; i < num_segments; i = i + 1u) {
      let seg = segments[i];
      var t: f32 = 0.0;
      let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
      let r = mix(seg.radius0, seg.radius1, t);
      let norm_d = dist / max(r, 0.001);

      if (norm_d < min_norm_dist) {
        min_norm_dist = norm_d;
        best_seg_idx = i;
      }
    }

    // Apply continuous brush envelope deposit exactly once per pixel
    if (min_norm_dist <= 1.0) {
      let weight = (1.0 - min_norm_dist * min_norm_dist) * (1.0 - min_norm_dist * min_norm_dist);
      let seg = segments[best_seg_idx];

      if (seg.pigment_id == 6u) {
        // === SALT GRANULATION TOOL (塩振り - Shio-furi) ===
        // Scatter discrete salt crystalline kernels across the brush footprint
        let salt_seed = hash12(pos * 0.73 + vec2<f32>(f32(best_seg_idx) * 17.3, uniforms.time * 23.1));
        if (salt_seed > 0.70) {
          let kernel_strength = (salt_seed - 0.70) * 3.33 * weight * uniforms.salt_intensity;
          // water.b stores active salt concentration
          water.b = min(water.b + kernel_strength * 1.5, 3.0);
        }
      } else {
        // === STANDARD PIGMENT & WATER BRUSH INJECTION ===
        // 1. Momentum injection (tangent velocity from continuous spline)
        let vel_boost = seg.velocity * weight * 0.45;
        vel = vec4<f32>(vel.xy + vel_boost, vel.z, vel.w);

        // 2. Surface water injection
        let water_add = seg.water_amount * weight * 0.75;
        water.r = min(water.r + water_add, 4.0); // Surface water height
        water.a = min(water.a + water_add * 0.5, 1.0); // Fiber saturation state

        // 3. Pigment concentration injection
        let dens = seg.pigment_density * weight;
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
        // If pigment_id == 5u (Clear Water), no pigment is added, only water and velocity momentum!
      }
    }
  }

  // Store updated buffers
  textureStore(out_velocity, coord, vel);
  textureStore(out_water, coord, water);
  textureStore(out_pigment_susp, coord, susp);
}
