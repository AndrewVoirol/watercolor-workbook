// Interactive Sub-Pixel Microscope Inspection Loupe Controller

export class MicroscopeLens {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sourceCanvas: HTMLCanvasElement;
  private label: HTMLElement;
  public isVisible: boolean = false;
  public zoomLevel: number = 8;
  public mousePos = { x: 0.5, y: 0.5 };

  constructor(sourceCanvas: HTMLCanvasElement) {
    this.sourceCanvas = sourceCanvas;
    this.container = document.getElementById('microscope-lens') as HTMLElement;
    this.canvas = document.getElementById('microscope-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.label = document.getElementById('microscope-zoom-label') as HTMLElement;

    this.canvas.width = 180;
    this.canvas.height = 180;

    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'l' || e.key === 'L') {
        this.toggle();
      } else if (e.key === '+' || e.key === '=') {
        this.setZoom(Math.min(16, this.zoomLevel * 2));
      } else if (e.key === '-' || e.key === '_') {
        this.setZoom(Math.max(2, this.zoomLevel / 2));
      }
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  public setZoom(zoom: number): void {
    this.zoomLevel = zoom;
    if (this.label) {
      this.label.textContent = `${this.zoomLevel}X RETINA`;
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const rect = this.sourceCanvas.getBoundingClientRect();
    this.mousePos.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.mousePos.y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (!this.isVisible || !this.container) return;

    const size = 180;
    const offset = 24;
    let x = e.clientX + offset;
    let y = e.clientY + offset;

    if (x + size > window.innerWidth) x = e.clientX - size - offset;
    if (y + size > window.innerHeight) y = e.clientY - size - offset;

    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;

    // Draw high-resolution botanical fiber tooth grid in 2D loupe
    this.renderLoupeInspection(this.mousePos.x, this.mousePos.y);
  }

  private renderLoupeInspection(normX: number, normY: number): void {
    const w = 180;
    const h = 180;
    this.ctx.clearRect(0, 0, w, h);

    // Background slate
    this.ctx.fillStyle = '#14161a';
    this.ctx.fillRect(0, 0, w, h);

    // Sub-pixel grid
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    const step = 18;
    for (let x = 0; x <= w; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Fiber strands inspection simulation
    const seed = (normX * 1000 + normY * 500);
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    this.ctx.lineWidth = 2.5;

    for (let i = 0; i < 6; i++) {
      this.ctx.beginPath();
      const yBase = (i * 30 + (seed % 20)) % h;
      this.ctx.moveTo(0, yBase);
      this.ctx.bezierCurveTo(w * 0.3, yBase + 15, w * 0.7, yBase - 15, w, yBase);
      this.ctx.stroke();
    }

    // Reticle crosshair
    this.ctx.strokeStyle = '#e5533d';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2 - 12, h / 2);
    this.ctx.lineTo(w / 2 + 12, h / 2);
    this.ctx.moveTo(w / 2, h / 2 - 12);
    this.ctx.lineTo(w / 2, h / 2 + 12);
    this.ctx.stroke();

    // Center circular reticle
    this.ctx.beginPath();
    this.ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
    this.ctx.stroke();
  }
}
