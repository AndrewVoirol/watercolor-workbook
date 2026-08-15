// Procedural Handmade Washi Parchment Compute Generator
// Generates natural Kozo fiber textures, paper heightmap, capillary absorption variation, and grain

@group(0) @binding(0) var out_parchment: texture_storage_2d<rgba8unorm, write>;

// Permutation polynomial hash
fn hash22(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D Value Noise with smooth hermite interpolation
fn value_noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash12(i + vec2<f32>(0.0, 0.0));
  let b = hash12(i + vec2<f32>(1.0, 0.0));
  let c = hash12(i + vec2<f32>(0.0, 1.0));
  let d = hash12(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion for paper organic surface variation
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2<f32>(100.0, 100.0);
  var pos = p;
  
  // 2D rotation matrix to reduce axis alignment
  let rot = mat2x2<f32>(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  
  for (var i = 0; i < octaves; i = i + 1) {
    v = v + a * value_noise(pos);
    pos = rot * pos * 2.02 + shift;
    a = a * 0.5;
  }
  return v;
}

// Long interwoven Kozo plant fibers for Japanese Washi paper
fn washi_fiber(p: vec2<f32>, seed: f32) -> f32 {
  var fiber = 0.0;
  let angle = (hash12(floor(p * 0.08) + seed) - 0.5) * 3.14159;
  let dir = vec2<f32>(cos(angle), sin(angle));
  
  // Stretched coordinates along fiber direction
  let uv_fiber = vec2<f32>(
    dot(p, dir) * 0.15,
    dot(p, vec2<f32>(-dir.y, dir.x)) * 1.8
  );
  
  let f = abs(value_noise(uv_fiber + seed * 17.1) - 0.5) * 2.0;
  fiber = 1.0 - smoothstep(0.0, 0.18, f);
  return fiber;
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = textureDimensions(out_parchment);
  if (global_id.x >= dims.x || global_id.y >= dims.y) {
    return;
  }

  let pos = vec2<f32>(f32(global_id.x), f32(global_id.y));
  let uv = pos / vec2<f32>(dims);

  // 1. Base paper height variation (macroscopic paper tooth and valleys)
  let base_height = fbm(pos * 0.035, 4);
  let fine_grain = fbm(pos * 0.18, 3);
  let heightmap = clamp(base_height * 0.7 + fine_grain * 0.3, 0.0, 1.0);

  // 2. Mulberry / Kozo fibers interwoven at various scales
  let fiber1 = washi_fiber(pos * 0.4, 1.0);
  let fiber2 = washi_fiber(pos * 0.6, 2.7);
  let fiber3 = washi_fiber(pos * 0.9, 4.3);
  let total_fibers = clamp(fiber1 * 0.5 + fiber2 * 0.35 + fiber3 * 0.25, 0.0, 1.0);

  // 3. Capillary capacity modulation (fibers hold more moisture and pull fluid faster)
  let capillary_density = clamp(0.4 + heightmap * 0.35 + total_fibers * 0.45, 0.0, 1.0);

  // 4. Granulation roughness (microscopic grain in paper valleys)
  let granulation = clamp(1.0 - abs(heightmap - 0.5) * 1.8 + total_fibers * 0.2, 0.0, 1.0);

  // Pack into texture:
  // R: Heightmap (0..1)
  // G: Capillary absorption / fiber density (0..1)
  // B: Granulation tooth (0..1)
  // A: Fiber strand density (0..1)
  let out_val = vec4<f32>(heightmap, capillary_density, granulation, total_fibers);
  textureStore(out_parchment, vec2<i32>(global_id.xy), out_val);
}
