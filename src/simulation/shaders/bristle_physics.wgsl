// WebGPU Compute Shader for 3D Position-Based Dynamics (PBD) Guide Bristle Cluster
// Simulates 48 elastic guide rods directly on the GPU with distance constraints,
// bending rigidity, capillary clumping, continuous paper plane sliding (z <= 0), and Coulomb friction.

#include "common.wgsl"

struct BristleNodeGPU {
  pos: vec4<f32>,       // x, y, z, contact_pressure
  prev_pos: vec4<f32>,  // px, py, pz, is_contact
  vel: vec4<f32>,       // vx, vy, vz, pad
};

struct BristlePhysicsConfig {
  ferrule: FerruleState,
};

@group(0) @binding(0) var<uniform> config: BristlePhysicsConfig;
@group(0) @binding(1) var<storage, read_write> bristle_nodes: array<BristleNodeGPU, 384>; // 48 rods * 8 nodes = 384
@group(0) @binding(2) var<storage, read_write> guide_segments: array<GuideBristleSegment, 48>;

const NUM_RODS: u32 = 48u;
const NODES_PER_ROD: u32 = 8u;

fn get_root_offset(rod_idx: u32, brush_type: u32, base_size: f32) -> vec3<f32> {
  if (brush_type == 2u) {
    // === HAKE: Wide Linear Array (48 rods) ===
    let width = base_size * 2.2;
    let u = (f32(rod_idx) / f32(NUM_RODS - 1u) - 0.5) * width;
    let jitter = (hash12(vec2<f32>(f32(rod_idx), 13.37)) - 0.5) * 1.5;
    return vec3<f32>(u, jitter, 0.0);
  } else if (brush_type == 1u) {
    // === MENSO: Tight 16-rod needle cluster ===
    if (rod_idx >= 16u) {
      return vec3<f32>(0.0, 0.0, 1000.0); // inactive rods moved away
    }
    let theta = f32(rod_idx) * 2.39996; // golden angle
    let r_norm = sqrt((f32(rod_idx) + 0.5) / 16.0);
    let r = max(1.2, base_size * 0.22) * r_norm;
    return vec3<f32>(cos(theta) * r, sin(theta) * r, 0.0);
  } else {
    // === MARU-FUDE: 36-rod Fermat spiral conical tuft ===
    if (rod_idx >= 36u) {
      return vec3<f32>(0.0, 0.0, 1000.0);
    }
    let theta = f32(rod_idx) * 2.39996;
    let r_norm = sqrt((f32(rod_idx) + 0.5) / 36.0);
    let r = max(2.5, base_size * 0.75) * r_norm;
    return vec3<f32>(cos(theta) * r, sin(theta) * r, 0.0);
  }
}

