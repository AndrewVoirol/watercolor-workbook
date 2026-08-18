// MUJŌ Seamless Anchored Ghost Wisp & Ethereal Spirit Ribbon
// Features a physically anchored spring-chain head (zero cursor disconnect),
// tapered wave undulation (0 amplitude at cursor, gentle billowing at tail),
// soft smoke buoyancy, and organic brush tuft previews.

interface WispNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  alpha: number;
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

  // Elastic spring-chain nodes (head is always anchored directly to mouse)
  private nodes: WispNode[] = [];
  private readonly numNodes = 24;

  // Trailing vapor plumes and mineral sparks
  private particles: VaporParticle[] = [];

  private mouseX = -100;
  private mouseY = -100;
  private velX = 0;
  private velY = 0;
  private time = 0;

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

    // Initialize node chain
    for (let i = 0; i < this.numNodes; i++) {
      this.nodes.push({
        x: -100,
        y: -100,
        vx: 0,
        vy: 0,
        width: 10,
        alpha: 0
      });
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
      this.velX = dx * 0.65 + this.velX * 0.35;
      this.velY = dy * 0.65 + this.velY * 0.35;
    } else {
      // First move initialization: snap all nodes to cursor
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

    // Spawn soft trailing vapor puffs and mineral sparks on motion
    const speed = Math.hypot(this.velX, this.velY);
    if (speed > 1.8 && Math.random() < (0.35 + this.waterDilution * 0.35)) {
      const isGold = this.activeColor === '#c5a059';
      const isWhite = this.activeColor === '#f7f4ee';
      const isWater = this.activeColor === '#a8c5d8';
      const count = (this.brushType === 3) ? 2 : (isGold ? 2 : 1);

      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.brushSize * 0.4);
        const pSpeed = isGold ? (1.2 + Math.random() * 2.0) : (0.6 + Math.random() * 1.2);
        const pAngle = angle + (Math.random() - 0.5) * 0.6;

        this.particles.push({
          x: this.mouseX + Math.cos(angle) * dist,
          y: this.mouseY + Math.sin(angle) * dist,
          vx: -this.velX * 0.12 + Math.cos(pAngle) * pSpeed * 0.45,
          vy: -this.velY * 0.12 + Math.sin(pAngle) * pSpeed * 0.45 - 0.3, // Gentle upward buoyant drift
          radius: isGold ? (1.2 + Math.random() * 2.0) : (2.5 + Math.random() * (this.brushSize * 0.28 * (0.5 + this.waterDilution * 0.5))),
          alpha: isWhite ? 0.35 : (isWater ? 0.30 : 0.22 + this.waterDilution * 0.22),
          color: this.activeColor,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.05,
          spark: isGold || (Math.random() < 0.12)
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
      for (const node of this.nodes) {
        node.alpha *= 0.85;
      }
      return;
    }

    const speed = Math.hypot(this.velX, this.velY);
    const baseWidth = Math.max(3.0, this.brushSize * (this.brushType === 1 ? 0.22 : this.brushType === 2 ? 0.75 : 0.48) * (this.isMouseDown ? 1.2 : 0.85));

    // 1. Head node (0) is ALWAYS anchored precisely at cursor (Zero Disconnect)
    const head = this.nodes[0];
    head.x = this.mouseX;
    head.y = this.mouseY;
    head.vx = 0;
    head.vy = 0;
    head.width = baseWidth;
    head.alpha = (this.isMouseDown ? 0.42 : 0.28) * (0.7 + this.waterDilution * 0.3);

    // 2. Trailing nodes follow via continuous elastic spring-chain physics
    const springK = 0.36;
    const damping = 0.76;

    for (let i = 1; i < this.numNodes; i++) {
      const curr = this.nodes[i];
      const prev = this.nodes[i - 1];

      // Normalized position along the ribbon [0..1]
      const t = i / (this.numNodes - 1);

      // Spring attraction toward preceding node
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;

      curr.vx = (curr.vx + dx * springK) * damping;
      curr.vy = (curr.vy + dy * springK) * damping;

      curr.x += curr.vx;
      curr.y += curr.vy - 0.22 * t; // Gentle buoyant spirit rise

      // Tapered harmonic wave undulation (0 at head, soft graceful wave toward tail)
      if (speed > 0.5) {
        const wavePhase = this.time * 3.5 - i * 0.35;
        const waveAmp = Math.sin(wavePhase) * Math.min(speed * 0.4, 4.0) * Math.pow(t, 1.5);
        const perpX = -this.velY / Math.max(0.1, speed);
        const perpY = this.velX / Math.max(0.1, speed);

        curr.x += perpX * waveAmp * 0.15;
        curr.y += perpY * waveAmp * 0.15;
      }

      // Smooth width and alpha decay along ribbon
      curr.width = baseWidth * (1.0 + t * 0.35); // Gentle smoke expansion
      curr.alpha = head.alpha * Math.pow(1.0 - t, 1.3);
    }
  }

  private drawGhostRibbon(): void {
    if (this.nodes.length < 3 || this.nodes[0].alpha < 0.01) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw multi-layered celestial silk ribbon (Hagoromo 羽衣)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.nodes.length - 1; i++) {
        const p0 = this.nodes[i];
        const p1 = this.nodes[i + 1];

        if (p0.alpha < 0.01 && p1.alpha < 0.01) continue;

        const midX = (p0.x + p1.x) * 0.5;
        const midY = (p0.y + p1.y) * 0.5;

        const w = pass === 0 ? p0.width * 1.3 : p0.width * 0.75;
        const alpha = (pass === 0 ? p0.alpha * 0.26 : p0.alpha * 0.55) * (0.6 + this.waterDilution * 0.4);

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

    // 1. Update and Draw Anchored Ghost Ribbon
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
      p.radius += p.spark ? 0.04 : 0.22;
      p.alpha -= p.spark ? 0.020 : 0.014;

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
        grad.addColorStop(0, this.hexToRgba(p.color, p.alpha * 0.40));
        grad.addColorStop(0.5, this.hexToRgba(p.color, p.alpha * 0.14));
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

      const pressScale = this.isMouseDown ? (0.60 + this.currentPressure * 0.65) : 0.52;
      const alphaBase = (this.isMouseDown ? 0.25 : 0.40) * (0.8 + this.waterDilution * 0.35);

      if (this.brushType === 1) {
        // === MENSO (面相筆 Fine Liner): Delicate hairline needle point ===
        const haloGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 5.5);
        haloGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.4));
        haloGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = haloGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();

      } else if (this.brushType === 2) {
        // === HAKE (刷毛 Broad Flat Wash): Elliptical ribbon aligned with azimuth ===
        this.ctx.rotate(this.azimuth);
        const rx = Math.max(8, this.brushSize * 0.80 * pressScale);
        const ry = Math.max(3.0, this.brushSize * 0.20 * pressScale);

        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

      } else if (this.brushType === 3) {
        // === FUKI-E (吹き絵 Aerosol Splatter): Soft dispersed mist zone ===
        const sprayR = Math.max(12, this.brushSize * 1.10);
        const sprayGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, sprayR);
        sprayGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.26));
        sprayGrad.addColorStop(0.7, this.hexToRgba(this.activeColor, 0.05));
        sprayGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0));
        this.ctx.fillStyle = sprayGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, sprayR, 0, Math.PI * 2);
        this.ctx.fill();

      } else {
        // === MARU-FUDE (丸筆 Conical Calligraphy Tuft): Smooth Katabokashi Asymmetric Preview ===
        const r = Math.max(3.0, this.brushSize * 0.42 * pressScale);
        this.ctx.rotate(this.azimuth);

        // Katabokashi asymmetric gradient across brush belly
        const katabokashiGrad = this.ctx.createLinearGradient(-r, 0, r, 0);
        katabokashiGrad.addColorStop(0, this.hexToRgba(this.activeColor, 0.50));
        katabokashiGrad.addColorStop(0.5, this.hexToRgba(this.activeColor, 0.25));
        katabokashiGrad.addColorStop(1, this.hexToRgba(this.activeColor, 0.05 * this.waterDilution));

        this.ctx.fillStyle = katabokashiGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Delicate calligraphic contour
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.hexToRgba(this.activeColor, alphaBase);
        this.ctx.lineWidth = 0.85;
        this.ctx.stroke();

        // Tip ink reservoir bead (concentrated leading edge)
        this.ctx.beginPath();
        this.ctx.arc(-r * 0.35, 0, Math.max(1.5, r * 0.20), 0, Math.PI * 2);
        this.ctx.fillStyle = this.activeColor;
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // Velocity decay
    this.velX *= 0.85;
    this.velY *= 0.85;

    requestAnimationFrame(this.animate.bind(this));
  }
}
