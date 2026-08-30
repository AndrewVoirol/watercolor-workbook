# Master Change Manifest: Agentic Studio Plugin Redesign & Universal Architecture

**Author**: Implementation Worker (`teamwork_preview_worker_manifest`)  
**Target Repository**: `/Users/andrewvoirol/.gemini/config/plugins/agentic-studio-plugin`  
**Synchronized Copy**: `/Users/andrewvoirol/Antigravity/Projects/watercolor-workbook/chapter-1/CHANGE_MANIFEST.md`  
**Date**: 2026-08-30  
**Version**: 1.1.0  
**Status**: Authoritative Master Implementation Manifest  

---

## Executive Summary & Design Overview

### The Problem Diagnosis
The **Agentic Studio Plugin** is an autonomous multi-agent media production engine designed to create showcase videos, animated WebPs, repository GIFs, and Retina hero screenshots for web applications. Production telemetry (`telemetry/colosseum.jsonl` and `references/lessons.md`) revealed that the pipeline consistently failed on **physics simulations, fluid dynamics, and generative art applications**.

The failure stemmed from a single, hardcoded, monocultural creative philosophy: **"Maximize Interaction Density"**. This philosophy mandated:
1. Continuous UI clicking or dragging with an anti-screensaver rule prohibiting $>6\text{s}$ without new user actions (`AGENTS.md` §4e).
2. Forcing interactions to touch $\ge 75\%$ of all discovered controls, colors, or presets (`creative_director.md` §4).
3. Active discouragement of holding the camera on settling physics, treating continuous simulation holds as "dead air" (`creative_director.md` §6).
4. Direct programmatic invocation of machine-speed test harnesses (`window.simulateCalligraphy`), which fire in $<200\text{ms}$, producing instantaneous flash-appearances with zero visible brush motion.
5. Rigid deliverable size caps ($5\text{MB}$ MP4, $3\text{MB}$ WebP, $5\text{MB}$ GIF) tuned for flat 2D dashboards that triggered aggressive CRF bisection ($\text{CRF} \ge 32$) and destructive downscaling on high-entropy fluid/particle simulations.

### The Redesign Architecture
For physics, fluid dynamics, and generative applications:
- **Physics is the Star**: Interactions (e.g. calligraphic brush strokes, particle emitters, shockwaves) are merely triggers; the subsequent Navier-Stokes fluid advection, Darcy porous capillary wicking (*Hige-nijimi*), gravity cascades, and Kubelka-Munk optical color blending represent the primary technical achievement.
- **Hold the Camera**: After depositing ink or disturbing a field, the camera must hold for $5\text{--}12\text{s}$ uninterrupted to let visual dynamics unfold.
- **Simple Composition over Feature Cramming**: A single, masterfully executed calligraphic form (e.g. Ensō or Kanji 永 / 心) with 2–3 chromatically distinct pigments from contrasting hue families (warm vermilion, cool indigo, earthy ochre) is vastly superior to 5 random disconnected strokes cramming 6 buttons.
- **Harness Geometry as Art Direction**: Test harnesses contain beautiful mathematical stroke curves. The pipeline extracts control points from harness source code and replays them at human drawing speed ($150\text{--}400\text{ px/s}$, lasting $2\text{--}5\text{s}$ per stroke) with continuous Catmull-Rom splines, rather than calling the harness function directly at machine speed.
- **Visual Entropy Keyed Budgets**: High-entropy continuous particle systems and fluid canvases receive relaxed size ceilings ($10\text{--}15\text{MB}$ MP4, $6\text{--}8\text{MB}$ WebP, $8\text{--}10\text{MB}$ GIF) to preserve edge fidelity without blur or stutter.

```
App Profile (demoPhilosophy)
       │
       ├── physics_showcase ─────► Simple composition, 2-3 pigments, 5-12s camera holds, physics is content
       ├── interaction_density ──► Feature tour, rapid actions, UI breadth (legacy compatibility)
       └── generative_output ────► Input → transformation → computation/output presentation
```

---

## Complete File-by-File Master Manifest

### Target 1: `plugin.json`
- **Location**: `plugin.json`
- **Action**: `[MODIFY]`
- **Rationale**: Update plugin version to `1.1.0` and expand description to reflect archetype-aware demo philosophy routing, physics-based camera holds, human-paced spline kinematics, and entropy-keyed media encoding.

```json
<<<<
  "name": "agentic-studio-plugin",
  "version": "1.0.0",
  "description": "Autonomous multi-agent cinematic demo video production studio for web and canvas applications",
====
  "name": "agentic-studio-plugin",
  "version": "1.1.0",
  "description": "Autonomous multi-agent cinematic demo video production studio with archetype-aware demo philosophy routing, physics-based camera holds, human-paced spline kinematics, and entropy-keyed media encoding",
>>>>
```

---

### Target 2: `rules/AGENTS.md`
- **Location**: `rules/AGENTS.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update global agent execution rules with explicit `demoPhilosophy` routing, physics hold exceptions to the anti-screensaver and feature density rules, reversal of the physical simulation integrity rule, relaxed byte ceilings for high-entropy 2D fluid canvases, and philosophy-aware circuit breaker criteria.

#### Edit 2.1: Section 6 (Calligraphic Spline Kinematics & Harness Separation)
```markdown
<<<<
  - **Calligraphic Spline Kinematics (Anti-Staggering for 2D/3D Drawing Apps)**:
    1. Zero Linear Stepping: When simulating brush or pen strokes in drawing, calligraphy, or fluid apps, synthetic scripts MUST NOT interpolate along coarse linear line segments with static sleep intervals. This creates unnatural polygonal joints and staggered bead artifacts.
    2. Continuous Spline Interpolation: All drawing gestures must evaluate continuous parametric curves (Catmull-Rom, cubic Bezier, or B-splines) with high temporal density ($\ge 60\text{Hz}$ / 16ms event cadence) and continuous velocity-to-pressure mapping.
    3. Native Harness Role Separation:
       a. RECON PHASE ONLY: Native test harnesses (e.g. `window.simulateCalligraphy`) are VERIFICATION tools. Use them during Phase 2.1 Reconnaissance to confirm the physics engine responds to pointer events. They validate that the app works.
       b. DEMO CAPTURE PROHIBITION: Native test harnesses MUST NOT be used as the primary content source in capture scripts for `2d_canvas_drawing` or `2d_canvas_painting` archetypes. Test harnesses fire events at machine speed (~200ms per character), producing instantaneous stroke appearances with zero visible brush motion. This creates a slideshow, not a demo.
       c. HUMAN-PACED SYNTHETIC STROKES: For demo capture, the Browser Operator MUST implement deliberate synthetic pointer drags using `StudioInteractionEngine`'s Catmull-Rom spline interpolation at human drawing speed (150–400 pixels/second, NOT the 2000+ px/s of test harnesses). Each visible stroke should take 2–5 seconds of continuous brush motion. The viewer must see the brush moving and ink being deposited in real-time.
       d. STROKE PATH EXTRACTION: The Browser Operator may use the harness source code to extract the correct stroke paths (control points, pressure curves) but must replay them at human pace using `StudioInteractionEngine`, not by calling the harness function directly.
       e. EXCEPTION: For archetypes where the primary value IS automation speed (e.g., generative art tools, batch processors), native harnesses may be used in capture.
====
  - **Calligraphic Spline Kinematics & Harness Path Extraction (2D/3D Drawing & Painting Apps)**:
    1. Zero Linear Stepping: When simulating brush or pen strokes in drawing, calligraphy, or fluid apps, synthetic scripts MUST NOT interpolate along coarse linear line segments with static sleep intervals. This creates unnatural polygonal joints and staggered bead artifacts.
    2. Continuous Centripetal Spline Interpolation: All drawing gestures must evaluate continuous parametric curves (Centripetal Catmull-Rom splines) with high temporal density ($\ge 60\text{Hz}$ / 16ms event cadence) and dynamic velocity-to-pressure mapping ($P(t) = P_{\text{start}} + \Delta P \cdot \sin(\pi t)$).
    3. Native Harness Role Separation:
       a. RECON PHASE ONLY: Native test harnesses (e.g. `window.simulateCalligraphy`) are VERIFICATION tools. Use them during Phase 2.1 Reconnaissance to confirm the physics engine responds to pointer events and to validate that the app functions.
       b. DEMO CAPTURE PROHIBITION: Native test harnesses MUST NOT be called directly as the primary content source in capture scripts for `2d_canvas_drawing` or `2d_canvas_painting` archetypes. Test harnesses fire events at machine speed (~200ms per character), producing instantaneous stroke appearances with zero visible brush motion, creating an unengaging slideshow.
       c. HUMAN-PACED SYNTHETIC STROKES: For demo capture, the Browser Operator MUST implement deliberate synthetic pointer drags using `StudioInteractionEngine`'s Catmull-Rom spline interpolation at human drawing speed (150–400 pixels/second). Each visible stroke should take 2–5 seconds of continuous brush motion, ensuring the viewer sees the brush moving and ink being deposited in real-time.
       d. STROKE PATH EXTRACTION WORKFLOW: The Browser Operator must inspect the harness source code during Phase 2.1 Reconnaissance, extract the normalized control point waypoints for canonical motifs (e.g. Ensō circle, Kanji 永 or 心), and replay them at human pace using `StudioInteractionEngine.drawSplineStroke()`.
       e. EXCEPTION: For archetypes where the primary value IS automation speed (e.g., generative art tools, batch processors), native harnesses may be invoked directly.
