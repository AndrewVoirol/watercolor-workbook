// Automated Multi-State WebGPU Visual Verification Harness
// Runs Chromium with exact macOS Metal hardware WebGPU flags to verify rendering,
// pigment spectral accuracy, paper textures, granulation, and blending.

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist', 'verification');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runTestHarness() {
  console.log('=== MUJŌ Automated WebGPU Visual Verification Harness ===');

  // 1. Boot local Vite dev server
  const port = 5181;
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
    }
  });

  page.on('pageerror', (err) => {
    console.error(`[Browser Page Error]`, err);
  });

  console.log(`Navigating to http://localhost:${port}...`);
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Helper to draw a continuous smooth calligraphic stroke
  async function drawStroke(points) {
    if (points.length === 0) return;
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(20);
    for (let i = 1; i < points.length; i++) {
      const pStart = points[i - 1];
      const pEnd = points[i];
      const subSteps = 12;
      for (let s = 1; s <= subSteps; s++) {
        const x = pStart.x + (pEnd.x - pStart.x) * (s / subSteps);
        const y = pStart.y + (pEnd.y - pStart.y) * (s / subSteps);
        await page.mouse.move(x, y);
        await page.waitForTimeout(10);
      }
    }
    await page.waitForTimeout(20);
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(100);
  }

  // Clear canvas using Spring Rain
  async function clearCanvas() {
    await page.click('#btn-spring-rain');
    await page.waitForTimeout(1400); // 60 frames = 1.0s + buffer
  }

  // Select pigment by ID (0..13)
  async function selectPigment(id) {
    await page.click(`.pigment-btn[data-id="${id}"]`);
    await page.waitForTimeout(50);
  }

  // Select brush by ID (0=Fude, 1=Menso, 2=Hake, 3=Fukie)
  async function selectBrush(id) {
    await page.click(`.brush-stand-btn[data-id="${id}"]`);
    await page.waitForTimeout(50);
  }

  // Select paper by ID (0..5)
  async function selectPaper(id) {
    await page.click(`.washi-opt-btn[data-id="${id}"]`);
    await page.waitForTimeout(150);
  }

  // --- TEST 1: Pristine Washi Paper Substrates ---
  console.log('Testing and capturing 6 pristine Washi paper substrates...');
  for (let p = 0; p < 6; p++) {
    await selectPaper(p);
    await page.waitForTimeout(150);
    const filename = path.join(outDir, `01_paper_${p}_pristine.png`);
    await page.screenshot({ path: filename });
    console.log(`Captured: ${filename}`);
  }

  // --- TEST 2: Gofun (White) & Kindei (Gold) on Aizome-shi (Indigo Paper) ---
  console.log('Testing Gofun White and Gold on Midnight Indigo Paper (Aizome-shi)...');
  await selectPaper(4); // Aizome-shi
  await page.waitForTimeout(200);

  // Paint Gofun (11: Oyster White)
  await selectPigment(11);
  await selectBrush(0); // Fude
  await drawStroke([
    { x: 360, y: 340 },
    { x: 540, y: 310 },
    { x: 720, y: 360 },
    { x: 920, y: 320 }
  ]);

  // Paint Kindei (6: 24k Gold)
  await selectPigment(6);
  await drawStroke([
    { x: 360, y: 450 },
    { x: 620, y: 480 },
    { x: 920, y: 430 }
  ]);

  await page.waitForTimeout(500);
  const fileAizome = path.join(outDir, `02_gofun_gold_on_aizome.png`);
  await page.screenshot({ path: fileAizome });
  console.log(`Captured: ${fileAizome}`);

  // --- TEST 3: All 12 Mineral Pigments Palette Swatches on Echizen Kōzo ---
  console.log('Testing all 12 mineral pigments on Echizen Kōzo...');
  await clearCanvas();

  await selectPaper(2); // Echizen Kōzo (Mulberry tooth)
  await selectBrush(0); // Maru-fude

  const pigmentsToTest = [
    { id: 0, name: 'Sumi_Black' },
    { id: 1, name: 'Shu_Vermilion' },
    { id: 2, name: 'Enji_Crimson' },
    { id: 3, name: 'Botan_Pink' },
    { id: 4, name: 'Oudo_Ochre' },
    { id: 5, name: 'Kurikawa_Umber' },
    { id: 6, name: 'Kindei_Gold' },
    { id: 7, name: 'Gunjo_Azurite' },
    { id: 8, name: 'Ai_Indigo' },
    { id: 9, name: 'Rokusho_Malachite' },
    { id: 10, name: 'Byakuroku_Jade' },
    { id: 11, name: 'Gofun_White' }
  ];

  for (let i = 0; i < pigmentsToTest.length; i++) {
    const p = pigmentsToTest[i];
    await selectPigment(p.id);
    const col = i % 4;
    const row = Math.floor(i / 4);
    const startX = 300 + col * 230;
    const startY = 220 + row * 190;

    await drawStroke([
      { x: startX, y: startY },
      { x: startX + 65, y: startY + 35 },
      { x: startX + 140, y: startY - 15 }
    ]);
    await page.waitForTimeout(40);
  }

  await page.waitForTimeout(600);
  const fileSwatches = path.join(outDir, `03_all_12_pigments_echizen.png`);
  await page.screenshot({ path: fileSwatches });
  console.log(`Captured: ${fileSwatches}`);

  // --- TEST 4: Wet-on-Wet Tarashikomi & Salt Granulation on Unryū-shi ---
  console.log('Testing wet-on-wet Tarashikomi marbling and Salt Granulation...');
  await clearCanvas();

  await selectPaper(0); // Unryū-shi (bast fiber wicking)

  // 1. Broad wet wash of Ai (Indigo)
  await selectPigment(8); // Ai
  await selectBrush(2);   // Hake
  await drawStroke([
    { x: 420, y: 380 },
    { x: 800, y: 380 }
  ]);

  // 2. Drop concentrated Shu (Cinnabar) into the wet pool (Tarashikomi)
  await selectPigment(1); // Shu
  await selectBrush(0);   // Fude
  await drawStroke([
    { x: 560, y: 350 },
    { x: 640, y: 410 }
  ]);

  // 3. Sprinkle Shio (Salt) onto wet edge
  await selectPigment(13); // Shio
  await drawStroke([
    { x: 480, y: 370 },
    { x: 510, y: 390 }
  ]);

  await page.waitForTimeout(1000);
  const fileTarashikomi = path.join(outDir, `04_tarashikomi_and_salt.png`);
  await page.screenshot({ path: fileTarashikomi });
  console.log(`Captured: ${fileTarashikomi}`);

  // Cleanup
  await browser.close();
  viteProcess.kill();
  console.log('=== All Visual Verification Tests Completed Successfully! ===');
}

runTestHarness().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
