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
  const edl = [];
  let currentTime = 0;
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 30000 });
  console.log('WebGPU Ready!');

  // Trigger the native D demo
  await page.keyboard.press('D');
  
  // Wait for the Kanji to draw (approx 6 seconds)
  await page.waitForTimeout(6000);
  edl.push({ start: 0, end: 6, speed: 1.0 });
  
  // CSS Zoom IN during Capillary Bleed
  await page.evaluate(() => {
    document.body.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    document.body.style.transformOrigin = '35% 45%';
    document.body.style.transform = 'scale(1.4)';
  });
  
  // Watch capillary bleed for 6 seconds
  await page.waitForTimeout(6000);
  edl.push({ start: 6, end: 12, speed: 0.5 }); // Slow down bloom

  // CSS Zoom OUT during Gravity
  await page.evaluate(() => {
    document.body.style.transform = 'scale(1.0)';
  });
  
  // Watch gravity for 6 seconds
  await page.waitForTimeout(6000);
  edl.push({ start: 12, end: 18, speed: 1.5 }); // Speed up gravity

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  
  fs.writeFileSync('screenshots/native_edl.json', JSON.stringify(edl, null, 2));
  fs.renameSync(videoPath, 'screenshots/native_raw.webm');
  console.log('✅ Captured native_raw.webm');
})();
