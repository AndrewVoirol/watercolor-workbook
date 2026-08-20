# MUJŌ Atelier: Empirical Experimentation Journal

This journal records our scientific hypotheses, test procedures, empirical measurements, and artistic feel evaluations across the 5 Atelier Experiments.

---

## How to Run the Atelier Lab

1. Ensure the dev server is active: `npm run dev`
2. Open your browser to: **`http://localhost:3000/lab/`**
3. Use keyboard shortcuts:
   - `1` - `5`: Switch between experiments
   - `L`: Toggle the 8X Retina Microscope Loupe
   - `+` / `-`: Zoom loupe in / out (4x, 8x, 16x)
   - `C`: Clear and reset active experiment

---

## Experiment Logs & Hypotheses

### [Exp 1] Porous Bleed Dynamics (Darcy Tensor vs. LBM D2Q9)
- **Scientific Question**: Does Lattice Boltzmann (LBM D2Q9) provide visibly superior capillary tendrils (*Hige-nijimi*) compared to an anisotropic Darcy tensor on procedural bast fibers, or does it consume excessive memory bandwidth with zero perceptual aesthetic gain?
- **Trackpad Test**:
  1. Click and drag a stroke or drop a pool of ink on either half of the split canvas.
  2. The identical stroke is injected into both Darcy (Left) and LBM (Right) simultaneously.
  3. Adjust the *Fiber Anisotropy* and *Sizing Barrier (Dōsa)* sliders to observe directional wicking.
  4. Press `L` to bring up the Microscope Loupe and inspect the bleeding edge.
- **What to Observe**:
  - Does Darcy tensor follow the fibrous grain naturally?
  - Does LBM introduce diamond-shaped or directional lattice artifacts?
  - Compare compute latency in the HUD (target: < 0.8ms on M4 Pro).

---

### [Exp 2] Brush Kinematics & Tactile Feel (Swept Ribbon vs. Multi-Strand Bristles)
- **Scientific Question**: What delivers the most authentic calligraphic snap and responsiveness on a trackpad? Continuous Catmull-Rom swept ribbons with procedural striations (*Sujime*), or 3D spring-mass elastic bristle clusters?
- **Automated Calligraphy Benchmark Suite (試書 Shisho)**:
  - Click **永 (Eight Principles of Yong)**: Executes the 8 classical brush strokes (Soku dot, Roku bar, Do spine, Teki hook, Saku whip, Ryo sweep, Taku peck, Taku flared sweep).
  - Click **一 (Bar & Kasure)**: Tests entry attack, high-speed middle kasure split, and sharp flick exit.
  - Click **心 (Belly & Hook)**: Tests flowing curved belly and leaping upward hook.
  - Click **円 (Zen Ensō)**: Tests 360° continuous sweeping arc with speed-dependent tuft splay and dry trailing marks.
  - Click **⚡ Speed Ladder**: Tests 4 parallel strokes from deliberate slow presses (100 px/s) to lightning flicks (1400 px/s).
- **Trackpad Test**:
  1. Make rapid Kanji flicks and fast sweeps on your trackpad.
  2. Draw slow, deliberate pressure circles and spiral lines.
  3. Switch between *丸筆 Maru-fude*, *面相 Menso*, and *刷毛 Hake*.
  4. Dial up *Dry Tooth Skip (Kasure)* to test paper tooth gating.
- **What to Observe**:
  - Is there any latency or cursor disconnection?
  - Do the multi-strand bristles feel jittery on fast turns?
  - Does the swept ribbon feel silky and fluid?
  - In the main app, press **T** at any time to cycle through automated test strokes.

---

### [Exp 3] Optical Glazing & Color Optics (Kubelka-Munk vs. RGB Alpha)
- **Scientific Question**: Does standard digital RGB alpha blending muddy watercolor washes, and does Kubelka-Munk 2-flux subtractive light transport authentically produce mineral color mixing (e.g., Yellow Ochre over Indigo Blue yielding deep Celadon Green)?
- **Trackpad Test**:
  1. Notice the pre-dried Indigo Blue (top) and Vermilion (bottom) stripes.
  2. Drag a vertical wash of *天然黄土 (Ōdo Yellow Ochre)* or *本朱 (Shu)* across both stripes.
- **What to Observe**:
  - **Left (Kubelka-Munk)**: Notice how Yellow over Indigo produces a rich, luminous celadon green through subtractive scattering.
  - **Right (RGB Alpha)**: Notice how Yellow over Indigo produces a muddy, desaturated grey.

---

### [Exp 4] Washi Substrate Matrix (6 Botanical Fiber Topologies)
- **Scientific Question**: How do the 6 traditional Japanese papers (Kōzo, Torinoko, Kobishi, Hōsho, Unryū, and Gampi) affect fluid diffusion, sizing hydrophobic resistance, and valley granulation?
- **Trackpad Test**:
  1. Cycle through the 6 paper buttons.
  2. The left half shows the microscopic fiber skeleton; the right half shows the live watercolor wash.
  3. Drag across to see how unsized Kōzo bleeds aggressively while sized Torinoko and Gampi hold sharp contour edges (*Fuchidori*).

---

### [Exp 5] Apple Silicon Hardware Profiler (M4 Pro Stress Engine)
- **Scientific Question**: What is the maximum throughput and lowest frame latency achievable on your 20-core Apple M4 Pro? Does `rgba16float` (f16) comfortably sustain 120 FPS across 1024², 2048², and 3072² grids under heavy compute loads?
- **Trackpad Test**:
  1. Switch between 1024² (1M), 2048² (4M), and 3072² (9M cells).
  2. Crank *Compute Passes / Frame* up to 32 or 64 to stress the GPU.
  3. Check the live Compute Latency and Memory Bandwidth metrics in the HUD.
