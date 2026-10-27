# eSignature Studio

> A modern, sleek, client-side digital signature studio built with TypeScript and Vite. Runs 100% in the browser with advanced trackpad/mouse curve smoothing, dynamic pen physics, and vector SVG & high-res raster export.

🌐 **Live URL:** [http://stephenford.org/esigniture/](http://stephenford.org/esigniture/) (or [https://smford.github.io/esigniture/](https://smford.github.io/esigniture/))

---

## ✨ Features

- **100% In-Browser & Private**: Zero data leaves your computer. No backend servers, no analytics, no external tracking.
- **Draw & Type Modes**:
  - **Draw Mode**: Freehand drawing with multi-stage curve smoothing and pen dynamics.
  - **Type to Sign Mode**: Type your name or initials and choose from curated calligraphic handwriting styles (*Caveat*, *Dancing Script*, *Great Vibes*, *Sacramento*) with adjustable sizing.
- **Progressive Web App (PWA) & Offline Mode**:
  - Installable as a native standalone desktop or mobile application.
  - Fully functional offline via an automated Cache-First Service Worker (`sw.js`).
  - Zero-Trust Content Security Policy (CSP) enforcing strict client-side data boundaries.
- **Advanced Jitter & Trackpad Smoothing**:
  - Sub-frame pointer precision via PointerEvent coalesced events (`getCoalescedEvents()`).
  - Distance threshold jitter filtering to remove sensor micro-tremors.
  - Exponential moving average (EMA) coordinate filtering.
  - Continuous $C^1$ quadratic Bézier curve interpolation via midpoints for organic, natural ink curves.
- **Dynamic Velocity-Sensitive Pen Physics**:
  - Simulates fountain and ballpoint pen behavior: fast strokes taper smoothly, slower strokes lay down richer ink.
  - Full hardware pressure sensitivity support for Apple Pencil, styluses, and Force Touch trackpads.
- **Multiple High-Resolution Export Formats**:
  - **SVG**: Crisp, resolution-independent vector graphics with exact path definitions.
  - **PNG**: 2x supersampled high-DPI raster image with support for transparent or solid backgrounds.
  - **JPEG**: High quality (0.95 quality) with customizable solid background.
  - **WebP**: Ultra-efficient modern web format.
  - **One-Click Clipboard Copy**: Instantly copy transparent PNG to clipboard (`⌘C` or button) for pasting directly into Google Docs, Slack, Word, or Apple Mail.
- **Customizable Styling**:
  - **Background options**: Transparent (with checkerboard preview), Pure White, Warm Cream/Paper (`#FAF8F5`), Slate Dark (`#0F172A`), or custom color picker.
  - **Ink colors**: Obsidian Black, Classic Navy, Royal Blue, Forest Green, Crimson, or custom color picker.
  - **Stroke thickness**: 1 px to 14 px.
  - **Smoothing strength**: Adjustable from Raw/Crisp (0%) to Silky Smooth (100%).
  - **Auto-trim whitespace**: Crops exported file precisely to signature bounding box with comfortable padding.
  - **Signature baseline guide**: Subtle dashed baseline guide on canvas (automatically omitted in exported files).
- **Modern Sleek UI**:
  - Responsive dark/light theme support.
  - Live document mockup preview showing real-time signature placement on a contract.
  - Full touch, pen, mouse, and trackpad support (`touch-action: none`).
  - Keyboard shortcuts:
    - `⌘Z` / `Ctrl+Z` : Undo
    - `⇧⌘Z` / `Ctrl+Y` : Redo
    - `Esc` or `C` : Clear canvas

---

## 📐 Mathematical Smoothing Pipeline

When drawing with a mouse or trackpad, input events suffer from low sampling frequency and discrete quantization. The app eliminates jaggedness through a multi-stage pipeline:

1. **Jitter Rejection Filter**:
   $$\text{dist}(P_{curr}, P_{prev}) < \epsilon \implies \text{drop}$$
2. **Exponential Moving Average (EMA)**:
   $$S_i = S_{i-1} + \alpha \cdot (P_i - S_{i-1})$$
   where $\alpha \in [0.25, 1.0]$ scales with user-selected smoothing intensity.
3. **Rolling Velocity & Width Modulation**:
   $$v_i = 0.6 \cdot v_{i-1} + 0.4 \cdot \frac{\Delta d}{\Delta t}$$
   $$w_i = w_{base} \cdot \left(1.25 - 0.65 \cdot \min\left(1, \frac{v_i}{v_{max}}\right)\right)$$
4. **Midpoint Quadratic Spline**:
   For smoothed coordinates $P_0, \dots, P_n$, control points and midpoints $M_i = \frac{P_i + P_{i+1}}{2}$ form smooth curves:
   $$B(t) = (1-t)^2 M_{i-1} + 2(1-t)t P_i + t^2 M_i$$

---

## 🛠️ Development & Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Start local development server
npm run dev

# Build production assets
npm run build
```

---

## 🚀 Continuous Deployment

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs automated tests and deploys production builds directly to GitHub Pages on every push to `main`.
