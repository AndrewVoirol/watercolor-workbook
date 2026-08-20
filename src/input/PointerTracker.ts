import { SplineEngine, RawPointerPoint, SegmentOutput } from './SplineEngine';
import { FerruleStateInput } from '../simulation/UniformsManager';

export interface BrushConfig {
  brushType: number;       // 0=Maru-fude (Round), 1=Menso (Fine Liner), 2=Hake (Flat Wash)
  pigmentId: number;       // 0=Sumi, 1=Shu, 2=Ai, 3=Odo, 4=Rokusho, 5=Water
  waterDilution: number;   // 0.1..1.0
  brushSize: number;       // 8..64 (grid pixels)
  pigmentDensity: number;  // 0.2..1.0
}

export class PointerTracker {
  private canvas: HTMLCanvasElement;
  private splineEngine: SplineEngine;
  private isDrawing: boolean = false;
  private pendingSegments: SegmentOutput[] = [];
  private lastAzimuth: number = 0;
  private lastCoords: { x: number; y: number } = { x: -1, y: -1 };
  private lastTimestamp: number = 0;

  // 3D Physical Ferrule Kinematic State
  private ferruleX: number = 512;
  private ferruleY: number = 512;
  private ferruleZ: number = 32;
  private targetFerruleZ: number = 32;
  private ferruleDirX: number = 0;
  private ferruleDirY: number = 0;
  private ferruleDirZ: number = -1;
  private ferruleTiltAngle: number = 0;
  private currentPressure: number = 0;
  
  public config: BrushConfig = {
    brushType: 0, // Maru-fude default
    pigmentId: 0,
    waterDilution: 0.5,
    brushSize: 18,
    pigmentDensity: 0.85
  };

  private smoothedSpeed = 0;
  private currentFilteredRadius = 0;
  private isStrokeStart = false;

