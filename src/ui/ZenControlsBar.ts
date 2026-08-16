// Zen Controls Bar: Top Header Orchestration (Brand, Washi Selector Slot, Action Buttons, and Info Modal)

export class ZenControlsBar {
  public element: HTMLElement;
  public washiSlot!: HTMLElement;
  private isBreatheActive: boolean = false;
  private isAudioMuted: boolean = false;

  public onBreatheToggle?: (active: boolean) => void;
  public onSpringRain?: () => void;
  public onAudioToggle?: (muted: boolean) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'zen-controls-bar-container';
    this.render();
    container.appendChild(this.element);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="zen-top-bar">
        <!-- 1. Brand & Philosophy Badge -->
        <div class="brand-badge">
          <span class="zen-kanji-logo">無常</span>
          <div class="brand-text">
            <span class="brand-title">MUJŌ <span>・ 墨彩画</span></span>
            <span class="brand-desc">Fluid Watercolor & Sumi on Washi</span>
          </div>
        </div>

        <!-- 2. Center Slot for Washi Paper Selector -->
        <div class="washi-selector-slot" id="washi-selector-slot"></div>

        <!-- 3. Action Controls Group -->
        <div class="actions-group">
          <!-- Breathe / Preserve Button -->
          <button id="btn-breathe" class="zen-action-btn" title="Preserve ink from evaporating (調息 Chōsoku)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v3m0 12v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M3 12h3m12 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span class="btn-label-jp">調息</span>
            <span class="btn-label-en">Breathe</span>
          </button>

          <!-- Spring Rain / Dissolve Button -->
          <button id="btn-spring-rain" class="zen-action-btn" title="Dissolve canvas with gentle spring rain (春雨 Harusame)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/>
              <path d="M8 19v2m4-3v3m4-2v2"/>
            </svg>
            <span class="btn-label-jp">春雨</span>
            <span class="btn-label-en">Rain</span>
          </button>

          <!-- Sound Toggle Button -->
          <button id="btn-sound" class="zen-action-btn ${this.isAudioMuted ? 'muted' : ''}" title="Toggle ambient garden soundscape (松風・水音 Hibiki)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <span class="btn-label-jp">響き</span>
            <span class="btn-label-en">Sound</span>
          </button>

