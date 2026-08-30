const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎬 Cinematographer Agent: Parsing Spatial Metadata EDL...');
const edl = JSON.parse(fs.readFileSync('screenshots/edl.json', 'utf8'));

// Find the zoom events
const zoomIn = edl.find(e => e.level === 1.8);
const zoomOut = edl.find(e => e.level === 1.0);

console.log(`Detected Capillary Action at t=${zoomIn.time.toFixed(1)}s. Targeting coordinates [x:${zoomIn.x}, y:${zoomIn.y}]`);
console.log(`Detected Gravity Tilt at t=${zoomOut.time.toFixed(1)}s. Re-centering...`);

// We'll use simple trim and crop filters to demonstrate the EDL-driven edit
// Segments:
// 1. 0s to 3s (1x speed, normal crop)
// 2. 3s to 8.5s (0.5x speed, cropped to intersection)
// 3. 8.5s to 15s (2x speed, normal crop for tilt)

const zoomX = Math.floor(1440 * zoomIn.x - (1440 / 1.8) / 2);
const zoomY = Math.floor(900 * zoomIn.y - (900 / 1.8) / 2);
const zoomW = Math.floor(1440 / 1.8);
const zoomH = Math.floor(900 / 1.8);

const filterComplex = `
  [0:v]trim=start=0:end=${zoomIn.time},setpts=PTS-STARTPTS[v1];
  [0:v]trim=start=${zoomIn.time}:end=${zoomOut.time},setpts=2.0*(PTS-STARTPTS),crop=${zoomW}:${zoomH}:${zoomX}:${zoomY},scale=1440:900[v2];
  [0:v]trim=start=${zoomOut.time}:end=15,setpts=0.5*(PTS-STARTPTS)[v3];
  [v1][v2][v3]concat=n=3:v=1:a=0[outv]
`;

console.log('Rendering targeted EDL to FFmpeg...');
const cmd = `ffmpeg -y -i screenshots/organic.webm -filter_complex "${filterComplex.trim()}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p screenshots/organic-cinematic.mp4`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Cinematic render complete: screenshots/organic-cinematic.mp4');
} catch (e) {
  console.error('FFmpeg render failed', e);
}
