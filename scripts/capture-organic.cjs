const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Generates points along a cubic Bezier curve
function generateBezierPoints(p0, p1, p2, p3, steps, pressureStart, pressureEnd) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    let x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    let y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
    
    // Add organic noise to pressure
    const noise = Math.sin(t * Math.PI * 8) * 0.05;
    let pressure = pressureStart + (pressureEnd - pressureStart) * t + noise;

    points.push({ x, y, pressure: Math.max(0.1, Math.min(1.0, pressure)), dwellMs: 16.6 });
  }
  return points;
}

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
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  const edl = []; // Edit Decision List
  let currentTime = 0; // approximate time tracker in seconds

  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for WebGPU readiness
  console.log('Awaiting WebGPU pipeline initialization...');
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 10000 });
  console.log('WebGPU Ready!');
  
  const dispatchPointerStroke = async (page, points) => {
    if (points.length === 0) return;
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    
    // pointerdown
    const startP = points[0];
    await page.mouse.move(box.x + startP.x * box.width, box.y + startP.y * box.height);
    await page.mouse.down();
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      await page.mouse.move(box.x + p.x * box.width, box.y + p.y * box.height, { steps: 1 });
      
      // Inject pressure overriding if API exists
      await page.evaluate(({ px, py, pressure }) => {
        if (window.__SCENE_API__ && window.__SCENE_API__.setBrushPressure) {
          window.__SCENE_API__.setBrushPressure(pressure);
        }
      }, { px: p.x, py: p.y, pressure: p.pressure });
      
      await new Promise(r => setTimeout(r, p.dwellMs || 16.6));
      currentTime += (p.dwellMs || 16.6) / 1000;
    }
    
    await page.mouse.up();
  };

  const sleep = ms => { currentTime += ms/1000; return new Promise(r => setTimeout(r, ms)); };

  // 1. Initial High-Dilution Base (Sumi)
  console.log('Setting High Dilution for Base');
  await page.evaluate(() => {
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 0) tools[0].click(); // Sumi
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.95, 32); // Max water, large brush
    }
  });

  // Base wash curve
  console.log('Drawing Base Wash');
  const baseWash = generateBezierPoints(
    {x: 0.2, y: 0.3}, {x: 0.4, y: 0.2}, {x: 0.6, y: 0.5}, {x: 0.8, y: 0.3},
    90, 0.5, 0.8
  );
  await dispatchPointerStroke(page, baseWash);
  edl.push({ time: currentTime, type: 'action', description: 'Base wash complete' });

  // Wait for pool to settle
  await sleep(1500);

  // 2. Wet-on-Wet Intersection (Shu - Red)
  console.log('Switching to Shu and drawing intersection');
  await page.evaluate(() => {
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 1) tools[1].click(); // Shu
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.60, 16); // Medium water, smaller brush
    }
  });

  const intersectWash = generateBezierPoints(
    {x: 0.3, y: 0.7}, {x: 0.4, y: 0.5}, {x: 0.6, y: 0.2}, {x: 0.7, y: 0.1},
    90, 0.9, 0.4
  );
  
  // Log EDL to tell post-production to ZOOM in on the intersection (approx x: 0.5, y: 0.35)
  edl.push({ time: currentTime, type: 'zoom', x: 0.5, y: 0.35, level: 1.8, duration: 4.0, description: 'Capillary Action Zoom' });
  
  await dispatchPointerStroke(page, intersectWash);
  
  // Dwell to let the capillary bleed happen visibly
  console.log('Dwelling for Capillary Bleed (4s)');
  await sleep(4000);
  
  // 3. Gravity Tilt
  console.log('Applying extreme tilt for rivulets');
  edl.push({ time: currentTime, type: 'zoom', x: 0.5, y: 0.5, level: 1.0, duration: 2.0, description: 'Zoom out for tilt' });
  
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pad = document.querySelector('.tilt-gimbal');
    if (pad) {
      for (let i = 1; i <= 30; i++) {
        const t = i / 30;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 80 * ease); // Extreme gravity
        await sleep(16.6);
      }
    }
  });
  currentTime += 0.5;

  // Let the rivulets run down
  console.log('Dwelling for Rivulets (5s)');
  await sleep(5000);

  // Close everything
  console.log('Choreography complete. Saving video...');
  await sleep(1000);
  await context.close();
  await browser.close();
  
  // Save the EDL
  fs.writeFileSync('screenshots/edl.json', JSON.stringify(edl, null, 2));

  // Find the generated webm in screenshots and rename
  const files = fs.readdirSync('screenshots')
    .filter(f => f.endsWith('.webm') && f !== 'organic.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join('screenshots', f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
    
  if (files.length > 0) {
    fs.renameSync(
      path.join('screenshots', files[0].name),
      path.join('screenshots', 'organic.webm')
    );
  }
})();
