const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function syncFrameFence(page, frames = 2) {
  await page.evaluate((frameCount) => {
    return new Promise((resolve) => {
      let count = 0;
      function step() {
        count++;
        if (count >= frameCount) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, frames);
}

async function dispatchPointerStroke(page, points, options = {}) {
  const { pressure = 0.75, pointerType = 'pen' } = options;
  
  const [first, ...rest] = points;
  await page.evaluate(({ x, y, pressure, pointerType }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + x * rect.width;
    const clientY = rect.top + y * rect.height;
    
    const ev = new PointerEvent('pointerdown', {
      clientX,
      clientY,
      pressure,
      pointerType,
      bubbles: true,
      cancelable: true
    });
    
    canvas.dispatchEvent(ev);
  }, { x: first.x, y: first.y, pressure, pointerType });

  for (const pt of rest) {
    await page.evaluate(({ x, y, pressure, pointerType }) => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const clientX = rect.left + x * rect.width;
      const clientY = rect.top + y * rect.height;
      
      const ev = new PointerEvent('pointermove', {
        clientX,
        clientY,
        pressure: pressure,
        pointerType,
        bubbles: true,
        cancelable: true
      });
      
      canvas.dispatchEvent(ev);
    }, { x: pt.x, y: pt.y, pressure: pt.pressure ?? pressure, pointerType });

    if (pt.dwellMs) {
      await sleep(pt.dwellMs);
    }
  }

  const last = points[points.length - 1];
  await page.evaluate(({ x, y, pointerType }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + x * rect.width;
    const clientY = rect.top + y * rect.height;
    
    const ev = new PointerEvent('pointerup', {
      clientX,
      clientY,
      pressure: 0.0,
      pointerType,
      bubbles: true,
      cancelable: true
    });
    
    canvas.dispatchEvent(ev);
  }, { x: last.x, y: last.y, pointerType });
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
    deviceScaleFactor: 2,
    recordVideo: {
      dir: 'screenshots/',
      size: { width: 1440, height: 900 }
    }
  });

  const page = await context.newPage();
  
  console.log('Navigating to app...');
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  console.log('Awaiting WebGPU pipeline initialization...');
  await page.waitForFunction(() => window.__WEBGPU_READY === true, {
    timeout: 30000,
    polling: 100
  });
  console.log('WebGPU Ready!');

  // ==========================================
  // 60 FPS Master Timing & Frame Allocation
  // ==========================================
  const intervalMs = 16.666; // approx 1 frame at 60fps
  
  // 00:00.0 - 00:00.2 (Frames 0 - 12) State Init & Canvas Reset
  // Flat (0°), Hake (52px), Dilution 75%, Mizu (Clear Water - id 5)
  console.log('00:00.0 - State Init');
  await page.evaluate(() => {
    const pointerTracker = window.__SCENE_API__?.pointerTracker; // need to ensure it's exposed or click UI
    // In main.ts: Washi/pigment can be set by UI clicks or keyboard if we inject logic,
    // but the easiest is clicking UI. Let's use UI clicks.
    // Or just evaluate if there's no API.
  });
  // Wait, I can simulate UI clicks or try to set them.
  // actually I can set pigment via clicking palette. The IDs are 0: Ai, 1: Shu, 2: Rokusho, 3: Odo, 4: Sumi, 5: Mizu
  await page.evaluate(() => {
    // We can interact with DOM
    // For now we will try to just dispatch events on the canvas
    // Wait, how do I change pigment? main.ts doesn't expose it in __SCENE_API__.
    // Let's click the palette? Or use page.evaluate to trigger the clicks.
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 5) tools[5].click(); // Mizu
    const brushes = document.querySelectorAll('.brush-stand-btn');
    if (brushes.length > 2) brushes[2].click(); // Hake
  });
  // Set Dilution 75% via UI or __SCENE_API__
  await page.evaluate(() => {
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.75, 52);
    }
  });
  await syncFrameFence(page, 12);
  
  // 00:00.2 - 00:01.8 (Frames 12 - 108) Horizontal Base Wash
  // Sweeping path (0.20, 0.45) to (0.80, 0.45), Duration: 1.6s -> 96 frames
  console.log('00:00.2 - Horizontal Base Wash');
  let washPoints = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    washPoints.push({
      x: 0.20 + t * 0.60,
      y: 0.45,
      pressure: 0.75,
      dwellMs: intervalMs
    });
  }
  await dispatchPointerStroke(page, washPoints);
  
  // 00:01.8 - 00:02.8 (Frames 108 - 168) Wet-Bed Stabilization Dwell (1.0s)
  console.log('00:01.8 - Wet-Bed Stabilization Dwell');
  await sleep(1000);
  
  // 00:02.8 - 00:03.0 (Frames 168 - 180) State Mutation: Pigment Select
  // Ai (Fermented Indigo - id 0), Dilution 80%, Single Drop
  console.log('00:02.8 - State Mutation: Pigment Select');
  await page.evaluate(() => {
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 0) tools[2].click(); // Ai
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.80, 52); // Keep brush size or wait, it says single drop, so maybe brush size doesn't matter much for a single touchdown
    }
  });
  await syncFrameFence(page, 12);
  
  // 00:03.0 - 00:03.2 (Frames 180 - 192) Center Droplet Injection
  console.log('00:03.0 - Center Droplet Injection');
  await dispatchPointerStroke(page, [
    { x: 0.50, y: 0.45, pressure: 0.8, dwellMs: 200 }
  ]);
  
  // 00:03.2 - 00:05.0 (Frames 192 - 300) Radial Capillary Bloom Dwell (1.8s)
  console.log('00:03.2 - Radial Capillary Bloom Dwell');
  await sleep(1800);
  
  // 00:05.0 - 00:05.2 (Frames 300 - 312) State Mutation: Tool & Pigment
  // Maru-fude (22px), Dilution 50%, Shu (Cinnabar Vermilion - id 1)
  console.log('00:05.0 - State Mutation: Tool & Pigment');
  await page.evaluate(() => {
    const brushes = document.querySelectorAll('.brush-stand-btn');
    if (brushes.length > 0) brushes[0].click(); // Maru-fude (assuming 0 is Maru)
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 1) tools[1].click(); // Shu
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.50, 22);
    }
  });
  await syncFrameFence(page, 12);
  
  // 00:05.2 - 00:06.5 (Frames 312 - 390) Violent Transverse Slash
  // Diagonal (0.30, 0.25) to (0.70, 0.65), Duration: 1.3s -> 78 frames
  console.log('00:05.2 - Violent Transverse Slash');
  let slashPoints = [];
  for (let i = 0; i <= 78; i++) {
    const t = i / 78;
    slashPoints.push({
      x: 0.30 + t * 0.40,
      y: 0.25 + t * 0.40,
      pressure: 0.85,
      dwellMs: intervalMs
    });
  }
  await dispatchPointerStroke(page, slashPoints);
  
  // 00:06.5 - 00:12.0 (Frames 390 - 720) Optical Relaxation & Settling
  console.log('00:06.5 - Optical Relaxation & Settling (5.5s)');
  await sleep(5500);
  
  // 00:12.0 - 00:12.4 (Frames 720 - 744) Continuous Gravity Tilt Ease
  // Tilt: 0 to 45 degrees
  console.log('00:12.0 - Continuous Gravity Tilt Ease');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pad = document.querySelector('.tilt-gimbal');
    if (pad) {
      // Simulate tilt by dispatching pointer events to tilt pad?
      // Or maybe there is an exposed function. main.ts has tiltPad.onGravityChange
      // Actually tiltPad is internal, let's dispatch events to it
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 58 * ease);
        await sleep(16.6);
      }
      // Also update UI to steep
      const btn = document.querySelector('button.tilt-preset-btn[data-gy="58"]');
      if (btn) btn.click();
    }
  });
  
  // 00:12.4 - 00:15.5 (Frames 744 - 930) Gravity Cascade & Rivulets
  console.log('00:12.4 - Gravity Cascade & Rivulets (3.1s)');
  await sleep(3100);
  
  // 00:15.5 - 00:15.7 (Frames 930 - 942) State Mutation: Tool & Dilution
  // Menso (8px), Dilution 20%, Rokushō (Malachite - id 2)
  console.log('00:15.5 - State Mutation: Tool & Dilution');
  await page.evaluate(() => {
    const brushes = document.querySelectorAll('.brush-stand-btn');
    if (brushes.length > 1) brushes[1].click(); // Menso
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 2) tools[4].click(); // Rokusho
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.20, 8);
    }
  });
  await syncFrameFence(page, 12);
  
  // 00:15.7 - 00:18.5 (Frames 942 - 1110) Upward Dry Flicks (3 Marks)
  // 2.8s -> 168 frames. 3 strokes
  console.log('00:15.7 - Upward Dry Flicks (3 Marks)');
  for (let s = 0; s < 3; s++) {
    let flickPoints = [];
    const sx = s === 0 ? 0.20 : (s === 1 ? 0.25 : 0.75); // unflooded lateral sectors
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      flickPoints.push({
        x: sx + t * 0.05,
        y: 0.60 - t * 0.15, // Upward
        pressure: 0.85 - t * 0.6,
        dwellMs: intervalMs
      });
    }
    await dispatchPointerStroke(page, flickPoints);
    await sleep(200); // Wait between strokes
  }
  
  // 00:18.5 - 00:20.0 (Frames 1110 - 1200) Rivulet Runout & Drainage (1.5s)
  console.log('00:18.5 - Rivulet Runout & Drainage (1.5s)');
  await sleep(1500);
  
  // 00:20.0 - 00:20.3 (Frames 1200 - 1218) Tilt Transition & Tool Switch
  // Tilt: 45 to 15 degrees, Hake (52px), Dilution 85%, Ōdo (Ochre - id 3)
  console.log('00:20.0 - Tilt Transition & Tool Switch');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pad = document.querySelector('.tilt-gimbal');
    if (pad) {
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      for (let i = 1; i <= 18; i++) {
        const t = i / 18;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 58 - 36 * ease);
        await sleep(16.6);
      }
      const btn = document.querySelector('button.tilt-preset-btn[data-gy="22"]');
      if (btn) btn.click();
    }
    const brushes = document.querySelectorAll('.brush-stand-btn');
    if (brushes.length > 2) brushes[2].click(); // Hake
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 3) tools[3].click(); // Odo
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.85, 52);
    }
  });
  await syncFrameFence(page, 18);
  
  // 00:20.3 - 00:22.0 (Frames 1218 - 1320) Top Golden Deluge Wash
  // Sweep (0.10, 0.12) to (0.90, 0.12), Duration: 1.7s -> 102 frames
  console.log('00:20.3 - Top Golden Deluge Wash');
  let topWashPoints = [];
  for (let i = 0; i <= 102; i++) {
    const t = i / 102;
    topWashPoints.push({
      x: 0.10 + t * 0.80,
      y: 0.12,
      pressure: 0.75,
      dwellMs: intervalMs
    });
  }
  await dispatchPointerStroke(page, topWashPoints);
  
  // 00:22.0 - 00:25.0 (Frames 1320 - 1500) Cascading Glaze Downward (3.0s)
  console.log('00:22.0 - Cascading Glaze Downward (3.0s)');
  await sleep(3000);
  
  // 00:25.0 - 00:25.3 (Frames 1500 - 1518) State Mutation: Mode & Pigment
  // Tilt: 15 to 0 degrees, Sumi (id 4, 15% Dilution), Breathe Mode ON
  console.log('00:25.0 - State Mutation: Mode & Pigment');
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pad = document.querySelector('.tilt-gimbal');
    if (pad) {
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      for (let i = 1; i <= 18; i++) {
        const t = i / 18;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 22 - 22 * ease);
        await sleep(16.6);
      }
      const btn = document.querySelector('button.tilt-preset-btn[data-gy="0"]');
      if (btn) btn.click();
    }
    const tools = document.querySelectorAll('.pigment-btn');
    if (tools.length > 4) tools[0].click(); // Sumi
    const breatheBtn = document.querySelector('#btn-breathe');
    if (breatheBtn) breatheBtn.click(); // Breathe Mode ON
    if (window.__SCENE_API__.setFluidParams) {
      window.__SCENE_API__.setFluidParams(0.15, 22); // Revert to Maru size for Enso
    }
  });
  await syncFrameFence(page, 18);
  
  // 00:25.3 - 00:28.0 (Frames 1518 - 1680) Sweeping Ensō Circle
  // Circle center (0.50, 0.50), R = 0.28. 2.7s -> 162 frames
  console.log('00:25.3 - Sweeping Ensō Circle');
  let ensoPoints = [];
  for (let i = 0; i <= 162; i++) {
    const t = i / 162;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    // For a circle that doesn't skew on rect, we use rx and ry considering aspect ratio,
    // assuming width/height = 1440/900 = 1.6
    const ry = 0.28;
    const rx = 0.28 * (900 / 1440);
    const pressure = Math.max(0.18, 0.90 - t * 0.65 + (Math.sin(t * Math.PI * 4) * 0.08));
    ensoPoints.push({
      x: 0.50 + Math.cos(angle) * rx,
      y: 0.50 + Math.sin(angle) * ry,
      pressure: pressure,
      dwellMs: intervalMs
    });
  }
  await dispatchPointerStroke(page, ensoPoints);
  
  // 00:28.0 - 00:29.0 (Frames 1680 - 1740) Ensō Taper & Liftoff Rest
  console.log('00:28.0 - Ensō Taper & Liftoff Rest (1.0s)');
  await sleep(1000);
  
  // 00:29.0 - 00:30.0 (Frames 1740 - 1800) Meditative Fade to Black
  console.log('00:29.0 - Meditative Fade to Black (1.0s)');
  await sleep(1000); // 1.0s fade out in video processing usually, just dwell
  
  // Wait to capture the video final frames before closing
  await sleep(1000);

  // Close everything to dump the video
  console.log('Choreography complete. Saving video...');
  await context.close();
  await browser.close();

  // Find the generated webm in screenshots and rename to masterpiece.webm
  const files = fs.readdirSync('screenshots')
    .filter(f => f.endsWith('.webm') && f !== 'masterpiece.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join('screenshots', f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
    
  if (files.length > 0) {
    fs.renameSync(
      path.join('screenshots', files[0].name),
      path.join('screenshots', 'masterpiece.webm')
    );
  }
})();
