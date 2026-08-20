// Automated 3-Zone Micro-Inspection Harness for WebGPU Calligraphy Dynamics
// Runs full calligraphy benchmark suite in Zen Focus mode (100% unobstructed canvas)
// and extracts high-resolution crops of Zone 1 (Attack), Zone 2 (Knee/Turn), and Zone 3 (Release/Liftoff).

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'screenshots');
const cropsDir = path.join(outDir, 'crops');

if (!fs.existsSync(cropsDir)) {
  fs.mkdirSync(cropsDir, { recursive: true });
}

async function runMicroInspection() {
  console.log('=== MUJŌ Automated 3-Zone Micro-Inspection Harness ===');

  let consoleErrors = [];

  // 1. Boot local Vite dev server
  const port = 5183;
  const viteProcess = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: true
  });

  await new Promise((resolve) => {
    viteProcess.stdout.on('data', (data) => {
      const str = data.toString();
      if (str.includes('localhost:') || str.includes('Local:')) {
        console.log(`Vite dev server active at http://localhost:${port}`);
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  // 2. Launch Chromium with macOS Metal WebGPU Backend Flags
  const browser = await chromium.launch({
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

  // Helper to trigger automated calligraphy test
  async function runShishoTest(type) {
    await page.evaluate(async (t) => {
      if (typeof window.simulateCalligraphy === 'function') {
        await window.simulateCalligraphy(t);
      }
    }, type);
    // Wait for fluid relaxation
    await page.waitForTimeout(600);
  }

  // Clear canvas using UI button
  async function clearCanvas() {
    await page.click('#btn-clear-canvas');
    await page.waitForTimeout(250);
  }

  // Select paper preset
  async function selectPaper(id) {
    await page.click(`.washi-opt-btn[data-id="${id}"]`);
    await page.waitForTimeout(150);
  }

  // Set water dilution
  async function setWaterDilution(val) {
    await page.$eval('#slider-dilution', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, val);
    await page.waitForTimeout(60);
  }

  // Set brush size
  async function setBrushSize(val) {
    await page.$eval('#slider-brush-size', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, val);
    await page.waitForTimeout(60);
  }

  // Toggle Focus Mode for unobstructed canvas captures
  async function toggleFocusMode() {
    await page.click('#btn-focus');
    await page.waitForTimeout(400);
  }

  // Helper to capture a magnified crop around canvas-relative normalized coordinates (cx, cy in 0..1)
  async function captureMagnifiedCrop(name, normX, normY, sizeCss = 240) {
    const canvasBox = await page.$eval('canvas', (el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });

    const centerX = canvasBox.left + normX * canvasBox.width;
    const centerY = canvasBox.top + normY * canvasBox.height;

    const clipX = Math.max(0, centerX - sizeCss / 2);
    const clipY = Math.max(0, centerY - sizeCss / 2);

    const cropPath = path.join(cropsDir, `${name}.png`);
    await page.screenshot({
      path: cropPath,
      clip: {
        x: clipX,
        y: clipY,
        width: sizeCss,
        height: sizeCss
      }
    });
    console.log(`  [Crop Captured] ${name}.png (centered at norm ${normX.toFixed(2)}, ${normY.toFixed(2)})`);
  }

  // --- INSPECTION 1: 永 (Eight Principles of Yong) ---
  console.log('\n--- 1. Testing 永 (Eight Principles of Yong) ---');
  await clearCanvas();
  await selectPaper(1); // Torinoko (Sized Eggshell)
  await setWaterDilution(0.40);
  await setBrushSize(22);
  await toggleFocusMode(); // Hide docks for pristine view
  await runShishoTest('yong');

  const fileYongMacro = path.join(outDir, 'inspect_01_yong_macro.png');
  await page.screenshot({ path: fileYongMacro });
  console.log(`Macro view saved: ${fileYongMacro}`);

  // Zone 1: Soku Dot (Attack)
  await captureMagnifiedCrop('yong_zone1_attack_dot', 0.51, 0.20, 220);
  // Zone 2: Teki Hook turnaround knee (Turn)
  await captureMagnifiedCrop('yong_zone2_hook_knee', 0.49, 0.67, 240);
  // Zone 3: Taku Flared Sweep (Liftoff)
  await captureMagnifiedCrop('yong_zone3_flared_liftoff', 0.73, 0.72, 240);

  // --- INSPECTION 2: 一 (Horizontal Bar & Kasure Tooth Skip) ---
  console.log('\n--- 2. Testing 一 (Horizontal Bar & Kasure) ---');
  await clearCanvas();
  await runShishoTest('ichi');

  const fileIchiMacro = path.join(outDir, 'inspect_02_ichi_macro.png');
  await page.screenshot({ path: fileIchiMacro });
  console.log(`Macro view saved: ${fileIchiMacro}`);

  // Zone 1: Bar Attack
  await captureMagnifiedCrop('ichi_zone1_attack', 0.24, 0.48, 200);
  // Zone 2: Mid-stroke Kasure tooth skips
  await captureMagnifiedCrop('ichi_zone2_kasure_mid', 0.50, 0.50, 240);
  // Zone 3: Flick exit liftoff
  await captureMagnifiedCrop('ichi_zone3_flick_exit', 0.77, 0.48, 200);

  // --- INSPECTION 3: 心 (Kokoro - Flowing Belly & Hook) ---
  console.log('\n--- 3. Testing 心 (Kokoro Curved Belly & Hook) ---');
  await clearCanvas();
  await runShishoTest('kokoro');

  const fileKokoroMacro = path.join(outDir, 'inspect_03_kokoro_macro.png');
  await page.screenshot({ path: fileKokoroMacro });
  console.log(`Macro view saved: ${fileKokoroMacro}`);

  // Zone 2: Deep curved belly turn
  await captureMagnifiedCrop('kokoro_zone2_curved_belly', 0.50, 0.60, 240);
  // Zone 3: Upward leaping hook flick
  await captureMagnifiedCrop('kokoro_zone3_hook_flick', 0.56, 0.48, 220);

  // --- INSPECTION 4: 円 (Zen Ensō - 360° Continuous Sweeping Arc) ---
  console.log('\n--- 4. Testing 円 (Zen Ensō Arc) ---');
  await clearCanvas();
  await runShishoTest('enso');

  const fileEnsoMacro = path.join(outDir, 'inspect_04_enso_macro.png');
  await page.screenshot({ path: fileEnsoMacro });
  console.log(`Macro view saved: ${fileEnsoMacro}`);

  // Zone 2: Top arc apex
  await captureMagnifiedCrop('enso_zone2_top_apex', 0.50, 0.30, 240);
  // Zone 3: Trailing release fiber mark
  await captureMagnifiedCrop('enso_zone3_release_tail', 0.47, 0.33, 240);

  // --- INSPECTION 5: Speed Ladder (Deliberate ➔ Rapid Flicks) ---
  console.log('\n--- 5. Testing Speed Ladder ---');
  await clearCanvas();
  await runShishoTest('flicks');

  const fileLadderMacro = path.join(outDir, 'inspect_05_speed_ladder_macro.png');
  await page.screenshot({ path: fileLadderMacro });
  console.log(`Macro view saved: ${fileLadderMacro}`);

  // Slow vs Fast flick endings
  await captureMagnifiedCrop('ladder_slow_stroke_tail', 0.74, 0.28, 200);
  await captureMagnifiedCrop('ladder_fast_flick_tail', 0.74, 0.64, 200);

  // Re-enable docks
  await toggleFocusMode();

  // Cleanup
  await browser.close();
  viteProcess.kill();

  console.log('\n=== Console Errors Summary ===');
  if (consoleErrors.length > 0) {
    console.error(`FAILED: Encountered ${consoleErrors.length} console errors:`);
    consoleErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('PASSED: 0 console errors detected throughout all interaction passes.');
  }

  console.log('\n=== Micro-Inspection Complete! All crops generated in screenshots/crops/ ===');
  process.exit(0);
}

runMicroInspection().catch((err) => {
  console.error('Micro-inspection harness failed:', err);
  process.exit(1);
});
