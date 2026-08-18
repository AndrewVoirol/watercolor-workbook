// Master Entry Point for MUJŌ Atelier Lab Testbed

import { WebGPULabContext } from './harness/WebGPULabContext';
import { TelemetryHUD } from './harness/TelemetryHUD';
import { MicroscopeLens } from './harness/MicroscopeLens';
import { LabSplitCanvas } from './harness/LabSplitCanvas';
import { LabExperiment } from './harness/LabExperiment';

// Experiments
import { FluidBleedExperiment } from './experiments/01_fluid_bleed/FluidBleedExperiment';
import { BrushKinematicsExperiment } from './experiments/02_brush_kinematics/BrushKinematicsExperiment';
import { OpticalGlazeExperiment } from './experiments/03_optical_glaze/OpticalGlazeExperiment';
import { WashiSubstratesExperiment } from './experiments/04_washi_substrates/WashiSubstratesExperiment';
import { LivingAtelierExperiment } from './experiments/05_living_atelier/LivingAtelierExperiment';

async function bootstrap() {
  const canvas = document.getElementById('lab-canvas') as HTMLCanvasElement;
  const controlsPanel = document.getElementById('controls-panel') as HTMLElement;
  const expSubtitle = document.getElementById('active-exp-title') as HTMLElement;
  const labelSideA = document.getElementById('label-side-a') as HTMLElement;
  const labelSideB = document.getElementById('label-side-b') as HTMLElement;

  if (!WebGPULabContext.isSupported()) {
    document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #fff; font-family: sans-serif; text-align: center;">
        <h1 style="color: #e5533d; margin-bottom: 1rem;">WebGPU Required for Atelier Lab</h1>
        <p style="color: #888;">Please open this in Chrome 113+, Edge 113+, or Safari 18+.</p>
      </div>
    `;
    return;
  }

  const ctx = new WebGPULabContext();
  await ctx.init(canvas);

  const hud = new TelemetryHUD();
  const loupe = new MicroscopeLens(canvas);
  const splitCanvas = new LabSplitCanvas(canvas);

  // Experiment Registry
  const experiments: LabExperiment[] = [
    new FluidBleedExperiment(),
    new BrushKinematicsExperiment(),
    new OpticalGlazeExperiment(),
    new WashiSubstratesExperiment(),
    new LivingAtelierExperiment()
  ];

  let currentExpIndex = 0;
  let activeExp = experiments[currentExpIndex];

  async function switchExperiment(index: number) {
    if (activeExp) {
      activeExp.destroy();
    }

    currentExpIndex = index;
    activeExp = experiments[currentExpIndex];

    // Update Top Title & Labels
    if (expSubtitle) expSubtitle.textContent = `Exp ${activeExp.id}: ${activeExp.title}`;
    if (labelSideA) labelSideA.innerHTML = `<span>${activeExp.sideALabel}</span>`;
    if (labelSideB) labelSideB.innerHTML = `<span>${activeExp.sideBLabel}</span>`;

    // Highlight active tab
    document.querySelectorAll('.lab-tab-btn').forEach((btn, idx) => {
      if (idx === index) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    await activeExp.init(ctx, hud);
    activeExp.renderUI(controlsPanel);
  }

  // Bind Tab Click Handlers
  document.querySelectorAll('.lab-tab-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => switchExperiment(idx));
  });

  // Action Buttons
  document.getElementById('btn-toggle-loupe')?.addEventListener('click', () => loupe.toggle());
  document.getElementById('btn-reset-exp')?.addEventListener('click', () => activeExp?.reset());

  // Connect Input from LabSplitCanvas to active experiment
  splitCanvas.onStrokeStart = (pt) => activeExp?.onStrokeStart(pt);
  splitCanvas.onStrokeMove = (pt, prevPt) => activeExp?.onStrokeMove(pt, prevPt);
  splitCanvas.onStrokeEnd = () => activeExp?.onStrokeEnd();

  // Keyboard Shortcuts: '1'-'5' switch experiments, 'C' clears, 'L' toggles loupe
  window.addEventListener('keydown', (e) => {
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) {
      switchExperiment(num - 1);
    } else if (e.key === 'c' || e.key === 'C') {
      activeExp?.reset();
    }
  });

  // Initialize first experiment
  await switchExperiment(0);

  // Master Render & Simulation Animation Loop
  let curW = window.innerWidth - 340;
  let curH = window.innerHeight - 54;
  let curDpr = Math.min(window.devicePixelRatio || 1, 2.0);

  splitCanvas.onResize = (w, h, dpr) => {
    curW = w;
    curH = h;
    curDpr = dpr;
  };

  function frame() {
    activeExp?.step(curW, curH, curDpr);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap().catch(console.error);
