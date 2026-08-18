// MUJŌ Playful Ghost Wisp & Ethereal Ink Ribbon
// Simulates a trailing spirit ribbon, dissolving sumi vapor plumes, mineral pigment sparks,
// and organic brush footprint previews true to Japanese Nihonga and Shodo aesthetics.

interface GhostNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  alpha: number;
  age: number;
}

interface VaporParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  rotation: number;
  vRot: number;
  spark: boolean;
}

export class CursorWisp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Trailing ghost spirit ribbon nodes
  private ribbonNodes: GhostNode[] = [];
  private readonly maxRibbonNodes = 36;

  // Dissolving vapor plumes and mineral sparks
  private particles: VaporParticle[] = [];

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
  private currentPressure = 0.5;
  private time = 0;

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
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (this.mouseX > 0 && this.mouseY > 0) {
      const dx = clientX - this.mouseX;
      const dy = clientY - this.mouseY;
      this.velX = dx * 0.7 + this.velX * 0.3;
      this.velY = dy * 0.7 + this.velY * 0.3;
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

    const speed = Math.hypot(this.velX, this.velY);

    // Spawn playful spirit vapor puffs and mineral dust
    if (speed > 1.2 && Math.random() < (0.45 + this.waterDilution * 0.45)) {
      const isGold = this.activeColor === '#c5a059';
      const isWhite = this.activeColor === '#f7f4ee';
      const isWater = this.activeColor === '#a8c5d8';
      const count = (this.brushType === 3) ? 3 : (isGold ? 3 : 1);

      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.brushSize * 0.4);
        const pSpeed = isGold ? (1.5 + Math.random() * 2.5) : (0.8 + Math.random() * 1.5);
        const pAngle = angle + (Math.random() - 0.5) * 0.8;

        this.particles.push({
          x: this.mouseX + Math.cos(angle) * dist,
          y: this.mouseY + Math.sin(angle) * dist,
          vx: -this.velX * 0.12 + Math.cos(pAngle) * pSpeed * 0.6,
          vy: -this.velY * 0.12 + Math.sin(pAngle) * pSpeed * 0.6 - 0.4, // Gentle buoyant upward drift
          radius: isGold ? (1.2 + Math.random() * 2.2) : (2.5 + Math.random() * (this.brushSize * 0.35 * (0.5 + this.waterDilution * 0.5))),
          alpha: isWhite ? 0.40 : (isWater ? 0.35 : 0.28 + this.waterDilution * 0.25),
          color: this.activeColor,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.08,
          spark: isGold || (Math.random() < 0.15)
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

  private updateGhostRibbon(): void {
    if (!this.isHovered || this.mouseX < 0 || this.mouseY < 0) {
      // Fade out remaining nodes when offscreen
      for (const node of this.ribbonNodes) {
        node.alpha *= 0.88;
        node.age += 1;
      }
      this.ribbonNodes = this.ribbonNodes.filter(n => n.alpha > 0.01);
      return;
    }

    const speed = Math.hypot(this.velX, this.velY);
    const targetWidth = Math.max(3, this.brushSize * (this.brushType === 1 ? 0.25 : this.brushType === 2 ? 0.8 : 0.55) * (this.isMouseDown ? 1.2 : 0.85));

    // Prepend new head node
    this.ribbonNodes.unshift({
      x: this.mouseX,
      y: this.mouseY,
      vx: this.velX * 0.25,
      vy: this.velY * 0.25,
      width: targetWidth,
      alpha: this.isMouseDown ? 0.38 : 0.24,
      age: 0
    });

    if (this.ribbonNodes.length > this.maxRibbonNodes) {
      this.ribbonNodes.pop();
    }

    // Update trailing nodes with playful ethereal wave drift
    for (let i = 1; i < this.ribbonNodes.length; i++) {
      const node = this.ribbonNodes[i];
      const prev = this.ribbonNodes[i - 1];

      node.age += 1;
      const decay = 1.0 - (i / this.maxRibbonNodes);
      node.alpha = (this.isMouseDown ? 0.38 : 0.24) * Math.pow(decay, 1.4);
      node.width = prev.width * 0.94;

      // Playful undulation / harmonic wave drift
      const waveFreq = this.time * 4.0 + i * 0.45;
      const perpX = -this.velY / Math.max(0.1, speed);
      const perpY = this.velX / Math.max(0.1, speed);
      const waveAmp = Math.sin(waveFreq) * (1.2 + i * 0.15) * Math.min(speed, 6.0);

      node.x += node.vx + perpX * waveAmp * 0.2;
      node.y += node.vy + perpY * waveAmp * 0.2 - 0.25; // Gentle upward spirit rise
      node.vx *= 0.92;
      node.vy *= 0.92;
    }
  }

  private drawGhostRibbon(): void {
    if (this.ribbonNodes.length < 3) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw multi-layered soft spirit ribbon
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.ribbonNodes.length - 1; i++) {
        const p0 = this.ribbonNodes[i];
        const p1 = this.ribbonNodes[i + 1];

        const midX = (p0.x + p1.x) * 0.5;
        const midY = (p0.y + p1.y) * 0.5;

        const w = (pass === 0 ? p0.width * 1.4 : p0.width * 0.85);
        const alpha = (pass === 0 ? p0.alpha * 0.35 : p0.alpha * 0.65) * (0.6 + this.waterDilution * 0.4);

        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alpha);
        this.ctx.lineWidth = Math.max(1.0, w);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  private animate(): void {
    this.time += 0.016;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Update and Draw Playful Ghost Ribbon
    this.updateGhostRibbon();
    this.drawGhostRibbon();

    // 2. Update and Draw Trailing Vapor Plumes and Mineral Sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.rotation += p.vRot;
      p.radius += p.spark ? 0.05 : 0.28; // Sparks stay tight, vapor expands
      p.alpha -= p.spark ? 0.022 : 0.015;

      if (p.alpha <= 0 || p.radius < 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.spark) {
        // Sparkling mineral/gold fleck
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = this.hexToRgba(p.color, p.alpha * 1.3);
        this.ctx.fillRect(-p.radius * 0.5, -p.radius * 0.5, p.radius, p.radius);
        this.ctx.restore();
      } else {
        // Soft billowing vapor plume
        const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, this.hexToRgba(p.color, p.alpha * 0.45));
        grad.addColorStop(0.5, this.hexToRgba(p.color, p.alpha * 0.16));
        grad.addColorStop(1, this.hexToRgba(p.color, 0));

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // 3. Authentic Organic Brush Footprint Indicator
    if (this.isHovered && this.mouseX > 0 && this.mouseY > 0) {
      this.ctx.save();
      this.ctx.translate(this.mouseX, this.mouseY);

      const pressScale = this.isMouseDown ? (0.65 + this.currentPressure * 0.7) : 0.55;
      const alphaBase = (this.isMouseDown ? 0.25 : 0.42) * (0.8 + this.waterDilution * 0.35);

      if (this.brushType === 1) {
        // === MENSO (面相筆 Fine Liner): Delicate hairline needle point ===
        const haloGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 6.5);
        haloGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.4));
        haloGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = haloGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else if (this.brushType === 2) {
        // === HAKE (刷毛 Broad Flat Wash): Elliptical ribbon aligned with azimuth ===
        this.ctx.rotate(this.azimuth);
        const rx = Math.max(10, this.brushSize * 0.85 * pressScale);
        const ry = Math.max(3.5, this.brushSize * 0.22 * pressScale);

        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        // Subtle parallel wash teeth markers
        if (this.waterDilution < 0.7) {
          for (let b = -3; b <= 3; b++) {
            const bx = (b / 3) * (rx * 0.85);
            this.ctx.beginPath();
            this.ctx.moveTo(bx, -ry * 0.75);
            this.ctx.lineTo(bx, ry * 0.75);
            this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase * 0.6);
            this.ctx.lineWidth = 0.8;
            this.ctx.stroke();
          }
        }

      } else if (this.brushType === 3) {
        // === FUKI-E (吹き絵 Aerosol Splatter): Soft dispersed mist zone ===
        const sprayR = Math.max(14, this.brushSize * 1.15);
        const sprayGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, sprayR);
        sprayGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.28));
        sprayGrad.addColorStop(0.7, this.hexToRgba(this.activeColor, 0.06));
        sprayGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = sprayGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, sprayR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
        this.ctx.arc(sprayR * 0.4, sprayR * 0.3, 1.2, 0, Math.PI * 2);
        this.ctx.arc(-sprayR * 0.5, -sprayR * 0.2, 1.0, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else {
        // === MARU-FUDE (丸筆 Conical Calligraphy Tuft): Smooth Katabokashi Asymmetric Preview ===
        const r = Math.max(3.5, this.brushSize * 0.48 * pressScale);
        this.ctx.rotate(this.azimuth);

        // Katabokashi asymmetric gradient across brush belly
        const katabokashiGrad = this.ctx.createLinearGradient(-r, 0, r, 0);
        katabokashiGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.55));
        katabokashiGrad.addColorStop(0.5, this.hexToRgba(this.activeColor, 0.28));
        katabokashiGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0.06 * this.waterDilution));

        this.ctx.fillStyle = katabokashiGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Delicate calligraphic contour
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.9;
        this.ctx.stroke();

        // Tip ink reservoir bead (concentrated leading edge)
        this.ctx.beginPath();
        this.ctx.arc(-r * 0.35, 0, Math.max(1.8, r * 0.22), 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // Decay velocity
    this.velX *= 0.88;
    this.velY *= 0.88;

    requestAnimationFrame(this.animate.bind(this));
  }
}
