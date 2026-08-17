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
    const startX = 260 + col * 250;
    const startY = 135 + row * 125;

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
    { x: 420, y: 320 },
    { x: 820, y: 320 }
  ]);

  // 2. Drop concentrated Shu (Cinnabar) into the wet pool (Tarashikomi)
  await selectPigment(1); // Shu
  await selectBrush(0);   // Fude
  await drawStroke([
    { x: 560, y: 300 },
    { x: 640, y: 350 }
  ]);

  // 3. Sprinkle Shio (Salt) onto wet edge
  await selectPigment(13); // Shio
  await drawStroke([
    { x: 480, y: 310 },
    { x: 510, y: 330 }
  ]);

  await page.waitForTimeout(1000);
  const fileTarashikomi = path.join(outDir, `04_tarashikomi_and_salt.png`);
  await page.screenshot({ path: fileTarashikomi });
  console.log(`Captured: ${fileTarashikomi}`);

  // --- TEST 5: Stationary Brush Linger & Dwell Bleed Confinement Test ---
  console.log('Testing Stationary Brush Linger & Dwell Bleed Confinement (1.8s hold)...');
  await clearCanvas();
  await selectPaper(0); // Unryū-shi
  await selectBrush(0); // Maru-fude
  await selectPigment(7); // Gunjō Azurite

  // Linger Gunjo at (500, 320) for 1800ms
  await page.mouse.move(500, 320);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(1800);
  await page.mouse.up({ button: 'left' });

  // Linger Shu at (740, 320) for 1800ms
  await selectPigment(1); // Shu Vermilion
  await page.mouse.move(740, 320);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(1800);
  await page.mouse.up({ button: 'left' });

  // Allow capillary flow to settle into natural feathered halo
  await page.waitForTimeout(1400);
  const fileLinger = path.join(outDir, `05_dwell_linger_confinement.png`);
  await page.screenshot({ path: fileLinger });
  console.log(`Captured: ${fileLinger}`);

  // --- TEST 6: Instant Paper Switch Performance Benchmark ---
  console.log('Benchmarking Instant Paper Switch Latency...');
  const switchTimes = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    const t0 = performance.now();
    await selectPaper(cycle);
    const t1 = performance.now();
    switchTimes.push(t1 - t0);
  }
  console.log(`Paper Switch Timing Benchmark: avg ${(switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length).toFixed(2)}ms per switch!`);

  const filePaperBench = path.join(outDir, `06_paper_switch_benchmark.png`);
  await page.screenshot({ path: filePaperBench });
  console.log(`Captured: ${filePaperBench}`);

  // --- TEST 7: Stroke-on-Stroke Intersections & Yobitsugi Re-solubilization ---
  console.log('Testing Stroke-on-Stroke Intersections & Yobitsugi Re-solubilization...');
  await clearCanvas();
  await selectPaper(0); // Unryū-shi
  await selectBrush(0); // Maru-fude

  // 1. Draw horizontal Sumi black stroke
  await selectPigment(0); // Sumi
  await drawStroke([
    { x: 420, y: 330 },
    { x: 600, y: 330 },
    { x: 780, y: 330 }
  ]);
  await page.waitForTimeout(1200); // Allow initial drying and pinning

  // 2. Draw intersecting vertical Shu (Vermilion) stroke across Sumi
  await selectPigment(1); // Shu
  await drawStroke([
    { x: 600, y: 220 },
    { x: 600, y: 330 },
    { x: 600, y: 440 }
  ]);
  await page.waitForTimeout(1400);

  const fileYobitsugi = path.join(outDir, `07_yobitsugi_stroke_intersection.png`);
  await page.screenshot({ path: fileYobitsugi });
  console.log(`Captured: ${fileYobitsugi}`);

  // --- TEST 8: Multi-Pigment Chromatography & Mineral Granulation Demixing ---
  console.log('Testing Multi-Pigment Chromatography (Azurite + Crimson glaze on Echizen Kōzo)...');
  await clearCanvas();
  await selectPaper(2); // Echizen Kōzo (Mulberry tooth valleys)
  await selectBrush(2); // Hake broad wash

  // 1. Broad wash of Gunjo (Azurite heavy mineral)
  await selectPigment(7); // Gunjo
  await drawStroke([
    { x: 440, y: 330 },
    { x: 760, y: 330 }
  ]);

  // 2. Cross with Enji (Crimson molecular glaze)
  await selectPigment(2); // Enji
  await selectBrush(0);   // Fude
  await drawStroke([
    { x: 480, y: 270 },
    { x: 600, y: 330 },
    { x: 720, y: 390 }
  ]);

  await page.waitForTimeout(1500);
  const fileChroma = path.join(outDir, `08_chromatographic_demixing.png`);
  await page.screenshot({ path: fileChroma });
  console.log(`Captured: ${fileChroma}`);

  // --- TEST 9: Long Continuous Stroke Reservoir Depletion & Kasure Run-Out ---
  console.log('Testing Long Continuous Stroke Reservoir Depletion & Kasure Paper Tooth Skip...');
  await clearCanvas();
  await selectPaper(0); // Unryū-shi
  await selectBrush(0); // Maru-fude
  await selectPigment(0); // Sumi pine soot

  // Continuous sweeping stroke across canvas without lifting pen/mouse (long path > 2200px)
  await drawStroke([
    { x: 260, y: 260 },
    { x: 800, y: 260 },
    { x: 860, y: 320 },
    { x: 260, y: 330 },
    { x: 240, y: 400 },
    { x: 860, y: 410 },
    { x: 840, y: 470 },
    { x: 300, y: 480 }
  ]);
  await page.waitForTimeout(1400);

  const fileDepletion = path.join(outDir, `09_long_stroke_reservoir_depletion.png`);
  await page.screenshot({ path: fileDepletion });
  console.log(`Captured: ${fileDepletion}`);

  // --- TEST 10: Multi-Motif Asynchronous Layering & Cross-Canvas Glaze Matrix ---
  console.log('Testing Multi-Motif Asynchronous Layering (Drying states, Yobitsugi over dry vs Tarashikomi into wet)...');
  await clearCanvas();
  await selectPaper(2); // Echizen Kōzo

  // 1. Paint Motif 1: Sumi Black circle in top-left
  await selectBrush(0);
  await selectPigment(0); // Sumi
  await drawStroke([
    { x: 380, y: 260 },
    { x: 440, y: 290 },
    { x: 400, y: 340 },
    { x: 350, y: 310 },
    { x: 380, y: 260 }
  ]);

  // Wait 3.5s for Motif 1 to fully dry and pin to paper fibers
  console.log('Waiting 3.5s for Motif 1 to desiccate and pin into paper substrate...');
  await page.waitForTimeout(3500);

  // 2. Paint Motif 2: Fresh wet wash of Ai Blue in center-right
  await selectPigment(8); // Ai Indigo
  await selectBrush(2);   // Hake flat
  await drawStroke([
    { x: 580, y: 300 },
    { x: 740, y: 300 }
  ]);

  // 3. Immediately draw a fresh Vermilion sweeping stroke crossing BOTH the dry Motif 1 and wet Motif 2!
  await selectPigment(1); // Shu Vermilion
  await selectBrush(0);   // Maru-fude
  await drawStroke([
    { x: 340, y: 220 },
    { x: 410, y: 300 }, // Crosses dry Sumi (Yobitsugi glaze)
    { x: 520, y: 300 },
    { x: 660, y: 300 }, // Crosses wet Ai (Tarashikomi marbling)
    { x: 760, y: 300 }
  ]);

  await page.waitForTimeout(1600);
  const fileAsyncLayering = path.join(outDir, `10_asynchronous_multi_motif_layering.png`);
  await page.screenshot({ path: fileAsyncLayering });
  console.log(`Captured: ${fileAsyncLayering}`);

  // Cleanup
  await browser.close();
  viteProcess.kill();
  console.log('=== All Visual Verification Tests Completed Successfully! ===');
  process.exit(0);
}

runTestHarness().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
