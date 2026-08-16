// Left Margin Poetic Watermark (余白の詩句 Ma Inscription) Component
// Typeset in traditional vertical Tategaki (縦書き) using authentic Yuji Boku calligraphy.
// Subtly impressed into the washi paper fibers (Paper-Soul Synthesis), orchestrated by ZenFocusManager.

export class MaWatermark {
  public element: HTMLElement;

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

  public dispose(): void {
    this.element.remove();
  }
}
