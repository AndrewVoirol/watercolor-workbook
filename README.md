# MUJŌ (無常) — Meditative Watercolor on Washi

![MUJŌ Demo](screenshots/demo.gif)

A physically-based digital watercolor engine running entirely on WebGPU compute shaders, simulating the ephemeral beauty of Japanese sumi-e ink on handmade washi parchment. Strokes bleed, diffuse through porous fibers, darken along edges, and gradually sublime back to pristine paper.

## Quick Start

```bash
git clone https://github.com/AndrewVoirol/watercolor-workbook.git
cd watercolor-workbook
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
1. **Choose an Authentic Japanese Brush (筆架 - Fudekake)**:
   - **Fude (標準筆)**: Classic round animal-hair brush for expressive calligraphic tapers and pressure flares.
   - **Menso (面相筆)**: Ultra-fine slender sable liner for hairline precision, botanical veins, and delicate details.
   - **Hake (刷毛)**: Broad flat wooden wash brush for wide atmospheric washes and parallel bristle grooves (*kasure* 擦れ).
   - **Fuki-e (吹き絵)**: Traditional blown-ink splatter technique dispersing organic aerosol mist and satellite ink droplets.
2. **Choose an Authentic Mineral Pigment & Tools (硯 - Suzuri)**:
   - **Sumi (墨)**: Pure carbon black soot ink.
   - **Shu (朱)**: Radiant cinnabar vermilion.
   - **Ai (藍)**: Deep natural indigo.
   - **Oudo (黄土)**: Warm raw yellow ochre earth.
   - **Rokusho (緑青)**: Malachite mineral verdigris.
   - **Mizusashi (水)**: Clear water wash to blend, dilute, and re-mobilize wet pigment.
   - **Shio (塩)**: Coarse sea salt crystal dish for hygroscopic starburst granulation (*Shio-furi* 塩振り).
3. **Switch Authentic Washi Paper Grains (和紙)**: Choose your paper variety with instantaneous procedural GPU heightmap synthesis:
   - **Sheng Xuan (生宣)**: Highly absorbent raw rice paper with rapid capillary wicking (*nijimi* 滲み).
   - **Torinoko (鳥の子)**: Smooth eggshell washi with tight pores and crisp edge definition (*dousa* 礬水).
   - **Echizen Kouzo (生漉楮紙)**: Heavy cold-press mulberry paper with deep valleys that trap pigment granulation.
4. **Canvas Tilt & Gravity Flow (紙の傾き)**: Drag the 2D brass compass gimbal or tilt your mobile device (gyroscope) to watch wet watercolor puddles pool, bead up, and cascade downwards along paper fibers.
5. **Water Dilution (水加減)**: Dial down for dry brush (*kasure* 擦れ) fiber granulation, or dial up for lush wet bleeding (*nijimi* 滲み).
6. **Breathe (息)**: Toggle preservation mode to suspend impermanence and freeze your painting in time.
7. **Spring Rain (春雨)**: Wash the parchment with gentle garden rain to soften and dissolve dry strokes into a mist.
8. **Sound (響)**: Immerse yourself in generative *shishi-odoshi* bamboo water droplets, brush friction acoustics, crystalline salt sprinkles, and fluid gravity trickles.

### Technical Simulation Architecture
- **Incompressible Navier-Stokes Fluid Grid with Gravity**: Solved on a 1024×1024 simulation grid using Runge-Kutta 2nd order (RK2) semi-Lagrangian advection, shallow fluid body force acceleration $\mathbf{g} \cdot \Delta t$, and a 32-iteration porous Jacobi pressure projection solver ($\omega = 0.85$).
- **Authentic Japanese Brush Kinematics**: Hardware PointerEvent stylus tilt ingestion (altitude, azimuth angle, and pressure) paired with continuous velocity tangent fallback $\mathbf{C}'(t)$ for mouse/touch, calculating analytical swept-ribbon distance fields and parallel bristle noise.
- **Salt Granulation (*Shio-furi* 塩振り)**: Models hygroscopic moisture suction and outward osmotic pigment repulsion ($-\nabla S$), creating delicate crystalline starburst blooms and dark perimeter halos.
- **Centripetal Catmull-Rom Spline Injection**: Coalesced pointer events with analytical distance-field swept capsules deposit continuous momentum $\mathbf{C}'(t)$ and pigment mass without stepping artifacts.
- **2-Layer Darcy Porous Flow**: Capillary puddle diffusion driven by Darcy's porous medium law across parameterized fiber permeability and paper topography tooth.
- **2-Flux Kubelka-Munk Optical Compositing**: Authentic subtractive color blending calculated from real $(K, S)$ absorption and scattering spectra rather than synthetic RGB averaging.
- **Dual-Resolution Rendering**: 4-tap bicubic Catmull-Rom simulation interpolation combined with native Retina resolution procedural Washi fiber heightmaps, salt crystal micro-glints, and specular wet sheen.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Compute & Graphics Engine** | WebGPU (Compute & Fragment WGSL Shaders) |
| **Language** | TypeScript |
| **Build & Dev Tool** | Vite |
| **Audio Synthesis** | Web Audio API (Generative Zen Soundscapes & Brush Acoustics) |
| **Styling** | Vanilla CSS (Karesansui Minimalist Design System) |

---

## License

MIT
