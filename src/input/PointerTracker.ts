// Pointer Tracker & Brush Event Processor
// Collects sub-frame hardware events via getCoalescedEvents(), handles stylus tilt, azimuth, pressure, and drives SplineEngine

import { SplineEngine, RawPointerPoint, SegmentOutput } from './SplineEngine';

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
  
  public config: BrushConfig = {
    brushType: 0, // Maru-fude default
    pigmentId: 0,
    waterDilution: 0.5,
    brushSize: 22,
    pigmentDensity: 0.85
  };

  public onStrokeStart?: (x: number, y: number, pressure: number) => void;
  public onStrokeMove?: (x: number, y: number, speed: number) => void;
  public onStrokeEnd?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.splineEngine = new SplineEngine();
    this.setupListeners();
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

  private lastTimestamp: number = 0;

  private calculateRadius(e: PointerEvent, speed: number): number {
    let pressure = e.pressure;
    // macOS Force Touch / WebKit pressure fallback
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      pressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (pressure === 0 || pressure === 0.5) {
      // Dynamic pressure estimated from gesture speed & deceleration
      pressure = Math.min(1.0, Math.max(0.25, 0.45 + (1.0 - Math.min(1.0, speed * 0.05)) * 0.4));
    }

    // Dynamic calligraphic speed tapering (fast flick = sharp whisker tip, slow press = wide wash)
    const speedTaper = Math.min(1.25, Math.max(0.35, 1.0 - speed * 0.045));
    const base = this.config.brushSize;

    switch (this.config.brushType) {
      case 1: // Menso (Fine Liner) - Hairline precision with crisp tapering
        return (1.2 + (base / 64) * 2.5 + Math.pow(pressure, 1.8) * 3.5) * speedTaper;
      case 2: // Hake (Broad Flat Wash) - Wide flat ribbon
        return (base * 1.35) * (0.45 + pressure * 0.65) * Math.max(0.6, speedTaper);
      default: // Maru-fude (Classic Round) - Dynamic calligraphic swell and spring
        return (base * 0.75) * (0.30 + Math.pow(pressure, 1.2) * 0.85) * speedTaper;
    }
  }

  private lastCoords: { x: number; y: number } = { x: -1, y: -1 };
  private tipX: number = -1;
  private tipY: number = -1;
  private tipVx: number = 0;
  private tipVy: number = 0;

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
      aspectRatio = (this.config.brushType === 2) ? 0.35 : 0.85;
    }

    // Base bristle splay derived from low water dilution
    const bristleSplay = Math.max(0.0, Math.pow(1.0 - this.config.waterDilution, 1.5));

    return { azimuth, altitude, aspectRatio, bristleSplay };
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.isDrawing = true;
    this.splineEngine.reset();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for synthetic pointer IDs
    }

    const coords = this.getGridCoordinates(e);
    this.lastCoords = { x: coords.x, y: coords.y };
    this.tipX = coords.x;
    this.tipY = coords.y;
    this.tipVx = 0;
    this.tipVy = 0;
    this.lastTimestamp = performance.now();
    const radius = this.calculateRadius(e, 0);
    const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e, coords);

    let initPressure = e.pressure;
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      initPressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (initPressure === 0 || initPressure === 0.5) {
      initPressure = 0.55;
    }

    const point: RawPointerPoint = {
      x: coords.x,
      y: coords.y,
      pressure: initPressure,
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
    if (!this.isDrawing) return;

    const events: PointerEvent[] = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];

    const now = performance.now();
    const dt = Math.max(1, now - (this.lastTimestamp || now));
    this.lastTimestamp = now;

    // Physical animal-hair elasticity and damping parameters per brush craft
    const kSpring = this.config.brushType === 1 ? 0.92 : (this.config.brushType === 2 ? 0.58 : 0.72);
    const damp = this.config.brushType === 1 ? 0.94 : (this.config.brushType === 2 ? 0.82 : 0.88);

    for (const subEvent of events) {
      const subCoords = this.getGridCoordinates(subEvent);
      
      // Viscoelastic brush tip lag simulation
      const fx = (subCoords.x - this.tipX) * kSpring;
      const fy = (subCoords.y - this.tipY) * kSpring;
      this.tipVx = (this.tipVx + fx) * damp;
      this.tipVy = (this.tipVy + fy) * damp;
      this.tipX += this.tipVx;
      this.tipY += this.tipVy;

      const dx = this.lastCoords.x >= 0 ? this.tipX - this.lastCoords.x : 0;
      const dy = this.lastCoords.y >= 0 ? this.tipY - this.lastCoords.y : 0;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt;

      const radius = this.calculateRadius(subEvent, speed);
      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(subEvent, { x: this.tipX, y: this.tipY });
      this.lastCoords = { x: this.tipX, y: this.tipY };

      let movePressure = subEvent.pressure;
      if (typeof (subEvent as any).webkitForce === 'number' && (subEvent as any).webkitForce > 0) {
        movePressure = Math.min(1.0, (subEvent as any).webkitForce / 2.0);
      } else if (movePressure === 0 || movePressure === 0.5) {
        movePressure = Math.min(1.0, Math.max(0.25, 0.45 + (1.0 - Math.min(1.0, speed * 0.05)) * 0.4));
      }

      const point: RawPointerPoint = {
        x: this.tipX,
        y: this.tipY,
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

      this.onStrokeMove?.(this.tipX, this.tipY, speed);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Terminal calligraphic tip snap-back recovery (Harai / Hane / Shippitsu 終筆)
    if (this.lastCoords.x >= 0 && this.tipX >= 0) {
      const finalCoords = this.getGridCoordinates(e);
      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e, finalCoords);
      const exitPoint: RawPointerPoint = {
        x: finalCoords.x,
        y: finalCoords.y,
        pressure: 0.15,
        timestamp: performance.now(),
        radius: this.calculateRadius(e, 2.0) * 0.4,
        brushType: this.config.brushType,
        azimuth,
        altitude,
        aspectRatio,
        bristleSplay
      };
      const exitSegments = this.splineEngine.pushPoint(
        exitPoint,
        this.config.pigmentId,
        this.config.waterDilution,
        this.config.pigmentDensity
      );
      this.pendingSegments.push(...exitSegments);
    }

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
