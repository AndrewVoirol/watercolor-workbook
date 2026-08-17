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

    // Initial touch contact disc (for immediate dot / ten 点 registration)
    if (this.history.length === 1) {
      const dummyP: RawPointerPoint = {
        ...pt,
        x: pt.x + 0.1,
        y: pt.y + 0.1,
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

    // Wait for at least 3 points so h[0]->h[1] is interpolated with C1 continuity exactly once
    if (this.history.length === 2) {
      return [];
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
      if (this.history.length > 4) {
        this.history.shift();
      }

      return this.interpolateCatmullRom(
        this.history[0],
        this.history[1],
        this.history[2],
        this.history[3],
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

    // Dense subdivision for velvety unbroken liquid strokes: step size <= 1/4 brush radius
    const maxStep = Math.max(avgRadius * 0.25, 1.0);
    const steps = Math.min(Math.max(Math.ceil(chordLen / maxStep), 1), 48);

    let prevX = p1.x;
    let prevY = p1.y;
    let prevR = p1.radius;

    // Evaluation function for centripetal Catmull-Rom
    const evalPoint = (t: number): { x: number; y: number; vx: number; vy: number; kappa: number } => {
      const a1_x = ((t1 - t) * p0.x + (t - t0) * p1.x) / Math.max(t1 - t0, 0.0001);
      const a1_y = ((t1 - t) * p0.y + (t - t0) * p1.y) / Math.max(t1 - t0, 0.0001);

      const a2_x = ((t2 - t) * p1.x + (t - t1) * p2.x) / Math.max(t2 - t1, 0.0001);
      const a2_y = ((t2 - t) * p1.y + (t - t1) * p2.y) / Math.max(t2 - t1, 0.0001);

      const a3_x = ((t3 - t) * p2.x + (t - t2) * p3.x) / Math.max(t3 - t2, 0.0001);
      const a3_y = ((t3 - t) * p2.y + (t - t2) * p3.y) / Math.max(t3 - t2, 0.0001);

      const b1_x = ((t2 - t) * a1_x + (t - t0) * a2_x) / Math.max(t2 - t0, 0.0001);
      const b1_y = ((t2 - t) * a1_y + (t - t0) * a2_y) / Math.max(t2 - t0, 0.0001);

      const b2_x = ((t3 - t) * a2_x + (t - t1) * a3_x) / Math.max(t3 - t1, 0.0001);
      const b2_y = ((t3 - t) * a2_y + (t - t1) * a3_y) / Math.max(t3 - t1, 0.0001);

      const c_x = ((t2 - t) * b1_x + (t - t1) * b2_x) / Math.max(t2 - t1, 0.0001);
      const c_y = ((t2 - t) * b1_y + (t - t1) * b2_y) / Math.max(t2 - t1, 0.0001);

      // Tangent velocity
      const vx = (p2.x - p1.x);
      const vy = (p2.y - p1.y);
      const kappa = 0.0;

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
      const tiltMag = Math.cos(currAltitude);
      const tiltX = Math.sin(currAzimuth) * tiltMag;
      const tiltY = -Math.cos(currAzimuth) * tiltMag;

      // Velocity magnitude normalization for momentum
      const velMag = Math.hypot(curr.vx, curr.vy);
      const normVx = velMag > 0.001 ? (curr.vx / velMag) * Math.min(velMag * 0.08, 2.5) : 0;
      const normVy = velMag > 0.001 ? (curr.vy / velMag) * Math.min(velMag * 0.08, 2.5) : 0;

      // --- Dynamic Reservoir Depletion & Dwell-Time Absorption ---
      const subStepLen = Math.hypot(curr.x - prevX, curr.y - prevY);
      const avgPressure = (p1.pressure + p2.pressure) * 0.5;
      
      let typeMultiplier = 1.0;
      if (p2.brushType === 1) typeMultiplier = 0.75; // Menso
      else if (p2.brushType === 2) typeMultiplier = 2.4; // Hake broad wash
      else if (p2.brushType === 3) typeMultiplier = 1.2; // Fuki-e
      const volumeFactor = Math.pow(Math.max(currR, 2.0), 1.4) * (0.45 + waterDilution * 1.55);
      const baseCapacity = Math.max(450, volumeFactor * 24.0 * typeMultiplier);
      const dt = Math.max((p2.timestamp - p1.timestamp) * 0.001, 0.001);
      const dwellDrain = (dt * (0.35 + avgPressure * 0.45)) / 1.5;
      const spatialDrain = (subStepLen * (0.35 + avgPressure * 0.55)) / baseCapacity;
      const stepDrain = Math.max(spatialDrain, dwellDrain / steps);
      this.currentReservoir = Math.max(0.0, this.currentReservoir - stepDrain);

      // Slider dryness: low water dilution starts dry (Kasure mode)
      const sliderDryness = waterDilution < 0.45 ? Math.pow((0.45 - waterDilution) / 0.45, 1.5) : 0.0;
      // Reservoir dryness: as ink exhausts below 35%, dryness climbs to 1.0
      const reservoirDryness = this.currentReservoir < 0.35 ? Math.pow((0.35 - this.currentReservoir) / 0.35, 1.3) : 0.0;
      const effectiveDryness = Math.min(1.0, Math.max(sliderDryness, reservoirDryness));

      const splay = Math.max(p1.bristleSplay, effectiveDryness);

      const pressureTaper = Math.min(Math.max(avgPressure * 1.4, 0.15), 1.0);
      // Reservoir output drops smoothly to 0 as reservoir empties
      const reservoirOutput = Math.pow(this.currentReservoir, 1.15);
      const waterDeposit = waterDilution * 0.85 * reservoirOutput * pressureTaper;
      const pigmentConc = basePigmentDensity * (0.65 + (1.0 - waterDilution) * 0.35) * reservoirOutput;

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

      // Update prev pointers AFTER pushing segment
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
    const avgRadius = (p1.radius + p2.radius) * 0.5;

    let typeMultiplier = 1.0;
    if (p2.brushType === 1) typeMultiplier = 0.75;
    else if (p2.brushType === 2) typeMultiplier = 2.4;
    else if (p2.brushType === 3) typeMultiplier = 1.2;

    const maxStep = Math.max(avgRadius * 0.25, 1.0);
    const steps = Math.min(Math.max(Math.ceil(chordLen / maxStep), 1), 48);

    const segments: SegmentOutput[] = [];
    let prevX = p1.x;
    let prevY = p1.y;
    let prevR = p1.radius;

    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const currX = p1.x + u * dx;
      const currY = p1.y + u * dy;
      const currR = p1.radius + u * (p2.radius - p1.radius);
      const subStepLen = Math.hypot(currX - prevX, currY - prevY);

      const volumeFactor = Math.pow(Math.max(currR, 2.0), 1.4) * (0.45 + waterDilution * 1.55);
      const baseCapacity = Math.max(450, volumeFactor * 24.0 * typeMultiplier);
      const dwellDrain = (dt * (0.35 + p2.pressure * 0.45)) / 1.5;
      const spatialDrain = (subStepLen * (0.35 + p2.pressure * 0.55)) / baseCapacity;
      const stepDrain = Math.max(spatialDrain, dwellDrain / steps);
      this.currentReservoir = Math.max(0.0, this.currentReservoir - stepDrain);

      const sliderDryness = waterDilution < 0.45 ? Math.pow((0.45 - waterDilution) / 0.45, 1.5) : 0.0;
      const reservoirDryness = this.currentReservoir < 0.35 ? Math.pow((0.35 - this.currentReservoir) / 0.35, 1.3) : 0.0;
      const effectiveDryness = Math.min(1.0, Math.max(sliderDryness, reservoirDryness));

      this.strokeSegmentIndex++;

      const currAzimuth = p1.azimuth + u * (p2.azimuth - p1.azimuth);
      const currAspect = p1.aspectRatio + u * (p2.aspectRatio - p1.aspectRatio);
      const currAltitude = p1.altitude + u * (p2.altitude - p1.altitude);

      const tiltMag = Math.cos(currAltitude);
      const tiltX = Math.sin(currAzimuth) * tiltMag;
      const tiltY = -Math.cos(currAzimuth) * tiltMag;

      const linearPressureTaper = Math.min(Math.max(p2.pressure * 1.4, 0.15), 1.0);
      const reservoirOutput = Math.pow(this.currentReservoir, 1.15);

      segments.push({
        p0: [prevX, prevY],
        p1: [currX, currY],
        velocity: [vx, vy],
        radius0: prevR,
        radius1: currR,
        waterAmount: waterDilution * 0.85 * reservoirOutput * linearPressureTaper,
        pigmentId,
        pigmentDensity: basePigmentDensity * (0.65 + (1.0 - waterDilution) * 0.35) * reservoirOutput,
        brushType: p2.brushType,
        azimuth: currAzimuth,
        aspectRatio: currAspect,
        bristleSplay: Math.max(p2.bristleSplay, effectiveDryness),
        reservoir: this.currentReservoir,
        dryness: effectiveDryness,
        burstSeed: this.strokeSegmentIndex,
        curvature: 0.0,
        tiltX,
        tiltY
      });

      // Update prev pointers AFTER pushing segment
      prevX = currX;
      prevY = currY;
      prevR = currR;
    }

    return segments;
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
        x: p.x + 0.1,
        y: p.y + 0.1,
        timestamp: p.timestamp + 1
      };
      return this.interpolateLinear(p, dummyP, pigmentId, waterDilution, basePigmentDensity);
    }
    if (this.history.length === 2) {
      return this.interpolateLinear(this.history[0], this.history[1], pigmentId, waterDilution, basePigmentDensity);
    }
    if (this.history.length === 3) {
      return this.interpolateCatmullRom(
        this.history[0],
        this.history[1],
        this.history[2],
        this.history[2],
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }
    if (this.history.length >= 4) {
      const n = this.history.length;
      return this.interpolateCatmullRom(
        this.history[n - 3],
        this.history[n - 2],
        this.history[n - 1],
        this.history[n - 1],
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
    }
    return [];
  }
}
