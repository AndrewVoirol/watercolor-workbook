import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function testAllPigmentsAndSpeeds() {
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
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const port = process.env.PORT || 5190;
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Helper to draw varied speed strokes: slow, medium, fast, very fast, and cursive turns
  async function drawSpeedSuite(startX, startY, pigmentIndex) {
    // 1. Select Pigment
    const btn = await page.$(`button.pigment-btn[data-id="${pigmentIndex}"]`);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(100);
    }

    // 1a. Very fast long flick (500px in 5 steps = 100px/step at 16ms = 6250 px/sec!)
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'left' });
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(16);
      await page.mouse.move(startX + i * 35, startY - i * 15);
    }
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(100);

    // 1b. Fast sharp-turning cursive loop (zig-zag / loop)
    await page.mouse.move(startX, startY + 60);
    await page.mouse.down({ button: 'left' });
    const angles = [0, Math.PI * 0.4, Math.PI * 0.9, Math.PI * 1.4, Math.PI * 1.8, Math.PI * 2.2];
    for (const a of angles) {
      await page.waitForTimeout(16);
      await page.mouse.move(startX + 40 + Math.cos(a) * 35, startY + 95 + Math.sin(a) * 35);
    }
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(100);

    // 1c. Fast vertical plunge
    await page.mouse.move(startX + 120, startY - 20);
    await page.mouse.down({ button: 'left' });
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(16);
      await page.mouse.move(startX + 120, startY - 20 + i * 25);
    }
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(100);
  }

  // Draw 5 pigments across the canvas:
  // 0: Sumi (Black) at x=150
  // 1: Shu (Cinnabar Red) at x=400
  // 2: Ai (Indigo) at x=650
  // 3: Ōdo (Ochre) at x=900
  // 4: Rokushō (Malachite) at x=1150
  console.log('Testing Sumi (0) multi-speed...');
  await drawSpeedSuite(140, 300, 0);

  console.log('Testing Shu (1 - Cinnabar) multi-speed...');
  await drawSpeedSuite(380, 300, 1);

  console.log('Testing Ai (2 - Indigo) multi-speed...');
  await drawSpeedSuite(620, 300, 2);

  console.log('Testing Ōdo (3 - Ochre) multi-speed...');
  await drawSpeedSuite(860, 300, 3);

  console.log('Testing Rokushō (4 - Malachite) multi-speed...');
  await drawSpeedSuite(1100, 300, 4);

  await page.waitForTimeout(2000);
  const screenshotPath = path.join(projectRoot, 'screenshots', '09_all_pigments_speed_matrix.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to: ${screenshotPath}`);

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  } else {
    console.log('PASSED: 0 console errors during multi-pigment speed matrix test.');
  }

  await browser.close();
}

testAllPigmentsAndSpeeds().catch(console.error);
