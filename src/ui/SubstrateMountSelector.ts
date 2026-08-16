// Substrate & Mount (和紙・表装) Dual Selector Component
// Provides unified selection for both the traditional Japanese Art Framing (Hyōsō) and Master Washi Papers.

import { MOUNT_FORMATS, MountType } from './CanvasFramingEngine';
import { WASHI_PAPERS } from './WashiSelector';

export class SubstrateMountSelector {
  public element: HTMLElement;
  private selectedMount: MountType = 'shikishi';
  private selectedPaperId: number = 0;
  private isMountMenuOpen: boolean = false;
  private isPaperMenuOpen: boolean = false;

  public onMountChange?: (mount: MountType) => void;
  public onPaperChange?: (paperId: number) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'substrate-mount-selector';
    this.render();
    container.appendChild(this.element);

    // Global click listener to close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target as Node)) {
        this.closeAllMenus();
      }
    });
  }

  public getSelectedMount(): MountType {
    return this.selectedMount;
  }

  public getSelectedPaperId(): number {
    return this.selectedPaperId;
  }

  public setMount(mount: MountType): void {
    if (this.selectedMount === mount) return;
    this.selectedMount = mount;
    this.render();
  }

  public setPaper(paperId: number): void {
    if (this.selectedPaperId === paperId) return;
    this.selectedPaperId = paperId;
    this.render();
  }

  private closeAllMenus(): void {
    if (this.isMountMenuOpen || this.isPaperMenuOpen) {
      this.isMountMenuOpen = false;
      this.isPaperMenuOpen = false;
      this.updateMenuVisibility();
    }
  }

  private updateMenuVisibility(): void {
    const mountMenu = this.element.querySelector('.mount-dropdown-menu');
    const paperMenu = this.element.querySelector('.paper-dropdown-menu');
    const mountBtn = this.element.querySelector('.mount-pill-btn');
    const paperBtn = this.element.querySelector('.paper-pill-btn');

    mountMenu?.classList.toggle('open', this.isMountMenuOpen);
    paperMenu?.classList.toggle('open', this.isPaperMenuOpen);
    mountBtn?.classList.toggle('active', this.isMountMenuOpen);
    paperBtn?.classList.toggle('active', this.isPaperMenuOpen);
  }

  private render(): void {
    const currentMount = MOUNT_FORMATS.find((m) => m.type === this.selectedMount) || MOUNT_FORMATS[0];
    const currentPaper = WASHI_PAPERS.find((p) => p.id === this.selectedPaperId) || WASHI_PAPERS[0];

    this.element.innerHTML = `
      <div class="substrate-mount-dual-pill">
        <!-- 1. Mount Format Pill -->
        <div class="selector-segment mount-segment">
          <button
            type="button"
            class="pill-btn mount-pill-btn ${this.isMountMenuOpen ? 'active' : ''}"
            id="btn-select-mount"
            title="Select Art Framing Mount (表装 Hyōsō)"
            aria-haspopup="true"
            aria-expanded="${this.isMountMenuOpen}"
          >
            <span class="pill-seal">表装</span>
            <span class="pill-kanji">${currentMount.kanji}</span>
            <span class="pill-name">${currentMount.name}</span>
            <svg class="pill-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 4.5L6 7.5L9 4.5"/>
            </svg>
          </button>

          <!-- Mount Dropdown Menu -->
          <div class="dropdown-popover mount-dropdown-menu ${this.isMountMenuOpen ? 'open' : ''}" role="menu">
            <div class="dropdown-header">
              <span class="dropdown-header-seal">表装</span>
              <span class="dropdown-header-title">TRADITIONAL MOUNT</span>
            </div>
            <div class="dropdown-options">
              ${MOUNT_FORMATS.map((m) => `
                <button
                  type="button"
                  class="dropdown-opt-btn ${m.type === this.selectedMount ? 'selected' : ''}"
                  data-mount="${m.type}"
                  role="menuitem"
                  title="${m.description}"
                >
                  <span class="opt-kanji">${m.kanji}</span>
                  <div class="opt-text">
                    <span class="opt-name">${m.name}</span>
                    <span class="opt-sub">${m.sub}</span>
                  </div>
                  ${m.type === this.selectedMount ? '<span class="opt-check">✓</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="pill-divider" aria-hidden="true"></div>

        <!-- 2. Washi Paper Pill -->
        <div class="selector-segment paper-segment">
          <button
            type="button"
            class="pill-btn paper-pill-btn ${this.isPaperMenuOpen ? 'active' : ''}"
            id="btn-select-paper"
            title="Select Washi Paper Substrate (和紙)"
            aria-haspopup="true"
            aria-expanded="${this.isPaperMenuOpen}"
          >
            <span class="pill-seal">和紙</span>
            <span class="pill-kanji">${currentPaper.kanji}</span>
            <span class="pill-name">${currentPaper.name}</span>
            <svg class="pill-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 4.5L6 7.5L9 4.5"/>
            </svg>
          </button>

          <!-- Paper Dropdown Menu -->
          <div class="dropdown-popover paper-dropdown-menu ${this.isPaperMenuOpen ? 'open' : ''}" role="menu">
            <div class="dropdown-header">
              <span class="dropdown-header-seal">和紙</span>
              <span class="dropdown-header-title">WASHI SUBSTRATE</span>
            </div>
            <div class="dropdown-options">
              ${WASHI_PAPERS.map((p) => `
                <button
                  type="button"
                  class="dropdown-opt-btn ${p.id === this.selectedPaperId ? 'selected' : ''}"
                  data-paper-id="${p.id}"
                  role="menuitem"
                  title="${p.description}"
                >
                  <span class="opt-kanji">${p.kanji}</span>
                  <div class="opt-text">
                    <span class="opt-name">${p.name}</span>
                    <span class="opt-sub">${p.sub}</span>
                  </div>
                  ${p.id === this.selectedPaperId ? '<span class="opt-check">✓</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const mountBtn = this.element.querySelector<HTMLButtonElement>('#btn-select-mount');
    const paperBtn = this.element.querySelector<HTMLButtonElement>('#btn-select-paper');

    mountBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMountMenuOpen = !this.isMountMenuOpen;
      this.isPaperMenuOpen = false;
      this.updateMenuVisibility();
    });

    paperBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isPaperMenuOpen = !this.isPaperMenuOpen;
      this.isMountMenuOpen = false;
      this.updateMenuVisibility();
    });

    // Mount options
    const mountOpts = this.element.querySelectorAll<HTMLButtonElement>('.mount-dropdown-menu .dropdown-opt-btn');
    mountOpts.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mount = btn.getAttribute('data-mount') as MountType;
        if (mount) {
          this.selectedMount = mount;
          this.closeAllMenus();
          this.render();
          this.onMountChange?.(mount);
        }
      });
    });

    // Paper options
    const paperOpts = this.element.querySelectorAll<HTMLButtonElement>('.paper-dropdown-menu .dropdown-opt-btn');
    paperOpts.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = parseInt(btn.getAttribute('data-paper-id') || '0', 10);
        this.selectedPaperId = pid;
        this.closeAllMenus();
        this.render();
        this.onPaperChange?.(pid);
      });
    });
  }
}
