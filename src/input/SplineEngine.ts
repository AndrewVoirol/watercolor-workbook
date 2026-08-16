// Centripetal Catmull-Rom Spline Interpolation Engine
// Computes continuous C1-smooth curves, dynamic ink reservoir depletion, stylus kinematics, and ribbon orientation

export interface RawPointerPoint {
  x: number;          // Grid coordinates (0..1024)
  y: number;          // Grid coordinates (0..1024)
  pressure: number;   // 0..1
  timestamp: number;  // ms
  radius: number;     // calculated brush radius
  brushType: number;  // 0=Fude, 1=Menso, 2=Hake, 3=Fuki-e
  azimuth: number;    // stylus azimuth angle in radians (0..2π)
  altitude: number;   // stylus altitude angle in radians (0..π/2)
  aspectRatio: number;// contact patch aspect ratio (0.2..1.0)
  bristleSplay: number;// split-hair kasure factor (0..1)
  tiltX?: number;     // lateral tilt [-1..1]
  tiltY?: number;     // longitudinal tilt [-1..1]
}

export interface SegmentOutput {
  p0: [number, number];
  p1: [number, number];
  velocity: [number, number];
  radius0: number;
  radius1: number;
  waterAmount: number;
  pigmentId: number;
  pigmentDensity: number;
  brushType: number;
  azimuth: number;
  aspectRatio: number;
  bristleSplay: number;
  reservoir: number;  // 0..1 (remaining ink in tuft)
  dryness: number;    // 0..1 (surface tooth interaction factor)
  burstSeed: number;  // stable deterministic seed for splatter / bristle phase
  curvature: number;  // signed 2nd-order curvature [-1..1] for Katabokashi
  tiltX: number;      // lateral tilt [-1..1]
  tiltY: number;      // longitudinal tilt [-1..1]
}

export class SplineEngine {
  private history: RawPointerPoint[] = [];
  private currentReservoir: number = 1.0;
  private smoothedAzimuth: number = 0;
  private stabilizedX: number = -1;
  private stabilizedY: number = -1;
  private strokeSegmentIndex: number = 0;

  public reset(): void {
    this.history = [];
    this.currentReservoir = 1.0;
    this.stabilizedX = -1;
    this.stabilizedY = -1;
    this.strokeSegmentIndex = 0;
  }

