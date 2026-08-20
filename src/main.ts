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

    // --- Automated Calligraphy Test Suite (試書 Shisho Simulator) ---
    let isTestRunning = false;
    const simulateCalligraphy = async (type: 'yong' | 'ichi' | 'kokoro' | 'enso' | 'flicks' = 'yong') => {
      if (isTestRunning) return;
      isTestRunning = true;

      const canvas = canvasView.canvas;
      const rect = canvas.getBoundingClientRect();
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      interface StrokePt {
        x: number; // 0..1 relative to canvas
        y: number; // 0..1 relative to canvas
        pressure: number; // 0..1
      }

      const dispatchStroke = async (points: StrokePt[], intervalMs = 16) => {
        if (points.length === 0) return;
        const start = points[0];
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: rect.left + start.x * rect.width,
          clientY: rect.top + start.y * rect.height,
          button: 0,
          pressure: start.pressure,
          pointerType: 'mouse',
          bubbles: true
        }));
        await sleep(intervalMs);

        for (let i = 1; i < points.length; i++) {
          const pt = points[i];
          window.dispatchEvent(new PointerEvent('pointermove', {
            clientX: rect.left + pt.x * rect.width,
            clientY: rect.top + pt.y * rect.height,
            pressure: pt.pressure,
            pointerType: 'mouse',
            bubbles: true
          }));
          await sleep(intervalMs);
        }

        const last = points[points.length - 1];
        window.dispatchEvent(new PointerEvent('pointerup', {
          clientX: rect.left + last.x * rect.width,
          clientY: rect.top + last.y * rect.height,
          pointerType: 'mouse',
          bubbles: true
        }));
        await sleep(intervalMs * 2);
      };

      if (type === 'ichi') {
        showZenToast('試書 Shisho', 'Kanji 一 (Ichi) • Slow Attack ➔ Fast Kasure Split ➔ Sharp Flick Exit');
        const pts: StrokePt[] = [];
        for (let i = 0; i <= 50; i++) {
          const t = i / 50;
          const x = 0.22 + t * 0.56;
          const y = 0.48 + Math.sin(t * Math.PI) * 0.025;
          const p = t < 0.20 ? 0.85 : (t > 0.82 ? 0.15 : (0.85 - Math.sin((t - 0.20) / 0.62 * Math.PI) * 0.58));
          pts.push({ x, y, pressure: p });
        }
        await dispatchStroke(pts, 16);

      } else if (type === 'kokoro') {
        showZenToast('試書 Shisho', 'Kanji 心 (Kokoro) • Curved Belly & Leaping Hook Flick');
        // 1. Left dot
        const s1: StrokePt[] = [];
        for (let i = 0; i <= 15; i++) {
          const t = i / 15;
          s1.push({ x: 0.34 - t * 0.04, y: 0.44 + t * 0.09, pressure: 0.75 - t * 0.20 });
        }
        await dispatchStroke(s1, 14);
        await sleep(120);

        // 2. Belly + Hook
        const s2: StrokePt[] = [];
        for (let i = 0; i <= 45; i++) {
          const t = i / 45;
          let x = 0.38 + t * 0.26;
          let y = 0.40 + Math.sin(t * Math.PI * 0.85) * 0.24;
          let p = 0.85;
          if (t > 0.80) {
            const ht = (t - 0.80) / 0.20;
            x = 0.38 + 0.26 * 0.80 - ht * 0.05;
            y = 0.40 + Math.sin(0.80 * Math.PI * 0.85) * 0.24 - ht * 0.10;
            p = 0.85 * (1.0 - ht * 0.85);
          }
          s2.push({ x, y, pressure: p });
        }
        await dispatchStroke(s2, 14);
        await sleep(120);

        // 3. Center dot
        const s3: StrokePt[] = [];
        for (let i = 0; i <= 15; i++) {
          const t = i / 15;
          s3.push({ x: 0.48 + t * 0.02, y: 0.40 + t * 0.07, pressure: 0.70 - t * 0.25 });
        }
        await dispatchStroke(s3, 14);
        await sleep(120);

        // 4. Outer dot
        const s4: StrokePt[] = [];
        for (let i = 0; i <= 15; i++) {
          const t = i / 15;
          s4.push({ x: 0.65 + t * 0.04, y: 0.38 + t * 0.07, pressure: 0.75 - t * 0.30 });
        }
        await dispatchStroke(s4, 14);

      } else if (type === 'enso') {
        showZenToast('試書 Shisho', 'Zen 円相 (Ensō) • Dynamic 360° Arc & Broken Fiber Trailing');
        const pts: StrokePt[] = [];
        for (let i = 0; i <= 80; i++) {
          const t = i / 80;
          const angle = -Math.PI * 0.5 + t * Math.PI * 1.92;
          const rx = 0.18 * (currentHeight / currentWidth);
          const ry = 0.18;
          const x = 0.50 + Math.cos(angle) * rx;
          const y = 0.48 + Math.sin(angle) * ry;
          const p = Math.max(0.18, 0.90 - t * 0.65 + (Math.sin(t * Math.PI * 4) * 0.08));
          pts.push({ x, y, pressure: p });
        }
        await dispatchStroke(pts, 14);

      } else if (type === 'flicks') {
        showZenToast('試書 Shisho', 'Speed Ladder • Comparing Slow Deliberate ➔ Rapid Flicks');
        const speeds = [0.3, 0.6, 1.0, 1.6];
        const yBases = [0.28, 0.40, 0.52, 0.64];
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const pts: StrokePt[] = [];
          const y0 = yBases[sIdx];
          const spd = speeds[sIdx];
          const N = Math.max(12, Math.floor(40 / (spd * 1.3)));
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            const x = 0.25 + t * 0.50;
            const y = y0 + Math.sin(t * Math.PI) * 0.015;
            const p = (1.0 - sIdx * 0.18) * (t < 0.2 ? 0.85 : (t > 0.8 ? 0.15 : (0.85 - Math.sin((t - 0.2) / 0.6 * Math.PI) * 0.50)));
            pts.push({ x, y, pressure: Math.max(0.12, p) });
          }
          await dispatchStroke(pts, Math.floor(16 / spd));
          await sleep(150);
        }

      } else {
        // "永" (Eight Principles of Yong)
        showZenToast('試書 Shisho', 'Kanji 永 (Eight Principles) • Complete Calligraphy Kinematic Test');
        // 1. 側 Soku (Dot)
        const s1: StrokePt[] = [];
        for (let i = 0; i <= 18; i++) {
          const t = i / 18;
          s1.push({ x: 0.50 + t * 0.02, y: 0.18 + t * 0.06, pressure: 0.85 - t * 0.30 });
        }
        await dispatchStroke(s1, 14);
        await sleep(120);

        // 2. 勒 Roku (Horizontal Bar)
        const s2: StrokePt[] = [];
        for (let i = 0; i <= 35; i++) {
          const t = i / 35;
          const x = 0.35 + t * 0.30;
          const y = 0.29 + Math.sin(t * Math.PI) * 0.012;
          const p = t < 0.2 ? 0.80 : (t > 0.8 ? 0.20 : 0.45);
          s2.push({ x, y, pressure: p });
        }
        await dispatchStroke(s2, 14);
        await sleep(120);

        // 3 & 4. 努 Do (Spine) & 趯 Teki (Hook)
        const s3: StrokePt[] = [];
        for (let i = 0; i <= 50; i++) {
          const t = i / 50;
          if (t <= 0.80) {
            const st = t / 0.80;
            s3.push({ x: 0.50, y: 0.29 + st * 0.38, pressure: 0.85 });
          } else {
            const ht = (t - 0.80) / 0.20;
            s3.push({ x: 0.50 - ht * 0.07, y: 0.67 - ht * 0.05, pressure: 0.85 * (1.0 - ht * 0.85) });
          }
        }
        await dispatchStroke(s3, 14);
        await sleep(120);

        // 5. 策 Saku (Rising whip)
        const s4: StrokePt[] = [];
        for (let i = 0; i <= 25; i++) {
          const t = i / 25;
          s4.push({ x: 0.34 + t * 0.14, y: 0.48 - t * 0.06, pressure: 0.75 * (1.0 - t * 0.75) });
        }
        await dispatchStroke(s4, 14);
        await sleep(120);

        // 6. 掠 Ryo (Sweeping left arc)
        const s5: StrokePt[] = [];
        for (let i = 0; i <= 35; i++) {
          const t = i / 35;
          s5.push({ x: 0.48 - t * 0.18, y: 0.44 + t * 0.28, pressure: 0.80 * (1.0 - t * 0.85) });
        }
        await dispatchStroke(s5, 14);
        await sleep(120);

        // 7. 啄 Taku (Short peck)
        const s6: StrokePt[] = [];
        for (let i = 0; i <= 18; i++) {
          const t = i / 18;
          s6.push({ x: 0.53 + t * 0.07, y: 0.44 + t * 0.06, pressure: 0.70 * (1.0 - t * 0.80) });
        }
        await dispatchStroke(s6, 14);
        await sleep(120);

        // 8. 磔 Taku (Flared right sweep)
        const s7: StrokePt[] = [];
        for (let i = 0; i <= 35; i++) {
          const t = i / 35;
          const p = t < 0.7 ? (0.50 + t * 0.50) : (1.0 - (t - 0.7) / 0.3 * 0.85);
          s7.push({ x: 0.53 + t * 0.22, y: 0.50 + t * 0.24, pressure: p });
        }
        await dispatchStroke(s7, 14);
      }

      isTestRunning = false;
    };

    (window as any).simulateCalligraphy = simulateCalligraphy;

    let testCycleIdx = 0;
    const testTypes: Array<'yong' | 'ichi' | 'kokoro' | 'enso' | 'flicks'> = ['yong', 'ichi', 'kokoro', 'enso', 'flicks'];

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        // [1] 書道 SHODO: Master Calligraphy
        brushRest.setSelectedId(0);
        palette.setBrushSize(20, true);
        palette.setWaterDilution(0.35, true);
        palette.setSelectedPigmentId(0, true);
        washiSelector.setSelectedId(1);
        showZenToast('書道 Shodo', 'Master Calligraphy • Dense Soot & Responsive Conical Tuft (Maru-fude 20px, 35% Dilution, Torinoko)');
        audioEngine.playBambooKnock(1.0);
      } else if (e.key === '2') {
        // [2] 墨絵 NIHONGA: Translucent Glaze & Wet Wash (Curtis 1997)
        brushRest.setSelectedId(0);
        palette.setBrushSize(26, true);
        palette.setWaterDilution(0.70, true);
        palette.setSelectedPigmentId(2, true); // Ai (Indigo) for translucent glazing
        washiSelector.setSelectedId(0);
        showZenToast('墨絵 Nihonga', 'Curtis 1997 Optical Glaze • Translucent Indigo & Edge Darkening (Maru-fude 26px, 70% Dilution, Kōzo)');
        audioEngine.playWaterDrop(0.9);
      } else if (e.key === '3') {
        // [3] 飛白 HAKU: Textural Dry Brush
        brushRest.setSelectedId(0);
        palette.setBrushSize(22, true);
        palette.setWaterDilution(0.15, true);
        palette.setSelectedPigmentId(0, true);
        washiSelector.setSelectedId(2);
        showZenToast('飛白 Haku', 'Textural Dry Brush • Paper Tooth & Broken Fiber Skips (Maru-fude 22px, 15% Dilution, Kobishi)');
        audioEngine.playEarthenThud(1.1);
      } else if (e.key === 't' || e.key === 'T') {
        // [T] 試書 SHISHO: Cycle through automated Calligraphy Benchmark tests
        const chosen = testTypes[testCycleIdx % testTypes.length];
        testCycleIdx++;
        simulateCalligraphy(chosen);
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

    let lastFrameTimestamp = performance.now();

    const frame = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTimestamp) * 0.001, 0.033);
      lastFrameTimestamp = now;

      const isDrawing = pointerTracker.getIsDrawing();
      const segments = pointerTracker.getAndClearPendingSegments();
      const ferruleState = pointerTracker.getFerruleState(dt);

      simEngine.step(
        isDrawing,
        segments,
        ferruleState,
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
