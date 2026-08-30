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
    const noise = Math.sin(t * Math.PI * 12) * 0.03;
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
  // BEAT 1: Drawing 水 (Mizu - Water) (0s - 12s)
  // ==========================================
  const t0 = currentTime;
  console.log('Beat 1: Kanji Drawing (Mizu)');
  await page.evaluate(() => {
    document.querySelectorAll('.pigment-btn')[0].click(); // Sumi
    document.querySelectorAll('.brush-stand-btn')[1].click(); // Menso
    // Passed Colosseum physics standard!
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.98, 20); 
  });

  // Stroke 1: Vertical center with hook
  const s1 = generateBezierPoints({x: 0.5, y: 0.2}, {x: 0.5, y: 0.5}, {x: 0.5, y: 0.7}, {x: 0.45, y: 0.75}, 120, 0.8, 0.3);
  await dispatchPointerStroke(page, s1);
  await sleep(500);

  // Stroke 2: Left angular
  const s2 = generateBezierPoints({x: 0.35, y: 0.4}, {x: 0.4, y: 0.45}, {x: 0.3, y: 0.6}, {x: 0.25, y: 0.65}, 90, 0.5, 0.8);
  await dispatchPointerStroke(page, s2);
  await sleep(500);
  
  // Stroke 3: Right angular (two parts combined for simplicity)
  const s3 = generateBezierPoints({x: 0.65, y: 0.4}, {x: 0.6, y: 0.5}, {x: 0.75, y: 0.65}, {x: 0.8, y: 0.7}, 100, 0.6, 0.9);
  await dispatchPointerStroke(page, s3);
  
  await sleep(2500); // Wait for the ink to settle
  const t1 = currentTime;
  edl.push({ start: t0, end: t1, speed: 1.0, zoom: 1.0, x: 0.5, y: 0.5 }); // Ends ~ 10 seconds

  // ==========================================
  // BEAT 2: Capillary Bloom Intersection (10s - 18s)
  // ==========================================
  console.log('Beat 2: Red Capillary Bloom');
  await page.evaluate(() => {
    document.querySelectorAll('.pigment-btn')[1].click(); // Shu
    if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(0.90, 12); 
  });

  // Strike across the left stroke! (x:0.35, y:0.45)
  const s4 = generateBezierPoints({x: 0.2, y: 0.5}, {x: 0.3, y: 0.45}, {x: 0.4, y: 0.4}, {x: 0.45, y: 0.45}, 60, 0.7, 0.3);
  await dispatchPointerStroke(page, s4);
  
  // Wait for the bloom (7 seconds real time)
  await sleep(7000);
  const t2 = currentTime;
  edl.push({ start: t1, end: t2, speed: 0.5, zoom: 1.6, x: 0.35, y: 0.45 }); // Targeted Zoom on Intersection

  // ==========================================
  // BEAT 3: Colosseum-Approved Gravity Cascade (18s - 30s)
  // ==========================================
  console.log('Beat 3: Gravity Cascade');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 1; i <= 30; i++) {
      const ease = i/30 < 0.5 ? 4*Math.pow(i/30,3) : 1-Math.pow(-2*(i/30)+2,3)/2;
      // Using Colosseum-approved Gravity: 120
      if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 120 * ease);
      await sleep(16.6);
    }
  });
  currentTime += 0.5;

  // Wait exactly enough to hit 30 seconds total
  const remainingTime = 30000 - (currentTime * 1000);
  if (remainingTime > 0) {
    await sleep(remainingTime);
  }
  
  const t3 = currentTime;
  edl.push({ start: t2, end: t3, speed: 2.0, zoom: 1.0, x: 0.5, y: 0.5 }); // Speed ramp the drip

  // Finish
  console.log(`Choreography complete. Total Time: ${currentTime}s`);
  await sleep(1000);
  await context.close();
  await browser.close();
  
  fs.writeFileSync('screenshots/kanji_edl.json', JSON.stringify(edl, null, 2));

  const files = fs.readdirSync('screenshots')
    .filter(f => f.endsWith('.webm') && f !== 'kanji_raw.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join('screenshots', f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
    
  if (files.length > 0) fs.renameSync(path.join('screenshots', files[0].name), path.join('screenshots', 'kanji_raw.webm'));
})();
