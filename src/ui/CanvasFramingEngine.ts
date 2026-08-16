// Canvas Framing Engine: Traditional Japanese Art Mounting (表装 Hyōsō) System
// Orchestrates 5 museum-grade mounting formats:
// 1. Shikishi (色紙) — 1:1 Square handmade board with 24k gold-leaf gilded rim (Kin-fuchi 金縁)
// 2. Kakemono (掛け軸) — 1:2.2 Hanging scroll with sage silk brocade, gold chūbe borders, and wooden roller bar (Jikugi 軸木)
// 3. Byōbu (屏風) — 16:10 Two-panel folding screen with black Urushi lacquer frame & center fold crease
// 4. Tanzaku (短冊) — 1:3.2 Vertical poetry slip with gold fleck washi
// 5. Muji (無地) — Full-bleed deckle-edge washi (Mimi-tsuki 耳付き)

export type MountType = 'shikishi' | 'kakemono' | 'byobu' | 'tanzaku' | 'muji';

export interface MountFormatConfig {
  type: MountType;
  name: string;
  kanji: string;
  sub: string;
  description: string;
}

export const MOUNT_FORMATS: MountFormatConfig[] = [
  {
    type: 'shikishi',
    name: 'Shikishi',
    kanji: '色紙',
    sub: '1:1 Gold-Rim Board',
    description: 'Thick washi board with authentic 24k gold-leaf gilded rim (Kin-fuchi 金縁)'
  },
  {
    type: 'kakemono',
    name: 'Kakemono',
    kanji: '掛軸',
    sub: 'Hanging Scroll',
    description: 'Traditional hanging scroll with sage silk brocade, gold borders, and wooden roller'
  },
  {
    type: 'byobu',
    name: 'Byōbu',
    kanji: '屏風',
    sub: 'Folding Screen',
    description: 'Two-panel folding screen with polished black Urushi lacquer frame'
  },
  {
    type: 'tanzaku',
    name: 'Tanzaku',
    kanji: '短冊',
    sub: 'Poetry Slip',
    description: 'Slender vertical calligraphy card with gold-mica flecks'
  },
  {
    type: 'muji',
    name: 'Muji',
    kanji: '無地',
    sub: 'Deckle Canvas',
    description: 'Full-bleed organic handmade washi with feathery deckle edges (Mimi-tsuki)'
  }
];

export class CanvasFramingEngine {
  public rootContainer: HTMLElement;
  public mountContainer: HTMLElement;
  public paperWindow: HTMLElement;
  private currentFormat: MountType = 'shikishi';
  private resizeHandler: () => void;

  public onFormatChange?: (format: MountType) => void;
  public onDimensionsChange?: (width: number, height: number, dpr: number) => void;

  constructor(parent: HTMLElement) {
    this.rootContainer = document.createElement('div');
    this.rootContainer.className = 'canvas-framing-gallery';

    this.mountContainer = document.createElement('div');
    this.mountContainer.className = 'museum-mount-wrapper mount-shikishi';

    this.paperWindow = document.createElement('div');
    this.paperWindow.className = 'honshi-paper-window';

    this.mountContainer.appendChild(this.paperWindow);
    this.rootContainer.appendChild(this.mountContainer);
    parent.appendChild(this.rootContainer);

    this.resizeHandler = () => this.updateLayout();
    window.addEventListener('resize', this.resizeHandler);

    this.renderMountStructure();
    this.updateLayout();
  }

  public getPaperWindow(): HTMLElement {
    return this.paperWindow;
  }

  public getCurrentFormat(): MountType {
    return this.currentFormat;
  }

  public setFormat(format: MountType): void {
    if (this.currentFormat === format) return;
    this.currentFormat = format;
    this.renderMountStructure();
    this.updateLayout();
    this.onFormatChange?.(format);
  }

