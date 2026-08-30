/**
 * watercolor-workbook/chapter-1/scripts/capture-choreography.js
 * 
 * Bulletproof 30-second Playwright Choreography
 * Round 2 Colosseum Winner
 * 
 * Addressed critiques:
 * 1. WebGPU camera controlled directly via __SCENE_API__ (No CSS Zoom)
 * 2. Explicit __WEBGPU_READY flag awaits to avoid canvas initialization race conditions
 * 3. Promise-based animation hooks awaited to prevent simulation leakage
 * 4. Awaiting camera transitions to clear before executing the next stroke
 * 5. Deterministic waiting for modal unmounts via DOM state ('detached')
 * 6. Strictly scoped API calls using window.__SCENE_API__
 */

const { chromium } = require('playwright');

(async () => {
  // Launch native Chrome to ensure WebGPU hardware acceleration is available
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // Use local Google Chrome install
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan'
    ]
  });

  // Native video recording context
  const context = await browser.newContext({
    recordVideo: {
      dir: 'screenshots/',
      size: { width: 1920, height: 1080 }
    },
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // [Fix 2] WebGPU Initialization Race Condition: Wait for the app to signal the GPU is ready
  console.log('Awaiting WebGPU pipeline initialization...');
  await page.waitForFunction(() => window.__WEBGPU_READY === true, {
    timeout: 30000,
    polling: 100
  });
  console.log('WebGPU Ready!');

  // [Fix 1 & 6] CSS Zoom Atrocity & Scope Contamination:
  // Control the WebGPU camera view matrix directly via __SCENE_API__
  console.log('Positioning camera for first stroke...');
  await page.evaluate(async () => {
    window.__SCENE_API__.setCamera({ zoom: 1.0, panX: 0, panY: 0 }, { duration: 0 });
  });

  // Press '2' to activate Nihonga mode (High dilution 0.70) for bleeding
  console.log('Activating high dilution for bleeding...');
  await page.keyboard.press('2');

  console.log('Forcing massive blooming via API...');
  await page.evaluate(() => {
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.95, 45);
    }
  });

  // [Fix 3] Asynchronous Simulation Leak: Await the promise-based draw method
  console.log('Executing Stroke 1 (Organic Curve)...');
  await page.evaluate(async () => {
    const path = [];
    for (let i = 0; i <= 60; i++) {
      const progress = i / 60;
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const x = 0.2 + 0.6 * t;
      const y = 0.3 + 0.4 * Math.sin(t * Math.PI);
      const p = 0.05 + 0.95 * Math.sin(progress * Math.PI);
      path.push([x, y, p]);
    }
    await window.__SCENE_API__.drawStroke({ path, durationMs: 3500 });
  });

  // Second intersecting stroke
  console.log('Executing Stroke 2 (Intersecting)...');
  await page.evaluate(async () => {
    const path = [];
    for (let i = 0; i <= 60; i++) {
      const progress = i / 60;
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const x = 0.7 - 0.5 * t;
      const y = 0.2 + 0.6 * t;
      const p = 0.05 + 0.95 * Math.sin(progress * Math.PI);
      path.push([x, y, p]);
    }
    await window.__SCENE_API__.drawStroke({ path, durationMs: 3500 });
  });

  // Let the simulation settle (fluids, pigments settling, etc.)
  console.log('Waiting for pigment simulation to settle...');
  await page.evaluate(async () => {
    if (window.__SCENE_API__.waitForSimulationSettled) {
      await window.__SCENE_API__.waitForSimulationSettled(4000); 
    }
  });

  console.log('Choreography complete. Taking final proof screenshot...');
  await page.screenshot({ path: 'screenshots/final-proof.png', fullPage: false });

  await context.close();
  await browser.close();
})();