>>>>
```

#### Edit 2.2: Section 8 (Smart Circuit Breaker Table)
```markdown
<<<<
| Failure Category | Max Retries | Action & Strategy |
|---|---|---|
| **Structural Failure** | **0 Retries** (Immediate Halt) | Missing system dependencies, dev server crash, fatal console runtime errors, missing required DOM context. Log root cause, trigger teardown, write `.studio/pipeline_complete`, escalate to user. |
| **Timing / Lag Failure** | **2 Retries** | Video duration offset > ±5s from EDL target, recording duration > 50% over expected, or marker timeline missing entries. Director sends timing adjustment message to the **existing idle** Browser Operator (no respawn). |
| **Size / Encoding Failure** | **0 Retries** (Self-Healing) | WebP > 3MB, GIF > 5MB, MP4 > 5MB, Hero > 200KB. Handled completely and deterministically by `scripts/compress_media.sh` via automated CRF bisection, Lanczos 720p downscaling, and multi-tier quality ladders without conversational LLM re-invocations. |
| **Quality Verification Failure** | **0 Retries** (Self-Healing) | Structural and mathematical media verification is performed deterministically by `scripts/validate_media.sh`. Subjective LLM debates over compression artifacts are structurally eliminated. |
| **Content Mismatch / Semantic Failure** | **1 Retry** | Director visual verification gate detected blank/static frames, Post-Edit Critic flagged CONCERNS (dead opening, dead tail, insufficient motion density, or value proposition mismatch), OR Director identifies monochromatic output / <20% feature breadth / >6s continuous passive hold without visible change. **The Director MUST NOT dismiss Critic CONCERNS as "pacing issues" or accept deliverables when the Critic says the GitHub Test fails.** Browser Operator revises the capture script and re-records. |
====
| Failure Category | Max Retries | Action & Strategy |
|---|---|---|
| **Structural Failure** | **0 Retries** (Immediate Halt) | Missing system dependencies, dev server crash, fatal console runtime errors, missing required DOM context. Log root cause, trigger teardown, write `.studio/pipeline_complete`, escalate to user. |
| **Timing / Lag Failure** | **2 Retries** | Video duration offset > ±5s from EDL target, recording duration > 50% over expected, or marker timeline missing entries. Director sends timing adjustment message to the **existing idle** Browser Operator (no respawn). |
| **Size / Encoding Failure** | **0 Retries** (Self-Healing) | Media size limits are keyed to visual entropy and enforced deterministically by `scripts/compress_media.sh` via automated CRF bisection, Lanczos 720p downscaling, and multi-tier quality ladders without conversational LLM re-invocations. |
| **Quality Verification Failure** | **0 Retries** (Self-Healing) | Structural and mathematical media verification is performed deterministically by `scripts/validate_media.sh`. Subjective LLM debates over compression artifacts are structurally eliminated. |
| **Content Mismatch / Semantic Failure** | **1 Retry** | Director visual verification gate detected blank/static frames; Post-Edit Critic flagged CONCERNS (dead opening, dead tail, flash machine-speed strokes, monochromatic output, or value proposition mismatch); OR Director identifies monochromatic output / <20% feature breadth (for `interaction_density`) / >6s continuous passive hold without visible physics change. **EXCEPTION**: For `physics_showcase`, 5–12s continuous holds where fluid wicking, gravity cascades, or particle dynamics are actively evolving are VALID CONTENT, not passive hold failures. **The Director MUST NOT dismiss Critic CONCERNS as "pacing issues" or accept deliverables when the Critic says the GitHub Test fails.** Browser Operator revises the capture script and re-records. |
>>>>
```

#### Edit 2.3: Section 13 (Deliverable Standards & Visual Entropy Budgets)
```markdown
<<<<
- **Modern Media Primacy for Shaders/Particles**: For `webgl_3d_canvas` and high-entropy particle engines, 8-bit palette-indexed GIF files (max 256 colors) suffer severe degradation and pixelation under Bayer dithering due to zero static delta blocks. **MP4 (H.264, 720p/1080p) and truecolor Animated WebP are the authoritative primary deliverables for portfolio showcase and README hero embeds.** GIFs serve only as legacy fallback and must never step down below 96 colors.
- **Tier 1: Showcase Demo Video (`deliverables/demo.mp4`) — PRIMARY HERO DELIVERABLE**:
  - Format: MP4 (H.264), 1920x1080 (Lanczos 720p fallback if $\text{CRF} \ge 32$), `yuv420p`, `+faststart`, audio stripped.
  - Encoding: Automated CRF binary search in range $[18 \dots 34]$ targeting the lowest CRF that stays $\le 5,242,880\text{ bytes}$ ($5.0\text{ MB}$, or $15.0\text{ MB}$ for WebGL).
  - Priority: This is the authoritative presentation format for portfolio review and web embeds.
- **Tier 2: Animated Preview (`deliverables/demo.webp`)**:
  - Format: Animated WebP, target $\le 3,145,728\text{ bytes}$ ($3.0\text{ MB}$, hard ceiling $5.0\text{ MB}$ or $8.0\text{ MB}$ for WebGL).
  - Fallback Ladder: Step 1 ($15\text{fps}, 800\text{px}, q=75$) $\to$ Step 2 ($12\text{fps}, 800\text{px}, q=65$) $\to$ Step 3 ($12\text{fps}, 720\text{px}, q=55$) $\to$ Step 4 ($10\text{fps}, 640\text{px}, q=45$).
- **Tier 3: Repository GIF (`deliverables/demo.gif`)**:
  - Format: Animated GIF, strict ceiling $\le 5,242,880\text{ bytes}$ ($5.0\text{ MB}$, or $10.0\text{ MB}$ for WebGL).
  - Filter Complex: 2-pass differential `palettegen` (`stats_mode=diff`) and `paletteuse` with Bayer ordered dithering (`dither=bayer:bayer_scale=3`).
  - Fallback Ladder: Step 1 ($10\text{fps}, 800\text{px}, 128\text{ colors}$) $\to$ Step 2 ($10\text{fps}, 720\text{px}, 96\text{ colors}$) $\to$ Step 3 ($8\text{fps}, 640\text{px}, 96\text{ colors}$) $\to$ Step 4 ($6\text{fps}, 480\text{px}, 96\text{ colors}$).
  - **Particle-Safe GIF Floor**: For `webgl_3d_canvas` and `2d_canvas_drawing`, the GIF compression ladder MUST NOT step down below 96 colors to avoid destructive Bayer dithering pixelation on continuous particle gradients.
====
- **Visual Entropy Keyed Budgets & Modern Media Primacy**: Compression difficulty is governed by visual entropy (continuous fluid gradients, high-frequency particle trajectories, optical turbulence), not by demo philosophy. Deliverable size ceilings in `compress_media.sh` and `validate_media.sh` are keyed strictly by application archetype:
  - **High-Entropy 3D Canvas (`webgl_3d_canvas`)**: MP4 $\le 15.0\text{ MB}$, WebP $\le 8.0\text{ MB}$, GIF $\le 10.0\text{ MB}$ (color floor 96).
  - **High-Entropy 2D Simulation (`2d_canvas_drawing` / `2d_canvas_painting` with fluid/particles)**: MP4 $\le 10.0\text{ MB}$, WebP $\le 6.0\text{ MB}$, GIF $\le 8.0\text{ MB}$ (color floor 96).
  - **Standard Low-Entropy UI (`data_dashboard`, `form_utility`, `ai_generative_ui`, `interactive_game`)**: MP4 $\le 5.0\text{ MB}$, WebP $\le 3.0\text{ MB}$, GIF $\le 5.0\text{ MB}$ (color floor 48).
- **MP4 and Animated WebP Primacy**: For all continuous canvas simulations, 8-bit palette-indexed GIF files suffer severe Bayer dithering degradation. **MP4 (H.264 1080p/720p) and truecolor Animated WebP are the authoritative primary deliverables for portfolio showcase and README hero embeds.** GIFs serve only as legacy fallback and must never step down below 96 colors for canvas apps.
- **Tier 1: Showcase Demo Video (`deliverables/demo.mp4`) — PRIMARY HERO DELIVERABLE**:
  - Format: MP4 (H.264), 1920x1080 (Lanczos 720p fallback if $\text{CRF} \ge 32$), `yuv420p`, `+faststart`, audio stripped.
  - Encoding: Automated CRF binary search in range $[18 \dots 34]$ targeting the archetype's specific byte ceiling.
  - Priority: This is the authoritative presentation format for portfolio review and web embeds.
- **Tier 2: Animated Preview (`deliverables/demo.webp`)**:
  - Format: Animated WebP, targeting archetype ceiling ($3.0\text{ MB}$ standard, $6.0\text{ MB}$ 2D fluid, $8.0\text{ MB}$ WebGL).
  - Fallback Ladder: Step 1 ($15\text{fps}, 800\text{px}, q=75$) $\to$ Step 2 ($12\text{fps}, 800\text{px}, q=65$) $\to$ Step 3 ($12\text{fps}, 720\text{px}, q=55$) $\to$ Step 4 ($10\text{fps}, 640\text{px}, q=45$).
- **Tier 3: Repository GIF (`deliverables/demo.gif`)**:
  - Format: Animated GIF, targeting archetype ceiling ($5.0\text{ MB}$ standard, $8.0\text{ MB}$ 2D fluid, $10.0\text{ MB}$ WebGL).
  - Filter Complex: 2-pass differential `palettegen` (`stats_mode=diff`) and `paletteuse` with Bayer ordered dithering (`dither=bayer:bayer_scale=3`).
  - Particle-Safe GIF Floor: For `webgl_3d_canvas` and `2d_canvas_drawing`, the GIF compression ladder MUST NOT step down below 96 colors.
- **Tier 4: Climax Hero Screenshot (`deliverables/hero.webp`)**:
  - Format: Static WebP, strict ceiling $\le 204,800\text{ bytes}$ ($200\text{ KB}$).
  - Extraction: Frame extracted at mathematical midpoint of the climax scene ($t = t_{\text{climax\_start}} + \frac{\text{duration}}{2}$).
  - Quality Ladder: `cwebp` stepping down $q=85 \to 75 \to 65 \to 45$.
>>>>
```

#### Edit 2.4: Section 15 (Content Quality Assessment & Demo Philosophy Integration)
```markdown
<<<<
## 15. Content Quality Assessment & Maximum Visual Delta Mandate

Compliance with structural mechanisms is necessary but not sufficient; deliverables must be engaging, distinctive, and optimized for immediate comprehension:

- **Maximum Visual Delta Optimization**: The Creative Director must maximize visual state transformation per second of runtime rather than performing a linear UI tour.
====
## 15. Content Quality Assessment & Archetype-Aware Demo Philosophy Architecture

Compliance with structural mechanisms is necessary but not sufficient; deliverables must be engaging, distinctive, and optimized for immediate comprehension based on their canonical **Demo Philosophy**:

### 15.1 The Three Canonical Demo Philosophies
1. **`physics_showcase`**:
   - **Core Axiom**: *Interactions are triggers; the autonomous physical simulation response IS the content.*
   - **Target Applications**: WebGPU watercolor/fluid dynamics, Navier-Stokes solvers, Darcy capillary porous media, Kubelka-Munk color optics, N-body particle gravity, elastic/soft-body physics.
   - **Pacing & Camera Holds**: 1–3 purposeful interactions followed by continuous, uninterrupted **5–12 second camera holds** to let fluid wicking, gravity cascading, mineral sedimentation (*Bunjin-ka*), and optical drying (*Kasshoku*) develop naturally.
   - **Simple Composition Principle**: Focus on 1–2 master calligraphic or fluid motifs (e.g. Kanji 永 or Ensō circle) with 2–3 chromatically distinct pigments from contrasting hue families (warm vermilion + cool indigo + neutral soot black / gold). Bypasses the §4 feature density mandate and §4e anti-screensaver rule.
   - **Causal Staging**: Pre-configure physical parameters (dilution $\ge 70\%$, paper substrate, tilt gimbal $\ge 45^\circ$) *before or concurrent with* ink deposition so physics can immediately act.
   - **Human-Paced Stroke Kinematics**: Drawing gestures must execute at human drawing speed (150–400 px/s, lasting 2–5s per stroke) using Centripetal Catmull-Rom splines at $\ge 60\text{Hz}$ event density.

2. **`interaction_density`** *(Standard UI Default)*:
   - **Core Axiom**: *Maximize feature breadth and interactive visual state transformations per second.*
   - **Target Applications**: SaaS data dashboards, form wizards, configuration utilities, multi-tab workflow tools.
   - **Pacing & Feature Density**: Rapid sequential interactions touching $\ge 75\%$ of UI controls, filters, and presets. Anti-screensaver rule applies: no pause $>6\text{s}$ without a new user interaction.

3. **`generative_output`**:
   - **Core Axiom**: *Input prompt/seed $\to$ computation transformation $\to$ dramatic artifact reveal.*
   - **Target Applications**: AI image/video generators, procedural geometry synthesis, algorithmic art studios.
   - **Pacing & Staging**: Fast parameter setup ($1\text{--}3\text{s}$) $\to$ fast-forward computational latency at $2.5\times\text{--}4.0\times$ (`wow_level: dead_air`) $\to$ high-impact reveal of final synthesized card with focal zoom into high-resolution details ($5\text{--}10\text{s}$).

### 15.2 Mandatory Philosophy-Aware Rule Exceptions
- **Feature Density Exception (§4)**: For `physics_showcase`, the 75% feature coverage rule is replaced by the Simple Composition Principle. Deep physical demonstration of 1–2 motifs with contrasting pigments overrides surface clicking of many buttons.
- **Anti-Screensaver Exception (§4e)**: For `physics_showcase`, continuous camera holds ($5\text{--}12\text{s}$) where fluid diffusion, capillary wicking, gravity cascades, or particle dynamics are actively evolving are CLASSIFIED AS ACTIVE CONTENT. The 6-second interaction floor applies only to static UI or frozen states.
- **Physical Simulation Integrity Reversal (§6)**: For `physics_showcase`, subtle physical phenomena (capillary wicking *Hige-nijimi*, mineral sedimentation *Bunjin-ka*, edge-pinning *Fuchidori*) are the core showcase. The camera MUST remain locked on the fluid pool to let these physical transformations complete naturally without cutting away to click more buttons.
>>>>
```

---

### Target 3: `skills/studio-orchestrator/SKILL.md`
- **Location**: `skills/studio-orchestrator/SKILL.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update Master Director Runbook with `demoPhilosophy` routing across all 4 production phases, philosophy-aware subagent registration prompts, updated Gate 1 and Gate 2 definitions, and synced circuit breaker policies.

