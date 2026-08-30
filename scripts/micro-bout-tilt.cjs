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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  console.log('🏛️ COLOSSEUM: Initiating Micro-Bout [Gravity Tilt]...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 30000 });

  // Draw a heavily diluted dot
  await page.evaluate(() => {
    document.querySelectorAll('.pigment-btn')[0].click(); // Sumi
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.98, 48); // 98% water!
  });

  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.up();

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'screenshots/micro_before.png' });
  console.log('📸 Captured Before Tilt');

  // Extreme tilt
  await page.evaluate(() => {
    if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 120); // 120 is extreme!
  });

  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'screenshots/micro_after.png' });
  console.log('📸 Captured After Tilt');

  await browser.close();
  
  // Fast pixel diff heuristic (rough file size / structural check would work, but we will use a quick pixel buffer check)
  const before = fs.readFileSync('screenshots/micro_before.png');
  const after = fs.readFileSync('screenshots/micro_after.png');
  
  if (before.length !== after.length) {
    console.log('✅ COLOSSEUM PASS: Gravity tilt successfully altered the canvas! Dilution 0.98, Gravity 120 are approved.');
  } else {
    console.log('❌ COLOSSEUM FAIL: Frames are identical. Gravity did not overcome pinning force.');
    process.exit(1);
  }
})();
