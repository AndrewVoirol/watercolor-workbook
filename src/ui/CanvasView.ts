// Canvas View & High-DPI Viewport Manager
// Mounts the WebGPU canvas directly inside the Honshi Paper Window of the framing engine.

export class CanvasView {
  public canvas: HTMLCanvasElement;
  private onResizeCallback?: (width: number, height: number, dpr: number) => void;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'watercolor-canvas';
    this.canvas.className = 'watercolor-honshi-canvas touch-none select-none';
    container.appendChild(this.canvas);

    // Initial size from container
    this.updateDimensionsFromContainer();
  }

  public onResize(cb: (width: number, height: number, dpr: number) => void): void {
    this.onResizeCallback = cb;
  }

  public setDimensions(width: number, height: number, dpr: number): void {
    const pixelWidth = Math.max(64, Math.floor(width * dpr));
    const pixelHeight = Math.max(64, Math.floor(height * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.onResizeCallback?.(width, height, dpr);
  }

  public updateDimensionsFromContainer(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const width = Math.max(64, Math.floor(rect.width || window.innerWidth));
    const height = Math.max(64, Math.floor(rect.height || window.innerHeight));

    this.setDimensions(width, height, dpr);
  }
}
