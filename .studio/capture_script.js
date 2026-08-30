window.__studio_markers = [];
window.__studio_capture_complete = false;

const mark = (name) => {
  const timestamp = Date.now();
  window.__studio_markers.push({ name, time: timestamp });
  console.log(`[STUDIO_MARKER] ${name} @ ${timestamp}`);
};

function evaluateCatmullRom(points, t) {
  const numSegments = points.length - 1;
  const exactIdx = t * numSegments;
  const i = Math.min(Math.floor(exactIdx), numSegments - 1);
  const u = exactIdx - i;
  
  const pA = points[Math.max(0, i - 1)];
  const pB = points[i];
  const pC = points[Math.min(points.length - 1, i + 1)];
  const pD = points[Math.min(points.length - 1, i + 2)];
  
  const u2 = u * u;
  const u3 = u2 * u;
  
  const v0x = (pC.x - pA.x) * 0.5;
  const v1x = (pD.x - pB.x) * 0.5;
  const x = (2 * pB.x - 2 * pC.x + v0x + v1x) * u3 + (-3 * pB.x + 3 * pC.x - 2 * v0x - v1x) * u2 + v0x * u + pB.x;
  
  const v0y = (pC.y - pA.y) * 0.5;
  const v1y = (pD.y - pB.y) * 0.5;
  const y = (2 * pB.y - 2 * pC.y + v0y + v1y) * u3 + (-3 * pB.y + 3 * pC.y - 2 * v0y - v1y) * u2 + v0y * u + pB.y;
  
  const p = pB.pressure + (pC.pressure - pB.pressure) * u;
  return { x, y, p };
}

