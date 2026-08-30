const { chromium } = require('playwright');
const fs = require('fs');

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
  console.log('🏛️ THE TRUE COLOSSEUM: Script starting...');
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
  // BEAT 1: Drawing 水 (Mizu - Water) via UI
  // ==========================================
  const t0 = currentTime;
  console.log('Beat 1: Setting Dilution and Drawing Mizu');
  
  // Physically manipulate UI
  await page.click('.pigment-btn'); // Default first is Black
  await page.evaluate(() => {
    const slider = document.querySelector('#slider-dilution');
    if(slider) {
      slider.value = 0.50; // Medium ink
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Stroke 1: Vertical center with hook
  const s1 = generateBezierPoints({x: 0.5, y: 0.2}, {x: 0.5, y: 0.5}, {x: 0.5, y: 0.7}, {x: 0.45, y: 0.75}, 120, 0.8, 0.3);
  await dispatchPointerStroke(page, s1);
  await sleep(500);

  // Stroke 2: Left angular
  const s2 = generateBezierPoints({x: 0.35, y: 0.4}, {x: 0.4, y: 0.45}, {x: 0.3, y: 0.6}, {x: 0.25, y: 0.65}, 90, 0.5, 0.8);
  await dispatchPointerStroke(page, s2);
  await sleep(500);
  
  // Stroke 3: Right angular
  const s3 = generateBezierPoints({x: 0.65, y: 0.4}, {x: 0.6, y: 0.5}, {x: 0.75, y: 0.65}, {x: 0.8, y: 0.7}, 100, 0.6, 0.9);
  await dispatchPointerStroke(page, s3);
  
  await sleep(2500);
  const t1 = currentTime;
  edl.push({ start: t0, end: t1, speed: 1.0, zoom: 1.0, x: 0.5, y: 0.5 }); 

  // ==========================================
  // BEAT 2: Capillary Bloom Intersection via UI
  // ==========================================
  console.log('Beat 2: Red Capillary Bloom via UI');
  
  // Click Red pigment
  const pigments = await page.$$('.pigment-btn');
  if(pigments.length > 1) await pigments[1].click();

  // Max out dilution via slider for huge bloom
  await page.evaluate(() => {
    const slider = document.querySelector('#slider-dilution');
    if(slider) {
      slider.value = 0.98; // Very wet
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Strike across the left stroke! (x:0.35, y:0.45)
  const s4 = generateBezierPoints({x: 0.2, y: 0.5}, {x: 0.3, y: 0.45}, {x: 0.4, y: 0.4}, {x: 0.45, y: 0.45}, 60, 0.7, 0.3);
  await dispatchPointerStroke(page, s4);
  
  // Wait for the bloom
  await sleep(7000);
  const t2 = currentTime;
  edl.push({ start: t1, end: t2, speed: 0.5, zoom: 1.6, x: 0.35, y: 0.45 });

  // ==========================================
  // BEAT 3: Gravity Cascade via UI Gimbal
  // ==========================================
  console.log('Beat 3: Gravity Cascade via Gimbal UI');
  
  // Actually click the physical Gimbal UI at the bottom edge to simulate extreme tilt
  const gimbal = await page.$('#tilt-gimbal-disc');
  if(gimbal) {
    const box = await gimbal.boundingBox();
    // Click at the very bottom center of the gimbal circle
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 5);
  } else {
    console.error('Gimbal UI not found!');
  }

  // Watch the gravity take hold
  await sleep(5000);
  
  // Exactly 30s
  const remainingTime = 30000 - (currentTime * 1000);
  if (remainingTime > 0) await sleep(remainingTime);
  
  const t3 = currentTime;
  edl.push({ start: t2, end: t3, speed: 2.0, zoom: 1.0, x: 0.5, y: 0.5 }); 

  console.log(`Choreography complete. Total Time: ${currentTime}s`);
  await sleep(1000); // Final rest
  
  // Rename webm
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  
  fs.writeFileSync('screenshots/v3_edl.json', JSON.stringify(edl, null, 2));
  fs.renameSync(videoPath, 'screenshots/v3_raw.webm');
  console.log('✅ Captured v3_raw.webm');
})();