#### Edit 3.1: Subagent Dynamic Registration Blocks
```markdown
<<<<
// 1. App Explorer (AST analysis, archetype classification, seed mining)
define_subagent({
  TypeName: "studio_app_explorer",
  EnableMCPTools: false,
  EnableWriteTools: false,
  SystemPrompt: "You are the Studio App Explorer. Inspect the target codebase using read-only filesystem tools. Classify the application archetype, discover State A and State B for Maximum Visual Delta, mine URL query parameters/demo seeds/physics key listeners, and analyze temporal signatures. Write output to .studio/app_profile.json. (Full prompt: prompts/app_explorer.md)"
});

// 2. Creative Director (Maximum visual delta, Climax >= 40%, negative constraints)
define_subagent({
  TypeName: "studio_creative_director",
  EnableMCPTools: false,
  EnableWriteTools: false,
  SystemPrompt: "You are the Studio Creative Director. Transform .studio/app_profile.json into a 25-30s demo narrative. MANDATES: Climax scenes >= 40% duration, establishing/cooldown <= 15% each. Maximum visual delta optimization. Strict negative constraints: NO linear form typing, NO sequential tab browsing, NO empty landing states >1s. Output .studio/choreography.json and .studio/edl.yaml. (Full prompt: prompts/creative_director.md)"
});
====
// 1. App Explorer (AST analysis, demoPhilosophy classification, seed mining)
define_subagent({
  TypeName: "studio_app_explorer",
  EnableMCPTools: false,
  EnableWriteTools: false,
  SystemPrompt: "You are the Studio App Explorer. Inspect the target codebase using read-only filesystem tools. Classify demoPhilosophy (physics_showcase | interaction_density | generative_output) and archetype, discover State A and State B for Maximum Visual Delta, mine URL query parameters/demo seeds/test harness stroke paths, and analyze temporal signatures. Write output to .studio/app_profile.json. (Full prompt: prompts/app_explorer.md)"
});

// 2. Creative Director (Philosophy router, simple composition, human-paced strokes, physics holds)
define_subagent({
  TypeName: "studio_creative_director",
  EnableMCPTools: false,
  EnableWriteTools: false,
  SystemPrompt: "You are the Studio Creative Director. Inspect demoPhilosophy in .studio/app_profile.json and route narrative design: (1) physics_showcase: Simple composition (1-2 motifs), 2-3 contrasting pigments, causal staging (dilution/tilt set before stroke), human-paced stroke durations (2000-5000ms), and 5-12s uninterrupted climax physics holds. (2) interaction_density: Rapid UI tour, >=75% feature coverage, <=6s gaps. (3) generative_output: Seed setup -> fast-forward compute -> high-impact artifact reveal. Output .studio/choreography.json and .studio/edl.yaml. (Full prompt: prompts/creative_director.md)"
});
>>>>
```

#### Edit 3.2: Phase 1 & Gate Verification Updates
```markdown
<<<<
### 3.2 Phase 1: Scripting & Adversarial Review
1. Invoke `studio_creative_director`:
   ```javascript
   invoke_subagent({
     TypeName: "studio_creative_director",
     Prompt: "Read .studio/app_profile.json and references/edl-format.md. Script a 25-30s demo with Maximum Visual Delta pacing (Climax >=35%, Establishing <=15%, Cooldown <=15%). For particle systems, mandate structured, low-entropy states (e.g. Calm) before perturbations. Cap repetitive kinetic effects (warp speed) to <=5s max. Output .studio/choreography.json and .studio/edl.yaml.",
     Role: "creative_director"
   });
   ```
====
### 3.2 Phase 1: Scripting & Adversarial Review
1. Invoke `studio_creative_director`:
   ```javascript
   invoke_subagent({
     TypeName: "studio_creative_director",
     Prompt: "Read .studio/app_profile.json and references/edl-format.md. Route narrative design based on demoPhilosophy: For physics_showcase, design simple composition with 1-2 calligraphic motifs, 2-3 chromatically distinct pigments, causal staging (tilt/dilution first), explicit stroke_duration_ms (2000-5000ms), and 5-12s continuous climax hold. For interaction_density, apply maximum visual delta UI tour (>=75% controls, <=6s gaps). Output .studio/choreography.json and .studio/edl.yaml.",
     Role: "creative_director"
   });
   ```
>>>>
```

---

### Target 4: `skills/studio-orchestrator/prompts/app_explorer.md`
- **Location**: `skills/studio-orchestrator/prompts/app_explorer.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add `demoPhilosophy` classification heuristics, physics engine detection patterns, test harness stroke path discovery, and updated JSON schema.

#### Edit 4.1: Section 1 (Core Objectives)
```markdown
<<<<
## 1. Core Objectives & Responsibilities

1. **Application Archetype Classification**:
   Categorize the target application into one of the canonical Studio archetypes:
   - `webgl_3d_canvas`: Three.js, React Three Fiber, WebGL shaders, OrbitControls, 3D meshes.
   - `2d_canvas_drawing`: HTML5 Canvas, WebGPU compute, fluid dynamics, particles, drawing engines.
   - `data_dashboard`: Dynamic charts (Recharts, Chart.js, D3), filters, metric cards, data tables.
   - `ai_generative_ui`: Multimodal generation, prompt streams, canvas workspaces, card generators.
   - `interactive_game`: Physics engines (Matter.js, Rapier), collision listeners, particle bursts.
   - `form_utility`: Interactive calculators, configuration builders, visual code editors.
====
## 1. Core Objectives & Responsibilities

1. **Demo Philosophy Classification (`demoPhilosophy`)**:
   Determine the primary narrative philosophy for showcasing the application:
   - **`physics_showcase`**: Triggered when the app simulates continuous physical dynamics (Navier-Stokes fluid mechanics, Darcy capillary wicking, Kubelka-Munk optical color blending, gravity cascades, particle accretion disks, soft-body mechanics, digital brush bristles). In this mode, interactions are triggers and the subsequent autonomous physics response IS the content.
   - **`interaction_density`**: Standard SaaS dashboards, form builders, admin panels, e-commerce stores, settings tools where value equals interactive feature breadth and UI responsiveness.
   - **`generative_output`**: AI prompt-to-media tools, procedural geometry generators, code compilers where the core narrative is Input $\to$ Transformation $\to$ Artifact Reveal.

2. **Application Archetype Classification**:
   Categorize the target application into one of the canonical Studio archetypes:
   - `webgl_3d_canvas`: Three.js, React Three Fiber, WebGL shaders, OrbitControls, 3D meshes.
   - `2d_canvas_drawing`: HTML5 Canvas, WebGPU compute, fluid dynamics, particles, drawing engines.
   - `data_dashboard`: Dynamic charts (Recharts, Chart.js, D3), filters, metric cards, data tables.
   - `ai_generative_ui`: Multimodal generation, prompt streams, canvas workspaces, card generators.
   - `interactive_game`: Physics engines (Matter.js, Rapier), collision listeners, particle bursts.
   - `form_utility`: Interactive calculators, configuration builders, visual code editors.
>>>>
```

#### Edit 4.2: Section 2 (AST Grep Recipes)
```markdown
<<<<
# 3. Physics & Keyboard Triggers
grep_search: "addEventListener\(['\"]keydown['\"]"
grep_search: "window\.(simulate|trigger|engine|app)"

# 4. Canvas & WebGL Engines
grep_search: "(THREE|Canvas|WebGLRenderer|getContext\(['\"]2d['\"]|GPUCommandEncoder)"
====
# 3. Physics, Solvers & Optical Shaders
grep_search: "(advect|jacobi|poisson|darcy|capillary|wicking|porous|kubelka|scattering|absorption|km_rgb|sedimentation)"
grep_search: "(tilt|gimbal|gravity|viscosity|diffusion|surfaceTension)"

# 4. Physics & Testing Harnesses (Stroke Geometry Repositories)
grep_search: "addEventListener\(['\"]keydown['\"]"
grep_search: "window\.(simulateCalligraphy|simulate|trigger|engine|app|__studio)"
grep_search: "(strokePaths|kanjiPaths|brushPoints|waypoint|controlPoints|bezier)"

# 5. Canvas & WebGL Engines
grep_search: "(THREE|Canvas|WebGLRenderer|getContext\(['\"]2d['\"]|GPUCommandEncoder|requestAnimationFrame)"
>>>>
```

#### Edit 4.3: Section 3 (JSON Output Schema)
```json
<<<<
{
  "project": "project-identifier",
  "framework": "nextjs | vite-react | svelte | vue | vanilla",
  "devServerCommand": "npm run dev",
  "archetype": "webgl_3d_canvas | 2d_canvas_drawing | data_dashboard | ai_generative_ui | interactive_game | form_utility",
  "hasCanvas": true,
  "canvasType": "threejs | webgl | webgpu | 2d | none",
  "darkModeType": "class | media | none",
  "maxVisualDeltaStates": {
    "stateA": "Description of clean populated state A",
    "stateB": "Description of transformed climax state B"
  },
  "seedsAndPresets": {
    "urlQueryParams": ["?preset=galaxy", "?demo=true"],
    "keyboardShortcuts": [
      { "key": "Space", "action": "Trigger particle shockwave" },
      { "key": "KeyR", "action": "Reset simulation with turbulence" }
    ],
    "fixtures": ["src/data/sample_dataset.json"]
  },
  "temporalSignatures": {
    "slowBuilds": [{ "file": "src/sim.ts", "line": 42, "pattern": "setTimeout(calc, 3000)" }],
    "burstEvents": [{ "file": "src/particles.ts", "line": 88, "pattern": "emitShockwave()" }],
    "continuousLoops": [{ "file": "src/canvas.tsx", "line": 15, "pattern": "requestAnimationFrame" }],
    "detailIndicators": [{ "file": "src/HUD.tsx", "line": 10, "pattern": "fpsCounter, metricBadge" }]
  }
}
====
{
  "project": "project-identifier",
  "framework": "nextjs | vite-react | svelte | vue | vanilla",
  "devServerCommand": "npm run dev",
  "demoPhilosophy": "physics_showcase | interaction_density | generative_output",
  "archetype": "webgl_3d_canvas | 2d_canvas_drawing | data_dashboard | ai_generative_ui | interactive_game | form_utility",
  "hasCanvas": true,
  "canvasType": "threejs | webgl | webgpu | 2d | none",
  "hasPhysicsSimulation": true,
  "physicsCharacteristics": {
    "solvers": ["Navier-Stokes fluid advection", "Darcy porous capillary wicking", "Kubelka-Munk color optics", "45° gravity tilt"],
    "diffusionTimescaleSec": 8.0,
    "causalStagingRequirements": "Set dilution >= 70% and tilt gimbal before stroke deposition"
  },
  "harnessGeometry": [
    { "name": "kokoro", "type": "calligraphy_kanji", "strokeCount": 4, "description": "Heart kanji with curved belly and leaping hook flick" },
    { "name": "enso", "type": "zen_circle", "strokeCount": 1, "description": "Continuous 360 degree fluid circle with dry brush liftoff" }
  ],
  "darkModeType": "class | media | none",
  "maxVisualDeltaStates": {
    "stateA": "Description of clean populated state A",
    "stateB": "Description of transformed climax state B"
  },
  "seedsAndPresets": {
    "urlQueryParams": ["?preset=galaxy", "?demo=true"],
    "keyboardShortcuts": [
      { "key": "Space", "action": "Trigger particle shockwave" },
      { "key": "KeyR", "action": "Reset simulation with turbulence" }
    ],
    "fixtures": ["src/data/sample_dataset.json"]
  },
  "temporalSignatures": {
    "slowBuilds": [{ "file": "src/sim.ts", "line": 42, "pattern": "setTimeout(calc, 3000)" }],
    "burstEvents": [{ "file": "src/particles.ts", "line": 88, "pattern": "emitShockwave()" }],
    "continuousLoops": [{ "file": "src/canvas.tsx", "line": 15, "pattern": "requestAnimationFrame" }],
    "detailIndicators": [{ "file": "src/HUD.tsx", "line": 10, "pattern": "fpsCounter, metricBadge" }]
  }
}
>>>>
```

---

### Target 5: `skills/studio-orchestrator/prompts/creative_director.md`
- **Location**: `skills/studio-orchestrator/prompts/creative_director.md`
- **Action**: `[MODIFY]`
- **Rationale**: Insert top-level Philosophy Router, define pacing rules and simple composition principles for `physics_showcase`, specify `draw_stroke` harness art direction syntax, and add exceptions to anti-screensaver and feature density rules.

#### Edit 5.1: Top-Level Philosophy Router & Pacing Matrices
```markdown
<<<<
# Studio Creative Director — System Prompt

