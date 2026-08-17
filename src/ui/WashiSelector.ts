// Minimalist Japanese Washi Paper Selector Component
// Orchestrates 3 Master Authentic Washi Substrates:
// 0: Kizuki Kōzo (生漉楮 - Raw Mulberry Washi with Hige-nijimi fiber bleeding)
// 1: Torinoko (鳥の子 - Sized Eggshell Washi with crisp Dōsa contours & Fuchidori rims)
// 2: Kobishi (古美紙 - Aged Antique Washi with warm tea-tannin patina)

export interface WashiPaperOption {
  id: number;
  name: string;
  kanji: string;
  sub: string;
  description: string;
}

export const WASHI_PAPERS: WashiPaperOption[] = [
  {
    id: 0,
    name: 'Kizuki Kōzo',
    kanji: '生漉楮',
    sub: 'Raw Mulberry',
    description: 'Unsized pure Kozo mulberry paper with long bast fibers that guide lush capillary tendrils (Hige-nijimi 髭滲み)'
  },
  {
    id: 1,
    name: 'Torinoko',
    kanji: '鳥の子',
    sub: 'Sized Eggshell',
    description: 'Smooth alum-gelatin sized (Dōsa 礬水) paper with high contact angle, producing crisp bone lines and dark pooled edges (Fuchidori 縁取り)'
  },
  {
    id: 2,
    name: 'Kobishi',
    kanji: '古美紙',
    sub: 'Aged Antique',
    description: 'Naturally aged antique paper with warm tea-tannin patina (Shibubiki 渋引), fine tooth, and balanced sumi-e shading'
  }
];

export class WashiSelector {
  public element: HTMLElement;
  private selectedId: number = 0;
  public onPaperChange?: (id: number) => void;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'washi-selector-dock';
    this.render();
    container.appendChild(this.element);
  }

  public getSelectedId(): number {
    return this.selectedId;
  }

  public setSelectedId(id: number): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.washi-opt-btn');
    buttons.forEach((b) => {
      const btnId = parseInt(b.getAttribute('data-id') || '0', 10);
      if (btnId === id) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="washi-label-group">
        <span class="washi-header-seal">和紙</span>
        <span class="washi-header-title">PAPER</span>
      </div>
      <div class="washi-options-row">
        ${WASHI_PAPERS.map((paper) => `
          <button
            class="washi-opt-btn ${paper.id === this.selectedId ? 'active' : ''}"
            data-id="${paper.id}"
            title="${paper.name} (${paper.kanji}) — ${paper.description}"
            type="button"
          >
            <span class="washi-opt-kanji">${paper.kanji}</span>
            <span class="washi-opt-name">${paper.name}</span>
          </button>
        `).join('')}
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.washi-opt-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id') || '0', 10);
        if (id === this.selectedId) return;

        this.selectedId = id;
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.onPaperChange?.(id);
      });
    });
  }
}
