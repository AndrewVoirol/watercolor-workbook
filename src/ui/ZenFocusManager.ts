// Zen Focus & Spatial "Ma" (間) Manager
// Coordinates the dynamic auto-hide lifecycle across all floating HUD cards during active brushstrokes,
// manages contemplative stillness breath delays, keyboard overrides (Tab/Z), and the Suzuri Pebble Puck affordance.

export class ZenFocusManager {
  private targets: HTMLElement[] = [];
  private pebblElement: HTMLElement;
  private isHardFocus: boolean = false;
  private isStrokeHidden: boolean = false;
  private strokeStartX: number = 0;
  private strokeStartY: number = 0;
  private strokeExceededThreshold: boolean = false;
  private breathTimeout: number | null = null;

  private static readonly DISTANCE_THRESHOLD = 4.0; // px of continuous stroke before fading HUD
  private static readonly BREATH_DELAY_MS = 2500;   // 2.5s serene contemplative delay

  public onFocusChange?: (isFocused: boolean) => void;

  constructor(appContainer: HTMLElement) {
    this.pebblElement = document.createElement('div');
    this.pebblElement.className = 'suzuri-pebble-puck';
    this.pebblElement.setAttribute('title', '無 (Mu) — Restore Workspace (Tab / Z)');
    this.pebblElement.setAttribute('role', 'button');
    this.pebblElement.setAttribute('aria-label', 'Restore workspace controls');
    this.pebblElement.innerHTML = `
      <span class="suzuri-pebble-glyph" aria-hidden="true">無</span>
    `;

    this.pebblElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.restoreWorkspace();
    });

    appContainer.appendChild(this.pebblElement);
    this.setupKeyboardShortcuts();
  }

  public registerTarget(element: HTMLElement): void {
    if (!this.targets.includes(element)) {
      element.classList.add('zen-hud-element');
      this.targets.push(element);
    }
  }

  public registerTargets(elements: (HTMLElement | null | undefined)[]): void {
    for (const el of elements) {
      if (el) {
        this.registerTarget(el);
      }
    }
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Do not intercept if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Tab' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.toggleHardFocus();
      }
    });
  }

  public toggleHardFocus(): void {
    this.isHardFocus = !this.isHardFocus;
    if (this.breathTimeout) {
      clearTimeout(this.breathTimeout);
      this.breathTimeout = null;
    }
    this.applyFocusState();
  }

  public restoreWorkspace(): void {
    this.isHardFocus = false;
    this.isStrokeHidden = false;
    this.strokeExceededThreshold = false;
    if (this.breathTimeout) {
      clearTimeout(this.breathTimeout);
      this.breathTimeout = null;
    }
    this.applyFocusState();
  }

  public onStrokeStart(x: number, y: number): void {
    this.strokeStartX = x;
    this.strokeStartY = y;
    this.strokeExceededThreshold = false;

    if (this.breathTimeout) {
      clearTimeout(this.breathTimeout);
      this.breathTimeout = null;
    }
  }

  public onStrokeMove(x: number, y: number): void {
    if (this.isHardFocus || this.isStrokeHidden) return;

    if (!this.strokeExceededThreshold) {
      const dx = x - this.strokeStartX;
      const dy = y - this.strokeStartY;
      const distance = Math.hypot(dx, dy);

      if (distance >= ZenFocusManager.DISTANCE_THRESHOLD) {
        this.strokeExceededThreshold = true;
        this.isStrokeHidden = true;
        this.applyFocusState();
      }
    }
  }

  public onStrokeEnd(): void {
    if (this.isHardFocus) return;

    if (this.breathTimeout) {
      clearTimeout(this.breathTimeout);
    }

    if (this.isStrokeHidden) {
      this.breathTimeout = window.setTimeout(() => {
        this.isStrokeHidden = false;
        this.strokeExceededThreshold = false;
        this.applyFocusState();
      }, ZenFocusManager.BREATH_DELAY_MS);
    }
  }

  private applyFocusState(): void {
    const isHidden = this.isHardFocus || this.isStrokeHidden;

    for (const target of this.targets) {
      if (isHidden) {
        target.classList.add('zen-focus-hidden');
      } else {
        target.classList.remove('zen-focus-hidden');
      }
    }

    if (isHidden) {
      this.pebblElement.classList.add('visible');
    } else {
      this.pebblElement.classList.remove('visible');
    }

    this.onFocusChange?.(isHidden);
  }

  public isFocused(): boolean {
    return this.isHardFocus || this.isStrokeHidden;
  }

  public dispose(): void {
    if (this.breathTimeout) {
      clearTimeout(this.breathTimeout);
    }
    this.pebblElement.remove();
  }
}
