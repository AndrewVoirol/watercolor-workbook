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

  // Focus mode
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);

  console.log('Drawing Maru-fude fast flicks matching user test pattern...');
  
  // 1. Top horizontal stroke with subtle curve
  await page.mouse.move(400, 230);
  await page.mouse.down({ button: 'left' });
  for (let x = 400; x <= 1050; x += 30) {
    const y = 230 + Math.sin((x - 400) / 650 * Math.PI) * 20;
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 2. Fast diagonal flick 1 (left to right up)
  await page.mouse.move(170, 380);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 8; i++) {
    await page.mouse.move(170 + i * 55, 380 - i * 15);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 3. Fast diagonal flick 2
  await page.mouse.move(320, 440);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 8; i++) {
    await page.mouse.move(320 + i * 40, 440 - i * 22);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 4. Middle horizontal flick
  await page.mouse.move(720, 350);
  await page.mouse.down({ button: 'left' });
  for (let x = 720; x <= 1020; x += 35) {
    await page.mouse.move(x, 350);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 5. Short quick dash
  await page.mouse.move(410, 520);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 3; i++) {
    await page.mouse.move(410 + i * 25, 520 - i * 15);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 6. Upward flick
  await page.mouse.move(520, 510);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 6; i++) {
    await page.mouse.move(520 + i * 12, 510 - i * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 7. Long downward diagonal slash
  await page.mouse.move(260, 680);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 12; i++) {
    await page.mouse.move(260 + i * 35, 680 - i * 24);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 8. Right vertical/diagonal flick
  await page.mouse.move(680, 630);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 8; i++) {
    await page.mouse.move(680 + i * 25, 630 - i * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.waitForTimeout(1500);
  const screenshotPath = path.join(projectRoot, 'screenshots', 'refined_maru_flicks.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved full screenshot to: ${screenshotPath}`);

  // Closeup crop of stroke termination (around stroke 2 end: ~610, 260)
  const closeupPath = path.join(projectRoot, 'screenshots', 'stroke_ends_closeup.png');
  await page.screenshot({
    path: closeupPath,
    clip: { x: 500, y: 200, width: 280, height: 160 }
  });
  console.log(`Saved closeup screenshot to: ${closeupPath}`);

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  } else {
    console.log('PASSED: 0 console errors.');
  }

  await browser.close();
}

testAllPigmentsAndSpeeds().catch(console.error);
