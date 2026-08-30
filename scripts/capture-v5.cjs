const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gpu-in-tests',
      '--enable-features=Vulkan,DefaultANGLEVulkan,Metal',
      '--use-angle=metal',
      '--enable-dawn-features=allow_unsafe_apis',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: 'screenshots/', size: { width: 1440, height: 900 } }
  });
  
  const page = await context.newPage();
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 30000 });
  console.log('WebGPU Ready!');

  // Fluid stroke using Playwright's native steps
  const fluidStroke = async (sx, sy, points) => {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (const p of points) {
      await page.mouse.move(p.x, p.y, { steps: p.steps || 20 });
    }
    await page.mouse.up();
    await page.waitForTimeout(300); // Wait between strokes
  };

  const w = 1440;
  const h = 900;

  // Stroke 1: Center hook
  await fluidStroke(w*0.5, h*0.2, [
    {x: w*0.5, y: h*0.8, steps: 40}, 
    {x: w*0.4, y: h*0.75, steps: 15}
  ]);

  // Stroke 2: Left sweep
  await fluidStroke(w*0.4, h*0.4, [
    {x: w*0.25, y: h*0.6, steps: 30}
  ]);

  // Stroke 3: Right top
  await fluidStroke(w*0.6, h*0.35, [
    {x: w*0.53, y: h*0.5, steps: 20}
  ]);

  // Stroke 4: Right bottom
  await fluidStroke(w*0.53, h*0.5, [
    {x: w*0.75, y: h*0.75, steps: 30}
  ]);

  await page.waitForTimeout(3000); // Let it dry/settle

  // Set dilution for bloom
  await page.evaluate(() => {
    const slider = document.querySelector('#slider-dilution');
    if(slider) {
      slider.value = 0.98;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const pigments = await page.$$('.pigment-btn');
  if(pigments.length > 1) await pigments[1].click(); // Red

  // Draw red intersecting stroke (horizontal)
  await fluidStroke(w*0.2, h*0.55, [
    {x: w*0.5, y: h*0.45, steps: 40}
  ]);

  await page.waitForTimeout(5000); // Watch bloom
  
  // Tilt Gimbal
  const gimbal = await page.$('#tilt-gimbal-disc');
  if(gimbal) {
    const box = await gimbal.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 5);
  }

  await page.waitForTimeout(4000); // Watch gravity

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  
  fs.renameSync(videoPath, 'screenshots/v5_raw.webm');
  console.log('✅ Captured v5_raw.webm');
})();
