// Zen Focus & Spatial "Ma" (間) Manager
// Coordinates the serene "Kasumi" (霞 — Mist) ambient ghosting lifecycle during active brushstrokes,
// "Kehai" (気配) spatial proximity sensing near HUD controls, and intentional "Mu" (無心) hard focus canvas immersion.

export class ZenFocusManager {
  private targets: HTMLElement[] = [];
  private isHardFocus: boolean = false;
  private isKasumi: boolean = false;
  private isProximityAwake: boolean = false;
  private stillnessTimer: number | null = null;
  private pointerMoveHandler: (e: PointerEvent) => void;

  private static readonly PROXIMITY_MARGIN_PX = 70; // Hover proximity cushion to awake controls
  private static readonly STILLNESS_DELAY_MS = 5000; // 5.0s stillness before returning to normal

  public onFocusChange?: (isHardFocused: boolean) => void;

  constructor() {
    this.pointerMoveHandler = (e: PointerEvent) => this.handlePointerMove(e);
    window.addEventListener('pointermove', this.pointerMoveHandler, { passive: true });
    this.setupKeyboardShortcuts();
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

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Do not intercept if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Tab' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.toggleHardFocus();
      } else if (e.key === 'Escape' && this.isHardFocus) {
        e.preventDefault();
        this.setHardFocus(false);
      }
    });
  }

  public toggleHardFocus(): void {
    this.setHardFocus(!this.isHardFocus);
  }

  public setHardFocus(active: boolean): void {
    this.isHardFocus = active;
    if (this.stillnessTimer) {
      clearTimeout(this.stillnessTimer);
      this.stillnessTimer = null;
    }
    if (!this.isHardFocus) {
      this.isKasumi = false;
      this.isProximityAwake = false;
    }
    this.applyFocusState();
  }

  public restoreWorkspace(): void {
    this.setHardFocus(false);
  }

  public onStrokeStart(_x: number, _y: number): void {
    if (this.isHardFocus) return;

    if (this.stillnessTimer) {
      clearTimeout(this.stillnessTimer);
      this.stillnessTimer = null;
    }

    this.isKasumi = true;
    this.isProximityAwake = false;
    this.applyFocusState();
  }

  public onStrokeMove(_x: number, _y: number): void {
    if (this.isHardFocus) return;

    if (!this.isKasumi) {
      this.isKasumi = true;
      this.applyFocusState();
    }
  }

  public onStrokeEnd(): void {
    if (this.isHardFocus) return;

    if (this.stillnessTimer) {
      clearTimeout(this.stillnessTimer);
    }

    if (this.isKasumi) {
      this.stillnessTimer = window.setTimeout(() => {
        this.isKasumi = false;
        this.isProximityAwake = false;
        this.applyFocusState();
      }, ZenFocusManager.STILLNESS_DELAY_MS);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.isHardFocus) return;

    if (!this.isKasumi) return;

    const px = e.clientX;
    const py = e.clientY;

    let nearAnyTarget = false;
    const margin = ZenFocusManager.PROXIMITY_MARGIN_PX;

    for (const target of this.targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const expandedLeft = rect.left - margin;
      const expandedTop = rect.top - margin;
      const expandedRight = rect.right + margin;
      const expandedBottom = rect.bottom + margin;

      if (px >= expandedLeft && px <= expandedRight && py >= expandedTop && py <= expandedBottom) {
        nearAnyTarget = true;
        break;
      }
    }

    if (nearAnyTarget !== this.isProximityAwake) {
      this.isProximityAwake = nearAnyTarget;
      this.applyFocusState();
    }
  }

  private applyFocusState(): void {
    for (const target of this.targets) {
      if (this.isHardFocus) {
        target.classList.add('zen-hard-focus');
        target.classList.remove('zen-kasumi', 'zen-proximity-awake');
      } else if (this.isKasumi) {
        target.classList.remove('zen-hard-focus');
        target.classList.add('zen-kasumi');
        if (this.isProximityAwake) {
          target.classList.add('zen-proximity-awake');
        } else {
          target.classList.remove('zen-proximity-awake');
        }
      } else {
        target.classList.remove('zen-hard-focus', 'zen-kasumi', 'zen-proximity-awake');
      }
    }

    this.onFocusChange?.(this.isHardFocus);
  }

  public isFocused(): boolean {
    return this.isHardFocus || (this.isKasumi && !this.isProximityAwake);
  }

  public dispose(): void {
    if (this.stillnessTimer) {
      clearTimeout(this.stillnessTimer);
    }
    window.removeEventListener('pointermove', this.pointerMoveHandler);
  }
}
