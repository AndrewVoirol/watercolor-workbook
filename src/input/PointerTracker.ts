// Pointer Tracker & Brush Event Processor
// Collects sub-frame hardware events via getCoalescedEvents(), handles stylus tilt, azimuth, pressure, and drives SplineEngine

import { SplineEngine, RawPointerPoint, SegmentOutput } from './SplineEngine';

export interface BrushConfig {
  brushType: number;       // 0=Fude, 1=Menso, 2=Hake, 3=Fuki-e
  pigmentId: number;       // 0=Sumi, 1=Shu, 2=Ai, 3=Oudo, 4=Rokusho, 5=Water, 6=Salt
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
    brushType: 0, // Fude default
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

  private calculateRadius(e: PointerEvent): number {
    let pressure = e.pressure;
    if (pressure === 0 || pressure === 0.5) {
      pressure = 0.65;
    }

    const base = this.config.brushSize;
    switch (this.config.brushType) {
      case 1: // Menso (Fine Liner)
        return base * 0.35 * (0.4 + pressure * 0.6);
      case 2: // Hake (Broad Flat Wash)
        return base * 1.85 * (0.45 + pressure * 0.55);
      case 3: // Fuki-e (Splatter & Aerosol Mist)
        return base * 2.2 * (0.5 + pressure * 0.5);
      default: // Fude (Classic Round)
        return base * (0.35 + pressure * 0.75);
    }
  }

  private extractStylusKinematics(e: PointerEvent): { azimuth: number; altitude: number; aspectRatio: number; bristleSplay: number } {
    let azimuth = 0;
    let altitude = Math.PI / 3; // 60 degrees default
    let aspectRatio = 0.85;

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      azimuth = (e as any).azimuthAngle;
      altitude = (e as any).altitudeAngle ?? (Math.PI / 3);
      aspectRatio = Math.max(0.2, Math.sin(altitude));
      this.lastAzimuth = azimuth;
    } else {
      // Tangential velocity fallback for mouse / finger
      if (Math.hypot(e.movementX, e.movementY) > 0.5) {
        azimuth = Math.atan2(e.movementY, e.movementX) + Math.PI * 0.5;
        this.lastAzimuth = azimuth;
      } else {
        azimuth = this.lastAzimuth;
      }
      aspectRatio = (this.config.brushType === 2) ? 0.35 : 0.85;
    }

    // Bristle splay (Kasure) increases as water dilution drops
    const bristleSplay = Math.max(0.0, 1.0 - this.config.waterDilution * 1.4);

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
    const radius = this.calculateRadius(e);
    const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e);

    const point: RawPointerPoint = {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure || 0.65,
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

    for (const subEvent of events) {
      const coords = this.getGridCoordinates(subEvent);
      const radius = this.calculateRadius(subEvent);
      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(subEvent);

      const point: RawPointerPoint = {
        x: coords.x,
        y: coords.y,
        pressure: subEvent.pressure || 0.65,
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
    }

    const lastCoords = this.getGridCoordinates(e);
    this.onStrokeMove?.(lastCoords.x, lastCoords.y, Math.hypot(e.movementX, e.movementY));
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
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