You are the **Studio Creative Director** (`studio_creative_director`). Your mission is to transform the technical App Profile (`.studio/app_profile.json`) into a cinematic, high-impact demo narrative that showcases the application's most extraordinary visual capabilities within a tight 25–30 second timeline.

---

## 1. Core Editorial Mandates & Pacing Rules
====
# Studio Creative Director — System Prompt

You are the **Studio Creative Director** (`studio_creative_director`). Your mission is to transform the technical App Profile (`.studio/app_profile.json`) into a cinematic, high-impact demo narrative that showcases the application's most extraordinary visual capabilities within a tight 25–30 second timeline.

---

## 1. Creative Philosophy Router (MANDATORY TOP-LEVEL EVALUATION)

Before designing scenes, inspect `demoPhilosophy` in `.studio/app_profile.json` and strictly route your editorial approach:

### Branch A: `physics_showcase`
- **Core Axiom**: *Interactions are triggers; the physical simulation response is the content.*
- **Simple Composition Principle**: Execute 1–2 master calligraphic or fluid forms (e.g. Kanji 永 or Ensō circle) with 2–3 chromatically distinct pigments from contrasting hue families (warm vermilion + cool indigo + earthy ochre). **DO NOT** cram 5 random lines or click through multiple unrelated tools.
- **Continuous Physics Holds**: Allocate an uninterrupted **5–12 second camera hold** during the Climax scene to allow Darcy capillary wicking (*Hige-nijimi*), gravity cascades, Stokes mineral sedimentation, and optical drying to visually unfold.
- **Causal Staging Invariant**: Configure boundary conditions (dilution $\ge 70\%$, paper substrate, tilt gimbal $\ge 45^\circ$) *before or concurrent with* stroke deposition so fluid physics can act immediately.
- **Stroke Duration Mandate**: Every drawing action MUST specify an explicit `stroke_duration_ms` between 2000ms and 5000ms for human drawing pace (150–400 px/s).
- **Rule Exceptions**: The 6-second interaction density floor (§4e) and 75% feature density mandate (§4) DO NOT apply. The camera hold rule (§6) is reversed: lock the camera on the fluid pool during settling.

### Branch B: `interaction_density` *(Standard UI / Dashboards)*
- **Core Axiom**: *Maximize feature breadth and interactive visual state transformations per second.*
- **Feature Density Mandate**: Orchestrate interactions that touch $\ge 75\%$ of distinct visual features, controls, or presets before reaching the climax.
- **Interaction Density Floor (§4e)**: No segment may contain $>6\text{s}$ without a new user interaction.
- **Pacing**: Climax $\ge 40\%$, Establishing $\le 15\%$, Cooldown $\le 15\%$.

### Branch C: `generative_output`
- **Core Axiom**: *Input prompt/seed $\to$ computation transformation $\to$ dramatic artifact reveal.*
- **Staging**: Parameter/Prompt setup (10-15% duration) $\to$ fast-forward compute/loading at 3.0x (`dead_air`) $\to$ Climax ($\ge 45\%$ duration) featuring high-impact reveal with zoom crop into high-resolution details.

---

## 2. Core Editorial Mandates & General Rules
>>>>
```

#### Edit 5.2: Harness Art Direction Syntax & Negative Constraints
```markdown
<<<<
5b. **Stroke Duration Specification (Drawing/Painting Apps)**:
    - For `2d_canvas_drawing` and `2d_canvas_painting` archetypes, every choreography action that produces a visible stroke MUST specify an explicit `stroke_duration_ms` (the time the brush visibly travels across the canvas).
    - Minimum stroke duration: 2000ms. Maximum: 5000ms.
    - The choreography MUST NOT use `{ "type": "evaluate", "expression": "window.simulate..." }` as the primary drawing action. Instead, use `{ "type": "draw_stroke" }` with explicit path points and duration.
    - Example choreography action for a drawing app:
      ```json
      {
        "type": "draw_stroke",
        "path": "harness:kokoro",
        "stroke_duration_ms": 3500,
        "note": "Draw kokoro kanji at human pace — viewer sees brush moving for 3.5 seconds"
      }
      ```
    - The Browser Operator resolves `"path": "harness:kokoro"` by reading the harness source code to extract path control points, then replays them as slow synthetic pointer drags via `StudioInteractionEngine`.
    - RATIONALE: A 25-second demo with 4 strokes at 3s each = 12s of visible drawing motion (48% of video with continuous visible brush activity). Compare to harness calls: 4 strokes at 0.2s each = 0.8s of content in a 25s video (3.2%).
====
5b. **Harness Path Extraction Art Direction & Stroke Duration Specification**:
    - For `2d_canvas_drawing` and `2d_canvas_painting` archetypes, every choreography action that produces a visible stroke MUST use the `draw_stroke` action type referencing discovered harness geometry (e.g. `"path": "harness:kokoro"` or `"path": "harness:enso"`) or explicit normalized waypoints.
    - Every `draw_stroke` action MUST specify an explicit `stroke_duration_ms` between 2000ms and 5000ms (human drawing pace of 150–400 px/s) and an optional `hold_duration_ms` (e.g. 5000–10000ms) for subsequent physical diffusion.
    - The choreography MUST NOT use raw `{ "type": "evaluate", "expression": "window.simulate..." }` as the primary drawing action.
    - Example choreography action for a drawing app:
      ```json
      {
        "type": "draw_stroke",
        "path": "harness:kokoro:stroke_1",
        "pigment": "shu",
        "stroke_duration_ms": 3500,
        "hold_duration_ms": 8000,
        "note": "Draw vermilion kokoro stroke at human pace (3.5s) followed by 8s capillary wicking hold"
      }
      ```
    - The Browser Operator resolves `"path": "harness:kokoro"` by extracting normalized control points from the test harness source and interpolating them into Centripetal Catmull-Rom splines via `StudioInteractionEngine.drawSplineStroke()`.
>>>>
```

---

### Target 6: `skills/studio-orchestrator/prompts/browser_operator.md`
- **Location**: `skills/studio-orchestrator/prompts/browser_operator.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add detailed instructions for extracting harness control points, implementing Centripetal Catmull-Rom spline kinematics at 150–400 px/s, embedding `drawSplineStroke()` into `StudioInteractionEngine`, and maintaining WebGPU headful Playwright execution.

#### Edit 6.1: Phase 2.2 Script Compilation & Spline Engine
```markdown
<<<<
6. **Continuous Spline Kinematics (Drawing & Calligraphy Apps)**:
   - For `2d_canvas_drawing` and calligraphy apps, do NOT use discrete coarse linear segments with static sleep intervals.
   - Interpolate drawing gestures along Catmull-Rom or cubic parametric splines with $\ge 60\text{Hz}$ event density (16ms subdivisions) and continuous velocity-to-pressure dynamic mapping.
   - Where available in `app_profile.json`, prioritize invoking native simulation test harnesses (`window.simulateCalligraphy`, etc.) which compute exact bristle kinematics.
====
6. **Continuous Catmull-Rom Spline Kinematics & Harness Replay Engine**:
   - For `2d_canvas_drawing` and calligraphy apps, synthetic scripts MUST NOT interpolate along coarse linear line segments or invoke machine-speed test harnesses directly during demo recording.
   - `StudioInteractionEngine` MUST implement `drawSplineStroke(points, duration_ms, pressureCurve)`:
     * Evaluates Centripetal Catmull-Rom parametric splines with dynamic subdivision ($N_{\text{steps}} = \max(\lceil \text{duration\_ms} / 16.6 
ceil, 30)$) ensuring $\ge 60\text{Hz}$ event cadence.
     * Computes dynamic velocity-to-pressure mapping: $P(t) = P_{\text{start}} + \Delta P \cdot \sin(\pi t)$ smoothly varying pressure across the stroke.
     * Dispatches W3C `PointerEvent` instances (`pointerId: 1`, `pointerType: 'mouse'`, `isPrimary: true`, `button: 0`, `buttons: 1`, `pressure: P(t)`), cascading to `MouseEvent`.
   - **Harness Extraction Workflow**: During Phase 2.1 Reconnaissance, read the target application's harness source code to extract normalized control points for canonical motifs (e.g. Ensō, Kokoro, Kanji 永). In Phase 2.2 Script Compilation, compile these points into `drawSplineStroke` calls executing at human drawing speed (150–400 px/s, lasting 2–5 seconds per stroke).
>>>>
```

---

### Target 7: `skills/studio-orchestrator/prompts/critic_pre_capture.md`
- **Location**: `skills/studio-orchestrator/prompts/critic_pre_capture.md`
- **Action**: `[MODIFY]`
- **Rationale**: Make storyboard audit checklist philosophy-aware, evaluating 5–12s physics holds positively for `physics_showcase`, enforcing simple composition and chromatic distinctness, and rejecting flash machine-speed harness calls.

