// Minimalist Traditional Cinnabar Artist Seal (落款印 Rakkan-in) Component
// Subtly stamped in the corner of the washi canvas; orchestrated by ZenFocusManager.

export class RakkanSeal {
  public element: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'rakkan-seal-container zen-hud-element';
    this.render();
    container.appendChild(this.element);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="rakkan-seal-wrapper" id="rakkan-seal" title="落款印 (Rakkan-in) — Traditional Cinnabar Artist Seal">
        <div class="rakkan-seal-box">
          <span class="rakkan-char">無</span>
          <span class="rakkan-char">常</span>
        </div>
        <span class="rakkan-label">MUJŌ</span>
      </div>
    `;
  }

  public dispose(): void {
    this.element.remove();
  }
}
