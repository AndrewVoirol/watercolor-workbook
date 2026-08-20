import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
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
    viewport: { width: 1200, height: 750 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5183');
  await page.waitForTimeout(1000);

  // Clear canvas
  await page.click('button:has-text("清拭 Clear")');
  await page.waitForTimeout(300);

  // 1. Single click tap (50ms)
  await page.mouse.move(300, 200);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(50);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 2. Click and hold (300ms stationary)
  await page.mouse.move(500, 200);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(300);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 3. Crossing strokes
  await page.mouse.move(200, 400);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(200 + i * 20, 400 + (i > 10 ? (i - 10) * 15 : -(i) * 10));
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Intersecting stroke
  await page.mouse.move(250, 300);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(250 + i * 15, 300 + i * 15);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(500);

  // 4. Fast flick
  await page.mouse.move(700, 450);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 8; i++) {
    await page.mouse.move(700 + i * 40, 450 - i * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });

  // Wait 3 seconds for simulation capillary settling
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/Users/andrewvoirol/Antigravity/Projects/watercolor-workbook/chapter-1/screenshots/interactive_behavior_test.png' });
  console.log('Saved screenshots/interactive_behavior_test.png');

  await browser.close();
}

main().catch(console.error);
