// Unified Interface for all Atelier Lab Experiments

import { WebGPULabContext } from './WebGPULabContext';
import { LabStrokePoint } from './LabSplitCanvas';
import { TelemetryHUD } from './TelemetryHUD';

export interface LabExperiment {
  id: number;
  title: string;
  subtitle: string;
  sideALabel: string;
  sideBLabel: string;

  init(ctx: WebGPULabContext, hud: TelemetryHUD): Promise<void>;
  renderUI(panelContainer: HTMLElement): void;
  onStrokeStart(pt: LabStrokePoint): void;
  onStrokeMove(pt: LabStrokePoint, prevPt: LabStrokePoint): void;
  onStrokeEnd(): void;
  reset(): void;
  step(screenWidth: number, screenHeight: number, dpr: number): void;
  destroy(): void;
}
