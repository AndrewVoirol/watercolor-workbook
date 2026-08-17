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
  paper_type: u32,            // 0=Unryu, 1=Torinoko, 2=Echizen, 3=Kin-sunago, 4=Aizome, 5=Kobishi [offset 96]
  salt_intensity: f32,        // hygroscopic draw and crystal formation rate [offset 100]
  paper_roughness: f32,       // heightmap tooth scale [offset 104]
  paper_permeability: f32,    // lateral Darcy flow multiplier [offset 108]
  paper_capillary_rate: f32,  // vertical fiber absorption rate [offset 112]
  granulation_rate: f32,      // pigment settling into paper valleys [offset 116]
  paper_contact_angle: f32,   // cos(theta_c) wettability factor [offset 120]
  paper_buckling_rate: f32,   // hygroscopic fiber swelling & cocking amplitude [offset 124]
  marangoni_flow_rate: f32,   // solutocapillary surface tension gradient force [offset 128]
  stokes_settling_rate: f32,  // Stokes sedimentation multiplier for coarse minerals [offset 132]
  wet_darkening_strength: f32,// index matching optical wet darkening multiplier [offset 136]
  pad: f32,                   // 16-byte alignment pad [offset 140] (total 144 bytes)
};

// Swept Capsule & Ribbon Segment for continuous Catmull-Rom spline injection (80 bytes / 20 floats)
struct BrushSegment {
  p0: vec2<f32>,              // start point in grid coords (0..1024) [offset 0..8]
  p1: vec2<f32>,              // end point in grid coords (0..1024)   [offset 8..16]
  velocity: vec2<f32>,        // continuous velocity vector C'(t)     [offset 16..24]
  radius0: f32,               // start brush radius in grid pixels    [offset 24..28]
  radius1: f32,               // end brush radius in grid pixels      [offset 28..32]
  water_amount: f32,          // water volume to deposit              [offset 32..36]
  pigment_id: u32,            // 0..13 [offset 36..40]
  pigment_density: f32,       // concentration of active pigment (0..1) [offset 40..44]
  brush_type: u32,            // 0=Fude round, 1=Menso liner, 2=Hake flat, 3=Fuki-e splatter [offset 44..48]
  azimuth: f32,               // stylus orientation angle in radians [offset 48..52]
  aspect_ratio: f32,          // elliptical ribbon aspect ratio (0.2..1.0) [offset 52..56]
  bristle_splay: f32,         // split-hair separation factor (0..1)  [offset 56..60]
  dryness: f32,               // dynamic reservoir exhaustion & tooth gating (0..1) [offset 60..64]
  curvature: f32,             // 2nd-order trajectory curvature kappa [-1..1] for Katabokashi [offset 64..68]
  tilt_x: f32,                // lateral stylus tilt [-1..1] [offset 68..72]
  tilt_y: f32,                // longitudinal stylus tilt [-1..1] [offset 72..76]
  burst_seed: f32,            // deterministic seed for bristle noise & splatter [offset 76..80]
};

// Traditional Japanese Mineral Pigment Physical & Kubelka-Munk Spectral Parameters
struct PhysicalPigmentKM {
  K: vec3<f32>,               // Spectral absorption (RGB)
  S: vec3<f32>,               // Spectral scattering (RGB)
  coarse_ratio: f32,          // 0.0 = fine colloidal/dye, 1.0 = heavy coarse mineral
  stokes_settle: f32,         // Stokes sedimentation rate into paper tooth valleys
  glint_factor: f32,          // 24k metallic gold glint amplitude
};

