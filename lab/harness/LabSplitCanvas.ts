// Lab Split-Screen Canvas with Direct Stroke Callbacks & Multi-Touch/Pointer Support

import { LabExperiment } from './LabExperiment';

export interface LabStrokePoint {
  x: number;          // [0..1] normalized canvas X
  y: number;          // [0..1] normalized canvas Y
  prevX: number;
  prevY: number;
  pressure: number;   // [0..1]
  speed: number;      // normalized velocity
  azimuth: number;    // radians
  altitude: number;   // radians
  isTrackpad: boolean;
}

export class LabSplitCanvas {
  public canvas: HTMLCanvasElement;
  public onStrokeStart: ((pt: LabStrokePoint) => void) | null = null;
  public onStrokeMove: ((pt: LabStrokePoint, prevPt: LabStrokePoint) => void) | null = null;
  public onStrokeEnd: (() => void) | null = null;
  public onResize: ((width: number, height: number, dpr: number) => void) | null = null;

  private dpr = 1;
  private width = 0;
  private height = 0;

  private isPointerDown = false;
  private lastPt: { x: number; y: number } | null = null;
  private lastTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initEventListeners();
    this.updateSize();
  }

  public resize(): void {
    this.updateSize();
  }

  private updateSize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.floor(rect.width * this.dpr);
    this.height = Math.floor(rect.height * this.dpr);

    if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    if (this.onResize) {
      this.onResize(this.width, this.height, this.dpr);
    }
  }

  private extractPoint(e: MouseEvent | PointerEvent | Touch): LabStrokePoint {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const now = performance.now();
    const dt = Math.max(1, now - this.lastTime);
    const px = this.lastPt?.x ?? x;
    const py = this.lastPt?.y ?? y;
    const dist = Math.hypot(x - px, y - py);
    const speed = dist / dt;

    let p = 0.5;
    if ('pressure' in e && (e as PointerEvent).pressure > 0) {
      p = (e as PointerEvent).pressure;
    } else {
      // Dynamic trackpad pressure response based on gesture velocity
      p = Math.min(1.0, 0.45 + speed * 8.0);
    }

    this.lastTime = now;

    return {
      x,
      y,
      prevX: px,
      prevY: py,
      pressure: Math.max(0.2, Math.min(1.0, p)),
      speed: Math.min(1.0, speed * 10),
      azimuth: ('azimuthAngle' in e ? (e as any).azimuthAngle : 0),
      altitude: ('altitudeAngle' in e ? (e as any).altitudeAngle : Math.PI / 4),
      isTrackpad: true
    };
  }

  private initEventListeners(): void {
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      this.isPointerDown = true;
      this.lastTime = performance.now();
      const pt = this.extractPoint(e);
      this.lastPt = { x: pt.x, y: pt.y };

      if (this.onStrokeStart) {
        this.onStrokeStart(pt);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      e.preventDefault();
      const pt = this.extractPoint(e);

      if (this.onStrokeMove && this.lastPt) {
        this.onStrokeMove(pt, { ...pt, x: this.lastPt.x, y: this.lastPt.y });
      }
      this.lastPt = { x: pt.x, y: pt.y };
    };

    const onUp = (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      this.lastPt = null;

      if (this.onStrokeEnd) {
        this.onStrokeEnd();
      }
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);

    // Fallback mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isPointerDown) return;
      onDown(e as unknown as PointerEvent);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerDown) return;
      onMove(e as unknown as PointerEvent);
    });
    window.addEventListener('mouseup', (e) => {
      if (!this.isPointerDown) return;
      onUp(e as unknown as PointerEvent);
    });

    window.addEventListener('resize', () => this.resize());
  }
}
