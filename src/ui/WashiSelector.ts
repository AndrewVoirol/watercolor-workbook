// Minimalist Japanese Washi Paper Selector Component
// Orchestrates 6 Master Washi Substrates:
// 0: Unryū-shi (雲竜紙 - Cloud Dragon mulberry with long bast fibers)
// 1: Torinoko (鳥の子 - Smooth alum-sized Gampi with sharp Dōsa contours)
// 2: Echizen Kōzo (生漉楮 - Heavy unbleached mulberry with Hige-nijimi bleeding)
// 3: Kin-sunago (金砂子 - 24k Gold-leaf dusted washi)
// 4: Aizome-shi (藍染紙 - Deep midnight botanical indigo washi)
// 5: Kobishi (古美紙 - Aged Edo tea-patina antique washi)

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
    name: 'Unryū-shi',
    kanji: '雲竜紙',
    sub: 'Cloud Dragon Mulberry',
    description: 'Long floating bast fibers with anisotropic capillary bleeding (Hige-nijimi)'
  },
  {
    id: 1,
    name: 'Torinoko',
    kanji: '鳥の子',
    sub: 'Eggshell Gampi',
    description: 'Smooth alum-sized parchment with crisp stroke perimeters (Dōsa sizing)'
  },
  {
    id: 2,
    name: 'Echizen Kōzo',
    kanji: '生漉楮',
    sub: 'Pure Mulberry',
    description: 'Heavy unbleached raw mulberry with deep tooth and intense granulation'
  },
  {
    id: 3,
    name: 'Kin-sunago',
    kanji: '金砂子',
    sub: 'Gold-Dusted Washi',
    description: 'Handmade washi dusted with genuine 24k gold-leaf flakes that glint in light'
  },
  {
    id: 4,
    name: 'Aizome-shi',
    kanji: '藍染紙',
    sub: 'Indigo-Dyed Paper',
    description: 'Deep midnight indigo washi ground creating luminous Gofun white & gold contrast'
  },
  {
    id: 5,
    name: 'Kobishi',
    kanji: '古美紙',
    sub: 'Antique Edo Parchment',
    description: 'Aged antique washi with warm tea tannin patina and soft vintage absorption'
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
