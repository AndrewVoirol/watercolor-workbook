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

  // 1. High-Velocity Acceleration Burst in Middle (Testing 0 Velocity Blooming)
  console.log('Testing high-velocity burst strokes...');
  await page.mouse.move(250, 160);
  await page.mouse.down({ button: 'left' });
  for (let x = 250; x <= 400; x += 15) {
    await page.mouse.move(x, 160);
    await page.waitForTimeout(16);
  }
  // High-speed burst
  for (let x = 400; x <= 850; x += 90) {
    await page.mouse.move(x, 160);
    await page.waitForTimeout(16);
  }
  for (let x = 850; x <= 1100; x += 20) {
    await page.mouse.move(x, 160);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 2. Straight horizontal line with uniform speed (Testing tip-down & tip-up)
  console.log('Testing straight lines for tip-down and tip-up...');
  await page.mouse.move(300, 240);
  await page.mouse.down({ button: 'left' });
  for (let x = 300; x <= 1000; x += 25) {
    await page.mouse.move(x, 240);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 3. Vertical plunge lines
  await page.mouse.move(200, 330);
  await page.mouse.down({ button: 'left' });
  for (let y = 330; y <= 630; y += 25) {
    await page.mouse.move(200, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.mouse.move(320, 330);
  await page.mouse.down({ button: 'left' });
  for (let y = 330; y <= 630; y += 25) {
    await page.mouse.move(320, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 4. Diagonal strokes (Crossing lines)
  await page.mouse.move(380, 620);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 24; i++) {
    await page.mouse.move(380 + i * 26, 620 - i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.mouse.move(460, 650);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 22; i++) {
    await page.mouse.move(460 + i * 25, 650 - i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 5. Cursive "200" / loops
  console.log('Testing cursive loops...');
  await page.mouse.move(1050, 420);
  await page.mouse.down({ button: 'left' });
  const cursiveSteps = [
    [1080, 370], [1120, 360], [1150, 390], [1120, 460], [1050, 560], [1160, 560]
  ];
  for (const [cx, cy] of cursiveSteps) {
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(25);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.mouse.move(1220, 460);
  await page.mouse.down({ button: 'left' });
  for (let a = 0; a <= Math.PI * 2.1; a += 0.25) {
    await page.mouse.move(1220 + Math.cos(a) * 55, 460 + Math.sin(a) * 55);
    await page.waitForTimeout(20);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.waitForTimeout(1500);
  const screenshotPath1 = path.join(projectRoot, 'screenshots', 'refined_verification_cases.png');
  await page.screenshot({ path: screenshotPath1 });
  console.log(`Saved screenshot to: ${screenshotPath1}`);

  // SUITE 2: Blue Indigo composition matching user screenshot 5
  await page.keyboard.press('Tab'); // focus out
  await page.waitForTimeout(200);
  const clearBtn = await page.$('button.clear-btn, button:has-text("清拭"), button:has-text("Clear")');
  if (clearBtn) {
    await clearBtn.click();
    await page.waitForTimeout(400);
  }

  const aiBtn = await page.$('button.pigment-btn[data-id="2"]');
  if (aiBtn) {
    await aiBtn.click();
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Tab'); // focus in
  await page.waitForTimeout(200);

  console.log('Testing blue indigo linework composition...');
  // Horizontal top line
  await page.mouse.move(250, 180);
  await page.mouse.down({ button: 'left' });
  for (let x = 250; x <= 800; x += 25) {
    await page.mouse.move(x, 180);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Left vertical
  await page.mouse.move(260, 260);
  await page.mouse.down({ button: 'left' });
  for (let y = 260; y <= 560; y += 25) {
    await page.mouse.move(260, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Middle vertical
  await page.mouse.move(450, 300);
  await page.mouse.down({ button: 'left' });
  for (let y = 300; y <= 580; y += 25) {
    await page.mouse.move(450, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Right vertical
  await page.mouse.move(950, 200);
  await page.mouse.down({ button: 'left' });
  for (let y = 200; y <= 650; y += 25) {
    await page.mouse.move(950, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Diagonal 1
  await page.mouse.move(220, 680);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 30; i++) {
    await page.mouse.move(220 + i * 26, 680 - i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Diagonal 2
  await page.mouse.move(650, 580);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(650 + i * 25, 580 - i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  await page.waitForTimeout(1500);
  const screenshotPath2 = path.join(projectRoot, 'screenshots', 'refined_blue_cases.png');
  await page.screenshot({ path: screenshotPath2 });
  console.log(`Saved blue screenshot to: ${screenshotPath2}`);

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  } else {
    console.log('PASSED: 0 console errors.');
  }

  await browser.close();
}

testAllPigmentsAndSpeeds().catch(console.error);
