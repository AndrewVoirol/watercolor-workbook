const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const recDir = path.resolve('.studio/tmp/recordings');
  if (!fs.existsSync(recDir)) {
    fs.mkdirSync(recDir, { recursive: true });
  } else {
    const existing = fs.readdirSync(recDir);
    for (const f of existing) {
      try { fs.unlinkSync(path.join(recDir, f)); } catch {}
    }
  }

  const port = fs.existsSync('.studio/dev_server.port') 
    ? fs.readFileSync('.studio/dev_server.port', 'utf8').trim() 
    : '3000';
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;
  console.log(`[RECORD] Launching Playwright Chromium targeting ${appUrl}...`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-unsafe-webgpu', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1, // MUST be 1 for canvas apps
    recordVideo: { dir: '.studio/tmp/recordings/', size: { width: 1920, height: 1080 } }
  });

  const page = await context.newPage();
  const video_start_epoch_ms = Date.now();
  console.log(`[RECORD] video_start_epoch_ms = ${video_start_epoch_ms}`);

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  console.log(`[RECORD] Page loaded. Injecting capture_script.js...`);

  const scriptContent = fs.readFileSync('.studio/capture_script.js', 'utf8');
  await page.evaluate(scriptContent);

  console.log(`[RECORD] Waiting for capture completion (max 65s)...`);
  await page.waitForFunction(() => window.__studio_capture_complete === true, { timeout: 65000 });

  const markers = await page.evaluate(() => window.__studio_markers || []);
  console.log(`[RECORD] Capture complete. Captured ${markers.length} markers:`, markers.map(m => m.name));

  // Small delay before closing context to ensure final frames are flushed to WebM
  await page.waitForTimeout(500);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync('.studio/tmp/recordings');
  if (files.length > 0) {
    const rawPath = path.resolve('.studio/raw_screencast.webm');
    fs.copyFileSync(path.join('.studio/tmp/recordings', files[0]), rawPath);
    console.log(`[RECORD] Video copied to ${rawPath}, size: ${fs.statSync(rawPath).size} bytes`);
  }

  const timelinePath = path.resolve('.studio/capture_timeline.json');
  fs.writeFileSync(timelinePath, JSON.stringify({
    video_start_epoch_ms,
    recording_file: '.studio/raw_screencast.webm',
    markers
  }, null, 2));

  console.log(`[RECORD] Timeline written to ${timelinePath}`);
  console.log('RECORDING_COMPLETE');
})();
