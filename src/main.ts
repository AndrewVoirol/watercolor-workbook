// Application Entry Point: Orchestrator for WebGPU Simulation, Advanced Physics, Japanese Brush Craft, Audio, and UI

import './styles/index.css';
import { WebGPUContext } from './simulation/WebGPUContext';
import { SimulationEngine } from './simulation/SimulationEngine';
import { CanvasView } from './ui/CanvasView';
import { PointerTracker } from './input/PointerTracker';
import { InkstonePalette, TRADITIONAL_PIGMENTS } from './ui/InkstonePalette';
import { BambooBrushRest } from './ui/BambooBrushRest';
import { WashiSelector } from './ui/WashiSelector';
import { TiltPad } from './ui/TiltPad';
import { ZenControlsBar } from './ui/ZenControlsBar';
import { CursorWisp } from './ui/CursorWisp';
import { ZenAudioEngine } from './audio/ZenAudioEngine';
import { RakkanSeal } from './ui/RakkanSeal';
import { MaWatermark } from './ui/MaWatermark';
import { ZenFocusManager } from './ui/ZenFocusManager';

async function bootstrap() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // 1. Check WebGPU Compatibility
  if (!WebGPUContext.isSupported()) {
    appContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center; background: #f4efe4; color: #1a1918; font-family: var(--font-sans);">
        <div style="width: 48px; height: 48px; border: 2px solid #b83b26; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; background: rgba(184, 59, 38, 0.06);">
          <span style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; color: #b83b26; line-height: 1;">無</span>
        </div>
        <h1 style="font-family: var(--font-display); font-size: 1.6rem; letter-spacing: 0.08em; margin-bottom: 0.35rem; color: #1a1918;">WebGPU Required</h1>
        <p style="font-family: var(--font-serif); font-size: 0.95rem; color: #b83b26; margin-bottom: 1.5rem; font-weight: 600;">WebGPU 対応環境が必要です (無常)</p>
        <p style="max-width: 520px; line-height: 1.7; color: #6e6b66; margin-bottom: 1.5rem; font-size: 0.9rem;">
          MUJŌ requires WebGPU compute shaders for real-time Navier-Stokes hydrodynamic simulation, Kubelka-Munk optical color blending, and pigment granulation.
        </p>
        <p style="font-size: 0.82rem; color: #9e9a93; max-width: 460px; line-height: 1.5;">
          Please open this application in Chrome 113+, Microsoft Edge 113+, or Safari 18+ on macOS / Windows with WebGPU enabled.
        </p>
      </div>
    `;
    return;
  }

  try {
    // 2. Initialize Canvas View & WebGPU Context
    const canvasView = new CanvasView(appContainer);
    const gpuCtx = new WebGPUContext();
    await gpuCtx.init(canvasView.canvas);

    // 3. Initialize Audio Engine & UI Elements
    const audioEngine = new ZenAudioEngine();
    const cursorWisp = new CursorWisp(appContainer);
    
    // Substrate artifacts (permanent washi fixtures, not HUD targets)
    new MaWatermark(appContainer);
    new RakkanSeal(appContainer);
    
    const controls = new ZenControlsBar(appContainer);
    const washiSelector = new WashiSelector(controls.washiSlot);
    
    // Bottom Center Dock Container (Flex Column for Brush Rest + Palette)
    const bottomDock = document.createElement('div');
    bottomDock.className = 'bottom-dock-container';
    appContainer.appendChild(bottomDock);

    const brushRest = new BambooBrushRest(bottomDock);
    const palette = new InkstonePalette(bottomDock);
    const tiltPad = new TiltPad(appContainer);
    const pointerTracker = new PointerTracker(canvasView.canvas);

    // Zen Focus Manager (User-toggled focus via Header button or Tab / Z / Escape)
    const zenFocusManager = new ZenFocusManager();
    zenFocusManager.registerTargets([
      controls.element,
      bottomDock,
      tiltPad.element
    ]);

    zenFocusManager.onFocusChange = (isFocused) => {
      controls.setFocusActive(isFocused);
    };

    controls.onFocusToggle = () => {
      zenFocusManager.toggleFocus();
    };

    // 4. Initialize WebGPU Simulation Engine
    const simEngine = new SimulationEngine(gpuCtx);

    // 5. Connect UI to Simulation & Audio
    brushRest.onBrushChange = (brushId) => {
      pointerTracker.config.brushType = brushId;
      cursorWisp.setBrushType(brushId);

      // Authentic Japanese Brush Physical Defaults
      if (brushId === 0) {
        // Maru-fude (丸筆 Round Calligraphy): 22px, 50% dilution
        palette.setBrushSize(22, true);
        palette.setWaterDilution(0.50, true);
      } else if (brushId === 1) {
        // Menso (面相筆 Fine Liner): 8px hairline, 20% dilution for crisp bone lines
        palette.setBrushSize(8, true);
        palette.setWaterDilution(0.20, true);
      } else if (brushId === 2) {
        // Hake (刷毛 Broad Flat Wash): 52px wide wash, 75% lush dilution
        palette.setBrushSize(52, true);
        palette.setWaterDilution(0.75, true);
      }

      audioEngine.playBambooKnock(0.85 + brushId * 0.15);
    };

    palette.onPigmentChange = (id) => {
      pointerTracker.config.pigmentId = id;
      const pigment = TRADITIONAL_PIGMENTS.find(p => p.id === id);
      if (pigment) {
        cursorWisp.setColor(pigment.colorHex);
      }
      if (id === 5) { // Mizu (Water)
        audioEngine.playWaterDrop(1.05);
      } else {
        audioEngine.playEarthenThud(0.85 + (id % 5) * 0.1);
      }
    };

    palette.onDilutionChange = (dilution) => {
      pointerTracker.config.waterDilution = dilution;
      simEngine.uniforms.params.waterDilution = dilution;
      cursorWisp.setWaterDilution(dilution);
    };

    palette.onBrushSizeChange = (size) => {
      pointerTracker.config.brushSize = size;
      cursorWisp.setBrushSize(size);
    };

    washiSelector.onPaperChange = (paperId) => {
      simEngine.setPaperType(paperId);
      audioEngine.playWaterDrop(0.75 + paperId * 0.2);
    };

    tiltPad.onGravityChange = (gx, gy) => {
      simEngine.setGravity(gx, gy);
      const mag = Math.sqrt(gx * gx + gy * gy);
      audioEngine.updateGravityTrickle(mag);
    };

    controls.onBreatheToggle = (active) => {
      simEngine.uniforms.params.breatheActive = active;
      if (active) {
        audioEngine.playSingingBowl();
      }
    };

    controls.onClearCanvas = () => {
      simEngine.clearCanvas();
      audioEngine.playWaterDrop(0.5);
    };

    controls.onAudioToggle = (muted) => {
      audioEngine.setMuted(muted);
    };

    pointerTracker.onStrokeStart = (_x, _y, pressure) => {
      audioEngine.ensureContext();
      audioEngine.updateBrushMotion(
        true,
        0.2,
        pressure,
        pointerTracker.config.brushType,
        pointerTracker.config.waterDilution,
        pointerTracker.config.brushSize,
        washiSelector.getSelectedId()
      );
    };

    pointerTracker.onStrokeMove = (_x, _y, speed) => {
      audioEngine.updateBrushMotion(
        true,
        speed,
        0.65,
        pointerTracker.config.brushType,
        pointerTracker.config.waterDilution,
        pointerTracker.config.brushSize,
        washiSelector.getSelectedId()
      );
    };

    pointerTracker.onStrokeEnd = () => {
      audioEngine.updateBrushMotion(false, 0, 0);
    };

    // 6. Temporary Feel Preset Quick-Switch Hotkeys [1, 2, 3] with subtle Zen Toast
    const showZenToast = (title: string, subtitle: string) => {
      let toast = document.getElementById('zen-feel-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'zen-feel-toast';
        toast.style.cssText = `
          position: fixed;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(247, 244, 238, 0.95);
          border: 1px solid rgba(184, 59, 38, 0.25);
          border-radius: 9999px;
          padding: 6px 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-serif);
          font-size: 0.85rem;
          color: #1a1918;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
          pointer-events: none;
          z-index: 1000;
          transition: opacity 0.4s ease, transform 0.4s ease;
        `;
        appContainer.appendChild(toast);
      }
      toast.innerHTML = `
        <span style="color: #b83b26; font-weight: 700;">${title}</span>
        <span style="color: #6e6b66; font-size: 0.78rem;">${subtitle}</span>
      `;
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0px)';

      clearTimeout((toast as any)._timeout);
      (toast as any)._timeout = setTimeout(() => {
        if (toast) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(-50%) translateY(-6px)';
        }
      }, 1800);
    };

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        // [1] 書道 SHODO: Master Calligraphy
        brushRest.setSelectedId(0);
        palette.setBrushSize(28, true);
        palette.setWaterDilution(0.35, true);
        palette.setSelectedPigmentId(0, true);
        washiSelector.setSelectedId(1);
        showZenToast('書道 Shodo', 'Master Calligraphy • Dense Soot & Elastic Conical Tuft (Maru-fude 28px, 35% Dilution, Torinoko)');
        audioEngine.playBambooKnock(1.0);
      } else if (e.key === '2') {
        // [2] 墨絵 NIHONGA: Lush Fluid Wash
        brushRest.setSelectedId(0);
        palette.setBrushSize(42, true);
        palette.setWaterDilution(0.75, true);
        palette.setSelectedPigmentId(0, true);
        washiSelector.setSelectedId(0);
        showZenToast('墨絵 Nihonga', 'Lush Fluid Wash • Wet-on-Wet Tarashikomi & Capillary Bleed (Maru-fude 42px, 75% Dilution, Kōzo)');
        audioEngine.playWaterDrop(0.9);
      } else if (e.key === '3') {
        // [3] 飛白 HAKU: Textural Dry Brush
        brushRest.setSelectedId(0);
        palette.setBrushSize(32, true);
        palette.setWaterDilution(0.15, true);
        palette.setSelectedPigmentId(0, true);
        washiSelector.setSelectedId(2);
        showZenToast('飛白 Haku', 'Textural Dry Brush • Paper Tooth & Broken Fiber Skips (Maru-fude 32px, 15% Dilution, Kobishi)');
        audioEngine.playEarthenThud(1.1);
      }
    });

    // 7. Master Frame Render Loop
    let currentWidth = window.innerWidth;
    let currentHeight = window.innerHeight;
    let currentDpr = Math.min(window.devicePixelRatio || 1, 2.0);

    canvasView.onResize((w, h, dpr) => {
      currentWidth = w;
      currentHeight = h;
      currentDpr = dpr;
      // Re-configure WebGPU swapchain context on resize
      gpuCtx.context.configure({
        device: gpuCtx.device,
        format: gpuCtx.presentationFormat,
        alphaMode: 'opaque'
      });
    });

    const frame = () => {
      const isDrawing = pointerTracker.getIsDrawing();
      const segments = pointerTracker.getAndClearPendingSegments();

      simEngine.step(
        isDrawing,
        segments,
        currentWidth,
        currentHeight,
        currentDpr
      );

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);

  } catch (err) {
    console.error('Initialization failed:', err);
    appContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center; background: #f4efe4; color: #1a1918;">
        <h2 style="color: #b83b26; margin-bottom: 1rem;">Simulation Engine Error</h2>
        <p style="color: #6e6b66; max-width: 500px;">${(err as Error).message}</p>
      </div>
    `;
  }
}

bootstrap();
