// Brush Ingestion Compute Shader
// Ingests continuous swept-capsule segments from Catmull-Rom spline interpolation,
// injecting fluid momentum, water volume, and suspended pigment concentrations.

#include "common.wgsl"

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> segments: array<BrushSegment>;

@group(0) @binding(2) var in_velocity: texture_2d<f32>;
@group(0) @binding(3) var out_velocity: texture_storage_2d<rgba32float, write>;

@group(0) @binding(4) var in_water: texture_2d<f32>;
@group(0) @binding(5) var out_water: texture_storage_2d<rgba32float, write>;

@group(0) @binding(6) var in_pigment_susp: texture_2d<f32>;
@group(0) @binding(7) var out_pigment_susp: texture_storage_2d<rgba32float, write>;

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
  if (uniforms.brush_active == 1u && num_segments > 0u) {
    for (var i = 0u; i < num_segments; i = i + 1u) {
      let seg = segments[i];
      var t: f32 = 0.0;
      let dist = dist_and_t_to_segment(pos, seg.p0, seg.p1, &t);
      let r = mix(seg.radius0, seg.radius1, t);

      if (dist <= r) {
        // Smooth parabolic falloff from center of brush stroke
        let norm_d = dist / max(r, 0.001);
        let weight = (1.0 - norm_d * norm_d) * (1.0 - norm_d * norm_d);

        // 1. Momentum injection (tangent velocity from spline derivative)
        let vel_boost = seg.velocity * weight * 0.45;
        vel = vec4<f32>(vel.xy + vel_boost, vel.z, vel.w);

        // 2. Water injection
        let water_add = seg.water_amount * weight * 0.75;
        water.r = min(water.r + water_add, 3.5); // Surface water height
        water.a = min(water.a + water_add * 0.5, 1.0); // Fiber saturation moisture

        // 3. Pigment concentration injection based on selected traditional pigment
        let dens = seg.pigment_density * weight;
        if (seg.pigment_id == 0u) { // Sumi (Carbon Soot)
          susp.r = min(susp.r + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 1u) { // Shu (Vermilion)
          susp.g = min(susp.g + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 2u) { // Ai (Indigo)
          susp.b = min(susp.b + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 3u) { // Oudo (Yellow Ochre)
          susp.a = min(susp.a + dens * 0.85, 4.0);
        } else if (seg.pigment_id == 4u) { // Rokusho (Malachite Green stored in water.g)
          water.g = min(water.g + dens * 0.85, 4.0);
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
