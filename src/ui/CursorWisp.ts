// Ethereal Ink Wisp Cursor & Dynamic 3D Physical Bristle Skeleton
// Simulates a kinetic cluster of flexible elastic bristle filaments, ferrule ring orientation,
// inertial hair drag, dynamic splay/clumping, and dissolving sumi ink vapors.

interface DynamicFilament {
  // Normalized ferrule coordinates [-1..1]
  u: number;
  v: number;
  // World space positions and velocities
  midX: number;
  midY: number;
  midVx: number;
  midVy: number;
  tipX: number;
  tipY: number;
  tipVx: number;
  tipVy: number;
  restLength: number;
  stiffness: number;
}

export class CursorWisp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Dissolving sumi ink vapor particles
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    color: string;
  }> = [];

  // Kinetic bristle filaments
  private filaments: DynamicFilament[] = [];

  private mouseX = -100;
  private mouseY = -100;
  private velX = 0;
  private velY = 0;
  private activeColor = '#1a1918';
  private brushType = 0; // 0=Maru-fude, 1=Menso, 2=Hake, 3=Fuki-e
  private brushSize = 22;
  private waterDilution = 0.5;
  private azimuth = 0;
  private isHovered = false;
  private isMouseDown = false;
  private pressure = 0.5;

  private lastTime = performance.now();

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

    this.initFilaments();
    this.animate();
  }

  public setColor(color: string): void {
    this.activeColor = color;
  }

  public setBrushType(type: number): void {
    this.brushType = type;
    this.initFilaments();
  }

  public setBrushSize(size: number): void {
    this.brushSize = size;
    this.initFilaments();
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

  private initFilaments(): void {
    this.filaments = [];
    const count = this.brushType === 1 ? 7 : (this.brushType === 2 ? 22 : 16);

    for (let i = 0; i < count; i++) {
      let u = 0;
      let v = 0;

      if (this.brushType === 1) {
        // Menso: tightly packed needle quill
        if (i > 0) {
          const angle = ((i - 1) / (count - 1)) * Math.PI * 2;
          u = Math.cos(angle) * 0.45;
          v = Math.sin(angle) * 0.45;
        }
      } else if (this.brushType === 2) {
        // Hake: flat comb arrangement
        const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
        u = t * 0.92;
        v = (Math.random() - 0.5) * 0.22;
      } else {
        // Maru-fude: round animal hair bundle with concentric rings
        if (i === 0) {
          u = 0;
          v = 0;
        } else if (i < 6) {
          const angle = ((i - 1) / 5) * Math.PI * 2;
          u = Math.cos(angle) * 0.45;
          v = Math.sin(angle) * 0.45;
        } else {
          const angle = ((i - 6) / (count - 6)) * Math.PI * 2 + 0.3;
          u = Math.cos(angle) * 0.88;
          v = Math.sin(angle) * 0.88;
        }
      }

      this.filaments.push({
        u,
        v,
        midX: this.mouseX,
        midY: this.mouseY,
        midVx: 0,
        midVy: 0,
        tipX: this.mouseX,
        tipY: this.mouseY,
        tipVx: 0,
        tipVy: 0,
        restLength: this.brushSize * (0.65 + Math.random() * 0.2),
        stiffness: 0.18 + Math.random() * 0.08,
      });
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    this.isMouseDown = true;
    this.pressure = e.pressure > 0 ? e.pressure : 0.65;
  }

  private handlePointerUp(): void {
    this.isMouseDown = false;
    this.pressure = 0.4;
  }

  private handlePointerMove(e: PointerEvent): void {
    this.isHovered = true;
    const dx = this.mouseX > 0 ? (e.clientX - this.mouseX) : 0;
    const dy = this.mouseY > 0 ? (e.clientY - this.mouseY) : 0;
    this.velX = dx * 0.6 + this.velX * 0.4;
    this.velY = dy * 0.6 + this.velY * 0.4;

    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (e.pressure > 0) {
      this.pressure = e.pressure;
    }

    if (e.pointerType === 'pen' && typeof (e as any).azimuthAngle === 'number') {
      this.azimuth = (e as any).azimuthAngle;
    } else if (Math.hypot(dx, dy) > 0.5) {
      this.azimuth = Math.atan2(dy, dx) + Math.PI * 0.5;
    }

    const speed = Math.hypot(dx, dy);
    if (speed > 1.2 && Math.random() < (0.35 + this.waterDilution * 0.45)) {
      // Spawn soft ethereal ink vapor particles
      const isGold = this.activeColor === '#c5a059';
      const isWhite = this.activeColor === '#f7f4ee';
      const count = (this.brushType === 3) ? 2 : (isGold ? 2 : 1);

      for (let k = 0; k < count; k++) {
        this.particles.push({
          x: this.mouseX + (Math.random() - 0.5) * (this.brushSize * 0.35),
          y: this.mouseY + (Math.random() - 0.5) * (this.brushSize * 0.35),
          vx: -dx * 0.10 + (Math.random() - 0.5) * (isGold ? 2.0 : 1.0),
          vy: -dy * 0.10 + (Math.random() - 0.5) * (isGold ? 2.0 : 1.0),
          radius: isGold ? (1.5 + Math.random() * 2.0) : (2.5 + Math.random() * (this.brushSize * 0.3 * (0.5 + this.waterDilution * 0.5))),
          alpha: isWhite ? 0.30 : (0.22 + this.waterDilution * 0.22),
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

  private updateFilamentPhysics(_dt: number): void {
    if (this.mouseX < 0 || this.mouseY < 0) return;

    const speed = Math.hypot(this.velX, this.velY);
    const rad = Math.max(4, this.brushSize * (this.brushType === 1 ? 0.22 : this.brushType === 2 ? 0.75 : 0.45));
    const pressEffect = this.isMouseDown ? (0.8 + this.pressure * 0.7) : 0.5;
    const splayAmp = (1.0 - this.waterDilution * 0.5) * (0.6 + speed * 0.08) * pressEffect;

    // Ferrule center leads slightly in velocity direction
    const leadDist = Math.min(speed * 0.65, rad * 0.8);
    const leadAngle = speed > 0.1 ? Math.atan2(this.velY, this.velX) : this.azimuth - Math.PI * 0.5;
    const ferruleCenterX = this.mouseX + Math.cos(leadAngle) * leadDist;
    const ferruleCenterY = this.mouseY + Math.sin(leadAngle) * leadDist;

    // Angle of brush handle / comb axis
    const combAngle = this.brushType === 2 ? this.azimuth : (leadAngle + Math.PI * 0.5);
    const cosComb = Math.cos(combAngle);
    const sinComb = Math.sin(combAngle);
    const perpCombX = -sinComb;
    const perpCombY = cosComb;

    for (const f of this.filaments) {
      // 1. Ferrule Root Position
      const rootX = ferruleCenterX + (f.u * cosComb * rad + f.v * perpCombX * (rad * 0.4));
      const rootY = ferruleCenterY + (f.u * sinComb * rad + f.v * perpCombY * (rad * 0.4));

      // 2. Paper Contact Target (lags behind root and splays laterally)
      const dragLagX = -this.velX * 0.85;
      const dragLagY = -this.velY * 0.85;
      const splayOffset = (f.u * cosComb + f.v * perpCombX) * rad * splayAmp;
      const splayOffsetY = (f.u * sinComb + f.v * perpCombY) * rad * splayAmp;

      const targetTipX = this.mouseX + splayOffset + dragLagX;
      const targetTipY = this.mouseY + splayOffsetY + dragLagY;

      // 3. Elastic Spring / Damper Dynamics on Mid-node and Tip-node
      const springK = 0.22 * f.stiffness;
      const damp = 0.82;

      // Mid-node follows halfway between root and tip with slight inertia
      const targetMidX = (rootX + targetTipX) * 0.5 + dragLagX * 0.3;
      const targetMidY = (rootY + targetTipY) * 0.5 + dragLagY * 0.3;

      f.midVx = (f.midVx + (targetMidX - f.midX) * springK * 1.5) * damp;
      f.midVy = (f.midVy + (targetMidY - f.midY) * springK * 1.5) * damp;
      f.midX += f.midVx;
      f.midY += f.midVy;

      // Tip-node follows paper contact point with friction
      f.tipVx = (f.tipVx + (targetTipX - f.tipX) * springK) * damp;
      f.tipVy = (f.tipVy + (targetTipY - f.tipY) * springK) * damp;
      f.tipX += f.tipVx;
      f.tipY += f.tipVy;
    }
  }

  private animate(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) * 0.001, 0.05);
    this.lastTime = now;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update kinetic filaments
    this.updateFilamentPhysics(dt);

    // 1. Trailing Ethereal Ink Vapors
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.radius += 0.28;
      p.alpha -= 0.016;

      if (p.alpha <= 0 || p.radius < 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, this.hexToRgba(p.color, p.alpha * 0.40));
      grad.addColorStop(0.5, this.hexToRgba(p.color, p.alpha * 0.15));
      grad.addColorStop(1, this.hexToRgba(p.color, 0));

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Interactive Dynamic 3D Bristle Wireframe Skeleton & Tip Indicator
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      if (this.brushType === 3) {
        // === FUKI-E (吹き絵 Aerosol Splatter) ===
        const sprayR = Math.max(12, this.brushSize * 1.1);
        const sprayGrad = this.ctx.createRadialGradient(this.mouseX, this.mouseY, 0, this.mouseX, this.mouseY, sprayR);
        sprayGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.3));
        sprayGrad.addColorStop(0.7, this.hexToRgba(this.activeColor, 0.06));
        sprayGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = sprayGrad;
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, sprayR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, 2.0, 0, Math.PI * 2);
        this.ctx.arc(this.mouseX + sprayR * 0.4, this.mouseY + sprayR * 0.3, 1.2, 0, Math.PI * 2);
        this.ctx.arc(this.mouseX - sprayR * 0.5, this.mouseY - sprayR * 0.2, 1.0, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else {
        // === 3D ELASTIC BRISTLE FILAMENT SKELETON (Maru-fude, Menso, Hake) ===
        const rad = Math.max(4, this.brushSize * (this.brushType === 1 ? 0.22 : this.brushType === 2 ? 0.75 : 0.45));
        const speed = Math.hypot(this.velX, this.velY);
        const leadDist = Math.min(speed * 0.65, rad * 0.8);
        const leadAngle = speed > 0.1 ? Math.atan2(this.velY, this.velX) : this.azimuth - Math.PI * 0.5;
        const ferruleCenterX = this.mouseX + Math.cos(leadAngle) * leadDist;
        const ferruleCenterY = this.mouseY + Math.sin(leadAngle) * leadDist;
        const combAngle = this.brushType === 2 ? this.azimuth : (leadAngle + Math.PI * 0.5);

        // A. Subtle Ferrule Ring / Handle Base
        this.ctx.save();
        this.ctx.translate(ferruleCenterX, ferruleCenterY);
        this.ctx.rotate(combAngle);
        this.ctx.beginPath();
        if (this.brushType === 2) {
          this.ctx.ellipse(0, 0, rad * 0.95, rad * 0.25, 0, 0, Math.PI * 2);
        } else {
          this.ctx.ellipse(0, 0, rad * 0.85, rad * 0.45, 0, 0, Math.PI * 2);
        }
        this.ctx.strokeStyle = this.hexToRgba('#d4af37', 0.55); // Warm gold ferrule line
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();
        this.ctx.restore();

        // B. Soft Translucent Ink Belly Halo between filaments
        const bellyGrad = this.ctx.createRadialGradient(this.mouseX, this.mouseY, 0, this.mouseX, this.mouseY, rad * 1.1);
        bellyGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.22 * (0.5 + this.waterDilution * 0.5)));
        bellyGrad.addColorStop(0.7, this.hexToRgba(this.activeColor, 0.07));
        bellyGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = bellyGrad;
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, rad * 1.1, 0, Math.PI * 2);
        this.ctx.fill();

        // C. Draw Flexible Bristle Filaments (Curved Splines from Ferrule Root to Contact Tip)
        for (const f of this.filaments) {
          const cosC = Math.cos(combAngle);
          const sinC = Math.sin(combAngle);
          const rootX = ferruleCenterX + (f.u * cosC * rad - f.v * sinC * (rad * 0.4));
          const rootY = ferruleCenterY + (f.u * sinC * rad + f.v * cosC * (rad * 0.4));

          // Filament Spline
          this.ctx.beginPath();
          this.ctx.moveTo(rootX, rootY);
          this.ctx.quadraticCurveTo(f.midX, f.midY, f.tipX, f.tipY);
          
          const alphaHair = (1.0 - Math.hypot(f.u, f.v) * 0.35) * (this.brushType === 1 ? 0.75 : 0.42);
          this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaHair);
          this.ctx.lineWidth = this.brushType === 1 ? 1.4 : 0.9;
          this.ctx.stroke();

          // Hair Tip Contact Point
          this.ctx.beginPath();
          this.ctx.arc(f.tipX, f.tipY, this.brushType === 1 ? 1.2 : 0.85, 0, Math.PI * 2);
          this.ctx.fillStyle = this.hexToRgba(this.activeColor, alphaHair * 1.2);
          this.ctx.fill();
        }

        // D. Tip Ink Reservoir Core Bead
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, Math.max(1.5, rad * 0.18), 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();
      }
    }

    // Decay velocity
    this.velX *= 0.85;
    this.velY *= 0.85;

    requestAnimationFrame(this.animate.bind(this));
  }
}
