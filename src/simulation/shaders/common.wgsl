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
  clear_canvas_active: u32,   // 1 if resetting canvas [offset 36]
  
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
  aspect_ratio: f32,          // screen aspect ratio width/height [offset 84]

  // Advanced Physics: Gravity, Paper Character & Mechanics
  gravity: vec2<f32>,         // X and Y fluid body acceleration (e.g. 0, 9.8) [offset 88]
  paper_type: u32,            // 0=Raw Mulberry (Kōzo), 1=Sized Eggshell (Torinoko), 2=Antique Edo (Kobishi) [offset 96]
  water_dilution: f32,        // current brush water dilution factor [offset 100]
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
  pigment_id: u32,            // 0=Sumi, 1=Shu, 2=Ai, 3=Odo, 4=Rokusho, 5=Water [offset 36..40]
  pigment_density: f32,       // concentration of active pigment (0..1) [offset 40..44]
  brush_type: u32,            // 0=Maru-fude round, 1=Menso fine liner, 2=Hake flat wash [offset 44..48]
  azimuth: f32,               // stylus orientation angle in radians [offset 48..52]
  aspect_ratio: f32,          // elliptical ribbon aspect ratio (0.2..1.0) [offset 52..56]
  bristle_splay: f32,         // split-hair separation factor (0..1)  [offset 56..60]
  dryness: f32,               // dynamic reservoir exhaustion & tooth gating (0..1) [offset 60..64]
  curvature: f32,             // 2nd-order trajectory curvature kappa [-1..1] for Katabokashi [offset 64..68]
  tilt_x: f32,                // lateral stylus tilt [-1..1] [offset 68..72]
  tilt_y: f32,                // longitudinal stylus tilt [-1..1] [offset 72..76]
  burst_seed: f32,            // deterministic seed for bristle noise [offset 76..80]
};

// Traditional Japanese Mineral Pigment Physical & Kubelka-Munk Spectral Parameters
struct PhysicalPigmentKM {
  K: vec3<f32>,               // Spectral absorption (RGB)
  S: vec3<f32>,               // Spectral scattering (RGB)
  coarse_ratio: f32,          // 0.0 = fine colloidal/dye, 1.0 = heavy coarse mineral
  stokes_settle: f32,         // Stokes sedimentation rate into paper tooth valleys
};

// Calibrated optical and physical parameters for the 5 Master Nihonga Mineral Pigments + Water Wash
fn get_physical_pigment_km(id: u32) -> PhysicalPigmentKM {
  var km: PhysicalPigmentKM;
  switch (id) {
    case 0u: {
      // Sumi (松煙墨 - Pine Soot Black): Warm velvety charcoal carbon with subtle amber undertone
      km.K = vec3<f32>(4.20, 3.90, 3.50);
      km.S = vec3<f32>(0.08, 0.08, 0.08);
      km.coarse_ratio = 0.10;
      km.stokes_settle = 0.04;
    }
    case 1u: {
      // Shu (本朱 - Natural Cinnabar Vermilion): Earthy warm mineral vermilion (HgS)
      km.K = vec3<f32>(0.45, 2.80, 3.80);
      km.S = vec3<f32>(0.70, 0.22, 0.08);
      km.coarse_ratio = 0.78;
      km.stokes_settle = 0.60;
    }
    case 2u: {
      // Ai (本藍 - Traditional Sukumo Fermented Indigo): Deep slate-navy indigo with muted teal undertone
      km.K = vec3<f32>(2.60, 1.80, 0.85);
      km.S = vec3<f32>(0.18, 0.25, 0.40);
      km.coarse_ratio = 0.08;
      km.stokes_settle = 0.03;
    }
    case 3u: {
      // Ōdo (天然黄土 - Natural Raw Yellow Ochre Clay): Warm earthy amber ochre with valley granulation
      km.K = vec3<f32>(0.60, 1.40, 3.60);
      km.S = vec3<f32>(0.80, 0.50, 0.12);
      km.coarse_ratio = 0.85;
      km.stokes_settle = 0.72;
    }
    case 4u: {
      // Rokushō (天然緑青 - Natural Malachite / Verdigris): Earthy dusty celadon sage patina green
      km.K = vec3<f32>(2.20, 0.95, 1.60);
      km.S = vec3<f32>(0.22, 0.55, 0.35);
      km.coarse_ratio = 0.80;
      km.stokes_settle = 0.65;
    }
    default: {
      // Mizu (5u: 清水 - Clear Water Wash)
      km.K = vec3<f32>(0.0, 0.0, 0.0);
      km.S = vec3<f32>(0.0, 0.0, 0.0);
      km.coarse_ratio = 0.0;
      km.stokes_settle = 0.0;
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

// 2D Value Noise with smooth Hermite interpolation
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

// Fractal Brownian Motion for natural organic variation
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2<f32>(100.0, 100.0);
  var pos = p;
  
  let rot = mat2x2<f32>(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  
  for (var i = 0; i < octaves; i = i + 1) {
    v = v + a * value_noise(pos);
    pos = rot * pos * 2.02 + shift;
    a = a * 0.5;
  }
  return v;
}

// Distance from point P to line segment AB with true isotropic aspect ratio scaling
fn dist_and_t_to_segment_iso(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, aspect: f32, t_out: ptr<function, f32>) -> f32 {
  let scale = vec2<f32>(aspect, 1.0);
  let p_s = p * scale;
  let a_s = a * scale;
  let b_s = b * scale;
  let pa = p_s - a_s;
  let ba = b_s - a_s;
  let l2 = dot(ba, ba);
  if (l2 < 0.0001) {
    *t_out = 0.0;
    return length(pa);
  }
  let h = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  *t_out = h;
  return length(pa - ba * h);
}

// Legacy distance helper
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
