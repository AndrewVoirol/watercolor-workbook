// Common structs, constants, and Kubelka-Munk optical tables for watercolor simulation

struct SimUniforms {
  grid_size: vec2<f32>,       // e.g. (1024.0, 1024.0) [offset 0]
  texel_size: vec2<f32>,      // (1/1024, 1/1024)       [offset 8]
  dt: f32,                    // time step in seconds   [offset 16]
  time: f32,                  // elapsed simulation time [offset 20]
  
  // Brush state
  brush_active: u32,          // 1 if drawing, 0 otherwise [offset 24]
  segment_count: u32,         // number of segments this frame [offset 28]
  breathe_active: u32,        // 1 if fading is paused / preserved [offset 32]
  spring_rain_active: u32,    // 1 if clearing / washing canvas [offset 36]
  
  // Physical parameters
  viscosity: f32,             // fluid viscosity [offset 40]
  paper_drag: f32,            // paper fiber friction on velocity [offset 44]
  capillary_strength: f32,    // capillary suction rate into paper [offset 48]
  evaporation_rate: f32,      // ambient evaporation rate [offset 52]
  coffee_ring_flux: f32,      // outward edge mass-transfer strength [offset 56]
  pinning_threshold: f32,     // water height below which pigment pins to fiber [offset 60]
  zen_fade_rate: f32,         // sublime exponential fade rate [offset 64]
  omega_relaxation: f32,      // Jacobi solver relaxation factor (0.85) [offset 68]
  
  // Viewport & Screen DPI for dual-resolution rendering
  screen_size: vec2<f32>,     // screen viewport dimensions in CSS pixels [offset 72]
  dpr: f32,                   // device pixel ratio [offset 80]
  screen_time: f32,           // high-frequency screen time for procedural fibers [offset 84]

  // Advanced Physics: Gravity, Paper Character & Mechanics
  gravity: vec2<f32>,         // X and Y fluid body acceleration (e.g. 0, 9.8) [offset 88]
  paper_type: u32,            // 0=Sheng Xuan, 1=Torinoko, 2=Echizen, 3=Ban-Juku, 4=Mashi [offset 96]
  salt_intensity: f32,        // hygroscopic draw and crystal formation rate [offset 100]
  paper_roughness: f32,       // heightmap tooth scale [offset 104]
  paper_permeability: f32,    // lateral Darcy flow multiplier [offset 108]
  paper_capillary_rate: f32,  // vertical fiber absorption rate [offset 112]
  granulation_rate: f32,      // pigment settling into paper valleys [offset 116]
  paper_contact_angle: f32,   // cos(theta_c) wettability factor [offset 120]
  paper_buckling_rate: f32,   // hygroscopic fiber swelling & cocking amplitude [offset 124]
};

// Swept Capsule & Ribbon Segment for continuous Catmull-Rom spline injection (80 bytes / 20 floats)
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
  bristle_splay: f32,         // split-hair separation factor (0..1)  [offset 56..60]
  dryness: f32,               // dynamic reservoir exhaustion & tooth gating (0..1) [offset 60..64]
  curvature: f32,             // 2nd-order trajectory curvature kappa [-1..1] for Katabokashi [offset 64..68]
  tilt_x: f32,                // lateral stylus tilt [-1..1] [offset 68..72]
  tilt_y: f32,                // longitudinal stylus tilt [-1..1] [offset 72..76]
  pad: f32,                   // 16-byte alignment pad [offset 76..80]
};

// Traditional Japanese Mineral Pigment Kubelka-Munk Spectral Parameters
// K = Absorption (RGB), S = Scattering (RGB)
struct PigmentKM {
  K: vec3<f32>,
  S: vec3<f32>,
};

// Optical values calibrated for traditional Japanese mineral, gold, and soot pigments
fn get_pigment_km(id: u32) -> PigmentKM {
  var km: PigmentKM;
  switch (id) {
    case 0u: { // Sumi (Carbon pine soot ink) — High velvety absorption, minimal scattering
      km.K = vec3<f32>(3.6, 3.6, 3.6);
      km.S = vec3<f32>(0.02, 0.02, 0.02);
    }
    case 1u: { // Shu (Cinnabar Vermilion / Hon-shu) — Fiery semi-opaque red
      km.K = vec3<f32>(0.12, 2.8, 3.2);
      km.S = vec3<f32>(0.85, 0.22, 0.08);
    }
    case 2u: { // Enji (Cochineal Crimson Lake) — Translucent deep ruby glaze
      km.K = vec3<f32>(0.15, 3.4, 2.8);
      km.S = vec3<f32>(0.45, 0.12, 0.05);
    }
    case 3u: { // Botan (Peony Blossom Pink) — Luminous floral glaze
      km.K = vec3<f32>(0.18, 2.1, 1.4);
      km.S = vec3<f32>(1.25, 0.65, 0.75);
    }
    case 4u: { // Ōdo (Raw Yellow Ochre) — Natural clay earth, heavy granulation
      km.K = vec3<f32>(0.25, 0.85, 3.0);
      km.S = vec3<f32>(1.45, 1.25, 0.35);
    }
    case 5u: { // Kurikawa (Chestnut Tannin Umber) — Aged iron-tea earth tone
      km.K = vec3<f32>(1.85, 2.45, 3.2);
      km.S = vec3<f32>(0.55, 0.35, 0.15);
    }
    case 6u: { // Kindei (24k Mineral Gold Slurry) — Lustrous metallic gold
      km.K = vec3<f32>(0.18, 0.45, 2.2);
      km.S = vec3<f32>(2.8, 2.2, 0.95);
    }
    case 7u: { // Gunjō (Azurite Ultramarine Lapis) — Deep mineral blue granulation
      km.K = vec3<f32>(3.1, 2.2, 0.12);
      km.S = vec3<f32>(0.25, 0.45, 1.35);
    }
    case 8u: { // Ai (Botanical Fermented Indigo) — Deep organic blue wash
      km.K = vec3<f32>(2.9, 1.9, 0.18);
      km.S = vec3<f32>(0.18, 0.35, 0.95);
    }
    case 9u: { // Rokushō (Malachite Mineral Verdigris) — Rich copper patina green
      km.K = vec3<f32>(2.8, 0.22, 1.6);
      km.S = vec3<f32>(0.55, 1.45, 0.85);
    }
    case 10u: { // Byakuroku (Celadon Jade Mist) — Pale jade celadon wash
      km.K = vec3<f32>(1.4, 0.35, 0.9);
      km.S = vec3<f32>(1.65, 2.1, 1.75);
    }
    case 11u: { // Gofun (Calcified Oyster Shell White) — Opaque high-scattering body paint
      km.K = vec3<f32>(0.02, 0.02, 0.02);
      km.S = vec3<f32>(3.8, 3.8, 3.7);
    }
    default: { // Clear Water Wash (12) & Sea Salt (13) — Transparent carrier
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
