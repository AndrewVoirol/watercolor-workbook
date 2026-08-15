// Canvas View & High-DPI Viewport Manager

export class CanvasView {
  public canvas: HTMLCanvasElement;
  private onResizeCallback?: (width: number, height: number, dpr: number) => void;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'watercolor-canvas';
    this.canvas.className = 'w-full h-full block cursor-crosshair touch-none select-none';
    container.appendChild(this.canvas);

    window.addEventListener('resize', this.handleResize.bind(this));
    // Initial size
    this.updateSize();
  }

  public onResize(cb: (width: number, height: number, dpr: number) => void): void {
    this.onResizeCallback = cb;
  }

  public updateSize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    this.onResizeCallback?.(width, height, dpr);
  }

  private handleResize(): void {
    this.updateSize();
  }
}