// Optical values calibrated for authentic Nihonga mineral pigments, carbon soot, botanical dyes, and gold
fn get_physical_pigment_km(id: u32) -> PhysicalPigmentKM {
  var km: PhysicalPigmentKM;
  switch (id) {
    case 0u: {
      // Sumi (松煙墨 - Carbon pine soot): Pure velvety carbon absorption, colloidal permanent suspension
      km.K = vec3<f32>(4.20, 4.20, 4.20);
      km.S = vec3<f32>(0.015, 0.015, 0.015);
      km.coarse_ratio = 0.05;
      km.stokes_settle = 0.02;
      km.glint_factor = 0.0;
    }
    case 1u: {
      // Shu (本朱 - Natural Cinnabar Vermilion): Semi-opaque fiery red mineral with heavy settling
      km.K = vec3<f32>(0.12, 3.10, 3.60);
      km.S = vec3<f32>(0.95, 0.25, 0.08);
      km.coarse_ratio = 0.85;
      km.stokes_settle = 0.75;
      km.glint_factor = 0.0;
    }
    case 2u: {
      // Enji (臙脂 - Cochineal Crimson Lake): Deep ruby glaze, translucent wicking halo
      km.K = vec3<f32>(0.10, 3.80, 2.90);
      km.S = vec3<f32>(0.15, 0.05, 0.02);
      km.coarse_ratio = 0.08;
      km.stokes_settle = 0.04;
      km.glint_factor = 0.0;
    }
    case 3u: {
      // Botan (牡丹 - Peony Blossom Pink): Luminous floral glaze tint
      km.K = vec3<f32>(0.15, 2.40, 1.30);
      km.S = vec3<f32>(1.10, 0.55, 0.65);
      km.coarse_ratio = 0.12;
      km.stokes_settle = 0.06;
      km.glint_factor = 0.0;
    }
    case 4u: {
      // Ōdo (天然黄土 - Raw Yellow Ochre): Natural hydrated clay earth, intense valley granulation
      km.K = vec3<f32>(0.20, 0.90, 3.40);
      km.S = vec3<f32>(1.60, 1.30, 0.40);
      km.coarse_ratio = 0.92;
      km.stokes_settle = 0.85;
      km.glint_factor = 0.0;
    }
    case 5u: {
      // Kurikawa (栗皮茶 - Chestnut Tannin Umber): Aged iron-tea shadow warm earth tone
      km.K = vec3<f32>(1.35, 2.45, 3.85);
      km.S = vec3<f32>(0.55, 0.35, 0.15);
      km.coarse_ratio = 0.65;
      km.stokes_settle = 0.55;
      km.glint_factor = 0.0;
    }
    case 6u: {
      // Kindei (金泥 - 24k Mineral Gold Slurry): Brilliant lustrous metallic gold with specular glint
      km.K = vec3<f32>(0.15, 0.42, 2.40);
      km.S = vec3<f32>(3.20, 2.60, 1.10);
      km.coarse_ratio = 0.95;
      km.stokes_settle = 0.92;
      km.glint_factor = 1.0;
    }
    case 7u: {
      // Gunjō (天然群青 - Azurite Ultramarine Lapis): Deep resonant mineral blue, dramatic granulation
      km.K = vec3<f32>(3.40, 2.40, 0.10);
      km.S = vec3<f32>(0.30, 0.50, 1.50);
      km.coarse_ratio = 0.94;
      km.stokes_settle = 0.90;
      km.glint_factor = 0.0;
    }
    case 8u: {
      // Ai (本藍 - Fermented Botanical Indigo): Deep organic midnight blue wash, high wicking
      km.K = vec3<f32>(2.95, 2.30, 0.35);
      km.S = vec3<f32>(0.18, 0.28, 0.95);
      km.coarse_ratio = 0.05;
      km.stokes_settle = 0.03;
      km.glint_factor = 0.0;
    }
    case 9u: {
      // Rokushō (天然緑青 - Malachite Verdigris): Rich copper patina green mineral
      km.K = vec3<f32>(2.85, 0.15, 1.65);
      km.S = vec3<f32>(0.55, 1.80, 0.85);
      km.coarse_ratio = 0.90;
      km.stokes_settle = 0.82;
      km.glint_factor = 0.0;
    }
    case 10u: {
      // Byakuroku (白緑 - Celadon Jade Mist): Pale jade mist, high body scattering wash
      km.K = vec3<f32>(0.85, 0.18, 0.55);
      km.S = vec3<f32>(1.60, 2.10, 1.70);
      km.coarse_ratio = 0.70;
      km.stokes_settle = 0.60;
      km.glint_factor = 0.0;
    }
    case 11u: {
      // Gofun (胡粉 - Calcified Oyster Shell White): Brilliant high-scattering opaque body paint
      km.K = vec3<f32>(0.015, 0.015, 0.015);
      km.S = vec3<f32>(4.40, 4.40, 4.30);
      km.coarse_ratio = 0.80;
      km.stokes_settle = 0.70;
      km.glint_factor = 0.0;
    }
    default: {
      // Mizu (12: Clear Water Wash) & Shio (13: Salt)
      km.K = vec3<f32>(0.0, 0.0, 0.0);
      km.S = vec3<f32>(0.0, 0.0, 0.0);
      km.coarse_ratio = 0.0;
      km.stokes_settle = 0.0;
      km.glint_factor = 0.0;
    }
  }
  return km;
}

