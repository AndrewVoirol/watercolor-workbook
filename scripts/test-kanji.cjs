const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000');
    
    // Wait for the canvas and some initialization time
    await page.waitForTimeout(2000);
    
    const drawStroke = async (points) => {
      if (points.length < 2) return;
      await page.mouse.move(points[0].x, points[0].y);
      await page.mouse.down();
      for (let i = 1; i < points.length; i++) {
        await page.mouse.move(points[i].x, points[i].y, { steps: 10 });
      }
      await page.mouse.up();
      await page.waitForTimeout(100);
    };
    
    // Water Kanji: 水
    
    // Stroke 1: Center vertical, hooked to the left at bottom
    await drawStroke([
      {x: 400, y: 150},
      {x: 400, y: 450},
      {x: 350, y: 400}
    ]);
    
    // Stroke 2: Left side ('フ' shape)
    await drawStroke([
      {x: 250, y: 250},
      {x: 350, y: 250},
      {x: 200, y: 350}
    ]);
    
    // Stroke 3: Top right (sweeping down-left towards center)
    await drawStroke([
      {x: 550, y: 200},
      {x: 430, y: 300}
    ]);
    
    // Stroke 4: Bottom right (sweeping down-right away from center)
    await drawStroke([
      {x: 430, y: 300},
      {x: 600, y: 450}
    ]);
    
    // Ensure directory exists
    const screenshotDir = path.resolve(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    await page.screenshot({ path: path.resolve(screenshotDir, 'kanji_frame.png') });
    console.log("Screenshot saved.");
  } catch (error) {
    console.error("Error drawing kanji:", error);
  } finally {
    await browser.close();
  }
})();