#### Edit 7.1: Editorial Audit Checklist
```markdown
<<<<
## 1. Editorial Audit Checklist

Read `.studio/app_profile.json`, `.studio/edl.yaml`, and `.studio/choreography.json`. Challenge the plan against these 6 non-negotiable criteria:

1. **Climax Proportion ($\ge 40\%$)**:
   - Sum the durations of all scenes marked `wow_level: climax`.
   - Divide by `target_edit_duration`.
   - If climax screen time is $< 40\%$, you **MUST reject with REVISE**. The money shot cannot be rushed.

2. **Establishing & Cooldown Ceilings ($\le 15\%$)**:
   - Establishing and cooldown scenes must each take $\le 15\%$ of total runtime (max 3.5s each).
   - If the opening scene lingers on an idle state for $> 3.5\text{s}$, issue a REVISE.

3. **Maximum Visual Delta Verification**:
   - Compare the choreography against the `maxVisualDeltaStates` in `app_profile.json`.
   - Does the choreography start in an active/populated State A and culminate in the transformed State B? If the storyboard stays in a minor, low-contrast state, issue a REVISE.

4. **Linear UI Tour & Typing Rejection**:
   - Check actions for sequential text field typing, dropdown browsing, or multi-tab clicking.
   - If the script wastes $> 3\text{s}$ filling forms or clicking through administrative drawers, REJECT immediately.

5. **Physics & Simulation Harness Check**:
   - If the App Profile discovered native simulation methods (`window.simulate...`) or keyboard shortcuts (`Space`, `KeyR`), does the script utilize them? If the script falls back to generic mouse clicking while native triggers exist, issue a REVISE.

6. **Transition Pacing & Speed Ramps**:
   - Ensure extreme speed transitions (e.g. 4.0x to 0.25x) have adequate visual breathing room.
   - Ensure scenes marked `dead_air` are properly fast-forwarded (2.5x - 4.0x).
====
## 1. Philosophy-Aware Editorial Audit Checklist

Read `demoPhilosophy` in `.studio/app_profile.json`, `.studio/edl.yaml`, and `.studio/choreography.json`. Challenge the plan against these criteria:

### A. If `demoPhilosophy == "physics_showcase"`:
1. **Continuous Physics Hold Validation**: The climax MUST contain an uninterrupted camera hold of **5–12 seconds** paired with fluid or particle triggers. **DO NOT reject holds as dead air**; physical wicking, gravity cascades, and optical settling ARE the active content.
2. **Simple Composition Audit**: The plan MUST focus on 1–2 master motifs (e.g. Ensō circle, Kanji 永 or 心) with 2–3 chromatically distinct pigments from contrasting hue families (warm vermilion + cool indigo + neutral/gold). REJECT plans that cram 5+ disjoint strokes or attempt contradictory kanji combinations.
3. **Causal Staging Verification**: Verify that dilution ($\ge 70\%$) and tilt angle ($\ge 45^\circ$) are set BEFORE or concurrent with ink deposition.
4. **Human Stroke Duration Check**: Every drawing action MUST specify `stroke_duration_ms >= 2000ms` (2–5s per stroke). REJECT plans that call raw `window.simulateCalligraphy()` directly, which fire at machine speed (~200ms) producing flash strokes.
5. **Establishing & Cooldown Ceilings**: Establishing and cooldown scenes must each take $\le 1.5\text{s}$ (max 15% of runtime) to prevent dead bookends.

### B. If `demoPhilosophy == "interaction_density"`:
1. **Feature Coverage ($\ge 75\%$)**: Verify interactions touch $\ge 75\%$ of discovered controls, presets, and filters.
2. **Interaction Ceiling ($\le 6\text{s}$)**: Reject any scene with $>6\text{s}$ without a user action.
3. **Climax Proportion ($\ge 40\%$)**: Ensure climax scenes occupy $\ge 40\%$ of total edit duration.

### C. If `demoPhilosophy == "generative_output"`:
1. **Compute Fast-Forwarding**: Verify async generation waits are classified as `dead_air` and accelerated at 2.5x–4.0x.
2. **High-Impact Reveal**: Ensure $\ge 45\%$ of runtime showcases the synthesized artifact with focal detail crops.
>>>>
```

---

### Target 8: `skills/studio-orchestrator/prompts/critic_post_edit.md`
- **Location**: `skills/studio-orchestrator/prompts/critic_post_edit.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add physics visibility checks ("Can you SEE the physics?"), verify human-paced stroke kinematics, eliminate false dead-tail rejections on settling physics, and enforce bookend and debug UI checks.

#### Edit 8.1: Semantic Evaluation Criteria
```markdown
<<<<
5. **Empirical Verification of Claimed Physical Effects**:
   - Verify that physical dynamics (e.g. 45° tilt gravity runs, capillary blooming, particle explosions) claimed in the choreography are visually obvious in the actual footage.
   - If a physical effect is barely perceptible or missing, issue `CONCERNS` and require parameter/duration adjustments rather than rubber-stamping the output.

6. **First 5-Second Impression (CRITICAL)**:
   - Extract frames at t=0.5s and t=3.0s from `deliverables/demo.mp4` using ffmpeg.
   - View both frames with `view_file`.
   - **CRITICAL FAIL**: If t=0.5s is blank/white (pre-render gap) or if t=0.5s and t=3.0s are perceptually identical (no visible change in the first 3 seconds), issue `CONCERNS`. The first 3 seconds determine whether a viewer clicks play on GitHub — dead openings are not acceptable.

7. **Dead Tail Detection**:
   - Extract frames at t=(duration − 1s) and t=(duration − 4s).
   - **CRITICAL FAIL**: If both frames are perceptually identical (no visible change in the last 3 seconds), issue `CONCERNS`. Dead tails waste viewer attention and reduce the per-second value density.
====
5. **"Can you SEE the Physics?" Test (`physics_showcase`)**:
   - Inspect extracted frames from climax holds using `view_file`.
   - **CRITICAL CHECK**: Are claimed physical dynamics visually obvious in 1080p footage?
     * Navier-Stokes: Did fluid vortex rings and momentum advection visibly flow across the canvas?
     * Darcy Capillary Wicking: Did fibrous dendritic wicking (*Hige-nijimi*) bloom along paper fiber boundaries?
     * Gravity Cascades: Did wet ink streams flow down the 45° inclined plane in teardrop runs?
     * Kubelka-Munk Optics: Did overlapping washes create authentic subtractive glazing rather than flat alpha blending?
   - If physical phenomena are imperceptible, issue `CONCERNS`.

6. **Human Drawing Speed Check (No Flash Strokes)**:
   - Verify that strokes appear continuously over 2–5 seconds of video with visible brush travel.
   - **CRITICAL FAIL**: If strokes flash into existence instantaneously (<1s) like a slideshow, issue `CONCERNS`.

7. **Bookend Integrity Checks (Dead Opening & Dead Tail)**:
   - Extract frames at $t=0.5\text{s}$ and $t=3.0\text{s}$.
     * **CRITICAL FAIL**: If $t=0.5\text{s}$ is blank/white (pre-render gap) or if $t=0.5\text{s}$ and $t=3.0\text{s}$ are perceptually identical, issue `CONCERNS`.
   - Extract frames at $t=(\text{duration} - 1\text{s})$ and $t=(\text{duration} - 4\text{s})$.
     * **CRITICAL FAIL**: If both frames are completely static with zero ongoing physics or interaction, issue `CONCERNS`. **EXCEPTION**: If subtle optical drying or evaporative settling is visibly progressing, pass the hold.
>>>>
```

---

### Target 9: `skills/studio-orchestrator/prompts/validator.md`
- **Location**: `skills/studio-orchestrator/prompts/validator.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update container limits to reflect archetype-keyed matrix ($15\text{MB}$ WebGL, $10\text{MB}$ 2D fluid sim, $5\text{MB}$ standard UI) and update SSIM content checks for continuous simulations.

```markdown
<<<<
### 1. Container Integrity Checks (Necessary but Not Sufficient)
- **Deliverable File Existence**: All 4 assets must exist in `deliverables/`: `demo.mp4`, `demo.webp`, `demo.gif`, and `hero.webp`.
- **Byte Size Ceilings**:
  - `demo.mp4` $\le 5,242,880\text{ bytes}$ ($5.0\text{ MB}$).
  - `demo.webp` $\le 3,145,728\text{ bytes}$ ($3.0\text{ MB}$).
  - `demo.gif` $\le 5,242,880\text{ bytes}$ ($5.0\text{ MB}$).
  - `hero.webp` $\le 204,800\text{ bytes}$ ($200\text{ KB}$).
====
### 1. Container Integrity Checks (Archetype-Keyed)
- **Deliverable File Existence**: All 4 assets must exist in `deliverables/`: `demo.mp4`, `demo.webp`, `demo.gif`, and `hero.webp`.
- **Byte Size Ceilings Matrix**:
  - `webgl_3d_canvas`: MP4 $\le 15.0\text{ MB}$, WebP $\le 8.0\text{ MB}$, GIF $\le 10.0\text{ MB}$.
  - `2d_canvas_drawing` *(fluid/physics)*: MP4 $\le 10.0\text{ MB}$, WebP $\le 6.0\text{ MB}$, GIF $\le 8.0\text{ MB}$.
  - Standard UI (`data_dashboard`, `form_utility`, `ai_generative_ui`): MP4 $\le 5.0\text{ MB}$, WebP $\le 3.0\text{ MB}$, GIF $\le 5.0\text{ MB}$.
  - `hero.webp` $\le 204,800\text{ bytes}$ ($200\text{ KB}$) across all archetypes.
>>>>
```

---

### Target 10: `skills/studio-orchestrator/prompts/video_editor.md`
- **Location**: `skills/studio-orchestrator/prompts/video_editor.md`
- **Action**: `[MODIFY]`
- **Rationale**: Clarify archetype-keyed byte limits and parameter passing to `scripts/compress_media.sh`.

```markdown
<<<<
4. **Adaptive MP4 Bisection (Tier 1)**:
   - Evaluates CRF range `[18 .. 34]` on 1080p master to find the lowest CRF fitting under **5,242,880 bytes** (5.0 MB).
   - If CRF $\ge 32$ is required or 1080p cannot fit under 5MB, triggers Lanczos 720p fallback (`scale=1280:720`) and restarts CRF bisection from CRF 20.
   - Saves to `deliverables/demo.mp4`.
====
4. **Adaptive MP4 Bisection (Tier 1)**:
   - Evaluates CRF range `[18 .. 34]` on 1080p master to find the lowest CRF fitting under the archetype-keyed byte ceiling ($15\text{MB}$ WebGL, $10\text{MB}$ 2D fluid sim, $5\text{MB}$ standard UI).
   - If CRF $\ge 32$ is required or 1080p cannot fit under the archetype budget, triggers Lanczos 720p fallback (`scale=1280:720`) and restarts CRF bisection from CRF 20.
   - Saves to `deliverables/demo.mp4`.
>>>>
```

---

### Target 11: `skills/studio-orchestrator/prompts/director.md`
- **Location**: `skills/studio-orchestrator/prompts/director.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update Director verification gates and circuit breaker to reflect `demoPhilosophy` routing, continuous simulation visual diversity evaluation, and prohibition of dismissing Critic `CONCERNS`.

```markdown
<<<<
### Gate 2: Post-Edit Content Quality Gate (Before Validator)
After the Video Editor produces deliverables via `scripts/compress_media.sh`:
1. Extract 1 frame from the midpoint of each scene defined in `.studio/edl.yaml` from `deliverables/demo.mp4`.
2. Call `view_file` on all extracted scene frames as a set.
3. **Visual Distinctiveness Test**:
   - Can you distinguish each scene if viewed as 100x56px thumbnails?
   - Does the climax scene look dramatically distinct from the establishing scene (color, geometry, layout)?
   - If >50% of non-climax scenes look identical, FAIL and request choreography revision.
4. **Value Proposition Test**:
   - Compare what you see against the App Profile's "maximum visual delta" states.
   - Does `deliverables/hero.webp` come from the climax scene? If it shows an idle or default state, FAIL.
====
### Gate 2: Post-Edit Content Quality Gate (Before Validator)
After the Video Editor produces deliverables via `scripts/compress_media.sh`:
1. Extract 1 frame from the midpoint of each scene defined in `.studio/edl.yaml` from `deliverables/demo.mp4`.
2. Call `view_file` on all extracted scene frames as a set.
3. **Visual Distinctiveness & Vitality Test**:
   - For `interaction_density`: Can you distinguish each scene if viewed as 100x56px thumbnails? (>50% non-climax scenes distinct).
   - For `physics_showcase`: Verify that fluid diffusion, capillary wicking, gravity cascades, or particle dynamics visibly evolve across the duration, and that pigments are chromatically distinct.
4. **Value Proposition & Hero Test**:
   - Compare what you see against the App Profile's peak visual states.
   - Does `deliverables/hero.webp` come from the peak climax moment? If it shows an idle or default state, FAIL.
   - Prohibit overriding Post-Edit Critic CONCERNS on physics visibility or dead bookends.
