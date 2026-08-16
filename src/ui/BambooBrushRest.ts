// Minimalist Japanese Bamboo Brush Rest (筆架 Fudekake) Component

export interface JapaneseBrushOption {
  id: number;
  name: string;
  kanji: string;
  sub: string;
  description: string;
  iconSvg: string;
}

export const JAPANESE_BRUSHES: JapaneseBrushOption[] = [
  {
    id: 0,
    name: 'Fude',
    kanji: '標準筆',
    sub: 'Classic Round',
    description: 'Tapered animal hair for versatile expressive calligraphic strokes',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M12 12c-2 2-3 5-3 8 0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2 0-3-1-6-3-8z"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`
  },
  {
    id: 1,
    name: 'Menso',
    kanji: '面相筆',
    sub: 'Fine Liner',
    description: 'Long slender sable hair for hairline precision and delicate details',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v14"/><path d="M12 16c-.8 1-1.5 3-1.5 5 0 .6.4 1 1 1h1c.6 0 1-.4 1-1 0-2-.7-4-1.5-5z"/></svg>`
  },
  {
    id: 2,
    name: 'Hake',
    kanji: '刷毛',
    sub: 'Flat Wash',
    description: 'Broad flat wooden wash brush for wide atmospheric washes & dry kasure',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="8" rx="1"/><path d="M5 10h14v7c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-7z"/><line x1="9" y1="14" x2="9" y2="19"/><line x1="12" y1="14" x2="12" y2="19"/><line x1="15" y1="14" x2="15" y2="19"/></svg>`
  },
  {
    id: 3,
    name: 'Fuki-e',
    kanji: '吹き絵',
    sub: 'Splatter',
    description: 'Organic ink splatter and aerosol mist dispersal',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="17" cy="7" r="1.2"/><circle cx="18" cy="15" r="1.8"/><circle cx="7" cy="16" r="1.2"/><circle cx="13" cy="19" r="1"/></svg>`
  }
];

export class BambooBrushRest {
  public element: HTMLElement;
  private selectedId: number = 0;
  public onBrushChange?: (id: number) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'bamboo-brush-rest-container';
    this.render();
    container.appendChild(this.element);
  }

  public getSelectedId(): number {
    return this.selectedId;
  }

  public setSelectedId(id: number): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.brush-stand-btn');
    buttons.forEach((b) => {
      const bId = parseInt(b.getAttribute('data-id') || '0', 10);
      if (bId === id) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="brush-rest-dock">
        <div class="brush-rest-header">
          <span class="brush-rest-seal">筆架</span>
          <span class="brush-rest-title">BRUSH</span>
        </div>
        <div class="brush-stands-row">
          ${JAPANESE_BRUSHES.map((b) => `
            <button
              class="brush-stand-btn ${b.id === this.selectedId ? 'active' : ''}"
              data-id="${b.id}"
              title="${b.name} (${b.kanji}) — ${b.description}"
            >
              <div class="brush-icon-wrapper">${b.iconSvg}</div>
              <div class="brush-info-col">
                <span class="brush-stand-kanji">${b.kanji}</span>
                <span class="brush-stand-name">${b.name}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.brush-stand-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id') || '0', 10);
        if (id === this.selectedId) return;

        this.selectedId = id;
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.onBrushChange?.(id);
      });
    });
  }
}
