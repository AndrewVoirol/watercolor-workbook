// Discrete 3D Cosserat Elastic Rod Simulation for Brush Bristles
// Implements PBD inextensibility, bending stiffness, capillary tip clumping, and Coulomb friction

export interface CosseratNode {
  pos: [number, number, number];      // [x, y, z] in simulation units
  prevPos: [number, number, number];
  vel: [number, number, number];
  isContact: boolean;
  contactPressure: number;
}

export interface BristleRod {
  rootOffset: [number, number, number];
  restDir: [number, number, number];
  nodes: CosseratNode[];
  length: number;
  segmentLength: number;
  stiffness: number;
}

export class CosseratBristleCluster {
  public bristles: BristleRod[] = [];
  public numBristles: number = 36;
  public numNodesPerBristle: number = 8;
  public brushRadius: number = 12.0;
  public bristleLength: number = 32.0;

  // Material Properties
  public bendingStiffness: number = 0.85;  // Restoring stiffness towards unbent state
  public frictionCoeff: number = 0.55;     // Substrate Coulomb friction
  public capillaryClumping: number = 0.95; // Strong surface tension cohesion
  public damping: number = 0.15;           // Velocity damping

  // Virtual Ferrule Handle State (in 3D space)
  public ferrulePos: [number, number, number] = [128, 256, 18.0];
  public ferruleDir: [number, number, number] = [0, 0, -1];
  public brushType: number = 0;

  // Dynamic Handle Synthesizer
  private smoothedVel: [number, number] = [0, 0];
  private targetHeight: number = 24.0;
  private currentHeight: number = 24.0;

  constructor(numBristles: number = 36, brushType: number = 0) {
    this.numBristles = numBristles;
    this.brushType = brushType;
    this.initBristles();
  }

  public setBrushType(type: number): void {
    this.brushType = type;
    if (type === 0) { // Maru (Round Calligraphy Brush)
      this.numBristles = 36;
      this.brushRadius = 12.0;
      this.bristleLength = 32.0;
    } else if (type === 1) { // Menso (Fine Detail Liner)
      this.numBristles = 16;
      this.brushRadius = 4.0;
      this.bristleLength = 24.0;
    } else if (type === 2) { // Hake (Flat Wash Brush)
      this.numBristles = 48;
      this.brushRadius = 26.0;
      this.bristleLength = 28.0;
    }
    this.initBristles();
  }

  public initBristles(): void {
    this.bristles = [];
    const segLen = this.bristleLength / (this.numNodesPerBristle - 1);

    if (this.brushType === 2) {
      // Hake: Linear distribution across flat width
      const width = this.brushRadius * 2.2;
      for (let b = 0; b < this.numBristles; b++) {
        const u = (b / (this.numBristles - 1) - 0.5) * width;
        const rootOffset: [number, number, number] = [u, (Math.random() - 0.5) * 1.5, 0];
        this.bristles.push(this.createRod(rootOffset, segLen, u / (width * 0.5)));
      }
    } else {
      // Maru / Menso: Concentric Fermat spiral converging to a sharp tip
      for (let b = 0; b < this.numBristles; b++) {
        const theta = b * 2.39996; // Golden angle
        const rNorm = Math.sqrt((b + 0.5) / this.numBristles);
        const r = this.brushRadius * rNorm;
        const rootOffset: [number, number, number] = [
          Math.cos(theta) * r,
          Math.sin(theta) * r,
          0
        ];
        this.bristles.push(this.createRod(rootOffset, segLen, rNorm));
      }
    }
  }

  private createRod(rootOffset: [number, number, number], segLen: number, radNorm: number): BristleRod {
    const nodes: CosseratNode[] = [];
    for (let i = 0; i < this.numNodesPerBristle; i++) {
      const t = i / (this.numNodesPerBristle - 1);
      // Taper towards center tip at rest (capillary cohesion)
      const taper = this.brushType === 2 ? 1.0 - t * 0.3 : (1.0 - t * 0.85);
      const x = rootOffset[0] * taper;
      const y = rootOffset[1] * taper;
      const z = -i * segLen;

      nodes.push({
        pos: [x, y, z],
        prevPos: [x, y, z],
        vel: [0, 0, 0],
        isContact: false,
        contactPressure: 0
      });
    }
    return {
      rootOffset,
      restDir: [0, 0, -1],
      nodes,
      length: this.bristleLength,
      segmentLength: segLen,
      stiffness: this.bendingStiffness
    };
  }

  // Update virtual handle from trackpad coordinates and velocity
  public updateHandleFromTrackpad(
    gridX: number,
    gridY: number,
    _speedNorm: number,
    pressure: number,
    isDrawing: boolean
  ): void {
    if (isDrawing) {
      // Direct instant vertical descent into paper plane
      this.targetHeight = Math.max(2.0, (1.0 - pressure * 0.88) * this.bristleLength * 0.75);
      if (this.currentHeight > this.targetHeight + 4.0) {
        this.currentHeight = this.targetHeight;
      } else {
        this.currentHeight += (this.targetHeight - this.currentHeight) * 0.6;
      }
    } else {
      this.targetHeight = this.bristleLength * 0.9;
      this.currentHeight += (this.targetHeight - this.currentHeight) * 0.35;
    }

    this.ferrulePos[0] = gridX;
    this.ferrulePos[1] = gridY;
    this.ferrulePos[2] = this.currentHeight;

    // Handle tilt angle based on drag velocity
    const vx = gridX - (this.smoothedVel[0] || gridX);
    const vy = gridY - (this.smoothedVel[1] || gridY);
    this.smoothedVel = [gridX, gridY];

    const speed = Math.hypot(vx, vy);
    if (speed > 0.05) {
      const maxTilt = 0.52; // ~30 degrees backward lean
      const tiltAmt = Math.min(maxTilt, (speed / 12.0) * maxTilt);
      const angle = Math.atan2(vy, vx);

      this.ferruleDir = [
        -Math.cos(angle) * Math.sin(tiltAmt),
        -Math.sin(angle) * Math.sin(tiltAmt),
        -Math.cos(tiltAmt)
      ];
    } else {
      this.ferruleDir = [0, 0, -1];
    }
  }

