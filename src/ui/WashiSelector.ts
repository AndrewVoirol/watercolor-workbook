// Minimalist Japanese Washi Paper Selector Component

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
    name: 'Sheng Xuan',
    kanji: '生宣',
    sub: 'Raw Rice Paper',
    description: 'High porosity & rapid capillary bleeding (Nijimi)'
  },
  {
    id: 1,
    name: 'Torinoko',
    kanji: '鳥の子',
    sub: 'Eggshell Washi',
    description: 'Smooth alum-sized parchment with crisp stroke perimeters (Dōsa)'
  },
  {
    id: 2,
    name: 'Echizen Kōzo',
    kanji: '生漉楮',
    sub: 'Pure Mulberry',
    description: 'Pure unblended mulberry washi with deep pigment granulation'
  },
  {
    id: 3,
    name: 'Ban-Juku Xuan',
    kanji: '半熟宣',
    sub: 'Semi-Sized Paper',
    description: 'Balanced classical washi with preserved bone and soft halo bleed'
  },
  {
    id: 4,
    name: 'Mashi',
    kanji: '麻紙',
    sub: 'Wild Hemp Fiber',
    description: 'Rugged organic hemp lattice with rhythmic dry-brush kasure skips'
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