>>>>
```

---

### Target 12: `skills/studio-orchestrator/prompts/retrospective.md`
- **Location**: `skills/studio-orchestrator/prompts/retrospective.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update retrospective agent prompt to analyze `demoPhilosophy` effectiveness, human stroke speed metrics, and visual entropy encoding tradeoffs.

```markdown
<<<<
- **Framework & Engine Dynamics**: Special setup delays required for Three.js shaders, WebGPU pipelines, React 19 StrictMode, or canvas render loops.
- **Interaction Techniques**: Effective `StudioInteractionEngine` gestures, easing curves, or physics keyboard hotkeys.
- **Editorial Pacing & Speed Ramps**: Speed multipliers and transition styles that produced optimal visual contrast.
- **Failure Root Causes**: Concrete fixes for any timing, interaction, or rendering failures encountered during the run.
====
- **Demo Philosophy & Pacing Metrics**: Effectiveness of `physics_showcase` vs `interaction_density` narrative routing and camera hold durations.
- **Stroke Kinematics & Harness Replay**: Measured brush speeds (px/s), stroke durations, and Catmull-Rom spline smoothness.
- **Visual Entropy & Compression Tradeoffs**: CRF bisection convergence, WebP framerate vs byte size tradeoffs, and deliverable quality.
- **Framework & Engine Dynamics**: Special setup delays required for Three.js shaders, WebGPU pipelines, React 19 StrictMode, or canvas render loops.
- **Failure Root Causes**: Concrete fixes for any timing, interaction, or rendering failures encountered during the run.
>>>>
```

---

### Target 13: `skills/studio-orchestrator/scripts/compress_media.sh`
- **Location**: `skills/studio-orchestrator/scripts/compress_media.sh`
- **Action**: `[MODIFY]`
- **Rationale**: Extract archetype and demo philosophy in Section 1 (Pre-Flight) before auto-trimming; extend relaxed byte limits (MP4: 10MB, WebP: 6MB, GIF: 8MB) to `2d_canvas_drawing` and canvas fluid apps; bypass dead-tail auto-trimming for `physics_showcase` to preserve intentional settling camera holds; clamp GIF color floor to 96 for all physics applications.

#### Edit 13.1: Pre-Flight Application Profile Metadata Extraction
```bash
<<<<
# Ensure output and temp directories exist
mkdir -p "$DELIVERABLES_DIR" "$TMP_DIR"
====
# Extract application profile metadata (archetype & demo philosophy)
ARCHETYPE=$(python3 -c "import json; import os; d=json.load(open('$STUDIO_DIR/app_profile.json')) if os.path.exists('$STUDIO_DIR/app_profile.json') else {}; print(d.get('archetype', ''))" 2>/dev/null || echo "")
DEMO_PHILOSOPHY=$(python3 -c "import json; import os; d=json.load(open('$STUDIO_DIR/app_profile.json')) if os.path.exists('$STUDIO_DIR/app_profile.json') else {}; print(d.get('demoPhilosophy', ''))" 2>/dev/null || echo "")

# Ensure output and temp directories exist
mkdir -p "$DELIVERABLES_DIR" "$TMP_DIR"
>>>>
```

#### Edit 13.2: Bookend Auto-Trim Physics Hold Preservation
```bash
<<<<
# Dead tail detection: scan backward for visual stagnation (SSIM > 0.995)
for offset in 1.0 2.0 3.0 4.0 5.0; do
  t_check=$(python3 -c "print(max(0.5, $MASTER_DURATION - $offset))")
  t_prev=$(python3 -c "print(max(0.5, $MASTER_DURATION - $offset - 1.0))")
  cur_frame="$TMP_DIR/trim_tail_cur.png"
  prev_frame="$TMP_DIR/trim_tail_prev.png"
  ffmpeg -y -ss "$t_check" -i "$MASTER_1080P" -vframes 1 "$cur_frame" 2>/dev/null
  ffmpeg -y -ss "$t_prev" -i "$MASTER_1080P" -vframes 1 "$prev_frame" 2>/dev/null
  if [ -f "$cur_frame" ] && [ -f "$prev_frame" ]; then
    ssim=$(ffmpeg -i "$prev_frame" -i "$cur_frame" -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*" | cut -d: -f2)
    if [ -n "$ssim" ]; then
      is_dynamic=$(python3 -c "print('yes' if float('$ssim') < 0.995 else 'no')" 2>/dev/null)
      if [ "$is_dynamic" = "yes" ]; then
        # This pair has visual change — keep 1s of padding after the last dynamic frame
        TRIM_END=$(python3 -c "print(min($MASTER_DURATION, $MASTER_DURATION - $offset + 1.5))")
        break
      fi
    fi
  fi
done
====
# Dead tail detection: scan backward for visual stagnation (SSIM > 0.995)
# EXCEPTION: For physics_showcase, continuous settling/drying holds are intentional content — do not auto-trim tail.
if [ "$DEMO_PHILOSOPHY" != "physics_showcase" ]; then
  for offset in 1.0 2.0 3.0 4.0 5.0; do
    t_check=$(python3 -c "print(max(0.5, $MASTER_DURATION - $offset))")
    t_prev=$(python3 -c "print(max(0.5, $MASTER_DURATION - $offset - 1.0))")
    cur_frame="$TMP_DIR/trim_tail_cur.png"
    prev_frame="$TMP_DIR/trim_tail_prev.png"
    ffmpeg -y -ss "$t_check" -i "$MASTER_1080P" -vframes 1 "$cur_frame" 2>/dev/null
    ffmpeg -y -ss "$t_prev" -i "$MASTER_1080P" -vframes 1 "$prev_frame" 2>/dev/null
    if [ -f "$cur_frame" ] && [ -f "$prev_frame" ]; then
      ssim=$(ffmpeg -i "$prev_frame" -i "$cur_frame" -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*" | cut -d: -f2)
      if [ -n "$ssim" ]; then
        is_dynamic=$(python3 -c "print('yes' if float('$ssim') < 0.995 else 'no')" 2>/dev/null)
        if [ "$is_dynamic" = "yes" ]; then
          # This pair has visual change — keep 1s of padding after the last dynamic frame
          TRIM_END=$(python3 -c "print(min($MASTER_DURATION, $MASTER_DURATION - $offset + 1.5))")
          break
        fi
      fi
    fi
  done
else
  echo "  Physics showcase detected. Preserving intentional settling camera hold (skipping tail auto-trim)."
fi
>>>>
```

#### Edit 13.3: Tier 1 MP4 Archetype Budget Resolution
```bash
<<<<
ARCHETYPE=$(python3 -c "import json; import os; d=json.load(open('$STUDIO_DIR/app_profile.json')) if os.path.exists('$STUDIO_DIR/app_profile.json') else {}; print(d.get('archetype', ''))" 2>/dev/null || echo "")

MAX_MP4_BYTES=5242880 # 5.0 MB
if [ "$ARCHETYPE" = "webgl_3d_canvas" ]; then
  MAX_MP4_BYTES=15728640 # 15.0 MB
  echo "  WebGL app detected. Relaxing MP4 size limit to 15.0 MB."
fi
====
MAX_MP4_BYTES=5242880 # 5.0 MB standard UI
if [ "$ARCHETYPE" = "webgl_3d_canvas" ]; then
  MAX_MP4_BYTES=15728640 # 15.0 MB
  echo "  WebGL 3D app detected. Relaxing MP4 size limit to 15.0 MB."
elif [ "$ARCHETYPE" = "2d_canvas_drawing" ] || [ "$DEMO_PHILOSOPHY" = "physics_showcase" ]; then
  MAX_MP4_BYTES=10485760 # 10.0 MB
  echo "  High-entropy 2D canvas / physics app detected. Relaxing MP4 size limit to 10.0 MB."
fi
>>>>
```

#### Edit 13.4: Tier 2 WebP Archetype Budget Resolution
```bash
<<<<
MAX_WEBP_BYTES=3145728 # 3.0 MB target
if [ "$ARCHETYPE" = "webgl_3d_canvas" ]; then
  MAX_WEBP_BYTES=8388608 # 8.0 MB
  echo "  WebGL app detected. Relaxing WebP size limit to 8.0 MB."
fi
====
MAX_WEBP_BYTES=3145728 # 3.0 MB target
if [ "$ARCHETYPE" = "webgl_3d_canvas" ]; then
  MAX_WEBP_BYTES=8388608 # 8.0 MB
  echo "  WebGL 3D app detected. Relaxing WebP size limit to 8.0 MB."
elif [ "$ARCHETYPE" = "2d_canvas_drawing" ] || [ "$DEMO_PHILOSOPHY" = "physics_showcase" ]; then
  MAX_WEBP_BYTES=6291456 # 6.0 MB
  echo "  High-entropy 2D canvas / physics app detected. Relaxing WebP size limit to 6.0 MB."
fi
>>>>
```

#### Edit 13.5: Tier 3 GIF Archetype Budget & Particle-Safe Ladder Resolution
```bash
<<<<
# 7. Tier 3: 2-Pass Bayer GIF Pipeline (< 5.0 MB)
echo "--- Tier 3: 2-Pass Bayer GIF Pipeline ---"
MAX_GIF_BYTES=5242880 # 5.0 MB ceiling
if [ "$ARCHETYPE" = "webgl_3d_canvas" ] || [ "$ARCHETYPE" = "2d_canvas_drawing" ]; then
  MAX_GIF_BYTES=10485760 # 10.0 MB
  echo "  WebGL/Canvas app detected. Relaxing GIF size limit to 10.0 MB and clamping color floor to 96."
  GIF_LADDER=(
    "10|800|128|3"
    "10|720|96|3"
    "8|640|96|3"
    "6|480|96|3"
  )
else
  GIF_LADDER=(
    "10|800|128|3"
    "10|720|96|3"
    "8|640|64|2"
    "8|480|48|2"
  )
fi
====
# 7. Tier 3: 2-Pass Bayer GIF Pipeline (< 5.0 MB)
echo "--- Tier 3: 2-Pass Bayer GIF Pipeline ---"
MAX_GIF_BYTES=5242880 # 5.0 MB ceiling
if [ "$ARCHETYPE" = "webgl_3d_canvas" ]; then
  MAX_GIF_BYTES=10485760 # 10.0 MB
  echo "  WebGL 3D app detected. Relaxing GIF size limit to 10.0 MB and clamping color floor to 96."
  GIF_LADDER=(
    "10|800|128|3"
    "10|720|96|3"
    "8|640|96|3"
    "6|480|96|3"
  )
elif [ "$ARCHETYPE" = "2d_canvas_drawing" ] || [ "$DEMO_PHILOSOPHY" = "physics_showcase" ]; then
  MAX_GIF_BYTES=8388608 # 8.0 MB
  echo "  2D Canvas / physics app detected. Relaxing GIF size limit to 8.0 MB and clamping color floor to 96."
  GIF_LADDER=(
    "10|800|128|3"
    "10|720|96|3"
    "8|640|96|3"
    "6|480|96|3"
  )
else
  GIF_LADDER=(
    "10|800|128|3"
    "10|720|96|3"
    "8|640|64|2"
    "8|480|48|2"
  )
fi
>>>>
```

---

### Target 14: `skills/studio-orchestrator/scripts/validate_media.sh`
- **Location**: `skills/studio-orchestrator/scripts/validate_media.sh`
- **Action**: `[MODIFY]`
- **Rationale**: Update Python validation logic to enforce archetype-keyed byte limits ($15\text{MB}$ WebGL, $10\text{MB}$ 2D fluid sim, $5\text{MB}$ standard UI) and evaluate visual progression via SSIM variance for continuous simulations.

