// Common structs, constants, and Kubelka-Munk optical tables for watercolor simulation

struct SimUniforms {
  grid_size: vec2<f32>,       // e.g. (1024.0, 1024.0)
  texel_size: vec2<f32>,      // (1/1024, 1/1024)
  dt: f32,                    // time step in seconds (e.g. 0.016)
  time: f32,                  // elapsed simulation time in seconds
  
  // Brush state
  brush_active: u32,          // 1 if drawing, 0 otherwise
  segment_count: u32,         // number of interpolated swept-capsule segments this frame
  breathe_active: u32,        // 1 if fading is paused / preserved
  spring_rain_active: u32,    // 1 if clearing / washing canvas
  
  // Physical parameters
  viscosity: f32,             // fluid viscosity
  paper_drag: f32,            // paper fiber friction on velocity
  capillary_strength: f32,    // capillary suction rate into paper
  evaporation_rate: f32,      // ambient evaporation rate
  coffee_ring_flux: f32,      // outward edge mass-transfer strength
  pinning_threshold: f32,     // water height below which pigment pins to fiber
  zen_fade_rate: f32,         // sublime exponential fade rate
  omega_relaxation: f32,      // Jacobi solver relaxation factor (0.85)
  
  // Viewport & Screen DPI for dual-resolution rendering
  screen_size: vec2<f32>,     // screen viewport dimensions in CSS pixels
  dpr: f32,                   // device pixel ratio
  screen_time: f32,           // high-frequency screen time for procedural fibers

  // Advanced Physics: Gravity & Tilt (offset 88 bytes)
  gravity: vec2<f32>,         // X and Y fluid body acceleration (e.g. 0, 9.8)
  paper_type: u32,            // 0=Sheng Xuan (raw), 1=Torinoko (smooth), 2=Echizen (rough)
  salt_intensity: f32,        // hygroscopic draw and crystal formation rate
  paper_roughness: f32,       // heightmap tooth scale
  paper_permeability: f32,    // lateral Darcy flow multiplier
  paper_capillary_rate: f32,  // vertical fiber absorption rate
  granulation_rate: f32,      // pigment settling into paper valleys
  pad0: f32,
  pad1: f32,
};

// Swept Capsule & Ribbon Segment for continuous Catmull-Rom spline injection
struct BrushSegment {
  p0: vec2<f32>,              // start point in grid coords (0..1024) [offset 0..8]
  p1: vec2<f32>,              // end point in grid coords (0..1024)   [offset 8..16]
  velocity: vec2<f32>,        // continuous velocity vector C'(t)     [offset 16..24]
  radius0: f32,               // start brush radius in grid pixels    [offset 24..28]
  radius1: f32,               // end brush radius in grid pixels      [offset 28..32]
  water_amount: f32,          // water volume to deposit              [offset 32..36]
  pigment_id: u32,            // 0=Sumi, 1=Shu, 2=Ai, 3=Oudo, 4=Rokusho, 5=Clear Water, 6=Salt [offset 36..40]
  pigment_density: f32,       // concentration of active pigment (0..1) [offset 40..44]
  brush_type: u32,            // 0=Fude round, 1=Menso liner, 2=Hake flat, 3=Fuki-e splatter [offset 44..48]
  azimuth: f32,               // stylus orientation angle in radians [offset 48..52]
  aspect_ratio: f32,          // elliptical ribbon aspect ratio (0.2..1.0) [offset 52..56]
  bristle_splay: f32,         // split-hair separation & kasure factor [offset 56..60]
  flags: u32,                 // custom flags [offset 60..64]
};

// Traditional Japanese Mineral Pigment Kubelka-Munk Spectral Parameters
// K = Absorption (RGB), S = Scattering (RGB)
struct PigmentKM {
  K: vec3<f32>,
  S: vec3<f32>,
};

// Optical values calibrated for traditional Japanese mineral and soot pigments
fn get_pigment_km(id: u32) -> PigmentKM {
  var km: PigmentKM;
  switch (id) {
    case 0u: { // Sumi (Carbon pine soot ink) - High velvety absorption, minimal scattering
      km.K = vec3<f32>(3.2, 3.2, 3.2);
      km.S = vec3<f32>(0.04, 0.04, 0.04);
    }
    case 1u: { // Shu (Vermilion / Cinnabar) - Rich warm red, high green/blue absorption
      km.K = vec3<f32>(0.12, 2.8, 3.1);
      km.S = vec3<f32>(0.85, 0.22, 0.08);
    }
    case 2u: { // Ai (Natural Indigo) - Deep botanical blue, high red/yellow absorption
      km.K = vec3<f32>(2.9, 1.9, 0.15);
      km.S = vec3<f32>(0.18, 0.35, 0.95);
    }
    case 3u: { // Oudo (Yellow Ochre) - Organic earth mineral, granulates on paper ridges
      km.K = vec3<f32>(0.25, 0.85, 2.9);
      km.S = vec3<f32>(1.35, 1.15, 0.35);
    }
    case 4u: { // Rokusho (Malachite Green) - Crushed copper patina, balanced scattering
      km.K = vec3<f32>(2.6, 0.28, 1.4);
      km.S = vec3<f32>(0.45, 1.25, 0.75);
    }
    default: { // Clear Water Wash / Salt (Zero color absorption, zero scattering)
      km.K = vec3<f32>(0.0, 0.0, 0.0);
      km.S = vec3<f32>(0.0, 0.0, 0.0);
    }
  }
  return km;
}

// Substrate Parchment (Warm handmade Washi paper reflectance)
const WASHI_PAPER_REFLECTANCE = vec3<f32>(0.95, 0.92, 0.85);

// Distance from point P to line segment AB
fn dist_to_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) {
    return length(pa);
  }
  let h = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  return length(pa - ba * h);
}

// Distance from point P to line segment AB with parameter t (0..1)
fn dist_and_t_to_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, t_out: ptr<function, f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) {
    *t_out = 0.0;
    return length(pa);
  }
  let h = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  *t_out = h;
  return length(pa - ba * h);
}
