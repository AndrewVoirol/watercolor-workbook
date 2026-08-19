// Pointer Tracker & Brush Event Processor
// Collects sub-frame hardware events via getCoalescedEvents(), handles stylus tilt, azimuth, pressure,
// and drives SplineEngine with true Japanese animal-hair brush kinematics.

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
  private lastCoords: { x: number; y: number } = { x: -1, y: -1 };
  private lastTimestamp: number = 0;
  
  public config: BrushConfig = {
    brushType: 0, // Maru-fude default
    pigmentId: 0,
    waterDilution: 0.5,
    brushSize: 18,
    pigmentDensity: 0.85
  };

  private lastVelocity = { vx: 0, vy: 0, speed: 0 };

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

  // Dynamic 3D Conical Tuft Radius Calculation: authentic calligraphic pressure & speed dynamics
  private calculateRadius(e: PointerEvent, speed: number): number {
    const base = this.config.brushSize;

    let effectivePressure: number;
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      effectivePressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (e.pressure > 0 && e.pressure !== 0.5) {
      effectivePressure = e.pressure;
    } else {
      // Natural kinematic pressure model for mouse/trackpad:
      // - Slow, deliberate dragging presses down the brush belly (effectivePressure ~ 0.85)
      // - Agile/faster sweeping lifts the brush naturally toward the tip (effectivePressure ~ 0.35)
      const speedNorm = Math.min(1.0, speed / 3.0);
      effectivePressure = Math.max(0.20, 0.85 - speedNorm * 0.55);
    }

    switch (this.config.brushType) {
      case 1: {
        // === MENSO (面相筆 Fine Sable Liner) ===
        const minMenso = 0.8;
        const maxMenso = 1.4 + (base / 64) * 2.0;
        return minMenso + (maxMenso - minMenso) * Math.pow(effectivePressure, 1.3);
      }

      case 2: {
        // === HAKE (刷毛 Broad Flat Goat-Hair Wash) ===
        return (base * 1.15) * (0.40 + effectivePressure * 0.60);
      }

      default: {
        // === MARU-FUDE (丸筆 / 太筆 Conical Calligraphy Tuft) ===
        // Dynamic calligraphic response:
        // - Quick flicks & nimble strokes narrow gracefully toward fine tip (~25% base)
        // - Deliberate presses expand into full rich belly (~100% base)
        const minRadius = Math.max(1.6, base * 0.25);
        const maxRadius = base * 1.0;
        return minRadius + (maxRadius - minRadius) * Math.pow(effectivePressure, 1.2);
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
    this.splineEngine.reset();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for synthetic pointer IDs
    }

    const coords = this.getGridCoordinates(e);
    this.lastCoords = { x: coords.x, y: coords.y };
    this.lastTimestamp = performance.now();
    const radius = this.calculateRadius(e, 0);
    const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e, coords);

    let initialPressure = e.pressure;
    if (typeof (e as any).webkitForce === 'number' && (e as any).webkitForce > 0) {
      initialPressure = Math.min(1.0, (e as any).webkitForce / 2.0);
    } else if (initialPressure === 0 || initialPressure === 0.5) {
      initialPressure = 0.50;
    }

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
    if (!this.isDrawing) return;

    const events: PointerEvent[] = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];

    const now = performance.now();
    const dt = Math.max(1, now - (this.lastTimestamp || now));
    this.lastTimestamp = now;

    for (const subEvent of events) {
      const subCoords = this.getGridCoordinates(subEvent);
      const dx = this.lastCoords.x >= 0 ? subCoords.x - this.lastCoords.x : 0;
      const dy = this.lastCoords.y >= 0 ? subCoords.y - this.lastCoords.y : 0;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt;

      // Update instantaneous velocity vector for flick taper projection
      if (dist > 0.1) {
        this.lastVelocity = {
          vx: (dx / dt) * 0.7 + this.lastVelocity.vx * 0.3,
          vy: (dy / dt) * 0.7 + this.lastVelocity.vy * 0.3,
          speed: speed * 0.7 + this.lastVelocity.speed * 0.3
        };
      }

      const radius = this.calculateRadius(subEvent, speed);
      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(subEvent, subCoords);
      this.lastCoords = { x: subCoords.x, y: subCoords.y };

      let movePressure = subEvent.pressure;
      if (typeof (subEvent as any).webkitForce === 'number' && (subEvent as any).webkitForce > 0) {
        movePressure = Math.min(1.0, (subEvent as any).webkitForce / 2.0);
      } else if (movePressure === 0 || movePressure === 0.5) {
        movePressure = Math.min(1.0, Math.max(0.20, 0.40 + (1.0 - Math.min(1.0, speed * 0.06)) * 0.45));
      }

      // Dynamic splay increases with speed on dry brush
      const dynamicSplay = Math.min(1.0, bristleSplay + Math.min(0.4, speed * 0.05));

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
        bristleSplay: dynamicSplay
      };

      const segments = this.splineEngine.pushPoint(
        point,
        this.config.pigmentId,
        this.config.waterDilution,
        this.config.pigmentDensity
      );
      this.pendingSegments.push(...segments);

      this.onStrokeMove?.(subCoords.x, subCoords.y, speed);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Terminal calligraphic tip snap-back recovery & flick taper (Harai / Hane / Shippitsu 終筆)
    if (this.lastCoords.x >= 0) {
      const finalCoords = { ...this.lastCoords };
      const { azimuth, altitude } = this.extractStylusKinematics(e, finalCoords);

      // If released while moving (flick, checkmark, or swift stroke exit), project authentic tapered point
      if (this.lastVelocity.speed > 0.15) {
        const velMag = Math.hypot(this.lastVelocity.vx, this.lastVelocity.vy);
        const dirX = velMag > 0.001 ? this.lastVelocity.vx / velMag : 0;
        const dirY = velMag > 0.001 ? this.lastVelocity.vy / velMag : 0;
        const flickLen = Math.min(Math.max(velMag * 10.0, 3.0), 22.0);
        const flickX = finalCoords.x + dirX * flickLen;
        const flickY = finalCoords.y + dirY * flickLen;

        const tipPoint: RawPointerPoint = {
          x: flickX,
          y: flickY,
          pressure: 0.02,
          timestamp: performance.now() + 10,
          radius: 0.8, // Fine calligraphic needle point
          brushType: this.config.brushType,
          azimuth,
          altitude,
          aspectRatio: 0.20,
          bristleSplay: 0.0
        };
        this.pendingSegments.push(...this.splineEngine.pushPoint(
          tipPoint,
          this.config.pigmentId,
          this.config.waterDilution * 0.75,
          this.config.pigmentDensity * 0.65
        ));
      }
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
