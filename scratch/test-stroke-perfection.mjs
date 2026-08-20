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

  // 1. Maru-fude at 50% dilution
  await page.click('button:has-text("清拭 Clear")');
  await page.waitForTimeout(300);

  // Stroke A: Horizontal sweeping stroke
  await page.mouse.move(250, 250);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(250 + i * 25, 250 + Math.sin((i / 20) * Math.PI) * 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // Stroke B: Diagonal flick
  await page.mouse.move(300, 450);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 15; i++) {
    await page.mouse.move(300 + i * 25, 450 - i * 18);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 2. High Dilution (80% Lush Bloom) - verify zero concentric rings / beads
  await page.$eval('#slider-dilution', (el) => {
    el.value = '0.8';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(200);

  // Stroke C: High-dilution curved stroke
  await page.mouse.move(700, 350);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    await page.mouse.move(700 + t * 350, 350 + Math.sin(t * Math.PI) * 80);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(200);

  // 3. Menso Fine Liner
  await page.click('button:has-text("面相筆 Menso")');
  await page.waitForTimeout(200);

  // Stroke D: Sinuous curved Menso line
  await page.mouse.move(250, 600);
  await page.mouse.down({ button: 'left' });
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    await page.mouse.move(250 + t * 500, 600 - Math.sin(t * Math.PI * 2) * 50);
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button: 'left' });

  // Wait 3 seconds for physical settling & capillary diffusion
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/Users/andrewvoirol/Antigravity/Projects/watercolor-workbook/chapter-1/screenshots/stroke_perfection_verified.png' });
  console.log('Saved stroke_perfection_verified.png');

  await browser.close();
}

main().catch(console.error);
