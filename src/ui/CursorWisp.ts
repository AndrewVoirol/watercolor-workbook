// Ethereal Ink Wisp Cursor & Organic Brush Footprint Indicator
// Simulates dissolving sumi ink vapors, soft radial dispersion, and dynamic brush tip geometry

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
    if (speed > 1.5 && Math.random() < 0.75) {
      // Spawn soft ethereal ink vapor particles
      const count = (this.brushType === 3) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        this.particles.push({
          x: this.mouseX + (Math.random() - 0.5) * (this.brushSize * 0.3),
          y: this.mouseY + (Math.random() - 0.5) * (this.brushSize * 0.3),
          vx: -dx * 0.12 + (Math.random() - 0.5) * 1.2,
          vy: -dy * 0.12 + (Math.random() - 0.5) * 1.2,
          radius: 4.0 + Math.random() * (this.brushSize * 0.4),
          alpha: 0.45,
          color: this.activeColor
        });
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

    // 1. Draw trailing ethereal ink vapors with soft radial gradients
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.radius += 0.35; // Organic smoke diffusion expansion
      p.alpha -= 0.016;

      if (p.alpha <= 0 || p.radius < 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, this.hexToRgba(p.color, p.alpha * 0.5));
      grad.addColorStop(0.5, this.hexToRgba(p.color, p.alpha * 0.2));
      grad.addColorStop(1, this.hexToRgba(p.color, 0));

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Draw organic brush tip indicator
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.save();
      this.ctx.translate(this.mouseX, this.mouseY);

      if (this.brushType === 1) {
        // === MENSO (面相筆 Fine Sable Liner) ===
        // Needle-sharp fluid bead with delicate whisper halo
        const haloGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
        haloGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.4));
        haloGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = haloGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else if (this.brushType === 2) {
        // === HAKE (刷毛 Broad Flat Wash) ===
        // Smooth organic elliptical ribbon footprint aligned with azimuth
        this.ctx.rotate(this.azimuth);
        const rx = this.brushSize * 0.85;
        const ry = this.brushSize * 0.3;

        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, 0.45);
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();

        const innerGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        innerGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.25));
        innerGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = innerGrad;
        this.ctx.fill();

      } else if (this.brushType === 3) {
        // === FUKI-E (吹き絵 Organic Aerosol Splatter) ===
        const sprayR = this.brushSize * 1.35;
        const sprayGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, sprayR);
        sprayGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.35));
        sprayGrad.addColorStop(0.7, this.hexToRgba(this.activeColor, 0.08));
        sprayGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = sprayGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, sprayR, 0, Math.PI * 2);
        this.ctx.fill();

        // Subtle fluid core
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else {
        // === FUDE (標準筆 Classic Round) ===
        const r = Math.max(4, this.brushSize * 0.45);
        
        // Soft outer feathering
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, 0.4);
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();

        // Center ink bead
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    requestAnimationFrame(this.animate.bind(this));
  }
}
