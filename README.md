# MUJŌ (無常) — Meditative Watercolor on Washi

![MUJŌ Demo](screenshots/demo.gif)

A physically-based digital watercolor engine running entirely on WebGPU compute shaders, simulating the ephemeral beauty of Japanese sumi-e ink on handmade washi parchment. Strokes bleed, diffuse through porous fibers, darken along edges, and gradually sublime back to pristine paper.

## Quick Start

```bash
git clone https://github.com/your-username/watercolor-workbook.git
cd watercolor-workbook/chapter-1
npm install
npm run dev
```

*Requires Node.js ≥ 18 and a browser with WebGPU support (Chrome 113+, Edge 113+, Safari 18+).*

---

## App States

| Pristine Washi Parchment | Calligraphy & Fluid Blending | Physics & Aesthetics Guide |
| :---: | :---: | :---: |
| ![Initial State](screenshots/initial-state.png) | ![Brush Strokes](screenshots/brush-strokes.png) | ![Info Modal](screenshots/info-modal.png) |

---

## How It Works

### Interacting with the Canvas
1. **Choose an Authentic Mineral Pigment**: Select from traditional Japanese pigments on the Suzuri inkstone dock:
   - **Sumi (墨)**: Pure carbon black soot ink.
   - **Shu (朱)**: Radiant cinnabar vermilion.
   - **Ai (藍)**: Deep natural indigo.
   - **Oudo (黄土)**: Warm raw yellow ochre earth.
   - **Rokusho (緑青)**: Malachite mineral verdigris.
   - **Mizusashi (水)**: Clear water wash to blend, dilute, and re-mobilize wet pigment.
2. **Brush Wisps & Pressure**: Move cursor or stylus across the parchment. Stroke speed injects physical fluid momentum and centripetal Catmull-Rom spline curves.
3. **Water Dilution (水加減)**: Dial down for dry brush (*kasure* 擦れ) fiber granulation, or dial up for lush wet bleeding (*nijimi* 滲み).
4. **Breathe (息)**: Toggle preservation mode to suspend impermanence and freeze your painting in time.
5. **Spring Rain (春雨)**: Wash the parchment with gentle garden rain to soften and dissolve dry strokes into a mist.
6. **Sound (響)**: Immerse yourself in generative *shishi-odoshi* bamboo water droplets and tranquil wind chimes.

### Technical Simulation Architecture
- **Incompressible Navier-Stokes Fluid Grid**: Solved on a 1024×1024 simulation grid using Runge-Kutta 2nd order (RK2) semi-Lagrangian advection and an 8-iteration porous Jacobi pressure projection solver ($\omega = 0.85$).
- **Centripetal Catmull-Rom Spline Injection**: Coalesced pointer events with analytical distance-field swept capsules deposit continuous momentum $\mathbf{C}'(t)$ and pigment mass without stepping artifacts.
- **Capillary Action & Coffee-Ring Darkening**: Puddle diffusion driven by Darcy's porous medium law. Outward convective mass transfer concentrates drying pigment along stroke perimeters and paper ridges.
- **2-Flux Kubelka-Munk Optical Compositing**: Authentic subtractive color blending calculated from real $(K, S)$ absorption and scattering spectra rather than synthetic RGB averaging.
- **Dual-Resolution Rendering**: 4-tap bicubic Catmull-Rom simulation interpolation combined with native Retina resolution procedural Washi fiber heightmaps and specular wet sheen.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Compute & Graphics Engine** | WebGPU (Compute & Fragment WGSL Shaders) |
| **Language** | TypeScript |
| **Build & Dev Tool** | Vite |
| **Audio Synthesis** | Web Audio API (Generative Zen Soundscapes) |
| **Styling** | Vanilla CSS (Karesansui Minimalist Design System) |

---

## License

MIT
