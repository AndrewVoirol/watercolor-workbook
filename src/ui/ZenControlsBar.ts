// Zen Controls Bar: Top Header Orchestration (Brand, Washi Selector Slot, Action Buttons, and Info Modal)

export class ZenControlsBar {
  public element: HTMLElement;
  public washiSlot!: HTMLElement;
  private isBreatheActive: boolean = false;
  private isAudioMuted: boolean = false;
  private isFocusActive: boolean = false;
  private btnFocus: HTMLButtonElement | null = null;

  public onBreatheToggle?: (active: boolean) => void;
  public onClearCanvas?: () => void;
  public onAudioToggle?: (muted: boolean) => void;
  public onFocusToggle?: () => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'zen-controls-bar-container';
    this.render();
    container.appendChild(this.element);
  }

  public setFocusActive(active: boolean): void {
    this.isFocusActive = active;
    if (this.btnFocus) {
      this.btnFocus.classList.toggle('active', active);
    }
  }

  public getIsFocusActive(): boolean {
    return this.isFocusActive;
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="zen-top-bar">
        <!-- 1. Brand & Philosophy Badge -->
        <div class="brand-badge">
          <span class="zen-kanji-logo">無常</span>
          <div class="brand-text">
            <span class="brand-title">MUJŌ <span>・ 墨彩画</span></span>
            <span class="brand-desc">Tactile Watercolor & Sumi on Washi</span>
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

          <!-- Clear Canvas Button -->
          <button id="btn-clear-canvas" class="zen-action-btn" title="Clear canvas to pristine parchment (清拭 Seishiki)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            <span class="btn-label-jp">清拭</span>
            <span class="btn-label-en">Clear</span>
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

          <!-- Zen Focus Mode Button (無心 Mushin) -->
          <button id="btn-focus" class="zen-action-btn" title="Toggle Pure Canvas Focus (無心 Mushin — Tab / Z)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <span class="btn-label-jp">無心</span>
            <span class="btn-label-en">Focus</span>
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
              <strong>MUJŌ (無常)</strong> is a tactile physically-based watercolor engine executing on <strong>WebGPU compute shaders</strong>.
              It simulates the live hydrodynamics, pigment capillary wicking, and optical depth of water, mineral pigments, and authentic Japanese Washi paper.
            </p>
            <div class="feature-grid">
              <div class="feature-card">
                <h4><span class="card-badge-jp">和筆</span> 1. Master Japanese Brushes</h4>
                <p>Choose from <span class="term-group"><strong>Maru-fude</strong> (丸筆)</span> for dynamic calligraphy and soft Katabokashi edge bleeding, <span class="term-group"><strong>Menso</strong> (面相筆)</span> for hairline sable precision, and <span class="term-group"><strong>Hake</strong> (刷毛)</span> for broad washes and dry <em>kasure</em> (擦れ) bristle tooth skip.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">流体力学</span> 2. Free-Surface Fluid Dynamics</h4>
                <p>A real-time Navier-Stokes solver calculates fluid advection and Poisson pressure projection. Tilt the canvas with the 2D gimbal to watch liquid wash pools drift and settle into paper valleys.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">和紙</span> 3. Authentic Master Washi Papers</h4>
                <p>Choose from 3 curated substrates: <span class="term-group"><strong>Kizuki Kōzo</strong> (生漉楮)</span> unbleached mulberry with lush capillary tendrils (<em>Hige-nijimi</em> 髭滲み), <span class="term-group"><strong>Torinoko</strong> (鳥の子)</span> sized eggshell with dark pooled coffee-ring borders (<em>Fuchidori</em> 縁取り), and <span class="term-group"><strong>Kobishi</strong> (古美紙)</span> vintage tea-tannin ground.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">光学混色</span> 4. Two-Flux Kubelka-Munk Optics</h4>
                <p>Pigments blend via physical absorption (<em>K</em>) and scattering (<em>S</em>) radiative transfer spectra rather than digital RGB averaging, producing authentic subtractive mineral color mixing and wet paper grazing sheen.</p>
              </div>
              <div class="feature-card">
                <h4><span class="card-badge-jp">無常の美</span> 5. Impermanence & Zen Sublime</h4>
                <p>Strokes slowly sublime over 3–5 minutes. Toggle <span class="term-group"><strong>Chōsoku</strong> (調息 — Breathe)</span> to preserve wet strokes indefinitely, or click <span class="term-group"><strong>Seishiki</strong> (清拭 — Clear)</span> to restore pristine paper.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.washiSlot = this.element.querySelector<HTMLElement>('#washi-selector-slot')!;
    this.btnFocus = this.element.querySelector<HTMLButtonElement>('#btn-focus');
    this.attachEvents();
  }

  private attachEvents(): void {
    const btnBreathe = this.element.querySelector<HTMLButtonElement>('#btn-breathe');
    btnBreathe?.addEventListener('click', () => {
      this.isBreatheActive = !this.isBreatheActive;
      btnBreathe.classList.toggle('active', this.isBreatheActive);
      this.onBreatheToggle?.(this.isBreatheActive);
    });

    const btnClearCanvas = this.element.querySelector<HTMLButtonElement>('#btn-clear-canvas');
    btnClearCanvas?.addEventListener('click', () => {
      btnClearCanvas.classList.add('active');
      setTimeout(() => btnClearCanvas.classList.remove('active'), 600);
      this.onClearCanvas?.();
    });

    const btnSound = this.element.querySelector<HTMLButtonElement>('#btn-sound');
    btnSound?.addEventListener('click', () => {
      this.isAudioMuted = !this.isAudioMuted;
      btnSound.classList.toggle('muted', this.isAudioMuted);
      this.onAudioToggle?.(this.isAudioMuted);
    });

    this.btnFocus?.addEventListener('click', () => {
      this.onFocusToggle?.();
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
