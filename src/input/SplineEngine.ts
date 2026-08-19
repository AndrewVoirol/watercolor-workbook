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
  private lastEvaluatedIndex: number = 0;

  public reset(): void {
    this.history = [];
    this.currentReservoir = 1.0;
    this.stabilizedX = -1;
    this.stabilizedY = -1;
    this.strokeSegmentIndex = 0;
    this.lastEvaluatedIndex = 0;
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
        this.stabilizedX = this.stabilizedX * 0.35 + pt.x * 0.65;
        this.stabilizedY = this.stabilizedY * 0.35 + pt.y * 0.65;
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

    // 3. Micro-jitter filtering: discard redundant events that haven't moved at least 0.5px
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const distSq = (pt.x - last.x) * (pt.x - last.x) + (pt.y - last.y) * (pt.y - last.y);
      if (distSq < 0.25) { // < 0.5px movement
        return [];
      }
    }

    this.history.push(pt);
    const n = this.history.length;

    // True Lag-by-One Spline Pipeline:
    // When point P_n arrives (n >= 3), we interpolate span P_{n-2} -> P_{n-1}
    // using the exact 4-point basis (P_{n-3}, P_{n-2}, P_{n-1}, P_n).
    // This guarantees 100% C1 derivative continuity across all interior nodes.
    if (n < 3) {
      return [];
    }

    const p0 = (n >= 4) ? this.history[n - 4] : {
      ...this.history[n - 3],
      x: 2 * this.history[n - 3].x - this.history[n - 2].x,
      y: 2 * this.history[n - 3].y - this.history[n - 2].y
    };
    const p1 = this.history[n - 3];
    const p2 = this.history[n - 2];
    const p3 = this.history[n - 1]; // True real future point!

    this.lastEvaluatedIndex = n - 2;

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

  // Centripetal Catmull-Rom Spline between p1 and p2 using true p0 and p3 tangents
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

    // Segment chord length & radius
    const chordLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const avgRadius = (p1.radius + p2.radius) * 0.5;

    // Dense sub-pixel subdivision: step size <= 1/5 brush radius or 0.5px (guarantees continuous C1 curves even on fast swipes)
    const maxStep = Math.max(avgRadius * 0.20, 0.5);
    const steps = Math.min(Math.max(Math.ceil(chordLen / maxStep), 1), 256);

    let prevX = p1.x;
    let prevY = p1.y;
    let prevR = p1.radius;

    // Physical velocity in px/ms
    const dtMillis = Math.max(p2.timestamp - p1.timestamp, 1);
    const physVx = (p2.x - p1.x) / dtMillis;
    const physVy = (p2.y - p1.y) / dtMillis;
    const velMag = Math.hypot(physVx, physVy);

    // Centripetal Catmull-Rom evaluation
    const evalPoint = (t: number): { x: number; y: number } => {
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

      return { x: c_x, y: c_y };
    };

    const spanT = t2 - t1;
    const epsT = Math.max(spanT * 0.005, 0.0001);

    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const t = t1 + u * spanT;
      const curr = evalPoint(t);
      const currR = p1.radius + u * (p2.radius - p1.radius);

      // Compute local derivative C'(t) and 2nd derivative C''(t) for analytic curvature
      const pMinus = evalPoint(Math.max(t0, t - epsT));
      const pPlus = evalPoint(Math.min(t3, t + epsT));

      const dX = (pPlus.x - pMinus.x) / (2 * epsT);
      const dY = (pPlus.y - pMinus.y) / (2 * epsT);
      const d2X = (pPlus.x - 2 * curr.x + pMinus.x) / (epsT * epsT);
      const d2Y = (pPlus.y - 2 * curr.y + pMinus.y) / (epsT * epsT);

      const dMagSq = dX * dX + dY * dY;
      const dMag = Math.sqrt(dMagSq);

      let rawCurvature = 0.0;
      if (dMagSq > 0.0001) {
        const cross = dX * d2Y - dY * d2X;
        rawCurvature = cross / Math.pow(dMagSq, 1.5);
      }
      // Scale signed curvature by local radius and clamp to [-1, 1]
      const curvature = Math.max(-1.0, Math.min(1.0, rawCurvature * currR * 0.45));

      // Local tangent velocity vector
      const subStepLen = Math.hypot(curr.x - prevX, curr.y - prevY);
      const stepNormVx = dMag > 0.001 ? (dX / dMag) * Math.min(velMag * 1.5 + 0.5, 3.0) : 0;
      const stepNormVy = dMag > 0.001 ? (dY / dMag) * Math.min(velMag * 1.5 + 0.5, 3.0) : 0;

      // Interpolate stylus angle & kinematics
      const currAzimuth = p1.azimuth + u * (p2.azimuth - p1.azimuth);
      const currAspect = p1.aspectRatio + u * (p2.aspectRatio - p1.aspectRatio);
      const currAltitude = p1.altitude + u * (p2.altitude - p1.altitude);

      // Normalized stylus tilt with curvature lateral deflection
      const tiltMag = Math.cos(currAltitude);
      const tiltX = Math.sin(currAzimuth) * tiltMag + curvature * 0.35;
      const tiltY = -Math.cos(currAzimuth) * tiltMag;

      // Dynamic Reservoir Depletion (Generous capacity supporting 2-3 full canvas sweeps)
      const avgPressure = (p1.pressure + p2.pressure) * 0.5;

      let typeMultiplier = 1.0;
      if (p2.brushType === 1) typeMultiplier = 0.85; // Menso fine liner
      else if (p2.brushType === 2) typeMultiplier = 2.2; // Hake broad wash

      const volumeFactor = Math.pow(Math.max(currR, 2.0), 1.2) * (0.60 + waterDilution * 1.40);
      const baseCapacity = Math.max(18000, volumeFactor * 600.0 * typeMultiplier);
      const spatialDrain = (subStepLen * (0.10 + avgPressure * 0.16)) / baseCapacity;
      this.currentReservoir = Math.max(0.0, this.currentReservoir - spatialDrain);

      // Authentic Dryness (Kasure): activates on low water dilution (< 25%) or depleted ink reservoir (< 15%)
      const sliderDryness = waterDilution < 0.25 ? Math.pow((0.25 - waterDilution) / 0.25, 1.6) : 0.0;
      const reservoirDryness = this.currentReservoir < 0.15 ? Math.pow((0.15 - this.currentReservoir) / 0.15, 1.4) : 0.0;
      const effectiveDryness = Math.min(1.0, Math.max(sliderDryness, reservoirDryness));

      // Bristle splay only occurs when dry or turning hard
      const turnSplay = Math.abs(curvature) * 0.15;
      const splay = Math.min(1.0, Math.max(p1.bristleSplay, effectiveDryness * 0.85 + turnSplay * effectiveDryness));

      const pressureTaper = Math.min(Math.max(avgPressure * 1.2, 0.35), 1.0);
      const reservoirOutput = Math.pow(Math.max(this.currentReservoir, 0.25), 0.35);
      const waterDeposit = waterDilution * 0.90 * reservoirOutput * pressureTaper;
      const pigmentConc = basePigmentDensity * (0.75 + (1.0 - waterDilution) * 0.25) * reservoirOutput;

      this.strokeSegmentIndex++;

      segments.push({
        p0: [prevX, prevY],
        p1: [curr.x, curr.y],
        velocity: [stepNormVx, stepNormVy],
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
        burstSeed: this.strokeSegmentIndex * 0.6180339887,
        curvature,
        tiltX: Math.max(-1.0, Math.min(1.0, tiltX)),
        tiltY: Math.max(-1.0, Math.min(1.0, tiltY))
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
    const avgRadius = (p1.radius + p2.radius) * 0.5;

    let typeMultiplier = 1.0;
    if (p2.brushType === 1) typeMultiplier = 0.85;
    else if (p2.brushType === 2) typeMultiplier = 2.2;

    const maxStep = Math.max(avgRadius * 0.20, 0.5);
    const steps = Math.min(Math.max(Math.ceil(chordLen / maxStep), 1), 256);

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

      const volumeFactor = Math.pow(Math.max(currR, 2.0), 1.2) * (0.60 + waterDilution * 1.40);
      const baseCapacity = Math.max(18000, volumeFactor * 600.0 * typeMultiplier);
      const spatialDrain = (subStepLen * (0.10 + p2.pressure * 0.16)) / baseCapacity;
      this.currentReservoir = Math.max(0.0, this.currentReservoir - spatialDrain);

      const sliderDryness = waterDilution < 0.25 ? Math.pow((0.25 - waterDilution) / 0.25, 1.6) : 0.0;
      const reservoirDryness = this.currentReservoir < 0.15 ? Math.pow((0.15 - this.currentReservoir) / 0.15, 1.4) : 0.0;
      const effectiveDryness = Math.min(1.0, Math.max(sliderDryness, reservoirDryness));

      this.strokeSegmentIndex++;

      const currAzimuth = p1.azimuth + u * (p2.azimuth - p1.azimuth);
      const currAspect = p1.aspectRatio + u * (p2.aspectRatio - p1.aspectRatio);
      const currAltitude = p1.altitude + u * (p2.altitude - p1.altitude);

      const tiltMag = Math.cos(currAltitude);
      const tiltX = Math.sin(currAzimuth) * tiltMag;
      const tiltY = -Math.cos(currAzimuth) * tiltMag;

      const linearPressureTaper = Math.min(Math.max(p2.pressure * 1.2, 0.35), 1.0);
      const reservoirOutput = Math.pow(Math.max(this.currentReservoir, 0.25), 0.35);

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
        burstSeed: this.strokeSegmentIndex * 0.6180339887,
        curvature: 0.0,
        tiltX,
        tiltY
      });

      prevX = currX;
      prevY = currY;
      prevR = currR;
    }

    return segments;
  }

  public getHistoryLength(): number {
    return this.history.length;
  }

  // Flushes any remaining un-rendered spans when pointer lifts (pointer up)
  public flushRemaining(
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    const n = this.history.length;
    if (n === 0) return [];

    // Single point touch / tap (点 Ten)
    if (n === 1) {
      const p = this.history[0];
      const dummyP: RawPointerPoint = {
        ...p,
        x: p.x + 0.1,
        y: p.y + 0.1,
        timestamp: p.timestamp + 1
      };
      return this.interpolateLinear(p, dummyP, pigmentId, waterDilution, basePigmentDensity);
    }

    // Two points total: render initial linear span
    if (n === 2) {
      return this.interpolateLinear(this.history[0], this.history[1], pigmentId, waterDilution, basePigmentDensity);
    }

    // If there is an unevaluated final span P_{n-2} -> P_{n-1}
    const finalSegments: SegmentOutput[] = [];
    if (this.lastEvaluatedIndex < n - 1) {
      const p0 = (n >= 3) ? this.history[n - 3] : this.history[n - 2];
      const p1 = this.history[n - 2];
      const p2 = this.history[n - 1];

      const p3: RawPointerPoint = {
        ...p2,
        x: 2 * p2.x - p1.x,
        y: 2 * p2.y - p1.y
      };

      const segs = this.interpolateCatmullRom(
        p0,
        p1,
        p2,
        p3,
        pigmentId,
        waterDilution,
        basePigmentDensity
      );
      finalSegments.push(...segs);
    }

    return finalSegments;
  }

  // Legacy compatibility alias
  public flushTapIfSinglePoint(
    pigmentId: number,
    waterDilution: number,
    basePigmentDensity: number
  ): SegmentOutput[] {
    return this.flushRemaining(pigmentId, waterDilution, basePigmentDensity);
  }
}