  // Solve 3D physical dynamics via Position-Based Dynamics (PBD)
  public stepPhysics(dt: number = 0.016): void {
    const subSteps = 4;
    const subDt = dt / subSteps;
    const gravity = -98.0;

    for (let step = 0; step < subSteps; step++) {
      // 1. Calculate Tip Cluster Center for Capillary Cohesion
      let tipSumX = 0;
      let tipSumY = 0;
      let count = 0;

      for (const rod of this.bristles) {
        const tip = rod.nodes[rod.nodes.length - 1];
        tipSumX += tip.pos[0];
        tipSumY += tip.pos[1];
        count++;
      }
      const tipCenterX = count > 0 ? tipSumX / count : this.ferrulePos[0];
      const tipCenterY = count > 0 ? tipSumY / count : this.ferrulePos[1];

      // 2. Simulate each physical bristle rod
      for (const rod of this.bristles) {
        const nodes = rod.nodes;
        const n = nodes.length;

        // Root rigidly anchored to ferrule
        nodes[0].pos = [
          this.ferrulePos[0] + rod.rootOffset[0],
          this.ferrulePos[1] + rod.rootOffset[1],
          this.ferrulePos[2] + rod.rootOffset[2]
        ];
        nodes[0].vel = [0, 0, 0];

        // Integrate internal forces for nodes 1..n-1
        for (let i = 1; i < n; i++) {
          const node = nodes[i];
          const prev = nodes[i - 1];

          // Bending restoring force towards unbent straight axis
          const restX = prev.pos[0] + this.ferruleDir[0] * rod.segmentLength;
          const restY = prev.pos[1] + this.ferruleDir[1] * rod.segmentLength;
          const restZ = prev.pos[2] + this.ferruleDir[2] * rod.segmentLength;

          const fBendX = (restX - node.pos[0]) * this.bendingStiffness * 500.0;
          const fBendY = (restY - node.pos[1]) * this.bendingStiffness * 500.0;
          const fBendZ = (restZ - node.pos[2]) * this.bendingStiffness * 500.0;

          // Capillary cohesion pulling wet hairs together
          let fCapX = 0;
          let fCapY = 0;
          if (i >= n - 3 && this.capillaryClumping > 0.05) {
            const factor = (i / (n - 1)) * this.capillaryClumping * 180.0;
            fCapX = (tipCenterX - node.pos[0]) * factor;
            fCapY = (tipCenterY - node.pos[1]) * factor;
          }

          node.vel[0] = (node.vel[0] + (fBendX + fCapX) * subDt) * (1.0 - this.damping);
          node.vel[1] = (node.vel[1] + (fBendY + fCapY) * subDt) * (1.0 - this.damping);
          node.vel[2] = (node.vel[2] + (fBendZ + gravity) * subDt) * (1.0 - this.damping);

          node.pos[0] += node.vel[0] * subDt;
          node.pos[1] += node.vel[1] * subDt;
          node.pos[2] += node.vel[2] * subDt;
        }

        // PBD Inextensibility Constraints
        for (let iter = 0; iter < 3; iter++) {
          for (let i = 1; i < n; i++) {
            const pA = nodes[i - 1].pos;
            const pB = nodes[i].pos;

            const dx = pB[0] - pA[0];
            const dy = pB[1] - pA[1];
            const dz = pB[2] - pA[2];
            const dist = Math.hypot(dx, dy, dz);

            if (dist > 0.0001) {
              const diff = (dist - rod.segmentLength) / dist;
              if (i === 1) {
                pB[0] -= dx * diff;
                pB[1] -= dy * diff;
                pB[2] -= dz * diff;
              } else {
                pB[0] -= dx * diff * 0.7;
                pB[1] -= dy * diff * 0.7;
                pB[2] -= dz * diff * 0.7;
                pA[0] += dx * diff * 0.3;
                pA[1] += dy * diff * 0.3;
                pA[2] += dz * diff * 0.3;
              }
            }
          }
        }

        // Substrate Contact Plane Constraint (z = 0 Paper Surface)
        for (let i = 1; i < n; i++) {
          const node = nodes[i];
          if (node.pos[2] <= 0.0) {
            const penetration = -node.pos[2];
            node.pos[2] = 0.0;
            node.vel[2] = 0.0;
            node.isContact = true;
            node.contactPressure = Math.min(1.0, penetration * 0.5 + 0.3);

            // Coulomb Friction
            const frictFactor = Math.max(0.0, 1.0 - this.frictionCoeff * 0.85);
            node.vel[0] *= frictFactor;
            node.vel[1] *= frictFactor;
          } else {
            node.isContact = false;
            node.contactPressure = 0.0;
          }
        }
      }
    }
  }
}