  public pushPoint(
    rawPt: RawPointerPoint,
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    let pt = { ...rawPt };

    // 1. Menso Micro-Stabilizer (EMA smoothing for hairline precision)
    if (pt.brushType === 1) {
      if (this.stabilizedX < 0) {
        this.stabilizedX = pt.x;
        this.stabilizedY = pt.y;
      } else {
        this.stabilizedX = this.stabilizedX * 0.3 + pt.x * 0.7;
        this.stabilizedY = this.stabilizedY * 0.3 + pt.y * 0.7;
        pt.x = this.stabilizedX;
        pt.y = this.stabilizedY;
      }
    }

    // 2. Hake Angular Inertia Smoothing (eliminates 180° ribbon flipping on direction reversal)
    if (pt.brushType === 2) {
      let diff = pt.azimuth - this.smoothedAzimuth;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.smoothedAzimuth += diff * 0.35;
      pt.azimuth = this.smoothedAzimuth;
    } else {
      this.smoothedAzimuth = pt.azimuth;
    }

    this.history.push(pt);

    // Single-point tap burst handling
    if (this.history.length === 1) {
      if (pt.brushType === 3) {
        const dummyP: RawPointerPoint = {
          ...pt,
          x: pt.x + 0.05,
          y: pt.y + 0.05,
          timestamp: pt.timestamp + 1
        };
        return this.interpolateLinear(
          pt,
          dummyP,
          pigmentId,
          waterDilution,
          basePigmentDensity
        );
      }
      return [];
    }

    // We need at least 2 points to generate a stroke
    if (this.history.length === 2) {
      return this.interpolateLinear(
        this.history[0],
        this.history[1],
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }

    if (this.history.length === 3) {
      return this.interpolateCatmullRom(
        this.history[0],
        this.history[0],
        this.history[1],
        this.history[2],
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }

    if (this.history.length >= 4) {
      const n = this.history.length;
      const p0 = this.history[n - 4];
      const p1 = this.history[n - 3];
      const p2 = this.history[n - 2];
      const p3 = this.history[n - 1];

      if (this.history.length > 8) {
        this.history.shift();
      }

      return this.interpolateCatmullRom(
        p0,
        p1,
        p2,
        p3,
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }

    return [];
  }

  // Centripetal Catmull-Rom Spline between p1 and p2 using p0 and p3 as tangents
  private interpolateCatmullRom(
    p0: RawPointerPoint,
    p1: RawPointerPoint,
    p2: RawPointerPoint,
    p3: RawPointerPoint,
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    const segments: SegmentOutput[] = [];

    // Distance-based centripetal knot calculation (alpha = 0.5)
    const getKnot = (a: RawPointerPoint, b: RawPointerPoint): number => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.pow(Math.max(d, 0.001), 0.5);
    };

    const t0 = 0;
    const t1 = t0 + getKnot(p0, p1);
    const t2 = t1 + getKnot(p1, p2);
    const t3 = t2 + getKnot(p2, p3);

    // Segment chord length
    const chordLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const avgRadius = (p1.radius + p2.radius) * 0.5;

    // Adaptive subdivision: step size <= 1/3 brush radius
    const maxStep = Math.max(avgRadius * 0.35, 1.5);
    const steps = Math.min(Math.max(Math.ceil(chordLen / maxStep), 1), 32);

    let prevX = p1.x;
    let prevY = p1.y;
    let prevR = p1.radius;

    // Evaluation function for centripetal Catmull-Rom
    const evalPoint = (t: number): { x: number; y: number; vx: number; vy: number; kappa: number } => {
      const a1_x = ((t1 - t) * p0.x + (t - t0) * p1.x) / (t1 - t0);
      const a1_y = ((t1 - t) * p0.y + (t - t0) * p1.y) / (t1 - t0);

      const a2_x = ((t2 - t) * p1.x + (t - t1) * p2.x) / (t2 - t1);
      const a2_y = ((t2 - t) * p1.y + (t - t1) * p2.y) / (t2 - t1);

      const a3_x = ((t3 - t) * p2.x + (t - t2) * p3.x) / (t3 - t2);
      const a3_y = ((t3 - t) * p2.y + (t - t2) * p3.y) / (t3 - t2);

      const b1_x = ((t2 - t) * a1_x + (t - t0) * a2_x) / (t2 - t0);
      const b1_y = ((t2 - t) * a1_y + (t - t0) * a2_y) / (t2 - t0);

      const b2_x = ((t3 - t) * a2_x + (t - t1) * a3_x) / (t3 - t1);
      const b2_y = ((t3 - t) * a2_y + (t - t1) * a3_y) / (t3 - t1);

      const c_x = ((t2 - t) * b1_x + (t - t1) * b2_x) / (t2 - t1);
      const c_y = ((t2 - t) * b1_y + (t - t1) * b2_y) / (t2 - t1);

      // Numerical velocity and acceleration derivatives
      const dt = 0.001;
      const t_next = t + dt;
      const b1_next_x = ((t2 - t_next) * a1_x + (t_next - t0) * a2_x) / (t2 - t0);
      const b1_next_y = ((t2 - t_next) * a1_y + (t_next - t0) * a2_y) / (t2 - t0);
      const b2_next_x = ((t3 - t_next) * a2_x + (t_next - t1) * a3_x) / (t3 - t1);
      const b2_next_y = ((t3 - t_next) * a2_y + (t_next - t1) * a3_y) / (t3 - t1);
      const c_next_x = ((t2 - t_next) * b1_next_x + (t_next - t1) * b2_next_x) / (t2 - t1);
      const c_next_y = ((t2 - t_next) * b1_next_y + (t_next - t1) * b2_next_y) / (t2 - t1);

      const vx = (c_next_x - c_x) / dt;
      const vy = (c_next_y - c_y) / dt;

      // Forward step for acceleration derivative
      const t_next2 = t + 2 * dt;
      const b1_next2_x = ((t2 - t_next2) * a1_x + (t_next2 - t0) * a2_x) / (t2 - t0);
      const b1_next2_y = ((t2 - t_next2) * a1_y + (t_next2 - t0) * a2_y) / (t2 - t0);
      const b2_next2_x = ((t3 - t_next2) * a2_x + (t_next2 - t1) * a3_x) / (t3 - t1);
      const b2_next2_y = ((t3 - t_next2) * a2_y + (t_next2 - t1) * a3_y) / (t3 - t1);
      const c_next2_x = ((t2 - t_next2) * b1_next2_x + (t_next2 - t1) * b2_next2_x) / (t2 - t1);
      const c_next2_y = ((t2 - t_next2) * b1_next2_y + (t_next2 - t1) * b2_next2_y) / (t2 - t1);
      const vx_next = (c_next2_x - c_next_x) / dt;
      const vy_next = (c_next2_y - c_next_y) / dt;

      const ax = (vx_next - vx) / dt;
      const ay = (vy_next - vy) / dt;

      // 2D Signed Curvature: kappa = (vx*ay - vy*ax) / (vx^2 + vy^2)^1.5
      const vSpeedSq = vx * vx + vy * vy;
      const vDenom = Math.max(Math.pow(vSpeedSq, 1.5), 0.0001);
      const rawKappa = (vx * ay - vy * ax) / vDenom;
      const kappa = Math.max(-1.0, Math.min(1.0, rawKappa * 0.25));

      return { x: c_x, y: c_y, vx, vy, kappa };
    };

    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const t = t1 + u * (t2 - t1);
      const curr = evalPoint(t);
      const currR = p1.radius + u * (p2.radius - p1.radius);

      // Interpolate stylus angle & kinematics
      const currAzimuth = p1.azimuth + u * (p2.azimuth - p1.azimuth);
      const currAspect = p1.aspectRatio + u * (p2.aspectRatio - p1.aspectRatio);
      const currAltitude = p1.altitude + u * (p2.altitude - p1.altitude);

      // Normalized stylus tilt
      const tiltMag = Math.cos(currAltitude); // 0 when vertical, 1 when flat
      const tiltX = Math.sin(currAzimuth) * tiltMag;
      const tiltY = -Math.cos(currAzimuth) * tiltMag;

      // Velocity magnitude normalization for momentum
      const velMag = Math.hypot(curr.vx, curr.vy);
      const normVx = velMag > 0.001 ? (curr.vx / velMag) * Math.min(velMag * 0.08, 2.5) : 0;
      const normVy = velMag > 0.001 ? (curr.vy / velMag) * Math.min(velMag * 0.08, 2.5) : 0;

      // --- Dynamic Reservoir Depletion & Speed Starvation ---
      const subStepLen = Math.hypot(curr.x - prevX, curr.y - prevY);
      const avgPressure = (p1.pressure + p2.pressure) * 0.5;
      
      // Reservoir capacity scales with brush volume V ~ r^1.6 and water dilution
      const volumeFactor = Math.pow(Math.max(currR, 2.0), 1.5) * (0.35 + waterDilution * 1.65);
      const baseCapacity = Math.max(180, volumeFactor * 8.0);
      
      // Speed factor: fast strokes starve paper dwell time and drain surface water rapidly
      const speedDrain = Math.min(velMag * 0.02, 1.5);
      const stepDrain = (subStepLen * (0.4 + avgPressure * 0.6 + speedDrain * 0.4)) / baseCapacity;
      this.currentReservoir = Math.max(0.0, this.currentReservoir - stepDrain);

      // Dryness factor: combined slider dilution + tuft depletion
      const reservoirDryness = Math.pow(1.0 - this.currentReservoir, 1.8);
      const sliderDryness = Math.pow(1.0 - waterDilution, 1.6);
      const effectiveDryness = Math.min(1.0, sliderDryness * 0.6 + reservoirDryness * 0.7);

      // Bristle splay increases as brush dries out
      const splay = Math.max(p1.bristleSplay, effectiveDryness);

      // Effective deposited water & pigment
      const waterDeposit = waterDilution * 0.65 * (0.25 + this.currentReservoir * 0.75);
      const pigmentConc = basePigmentDensity * (0.6 + (1.0 - waterDilution) * 0.4) * (0.4 + this.currentReservoir * 0.6);

      this.strokeSegmentIndex++;

      segments.push({
        p0: [prevX, prevY],
        p1: [curr.x, curr.y],
        velocity: [normVx, normVy],
        radius0: prevR,
        radius1: currR,
        waterAmount: waterDeposit,
        pigmentId,
        pigmentDensity: pigmentConc,
        brushType: p2.brushType,
        azimuth: currAzimuth,
        aspectRatio: currAspect,
        bristleSplay: splay,
        reservoir: this.currentReservoir,
        dryness: effectiveDryness,
        burstSeed: this.strokeSegmentIndex,
        curvature: curr.kappa,
        tiltX,
        tiltY
      });

      prevX = curr.x;
      prevY = curr.y;
      prevR = currR;
    }

    return segments;
  }

  private interpolateLinear(
    p1: RawPointerPoint,
    p2: RawPointerPoint,
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dt = Math.max((p2.timestamp - p1.timestamp) * 0.001, 0.001);
    const vx = Math.min((dx / dt) * 0.002, 2.5);
    const vy = Math.min((dy / dt) * 0.002, 2.5);
    const chordLen = Math.hypot(dx, dy);

    const volumeFactor = Math.pow(Math.max(p2.radius, 2.0), 1.5) * (0.35 + waterDilution * 1.65);
    const baseCapacity = Math.max(180, volumeFactor * 8.0);
    const stepDrain = (chordLen * (0.4 + p2.pressure * 0.6)) / baseCapacity;
    this.currentReservoir = Math.max(0.0, this.currentReservoir - stepDrain);

    const effectiveDryness = Math.min(1.0, Math.pow(1.0 - waterDilution, 1.6) * 0.6 + Math.pow(1.0 - this.currentReservoir, 1.8) * 0.7);
    this.strokeSegmentIndex++;

    const tiltMag = Math.cos(p2.altitude);
    const tiltX = Math.sin(p2.azimuth) * tiltMag;
    const tiltY = -Math.cos(p2.azimuth) * tiltMag;

    return [
      {
        p0: [p1.x, p1.y],
        p1: [p2.x, p2.y],
        velocity: [vx, vy],
        radius0: p1.radius,
        radius1: p2.radius,
        waterAmount: waterDilution * 0.65 * (0.25 + this.currentReservoir * 0.75),
        pigmentId,
        pigmentDensity: basePigmentDensity * (0.6 + (1.0 - waterDilution) * 0.4) * (0.4 + this.currentReservoir * 0.6),
        brushType: p2.brushType,
        azimuth: p2.azimuth,
        aspectRatio: p2.aspectRatio,
        bristleSplay: Math.max(p2.bristleSplay, effectiveDryness),
        reservoir: this.currentReservoir,
        dryness: effectiveDryness,
        burstSeed: this.strokeSegmentIndex,
        curvature: 0.0,
        tiltX,
        tiltY
      }
    ];
  }

  public getHistoryLength(): number {
    return this.history.length;
  }

  public flushTapIfSinglePoint(
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    if (this.history.length === 1) {
      const p = this.history[0];
      const dummyP: RawPointerPoint = {
        ...p,
        x: p.x + 0.05,
        y: p.y + 0.05,
        timestamp: p.timestamp + 1
      };
      return this.interpolateLinear(p, dummyP, pigmentId, waterDilution, basePigmentDensity);
    }
    return [];
  }
}
