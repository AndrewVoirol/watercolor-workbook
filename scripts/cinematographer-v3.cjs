const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎬 Cinematographer Agent: Parsing v3 EDL...');
const edl = JSON.parse(fs.readFileSync('screenshots/v3_edl.json', 'utf8'));

let filterComplex = '';
let concatInputs = '';
const W = 1440;
const H = 900;

edl.forEach((beat, index) => {
  const { start, end, speed, zoom, x, y } = beat;
  
  const cW = Math.floor(W / zoom);
  const cH = Math.floor(H / zoom);
  let cX = Math.floor(W * x - cW / 2);
  let cY = Math.floor(H * y - cH / 2);
  
  cX = Math.max(0, Math.min(cX, W - cW));
  cY = Math.max(0, Math.min(cY, H - cH));

  const setpts = `(1.0/${speed})*(PTS-STARTPTS)`;

  filterComplex += `[0:v]trim=start=${start}:end=${end},setpts=${setpts}`;
  if (zoom !== 1.0) {
    filterComplex += `,crop=${cW}:${cH}:${cX}:${cY},scale=${W}:${H}`;
  }
  filterComplex += `,setsar=1[v${index}];\n`;
  
  concatInputs += `[v${index}]`;
});

filterComplex += `${concatInputs}concat=n=${edl.length}:v=1:a=0[outv]`;

console.log('Rendering V3 Cinematic to FFmpeg...');
const cmd = `ffmpeg -y -i screenshots/v3_raw.webm -filter_complex "${filterComplex.trim()}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p screenshots/v3_cinematic.mp4`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Cinematic render complete: screenshots/v3_cinematic.mp4');
} catch (e) {
  console.error('FFmpeg render failed', e);
  process.exit(1);
}
