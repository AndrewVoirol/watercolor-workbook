# Studio Telemetry — Run 6

## Pipeline Summary
- **Project**: watercolor-zen-webgpu (MUJŌ 無常) — Chapter 1
- **Run**: 6
- **Execution Mode**: Production Showcase (physics_showcase)
- **Start**: 2026-08-30T06:05:00Z
- **End**: 2026-08-30T06:18:00Z
- **Total Duration**: ~13 minutes
- **Archetype**: `2d_canvas_drawing` (WebGPU)
- **Demo Philosophy**: `physics_showcase`
- **Status**: SUCCESS
- **Target URL**: http://localhost:3000

## Subagent Execution Timeline

| Subagent Role | TypeName / Worker | Duration | Status | Primary Output |
|---|---|---|---|---|
| Explorer (Milestone 1) | `explorer_m1_1` | ~2 min | OK | App profile & DOM selectors verified |
| Creative & Pre-Capture Critic (Milestone 2) | `critic_pre_capture_1` | ~3 min | OK | `.studio/choreography.json`, `.studio/edl.yaml`, `.studio/critic_pre_capture.md` (PASS) |
| Browser Operator (Milestone 3) | `worker_capture_1` | ~3 min | OK | `.studio/raw_screencast.webm`, `.studio/capture_timeline.json` |
| Video Editor & Validator (Milestone 4) | `worker_editor_1` | ~2 min | OK | `deliverables/demo.mp4`, `deliverables/hero.webp`, `staging/`, `screenshots/`, `.studio/validation.json` (PASS) |
| Post-Edit Critic (Milestone 5) | `critic_post_edit_1` | ~2 min | OK | `.studio/critic_post_edit.md` (PASS) |
| Teardown & Sweep (Milestone 6) | `worker_teardown_1` | ~1 min | OK | Clean dev server termination, telemetry finalization, `.studio/pipeline_complete` |

## Deliverables Summary

| Asset | File Path | Specs / Dimensions | File Size | Size Limit | Status | Staging / Target |
|---|---|---|---|---|---|---|
| Master Video | `deliverables/demo.mp4` | 1920x1080 @ 25fps, 31.28s, H.264 (CRF 18) | 1,445,639 bytes (1.45 MB) | ≤ 10.0 MB | PASS | `deliverables/demo.mp4` |
| Hero Screenshot | `deliverables/hero.webp` | 1920x1080 Retina, Quality 85 | 44,276 bytes (44.3 KB) | ≤ 200 KB | PASS | `deliverables/hero.webp` |
| Secondary Animated WebP | `staging/demo.webp` | 800x450 @ 15fps, Quality 75 | 3,397,580 bytes (3.40 MB) | ≤ 6.0 MB | PASS | Staged in `staging/demo.webp` |
| Secondary Animated GIF | `staging/demo.gif` | 800x450 @ 10fps, 128 colors | 2,856,142 bytes (2.86 MB) | ≤ 8.0 MB | PASS | Staged in `staging/demo.gif` |
| State Capture: Initial | `screenshots/initial-state.png` | 1920x1080 PNG | 332,605 bytes | — | PASS | `screenshots/initial-state.png` |
| State Capture: Mid-Flight | `screenshots/mid-flight.png` | 1920x1080 PNG | 374,879 bytes | — | PASS | `screenshots/mid-flight.png` |
| State Capture: Climax Physics | `screenshots/climax-physics.png` | 1920x1080 PNG | 395,281 bytes | — | PASS | `screenshots/climax-physics.png` |

## Validation & Verification Metrics
- **Duration**: Actual 31.28s (Target: 30.0s, Δ=1.28s, threshold ≤ 5.0s) — PASS
- **SSIM Multi-Frame Diversity**:
  * f0 vs f25 = 0.9760
  * f0 vs f50 = 0.9674
  * f0 vs f75 = 0.9687
  * Static flag: `false` (active visual transformation)
- **Bookend Cold Start**: `false` (no pre-render blank gap)
- **Bookend Dead Tail**: Flagged `true` (SSIM 0.9962), correctly identified as intentional Darcy capillary diffusion and Navier-Stokes settling under `physics_showcase` rules.

## QA & Review Verdicts
- **Director Gate 1 (Post-Capture)**: PASS (Cold-start, 25%, 50%, 75%, and tail frames verified non-blank, smooth splines)
- **Pre-Capture Critic**: PASS (9/9 dimensions passed, 79.3% climax ratio, multi-pigment composition)
- **Deterministic Validator**: PASS (Container, codec, duration, and SSIM criteria satisfied)
- **Post-Edit Critic**: PASS (GitHub 5-Second Test: PASS, Fluid & Optical Physics: PASS, Kinematics: PASS, Multi-Pigment: PASS, Media Standards: PASS)

## Archetype & Physics Showcase Highlights
1. **Multi-Pigment Color Optics**: Successfully demonstrated authentic Kubelka-Munk 2-flux subtractive blending at stroke intersections combining 3 Nihonga mineral pigments (Sumi pine-soot black, Shu cinnabar vermilion, Ai fermented indigo).
2. **Substrate & Fluid Dynamics**: Showcased Kizuki Kōzo mulberry washi paper fiber absorbency with steep 45° tilt downward gravity advection, Darcy capillary bast fiber wicking (*Hige-nijimi*), and edge-darkened contact pinning (*Fuchidori*).
3. **Pacing & Kinematics**: Centripetal Catmull-Rom spline curves evaluated at human drawing cadence (56–319 px/s) followed by an uninterrupted 9.0-second climax camera hold for full physical evolution.
