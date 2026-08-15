// Zen Controls Bar: Breathe / Preserve, Spring Rain (Rake), Ambient Audio, and Info Modal

export class ZenControlsBar {
  public element: HTMLElement;
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
        <!-- Brand & Philosophy Badge -->
        <div class="brand-badge">
          <span class="zen-kanji-logo">無常</span>
          <div class="brand-text">
            <span class="brand-title">MUJŌ <span>・ 墨絵</span></span>
            <span class="brand-desc">Fluid Watercolor on Washi</span>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="actions-group">
          <!-- Breathe / Preserve Button -->
          <button id="btn-breathe" class="zen-action-btn" title="Pause fading to contemplate the composition">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v3m0 12v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M3 12h3m12 0h3M4.22 19.78l2.12-2.12m11.32-11.32l2.12-2.12"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span class="btn-text">Breathe <span class="btn-kanji">息</span></span>
          </button>

          <!-- Spring Rain / Rake Canvas Button -->
          <button id="btn-spring-rain" class="zen-action-btn" title="Gently wash and dissolve canvas with spring rain">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/>
              <path d="M8 19v2m4-3v3m4-2v2"/>
            </svg>
            <span class="btn-text">Spring Rain <span class="btn-kanji">春雨</span></span>
          </button>

          <!-- Sound Toggle Button -->
          <button id="btn-sound" class="zen-action-btn ${this.isAudioMuted ? 'muted' : ''}" title="Toggle ambient garden soundscape">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <span class="btn-text">Sound <span class="btn-kanji">響</span></span>
          </button>

          <!-- Info / Help Modal Toggle -->
          <button id="btn-info" class="zen-action-btn icon-only" title="Simulation physics and Zen philosophies">
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
            <h3>東洋の美学と物理シミュレーション (Aesthetics & Physics)</h3>
            <button id="modal-close" class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p class="modal-intro">
              <strong>MUJŌ (無常)</strong> is a physically-based digital watercolor engine running entirely on <strong>WebGPU compute shaders</strong>.
              It models the natural impermanence and fluid bleeding of water on handmade Japanese Washi paper.
            </p>
            <div class="feature-grid">
              <div class="feature-card">
                <h4>1. Navier-Stokes Fluid Dynamics</h4>
                <p>Cursor wisps inject physical velocity momentum. An 8-iteration porous Jacobi pressure solver simulates shallow water flow with organic dendritic fingering.</p>
              </div>
              <div class="feature-card">
                <h4>2. Capillary Action & Coffee Rings</h4>
                <p>As water evaporates, outward convective mass transfer pushes pigment to stroke perimeters, creating authentic dark drying rings.</p>
              </div>
              <div class="zen-info-card">
            <h4>3. Kubelka-Munk Optical Transfer</h4>
            <p>Pigments mix via physical absorption <em>(K)</em> and scattering <em>(S)</em> 2-flux radiative transfer spectra rather than synthetic RGB blending.</p>
          </div>
              <div class="feature-card">
                <h4>4. Impermanence & Fading</h4>
                <p>Unpreserved strokes slowly sublime back to clean parchment over 2–5 minutes. Use <strong>Breathe (息)</strong> to preserve your creation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

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
    const modalClose = this.element.querySelector<HTMLButtonElement>('#modal-close');
    const modalBackdrop = this.element.querySelector<HTMLElement>('.info-modal-backdrop');

    const toggleModal = (show: boolean) => {
      modal?.classList.toggle('hidden', !show);
    };

    btnInfo?.addEventListener('click', () => toggleModal(true));
    modalClose?.addEventListener('click', () => toggleModal(false));
    modalBackdrop?.addEventListener('click', () => toggleModal(false));
  }
}
