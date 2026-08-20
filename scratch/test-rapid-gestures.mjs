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
  await page.goto('http://localhost:5190');
  await page.waitForTimeout(1000);

  // Clear canvas
  await page.click('button:has-text("清拭 Clear")');
  await page.waitForTimeout(300);

  // 1. Menso Fine Liner (Fast zig-zags & rapid loops)
  await page.click('button:has-text("面相筆 Menso")');
  await page.waitForTimeout(200);

  // Fast zig-zag with Menso
  await page.mouse.move(200, 200);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 25; i++) {
    const x = 200 + i * 25;
    const y = 200 + ((i % 2 === 0) ? -40 : 40);
    await page.mouse.move(x, y);
    await page.waitForTimeout(10);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(150);

  // Rapid circle loop with Menso
  await page.mouse.move(350, 450);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const x = 350 + Math.cos(angle) * 80;
    const y = 450 + Math.sin(angle) * 80;
    await page.mouse.move(x, y);
    await page.waitForTimeout(8);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 2. Maru-fude (Sumi & Shu rapid flicks)
  await page.click('button:has-text("丸筆 Maru-fude")');
  await page.waitForTimeout(200);

  // Rapid slash
  await page.mouse.move(600, 300);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 15; i++) {
    await page.mouse.move(600 + i * 35, 300 + i * 20);
    await page.waitForTimeout(12);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(150);

  // Fast curved stroke
  await page.mouse.move(650, 600);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 650 + t * 400;
    const y = 600 - Math.sin(t * Math.PI) * 120;
    await page.mouse.move(x, y);
    await page.waitForTimeout(10);
  }
  await page.mouse.up({ button: 'left' });

  // 3. Red Shu pigment with fast strokes
  await page.click('button[title*="Shu"]');
  await page.waitForTimeout(200);

  await page.mouse.move(800, 200);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 15; i++) {
    await page.mouse.move(800 + i * 25, 200 + (i % 2 === 0 ? 30 : -30));
    await page.waitForTimeout(12);
  }
  await page.mouse.up({ button: 'left' });

  // Wait 3 seconds for physical settling
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/Users/andrewvoirol/Antigravity/Projects/watercolor-workbook/chapter-1/screenshots/rapid_gestures_verified.png' });
  console.log('Saved screenshots/rapid_gestures_verified.png');

  await browser.close();
}

main().catch(console.error);
