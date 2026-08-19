// WebGPU Compute Shader for 3D Position-Based Dynamics (PBD) Guide Bristle Cluster
// Simulates 48 elastic guide rods directly on the GPU with distance constraints,
// bending rigidity, capillary clumping, paper plane collision (z <= 0), and Coulomb friction.

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
  let bristle_length = select(base_size * 1.6, base_size * 2.2, brush_type == 0u);
  let seg_len = bristle_length / f32(NODES_PER_ROD - 1u);
  let dt = clamp(ferrule.kinematics.w, 0.001, 0.033);
  let sub_steps = 4;
  let sub_dt = dt / f32(sub_steps);

  let root_offset = get_root_offset(rod_idx, brush_type, base_size);
  let base_node_idx = rod_idx * NODES_PER_ROD;

  // Material stiffness properties - Overdamped viscous behavior matching wet hairs in ink
  var bending_stiffness = 0.45;
  var capillary_clump = 0.65;
  var friction_coeff = 0.35;
  var damping = 0.65;

  if (brush_type == 1u) {
    bending_stiffness = 0.60; // Menso fine liner
    capillary_clump = 0.85;
    friction_coeff = 0.25;
    damping = 0.70;
  } else if (brush_type == 2u) {
    bending_stiffness = 0.35; // Hake broad goat hair
    capillary_clump = 0.25;
    friction_coeff = 0.40;
    damping = 0.60;
  }

  let ferrule_pos = ferrule.pos.xyz;
  let ferrule_dir = normalize(ferrule.tilt.xyz);

  // Check if uninitialized or jumped (snap nodes to rest pose instantly)
  let first_node = bristle_nodes[base_node_idx + 1u];
  let dist_to_ferrule = length(first_node.pos.xy - ferrule_pos.xy);
  let is_uninitialized = (first_node.pos.x == 0.0 && first_node.pos.y == 0.0 && first_node.pos.z == 0.0) || (dist_to_ferrule > bristle_length * 3.0);

  if (is_uninitialized) {
    for (var i = 0u; i < NODES_PER_ROD; i = i + 1u) {
      let t_node = f32(i) / f32(NODES_PER_ROD - 1u);
      let taper = select(1.0 - t_node * 0.85, 1.0 - t_node * 0.25, brush_type == 2u);
      let rest_p = vec3<f32>(
        ferrule_pos.x + root_offset.x * taper + ferrule_dir.x * f32(i) * seg_len,
        ferrule_pos.y + root_offset.y * taper + ferrule_dir.y * f32(i) * seg_len,
        max(0.0, ferrule_pos.z - f32(i) * seg_len)
      );
      bristle_nodes[base_node_idx + i].pos = vec4<f32>(rest_p, select(0.0, 0.6, rest_p.z <= 0.0));
      bristle_nodes[base_node_idx + i].prev_pos = vec4<f32>(rest_p, select(0.0, 1.0, rest_p.z <= 0.0));
      bristle_nodes[base_node_idx + i].vel = vec4<f32>(0.0);
    }
  }

  // Tip cluster center estimate for capillary cohesion
  let tip_center = ferrule_pos.xy + ferrule_dir.xy * bristle_length * 0.6;

  // Save previous tip contact position before updating
  let old_tip = bristle_nodes[base_node_idx + NODES_PER_ROD - 1u];
  let p0_2d = select(ferrule_pos.xy, old_tip.pos.xy, old_tip.prev_pos.w > 0.5);

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

    // 2. Integrate forces for nodes 1..7 (Overdamped viscous relaxation)
    for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
      let curr_idx = base_node_idx + i;
      let prev_idx = base_node_idx + i - 1u;
      var node = bristle_nodes[curr_idx];
      let prev = bristle_nodes[prev_idx];

      // Bending restoring force towards unbent straight rod axis (soft spring)
      let rest_target = prev.pos.xyz + ferrule_dir * seg_len;
      let f_bend = (rest_target - node.pos.xyz) * (bending_stiffness * 120.0);

      // Capillary surface tension clumping towards cluster core
      var f_cap = vec2<f32>(0.0);
      if (i >= NODES_PER_ROD - 3u && capillary_clump > 0.05) {
        let t_node = f32(i) / f32(NODES_PER_ROD - 1u);
        let factor = t_node * capillary_clump * 120.0;
        f_cap = (tip_center - node.pos.xy) * factor;
      }

      // Gravity & heavy viscous fluid damping (prevents whiplash oscillations)
      let gravity_z = -75.0;
      var new_vel = node.vel.xyz;
      let decay = 1.0 - damping;
      new_vel.x = (new_vel.x + (f_bend.x + f_cap.x) * sub_dt) * decay;
      new_vel.y = (new_vel.y + (f_bend.y + f_cap.y) * sub_dt) * decay;
      new_vel.z = (new_vel.z + (f_bend.z + gravity_z) * sub_dt) * decay;

      node.pos = vec4<f32>(node.pos.xyz + new_vel * sub_dt, node.pos.w);
      node.vel = vec4<f32>(new_vel, 0.0);
      bristle_nodes[curr_idx] = node;
    }

    // 3. PBD Inextensibility Constraints (3 iterations)
    for (var iter = 0; iter < 3; iter = iter + 1) {
      for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
        let curr_idx = base_node_idx + i;
        let prev_idx = base_node_idx + i - 1u;

        var pA = bristle_nodes[prev_idx].pos.xyz;
        var pB = bristle_nodes[curr_idx].pos.xyz;

        let delta = pB - pA;
        let dist = length(delta);
        if (dist > 0.0001) {
          let diff = (dist - seg_len) / dist;
          if (i == 1u) {
            pB = pB - delta * diff;
          } else {
            pB = pB - delta * (diff * 0.70);
            pA = pA + delta * (diff * 0.30);
            bristle_nodes[prev_idx].pos = vec4<f32>(pA, bristle_nodes[prev_idx].pos.w);
          }
          bristle_nodes[curr_idx].pos = vec4<f32>(pB, bristle_nodes[curr_idx].pos.w);
        }
      }
    }

    // 4. Substrate Contact Plane Constraint (z <= 0 Paper Surface & Continuous Sliding)
    let is_brush_engaged = ferrule_pos.z < bristle_length * 0.95;
    for (var i = 1u; i < NODES_PER_ROD; i = i + 1u) {
      let curr_idx = base_node_idx + i;
      var node = bristle_nodes[curr_idx];

      // Ground plane collision or engaged trailing sliding
      if (node.pos.z <= 0.0 || (is_brush_engaged && i >= NODES_PER_ROD - 2u)) {
        let penetration = max(-node.pos.z, 0.0);
        node.pos.z = 0.0;
        node.vel.z = 0.0;
        node.pos.w = clamp(penetration * 0.65 + 0.40, 0.0, 1.5); // contact pressure
        node.prev_pos.w = 1.0; // is_contact = true

        // Coulomb Friction
        let friction_factor = max(0.0, 1.0 - friction_coeff * 0.75);
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
  let tip_node = bristle_nodes[base_node_idx + NODES_PER_ROD - 1u];
  var any_node_contact = false;
  var max_node_press: f32 = 0.0;
  for (var i = 3u; i < NODES_PER_ROD; i = i + 1u) {
    let n_contact = bristle_nodes[base_node_idx + i].prev_pos.w;
    if (n_contact > 0.5) {
      any_node_contact = true;
      max_node_press = max(max_node_press, bristle_nodes[base_node_idx + i].pos.w);
    }
  }

  let is_contact = any_node_contact || (ferrule_pos.z < bristle_length * 0.92);
  let p1_2d = tip_node.pos.xy;
  let pressure = max(tip_node.pos.w, max_node_press);

  var seg: GuideBristleSegment;
  seg.p0 = p0_2d;
  seg.p1 = p1_2d;

  let hair_radius = select(
    max(2.4, (base_size / 6.0) * 1.35 * (0.65 + pressure * 0.55)), // Maru (36 rods)
    max(1.2, (base_size / 4.0) * 1.10 * (0.70 + pressure * 0.40)), // Menso (16 rods)
    brush_type == 1u
  );
  let final_hair_radius = select(hair_radius, max(2.8, (base_size * 2.2 / 48.0) * 1.40 * (0.65 + pressure * 0.55)), brush_type == 2u);

  seg.radii = vec2<f32>(final_hair_radius, final_hair_radius);
  seg.pressures = vec2<f32>(pressure, pressure);

  let seg_dt = max(dt, 0.001);
  let raw_vel = (p1_2d - p0_2d) / seg_dt;
  let vel_mag = length(raw_vel);
  seg.velocity = select(vec2<f32>(0.0), (raw_vel / max(vel_mag, 0.0001)) * min(vel_mag, 2.0), vel_mag > 0.001);

  let water_dil = ferrule.brush_params.z;
  let p_density = ferrule.brush_params.w;
  seg.flow_props = vec2<f32>(
    water_dil * (0.45 + pressure * 0.55),
    p_density * (0.50 + pressure * 0.50)
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