// High-quality non-periodic spatial hashes
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

// Organic Poisson-Jittered Voronoi Micro-Flake Distribution (Zero Lattice / Zero Grid Alignment)
fn voronoi_micro_flake(p: vec2<f32>, scale: f32, seed: f32) -> f32 {
  let g = p * scale;
  let i = floor(g);
  let f = fract(g);
  var min_dist = 1.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2<f32>(f32(x), f32(y));
      let pt = hash22(i + offset + vec2<f32>(seed, seed * 1.3819));
      let diff = offset + pt - f;
      min_dist = min(min_dist, length(diff));
    }
  }
  return 1.0 - smoothstep(0.0, 0.38, min_dist);
}

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

// Fast 4-Tap Bicubic Catmull-Rom Reconstruction Sampler
fn sample_bicubic_4tap(tex: texture_2d<f32>, uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let p = uv * dims - 0.5;
  let f = fract(p);
  let i = floor(p);

  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);

  let g0 = w0 + w1;
  let g1 = w2 + w3;

  let h0 = (w1 / max(g0, vec2<f32>(0.0001))) - 0.5;
  let h1 = (w3 / max(g1, vec2<f32>(0.0001))) + 1.5;

  let texel = 1.0 / dims;
  let p0 = (i + vec2<f32>(h0.x, h0.y)) * texel;
  let p1 = (i + vec2<f32>(h1.x, h0.y)) * texel;
  let p2 = (i + vec2<f32>(h0.x, h1.y)) * texel;
  let p3 = (i + vec2<f32>(h1.x, h1.y)) * texel;

  let c0 = textureLoad(tex, vec2<i32>(clamp(p0 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c1 = textureLoad(tex, vec2<i32>(clamp(p1 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c2 = textureLoad(tex, vec2<i32>(clamp(p2 * dims, vec2<f32>(0.0), dims - 1.0)), 0);
  let c3 = textureLoad(tex, vec2<i32>(clamp(p3 * dims, vec2<f32>(0.0), dims - 1.0)), 0);

  return (c0 * g0.x + c1 * g1.x) * g0.y + (c2 * g0.x + c3 * g1.x) * g1.y;
}

// Robust single-channel Kubelka-Munk 2-flux radiative transfer with Taylor expansion
fn eval_km_channel_scalar(K: f32, S: f32, Rg: f32, d: f32) -> f32 {
  if (K < 0.0001 && S < 0.0001) {
    return Rg;
  }
  // Pure scattering limit (Gofun white body reflection)
  if (K < 0.0001) {
    let Sd = S * d;
    return clamp((Rg + (1.0 - Rg) * Sd) / (1.0 + (1.0 - Rg) * Sd), 0.0, 1.0);
  }
  // Pure absorption limit (Sumi black exponential absorption)
  if (S < 0.0001) {
    return clamp(Rg * exp(-2.0 * K * d), 0.0, 1.0);
  }

  let a = 1.0 + (K / S);
  let b = sqrt(max(a * a - 1.0, 0.000001));
  let y = clamp(b * S * d, 0.00001, 30.0);

  var coth_val: f32;
  if (y < 0.05) {
    coth_val = (1.0 / y) + (y / 3.0);
  } else if (y > 15.0) {
    coth_val = 1.0;
  } else {
    let ep = exp(y);
    let em = exp(-y);
    coth_val = (ep + em) / max(ep - em, 0.0001);
  }

  let b_coth = b * coth_val;
  let num = 1.0 - Rg * (a - b_coth);
  let den = a - Rg + b_coth;

  return clamp(num / max(den, 0.0001), 0.0, 1.0);
}

// 3-Channel Spectral Kubelka-Munk Evaluator
fn eval_km_rgb(K: vec3<f32>, S: vec3<f32>, Rg: vec3<f32>, d: f32) -> vec3<f32> {
  return vec3<f32>(
    eval_km_channel_scalar(K.r, S.r, Rg.r, d),
    eval_km_channel_scalar(K.g, S.g, Rg.g, d),
    eval_km_channel_scalar(K.b, S.b, Rg.b, d)
  );
}