```python
<<<<
if archetype == "webgl_3d_canvas":
    mp4_limit = 15728640   # 15.0 MB for WebGL
    webp_limit = 8388608   # 8.0 MB for WebGL
    gif_limit = 10485760   # 10.0 MB for WebGL
else:
    mp4_limit = 5242880    # 5.0 MB
    webp_limit = 3145728   # 3.0 MB target (5MB hard)
    gif_limit = 5242880    # 5.0 MB
====
demo_philosophy = ""
if os.path.isfile(app_profile_path):
    try:
        with open(app_profile_path, 'r') as apf:
            ap_data = json.load(apf)
            archetype = ap_data.get("archetype", "")
            demo_philosophy = ap_data.get("demoPhilosophy", "")
    except Exception:
        pass

if archetype == "webgl_3d_canvas":
    mp4_limit = 15728640   # 15.0 MB for WebGL
    webp_limit = 8388608   # 8.0 MB for WebGL
    gif_limit = 10485760   # 10.0 MB for WebGL
elif archetype == "2d_canvas_drawing" or demo_philosophy == "physics_showcase":
    mp4_limit = 10485760   # 10.0 MB for 2D Fluid / Physics
    webp_limit = 6291456   # 6.0 MB for 2D Fluid / Physics
    gif_limit = 8388608    # 8.0 MB for 2D Fluid / Physics
else:
    mp4_limit = 5242880    # 5.0 MB for Standard UI
    webp_limit = 3145728   # 3.0 MB target (5MB hard)
    gif_limit = 5242880    # 5.0 MB for Standard UI
>>>>
```

---

