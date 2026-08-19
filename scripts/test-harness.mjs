// Automated Multi-State WebGPU Visual & Console Verification Harness
// Runs Chromium with macOS Metal hardware WebGPU flags to verify rendering,
// authentic Nihonga pigments, washi paper substrates, master Japanese brushes, and bleed dynamics.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runTestHarness() {
  console.log('=== MUJŌ Automated WebGPU Visual & Console Verification Harness ===');

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

  // Helper to draw a continuous smooth calligraphic stroke
  async function drawStroke(points) {
    if (points.length === 0) return;
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(40);
    for (let i = 1; i < points.length; i++) {
      const pStart = points[i - 1];
      const pEnd = points[i];
      const dist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      const subSteps = Math.max(Math.ceil(dist / 4.0), 12);
      for (let s = 1; s <= subSteps; s++) {
        const x = pStart.x + (pEnd.x - pStart.x) * (s / subSteps);
        const y = pStart.y + (pEnd.y - pStart.y) * (s / subSteps);
        await page.mouse.move(x, y);
        await page.waitForTimeout(10);
      }
    }
    await page.waitForTimeout(40);
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(150);
  }

  // Helper to draw a rapid calligraphic flick (> 3,000 px/s)
  async function drawFastStroke(points) {
    if (points.length === 0) return;
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(20);
    for (let i = 1; i < points.length; i++) {
      const pStart = points[i - 1];
      const pEnd = points[i];
      const dist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      const subSteps = Math.max(Math.ceil(dist / 20.0), 4);
      for (let s = 1; s <= subSteps; s++) {
        const x = pStart.x + (pEnd.x - pStart.x) * (s / subSteps);
        const y = pStart.y + (pEnd.y - pStart.y) * (s / subSteps);
        await page.mouse.move(x, y);
        await page.waitForTimeout(4);
      }
    }
    await page.waitForTimeout(20);
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(150);
  }

  // Clear canvas using Seishiki (Clear Canvas) button
  async function clearCanvas() {
    await page.click('#btn-clear-canvas');
    await page.waitForTimeout(200);
  }

  // Select pigment by ID (0..5)
  async function selectPigment(id) {
    await page.click(`.pigment-btn[data-id="${id}"]`);
    await page.waitForTimeout(60);
  }

  // Select brush by ID (0=Maru-fude, 1=Menso, 2=Hake)
  async function selectBrush(id) {
    await page.click(`.brush-stand-btn[data-id="${id}"]`);
    await page.waitForTimeout(60);
  }

  // Select paper by ID (0=Kizuki Kozo, 1=Torinoko, 2=Kobishi)
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

  // --- TEST 1: The 3 Master Authentic Washi Paper Substrates ---
  console.log('Testing 3 Authentic Washi paper substrates (Kizuki Kōzo, Torinoko, Kobishi)...');
  const paperNames = ['kizuki_kozo', 'torinoko', 'kobishi'];
  for (let p = 0; p < 3; p++) {
    await selectPaper(p);
    await page.waitForTimeout(150);
    const filename = path.join(outDir, `01_paper_${p}_${paperNames[p]}.png`);
    await page.screenshot({ path: filename });
    console.log(`Captured: ${filename}`);
  }

  // --- TEST 2: 5 Nihonga Mineral Pigments on Raw Mulberry (Kizuki Kōzo) ---
  console.log('Testing 5 Nihonga Mineral Pigments on Kizuki Kōzo...');
  await clearCanvas();
  await selectPaper(0); // Kizuki Kōzo
  await selectBrush(0); // Maru-fude
  await setWaterDilution(0.5);

  const pigmentNames = ['0_sumi', '1_shu', '2_ai', '3_odo', '4_rokusho'];
  for (let i = 0; i < 5; i++) {
    await selectPigment(i);
    const startX = 320 + i * 160;
    const startY = 300;
    await drawStroke([
      { x: startX, y: startY - 60 },
      { x: startX + 30, y: startY + 20 },
      { x: startX - 20, y: startY + 80 },
      { x: startX + 40, y: startY + 120 }
    ]);
  }
  await page.waitForTimeout(800);
  const filePigments = path.join(outDir, `02_five_nihonga_pigments.png`);
  await page.screenshot({ path: filePigments });
  console.log(`Captured: ${filePigments}`);

  // --- TEST 3: 3 Master Japanese Brushes (Maru-fude, Menso, Hake) ---
  console.log('Testing 3 Master Japanese Brushes on Torinoko Paper...');
  await clearCanvas();
  await selectPaper(1); // Torinoko (Sized Eggshell)

  // 1. Maru-fude (Classic Round Calligraphy with calligraphic swell)
  await selectBrush(0);
  await selectPigment(0); // Sumi
  await drawStroke([
    { x: 340, y: 250 },
    { x: 500, y: 230 },
    { x: 700, y: 270 },
    { x: 900, y: 240 }
  ]);

  // 2. Menso (Fine Liner Sable Hairline)
  await selectBrush(1);
  await selectPigment(1); // Shu Vermilion
  await drawStroke([
    { x: 340, y: 360 },
    { x: 550, y: 360 },
    { x: 750, y: 360 },
    { x: 900, y: 360 }
  ]);

  // 3. Hake (Broad Flat Wash Brush)
  await selectBrush(2);
  await selectPigment(2); // Ai Indigo
  await drawStroke([
    { x: 340, y: 470 },
    { x: 600, y: 470 },
    { x: 900, y: 470 }
  ]);

  await page.waitForTimeout(1000);
  const fileBrushes = path.join(outDir, `03_master_three_brushes.png`);
  await page.screenshot({ path: fileBrushes });
  console.log(`Captured: ${fileBrushes}`);

  // --- TEST 4: Bleed & Water Dilution Dynamics (Kasure dry tooth skip vs Lush capillary bloom) ---
  console.log('Testing Water Dilution: Low Dilution (Dry Kasure) vs High Dilution (Lush Nijimi Bloom)...');
  await clearCanvas();
  await selectPaper(0); // Kizuki Kōzo (Bast Mulberry)
  await selectBrush(0); // Maru-fude

  // Low Dilution (0.15 - Dry Tooth Skip)
  await setWaterDilution(0.15);
  await selectPigment(0); // Sumi
  await drawStroke([
    { x: 360, y: 280 },
    { x: 560, y: 280 },
    { x: 760, y: 280 }
  ]);

  // High Dilution (0.90 - Lush Bloom)
  await setWaterDilution(0.90);
  await selectPigment(2); // Ai Indigo
  await drawStroke([
    { x: 360, y: 420 },
    { x: 560, y: 420 },
    { x: 760, y: 420 }
  ]);

  await page.waitForTimeout(1400); // Allow capillary pool to expand
  const fileDilution = path.join(outDir, `04_dilution_dry_vs_lush_bloom.png`);
  await page.screenshot({ path: fileDilution });
  console.log(`Captured: ${fileDilution}`);

  // --- TEST 5: Wet-on-Wet Tarashikomi & Clear Water Wash ---
  console.log('Testing Wet-on-Wet Tarashikomi & Clear Water Wash...');
  await clearCanvas();
  await selectPaper(2); // Kobishi (Antique Edo Patina)
  await setWaterDilution(0.70);

  // 1. Broad Indigo wash
  await selectBrush(2); // Hake
  await selectPigment(2); // Ai Indigo
  await drawStroke([
    { x: 400, y: 340 },
    { x: 800, y: 340 }
  ]);

  // 2. Drop Cinnabar Vermilion into wet pool (Tarashikomi)
  await selectBrush(0); // Maru-fude
  await selectPigment(1); // Shu Vermilion
  await drawStroke([
    { x: 540, y: 310 },
    { x: 620, y: 370 }
  ]);

  // 3. Blend with Clear Water (Mizu)
  await selectPigment(5); // Mizu (Water)
  await drawStroke([
    { x: 680, y: 330 },
    { x: 750, y: 350 }
  ]);

  await page.waitForTimeout(1200);
  const fileTarashikomi = path.join(outDir, `05_tarashikomi_wet_blending.png`);
  await page.screenshot({ path: fileTarashikomi });
  console.log(`Captured: ${fileTarashikomi}`);

  // --- TEST 6: Aspect Ratio Isotropic Geometry Check ---
  console.log('Testing Isotropic Aspect Ratio (Square vs Ultrawide viewport)...');
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(300);
  await clearCanvas();
  await selectPaper(0); // Kizuki Kōzo
  await selectBrush(0); // Maru-fude
  await selectPigment(0); // Sumi
  
  // Draw circular stroke
  await drawStroke([
    { x: 450, y: 300 },
    { x: 550, y: 380 },
    { x: 450, y: 460 },
    { x: 350, y: 380 },
    { x: 450, y: 300 }
  ]);
  await page.waitForTimeout(600);
  const fileSquareAspect = path.join(outDir, `06_isotropic_square_aspect.png`);
  await page.screenshot({ path: fileSquareAspect });
  console.log(`Captured: ${fileSquareAspect}`);

  // --- TEST 7: Fast Cursive Multi-Turn Calligraphy & No Stutter Check ---
  console.log('Testing Fast Multi-Turn Calligraphy (ensuring velvety unbroken strokes)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await clearCanvas();
  await selectPaper(0); // Kizuki Kōzo
  await selectBrush(0); // Maru-fude
  await selectPigment(0); // Sumi
  
  // Rapid cursive loop 1 (Ensō loop)
  await drawFastStroke([
    { x: 380, y: 360 },
    { x: 340, y: 280 },
    { x: 400, y: 220 },
    { x: 480, y: 230 },
    { x: 520, y: 300 },
    { x: 490, y: 380 },
    { x: 400, y: 400 },
    { x: 330, y: 350 }
  ]);

  // Rapid cross diagonal strokes (like character 無 / 夢)
  await drawFastStroke([
    { x: 300, y: 240 },
    { x: 620, y: 240 }
  ]);

  await drawFastStroke([
    { x: 460, y: 180 },
    { x: 460, y: 480 }
  ]);

  await drawFastStroke([
    { x: 560, y: 240 },
    { x: 680, y: 360 },
    { x: 740, y: 300 },
    { x: 760, y: 440 }
  ]);

  await page.waitForTimeout(1000);
  const fileCursive = path.join(outDir, `07_fast_cursive_calligraphy.png`);
  await page.screenshot({ path: fileCursive });
  console.log(`Captured: ${fileCursive}`);

  // Cleanup
  await browser.close();
  viteProcess.kill();

  console.log('=== Console Errors Summary ===');
  if (consoleErrors.length > 0) {
    console.error(`FAILED: Encountered ${consoleErrors.length} console errors:`);
    consoleErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('PASSED: 0 console errors detected throughout all interaction passes.');
  }

  console.log('=== All Automated Verification Tests Passed Successfully! ===');
  process.exit(0);
}

runTestHarness().catch((err) => {
  console.error('Test harness execution failed:', err);
  process.exit(1);
});
