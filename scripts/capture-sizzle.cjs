const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateBezierPoints(p0, p1, p2, p3, steps, pressureStart, pressureEnd) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    let x = u*u*u * p0.x + 3 * u*u * t * p1.x + 3 * u * t*t * p2.x + t*t*t * p3.x;
    let y = u*u*u * p0.y + 3 * u*u * t * p1.y + 3 * u * t*t * p2.y + t*t*t * p3.y;
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
  const edl = []; 
  let currentTime = 0;

  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 30000 });
  console.log('WebGPU Ready!');
  
  const dispatchPointerStroke = async (page, points) => {
    if (points.length === 0) return;
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    
    const startP = points[0];
    await page.mouse.move(box.x + startP.x * box.width, box.y + startP.y * box.height);
    await page.mouse.down();
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      await page.mouse.move(box.x + p.x * box.width, box.y + p.y * box.height, { steps: 1 });
      await page.evaluate(({ pressure }) => {
        if (window.__SCENE_API__ && window.__SCENE_API__.setBrushPressure) window.__SCENE_API__.setBrushPressure(pressure);
      }, { pressure: p.pressure });
      await new Promise(r => setTimeout(r, p.dwellMs));
      currentTime += p.dwellMs / 1000;
    }
    await page.mouse.up();
  };

  const sleep = ms => { currentTime += ms/1000; return new Promise(r => setTimeout(r, ms)); };

  // ==========================================
  // BEAT 1: The Foundation (0s - T1)
  // ==========================================
  const t0 = currentTime;
  console.log('Beat 1: Sumi S-Curve Wash');
  await page.evaluate(() => {
    document.querySelectorAll('.pigment-btn')[0].click(); // Sumi
    document.querySelectorAll('.brush-stand-btn')[2].click(); // Hake
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.95, 40); // Max water
  });

  const baseWash = generateBezierPoints({x: 0.2, y: 0.2}, {x: 0.8, y: 0.3}, {x: 0.2, y: 0.7}, {x: 0.8, y: 0.8}, 120, 0.6, 0.9);
  await dispatchPointerStroke(page, baseWash);
  await sleep(1500); // Settle
  const t1 = currentTime;
  edl.push({ start: t0, end: t1, speed: 1.0, zoom: 1.0, x: 0.5, y: 0.5 });

  // ==========================================
  // BEAT 2: The Capillary Bleed (T1 - T2)
  // ==========================================
  console.log('Beat 2: Shu Intersection Zoom');
  await page.evaluate(() => {
    document.querySelectorAll('.pigment-btn')[1].click(); // Shu
    document.querySelectorAll('.brush-stand-btn')[1].click(); // Menso
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.70, 16);
  });

  // Intersects the base wash around x:0.35, y:0.45
  const intersectWash = generateBezierPoints({x: 0.2, y: 0.7}, {x: 0.3, y: 0.5}, {x: 0.4, y: 0.4}, {x: 0.5, y: 0.2}, 90, 0.9, 0.4);
  await dispatchPointerStroke(page, intersectWash);
  await sleep(4000); // Wait for bleed
  const t2 = currentTime;
  edl.push({ start: t1, end: t2, speed: 0.5, zoom: 1.8, x: 0.35, y: 0.45 });

  // ==========================================
  // BEAT 3: The Gravity Cascade (T2 - T3)
  // ==========================================
  console.log('Beat 3: Gravity Tilt Rivulets');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 1; i <= 30; i++) {
      const ease = i/30 < 0.5 ? 4*Math.pow(i/30,3) : 1-Math.pow(-2*(i/30)+2,3)/2;
      if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 80 * ease);
      await sleep(16.6);
    }
  });
  currentTime += 0.5;
  await sleep(5000); // Let rivulets run down
  const t3 = currentTime;
  edl.push({ start: t2, end: t3, speed: 2.0, zoom: 1.0, x: 0.5, y: 0.5 });

  // ==========================================
  // BEAT 4: The Golden Crown (T3 - T4)
  // ==========================================
  console.log('Beat 4: Odo Enso');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 1; i <= 20; i++) {
      if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 80 - 80*(i/20));
      await sleep(16.6);
    }
    document.querySelectorAll('.pigment-btn')[3].click(); // Odo
    document.querySelectorAll('.brush-stand-btn')[0].click(); // Maru
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.50, 24);
  });
  currentTime += 0.3;

  let ensoPoints = [];
  for (let i = 0; i <= 150; i++) {
    const t = i / 150;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    ensoPoints.push({
      x: 0.50 + Math.cos(angle) * 0.3,
      y: 0.50 + Math.sin(angle) * 0.3 * (900/1440),
      pressure: 0.2 + 0.6 * Math.sin(t * Math.PI),
      dwellMs: 16.6
    });
  }
  await dispatchPointerStroke(page, ensoPoints);
  await sleep(2000); // Meditative hold
  const t4 = currentTime;
  edl.push({ start: t3, end: t4, speed: 1.0, zoom: 1.0, x: 0.5, y: 0.5 });

  // Finish
  console.log('Choreography complete. Saving...');
  await sleep(1000);
  await context.close();
  await browser.close();
  
  fs.writeFileSync('screenshots/sizzle_edl.json', JSON.stringify(edl, null, 2));

  const files = fs.readdirSync('screenshots')
    .filter(f => f.endsWith('.webm') && f !== 'sizzle_raw.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join('screenshots', f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
    
  if (files.length > 0) fs.renameSync(path.join('screenshots', files[0].name), path.join('screenshots', 'sizzle_raw.webm'));
})();
