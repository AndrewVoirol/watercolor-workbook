// Dynamic Directional Ink Wisp Cursor Trail Overlay

export class CursorWisp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    color: string;
  }> = [];
  
  private mouseX = -100;
  private mouseY = -100;
  private activeColor = '#1a1918';
  private brushType = 0; // 0=Fude, 1=Menso, 2=Hake, 3=Fuki-e
  private brushSize = 22;
  private azimuth = 0;
  private isHovered = false;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cursor-wisp-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
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

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.isHovered = true;
    const dx = e.clientX - this.mouseX;
    const dy = e.clientY - this.mouseY;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      this.azimuth = (e as any).azimuthAngle;
    } else if (Math.hypot(dx, dy) > 0.5) {
      this.azimuth = Math.atan2(dy, dx) + Math.PI * 0.5;
    }

    const speed = Math.hypot(dx, dy);
    if (speed > 2 && Math.random() < 0.6) {
      const pCount = (this.brushType === 3) ? 3 : 1;
      for (let k = 0; k < pCount; k++) {
        this.particles.push({
          x: this.mouseX + (Math.random() - 0.5) * (this.brushSize * 0.4),
          y: this.mouseY + (Math.random() - 0.5) * (this.brushSize * 0.4),
          vx: -dx * 0.15 + (Math.random() - 0.5) * 1.5,
          vy: -dy * 0.15 + (Math.random() - 0.5) * 1.5,
          radius: 1.5 + Math.random() * 3.5,
          alpha: 0.5,
          color: this.activeColor
        });
      }
    }
  }

  private animate(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw dynamic brush cursor silhouette
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.save();
      this.ctx.translate(this.mouseX, this.mouseY);

      if (this.brushType === 1) {
        // === MENSO (Fine Liner): Ultra-sharp crosshair & hairline dot ===
        this.ctx.strokeStyle = this.activeColor;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.5;
        
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(-6, 0); this.ctx.lineTo(-3, 0);
        this.ctx.moveTo(3, 0); this.ctx.lineTo(6, 0);
        this.ctx.moveTo(0, -6); this.ctx.lineTo(0, -3);
        this.ctx.moveTo(0, 3); this.ctx.lineTo(0, 6);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.globalAlpha = 0.8;
        this.ctx.fill();

      } else if (this.brushType === 2) {
        // === HAKE (Broad Flat Wash): Rotated ribbon footprint ===
        this.ctx.rotate(this.azimuth);
        const w = this.brushSize * 1.5;
        const h = this.brushSize * 0.45;

        this.ctx.strokeStyle = this.activeColor;
        this.ctx.lineWidth = 1.2;
        this.ctx.globalAlpha = 0.4;
        this.ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);

        // Bristle tooth lines
        this.ctx.beginPath();
        for (let i = -w * 0.4; i <= w * 0.4; i += w * 0.2) {
          this.ctx.moveTo(i, -h * 0.4);
          this.ctx.lineTo(i, h * 0.4);
        }
        this.ctx.globalAlpha = 0.25;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.globalAlpha = 0.7;
        this.ctx.fill();

      } else if (this.brushType === 3) {
        // === FUKI-E (Splatter): Dispersed particle constellation ===
        this.ctx.strokeStyle = this.activeColor;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.25;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.brushSize * 1.2, 0, Math.PI * 2);
        this.ctx.setLineDash([2, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = this.activeColor;
        this.ctx.globalAlpha = 0.6;
        const pts = [
          { x: 0, y: 0, r: 2.2 },
          { x: -8, y: -6, r: 1.4 },
          { x: 10, y: -4, r: 1.2 },
          { x: 6, y: 9, r: 1.6 },
          { x: -7, y: 8, r: 1.1 },
          { x: -14, y: 2, r: 0.9 },
          { x: 12, y: 11, r: 0.8 }
        ];
        for (const pt of pts) {
          this.ctx.beginPath();
          this.ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          this.ctx.fill();
        }

      } else {
        // === FUDE (Classic Round): Smooth glowing droplet wisp ===
        this.ctx.beginPath();
        this.ctx.arc(0, 0, Math.max(3, this.brushSize * 0.25), 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.globalAlpha = 0.6;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, Math.max(8, this.brushSize * 0.55), 0, Math.PI * 2);
        this.ctx.strokeStyle = this.activeColor;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.25;
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    // Draw trailing ethereal wisps
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.radius *= 0.96;
      p.alpha -= 0.015;

      if (p.alpha <= 0 || p.radius < 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1.0;
    requestAnimationFrame(this.animate.bind(this));
  }
}
