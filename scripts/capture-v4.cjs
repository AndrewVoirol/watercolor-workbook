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
  console.log('🏛️ THE TRUE COLOSSEUM: Validated Kanji Script starting...');
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
  let currentTime = 0;
  const edl = []; 

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
  console.log('Beat 1: Validated Mizu Kanji');
  
  await page.click('.pigment-btn'); 
  await page.evaluate(() => {
    const slider = document.querySelector('#slider-dilution');
    if(slider) {
      slider.value = 0.50; 
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Validated Colosseum Coordinates (Normalized to 1440x900)
  
  // Stroke 1: Center vertical with hook
  const s1 = generateBezierPoints({x: 0.5, y: 0.25}, {x: 0.5, y: 0.5}, {x: 0.5, y: 0.75}, {x: 0.43, y: 0.66}, 100, 0.8, 0.3);
  await dispatchPointerStroke(page, s1);
  await sleep(300);

  // Stroke 2: Left side ('フ' shape)
  const s2 = generateBezierPoints({x: 0.31, y: 0.41}, {x: 0.37, y: 0.41}, {x: 0.43, y: 0.41}, {x: 0.25, y: 0.58}, 80, 0.5, 0.8);
  await dispatchPointerStroke(page, s2);
  await sleep(300);
  
  // Stroke 3: Top right (sweeping down-left)
  const s3 = generateBezierPoints({x: 0.68, y: 0.33}, {x: 0.63, y: 0.38}, {x: 0.58, y: 0.44}, {x: 0.53, y: 0.5}, 60, 0.6, 0.9);
  await dispatchPointerStroke(page, s3);
  await sleep(300);

  // Stroke 4: Bottom right (sweeping down-right)
  const s4 = generateBezierPoints({x: 0.53, y: 0.5}, {x: 0.6, y: 0.58}, {x: 0.67, y: 0.66}, {x: 0.75, y: 0.75}, 70, 0.8, 0.4);
  await dispatchPointerStroke(page, s4);
  
  await sleep(1500);
  const t1 = currentTime;
  edl.push({ start: t0, end: t1, speed: 1.0 }); 

  // ==========================================
  // BEAT 2: Capillary Bloom & CSS Zoom
  // ==========================================
  console.log('Beat 2: Red Capillary Bloom & Smooth CSS Zoom');
  
  const pigments = await page.$$('.pigment-btn');
  if(pigments.length > 1) await pigments[1].click();

  await page.evaluate(() => {
    const slider = document.querySelector('#slider-dilution');
    if(slider) {
      slider.value = 0.98; // Very wet for bloom
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // CSS Zoom IN
  await page.evaluate(() => {
    document.body.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    document.body.style.transformOrigin = '40% 50%'; // Zoom on the left-center of the Kanji
    document.body.style.transform = 'scale(1.4)';
  });

  // Strike across the left stroke
  const s5 = generateBezierPoints({x: 0.2, y: 0.55}, {x: 0.3, y: 0.5}, {x: 0.4, y: 0.45}, {x: 0.45, y: 0.45}, 60, 0.7, 0.3);
  await dispatchPointerStroke(page, s5);
  
  // Wait for the bloom to occur on screen
  await sleep(6000);
  
  // CSS Zoom OUT
  await page.evaluate(() => {
    document.body.style.transform = 'scale(1.0)';
  });
  await sleep(2000); // Wait for zoom out transition

  const t2 = currentTime;
  edl.push({ start: t1, end: t2, speed: 0.5 }); // Slow down the bloom in FFmpeg

  // ==========================================
  // BEAT 3: Gravity Cascade via UI Gimbal
  // ==========================================
  console.log('Beat 3: Gravity Cascade via Gimbal UI');
  
  const gimbal = await page.$('#tilt-gimbal-disc');
  if(gimbal) {
    const box = await gimbal.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 5);
  }

  // Watch the gravity take hold
  await sleep(4000);
  
  // Exactly 30s
  const remainingTime = 30000 - (currentTime * 1000);
  if (remainingTime > 0) await sleep(remainingTime);
  
  const t3 = currentTime;
  edl.push({ start: t2, end: t3, speed: 2.0 }); 

  console.log(`Choreography complete. Total Time: ${currentTime}s`);
  await sleep(1000); 
  
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  
  fs.writeFileSync('screenshots/v4_edl.json', JSON.stringify(edl, null, 2));
  fs.renameSync(videoPath, 'screenshots/v4_raw.webm');
  console.log('✅ Captured v4_raw.webm');
})();