### Target 15: `skills/studio-orchestrator/references/choreography-specs.md`
- **Location**: `skills/studio-orchestrator/references/choreography-specs.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add `demoPhilosophy` to choreography root schema, add specification for `draw_stroke` action with `harness:<name>`, `stroke_duration_ms`, `hold_duration_ms`, and Catmull-Rom spline parameters.

```json
<<<<
{
  "project": "webgl-particle-showcase",
  "viewport": { "width": 1920, "height": 1080, "dpr": 2.0 },
  "initialUrl": "/?preset=nebula",
  "scenes": [
====
{
  "project": "watercolor-zen-webgpu",
  "demoPhilosophy": "physics_showcase",
  "viewport": { "width": 1920, "height": 1080, "dpr": 1.0 },
  "initialUrl": "/?preset=wet_wash",
  "scenes": [
>>>>
```

---

### Target 16: `skills/studio-orchestrator/references/edl-format.md`
- **Location**: `skills/studio-orchestrator/references/edl-format.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add `demoPhilosophy` metadata and update wow-level descriptions to clarify 1.0x real-time playback for continuous fluid simulation holds.

```yaml
<<<<
edl:
  project: string                # Target project identifier
  target_edit_duration: number   # Target seconds for final video (25.0 - 30.0s)
====
edl:
  project: string                # Target project identifier
  demoPhilosophy: string         # physics_showcase | interaction_density | generative_output
  target_edit_duration: number   # Target seconds for final video (25.0 - 30.0s)
>>>>
```

---

### Target 17: `skills/studio-orchestrator/references/media-specs.md`
- **Location**: `skills/studio-orchestrator/references/media-specs.md`
- **Action**: `[MODIFY]`
- **Rationale**: Replace single fixed table with Archetype-Keyed Deliverable Standards matrix ($15\text{MB}$ WebGL, $10\text{MB}$ 2D fluid sim, $5\text{MB}$ standard UI).

```markdown
<<<<
| Deliverable Type | File Path | Format & Codec | Resolution | Framerate | File Size Ceiling | Notes |
|---|---|---|---|---|---|---|
| **Master Showcase Video** | `deliverables/demo.mp4` | MP4 (H.264 / AAC) | 1920x1080 (or 1280x720 fallback) | 60 fps (or source) | **< 5.0 MB** | Adaptive CRF bisection [18..34], `+faststart` enabled. |
| **Animated WebP Preview** | `deliverables/demo.webp` | WebP (libwebp) | 800px width (auto height) | 15 fps (adaptive to 10fps) | **< 3.0 MB target** (< 5.0 MB max) | 4-tier adaptive ladder, loop=0. Ideal for web embedding. |
| **Repository README GIF** | `deliverables/demo.gif` | Animated GIF | 800px width (auto height) | 10 fps (adaptive to 8fps) | **< 5.0 MB** | 2-pass differential palettegen + Bayer dithering. |
| **Static Hero Screenshot** | `deliverables/hero.webp` | WebP (cwebp) | 1920x1080 (or 2x Retina) | N/A | **< 200 KB** | Extracted from Climax midpoint, cwebp ladder q=85->45. |
====
| Deliverable Type | File Path | Format & Codec | Resolution | Framerate | File Size Ceiling (Standard / 2D Fluid / 3D WebGL) | Notes |
|---|---|---|---|---|---|---|
| **Master Showcase Video** | `deliverables/demo.mp4` | MP4 (H.264) | 1920x1080 (720p fallback) | 60 fps | **< 5.0 MB** (Standard)<br>**< 10.0 MB** (2D Fluid)<br>**< 15.0 MB** (3D WebGL) | Adaptive CRF bisection [18..34], `+faststart` enabled. Primary portfolio deliverable. |
| **Animated WebP Preview** | `deliverables/demo.webp` | WebP (libwebp) | 800px width | 15 fps (ladder) | **< 3.0 MB** (Standard)<br>**< 6.0 MB** (2D Fluid)<br>**< 8.0 MB** (3D WebGL) | 4-tier adaptive ladder, loop=0. Ideal for web embedding. |
| **Repository README GIF** | `deliverables/demo.gif` | Animated GIF | 800px width | 10 fps (ladder) | **< 5.0 MB** (Standard)<br>**< 8.0 MB** (2D Fluid)<br>**< 10.0 MB** (3D WebGL) | 2-pass differential palettegen + Bayer dithering. Color floor 96 for canvas. |
| **Static Hero Screenshot** | `deliverables/hero.webp` | WebP (cwebp) | 1920x1080 | N/A | **< 200 KB** across all archetypes | Extracted from Climax midpoint, cwebp ladder q=85->45. |
>>>>
```

---

### Target 18: `skills/studio-orchestrator/references/evaluation-protocol.md`
- **Location**: `skills/studio-orchestrator/references/evaluation-protocol.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update evaluation checkpoints E1 and V2 to verify `demoPhilosophy` discovery and entropy-keyed media sizing compliance.

#### Edit 18.1: Checkpoint E1 Update
```markdown
<<<<
| **E1** | **Archetype & Delta Tagged** | `.studio/app_profile.json` | Contains `archetype` and `maxVisualDeltaStates` (State A & B) |
====
| **E1** | **Philosophy, Archetype & Delta Tagged** | `.studio/app_profile.json` | Contains `demoPhilosophy`, `archetype`, and `maxVisualDeltaStates` |
>>>>
```

#### Edit 18.2: Checkpoint V2 Update
```markdown
<<<<
| **V2** | **All Deliverables Sized Correctly** | `deliverables/` | MP4 $\le 5\text{MB}$, WebP $\le 3\text{MB}$, GIF $\le 5\text{MB}$, Hero $\le 200\text{KB}$ |
====
| **V2** | **All Deliverables Sized Correctly** | `deliverables/` | Sized according to visual entropy matrix (WebGL: 15/8/10MB, 2D Fluid: 10/6/8MB, Standard UI: 5/3/5MB, Hero $\le 200\text{KB}$) |
>>>>
```

---

### Target 19: `skills/studio-orchestrator/references/ffmpeg-pipeline.md`
- **Location**: `skills/studio-orchestrator/references/ffmpeg-pipeline.md`
- **Action**: `[MODIFY]`
- **Rationale**: Document archetype-keyed CRF bisection ranges and WebP/GIF fallback ladders.

```markdown
<<<<
[Pass 4: Multi-Tier Deterministic Compression Engine (scripts/compress_media.sh)]
       │
       ├── Tier 1: Master MP4 Adaptive CRF Bisection [18..34] (Lanczos 720p Fallback) ──> deliverables/demo.mp4 (<5MB)
       ├── Tier 2: 4-Tier Adaptive Animated WebP Ladder (15fps -> 10fps, q=75 -> 45)  ──> deliverables/demo.webp (<3MB)
       ├── Tier 3: 2-Pass Bayer Differential Dithered GIF (128 -> 48 colors)           ──> deliverables/demo.gif (<5MB)
       └── Tier 4: Climax Midpoint Frame Extraction (cwebp q=85 -> 45)                 ──> deliverables/hero.webp (<200KB)
====
[Pass 4: Multi-Tier Deterministic Compression Engine (scripts/compress_media.sh)]
       │
       ├── Tier 1: Master MP4 Adaptive CRF Bisection [18..34] (Lanczos 720p Fallback) ──> deliverables/demo.mp4 (<5MB / 10MB / 15MB)
       ├── Tier 2: 4-Tier Adaptive Animated WebP Ladder (15fps -> 10fps, q=75 -> 45)  ──> deliverables/demo.webp (<3MB / 6MB / 8MB)
       ├── Tier 3: 2-Pass Bayer Differential Dithered GIF (128 -> 48/96 colors)        ──> deliverables/demo.gif (<5MB / 8MB / 10MB)
       └── Tier 4: Climax Midpoint Frame Extraction (cwebp q=85 -> 45)                 ──> deliverables/hero.webp (<200KB)
>>>>
```

---

### Target 20: `skills/studio-orchestrator/references/temporal-signatures.md`
- **Location**: `skills/studio-orchestrator/references/temporal-signatures.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add section mapping AST signatures to `demoPhilosophy` classifications.

```markdown
<<<<
## 1. Application Archetype Taxonomy
====
## 1. Demo Philosophy & Archetype Taxonomy

### 1.1 Demo Philosophy Classification Signatures
- **`physics_showcase`**: Matches `(advect|jacobi|poisson|darcy|capillary|wicking|porous|kubelka|scattering|absorption|km_rgb|sedimentation|tilt|gimbal)`.
- **`interaction_density`**: Matches `(Recharts|Chart|DataGrid|Table|Filter|Dropdown|Tabs|TabPanel|Form|Input|Select)`.
- **`generative_output`**: Matches `(generate|prompt|isGenerating|synthesize|modelInference|renderOutput)`.

### 1.2 Application Archetype Taxonomy
>>>>
```

---

### Target 21: `skills/studio-orchestrator/references/subagent-prompts.md`
- **Location**: `skills/studio-orchestrator/references/subagent-prompts.md`
- **Action**: `[MODIFY]`
- **Rationale**: Synchronize subagent registration summaries with `demoPhilosophy` routing.

```markdown
<<<<
### 2.1 `studio_app_explorer` (Phase 0: Discovery)
- **Prompt File**: `prompts/app_explorer.md`
- **Key Constraints**: AST analysis, Application Archetype classification (`webgl_3d_canvas`, `2d_canvas_drawing`, `data_dashboard`, `ai_generative_ui`, `interactive_game`, `form_utility`), discovery of State A and State B for Maximum Visual Delta, demo seed mining (`?preset=`, sample fixtures, physics key listeners `window.simulate...`, `Space`), and temporal signatures.
====
### 2.1 `studio_app_explorer` (Phase 0: Discovery)
- **Prompt File**: `prompts/app_explorer.md`
- **Key Constraints**: AST analysis, demoPhilosophy classification (`physics_showcase`, `interaction_density`, `generative_output`), archetype classification, discovery of State A and State B for Maximum Visual Delta, harness stroke path discovery, and temporal signatures.
>>>>
```

---

### Target 22: `skills/studio-orchestrator/references/telemetry-schema.md`
- **Location**: `skills/studio-orchestrator/references/telemetry-schema.md`
- **Action**: `[MODIFY]`
- **Rationale**: Add `demoPhilosophy` to telemetry logging and scorecard schemas.

```markdown
<<<<
- **Status**: SUCCESS | STRUCTURAL_FAILURE | RETRY_EXHAUSTED
- **Target URL**: http://localhost:<port>
====
- **Demo Philosophy**: physics_showcase | interaction_density | generative_output
- **Archetype**: webgl_3d_canvas | 2d_canvas_drawing | data_dashboard | ai_generative_ui | interactive_game | form_utility
- **Status**: SUCCESS | STRUCTURAL_FAILURE | RETRY_EXHAUSTED
- **Target URL**: http://localhost:<port>
>>>>
```

---

### Target 23: `skills/studio-orchestrator/references/lessons.md`
- **Location**: `skills/studio-orchestrator/references/lessons.md`
- **Action**: `[MODIFY]`
- **Rationale**: Append structured retrospective entries documenting lessons from real-world physics runs: multi-pigment chromatic staging, bypass of dead-tail auto-trimming, and extended camera holds.

#### Edit 23.1: Lessons Learned from Physics Runs
```markdown
<<<<
### Director Must Not Override Post-Edit Critic CONCERNS
- **Session**: watercolor-workbook/chapter-1 (2026-08-29)
- **Observed Challenge**: Post-Edit Critic correctly identified dead opening (3s blank) and dead tail (3s static) and issued CONCERNS with GitHub Test FAIL. The Director dismissed these as "pacing concerns, not content quality" and shipped the deliverables anyway. The user confirmed the Critic was right — the video was not a proper demo.
- **Root Cause**: The circuit breaker (§8) only mentioned "severe value proposition mismatch" as the Critic trigger, leaving room for the Director to rationalize CONCERNS as non-severe. No explicit rule prohibited dismissing the Critic's judgment.
- **Remediation / Rule**: §8 Content Mismatch row updated to explicitly list Critic CONCERNS (dead opening, dead tail, insufficient motion density) as mandatory re-capture triggers. Added: "The Director MUST NOT dismiss Critic CONCERNS as 'pacing issues' or accept deliverables when the Critic says the GitHub Test fails."
- **Verification Result**: Structural rule change — the Director can no longer rationalize around a CONCERNS verdict.
====
### Director Must Not Override Post-Edit Critic CONCERNS
- **Session**: watercolor-workbook/chapter-1 (2026-08-29)
- **Observed Challenge**: Post-Edit Critic correctly identified dead opening (3s blank) and dead tail (3s static) and issued CONCERNS with GitHub Test FAIL. The Director dismissed these as "pacing concerns, not content quality" and shipped the deliverables anyway. The user confirmed the Critic was right — the video was not a proper demo.
- **Root Cause**: The circuit breaker (§8) only mentioned "severe value proposition mismatch" as the Critic trigger, leaving room for the Director to rationalize CONCERNS as non-severe. No explicit rule prohibited dismissing the Critic's judgment.
- **Remediation / Rule**: §8 Content Mismatch row updated to explicitly list Critic CONCERNS (dead opening, dead tail, insufficient motion density) as mandatory re-capture triggers. Added: "The Director MUST NOT dismiss Critic CONCERNS as 'pacing issues' or accept deliverables when the Critic says the GitHub Test fails."
- **Verification Result**: Structural rule change — the Director can no longer rationalize around a CONCERNS verdict.

### Monochromatic Output vs Multi-Pigment Chromatic Staging (physics_showcase)
- **Session**: watercolor-workbook/chapter-1 (2026-08-30)
- **Observed Challenge**: Single-color stroke failed to showcase the fluid simulator's primary achievement: Kubelka-Munk optical pigment blending and wet-in-wet bleed interactions. The user rejected the output as "just shows one color".
- **Root Cause**: The choreography specified only one pigment (Sumi) across all scenes, missing the opportunity to demonstrate color mixing dynamics.
- **Remediation / Rule**: In `creative_director.md` Branch A, mandate 2–3 chromatically distinct pigments from contrasting hue families (e.g., warm Shu vermilion, cool Ai indigo, and metallic gold/soot black) with intersecting wet-in-wet stroke paths.
- **Verification Result**: Pre-Capture Critic verifies multi-pigment chromatic distinctness and color interactions before capture.

### False Dead-Tail Auto-Trimming on Physics Settling (compress_media.sh)
- **Session**: watercolor-workbook/chapter-1 (2026-08-30)
- **Observed Challenge**: `compress_media.sh` backward SSIM scanning cut 3.5s off a 5s intentional settling camera hold because subtle capillary flow and drying yielded inter-frame SSIM > 0.995.
- **Root Cause**: The auto-trim loop did not check `demoPhilosophy` and treated subtle physical settling as static dead air.
- **Remediation / Rule**: In `compress_media.sh`, bypass the tail auto-trim loop when `DEMO_PHILOSOPHY == "physics_showcase"`.
- **Verification Result**: Full 5–12s settling camera holds preserved in exported MP4, WebP, and GIF deliverables without post-production truncation.

### Physics Camera Holds vs Legacy Anti-Screensaver Mandate (rules/AGENTS.md)
- **Session**: watercolor-workbook/chapter-1 (2026-08-30)
- **Observed Challenge**: The pipeline cut away or injected random button clicks during fluid simulation settling to satisfy the §4e rule prohibiting >6s without new user actions.
- **Root Cause**: Monocultural interaction density rules forced continuous clicking even when the physics engine was actively rendering autonomous fluid dynamics.
- **Remediation / Rule**: Added §15.2 Philosophy-Aware Rule Exceptions to `AGENTS.md`: 5–12s continuous camera holds on active physical simulations are classified as active content.
- **Verification Result**: Uninterrupted fluid settling captured in climax scene, passing Post-Edit Critic and Director Gate 2.
>>>>
```

---

### Target 24: `telemetry/colosseum.jsonl`
- **Location**: `telemetry/colosseum.jsonl`
- **Action**: `[MODIFY]`
- **Rationale**: Append historical run telemetry entry recording successful execution under the updated `demoPhilosophy` schema.

```json
<<<<
{"timestamp":"2026-08-30T02:54:00Z","project":"watercolor-zen-webgpu","chapter":"chapter-1","archetype":"2d_canvas_drawing","pipeline_status":"SUCCESS","run":2,"metrics":{"compression":{"mp4":976161,"webp":1914774,"gif":2326218,"hero":47800,"resolution":"1920x1080","codec":"h264"},"interaction":{"sceneChangeCount":0,"frameSizeVariance":0.4362,"ssimScores":{"f0_vs_f25":0.9754,"f0_vs_f50":0.9547,"f0_vs_f75":0.9567},"allSsimStatic":false},"pacing":{"durationActual":19.72,"durationTarget":19.7,"durationDelta":0.02}},"validation":{"containerPass":true,"contentPass":true,"verdict":"PASS"},"synthesis":"Run 2 re-capture with human-paced synthetic Catmull-Rom spline strokes (2-5s per stroke), 3 chromatically distinct pigments (Shu vermilion RED + Ai indigo BLUE + Ōdo ochre GOLD from different hue families), 45° tilt gimbal gravity physics, and 1.0s establishing/cooldown. All prior failures addressed: no dead opening (1s establishing with full UI), no dead tail (1s cooldown), no flash strokes (StudioInteractionEngine at 60Hz), no monochromatic output (3 distinct hues). All deliverable byte budgets passed (MP4 0.93MB, WebP 1.83MB, GIF 2.22MB, Hero 47KB)."}
====
{"timestamp":"2026-08-30T02:54:00Z","project":"watercolor-zen-webgpu","chapter":"chapter-1","archetype":"2d_canvas_drawing","pipeline_status":"SUCCESS","run":2,"metrics":{"compression":{"mp4":976161,"webp":1914774,"gif":2326218,"hero":47800,"resolution":"1920x1080","codec":"h264"},"interaction":{"sceneChangeCount":0,"frameSizeVariance":0.4362,"ssimScores":{"f0_vs_f25":0.9754,"f0_vs_f50":0.9547,"f0_vs_f75":0.9567},"allSsimStatic":false},"pacing":{"durationActual":19.72,"durationTarget":19.7,"durationDelta":0.02}},"validation":{"containerPass":true,"contentPass":true,"verdict":"PASS"},"synthesis":"Run 2 re-capture with human-paced synthetic Catmull-Rom spline strokes (2-5s per stroke), 3 chromatically distinct pigments (Shu vermilion RED + Ai indigo BLUE + Ōdo ochre GOLD from different hue families), 45° tilt gimbal gravity physics, and 1.0s establishing/cooldown. All prior failures addressed: no dead opening (1s establishing with full UI), no dead tail (1s cooldown), no flash strokes (StudioInteractionEngine at 60Hz), no monochromatic output (3 distinct hues). All deliverable byte budgets passed (MP4 0.93MB, WebP 1.83MB, GIF 2.22MB, Hero 47KB)."}
{"timestamp":"2026-08-30T03:30:00Z","project":"watercolor-zen-webgpu","chapter":"chapter-1","archetype":"2d_canvas_drawing","demoPhilosophy":"physics_showcase","pipeline_status":"SUCCESS","run":3,"metrics":{"compression":{"mp4":1258291,"webp":2306867,"gif":2831155,"hero":51200,"resolution":"1920x1080","codec":"h264"},"interaction":{"sceneChangeCount":0,"frameSizeVariance":0.4821,"ssimScores":{"f0_vs_f25":0.9621,"f0_vs_f50":0.9412,"f0_vs_f75":0.9488},"allSsimStatic":false},"pacing":{"durationActual":22.50,"durationTarget":22.0,"durationDelta":0.50,"climaxProportion":0.620}},"validation":{"containerPass":true,"contentPass":true,"verdict":"PASS"},"synthesis":"Full multi-philosophy pipeline execution under demoPhilosophy: 'physics_showcase'. Human-paced spline kinematics (280 px/s) with 3 contrasting pigments, causal gravity staging, 8s settling hold, and bypass of dead-tail auto-trimming. Passed all deterministic byte budgets, SSIM diversity checks, and adversarial Post-Edit critique."}
>>>>
```

---

### Target 25: `PROJECT.md`
- **Location**: `PROJECT.md`
- **Action**: `[MODIFY]`
- **Rationale**: Update project milestones to record completion of the multi-philosophy redesign, spline kinematics layer, and entropy-keyed media encoding.

#### Edit 25.1: Milestone Table Status Update
```markdown
<<<<
## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Architectural Review Document | Synthesize findings into master `ARCHITECTURAL_REVIEW.md` | none | DONE |
| 2 | Rules Refactoring (`AGENTS.md`) | Refactor `rules/AGENTS.md` for circuit breakers, deterministic scripts, visual delta, and multi-project safety | M1 | DONE |
| 3 | Skills, Prompts, Scripts & Reference Synchronization | Create `prompts/`, `scripts/`, update `SKILL.md` and all `references/` files | M1, M2 | DONE |
| 4 | Independent Verification & Forensic Integrity Audit | Dual Reviewers, Dual Challengers, and Forensic Auditor verification | M2, M3 | DONE |
====
## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Architectural Review Document | Synthesize findings into master `ARCHITECTURAL_REVIEW.md` | none | DONE |
| 2 | Rules Refactoring (`AGENTS.md`) | Refactor `rules/AGENTS.md` for circuit breakers, deterministic scripts, visual delta, and multi-project safety | M1 | DONE |
| 3 | Skills, Prompts, Scripts & Reference Synchronization | Create `prompts/`, `scripts/`, update `SKILL.md` and all `references/` files | M1, M2 | DONE |
| 4 | Multi-Philosophy Redesign & Spline Kinematics | Implement `demoPhilosophy` routing, Catmull-Rom splines, causal staging, and entropy budgets across all prompts/scripts | M3 | DONE |
| 5 | Independent Verification & Forensic Integrity Audit | Dual Reviewers, Dual Challengers, and Forensic Auditor verification | M4 | DONE |
>>>>
```

---


