import { chromium } from 'playwright';

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
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5183');
  await page.waitForTimeout(1000);

  // 1. Click Clear
  await page.click('button:has-text("清拭 Clear")');
  await page.waitForTimeout(400);

  // 2. Draw a complete calligraphy character (永 - Ei, the classic 8 calligraphic strokes)
  // Stroke 1: Top dot (Dot / Ten)
  await page.mouse.move(720, 220);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(735, 250);
  await page.waitForTimeout(30);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 2: Horizontal beam (Yokoga)
  await page.mouse.move(580, 290);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 15; i++) {
    await page.mouse.move(580 + i * 18, 290 - Math.sin((i / 15) * Math.PI) * 8);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 3: Central vertical trunk with hook (Tategaki + Hane)
  await page.mouse.move(720, 280);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(720, 280 + i * 16);
    await page.waitForTimeout(16);
  }
  // Hook flick left-up
  for (let i = 0; i <= 6; i++) {
    await page.mouse.move(720 - i * 12, 600 - i * 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 4: Upper-left sweep (Hidari Harai)
  await page.mouse.move(700, 370);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 12; i++) {
    await page.mouse.move(700 - i * 18, 370 + i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 5: Lower-left flick (Chou)
  await page.mouse.move(520, 520);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(520 + i * 16, 520 - i * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 6: Upper-right slash (Tegi)
  await page.mouse.move(740, 420);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(740 + i * 18, 420 - i * 12);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(100);

  // Stroke 7: Lower-right downward sweep (Migi Harai)
  await page.mouse.move(750, 430);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 16; i++) {
    await page.mouse.move(750 + i * 18, 430 + i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });

  // Wait 3 seconds for physical resting & capillary settling
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/Users/andrewvoirol/Antigravity/Projects/watercolor-workbook/chapter-1/screenshots/fresh_calligraphy_verified.png' });
  console.log('Saved fresh_calligraphy_verified.png');

  await browser.close();
}

main().catch(console.error);
