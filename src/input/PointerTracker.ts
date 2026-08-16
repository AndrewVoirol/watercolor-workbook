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
  private lastFukieTime: number = 0;
  private lastFukiePos: { x: number; y: number } = { x: -100, y: -100 };
  
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
      case 1: // Menso (Fine Liner) - Stiff sable precision curve (1.0..3.8px)
        return 0.9 + (base / 64) * 1.5 + Math.pow(pressure, 2.2) * 1.4;
      case 2: // Hake (Broad Flat Wash) - Wide flat ribbon (10..72px)
        return (base * 1.15) * (0.45 + pressure * 0.65);
      case 3: // Fuki-e (Splatter & Aerosol Mist) - Wide dispersion cone (14..80px)
        return (base * 1.35) * (0.6 + pressure * 0.4);
      default: // Fude (Classic Round) - Dynamic calligraphic swell (2.5..38px)
        return (base * 0.55) * (0.3 + pressure * 0.85);
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
      aspectRatio = (this.config.brushType === 2) ? 0.28 : 0.85;
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
    const radius = this.calculateRadius(e);
    const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(e);

    this.lastFukieTime = performance.now();
    this.lastFukiePos = { x: coords.x, y: coords.y };

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

    const coords = this.getGridCoordinates(e);

    // For Fuki-e (Splatter), enforce discrete burst intervals to avoid continuous muddy caterpillars
    if (this.config.brushType === 3) {
      const now = performance.now();
      const distFromLast = Math.hypot(coords.x - this.lastFukiePos.x, coords.y - this.lastFukiePos.y);
      const minInterval = Math.max(14.0, this.config.brushSize * 0.4);
      
      if (distFromLast < minInterval && (now - this.lastFukieTime) < 80) {
        return; // Skip intermediate coalesced events to keep distinct splatter bursts
      }
      this.lastFukieTime = now;
      this.lastFukiePos = { x: coords.x, y: coords.y };
    }

    const events: PointerEvent[] = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];

    for (const subEvent of events) {
      const subCoords = this.getGridCoordinates(subEvent);
      const radius = this.calculateRadius(subEvent);
      const { azimuth, altitude, aspectRatio, bristleSplay } = this.extractStylusKinematics(subEvent);

      const point: RawPointerPoint = {
        x: subCoords.x,
        y: subCoords.y,
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
    const tapSegments = this.splineEngine.flushTapIfSinglePoint(
      this.config.pigmentId,
      this.config.waterDilution,
      this.config.pigmentDensity
    );
    if (tapSegments.length > 0) {
      this.pendingSegments.push(...tapSegments);
    }
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
