# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

AquiPro is a **single-file browser app** for pumping-test analysis. The entire application lives in [aquipro.html](aquipro.html) (~4000 lines) — HTML, CSS, and JS all inlined. There is **no build step, no bundler, no server**. To run the app, open the file in a browser. Third-party libraries (Plotly, Leaflet, PapaParse, SheetJS, jsPDF, Tailwind, KaTeX) are loaded from CDN, so first load needs internet.

The user-facing docs live in [aquipro-docs.html](aquipro-docs.html) — also single-file. When you add a feature to `aquipro.html`, update the matching section in `aquipro-docs.html` (analysis-method dropdown, theory section, nav indexes).

## Running the e2e tests

The only tooling in the repo is a Playwright-based regression suite at [test-e2e.js](test-e2e.js).

```bash
npm install
npx playwright install chromium    # one-time, ~150 MB
node test-e2e.js                   # or: npm test
```

The runner opens `aquipro.html` via `file://`, drives every analysis method (Theis, Cooper-Jacob, Hantush-Jacob, Theis-Boundary, Neuman, Theis Recovery, Step-Drawdown, Distance-Drawdown, Slug Test Hvorslev / Bouwer-Rice) plus the outlier-removal flow and preprocessing toggles, and asserts on `APP.results`. The script exits non-zero on any failure.

To run a single test, comment out the others in [test-e2e.js](test-e2e.js) — there's no `--grep`-style filter.

## State and global scope

The app exposes one runtime object: a top-level `let APP = {...}` that holds `data`, `processed`, `recovery`, `results`, `allResults`, `wellData`, `activeWell`, `confidenceIntervals`, `corrections`, `rateSchedule`, `axisMode`, etc. Because it's `let`-declared at the top of a classic `<script>`, it is **accessible by name from any page-context evaluation but is NOT a property of `window`** — `typeof APP` works, `typeof window.APP` is `undefined`. Test code must use the bare name.

Two parallel datasets coexist:
- `APP.data` — the raw rows (what the data table and exports show).
- `APP.processed` — `applyPreprocessing()` derives this from `APP.data`. It excludes flagged outliers, applies smoothing/detrending, etc.

**All analysis steps read `APP.processed.length ? APP.processed : APP.data`.** When you add a new method, follow that pattern so preprocessing toggles and the "Remove Permanently" outlier flow apply automatically.

## Special methods bypass the standard fit pipeline

The standard fit pipeline is `onMethodChange()` → `getCurrentParams()` (reads sliders) → `autoFit()` (Levenberg-Marquardt) → `updateResults()`. Four methods are *special* — they have their own control panels and analysis functions, and `onMethodChange` skips the standard sliders + auto-fit button for them:

- `step-drawdown` → `runStepDrawdown()`
- `distance-dd` → `computeDistanceDrawdown()`
- `slug-test` → `runSlugTest()` (Hvorslev / Bouwer-Rice)
- `recovery` uses standard sliders but a custom `updateRecoveryPlot()` and a single-parameter (T-only) fit branch in `autoFit()`.

When adding a special method, replicate the pattern: hide standard controls in `onMethodChange`, gate `updateResults()` and `updateAnalysisPlot()` on the new method name, write the result back to `APP.results = { ..., method: 'your-method' }`.

## Auto-fit timing trap (relevant to the test runner)

`onMethodChange()` synchronously calls `updateAnalysisPlot()` which calls `updateResults()` — so `APP.results.method` becomes truthy *the instant the dropdown changes*, before `autoFit()`'s `setTimeout(50)` callback actually runs the optimizer. Do not poll on `APP.results.method` to detect fit completion. The e2e harness wraps `window.toast` and waits for the terminal "Auto-fit complete" / "Auto-fit failed" message; replicate that pattern if you write new tests.

## Sample data sets initial guesses

`loadExampleData()`, `loadUnconfinedExampleData()`, and `loadAdvancedExampleData()` each set the T/S/Sy slider values to a regime-appropriate initial guess at the *end* of the loader. The Levenberg-Marquardt optimizer reads sliders for its initial point, so:

- **Don't reset sliders to HTML defaults between tests** — you'll clobber the loader's tuned initials and the optimizer can fail to converge.
- The e2e harness reloads sample data before each fit so each test starts from a known good initial guess.

## Math implementation notes

- Theis well function `W(u)` uses a 30-term series for small `u`, continued fraction for large `u` (≥6 sig figs).
- Hantush `W(u, r/B)` uses numerical quadrature.
- Neuman is a dual-Theis with a sigmoid transition between elastic-S and gravity-Sy regimes; rigorous Neuman branch uses Stehfest-Laplace inversion.
- Bourdet derivative is a three-point weighted formula with adjustable L-spacing.
- Slug-test math: linear regression of `ln(H/H₀)` vs `t` (seconds), then `K = rc² · ln(R*/rw) / (2·Le) · |slope|` where `R* = Le` for Hvorslev, `Re` for Bouwer-Rice. Time in the data table is minutes — convert to seconds before fitting.

## Editing conventions specific to this codebase

- Edits go directly into `aquipro.html` / `aquipro-docs.html`. There is no source vs. dist split.
- New analysis methods must appear in three places in `aquipro.html`: the `<select id="analysisMethod">` dropdown, the corresponding control-panel `<div>` in the param sidebar, and the dispatch chains in `onMethodChange`, `updateAnalysisPlot`, and `updateResults`.
- New methods must also appear in `aquipro-docs.html`: the `<select>` jump-to nav, the sidebar `class="sub"` links, and a numbered theory section under `#theory`.
- The CDN-loaded libraries are pinned by version in the `<script src=...>` tags at the top of `aquipro.html`. Don't change versions without testing — Plotly's API in particular has changed across majors.
