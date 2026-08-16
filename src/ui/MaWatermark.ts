// Left Margin Poetic Watermark (余白の詩句 Ma Inscription) Component
// Typeset in traditional vertical Tategaki (縦書き) using authentic Yuji Boku calligraphy.
// Subtly impressed into the washi paper fibers (Paper-Soul Synthesis), receding during active brushstrokes
// and gently breathing back into view during contemplative stillness pauses.

export class MaWatermark {
  public element: HTMLElement;
  private fadeTimeout: number | null = null;
  private isDrawing: boolean = false;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'ma-watermark-container zen-hud-element';
    this.render();
    container.appendChild(this.element);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="ma-watermark-script" aria-hidden="true">行雲流水</div>
      <div class="ma-watermark-sub" aria-hidden="true">Kōun Ryūsui</div>
    `;
    this.element.setAttribute('title', '行雲流水 (Kōun Ryūsui) — Moving clouds, flowing water');
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
    // Serene 2.5s delay matching Zen Focus breath cycle
    this.fadeTimeout = window.setTimeout(() => {
      if (!this.isDrawing) {
        this.element.classList.remove('faded');
      }
    }, 2500);
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.element.classList.remove('zen-focus-hidden');
    } else {
      this.element.classList.add('zen-focus-hidden');
    }
  }

  public dispose(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
    this.element.remove();
  }
}
