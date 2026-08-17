import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function testFastMouse() {
  const port = 5199;
  const viteProcess = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: true
  });

  await new Promise((resolve) => {
    viteProcess.stdout.on('data', (data) => {
      const str = data.toString();
      if (str.includes('localhost:') || str.includes('Local:')) {
        console.log(`Vite dev server active at http://localhost:${port}`);
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gpu-in-tests',
      '--enable-features=Vulkan,DefaultANGLEVulkan,Metal',
      '--use-angle=metal',
      '--enable-dawn-features=allow_unsafe_apis',
      '--ignore-gpu-blocklist',
      '--disable-dawn-features=disallow_unsafe_apis'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();
  page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));

  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fast mouse stroke: move mouse in a quick circle and a fast diagonal line
  // Simulating standard mouse pointer events (which fire every ~16ms with 20-30px jumps)
  console.log('Drawing fast diagonal stroke (40px jumps with 16ms delay)...');
  await page.mouse.move(300, 200);
  await page.mouse.down({ button: 'left' });
  
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await page.mouse.move(300 + i * 40, 200 + i * 40);
  }
  await page.mouse.up({ button: 'left' });

  // Fast vertical line
  console.log('Drawing fast vertical stroke (35px jumps with 16ms delay)...');
  await page.mouse.move(600, 150);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(16);
    await page.mouse.move(600, 150 + i * 35);
  }
  await page.mouse.up({ button: 'left' });

  // Fast cursive loop
  console.log('Drawing fast cursive loop...');
  await page.mouse.move(250, 450);
  await page.mouse.down({ button: 'left' });
  const cx = 350, cy = 550, r = 100;
  for (let a = 0; a <= Math.PI * 2; a += Math.PI / 6) {
    await page.waitForTimeout(16);
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(1500);
  const screenshotPath = path.join(projectRoot, 'screenshots', '08_fast_mouse_test.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to: ${screenshotPath}`);

  await browser.close();
  viteProcess.kill();
}

testFastMouse().catch(console.error);
