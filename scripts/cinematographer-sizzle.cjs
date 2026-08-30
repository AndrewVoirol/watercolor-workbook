const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎬 Cinematographer Agent: Parsing Sizzle EDL...');
const edl = JSON.parse(fs.readFileSync('screenshots/sizzle_edl.json', 'utf8'));

let filterComplex = '';
let concatInputs = '';
const W = 1440;
const H = 900;

edl.forEach((beat, index) => {
  const { start, end, speed, zoom, x, y } = beat;
  
  // Crop coordinates (centered on x,y)
  const cW = Math.floor(W / zoom);
  const cH = Math.floor(H / zoom);
  let cX = Math.floor(W * x - cW / 2);
  let cY = Math.floor(H * y - cH / 2);
  
  // Clamp crops
  cX = Math.max(0, Math.min(cX, W - cW));
  cY = Math.max(0, Math.min(cY, H - cH));

  // PTS multiplier for speed (speed > 1 means shorter PTS -> multiply by 1/speed)
  const setpts = `(1.0/${speed})*(PTS-STARTPTS)`;

  filterComplex += `[0:v]trim=start=${start}:end=${end},setpts=${setpts}`;
  if (zoom !== 1.0) {
    filterComplex += `,crop=${cW}:${cH}:${cX}:${cY},scale=${W}:${H}`;
  }
  filterComplex += `[v${index}];\n`;
  
  concatInputs += `[v${index}]`;
});

filterComplex += `${concatInputs}concat=n=${edl.length}:v=1:a=0[outv]`;

console.log('Rendering Sizzle Reel to FFmpeg...');
const cmd = `ffmpeg -y -i screenshots/sizzle_raw.webm -filter_complex "${filterComplex.trim()}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p screenshots/sizzle_cinematic.mp4`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Cinematic render complete: screenshots/sizzle_cinematic.mp4');
} catch (e) {
  console.error('FFmpeg render failed', e);
  process.exit(1);
}
