// Minimalist Traditional Cinnabar Artist Seal (落款印 Rakkan-in) Component
// Subtly stamped in the corner of the washi canvas; gracefully recedes during active painting (Ma 間)
// and serenely breathes back into view during contemplative pauses.

export class RakkanSeal {
  public element: HTMLElement;
  private fadeTimeout: number | null = null;
  private isDrawing: boolean = false;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'rakkan-seal-container';
    this.render();
    container.appendChild(this.element);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="rakkan-seal-wrapper" id="rakkan-seal" title="落款印 (Rakkan-in) — Traditional Artist Seal">
        <div class="rakkan-seal-box">
          <span class="rakkan-char">無</span>
          <span class="rakkan-char">常</span>
        </div>
        <span class="rakkan-label">MUJŌ</span>
      </div>
    `;
  }

  public onStrokeStart(): void {
    this.isDrawing = true;
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    this.element.classList.add('faded');
  }

  public onStrokeEnd(): void {
    this.isDrawing = false;
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
    // Serene 1.8s delay before breathing back into view
    this.fadeTimeout = window.setTimeout(() => {
      if (!this.isDrawing) {
        this.element.classList.remove('faded');
      }
    }, 1800);
  }

  public dispose(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
    this.element.remove();
  }
}
