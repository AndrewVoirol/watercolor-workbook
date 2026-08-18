// MUJŌ Serene Minimalist Brush Indicator & Subtle Spirit Trail
// Pure, distraction-free calligraphy preview and delicate trailing ink whisper.
// Zero floating particles, zero noisy boxes, zero visual clutter.

interface TrailNode {
  x: number;
  y: number;
  width: number;
  alpha: number;
}

export class CursorWisp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Short, subtle trailing ink whisper (10 nodes)
  private nodes: TrailNode[] = [];
  private readonly numNodes = 10;

  private mouseX = -100;
  private mouseY = -100;
  private velX = 0;
  private velY = 0;

  private activeColor = '#1a1918';
  private brushType = 0; // 0=Maru-fude, 1=Menso, 2=Hake, 3=Fuki-e
  private brushSize = 18;
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

    for (let i = 0; i < this.numNodes; i++) {
      this.nodes.push({ x: -100, y: -100, width: 8, alpha: 0 });
    }

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
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (this.mouseX > 0 && this.mouseY > 0) {
      const dx = clientX - this.mouseX;
      const dy = clientY - this.mouseY;
      this.velX = dx * 0.6 + this.velX * 0.4;
      this.velY = dy * 0.6 + this.velY * 0.4;
    } else {
      for (const node of this.nodes) {
        node.x = clientX;
        node.y = clientY;
      }
    }

    this.mouseX = clientX;
    this.mouseY = clientY;

    if (e.pressure > 0) {
      this.currentPressure = e.pressure;
    }

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      this.azimuth = (e as any).azimuthAngle;
    } else if (Math.hypot(this.velX, this.velY) > 0.5) {
      this.azimuth = Math.atan2(this.velY, this.velX) + Math.PI * 0.5;
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

  private updateTrail(): void {
    if (!this.isHovered || this.mouseX < 0 || this.mouseY < 0) {
      for (const node of this.nodes) {
        node.alpha *= 0.85;
      }
      return;
    }

    const baseWidth = Math.max(2.5, this.brushSize * (this.brushType === 1 ? 0.18 : this.brushType === 2 ? 0.65 : 0.42) * (this.isMouseDown ? 1.15 : 0.80));

    // Head is locked directly to cursor
    const head = this.nodes[0];
    head.x = this.mouseX;
    head.y = this.mouseY;
    head.width = baseWidth;
    head.alpha = (this.isMouseDown ? 0.35 : 0.22);

    // Smooth elastic trail
    const springK = 0.48;
    const damping = 0.72;

    for (let i = 1; i < this.numNodes; i++) {
      const curr = this.nodes[i];
      const prev = this.nodes[i - 1];
      const t = i / (this.numNodes - 1);

      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;

      curr.x += dx * springK * damping;
      curr.y += dy * springK * damping;

      curr.width = baseWidth * (1.0 - t * 0.65);
      curr.alpha = head.alpha * Math.pow(1.0 - t, 1.5);
    }
  }

  private drawTrail(): void {
    if (this.nodes.length < 2 || this.nodes[0].alpha < 0.01) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (let i = 0; i < this.nodes.length - 1; i++) {
      const p0 = this.nodes[i];
      const p1 = this.nodes[i + 1];

      if (p0.alpha < 0.01 && p1.alpha < 0.01) continue;

      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;

      this.ctx.beginPath();
      this.ctx.moveTo(p0.x, p0.y);
      this.ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      this.ctx.strokeStyle = this.hexToRgba(this.activeColor, p0.alpha * 0.50);
      this.ctx.lineWidth = Math.max(1.0, p0.width);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private animate(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Subtle, clean trailing ink whisper
    this.updateTrail();
    this.drawTrail();

    // 2. Clean, elegant Japanese Brush Footprint Indicator
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.save();
      this.ctx.translate(this.mouseX, this.mouseY);

      const pressScale = this.isMouseDown ? (0.60 + this.currentPressure * 0.65) : 0.50;
      const alphaBase = this.isMouseDown ? 0.30 : 0.45;

      if (this.brushType === 1) {
        // === MENSO (面相筆 Fine Liner): Crisp delicate needle point ===
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase * 0.5);
        this.ctx.lineWidth = 0.8;
        this.ctx.stroke();

      } else if (this.brushType === 2) {
        // === HAKE (刷毛 Broad Flat Wash): Clean flat wash boundary ===
        this.ctx.rotate(this.azimuth);
        const rx = Math.max(8, this.brushSize * 0.75 * pressScale);
        const ry = Math.max(2.8, this.brushSize * 0.18 * pressScale);

        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.9;
        this.ctx.stroke();

      } else {
        // === MARU-FUDE (丸筆 Conical Calligraphy Tuft): Serene Calligraphic Preview ===
        const r = Math.max(2.8, this.brushSize * 0.40 * pressScale);
        this.ctx.rotate(this.azimuth);

        // Soft translucent belly
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fillStyle = this.hexToRgba(this.activeColor, 0.06 + this.waterDilution * 0.12);
        this.ctx.fill();

        // Delicate outer contour
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.85;
        this.ctx.stroke();

        // Tip bead
        this.ctx.beginPath();
        this.ctx.arc(-r * 0.30, 0, Math.max(1.2, r * 0.22), 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    this.velX *= 0.85;
    this.velY *= 0.85;

    requestAnimationFrame(this.animate.bind(this));
  }
}
