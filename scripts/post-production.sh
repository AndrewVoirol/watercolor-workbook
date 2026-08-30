#!/bin/bash
# Phase 3: Post-Production Polish
# Applies speed ramps (1x and 4x) and a slow cinematic center zoom.

INPUT="screenshots/masterpiece.webm"
OUTPUT="screenshots/masterpiece-cinematic.mp4"

echo "Applying Phase 3 Post-Production Polish (Speed Ramps & Pan/Zoom)..."

# We split the 30-second video into segments to speed ramp the slow "dwell" periods.
# Segments:
# 1. 0s - 6s: 1x (Base wash and slash)
# 2. 6s - 12s: 4x (Relaxation)
# 3. 12s - 16s: 1x (Tilt and Rokusho flicks)
# 4. 16s - 20s: 4x (Drainage)
# 5. 20s - 31s: 1x (Deluge and Enso)
#
# Then we apply a smooth scale and crop (simulating a zoom) across the concatenated result.

ffmpeg -y -i "$INPUT" -filter_complex "
  [0:v]trim=start=0:end=6,setpts=PTS-STARTPTS[v1];
  [0:v]trim=start=6:end=12,setpts=0.25*(PTS-STARTPTS)[v2];
  [0:v]trim=start=12:end=16,setpts=PTS-STARTPTS[v3];
  [0:v]trim=start=16:end=20,setpts=0.25*(PTS-STARTPTS)[v4];
  [0:v]trim=start=20:end=31,setpts=PTS-STARTPTS[v5];
  [v1][v2][v3][v4][v5]concat=n=5:v=1:a=0[concat_v];
  [concat_v]zoompan=z='min(1.0+0.0005*in_time, 1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1440x900[outv]
" -map "[outv]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "$OUTPUT"

echo "Cinematic masterpiece generated at $OUTPUT"