          <!-- Info / Help Modal Toggle -->
          <button id="btn-info" class="zen-action-btn icon-only" title="東洋の美学と物理演算 (Aesthetics & Physics)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Info Modal Dialog -->
      <div id="info-modal" class="info-modal hidden">
        <div class="info-modal-backdrop"></div>
        <div class="info-modal-content">
          <div class="modal-header">
            <div class="modal-header-titles">
              <h3>東洋の美学と物理演算</h3>
              <span class="modal-header-sub">AESTHETICS & HYDRODYNAMIC SIMULATION</span>
            </div>
            <button id="modal-close" class="modal-close-btn" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body">
            <p class="modal-intro">
              <strong>MUJŌ (無常)</strong> is a physically-based digital watercolor engine running entirely on <strong>WebGPU compute shaders</strong>.
              It simulates the ephemeral beauty and hydrodynamics of water, sumi ink, mineral pigments, and handmade Japanese Washi paper.
            </p>
            <div class="feature-grid">
              <div class="feature-card">
                <h4><span class="card-badge-jp">和筆</span> 1. Traditional Japanese Brushes</h4>
                <p>Choose from the <span class="term-group"><strong>Maru-fude</strong> (丸筆)</span> classic round brush, <span class="term-group"><strong>Menso-fude</strong> (面相筆)</span> hairline fine liner, <span class="term-group"><strong>Hake</strong> (刷毛)</span> broad flat wash brush for dry <em>kasure</em> (擦れ) streaks, and <span class="term-group"><strong>Fuki-e</strong> (吹き絵)</span> organic splatter mist.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">流体力学</span> 2. Fluid Dynamics & Gravity Drips</h4>
                <p>A real-time Navier-Stokes solver calculates hydrodynamic flow using Runge-Kutta 2nd-order advection and a 32-iteration Poisson pressure solver. Tilt the canvas with the 2D gimbal or device gyroscope to watch wet washes pool and cascade across paper fibers.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">塩振り</span> 3. Crystalline Salt Granulation</h4>
                <p>Sprinkle coarse sea salt <span class="term-group"><strong>Shio</strong> (塩)</span> onto wet ink pools. Salt grains draw moisture hygroscopically and expel pigment outward, forming delicate starburst blooms and dark halos (<span class="term-group"><em>shio-furi</em> 塩振り</span>).</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">和紙</span> 4. Authentic Washi Paper Grains</h4>
                <p>Choose from 5 master papers: raw absorbent <span class="term-group"><strong>Sheng Xuan</strong> (生宣)</span>, smooth sized <span class="term-group"><strong>Torinoko</strong> (鳥の子)</span>, pure mulberry <span class="term-group"><strong>Echizen Kōzo</strong> (生漉楮)</span>, semi-sized <span class="term-group"><strong>Ban-Juku Xuan</strong> (半熟宣)</span>, and wild hemp <span class="term-group"><strong>Mashi</strong> (麻紙)</span> with anisotropic fiber bleeding (<span class="term-group"><em>hige-nijimi</em> 髭滲み</span>).</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">光学混色</span> 5. Two-Flux Kubelka-Munk Optics</h4>
                <p>Pigments blend via physical absorption (<em>K</em>) and scattering (<em>S</em>) radiative transfer spectra rather than digital RGB averaging, producing authentic subtractive mineral color mixing and optical depth.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">無常の美</span> 6. Impermanence & Zen Sublime</h4>
                <p>Unpreserved strokes slowly sublime back to pristine parchment over 3–5 minutes. Toggle <span class="term-group"><strong>Chōsoku</strong> (調息 — Breathe)</span> to suspend ink evaporation, or refresh the canvas with <span class="term-group"><strong>Harusame</strong> (春雨 — Spring Rain)</span>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.washiSlot = this.element.querySelector<HTMLElement>('#washi-selector-slot')!;
    this.attachEvents();
  }

  private attachEvents(): void {
    const btnBreathe = this.element.querySelector<HTMLButtonElement>('#btn-breathe');
    btnBreathe?.addEventListener('click', () => {
      this.isBreatheActive = !this.isBreatheActive;
      btnBreathe.classList.toggle('active', this.isBreatheActive);
      this.onBreatheToggle?.(this.isBreatheActive);
    });

    const btnSpringRain = this.element.querySelector<HTMLButtonElement>('#btn-spring-rain');
    btnSpringRain?.addEventListener('click', () => {
      btnSpringRain.classList.add('active');
      setTimeout(() => btnSpringRain.classList.remove('active'), 1200);
      this.onSpringRain?.();
    });

    const btnSound = this.element.querySelector<HTMLButtonElement>('#btn-sound');
    btnSound?.addEventListener('click', () => {
      this.isAudioMuted = !this.isAudioMuted;
      btnSound.classList.toggle('muted', this.isAudioMuted);
      this.onAudioToggle?.(this.isAudioMuted);
    });

    const btnInfo = this.element.querySelector<HTMLButtonElement>('#btn-info');
    const modal = this.element.querySelector<HTMLElement>('#info-modal');
    if (modal) {
      document.body.appendChild(modal);
    }
    const modalClose = modal?.querySelector<HTMLButtonElement>('#modal-close');
    const modalBackdrop = modal?.querySelector<HTMLElement>('.info-modal-backdrop');

    const toggleModal = (show: boolean) => {
      modal?.classList.toggle('hidden', !show);
    };

    btnInfo?.addEventListener('click', () => toggleModal(true));
    modalClose?.addEventListener('click', () => toggleModal(false));
    modalBackdrop?.addEventListener('click', () => toggleModal(false));
  }
}
