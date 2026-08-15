// Ethereal Ink Wisp Cursor Trail Overlay

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

    const speed = Math.hypot(dx, dy);
    if (speed > 2 && Math.random() < 0.6) {
      this.particles.push({
        x: this.mouseX + (Math.random() - 0.5) * 6,
        y: this.mouseY + (Math.random() - 0.5) * 6,
        vx: -dx * 0.15 + (Math.random() - 0.5) * 1.5,
        vy: -dy * 0.15 + (Math.random() - 0.5) * 1.5,
        radius: 2.0 + Math.random() * 4.0,
        alpha: 0.5,
        color: this.activeColor
      });
    }
  }

  private animate(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw main cursor halo
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.beginPath();
      this.ctx.arc(this.mouseX, this.mouseY, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = this.activeColor;
      this.ctx.globalAlpha = 0.6;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(this.mouseX, this.mouseY, 12, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.activeColor;
      this.ctx.lineWidth = 1;
      this.ctx.globalAlpha = 0.25;
      this.ctx.stroke();
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