  private renderMountStructure(): void {
    // Reset mount classes
    this.mountContainer.className = `museum-mount-wrapper mount-${this.currentFormat}`;

    // Remove any previously rendered decorative frame parts outside paperWindow
    const existingDecor = this.mountContainer.querySelectorAll('.mount-decor-element');
    existingDecor.forEach((el) => el.remove());

    if (this.currentFormat === 'shikishi') {
      // 1:1 Square Washi Board with 24k Gold-leaf rim (Kin-fuchi 金縁)
      const goldRim = document.createElement('div');
      goldRim.className = 'mount-decor-element shikishi-gold-rim';
      goldRim.setAttribute('aria-hidden', 'true');
      this.mountContainer.insertBefore(goldRim, this.paperWindow);
    } else if (this.currentFormat === 'kakemono') {
      // Hanging Scroll with Sage Brocade (Ten/Chi), Gold Chūbe borders, and Wooden Roller (Jikugi)
      const topHanger = document.createElement('div');
      topHanger.className = 'mount-decor-element kakemono-top-hanger';
      topHanger.innerHTML = `
        <div class="kakeo-cord" aria-hidden="true"></div>
        <div class="hyoki-stave" aria-hidden="true"></div>
      `;

      const bottomRoller = document.createElement('div');
      bottomRoller.className = 'mount-decor-element kakemono-bottom-roller';
      bottomRoller.innerHTML = `
        <div class="jikugi-shaft" aria-hidden="true"></div>
        <div class="jiku-knob knob-left" aria-hidden="true"></div>
        <div class="jiku-knob knob-right" aria-hidden="true"></div>
      `;

      this.mountContainer.insertBefore(topHanger, this.paperWindow);
      this.mountContainer.appendChild(bottomRoller);
    } else if (this.currentFormat === 'byobu') {
      // Folding Screen with Black Urushi Lacquer Frame, Brass Corner Fittings, and Center Fold
      const lacquerFrame = document.createElement('div');
      lacquerFrame.className = 'mount-decor-element byobu-lacquer-frame';
      lacquerFrame.innerHTML = `
        <div class="kanamono-bracket corner-tl" aria-hidden="true"></div>
        <div class="kanamono-bracket corner-tr" aria-hidden="true"></div>
        <div class="kanamono-bracket corner-bl" aria-hidden="true"></div>
        <div class="kanamono-bracket corner-br" aria-hidden="true"></div>
        <div class="byobu-center-crease" aria-hidden="true"></div>
      `;
      this.mountContainer.insertBefore(lacquerFrame, this.paperWindow);
    } else if (this.currentFormat === 'tanzaku') {
      // Slender poetry slip with gold mica fleck beveled border
      const tanzakuBorder = document.createElement('div');
      tanzakuBorder.className = 'mount-decor-element tanzaku-border';
      tanzakuBorder.setAttribute('aria-hidden', 'true');
      this.mountContainer.insertBefore(tanzakuBorder, this.paperWindow);
    }
  }

  public updateLayout(isFocused: boolean = false): void {
    // Generous Ma spacing:
    // Top clearance: ~76px for top header (or 24px in focus mode)
    // Bottom clearance: ~320px for brush rest + palette dock (or 24px in focus mode)
    const topClearance = isFocused ? 24 : 76;
    const bottomClearance = isFocused ? 24 : 320;
    const sideClearance = isFocused ? 32 : 120;

    const availW = Math.max(260, window.innerWidth - sideClearance);
    const availH = Math.max(260, window.innerHeight - topClearance - bottomClearance);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    let mountW = 0;
    let mountH = 0;
    let paperW = 0;
    let paperH = 0;

    switch (this.currentFormat) {
      case 'shikishi': {
        // 1:1 Square board
        const side = Math.min(availW, availH, isFocused ? 760 : 520);
        mountW = side;
        mountH = side;
        paperW = mountW - 10;
        paperH = mountH - 10;
        break;
      }

      case 'kakemono': {
        // Vertical hanging scroll: outer ratio 1:2.1, inner paper ratio 1:1.55
        mountH = Math.min(availH, isFocused ? 820 : 580);
        mountW = Math.floor(mountH / 2.1);
        if (mountW > availW) {
          mountW = availW;
          mountH = Math.floor(mountW * 2.1);
        }
        paperW = Math.floor(mountW * 0.84);
        paperH = Math.floor(paperW * 1.55);
        break;
      }

      case 'byobu': {
        // Two-panel folding screen: ratio 16:10 (1.6:1)
        mountW = Math.min(availW, Math.floor(availH * 1.55), isFocused ? 1080 : 780);
        mountH = Math.floor(mountW / 1.55);
        paperW = mountW - 24;
        paperH = mountH - 24;
        break;
      }

      case 'tanzaku': {
        // Slender vertical poetry slip: ratio 1:3.2
        mountH = Math.min(availH, isFocused ? 820 : 580);
        mountW = Math.floor(mountH / 3.2);
        if (mountW > availW) {
          mountW = availW;
          mountH = Math.floor(mountW * 3.2);
        }
        paperW = mountW - 8;
        paperH = mountH - 8;
        break;
      }

      case 'muji':
      default: {
        // Full deckle washi canvas
        mountW = Math.min(availW, isFocused ? 1100 : 800);
        mountH = Math.min(availH, isFocused ? 720 : 520);
        paperW = mountW;
        paperH = mountH;
        break;
      }
    }

    // Apply dimensions to mount container
    this.mountContainer.style.width = `${mountW}px`;
    this.mountContainer.style.height = `${mountH}px`;

    // Apply dimensions to inner paper window
    this.paperWindow.style.width = `${paperW}px`;
    this.paperWindow.style.height = `${paperH}px`;

    this.onDimensionsChange?.(paperW, paperH, dpr);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.rootContainer.remove();
  }
}
