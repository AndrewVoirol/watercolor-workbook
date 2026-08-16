// Minimalist Brass Gimbal 2D Canvas Tilt & Gravity Pad UI Component

export class TiltPad {
  public element: HTMLElement;
  private currentGx: number = 0;
  private currentGy: number = 0;
  private isDragging: boolean = false;

  public onGravityChange?: (gx: number, gy: number) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'tilt-pad-container';
    this.render();
    container.appendChild(this.element);
  }

  public getGravity(): [number, number] {
    return [this.currentGx, this.currentGy];
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="tilt-pad-panel">
        <div class="tilt-header">
          <span class="tilt-seal">傾</span>
          <div class="tilt-title-group">
            <span class="tilt-title">CANVAS TILT</span>
            <span class="tilt-angle-label" id="tilt-angle-text">Flat 水平 (0°)</span>
          </div>
        </div>

        <div class="tilt-gimbal-wrapper">
          <!-- 2D Circular Gimbal -->
          <div class="tilt-gimbal" id="tilt-gimbal-disc">
            <div class="gimbal-crosshair-h"></div>
            <div class="gimbal-crosshair-v"></div>
            <div class="gimbal-ring-inner"></div>
            <div class="gimbal-needle" id="gimbal-needle"></div>
          </div>
        </div>

        <!-- Quick Easel Presets -->
        <div class="tilt-presets-row">
          <button class="tilt-preset-btn active" data-gx="0" data-gy="0" data-label="Flat 水平 (0°)">水平 Flat</button>
          <button class="tilt-preset-btn" data-gx="0" data-gy="22" data-label="Incline 傾斜 (15°)">傾斜 15°</button>
          <button class="tilt-preset-btn" data-gx="0" data-gy="58" data-label="Steep 落水 (45°)">落水 45°</button>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const gimbal = this.element.querySelector<HTMLElement>('#tilt-gimbal-disc');
    const needle = this.element.querySelector<HTMLElement>('#gimbal-needle');
    const angleText = this.element.querySelector<HTMLElement>('#tilt-angle-text');
    const presetBtns = this.element.querySelectorAll<HTMLButtonElement>('.tilt-preset-btn');

    const updateTilt = (normX: number, normY: number, labelOverride?: string) => {
      // Clamp magnitude to unit circle
      const mag = Math.sqrt(normX * normX + normY * normY);
      let clampedX = normX;
      let clampedY = normY;
      if (mag > 1.0) {
        clampedX /= mag;
        clampedY /= mag;
      }

      // Max gravity acceleration = 60 px/s^2
      this.currentGx = clampedX * 60.0;
      this.currentGy = clampedY * 60.0;

      // Update needle position
      if (needle) {
        const px = clampedX * 28; // gimbal radius is 32px
        const py = clampedY * 28;
        needle.style.transform = `translate(${px}px, ${py}px)`;
      }

      // Update angle text
      if (angleText) {
        if (labelOverride) {
          angleText.textContent = labelOverride;
        } else {
          const deg = Math.round(Math.min(mag, 1.0) * 45.0);
          if (deg === 0) {
            angleText.textContent = 'Flat 水平 (0°)';
          } else {
            angleText.textContent = `Tilt 傾斜 (${deg}°)`;
          }
        }
      }

      this.onGravityChange?.(this.currentGx, this.currentGy);
    };

    // Gimbal pointer dragging
    const handleGimbalPointer = (e: PointerEvent) => {
      if (!gimbal) return;
      const rect = gimbal.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width / 2;

      const normX = (e.clientX - centerX) / radius;
      const normY = (e.clientY - centerY) / radius;

      presetBtns.forEach(b => b.classList.remove('active'));
      updateTilt(normX, normY);
    };

    gimbal?.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      gimbal.setPointerCapture(e.pointerId);
      handleGimbalPointer(e);
    });

    gimbal?.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        handleGimbalPointer(e);
      }
    });

    const stopDragging = () => {
      this.isDragging = false;
    };

    gimbal?.addEventListener('pointerup', stopDragging);
    gimbal?.addEventListener('pointercancel', stopDragging);

    // Preset buttons
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gx = parseFloat(btn.getAttribute('data-gx') || '0');
        const gy = parseFloat(btn.getAttribute('data-gy') || '0');
        const label = btn.getAttribute('data-label') || 'Custom';

        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const normX = gx / 60.0;
        const normY = gy / 60.0;
        updateTilt(normX, normY, label);
      });
    });

    // Mobile / Tablet Gyroscope / DeviceOrientationEvent integration
    if (window.DeviceOrientationEvent && typeof (window.DeviceOrientationEvent as any).requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (this.isDragging || !e.beta || !e.gamma) return;
        // beta: front-to-back tilt [-180, 180], gamma: left-to-right tilt [-90, 90]
        const normX = Math.max(-1.0, Math.min(1.0, e.gamma / 45.0));
        const normY = Math.max(-1.0, Math.min(1.0, (e.beta - 30.0) / 45.0)); // 30 deg holding offset
        if (Math.abs(normX) > 0.05 || Math.abs(normY) > 0.05) {
          updateTilt(normX, normY);
        }
      });
    }
  }
}
