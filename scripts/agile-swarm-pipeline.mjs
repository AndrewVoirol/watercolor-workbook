import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

const W = 1440;
const H = 900;
const FPS = 60;
const TOTAL_FRAMES = 1800; // 30 seconds

console.log('🌐 [Agile Swarm] Booting Native Optics Pipeline...');

// Mathematical Bezier Spline to allow organic "model judgments" on stroke pressure and path
function getBezier(t, p0, p1, p2) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * p0.x + 2 * u * t * p1.x + tt * p2.x,
    y: uu * p0.y + 2 * u * t * p1.y + tt * p2.y
  };
}

// Easing function for pressure (tapers off at the ends like a real brush)
function easePressure(t, maxP) {
  return maxP * Math.sin(t * Math.PI);
}

const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

async function runPipeline() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gpu-in-tests',
      '--enable-features=Vulkan,DefaultANGLEVulkan,Metal',
      '--use-angle=metal',
      '--enable-dawn-features=allow_unsafe_apis',
      '--ignore-gpu-blocklist'
    ]
  });

  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('🔍 [SWE Agent] Loading UI & Injecting Native Optics...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WEBGPU_READY === true, { timeout: 30000 });
  
  // Hide UI (Focus Mode) and setup Native Camera
  await page.evaluate(() => {
    // Click the Zen Focus button to hide all UI elements as instructed by Visual Critic
    const btnFocus = document.querySelector('#btn-focus');
    if (btnFocus) btnFocus.click();

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.transformOrigin = '0 0';
      canvas.style.willChange = 'transform';
      document.body.style.overflow = 'hidden';
      document.body.style.backgroundColor = '#1a1a1a';
    }
  });

  await page.evaluate((fps) => {
    window.__FRAME_TIME__ = 1000 / fps;
    window.__VIRTUAL_TIME__ = 0;
    window.__RAF_CALLBACKS__ = [];
    window.requestAnimationFrame = (cb) => {
      window.__RAF_CALLBACKS__.push(cb);
      return window.__RAF_CALLBACKS__.length;
    };
    window.__TICK_FRAME__ = () => {
      window.__VIRTUAL_TIME__ += window.__FRAME_TIME__;
      const callbacks = window.__RAF_CALLBACKS__;
      window.__RAF_CALLBACKS__ = [];
      callbacks.forEach(cb => cb(window.__VIRTUAL_TIME__));
    };
  }, FPS);

  console.log('⚙️ [Empirical Implementer] Spawning Direct FFmpeg pipe...');
  const finalVideoPath = 'screenshots/agile_native_cinematic.mp4';
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', `${FPS}`, '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', finalVideoPath
  ]);

  const movePointer = async (x, y, p, down) => {
    await page.evaluate(({x, y, p, down}) => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const clientX = rect.left + x * rect.width;
      const clientY = rect.top + y * rect.height;
      const evType = down ? 'pointermove' : 'pointerup';
      if (down && !window._pointerWasDown) {
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX, clientY, pressure: p, pointerType: 'pen', bubbles: true }));
        window._pointerWasDown = true;
      }
      canvas.dispatchEvent(new PointerEvent(evType, { clientX, clientY, pressure: p, pointerType: 'pen', bubbles: true }));
      if (!down) window._pointerWasDown = false;
    }, {x, y, p, down});
  };

  const setBrush = async (pigmentIdx, brushIdx, fluidDensity, fluidViscosity) => {
    // Note: Pigment IDs: 0=Sumi, 1=Shu, 2=Ai, 3=Odo, 4=Rokusho, 5=Mizu
    await page.evaluate(({p, b, d, v}) => {
      // Temporarily reveal UI to click buttons if they are hidden
      const palette = document.querySelector('.inkstone-palette-container');
      if (palette) palette.style.display = 'block';
      
      const pBtns = document.querySelectorAll('.pigment-btn');
      if (pBtns[p]) pBtns[p].click();
      
      const bBtns = document.querySelectorAll('.brush-stand-btn');
      if (bBtns[b]) bBtns[b].click();
      
      if (window.__SCENE_API__.setFluidParams) window.__SCENE_API__.setFluidParams(d, v);
      
      // Hide again
      if (palette) palette.style.display = '';
    }, {p: pigmentIdx, b: brushIdx, d: fluidDensity, v: fluidViscosity});
  };

  console.log('🎬 [Director] Executing SME Choreography: Organic Kanji "Water" (水)');

  let camX = 0.5, camY = 0.5, camZ = 1.0;
  let targetCamX = 0.5, targetCamY = 0.5, targetCamZ = 1.0;

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS; 
    let activeX = 0.5, activeY = 0.5;

    // --- ORGANIC CHOREOGRAPHY ---
    // Stroke 1: Center Hook (Sumi Black, Menso, Thick Ink)
    if (frame === 0) await setBrush(0, 1, 0.9, 50); // 0 = Sumi! (Fixed from previous run)
    if (t > 0.5 && t < 2.5) {
      const progress = (t - 0.5) / 2.0;
      // Organic curve down and hooking left
      const pos = getBezier(progress, {x:0.5, y:0.2}, {x:0.5, y:0.8}, {x:0.35, y:0.65});
      const pressure = easePressure(progress, 0.8) + 0.1; // Organic brush pressure
      activeX = pos.x; activeY = pos.y;
      await movePointer(activeX, activeY, pressure, true); 
      targetCamX = 0.5; targetCamY = 0.45; targetCamZ = 1.4;
    } else if (Math.abs(t - 2.5) < 0.01) await movePointer(0.4, 0.65, 0, false);

    // Stroke 2: Left Side (Sumi Black, Menso, High Dilution)
    if (Math.abs(t - 4.0) < 0.01) await setBrush(0, 1, 0.3, 10); 
    if (t > 4.0 && t < 5.5) {
      const progress = (t - 4.0) / 1.5;
      const pos = getBezier(progress, {x:0.35, y:0.4}, {x:0.25, y:0.45}, {x:0.15, y:0.55});
      const pressure = easePressure(progress, 0.6) + 0.1;
      activeX = pos.x; activeY = pos.y;
      await movePointer(activeX, activeY, pressure, true); 
      targetCamX = 0.3; targetCamY = 0.45; targetCamZ = 2.0;
    } else if (Math.abs(t - 5.5) < 0.01) await movePointer(0.15, 0.55, 0, false);

    // Stroke 3: Top Right (Shu Red, Menso, Medium Ink)
    if (Math.abs(t - 9.0) < 0.01) await setBrush(1, 1, 0.7, 30); // 1 = Shu Red
    if (t > 9.0 && t < 10.5) {
      const progress = (t - 9.0) / 1.5;
      const pos = getBezier(progress, {x:0.65, y:0.35}, {x:0.7, y:0.32}, {x:0.8, y:0.25});
      const pressure = easePressure(progress, 0.6) + 0.1;
      activeX = pos.x; activeY = pos.y;
      await movePointer(activeX, activeY, pressure, true);
      targetCamX = 0.7; targetCamY = 0.3; targetCamZ = 2.0;
    } else if (Math.abs(t - 10.5) < 0.01) await movePointer(0.8, 0.25, 0, false);

    // Stroke 4: Bottom Right Cross (Sumi Black, Hake Wide Brush, High Dilution)
    // Actually, let's keep it black to be traditional, or red to show mixing. Let's use Sumi (0) but broad brush (2).
    if (Math.abs(t - 13.0) < 0.01) await setBrush(0, 2, 0.3, 10);
    if (t > 13.0 && t < 15.5) {
      const progress = (t - 13.0) / 2.5;
      const pos = getBezier(progress, {x:0.6, y:0.45}, {x:0.65, y:0.55}, {x:0.85, y:0.8});
      const pressure = easePressure(progress, 0.9) + 0.1;
      activeX = pos.x; activeY = pos.y;
      await movePointer(activeX, activeY, pressure, true);
      targetCamX = activeX; targetCamY = activeY; targetCamZ = 2.5;
    } else if (Math.abs(t - 15.5) < 0.01) await movePointer(0.85, 0.8, 0, false);

    // Gravity Tilt & Final Reveal
    if (t >= 17.0 && t < 24.0) {
      const tilt = Math.min((t - 17.0) / 3.0, 1.0);
      await page.evaluate((tilt) => {
        if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 60 * tilt);
      }, tilt);
      targetCamX = 0.65; targetCamY = 0.5 + tilt * 0.2; targetCamZ = 3.0;
    }
    if (Math.abs(t - 24.0) < 0.01) {
       await page.evaluate(() => { if (window.__SCENE_API__.setGravity) window.__SCENE_API__.setGravity(0, 0); });
       targetCamX = 0.5; targetCamY = 0.5; targetCamZ = 1.0;
    }

    // --- APPLY NATIVE OPTICS ---
    camX = lerp(camX, targetCamX, 0.05);
    camY = lerp(camY, targetCamY, 0.05);
    camZ = lerp(camZ, targetCamZ, 0.05);

    await page.evaluate(({x, y, z}) => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const tx = (0.5 - x * z) * 100;
        const ty = (0.5 - y * z) * 100;
        canvas.style.transform = `translate(${tx}%, ${ty}%) scale(${z})`;
      }
    }, {x: camX, y: camY, z: camZ});

    await page.evaluate(() => window.__TICK_FRAME__());
    
    const buffer = await page.screenshot({ type: 'jpeg', quality: 90 });
    ffmpeg.stdin.write(buffer);
    if (frame % 60 === 0) process.stdout.write(`\r[Technical Director] Rendering frame ${frame}/${TOTAL_FRAMES}...`);
  }

  process.stdout.write('\n');
  ffmpeg.stdin.end();
  await new Promise(r => ffmpeg.on('close', r));
  console.log(`✅ [Technical Director] Native optics capture complete: ${finalVideoPath}`);

  await context.close();
  await browser.close();
}

runPipeline();
