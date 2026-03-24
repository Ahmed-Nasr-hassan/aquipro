<p align="center">
  <img src="https://img.shields.io/badge/💧-AquiPro-0ea5e9?style=for-the-badge&labelColor=1e3a8a" alt="AquiPro">
</p>

<h1 align="center">AquiPro — Pumping Test Analyzer</h1>

<p align="center">
  A free, open-source, browser-based pumping test analysis tool for hydrogeologists.<br>
  No installation. No license fees. No sign-up. Just open and analyze.
</p>

<p align="center">
  <a href="https://ahmednasr.fekrlab.com/aquipro">Live App</a> •
  <a href="https://ahmednasr.fekrlab.com/aquipro/docs">Documentation</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#methods">Methods</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/dependencies-zero-success.svg" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/file-single%20HTML-orange.svg" alt="Single HTML File">
</p>

---

## What is AquiPro?

AquiPro is a complete pumping test (aquifer test) analysis suite packed into a **single HTML file**. It runs entirely in the browser — no server, no backend, no installation required.

Built by a water engineer who writes code, for hydrogeologists, consultants, students, and anyone working with groundwater data.

---

## Features

### Analytical Methods
- **Theis (1935)** — Confined aquifer, log-log type curve matching
- **Cooper-Jacob (1946)** — Confined aquifer, semi-log straight-line method
- **Hantush-Jacob (1955)** — Leaky (semi-confined) aquifer with r/B leakage parameter
- **Neuman (1975)** — Unconfined aquifer with delayed yield (S and Sy)
- **Theis Recovery (1935)** — Recovery phase analysis (residual drawdown vs t/t')

### Auto-Fit Optimizer
- Built-in **Levenberg-Marquardt** nonlinear least-squares optimizer
- One-click curve fitting — solves for T, S, Sy automatically
- Log-transformed bounded parameter space
- Goodness-of-fit: **RMSE, R², NSE, MAE**

### Diagnostic Plot
- **Bourdet derivative** (ds/d(ln t)) with adjustable smoothing parameter (L)
- Three-point weighted formula for numerical stability
- **Automatic aquifer-type detection** — identifies confined, unconfined, leaky, or barrier conditions
- Recommends the best analysis method based on derivative shape

### Data Input
- **Drag-and-drop** CSV/XLSX upload (PapaParse + SheetJS)
- Manual editable data table
- **Paste from Excel** support (auto-detects tab-separated data)
- Direct text paste mode

### Data Preprocessing
- Outlier detection and removal (IQR method)
- Moving-average smoothing with adjustable window
- Linear detrending (pre-test water level trend removal)
- Wellbore storage flagging (unit-slope detection)
- Recovery data extraction (auto-computes s' and t/t')

### Interactive Map
- **Leaflet.js** with OpenStreetMap tiles
- Click-to-place well markers
- **Radius of Influence** circle (Cooper-Jacob formula)
- **Drawdown contour rings** (0.1, 0.5, 1, 2, 5 m) via inverse Theis
- Distance measurement ruler tool
- Auto-distance calculation between wells (Haversine formula)

### Visualization
- **Plotly.js** interactive charts — zoom, pan, hover, export as PNG
- Log-Log, Semi-Log, and Linear axis modes
- Observed data vs theoretical curve overlay
- Derivative overlay on analysis plot
- Residual plot (observed − predicted)
- Sensitivity analysis charts

### Reporting
- One-click **PDF report** generation (jsPDF + html2canvas)
- Cover page, input parameters, results, chart snapshots, page numbers
- **CSV export** — time, observed, theoretical, residuals
- **Excel export** — multi-sheet XLSX with data + results

### Additional Features
- 🌓 Dark / Light mode (persisted)
- 💾 Auto-save to localStorage
- 📁 Save/Load project as JSON
- ⌨️ Keyboard shortcuts (Ctrl+S, Ctrl+Enter, Ctrl+P, 1–6 for tabs)
- 📱 Mobile responsive
- 🔌 Works offline after first load
- 📐 Multi-observation-well support
- 🔮 Drawdown prediction at future times
- 📊 Sensitivity analysis (T ± 10/25/50%)
- 🧪 Example dataset — one click to test everything
- ℹ️ Tooltips with hydrogeological explanations on every input

---

## Getting Started

### Option 1: Use online
Visit **[ahmednasr.fekrlab.com/aquipro](https://ahmednasr.fekrlab.com/aquipro)** — nothing to install.

### Option 2: Run locally
1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/aquipro.git
   ```
2. Open `aquipro.html` in any modern browser.

That's it. No `npm install`, no build step, no dependencies.

### Option 3: Download
Download `aquipro.html` directly and double-click to open.

---

## Quick Start

1. Click **"Confined Example"** on the Project Setup tab
2. Go to **Diagnostic Plot** → click **Refresh** → see the automatic aquifer diagnosis
3. Go to **Analysis** → click **Auto-Fit** → get T, S, R² in seconds
4. Go to **Map & ROI** → click **Update ROI** → see the radius of influence on the map
5. Go to **Report** → click **Generate PDF** → download a professional report

---

## Methods

| Method | Aquifer Type | Plot Type | Parameters | Reference |
|--------|-------------|-----------|------------|-----------|
| Theis | Confined | Log-Log | T, S | Theis (1935) |
| Cooper-Jacob | Confined | Semi-Log | T, S | Cooper & Jacob (1946) |
| Hantush-Jacob | Leaky Confined | Log-Log | T, S, r/B | Hantush & Jacob (1955) |
| Neuman | Unconfined | Log-Log | T, S, Sy | Neuman (1975) |
| Theis Recovery | Recovery | Semi-Log | T | Theis (1935) |

### Mathematical Implementation

- **Theis W(u)**: 30-term series expansion (small u) + continued-fraction (large u), ≥6 significant digits
- **Hantush W(u, r/B)**: Numerical quadrature with adaptive integration
- **Neuman**: Dual-Theis approach with sigmoid transition between elastic (S) and gravity (Sy) segments
- **Bourdet derivative**: Three-point weighted formula with configurable L-spacing
- **Optimizer**: Levenberg-Marquardt with finite-difference Jacobian and log-transformed parameter bounds

---

## Tech Stack

AquiPro is a **single HTML file** with zero build dependencies. All libraries are loaded via CDN:

| Library | Purpose |
|---------|---------|
| [Tailwind CSS](https://tailwindcss.com) | Styling & responsive design |
| [Plotly.js](https://plotly.com/javascript/) | Interactive scientific charts |
| [Leaflet.js](https://leafletjs.com) | Interactive maps |
| [PapaParse](https://www.papaparse.com) | CSV parsing |
| [SheetJS](https://sheetjs.com) | Excel import/export |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF generation |
| [html2canvas](https://html2canvas.hertzen.com) | Chart screenshot capture |
| [KaTeX](https://katex.org) | Math equation rendering (docs page) |

---

## Project Structure

```
aquipro/
├── aquipro.html          # The app (single file, ~2400 lines)
├── aquipro-docs.html     # Documentation & groundwater analysis guide
├── README.md             # This file
└── LICENSE               # MIT License
```

---

## Documentation

Full documentation and groundwater theory guide at:
**[ahmednasr.fekrlab.com/aquipro/docs](https://ahmednasr.fekrlab.com/aquipro/docs)**

Covers:
- Step-by-step usage guide for each tab
- Theory behind all 5 analytical methods (with equations)
- Bourdet derivative interpretation
- Parameter reference table with typical ranges
- Best practices for data collection and analysis
- Common pitfalls to avoid
- Glossary of 30+ hydrogeological terms
- Academic references

---

## Contributing

Contributions are welcome! Here are some ways to help:

### Good First Issues
- [ ] Add more example datasets (unconfined, leaky, recovery)
- [ ] Improve mobile layout for data table
- [ ] Add more unit options (cfs, MGD, etc.)
- [ ] Translate tooltips to other languages

### Feature Ideas
- [ ] Step-drawdown test (Eden-Hazel / Hantush-Bierschenk)
- [ ] Slug test analysis (Hvorslev, Bouwer-Rice)
- [ ] Boundary effects (image well theory)
- [ ] Distance-drawdown analysis for multi-well
- [ ] Confidence intervals on fitted parameters
- [ ] Web Worker for heavy computation
- [ ] PWA / Service Worker for full offline support

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes to `aquipro.html` or `aquipro-docs.html`
4. Test in a browser (just open the file!)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Since the entire app is a single HTML file, contributing is straightforward — no build toolchain to set up.

---

## Who Is This For?

- ✅ **Hydrogeologists** doing aquifer tests in the field
- ✅ **Consultants** who need fast, clean reports
- ✅ **Students** who can't afford expensive software like AQTESOLV
- ✅ **Water resource engineers** in developing countries
- ✅ **Anyone** who's ever fought a pumping test spreadsheet and lost

---

## References

- Theis, C.V. (1935). The relation between the lowering of the piezometric surface and the rate and duration of discharge of a well using ground-water storage. *Trans. AGU*, 16(2), 519–524.
- Cooper, H.H. & Jacob, C.E. (1946). A generalized graphical method for evaluating formation constants and summarizing well-field history. *Trans. AGU*, 27(4), 526–534.
- Hantush, M.S. & Jacob, C.E. (1955). Non-steady radial flow in an infinite leaky aquifer. *Trans. AGU*, 36(1), 95–100.
- Neuman, S.P. (1975). Analysis of pumping test data from anisotropic unconfined aquifers considering delayed gravity response. *Water Resour. Res.*, 11(2), 329–342.
- Bourdet, D., Ayoub, J.A. & Pirard, Y.M. (1989). Use of pressure derivative in well test interpretation. *SPE Form. Eval.*, 4(2), 293–302.
- Kruseman, G.P. & de Ridder, N.A. (1994). *Analysis and Evaluation of Pumping Test Data*. ILRI Publication 47, 2nd ed.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with 💧 for the groundwater community<br>
  <em>Water is a shared resource. The tools to study it should be too.</em>
</p>