@compute @workgroup_size(48, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let rod_idx = global_id.x;
  if (rod_idx >= NUM_RODS) {
    return;
  }

  let ferrule = config.ferrule;
  let brush_type = u32(ferrule.kinematics.z + 0.5);
  let is_active_type = (brush_type == 2u) || (brush_type == 1u && rod_idx < 16u) || (brush_type == 0u && rod_idx < 36u);

  if (!is_active_type) {
    guide_segments[rod_idx].meta_u.y = 0u; // is_contact = 0
    return;
  }

  let base_size = max(ferrule.brush_params.x, 8.0);
  let base_length = select(base_size * 1.8, base_size * 2.4, brush_type == 0u);

  // Conical tuft length profile: core rods (Inochi-ge) are 100% length; outer mantle rods (Kata-ge) are 72% length
  let r_norm_rod = select(
    sqrt((f32(rod_idx) + 0.5) / 36.0),
    sqrt((f32(rod_idx) + 0.5) / 16.0),
    brush_type == 1u
  );
  let length_taper = select(1.0 - r_norm_rod * 0.28, 1.0, brush_type == 2u);
  let bristle_length = base_length * length_taper;
  let seg_len = bristle_length / f32(NODES_PER_ROD - 1u);

  let dt = clamp(ferrule.kinematics.w, 0.001, 0.033);
  let sub_steps = 4;
  let sub_dt = dt / f32(sub_steps);

  let root_offset = get_root_offset(rod_idx, brush_type, base_size);
  let base_node_idx = rod_idx * NODES_PER_ROD;

  // Material stiffness properties: responsive spring firmness with controlled damping
  var bending_stiffness = 0.55;
  var capillary_clump = 0.60;
  var friction_coeff = 0.30;
  var damping = 0.38;

  if (brush_type == 1u) {
    bending_stiffness = 0.75; // Menso fine liner: stiff precision
    capillary_clump = 0.85;
    friction_coeff = 0.20;
    damping = 0.42;
  } else if (brush_type == 2u) {
    bending_stiffness = 0.40; // Hake broad goat hair: supple wide sweep
    capillary_clump = 0.20;
    friction_coeff = 0.35;
    damping = 0.35;
  }

  let ferrule_pos = ferrule.pos.xyz;
  let ferrule_dir = normalize(ferrule.tilt.xyz);
  let stroke_flag = ferrule.pos.w;
  let is_stroke_start = stroke_flag > 1.5;
  let is_drawing = stroke_flag > 0.5;
  let is_brush_engaged = is_drawing && (ferrule_pos.z < bristle_length * 0.96);

  // Check if uninitialized or jumped (teleported across canvas > 500px)
  let first_node = bristle_nodes[base_node_idx + 1u];
  let dist_to_ferrule = length(first_node.pos.xy - ferrule_pos.xy);
  let is_teleported = (first_node.pos.x == 0.0 && first_node.pos.y == 0.0 && first_node.pos.z == 0.0)
                      || (dist_to_ferrule > 500.0);

  if (is_teleported || is_stroke_start) {
    for (var i = 0u; i < NODES_PER_ROD; i = i + 1u) {
      let t_node = f32(i) / f32(NODES_PER_ROD - 1u);
      let taper = select(1.0 - t_node * 0.70, 1.0 - t_node * 0.15, brush_type == 2u);
      let rest_p = vec3<f32>(
        ferrule_pos.x + root_offset.x * taper + ferrule_dir.x * f32(i) * seg_len,
        ferrule_pos.y + root_offset.y * taper + ferrule_dir.y * f32(i) * seg_len,
        max(0.0, ferrule_pos.z - f32(i) * seg_len)
      );
      let is_contact_node = is_drawing && (rest_p.z <= 0.0);
      let init_press = select(0.0, clamp(ferrule.kinematics.x * (0.65 + t_node * 0.35), 0.15, 0.90), is_contact_node);
      bristle_nodes[base_node_idx + i].pos = vec4<f32>(rest_p, init_press);
      bristle_nodes[base_node_idx + i].prev_pos = vec4<f32>(rest_p, select(0.0, 1.0, is_contact_node));
      bristle_nodes[base_node_idx + i].vel = vec4<f32>(0.0);
    }
  }

  // Tip cluster center estimate for capillary cohesion
  let tip_center = ferrule_pos.xy + ferrule_dir.xy * bristle_length * 0.6;

  // Calculate previous frame contact center before updating positions
  var prev_contact_pos = vec2<f32>(0.0);
  var prev_contact_w: f32 = 0.0;
  var prev_any_contact = false;

  for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
    let node = bristle_nodes[base_node_idx + i];
    if (node.prev_pos.w > 0.5) {
      let w = max(node.pos.w, 0.2);
      prev_contact_pos = prev_contact_pos + node.pos.xy * w;
      prev_contact_w = prev_contact_w + w;
      prev_any_contact = true;
    }
  }

  let fallback_p = ferrule_pos.xy + root_offset.xy * 0.6;
  let p0_2d = select(
    fallback_p,
    select(fallback_p, prev_contact_pos / max(prev_contact_w, 0.0001), prev_contact_w > 0.0001),
    prev_any_contact && !is_stroke_start
  );

  // --- Sub-stepped PBD Integration ---
  for (var step = 0; step < sub_steps; step = step + 1) {
    // 1. Root node rigidly attached to ferrule
    bristle_nodes[base_node_idx].pos = vec4<f32>(
      ferrule_pos.x + root_offset.x,
      ferrule_pos.y + root_offset.y,
      ferrule_pos.z + root_offset.z,
      0.0
    );
    bristle_nodes[base_node_idx].vel = vec4<f32>(0.0);

    // 2. Integrate forces for nodes 1..7 (Dynamic spring firmness + balanced damping)
    for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
      let curr_idx = base_node_idx + i;
      var node = bristle_nodes[curr_idx];
      let t = f32(i) / f32(NODES_PER_ROD - 1u);

      // Spring rest position (conical tuft converges toward 15% apex at tip)
      let taper = select(1.0 - t * 0.85, 1.0 - t * 0.15, brush_type == 2u);
      let rest_target = vec3<f32>(
        ferrule_pos.x + root_offset.x * taper + ferrule_dir.x * f32(i) * seg_len,
        ferrule_pos.y + root_offset.y * taper + ferrule_dir.y * f32(i) * seg_len,
        max(0.0, ferrule_pos.z - f32(i) * seg_len)
      );

      let spring_disp = rest_target - node.pos.xyz;
      let spring_force = spring_disp * (bending_stiffness * 200.0);

      // Dynamic capillary clumping: cohesive at rest, splays naturally under lateral speed and pressure
      // Dynamic capillary clumping force towards cluster center
      let press_norm = clamp(ferrule.kinematics.x, 0.1, 1.0);
      let speed_norm = clamp(ferrule.kinematics.y / 4.0, 0.0, 1.0);
      let water_dil_norm = clamp(ferrule.brush_params.z / 0.50, 0.30, 1.0);
      let dynamic_clump = select(
        capillary_clump,
        capillary_clump * max(0.15, (1.3 - press_norm * 0.45 - speed_norm * 0.55)) * water_dil_norm,
        brush_type == 0u
      );
      let clump_disp = tip_center - node.pos.xy;
      let clump_force = vec3<f32>(clump_disp * dynamic_clump * t * 16.0, 0.0);

      // Dynamic viscous damping
      let total_acc = (spring_force + clump_force) - node.vel.xyz * (damping * 18.0);

      node.vel = vec4<f32>(node.vel.xyz + total_acc * sub_dt, 0.0);
      node.pos = vec4<f32>(node.pos.xyz + node.vel.xyz * sub_dt, node.pos.w);
      bristle_nodes[curr_idx] = node;
    }

    // 3. PBD Distance Constraints (Inextensible rod links)
    for (var iter = 0; iter < 4; iter = iter + 1) {
      for (var i = 0u; i < NODES_PER_ROD - 1u; i = i + 1u) {
        let idxA = base_node_idx + i;
        let idxB = base_node_idx + i + 1u;
        var pA = bristle_nodes[idxA].pos.xyz;
        var pB = bristle_nodes[idxB].pos.xyz;

        let delta = pB - pA;
        let d = length(delta);
        if (d > 0.0001) {
          let diff = (d - seg_len) / d;
          if (i == 0u) {
            // Root is fixed ferrule anchor, push node 1 entirely
            pB = pB - delta * diff;
          } else {
            // Interior nodes share elongation correction
            pA = pA + delta * (0.5 * diff);
            pB = pB - delta * (0.5 * diff);
          }
          bristle_nodes[idxA].pos = vec4<f32>(pA, bristle_nodes[idxA].pos.w);
          bristle_nodes[idxB].pos = vec4<f32>(pB, bristle_nodes[idxB].pos.w);
        }
      }
    }

    // 4. Substrate Contact Plane Constraint (z <= 0 Paper Surface & Sliding)
    for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
      let curr_idx = base_node_idx + i;
      var node = bristle_nodes[curr_idx];

      let is_tip_node = (i >= NODES_PER_ROD - 2u);
      let z_contact_thresh = select(0.0, bristle_length * 0.20, is_tip_node);
      // Core Inochi-ge rods maintain continuous contact whenever brush is engaged; mantle rods engage with downward pressure
      let rod_touches = (node.pos.z <= z_contact_thresh) || (is_brush_engaged && is_tip_node && (r_norm_rod <= 0.45 || ferrule.kinematics.x > 0.30));

      if (is_drawing && rod_touches) {
        let penetration = max(-node.pos.z, 0.0);
        node.pos.z = 0.0;
        node.vel.z = 0.0;
        let norm_penetration = clamp(penetration / max(seg_len * 2.0, 1.0), 0.0, 1.0);
        let press_calc = clamp(norm_penetration * 0.50 + ferrule.kinematics.x * 0.50, 0.15, 1.10);
        node.pos.w = press_calc;
        node.prev_pos.w = 1.0; // is_contact = true

        // Coulomb friction along paper plane: core rods have higher traction
        let traction = 0.45 + (1.0 - r_norm_rod) * 0.35;
        let friction_factor = max(0.0, 1.0 - friction_coeff * traction);
        node.vel.x = node.vel.x * friction_factor;
        node.vel.y = node.vel.y * friction_factor;
      } else {
        node.pos.w = 0.0;
        node.prev_pos.w = 0.0;
      }
      bristle_nodes[curr_idx] = node;
    }
  }

  // --- Output Guide Bristle Swept Segment ---
  var curr_contact_pos = vec2<f32>(0.0);
  var curr_contact_w: f32 = 0.0;
  var max_curr_press: f32 = 0.0;
  var curr_contact_count: u32 = 0u;

  for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
    let node = bristle_nodes[base_node_idx + i];
    if (node.prev_pos.w > 0.5) { // in contact with ground
      let w = max(node.pos.w, 0.2);
      curr_contact_pos = curr_contact_pos + node.pos.xy * w;
      curr_contact_w = curr_contact_w + w;
      max_curr_press = max(max_curr_press, node.pos.w);
      curr_contact_count = curr_contact_count + 1u;
    }
  }

  // True physical contact: rod is active only if its nodes physically touch the substrate
  let is_contact = is_drawing && (curr_contact_count > 0u);

  let p1_2d = select(
    bristle_nodes[base_node_idx + NODES_PER_ROD - 1u].pos.xy,
    curr_contact_pos / max(curr_contact_w, 0.0001),
    curr_contact_w > 0.0001
  );

  let final_p0 = select(p1_2d, p0_2d, !is_stroke_start && prev_any_contact);
  let pressure = clamp(max(max_curr_press, ferrule.kinematics.x), 0.15, 1.5);

  var seg: GuideBristleSegment;
  seg.p0 = final_p0;
  seg.p1 = p1_2d;

  let hair_radius = select(
    max(2.4, (base_size / 6.2) * (0.65 + pressure * 0.55)), // Maru (36 rods): tighter, crisp individual hair definition
    max(1.5, (base_size / 3.8) * 1.15 * (0.75 + pressure * 0.40)), // Menso (16 rods)
    brush_type == 1u
  );
  let final_hair_radius = select(hair_radius, max(2.6, (base_size * 2.2 / 48.0) * 1.35 * (0.65 + pressure * 0.55)), brush_type == 2u);

  seg.radii = vec2<f32>(final_hair_radius, final_hair_radius);
  seg.pressures = vec2<f32>(pressure, pressure);

  let seg_dt = max(dt, 0.001);
  let raw_vel = (p1_2d - final_p0) / seg_dt;
  let vel_mag = length(raw_vel);
  // Forward dragging velocity for smooth fluid momentum transfer
  let stroke_speed = min(vel_mag * 0.20, 1.2);
  seg.velocity = select(vec2<f32>(0.0), (raw_vel / max(vel_mag, 0.0001)) * stroke_speed, vel_mag > 0.001 && !is_stroke_start);

  let water_dil = ferrule.brush_params.z;
  let p_density = ferrule.brush_params.w;
  let mantle_feather = select(1.0 - r_norm_rod * 0.40, 1.0, brush_type == 2u);
  seg.flow_props = vec2<f32>(
    water_dil * (0.45 + pressure * 0.55) * mantle_feather,
    p_density * (0.50 + pressure * 0.50) * mantle_feather
  );

  seg.meta_u = vec4<u32>(
    rod_idx,
    select(0u, 1u, is_contact),
    brush_type,
    u32(ferrule.brush_params.y + 0.5)
  );

  let norm_u = (f32(rod_idx) / f32(NUM_RODS - 1u) - 0.5) * 2.0;
  seg.dynamics = vec4<f32>(
    norm_u,
    0.0,
    select(0.0, 1.0 - water_dil, water_dil < 0.25),
    f32(rod_idx) * 0.6180339887
  );

  guide_segments[rod_idx] = seg;
}
