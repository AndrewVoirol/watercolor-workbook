// MUJŌ Minimalist Brush Footprint Indicator
// Quiet, serene brush contact indicator matching the authentic Zen ethos of Nihonga and Shodo.
// Free of artificial UI gizmos, wireframe skeletons, or particle noise.

export class CursorWisp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private mouseX = -100;
  private mouseY = -100;
  private activeColor = '#1a1918';
  private brushType = 0; // 0=Maru-fude, 1=Menso, 2=Hake, 3=Fuki-e
  private brushSize = 22;
  private waterDilution = 0.5;
  private azimuth = 0;
  private isHovered = false;
  private isMouseDown = false;
  private currentPressure = 0.5;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cursor-wisp-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    document.addEventListener('pointerleave', () => { this.isHovered = false; });

    this.animate();
  }

  public setColor(color: string): void {
    this.activeColor = color;
  }

  public setBrushType(type: number): void {
    this.brushType = type;
  }

  public setBrushSize(size: number): void {
    this.brushSize = size;
  }

  public setWaterDilution(dilution: number): void {
    this.waterDilution = dilution;
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private handlePointerDown(e: PointerEvent): void {
    this.isMouseDown = true;
    this.currentPressure = e.pressure > 0 ? e.pressure : 0.6;
  }

  private handlePointerUp(): void {
    this.isMouseDown = false;
    this.currentPressure = 0.4;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.isHovered = true;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (e.pressure > 0) {
      this.currentPressure = e.pressure;
    }

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      this.azimuth = (e as any).azimuthAngle;
    } else {
      const dx = typeof e.movementX === 'number' ? e.movementX : 0;
      const dy = typeof e.movementY === 'number' ? e.movementY : 0;
      if (Math.hypot(dx, dy) > 0.5) {
        this.azimuth = Math.atan2(dy, dx) + Math.PI * 0.5;
      }
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  private animate(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.save();
      this.ctx.translate(this.mouseX, this.mouseY);

      const pressScale = this.isMouseDown ? (0.6 + this.currentPressure * 0.7) : 0.5;
      const alphaBase = (this.isMouseDown ? 0.20 : 0.38) * (0.8 + this.waterDilution * 0.4);

      if (this.brushType === 1) {
        // === MENSO (面相筆 Fine Liner): Delicate hairline targeting point ===
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.hexToRgba(this.activeColor, 0.7);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase * 0.7);
        this.ctx.lineWidth = 0.75;
        this.ctx.stroke();

      } else if (this.brushType === 2) {
        // === HAKE (刷毛 Broad Flat Wash): Subtle elliptical contact patch ===
        this.ctx.rotate(this.azimuth);
        const rx = Math.max(8, this.brushSize * 0.75 * pressScale);
        const ry = Math.max(3, this.brushSize * 0.22 * pressScale);

        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.85;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
        this.ctx.fillStyle = this.hexToRgba(this.activeColor, 0.6);
        this.ctx.fill();

      } else if (this.brushType === 3) {
        // === FUKI-E (吹き絵 Aerosol): Soft radial mist perimeter ===
        const r = Math.max(10, this.brushSize * 1.0);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase * 0.5);
        this.ctx.setLineDash([2, 4]);
        this.ctx.lineWidth = 0.75;
        this.ctx.stroke();
        this.ctx.setLineDash([]);

      } else {
        // === MARU-FUDE (丸筆 Classic Round): Clean organic contact ring ===
        const r = Math.max(3, this.brushSize * 0.45 * pressScale);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.85;
        this.ctx.stroke();

        // Delicate central ink contact point
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
        this.ctx.fillStyle = this.hexToRgba(this.activeColor, 0.6);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    requestAnimationFrame(this.animate.bind(this));
  }
}
