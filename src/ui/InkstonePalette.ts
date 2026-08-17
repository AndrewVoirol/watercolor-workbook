// Floating Ceramic & Bamboo Inkstone Palette UI Component
// 14 Porcelain Umezara Wells across a Two-Tier 7x2 Grid:
// Row 1 (Warm Minerals & 24k Gold): Sumi, Shu, Enji, Botan, Ōdo, Kurikawa, Kindei
// Row 2 (Cool Minerals, White & Washes): Gunjō, Ai, Rokushō, Byakuroku, Gofun, Mizu, Shio

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
  // Row 1: Warm / Minerals / 24k Gold
  {
    id: 0,
    name: 'Sumi',
    kanji: '墨',
    sub: 'Pine Soot Black',
    colorHex: '#1a1918',
    ringColor: '#3a3835',
    description: 'Carbon pine soot ink (松煙墨) — Velvety deep matte black'
  },
  {
    id: 1,
    name: 'Shu',
    kanji: '朱',
    sub: 'Cinnabar Vermilion',
    colorHex: '#b83b26',
    ringColor: '#d95338',
    description: 'Natural cinnabar mineral (本朱) — Semi-opaque fiery vermilion'
  },
  {
    id: 2,
    name: 'Enji',
    kanji: '臙脂',
    sub: 'Cochineal Crimson',
    colorHex: '#8b1e3f',
    ringColor: '#b52f57',
    description: 'Cochineal crimson lake (臙脂) — Translucent deep ruby glaze'
  },
  {
    id: 3,
    name: 'Botan',
    kanji: '牡丹',
    sub: 'Peony Blossom Pink',
    colorHex: '#d86b88',
    ringColor: '#e88ba2',
    description: 'Delicate peony flower wash (牡丹) — Luminous floral glaze'
  },
  {
    id: 4,
    name: 'Ōdo',
    kanji: '黄土',
    sub: 'Raw Yellow Ochre',
    colorHex: '#b5832a',
    ringColor: '#d69e38',
    description: 'Natural yellow ochre earth clay (天然黄土) — Intense granulation'
  },
  {
    id: 5,
    name: 'Kurikawa',
    kanji: '栗皮',
    sub: 'Chestnut Umber',
    colorHex: '#4a2e1b',
    ringColor: '#6e452a',
    description: 'Aged chestnut tannin iron umber (栗皮茶) — Rich earthy shadow'
  },
  {
    id: 6,
    name: 'Kindei',
    kanji: '金泥',
    sub: '24k Gold Slurry',
    colorHex: '#c5a059',
    ringColor: '#dfc68b',
    description: '24k mineral gold slurry (金泥) — Procedural metallic micro-flake glint'
  },

  // Row 2: Cool Minerals / Opaque White / Washes
  {
    id: 7,
    name: 'Gunjō',
    kanji: '群青',
    sub: 'Azurite Ultramarine',
    colorHex: '#1d3557',
    ringColor: '#2b4d7e',
    description: 'Crushed azurite mineral lapis (天然群青) — Intense blue granulation'
  },
  {
    id: 8,
    name: 'Ai',
    kanji: '本藍',
    sub: 'Fermented Indigo',
    colorHex: '#1b2a47',
    ringColor: '#2d436d',
    description: 'Botanical fermented indigo (本藍) — Deep organic blue wash'
  },
  {
    id: 9,
    name: 'Rokushō',
    kanji: '緑青',
    sub: 'Malachite Verdigris',
    colorHex: '#2d6854',
    ringColor: '#3d8c72',
    description: 'Crushed malachite copper patina (天然緑青) — Resonant mineral green'
  },
  {
    id: 10,
    name: 'Byakuroku',
    kanji: '白緑',
    sub: 'Celadon Jade Mist',
    colorHex: '#88b39a',
    ringColor: '#a9ceba',
    description: 'Pale jade celadon wash (白緑) — Ethereal mist and water glaze'
  },
  {
    id: 11,
    name: 'Gofun',
    kanji: '胡粉',
    sub: 'Oyster Shell White',
    colorHex: '#f7f4ee',
    ringColor: '#e2ddd2',
    description: 'Calcified oyster shell white (胡粉) — High-scattering opaque body color'
  },
  {
    id: 12,
    name: 'Mizu',
    kanji: '水',
    sub: 'Clear Water Wash',
    colorHex: '#8da9c4',
    ringColor: '#b4cbe3',
    description: 'Clear water dilution wash (清水) — Softens, blends, and bleeds strokes'
  },
  {
    id: 13,
    name: 'Shio',
    kanji: '塩',
    sub: 'Sea Salt Granulation',
    colorHex: '#f0ede6',
    ringColor: '#d1cdc4',
    description: 'Coarse sea salt granulator (粗海塩) — Hygroscopic starburst blooms'
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
    this.waterDilution = Math.max(0.0, Math.min(1.0, dilution));
    const sliderDilution = this.element.querySelector<HTMLInputElement>('#slider-dilution');
    const valDilution = this.element.querySelector<HTMLSpanElement>('#val-dilution');
    if (sliderDilution) sliderDilution.value = this.waterDilution.toString();
    if (valDilution) valDilution.textContent = `${Math.round(this.waterDilution * 100)}%`;
    if (triggerCallback) this.onDilutionChange?.(this.waterDilution);
  }

  private render(): void {
    const row1 = TRADITIONAL_PIGMENTS.slice(0, 7);
    const row2 = TRADITIONAL_PIGMENTS.slice(7, 14);

    this.element.innerHTML = `
      <div class="inkstone-palette">
        <!-- Palette Header -->
        <div class="palette-header">
          <span class="palette-seal">硯皿</span>
          <div class="palette-title-group">
            <span class="palette-title">SUZURI PALETTE</span>
            <span class="palette-subtitle">12 Nihonga Mineral Pigments, Water & Sea Salt</span>
          </div>
        </div>

        <!-- Two-Tier Pigment Swatches Grid (7x2 Porcelain Umezara Wells) -->
        <div class="swatches-grid-two-tier">
          <!-- Row 1: Warm / Minerals / Gold -->
          <div class="swatches-row">
            ${row1.map((p) => this.renderPigmentButton(p)).join('')}
          </div>
          <!-- Row 2: Cool / White / Washes -->
          <div class="swatches-row">
            ${row2.map((p) => this.renderPigmentButton(p)).join('')}
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
              min="0.1"
              max="1.0"
              step="0.05"
              value="${this.waterDilution}"
              aria-label="Water Dilution"
            />
            <div class="slider-sublabels">
              <span class="sublabel-item"><span class="sublabel-jp">擦れ</span> <span class="sublabel-en">(Dry)</span></span>
              <span class="sublabel-item"><span class="sublabel-jp">潤墨</span> <span class="sublabel-en">(Wet)</span></span>
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
    const isGold = pigment.id === 6;
    const isWhite = pigment.id === 11;
    const isSalt = pigment.id === 13;

    return `
      <button
        class="pigment-btn ${pigment.id === this.selectedPigmentId ? 'active' : ''} ${isGold ? 'gold-tool' : ''} ${isWhite ? 'white-tool' : ''} ${isSalt ? 'salt-tool' : ''}"
        data-id="${pigment.id}"
        title="${pigment.name} (${pigment.kanji}) — ${pigment.description}"
        type="button"
      >
        <div class="umezara-dish">
          <div class="umezara-well well-${pigment.id}" style="background: ${pigment.colorHex};">
            <span class="pigment-kanji ${isWhite ? 'dark-text' : ''}">${pigment.kanji}</span>
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
