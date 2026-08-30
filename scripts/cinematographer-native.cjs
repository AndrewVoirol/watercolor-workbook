const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎬 Cinematographer Agent: Parsing native EDL...');
const edl = JSON.parse(fs.readFileSync('screenshots/native_edl.json', 'utf8'));

let filterComplex = '';
let concatInputs = '';

edl.forEach((beat, index) => {
  const { start, end, speed } = beat;
  
  const setpts = `(1.0/${speed})*(PTS-STARTPTS)`;
  filterComplex += `[0:v]trim=start=${start}:end=${end},setpts=${setpts},setsar=1[v${index}];\n`;
  concatInputs += `[v${index}]`;
});

filterComplex += `${concatInputs}concat=n=${edl.length}:v=1:a=0[outv]`;

console.log('Rendering Native Cinematic to FFmpeg...');
const cmd = `ffmpeg -y -i screenshots/native_raw.webm -filter_complex "${filterComplex.trim()}" -map "[outv]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p screenshots/native_cinematic.mp4`;

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Cinematic render complete: screenshots/native_cinematic.mp4');
} catch (e) {
  console.error('FFmpeg render failed', e);
  process.exit(1);
}