class StudioInteractionEngine {
  constructor() {
    this.currentCursorX = window.innerWidth / 2;
    this.currentCursorY = window.innerHeight / 2;
    
    this.cursor = document.createElement('div');
    this.cursor.id = '__studio_cursor';
    this.cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(184, 59, 38, 0.20);
      border: 2px solid #b83b26;
      pointer-events: none;
      z-index: 999999;
      transform: translate(-50%, -50%);
      transition: width 0.15s ease, height 0.15s ease, background 0.15s ease, opacity 0.3s ease;
      will-change: transform;
      box-shadow: 0 0 12px rgba(184, 59, 38, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const dot = document.createElement('div');
    dot.id = '__studio_cursor_dot';
    dot.style.cssText = `
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #b83b26;
    `;
    this.cursor.appendChild(dot);
    document.body.appendChild(this.cursor);
    this.updateCursor(this.currentCursorX, this.currentCursorY);
  }

  updateCursor(x, y) {
    this.currentCursorX = x;
    this.currentCursorY = y;
    this.cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  setCursorDown(isDown) {
    if (isDown) {
      this.cursor.style.background = 'rgba(184, 59, 38, 0.55)';
    } else {
      this.cursor.style.background = 'rgba(184, 59, 38, 0.20)';
    }
  }

  pulseCursor() {
    this.cursor.style.transform = `translate(${this.currentCursorX}px, ${this.currentCursorY}px) translate(-50%, -50%) scale(1.3)`;
    setTimeout(() => {
      this.cursor.style.transform = `translate(${this.currentCursorX}px, ${this.currentCursorY}px) translate(-50%, -50%) scale(1.0)`;
    }, 150);
  }

  hideCursor() {
    this.cursor.style.opacity = '0';
  }

  showCursor() {
    this.cursor.style.opacity = '1';
  }

  async moveCursorTo(targetX, targetY, duration_ms = 250) {
    this.showCursor();
    const startX = this.currentCursorX;
    const startY = this.currentCursorY;
    const start = performance.now();
    
    return new Promise(resolve => {
      const frame = () => {
        const elapsed = performance.now() - start;
        let t = Math.min(1.0, elapsed / duration_ms);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const curX = startX + (targetX - startX) * ease;
        const curY = startY + (targetY - startY) * ease;
        this.updateCursor(curX, curY);
        
        if (t < 1.0) {
          requestAnimationFrame(frame);
        } else {
          this.updateCursor(targetX, targetY);
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  async clickElement(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      console.error(`[StudioInteractionEngine] Element not found: ${selector}`);
      return;
    }
    const rect = el.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    
    await this.moveCursorTo(targetX, targetY, 250);
    this.pulseCursor();
    el.click();
  }

  async drawSplineStroke(waypoints, duration_ms) {
    if (!waypoints || waypoints.length < 2) return;
    const targetEl = document.querySelector('canvas') || window;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scaleX = w / 1920;
    const scaleY = h / 1080;
    
    const p0 = waypoints[0];
    const startX = p0.x * scaleX;
    const startY = p0.y * scaleY;
    await this.moveCursorTo(startX, startY, 250);
    
    this.setCursorDown(true);
    const downOpts = {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pressure: p0.pressure,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
      cancelable: true
    };
    targetEl.dispatchEvent(new PointerEvent('pointerdown', downOpts));
    targetEl.dispatchEvent(new MouseEvent('mousedown', downOpts));
    
    const start = performance.now();
    
    return new Promise(resolve => {
      const frame = () => {
        const elapsed = performance.now() - start;
        let t = Math.min(1.0, elapsed / duration_ms);
        
        const pt = evaluateCatmullRom(waypoints, t);
        const currX = pt.x * scaleX;
        const currY = pt.y * scaleY;
        const currP = pt.p;
        
        this.updateCursor(currX, currY);
        
        const moveOpts = {
          clientX: currX,
          clientY: currY,
          button: 0,
          buttons: 1,
          pressure: currP,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          bubbles: true,
          cancelable: true
        };
        targetEl.dispatchEvent(new PointerEvent('pointermove', moveOpts));
        targetEl.dispatchEvent(new MouseEvent('mousemove', moveOpts));
        
        if (t < 1.0) {
          requestAnimationFrame(frame);
        } else {
          const upOpts = {
            clientX: currX,
            clientY: currY,
            button: 0,
            buttons: 0,
            pressure: 0.0,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            bubbles: true,
            cancelable: true
          };
          targetEl.dispatchEvent(new PointerEvent('pointerup', upOpts));
          targetEl.dispatchEvent(new MouseEvent('mouseup', upOpts));
          this.setCursorDown(false);
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}

async function runCapture() {
  const engine = new StudioInteractionEngine();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  // Wait for all UI components to be fully mounted
  while (!document.querySelector('canvas') || !document.querySelector('.pigment-btn') || !document.querySelector('.tilt-preset-btn') || !document.querySelector('.washi-opt-btn')) {
    await sleep(100);
  }
  
  // Mandatory: Wait for the WebGPU render loop to stabilize
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 2000)));

  // Waypoints definition matching choreography.json
  const ensoWaypoints = [
    { x: 960, y: 324, pressure: 0.90 },
    { x: 1144, y: 458, pressure: 0.82 },
    { x: 1083, y: 677, pressure: 0.68 },
    { x: 822, y: 656, pressure: 0.46 },
    { x: 783, y: 400, pressure: 0.30 },
    { x: 906, y: 330, pressure: 0.22 }
  ];

  const kokoroWaypoints = [
    { x: 691, y: 454, pressure: 0.85 },
    { x: 845, y: 572, pressure: 0.85 },
    { x: 1018, y: 626, pressure: 0.85 },
    { x: 1152, y: 562, pressure: 0.70 },
    { x: 1075, y: 475, pressure: 0.15 }
  ];

  const glazeWaypoints = [
    { x: 922, y: 389, pressure: 0.80 },
    { x: 950, y: 454, pressure: 0.75 },
    { x: 979, y: 508, pressure: 0.60 },
    { x: 998, y: 540, pressure: 0.25 }
  ];

  // --- SCENE 01: ESTABLISHING (1500ms) ---
  mark("scene_01_establishing_start");
  await sleep(1500);
  mark("scene_01_establishing_end");

  // --- SCENE 02: CAUSAL STAGING (2500ms) ---
  mark("scene_02_causal_staging_start");
  // Select Kizuki Kōzo raw mulberry washi substrate
  await engine.clickElement('button.washi-opt-btn[data-id="0"]');
  await sleep(500);
  // Activate 45° steep cascade tilt gimbal (gy = 58 px/s^2)
  await engine.clickElement('button.tilt-preset-btn[data-gy="58"]');
  await sleep(1000);
  // Select initial pigment: Sumi pine-soot black (id = 0)
  await engine.clickElement('button.pigment-btn[data-id="0"]');
  await sleep(1000);
  mark("scene_02_causal_staging_end");

  // --- SCENE 03: MASTER STROKES (14000ms) ---
  mark("scene_03_master_strokes_start");
  // Stroke 1: Sumi black Ensō 360° circular arc at human cadence (3500ms)
  await engine.drawSplineStroke(ensoWaypoints, 3500);
  await sleep(500); // Observe initial wet ink pool deposition
  
  // Switch to Shu cinnabar vermilion
  await engine.clickElement('button.pigment-btn[data-id="1"]');
  await sleep(500);
  
  // Stroke 2: Shu vermilion Kokoro curved belly & leaping hook intersecting wet Sumi pool (3500ms)
  await engine.drawSplineStroke(kokoroWaypoints, 3500);
  await sleep(500); // Observe instant Kubelka-Munk optical subtractive blending
  
  // Switch to Ai fermented indigo blue
  await engine.clickElement('button.pigment-btn[data-id="2"]');
  await sleep(500);
  
  // Stroke 3: Ai indigo focal accent glaze bridging into vermilion and black (3000ms)
  await engine.drawSplineStroke(glazeWaypoints, 3000);
  await sleep(2000); // Allow initial 3-pigment fluid mixing
  mark("scene_03_master_strokes_end");

  // --- SCENE 04: CLIMAX PHYSICS HOLD (9000ms) ---
  mark("scene_04_climax_physics_hold_start");
  engine.hideCursor();
  // ZERO cursor movement. Continuous 9.0s camera hold showcasing WebGPU shallow-water fluid cascades down 45° incline, Darcy capillary wicking, and Fuchidori rim deposition
  await sleep(9000);
  mark("scene_04_climax_physics_hold_end");

  // --- SCENE 05: COOLDOWN (2000ms) ---
  mark("scene_05_cooldown_start");
  await sleep(2000); // Fluid velocities stabilize into contemplative final resting equilibrium
  mark("scene_05_cooldown_end");

  window.__studio_capture_complete = true;
}

runCapture();
