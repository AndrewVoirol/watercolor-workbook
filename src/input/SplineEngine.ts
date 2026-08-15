// Centripetal Catmull-Rom Spline Interpolation Engine
// Computes continuous C1-smooth curves, arc-length sub-stepping, and velocity tangent vectors

export interface RawPointerPoint {
  x: number;          // Grid coordinates (0..1024)
  y: number;          // Grid coordinates (0..1024)
  pressure: number;   // 0..1
  timestamp: number;  // ms
  radius: number;     // calculated brush radius
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
}

export class SplineEngine {
  private history: RawPointerPoint[] = [];

  public reset(): void {
    this.history = [];
  }

  public pushPoint(
    pt: RawPointerPoint,
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    this.history.push(pt);

    // We need at least 2 points to generate a stroke
    if (this.history.length === 2) {
      // First segment: linear interpolation
      return this.interpolateLinear(
        this.history[0],
        this.history[1],
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }

    if (this.history.length === 3) {
      // 3 points: quadratic / Catmull-Rom with duplicate end
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
      // Full 4-point Centripetal Catmull-Rom window
      const n = this.history.length;
      const p0 = this.history[n - 4];
      const p1 = this.history[n - 3];
      const p2 = this.history[n - 2];
      const p3 = this.history[n - 1];

      // Keep buffer bounded
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
    const evalPoint = (t: number): { x: number; y: number; vx: number; vy: number } => {
      // Barry and Goldman's pyramid algorithm
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

      // Numerical velocity derivative
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

      return { x: c_x, y: c_y, vx, vy };
    };

    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const t = t1 + u * (t2 - t1);
      const curr = evalPoint(t);
      const currR = p1.radius + u * (p2.radius - p1.radius);

      // Velocity magnitude normalization for momentum
      const velMag = Math.hypot(curr.vx, curr.vy);
      const normVx = velMag > 0.001 ? (curr.vx / velMag) * Math.min(velMag * 0.08, 2.5) : 0;
      const normVy = velMag > 0.001 ? (curr.vy / velMag) * Math.min(velMag * 0.08, 2.5) : 0;

      segments.push({
        p0: [prevX, prevY],
        p1: [curr.x, curr.y],
        velocity: [normVx, normVy],
        radius0: prevR,
        radius1: currR,
        waterAmount: waterDilution * 0.65,
        pigmentId,
        pigmentDensity: basePigmentDensity * (1.0 - waterDilution * 0.35)
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

    return [
      {
        p0: [p1.x, p1.y],
        p1: [p2.x, p2.y],
        velocity: [vx, vy],
        radius0: p1.radius,
        radius1: p2.radius,
        waterAmount: waterDilution * 0.65,
        pigmentId,
        pigmentDensity: basePigmentDensity * (1.0 - waterDilution * 0.35)
      }
    ];
  }
}
