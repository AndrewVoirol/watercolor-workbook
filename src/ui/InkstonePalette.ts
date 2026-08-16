// Floating Ceramic & Bamboo Inkstone Palette UI Component

export interface PigmentInfo {
  id: number;
  name: string;
  kanji: string;
  sub: string;
  colorHex: string;
  ringColor: string;
}

export const TRADITIONAL_PIGMENTS: PigmentInfo[] = [
  { id: 0, name: 'Sumi', kanji: '墨', sub: 'Carbon Pine Soot (松煙墨)', colorHex: '#1a1918', ringColor: '#3a3835' },
  { id: 1, name: 'Shu', kanji: '朱', sub: 'Cinnabar Vermilion (本朱)', colorHex: '#b83b26', ringColor: '#d95338' },
  { id: 2, name: 'Ai', kanji: '藍', sub: 'Natural Indigo (本藍)', colorHex: '#1e3a5f', ringColor: '#2b5182' },
  { id: 3, name: 'Ōdo', kanji: '黄土', sub: 'Yellow Ochre (天然黄土)', colorHex: '#b5832a', ringColor: '#d69e38' },
  { id: 4, name: 'Rokushō', kanji: '緑青', sub: 'Malachite Green (天然緑青)', colorHex: '#2d6854', ringColor: '#3d8c72' },
  { id: 5, name: 'Mizu', kanji: '水', sub: 'Clear Water Wash (清水)', colorHex: '#8da9c4', ringColor: '#b4cbe3' },
  { id: 6, name: 'Shio', kanji: '塩', sub: 'Sea Salt Granulation (海塩)', colorHex: '#f0ede6', ringColor: '#d1cdc4' }
];

export class InkstonePalette {
  public element: HTMLElement;
  private selectedPigmentId: number = 0;
  private waterDilution: number = 0.5;
  private brushSize: number = 22;

  public onPigmentChange?: (id: number) => void;
  public onDilutionChange?: (dilution: number) => void;
  public onBrushSizeChange?: (size: number) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'inkstone-palette-container';
    this.render();
    container.appendChild(this.element);
  }

  public getSelectedPigmentId(): number {
    return this.selectedPigmentId;
  }

  public getWaterDilution(): number {
    return this.waterDilution;
  }

  public getBrushSize(): number {
    return this.brushSize;
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="inkstone-palette">
        <!-- Palette Header -->
        <div class="palette-header">
          <span class="palette-seal">硯</span>
          <div class="palette-title-group">
            <span class="palette-title">SUZURI PALETTE</span>
            <span class="palette-subtitle">Mineral Pigments, Water & Sea Salt</span>
          </div>
        </div>

        <!-- Pigment Swatches -->
        <div class="swatches-grid">
          ${TRADITIONAL_PIGMENTS.map((pigment) => `
            <button
              class="pigment-btn ${pigment.id === this.selectedPigmentId ? 'active' : ''} ${pigment.id === 6 ? 'salt-tool' : ''}"
              data-id="${pigment.id}"
              title="${pigment.name} (${pigment.kanji}) — ${pigment.sub}"
            >
              <div class="pigment-dish" style="background: ${pigment.colorHex}; border-color: ${pigment.ringColor};">
                <span class="pigment-kanji" style="color: ${pigment.id === 6 ? '#5c574f' : ''}">${pigment.kanji}</span>
              </div>
              <span class="pigment-name">${pigment.name}</span>
            </button>
          `).join('')}
        </div>

        <!-- Sliders Divider -->
        <div class="palette-divider"></div>

        <!-- Water Dilution & Brush Size Controls -->
        <div class="controls-section">
          <!-- Water Dilution -->
          <div class="control-row">
            <div class="control-label-group">
              <span class="control-label">
                <span class="label-jp">水加減</span>
                <span class="label-en">Water Dilution</span>
              </span>
              <span class="control-val" id="val-dilution">${Math.round(this.waterDilution * 100)}%</span>
            </div>
            <input
              type="range"
              id="slider-dilution"
              class="zen-slider"
              min="0.1"
              max="1.0"
              step="0.05"
              value="${this.waterDilution}"
            />
            <div class="slider-sublabels">
              <span class="sublabel-item"><span class="sublabel-jp">擦れ</span> <em>Kasure</em> (Dry)</span>
              <span class="sublabel-item"><span class="sublabel-jp">滲み</span> <em>Nijimi</em> (Wet)</span>
            </div>
          </div>

          <!-- Brush Size -->
          <div class="control-row">
            <div class="control-label-group">
              <span class="control-label">
                <span class="label-jp">筆の太さ</span>
                <span class="label-en">Brush Size</span>
              </span>
              <span class="control-val" id="val-brush-size">${this.brushSize}px</span>
            </div>
            <input
              type="range"
              id="slider-brush-size"
              class="zen-slider"
              min="8"
              max="64"
              step="1"
              value="${this.brushSize}"
            />
            <div class="slider-sublabels">
              <span class="sublabel-item"><span class="sublabel-jp">細筆</span> Fine</span>
              <span class="sublabel-item"><span class="sublabel-jp">太筆</span> Broad</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Pigment selection buttons
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.pigment-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id') || '0', 10);
        this.selectedPigmentId = id;

        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.onPigmentChange?.(id);
      });
    });

    // Water dilution slider
    const sliderDilution = this.element.querySelector<HTMLInputElement>('#slider-dilution');
    const valDilution = this.element.querySelector<HTMLSpanElement>('#val-dilution');
    sliderDilution?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.waterDilution = val;
      if (valDilution) valDilution.textContent = `${Math.round(val * 100)}%`;
      this.onDilutionChange?.(val);
    });

    // Brush size slider
    const sliderBrush = this.element.querySelector<HTMLInputElement>('#slider-brush-size');
    const valBrush = this.element.querySelector<HTMLSpanElement>('#val-brush-size');
    sliderBrush?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.brushSize = val;
      if (valBrush) valBrush.textContent = `${val}px`;
      this.onBrushSizeChange?.(val);
    });
  }
}
