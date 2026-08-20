// Dedicated Automated Reproduction Script for Center Bristle / Needle Point Artifact
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

async function runReproduction() {
  console.log('=== Reproducing Needle Point / Center Bristle Artifact ===');

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

  console.log(`Navigating to http://localhost:${port}...`);
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Enter Zen Focus mode to clear UI overlays
  await page.keyboard.press('z');
  await page.waitForTimeout(300);

  // Perform deliberate user-like gestures directly via evaluate
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const dispatchSingleTap = async (normX, normY, pressure = 0.75) => {
      const cx = rect.left + normX * rect.width;
      const cy = rect.top + normY * rect.height;
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx,
        clientY: cy,
        pressure,
        pointerType: 'pen',
        bubbles: true
      }));
      await sleep(60);
      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx,
        clientY: cy,
        pressure: 0.0,
        pointerType: 'pen',
        bubbles: true
      }));
      await sleep(120);
    };

    const dispatchShortStroke = async (startX, startY, endX, endY, steps = 15, durationMs = 150) => {
      const stepTime = durationMs / steps;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = rect.left + (startX + (endX - startX) * t) * rect.width;
        const cy = rect.top + (startY + (endY - startY) * t) * rect.height;
        if (i === 0) {
          canvas.dispatchEvent(new PointerEvent('pointerdown', {
            clientX: cx,
            clientY: cy,
            pressure: 0.70,
            pointerType: 'pen',
            bubbles: true
          }));
        } else {
          window.dispatchEvent(new PointerEvent('pointermove', {
            clientX: cx,
            clientY: cy,
            pressure: 0.70 - t * 0.40,
            pointerType: 'pen',
            bubbles: true
          }));
        }
        await sleep(stepTime);
      }
      const endCx = rect.left + endX * rect.width;
      const endCy = rect.top + endY * rect.height;
      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: endCx,
        clientY: endCy,
        pressure: 0.0,
        pointerType: 'pen',
        bubbles: true
      }));
      await sleep(120);
    };

    // 1. Stationary Dot Taps (like the user's uploaded image)
    await dispatchSingleTap(0.40, 0.35, 0.70); // Left upper tap
    await dispatchSingleTap(0.50, 0.30, 0.85); // Center upper tap
    await dispatchSingleTap(0.60, 0.35, 0.65); // Right upper tap
    await dispatchSingleTap(0.35, 0.50, 0.75); // Far left tap
    await dispatchSingleTap(0.65, 0.50, 0.80); // Far right tap

    // 2. Short Slow Vertical Stroke (like the bottom vertical line in user's image)
    await dispatchShortStroke(0.50, 0.42, 0.50, 0.58, 20, 200);

    // 3. Short Slow Diagonal Downward Stroke (top right)
    await dispatchShortStroke(0.65, 0.20, 0.75, 0.10, 18, 180);
  });

  // Move mouse away & wait for render
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1500);

  // Capture Macro
  const macroPath = path.join(outDir, 'reproduce_needle_macro.png');
  await page.screenshot({ path: macroPath });
  console.log(`Macro screenshot saved to: ${macroPath}`);

  // Capture Micro Crops of each specific test mark
  async function cropZone(name, normX, normY, sizeCss = 220) {
    const canvasBox = await page.$eval('canvas', (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const centerX = canvasBox.left + normX * canvasBox.width;
    const centerY = canvasBox.top + normY * canvasBox.height;
    const cropPath = path.join(cropsDir, `${name}.png`);
    await page.screenshot({
      path: cropPath,
      clip: {
        x: Math.max(0, centerX - sizeCss / 2),
        y: Math.max(0, centerY - sizeCss / 2),
        width: sizeCss,
        height: sizeCss
      }
    });
    console.log(`  [Crop] ${name}.png saved`);
  }

  await cropZone('reproduce_dot_tap_center', 0.50, 0.30, 180);
  await cropZone('reproduce_dot_tap_left', 0.35, 0.50, 180);
  await cropZone('reproduce_dot_tap_right', 0.65, 0.50, 180);
  await cropZone('reproduce_slow_vertical_stroke', 0.50, 0.50, 220);
  await cropZone('reproduce_short_diagonal', 0.70, 0.15, 220);

  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    killServer();
    console.log('=== Reproduction Capture Finished ===');
  }
}

runReproduction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reproduction failed:', err);
    process.exit(1);
  });
