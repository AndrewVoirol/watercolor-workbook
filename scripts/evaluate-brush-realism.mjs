// Automated 5-Zone Micro-Inspection & Visual Evaluation Test Harness for WebGPU Watercolor Brush Realism
// Launches Chromium with Metal WebGPU flags, executes targeted physical calligraphy tests,
// and saves high-resolution macro screenshots and micro-crops to screenshots/evaluation/.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'screenshots', 'evaluation');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runEvaluation() {
  console.log('===============================================================');
  console.log('=== MUJŌ Realism Evaluation: 5-Pillar Physical Brush Suite  ===');
  console.log('===============================================================');

  let consoleErrors = [];
  let viteProcess = null;
  let browser = null;

  const killServer = () => {
    if (viteProcess && viteProcess.pid) {
      try {
        process.kill(-viteProcess.pid, 'SIGKILL');
      } catch (e) {}
    }
  };

  process.on('exit', killServer);
  process.on('SIGINT', () => { killServer(); process.exit(1); });
  process.on('SIGTERM', () => { killServer(); process.exit(1); });

  try {
    // 1. Boot local Vite dev server
    const port = 5183;
    const viteBin = path.join(projectRoot, 'node_modules', '.bin', 'vite');
    viteProcess = spawn(viteBin, ['--port', String(port), '--strictPort'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    await new Promise((resolve) => {
      viteProcess.stdout.on('data', (data) => {
        const str = data.toString();
        if (str.includes('localhost:') || str.includes('Local:')) {
          console.log(`Vite dev server active at http://localhost:${port}`);
          resolve();
        }
      });
      setTimeout(resolve, 2500);
    });

    // 2. Launch Chromium with macOS Metal WebGPU Backend Flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--enable-unsafe-webgpu',
        '--use-gpu-in-tests',
        '--enable-features=Vulkan,DefaultANGLEVulkan,Metal',
        '--use-angle=metal',
        '--enable-dawn-features=allow_unsafe_apis',
        '--ignore-gpu-blocklist',
        '--disable-dawn-features=disallow_unsafe_apis'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });

    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Console Error]`, msg.text());
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      console.error(`[Browser Page Error]`, err.message);
      consoleErrors.push(err.message);
    });

    console.log(`Navigating to http://localhost:${port}...`);
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Enter Zen Focus mode to clear UI overlays
    await page.keyboard.press('z');
    await page.waitForTimeout(300);

    // Helpers for interacting with canvas
    const clearCanvas = async () => {
      await page.keyboard.press('z'); // exit focus
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const btn = document.querySelector('#btn-clear-canvas');
        if (btn) btn.click();
      });
      await page.waitForTimeout(200);
      await page.keyboard.press('z'); // re-enter focus
      await page.waitForTimeout(300);
    };

    const selectPaper = async (id) => {
      await page.keyboard.press('z');
      await page.waitForTimeout(100);
      await page.evaluate((pid) => {
        const btn = document.querySelector(`.washi-opt-btn[data-id="${pid}"]`);
        if (btn) btn.click();
      }, id);
      await page.waitForTimeout(200);
      await page.keyboard.press('z');
      await page.waitForTimeout(300);
    };

    const captureCrop = async (filename, normX, normY, sizeCss = 240) => {
      const canvasBox = await page.$eval('canvas', (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      const centerX = canvasBox.left + normX * canvasBox.width;
      const centerY = canvasBox.top + normY * canvasBox.height;
      const clipX = Math.max(0, centerX - sizeCss / 2);
      const clipY = Math.max(0, centerY - sizeCss / 2);

      const filePath = path.join(outDir, `${filename}.png`);
      await page.screenshot({
        path: filePath,
        clip: { x: clipX, y: clipY, width: sizeCss, height: sizeCss }
      });
      console.log(`  -> Crop saved: ${filename}.png`);
    };

    // -------------------------------------------------------------
    // TEST 1: Attack & Touchdown (Verify ZERO Cauliflower Blobs)
    // -------------------------------------------------------------
    console.log('\n[Test 1] Attack & Touchdown: Testing delicate tip contact vs. cauliflower bloom...');
    await clearCanvas();
    await selectPaper(1); // Torinoko

    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      // Fast slash stroke start
      const startX = rect.left + 0.35 * rect.width;
      const startY = rect.top + 0.30 * rect.height;
      const endX = rect.left + 0.65 * rect.width;
      const endY = rect.top + 0.30 * rect.height;

      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, pressure: 0.30, bubbles: true }));
      await sleep(16);
      for (let i = 1; i <= 20; i++) {
        const t = i / 20;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy, pressure: 0.30 + t * 0.40, bubbles: true }));
        await sleep(12);
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: endX, clientY: endY, pressure: 0.0, bubbles: true }));
      await sleep(150);

      // Stationary deliberate tap (Ten) below it
      const tapX = rect.left + 0.50 * rect.width;
      const tapY = rect.top + 0.45 * rect.height;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: tapX, clientY: tapY, pressure: 0.65, bubbles: true }));
      await sleep(100);
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: tapX, clientY: tapY, pressure: 0.0, bubbles: true }));
    });

    await page.mouse.move(0, 0);
    await page.waitForTimeout(1000);

    const macro1 = path.join(outDir, '01_attack_macro.png');
    await page.screenshot({ path: macro1 });
    await captureCrop('zone1_attack_start', 0.36, 0.30, 200);
    await captureCrop('zone1_deliberate_dot_tap', 0.50, 0.45, 200);

    // -------------------------------------------------------------
    // TEST 2: Gesture Vitality & Kanji Dynamics (永 - 8 Principles)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Gesture Vitality: Running 永 (Eight Principles) calligraphy...');
    await clearCanvas();
    await page.evaluate(async () => {
      if (typeof window.simulateCalligraphy === 'function') {
        await window.simulateCalligraphy('yong');
      }
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(2200);

    const macro2 = path.join(outDir, '02_yong_gesture_macro.png');
    await page.screenshot({ path: macro2 });
    await captureCrop('zone2_yong_soku_dot', 0.51, 0.20, 220);
    await captureCrop('zone2_yong_hook_knee', 0.49, 0.67, 240);
    await captureCrop('zone2_yong_flared_exit', 0.73, 0.72, 240);

    // -------------------------------------------------------------
    // TEST 3: Release & Liftoff Trailing (一 - Horizontal Bar & Flick)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Liftoff & Kasure: Running 一 (Bar & Flick Exit)...');
    await clearCanvas();
    await page.evaluate(async () => {
      if (typeof window.simulateCalligraphy === 'function') {
        await window.simulateCalligraphy('ichi');
      }
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(2000);

    const macro3 = path.join(outDir, '03_ichi_liftoff_macro.png');
    await page.screenshot({ path: macro3 });
    await captureCrop('zone3_ichi_entry_attack', 0.24, 0.48, 200);
    await captureCrop('zone3_ichi_kasure_mid', 0.50, 0.50, 240);
    await captureCrop('zone3_ichi_flick_exit_tail', 0.77, 0.48, 220);

    // -------------------------------------------------------------
    // TEST 4: Reservoir Depletion & Multi-Stroke Kasure
    // -------------------------------------------------------------
    console.log('\n[Test 4] Reservoir Depletion: Running continuous long calligraphy sweep...');
    await clearCanvas();

    await page.evaluate(async () => {
      if (typeof window.simulateCalligraphy === 'function') {
        await window.simulateCalligraphy('depletion');
      }
    });

    await page.mouse.move(0, 0);
    await page.waitForTimeout(2500);

    const macro4 = path.join(outDir, '04_reservoir_depletion_macro.png');
    await page.screenshot({ path: macro4 });
    await captureCrop('zone4_stroke1_saturated', 0.25, 0.50, 240);
    await captureCrop('zone4_stroke3_dry_kasure', 0.75, 0.50, 240);

    // -------------------------------------------------------------
    // TEST 5: Living Fluid Bleeding & Coffee-Ring Sedimentation
    // -------------------------------------------------------------
    console.log('\n[Test 5] Living Fluid Bleed & Coffee-Ring Rim Formation...');
    await clearCanvas();
    await selectPaper(0); // Kizuki Kōzo

    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      // Draw two intersecting wet washes with high water dilution
      const dilutionSlider = document.querySelector('#slider-dilution');
      if (dilutionSlider) {
        dilutionSlider.value = '0.75';
        dilutionSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const p1_start = { x: rect.left + 0.40 * rect.width, y: rect.top + 0.30 * rect.height };
      const p1_end = { x: rect.left + 0.60 * rect.width, y: rect.top + 0.70 * rect.height };

      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: p1_start.x, clientY: p1_start.y, pressure: 0.70, bubbles: true }));
      await sleep(20);
      for (let i = 1; i <= 25; i++) {
        const t = i / 25;
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: p1_start.x + (p1_end.x - p1_start.x) * t,
          clientY: p1_start.y + (p1_end.y - p1_start.y) * t,
          pressure: 0.70,
          bubbles: true
        }));
        await sleep(16);
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: p1_end.x, clientY: p1_end.y, pressure: 0.0, bubbles: true }));
      await sleep(400);

      // Horizontal intersecting stroke (Tarashikomi wet-bleed)
      const p2_start = { x: rect.left + 0.30 * rect.width, y: rect.top + 0.50 * rect.height };
      const p2_end = { x: rect.left + 0.70 * rect.width, y: rect.top + 0.50 * rect.height };

      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: p2_start.x, clientY: p2_start.y, pressure: 0.70, bubbles: true }));
      await sleep(20);
      for (let i = 1; i <= 25; i++) {
        const t = i / 25;
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: p2_start.x + (p2_end.x - p2_start.x) * t,
          clientY: p2_start.y + (p2_end.y - p2_start.y) * t,
          pressure: 0.70,
          bubbles: true
        }));
        await sleep(16);
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: p2_end.x, clientY: p2_end.y, pressure: 0.0, bubbles: true }));
    });

    // Wait 3.5 seconds for live capillary Darcy wicking and coffee-ring evaporation pinning to develop
    console.log('  -> Waiting 3.5s for Darcy porous wicking & Stokes sedimentation...');
    await page.waitForTimeout(3500);

    const macro5 = path.join(outDir, '05_fluid_bleed_coffee_ring_macro.png');
    await page.screenshot({ path: macro5 });
    await captureCrop('zone5_wet_intersection_bleed', 0.50, 0.50, 260);
    await captureCrop('zone5_capillary_edge_rim', 0.60, 0.50, 220);

    // -------------------------------------------------------------
    // TEST 6: Mouse / Trackpad Freeform Dynamic Strokes & Kanji Crossing
    // -------------------------------------------------------------
    console.log('\n[Test 6] Mouse / Trackpad Freeform Dynamic Range & Kanji Strokes...');
    await clearCanvas();
    await selectPaper(0); // Kizuki Kōzo

    await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      // Reset dilution to standard 50%
      const dilutionSlider = document.querySelector('#slider-dilution');
      if (dilutionSlider) {
        dilutionSlider.value = '0.50';
        dilutionSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 1. Slow, heavy deliberate downstroke (Belly expansion)
      const s1_start = { x: rect.left + 0.25 * rect.width, y: rect.top + 0.25 * rect.height };
      const s1_end = { x: rect.left + 0.25 * rect.width, y: rect.top + 0.75 * rect.height };
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: s1_start.x, clientY: s1_start.y, pressure: 0.5, bubbles: true }));
      await sleep(25);
      for (let i = 1; i <= 30; i++) {
        const t = i / 30;
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: s1_start.x + (s1_end.x - s1_start.x) * t,
          clientY: s1_start.y + (s1_end.y - s1_start.y) * t,
          pressure: 0.5,
          bubbles: true
        }));
        await sleep(35); // slow 35ms per step
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: s1_end.x, clientY: s1_end.y, pressure: 0.0, bubbles: true }));
      await sleep(200);

      // 2. Fast agile flick / slash (Tip narrowing and kasure)
      const s2_start = { x: rect.left + 0.35 * rect.width, y: rect.top + 0.30 * rect.height };
      const s2_end = { x: rect.left + 0.70 * rect.width, y: rect.top + 0.70 * rect.height };
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: s2_start.x, clientY: s2_start.y, pressure: 0.5, bubbles: true }));
      await sleep(10);
      for (let i = 1; i <= 15; i++) {
        const t = i / 15;
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: s2_start.x + (s2_end.x - s2_start.x) * t,
          clientY: s2_start.y + (s2_end.y - s2_start.y) * t,
          pressure: 0.5,
          bubbles: true
        }));
        await sleep(8); // fast 8ms per step
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: s2_end.x, clientY: s2_end.y, pressure: 0.0, bubbles: true }));
      await sleep(200);

      // 3. Crossing slash (Kanji gesture)
      const s3_start = { x: rect.left + 0.65 * rect.width, y: rect.top + 0.35 * rect.height };
      const s3_end = { x: rect.left + 0.40 * rect.width, y: rect.top + 0.65 * rect.height };
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: s3_start.x, clientY: s3_start.y, pressure: 0.5, bubbles: true }));
      await sleep(15);
      for (let i = 1; i <= 20; i++) {
        const t = i / 20;
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: s3_start.x + (s3_end.x - s3_start.x) * t,
          clientY: s3_start.y + (s3_end.y - s3_start.y) * t,
          pressure: 0.5,
          bubbles: true
        }));
        await sleep(15);
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: s3_end.x, clientY: s3_end.y, pressure: 0.0, bubbles: true }));
    });

    await page.mouse.move(0, 0);
    await page.waitForTimeout(2000);

    const macro6 = path.join(outDir, '06_mouse_freeform_strokes_macro.png');
    await page.screenshot({ path: macro6 });
    await captureCrop('zone6_slow_belly_stroke', 0.25, 0.50, 240);
    await captureCrop('zone6_fast_flick_slash', 0.55, 0.50, 260);
    await captureCrop('zone6_crossing_intersection', 0.52, 0.50, 240);

  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    killServer();
  }

  console.log('\n=== Evaluation Suite Finished ===');
  if (consoleErrors.length > 0) {
    console.error(`Detected ${consoleErrors.length} console errors during run.`);
    process.exit(1);
  } else {
    console.log('PASSED: 0 console errors detected.');
  }
}

runEvaluation().catch((err) => {
  console.error('Evaluation run failed:', err);
  process.exit(1);
});
