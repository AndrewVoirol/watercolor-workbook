// Pointer Tracker & Brush Event Processor
// Collects sub-frame hardware events via getCoalescedEvents(), handles pressure, and drives SplineEngine

import { SplineEngine, RawPointerPoint, SegmentOutput } from './SplineEngine';

export interface BrushConfig {
  pigmentId: number;       // 0=Sumi, 1=Shu, 2=Ai, 3=Oudo, 4=Rokusho, 5=Water
  waterDilution: number;   // 0.1..1.0
  brushSize: number;       // 8..64 (grid pixels)
  pigmentDensity: number;  // 0.2..1.0
}

export class PointerTracker {
  private canvas: HTMLCanvasElement;
  private splineEngine: SplineEngine;
  private isDrawing: boolean = false;
  private pendingSegments: SegmentOutput[] = [];
  
  public config: BrushConfig = {
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
    // If standard mouse without hardware pressure, simulate natural pressure based on configuration
    if (pressure === 0 || pressure === 0.5) {
      pressure = 0.65;
    }
    return this.config.brushSize * (0.35 + pressure * 0.75);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.isDrawing = true;
    this.splineEngine.reset();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for synthetic or non-capturable pointer IDs
    }

    const coords = this.getGridCoordinates(e);
    const radius = this.calculateRadius(e);
    const point: RawPointerPoint = {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure || 0.65,
      timestamp: performance.now(),
      radius
    };

    // Initial point generates small initial splat capsule
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

    // Use getCoalescedEvents() if available to capture high-rate digitizer events (e.g. 120Hz/240Hz stylus)
    const events: PointerEvent[] = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0
      ? e.getCoalescedEvents()
      : [e];

    for (const subEvent of events) {
      const coords = this.getGridCoordinates(subEvent);
      const radius = this.calculateRadius(subEvent);
      const point: RawPointerPoint = {
        x: coords.x,
        y: coords.y,
        pressure: subEvent.pressure || 0.65,
        timestamp: performance.now(),
        radius
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
