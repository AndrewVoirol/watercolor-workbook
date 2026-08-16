// Zen Focus Manager
// Provides intentional, user-controlled full canvas focus mode via the Header Focus button and keyboard shortcuts (Tab / Z / Escape).

export class ZenFocusManager {
  private targets: HTMLElement[] = [];
  private isFocus: boolean = false;
  private keydownHandler: (e: KeyboardEvent) => void;

  public onFocusChange?: (isFocused: boolean) => void;

  constructor() {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Do not intercept if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Tab' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.toggleFocus();
      } else if (e.key === 'Escape' && this.isFocus) {
        e.preventDefault();
        this.setFocus(false);
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  public registerTarget(element: HTMLElement): void {
    if (!this.targets.includes(element)) {
      element.classList.add('zen-hud-element');
      this.targets.push(element);
      this.applyFocusState();
    }
  }

  public registerTargets(elements: (HTMLElement | null | undefined)[]): void {
    for (const el of elements) {
      if (el) {
        this.registerTarget(el);
      }
    }
  }

  public toggleFocus(): void {
    this.setFocus(!this.isFocus);
  }

  public setFocus(active: boolean): void {
    this.isFocus = active;
    this.applyFocusState();
  }

  public isFocused(): boolean {
    return this.isFocus;
  }

  private applyFocusState(): void {
    for (const target of this.targets) {
      if (this.isFocus) {
        target.classList.add('zen-hard-focus');
      } else {
        target.classList.remove('zen-hard-focus');
      }
    }

    this.onFocusChange?.(this.isFocus);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.keydownHandler);
  }
}