  public onStrokeStart?: (x: number, y: number, pressure: number) => void;
  public onStrokeMove?: (x: number, y: number, speed: number) => void;
  public onStrokeEnd?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.splineEngine = new SplineEngine();
    this.setupListeners();
  }

  public getFerruleState(dt: number): FerruleStateInput {
    // Smooth vertical descent / ascent of ferrule
    this.ferruleZ += (this.targetFerruleZ - this.ferruleZ) * 0.45;
    const isStart = this.isStrokeStart;
    this.isStrokeStart = false;

    return {
      posX: this.ferruleX,
      posY: this.ferruleY,
      posZ: this.ferruleZ,
      isDrawing: this.isDrawing,
      isStrokeStart: isStart,
      tiltDirX: this.ferruleDirX,
      tiltDirY: this.ferruleDirY,
      tiltDirZ: this.ferruleDirZ,
      tiltAngle: this.ferruleTiltAngle,
      pressure: this.currentPressure,
      speed: this.smoothedSpeed,
      brushType: this.config.brushType,
      dt,
      brushSize: this.config.brushSize,
      pigmentId: this.config.pigmentId,
      waterDilution: this.config.waterDilution,
      pigmentDensity: this.config.pigmentDensity
    };
  }

  private setupListeners(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    window.addEventListener('pointercancel', this.handlePointerUp.bind(this));
  }

  private getGridCoordinates(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1024, nx * 1024)),
      y: Math.max(0, Math.min(1024, ny * 1024))
    };
  }

  // Physical Brush Contact Radius: authentic calligraphic dynamic width matching selected brush size
  private calculateRadius(e: PointerEvent, speed = 0): number {
    const base = this.config.brushSize;

    let pressure: number;
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      pressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (e.pressure > 0 && e.pressure !== 0.5) {
      pressure = e.pressure;
    } else {
      // Natural kinematic pressure model for mouse/trackpad:
      // - Gentle/deliberate movements settle into rich belly (pressure ~ 0.70)
      // - Swift, agile gestures narrow gracefully toward the nimble tip (pressure ~ 0.40)
      const speedRatio = Math.min(1.0, speed / 3.5);
      pressure = Math.max(0.35, 0.70 - speedRatio * 0.30);
    }

    switch (this.config.brushType) {
      case 1: {
        // === MENSO (面相筆 Fine Sable Liner) ===
        const minMenso = 0.8;
        const maxMenso = 1.2 + (base / 64) * 1.8;
        return minMenso + (maxMenso - minMenso) * Math.pow(pressure, 1.2);
      }

      case 2: {
        // === HAKE (刷毛 Broad Flat Goat-Hair Wash) ===
        return base * (0.60 + pressure * 0.40);
      }

      default: {
        // === MARU-FUDE (丸筆 / 太筆 Conical Calligraphy Tuft) ===
        const minRadius = Math.max(1.8, base * 0.25);
        const maxRadius = base * 0.85;
        return minRadius + (maxRadius - minRadius) * Math.pow(pressure, 1.2);
      }
    }
  }

  private extractStylusKinematics(e: PointerEvent, currentCoords?: { x: number; y: number }): { azimuth: number; altitude: number; aspectRatio: number; bristleSplay: number } {
    let azimuth = 0;
    let altitude = Math.PI / 3; // 60 degrees default
    let aspectRatio = 0.85;

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      azimuth = (e as any).azimuthAngle;
      altitude = (e as any).altitudeAngle ?? (Math.PI / 3);
      aspectRatio = Math.max(0.2, Math.sin(altitude));
      this.lastAzimuth = azimuth;
    } else {
      // Tangential velocity fallback for mouse / finger using coordinate deltas
      const dx = (typeof e.movementX === 'number' && e.movementX !== 0)
        ? e.movementX
        : (currentCoords && this.lastCoords.x >= 0 ? currentCoords.x - this.lastCoords.x : 0);
      const dy = (typeof e.movementY === 'number' && e.movementY !== 0)
        ? e.movementY
        : (currentCoords && this.lastCoords.y >= 0 ? currentCoords.y - this.lastCoords.y : 0);

      if (Math.hypot(dx, dy) > 0.3) {
        azimuth = Math.atan2(dy, dx) + Math.PI * 0.5;
        this.lastAzimuth = azimuth;
      } else {
        azimuth = this.lastAzimuth;
      }
      aspectRatio = (this.config.brushType === 2) ? 0.30 : 0.85;
    }

    // Dynamic bristle splay derived from low water dilution and speed
    const bristleSplay = Math.max(0.0, Math.pow(1.0 - this.config.waterDilution, 1.4));

    return { azimuth, altitude, aspectRatio, bristleSplay };
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.isDrawing = true;
    this.isStrokeStart = true;
    this.splineEngine.reset();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for synthetic pointer IDs
    }

    const coords = this.getGridCoordinates(e);
    this.lastCoords = { x: coords.x, y: coords.y };
    this.lastTimestamp = performance.now();
    this.smoothedSpeed = 0;
    const targetRadius = this.calculateRadius(e, 0);
    this.currentFilteredRadius = targetRadius * 0.55; // Soft initial touch on paper landing
    const radius = this.currentFilteredRadius;
    const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e, coords);

    let initialPressure = e.pressure;
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      initialPressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (initialPressure === 0 || initialPressure === 0.5) {
      initialPressure = 0.40;
    }

    this.ferruleX = coords.x;
    this.ferruleY = coords.y;
    this.currentPressure = initialPressure;
    this.targetFerruleZ = Math.max(1.5, (1.0 - initialPressure * 0.85) * this.config.brushSize * 0.85);
    this.ferruleZ = this.targetFerruleZ;
    this.ferruleDirX = 0;
    this.ferruleDirY = 0;
    this.ferruleDirZ = -1;
    this.ferruleTiltAngle = 0;

    const point: RawPointerPoint = {
      x: coords.x,
      y: coords.y,
      pressure: initialPressure,
      timestamp: performance.now(),
      radius,
      brushType: this.config.brushType,
      azimuth,
      altitude,
      aspectRatio,
      bristleSplay
    };

    const segments = this.splineEngine.pushPoint(
      point,
      this.config.pigmentId,
      this.config.waterDilution,
      this.config.pigmentDensity
    );
    this.pendingSegments.push(...segments);

    this.onStrokeStart?.(coords.x, coords.y, point.pressure);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDrawing) {
      const coords = this.getGridCoordinates(e);
      this.ferruleX = coords.x;
      this.ferruleY = coords.y;
      this.lastCoords = { x: coords.x, y: coords.y };
      return;
    }

    const events: PointerEvent[] = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];

    const now = performance.now();
    const dt = Math.max(1, now - (this.lastTimestamp || now));
    this.lastTimestamp = now;
    const subDt = Math.max(0.5, dt / events.length);

    for (const subEvent of events) {
      const subCoords = this.getGridCoordinates(subEvent);
      const dx = this.lastCoords.x >= 0 ? subCoords.x - this.lastCoords.x : 0;
      const dy = this.lastCoords.y >= 0 ? subCoords.y - this.lastCoords.y : 0;
      const dist = Math.hypot(dx, dy);
      const instSpeed = dist / subDt;

      // Low-pass filtered speed for smooth kinematic transition
      this.smoothedSpeed = this.smoothedSpeed * 0.70 + instSpeed * 0.30;

      const targetRadius = this.calculateRadius(subEvent, this.smoothedSpeed);
      // Low-pass filtered radius: eliminates beaded oscillations and provides organic continuity
      this.currentFilteredRadius = this.currentFilteredRadius * 0.75 + targetRadius * 0.25;
      const radius = this.currentFilteredRadius;

      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(subEvent, subCoords);
      this.lastCoords = { x: subCoords.x, y: subCoords.y };

      let movePressure = subEvent.pressure;
      if (typeof (subEvent as any).webkitForce === 'number' && (subEvent as any).webkitForce > 0) {
        movePressure = Math.min(1.0, (subEvent as any).webkitForce / 2.0);
      } else if (movePressure === 0 || movePressure === 0.5) {
        movePressure = 0.60;
      }

      this.ferruleX = subCoords.x;
      this.ferruleY = subCoords.y;
      this.currentPressure = movePressure;
      this.targetFerruleZ = Math.max(1.5, (1.0 - movePressure * 0.85) * this.config.brushSize * 0.85);

      // Handle 3D Tilt orientation
      if (subEvent.pointerType === 'pen' && typeof (subEvent as any).altitudeAngle === 'number') {
        const tiltAmt = Math.max(0.0, Math.PI * 0.5 - (subEvent as any).altitudeAngle);
        const az = (subEvent as any).azimuthAngle ?? 0;
        this.ferruleTiltAngle = tiltAmt;
        this.ferruleDirX = Math.sin(az) * Math.sin(tiltAmt);
        this.ferruleDirY = -Math.cos(az) * Math.sin(tiltAmt);
        this.ferruleDirZ = -Math.cos(tiltAmt);
      } else if (dist > 0.05) {
        const maxTilt = 0.52; // ~30 degrees backward lean
        const tiltAmt = Math.min(maxTilt, (instSpeed / 8.0) * maxTilt);
        const angle = Math.atan2(dy, dx);
        this.ferruleTiltAngle = tiltAmt;
        this.ferruleDirX = -Math.cos(angle) * Math.sin(tiltAmt);
        this.ferruleDirY = -Math.sin(angle) * Math.sin(tiltAmt);
        this.ferruleDirZ = -Math.cos(tiltAmt);
      }

      const point: RawPointerPoint = {
        x: subCoords.x,
        y: subCoords.y,
        pressure: movePressure,
        timestamp: now,
        radius,
        brushType: this.config.brushType,
        azimuth,
        altitude,
        aspectRatio,
        bristleSplay
      };

      const segments = this.splineEngine.pushPoint(
        point,
        this.config.pigmentId,
        this.config.waterDilution,
        this.config.pigmentDensity
      );
      this.pendingSegments.push(...segments);

      this.onStrokeMove?.(subCoords.x, subCoords.y, this.smoothedSpeed);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.currentPressure = 0;
    this.targetFerruleZ = this.config.brushSize * 1.8;
    this.ferruleTiltAngle = 0;
    this.ferruleDirX = 0;
    this.ferruleDirY = 0;
    this.ferruleDirZ = -1;

    this.lastCoords = { x: -1, y: -1 };
    this.pendingSegments.push(...this.splineEngine.flushRemaining(
      this.config.pigmentId,
      this.config.waterDilution,
      this.config.pigmentDensity
    ));
    this.splineEngine.reset();
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignored
    }
    this.onStrokeEnd?.();
  }

  public getAndClearPendingSegments(): SegmentOutput[] {
    const segs = this.pendingSegments;
    this.pendingSegments = [];
    return segs;
  }

  public getIsDrawing(): boolean {
    return this.isDrawing;
  }
}
