// Floating Ceramic & Bamboo Inkstone Palette UI Component
// 6 Porcelain Umezara Wells:
// 5 Authentic Nihonga Mineral Pigments: Sumi, Shu, Ai, Ōdo, Rokushō + Mizu (Clear Water)

export interface PigmentInfo {
  id: number;
  name: string;
  kanji: string;
  sub: string;
  colorHex: string;
  ringColor: string;
  description: string;
}

export const TRADITIONAL_PIGMENTS: PigmentInfo[] = [
  {
    id: 0,
    name: 'Sumi',
    kanji: '墨',
    sub: 'Pine Soot Black',
    colorHex: '#1c1b1a',
    ringColor: '#3d3b38',
    description: 'Carbon pine soot ink (松煙墨) — Velvety deep matte charcoal'
  },
  {
    id: 1,
    name: 'Shu',
    kanji: '朱',
    sub: 'Cinnabar Vermilion',
    colorHex: '#b33824',
    ringColor: '#d64c33',
    description: 'Natural cinnabar mineral (本朱) — Warm organic vermilion'
  },
  {
    id: 2,
    name: 'Ai',
    kanji: '本藍',
    sub: 'Fermented Indigo',
    colorHex: '#1e324f',
    ringColor: '#304c73',
    description: 'Botanical fermented indigo (本藍) — Deep oceanic blue wash'
  },
  {
    id: 3,
    name: 'Ōdo',
    kanji: '黄土',
    sub: 'Raw Yellow Ochre',
    colorHex: '#b8842d',
    ringColor: '#d49d3d',
    description: 'Natural yellow ochre earth clay (天然黄土) — Warm amber granulation'
  },
  {
    id: 4,
    name: 'Rokushō',
    kanji: '緑青',
    sub: 'Malachite Verdigris',
    colorHex: '#2c6b56',
    ringColor: '#3d8c72',
    description: 'Crushed malachite copper patina (天然緑青) — Antique mineral green'
  },
  {
    id: 5,
    name: 'Mizu',
    kanji: '水',
    sub: 'Clear Water Wash',
    colorHex: '#7fa3c4',
    ringColor: '#a8c6e2',
    description: 'Clear water dilution wash (清水) — Softens, blends, and bleeds strokes'
  }
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

  public setBrushSize(size: number, triggerCallback: boolean = false): void {
    this.brushSize = Math.max(8, Math.min(64, Math.round(size)));
    const sliderBrush = this.element.querySelector<HTMLInputElement>('#slider-brush-size');
    const valBrush = this.element.querySelector<HTMLSpanElement>('#val-brush-size');
    if (sliderBrush) sliderBrush.value = this.brushSize.toString();
    if (valBrush) valBrush.textContent = `${this.brushSize}px`;
    if (triggerCallback) this.onBrushSizeChange?.(this.brushSize);
  }

  public setWaterDilution(dilution: number, triggerCallback: boolean = false): void {
    this.waterDilution = Math.max(0.05, Math.min(1.0, dilution));
    const sliderDilution = this.element.querySelector<HTMLInputElement>('#slider-dilution');
    const valDilution = this.element.querySelector<HTMLSpanElement>('#val-dilution');
    if (sliderDilution) sliderDilution.value = this.waterDilution.toString();
    if (valDilution) valDilution.textContent = `${Math.round(this.waterDilution * 100)}%`;
    if (triggerCallback) this.onDilutionChange?.(this.waterDilution);
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="inkstone-palette">
        <!-- Palette Header -->
        <div class="palette-header">
          <span class="palette-seal">硯皿</span>
          <div class="palette-title-group">
            <span class="palette-title">SUZURI PALETTE</span>
            <span class="palette-subtitle">5 Authentic Nihonga Mineral Pigments & Pure Water</span>
          </div>
        </div>

        <!-- Single-Tier Porcelain Umezara Wells Grid -->
        <div class="swatches-grid-single-tier">
          <div class="swatches-row">
            ${TRADITIONAL_PIGMENTS.map((p) => this.renderPigmentButton(p)).join('')}
          </div>
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
              min="0.10"
              max="1.0"
              step="0.05"
              value="${this.waterDilution}"
              aria-label="Water Dilution"
            />
            <div class="slider-sublabels">
              <span class="sublabel-item"><span class="sublabel-jp">擦れ</span> <span class="sublabel-en">(Dry Lock)</span></span>
              <span class="sublabel-item"><span class="sublabel-jp">潤墨</span> <span class="sublabel-en">(Lush Bloom)</span></span>
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
              aria-label="Brush Size"
            />
            <div class="slider-sublabels">
              <span class="sublabel-item"><span class="sublabel-jp">小筆</span> <span class="sublabel-en">(Fine)</span></span>
              <span class="sublabel-item"><span class="sublabel-jp">大筆</span> <span class="sublabel-en">(Broad)</span></span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderPigmentButton(pigment: PigmentInfo): string {
    const isWater = pigment.id === 5;

    return `
      <button
        class="pigment-btn ${pigment.id === this.selectedPigmentId ? 'active' : ''} ${isWater ? 'water-tool' : ''}"
        data-id="${pigment.id}"
        title="${pigment.name} (${pigment.kanji}) — ${pigment.description}"
        type="button"
      >
        <div class="umezara-dish">
          <div class="umezara-well well-${pigment.id}" style="background: ${pigment.colorHex};">
            <span class="pigment-kanji">${pigment.kanji}</span>
          </div>
        </div>
        <span class="pigment-name">${pigment.name}</span>
      </button>
    `;
  }

  private attachEvents(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.pigment-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id') || '0', 10);
        if (id === this.selectedPigmentId) return;

        this.selectedPigmentId = id;
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.onPigmentChange?.(id);
      });
    });

    const sliderDilution = this.element.querySelector<HTMLInputElement>('#slider-dilution');
    const valDilution = this.element.querySelector<HTMLSpanElement>('#val-dilution');
    sliderDilution?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.waterDilution = val;
      if (valDilution) valDilution.textContent = `${Math.round(val * 100)}%`;
      this.onDilutionChange?.(val);
    });

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
