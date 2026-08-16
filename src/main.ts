// Application Entry Point: Orchestrator for WebGPU Simulation, Advanced Physics, Audio, and UI

import './styles/index.css';
import { WebGPUContext } from './simulation/WebGPUContext';
import { SimulationEngine } from './simulation/SimulationEngine';
import { CanvasView } from './ui/CanvasView';
import { PointerTracker } from './input/PointerTracker';
import { InkstonePalette, TRADITIONAL_PIGMENTS } from './ui/InkstonePalette';
import { WashiSelector } from './ui/WashiSelector';
import { TiltPad } from './ui/TiltPad';
import { ZenControlsBar } from './ui/ZenControlsBar';
import { CursorWisp } from './ui/CursorWisp';
import { ZenAudioEngine } from './audio/ZenAudioEngine';

async function bootstrap() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // 1. Check WebGPU Compatibility
  if (!WebGPUContext.isSupported()) {
    appContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center; background: #f4efe4; color: #1a1918; font-family: 'Noto Serif JP', serif;">
        <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #b83b26;">WebGPU Required (無常)</h1>
        <p style="max-width: 500px; line-height: 1.6; color: #6e6b66; margin-bottom: 2rem;">
          MUJŌ requires WebGPU compute shaders for physically-based Navier-Stokes fluid dynamics and Kubelka-Munk optical color blending.
        </p>
        <p style="font-size: 0.9rem; color: #9e9a93;">
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
    const palette = new InkstonePalette(appContainer);
    const washiSelector = new WashiSelector(appContainer);
    const tiltPad = new TiltPad(appContainer);
    const controls = new ZenControlsBar(appContainer);
    const pointerTracker = new PointerTracker(canvasView.canvas);

    // 4. Initialize WebGPU Simulation Engine
    const simEngine = new SimulationEngine(gpuCtx);

    // 5. Connect UI to Simulation & Audio
    palette.onPigmentChange = (id) => {
      pointerTracker.config.pigmentId = id;
      const pigment = TRADITIONAL_PIGMENTS.find(p => p.id === id);
      if (pigment) {
        cursorWisp.setColor(pigment.colorHex);
      }
      if (id === 6) {
        audioEngine.playSaltSprinkle();
      } else {
        audioEngine.playWaterDrop(0.9 + Math.random() * 0.3);
      }
    };

    palette.onDilutionChange = (dilution) => {
      pointerTracker.config.waterDilution = dilution;
    };

    palette.onBrushSizeChange = (size) => {
      pointerTracker.config.brushSize = size;
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

    controls.onSpringRain = () => {
      simEngine.uniforms.params.springRainActive = true;
      audioEngine.playSpringRain();
      setTimeout(() => {
        simEngine.uniforms.params.springRainActive = false;
      }, 1500);
    };

    controls.onAudioToggle = (muted) => {
      audioEngine.setMuted(muted);
    };

    pointerTracker.onStrokeStart = (_x, _y, pressure) => {
      audioEngine.ensureContext();
      if (pointerTracker.config.pigmentId === 6) {
        audioEngine.playSaltSprinkle();
      } else {
        audioEngine.updateBrushMotion(true, 0.2, pressure);
      }
    };

    pointerTracker.onStrokeMove = (_x, _y, speed) => {
      if (pointerTracker.config.pigmentId === 6) {
        if (Math.random() < 0.25) {
          audioEngine.playSaltSprinkle();
        }
      } else {
        audioEngine.updateBrushMotion(true, speed, 0.65);
      }
    };

    pointerTracker.onStrokeEnd = () => {
      audioEngine.updateBrushMotion(false, 0, 0);
    };

    // 6. Master Frame Render Loop
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
