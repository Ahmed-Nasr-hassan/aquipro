/**
 * AquiPro end-to-end test runner.
 *
 *   $ npm install --save-dev playwright
 *   $ npx playwright install chromium
 *   $ node test-e2e.js
 *
 * The app is a single HTML file — no build, no server. The runner opens it via
 * file:// in headless Chromium, drives the global APP/window functions to
 * exercise every analysis method, and asserts on APP.results.
 */

const { chromium } = require('playwright');
const path = require('path');

const APP_URL = 'file://' + path.resolve(__dirname, 'aquipro.html');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${tag}  ${name}${detail ? ' — ' + detail : ''}`);
}
async function test(name, page, fn) {
  console.log(`\n▶ ${name}`);
  try {
    const detail = await fn(page);
    record(name, true, detail);
  } catch (e) {
    record(name, false, e.message);
  }
}

async function resetState(page) {
  await page.evaluate(() => {
    APP.data = [];
    APP.processed = [];
    APP.recovery = [];
    APP.results = {};
    APP.allResults = [];
    APP.wellData = {};
    APP.activeWell = null;
    APP.confidenceIntervals = null;
    document.getElementById('chkOutlier').checked = false;
    document.getElementById('chkSmooth').checked = false;
    document.getElementById('chkDetrend').checked = false;
    document.getElementById('chkWBS').checked = false;
    window.confirm = () => true; // auto-accept Remove Permanently confirm
  });
}

async function reloadConfinedSample(page) {
  // load*ExampleData() also seeds slider initial guesses tuned to the dataset,
  // so reload before each fit to start every test from the same clean state.
  await page.evaluate(() => { APP.results = {}; loadExampleData(); });
  await page.waitForTimeout(150);
}

async function runMethodAutoFit(page, method, expect) {
  // autoFit schedules its work via setTimeout(50) then runs LM synchronously
  // inside that callback. onMethodChange synchronously triggers updateResults,
  // so APP.results.method becomes truthy before autoFit actually runs — we
  // cannot poll on that. Instead, mark a sentinel just after autoFit returns
  // (still synchronous before the timeout fires), then wait for autoFit to
  // clear it from inside its callback. Easiest: wrap autoFit's setTimeout
  // by toggling APP.__fitInFlight ourselves via a microtask + check that
  // confidenceIntervals or results actually changed past the deadline.
  await page.evaluate((m) => {
    APP.__fitDone = false;
    const origLog = window.toast;
    window.toast = function(msg, kind) {
      if (typeof msg === 'string' && /Auto-fit complete|Recovery auto-fit complete|Auto-fit failed/.test(msg)) {
        APP.__fitDone = true;
      }
      return origLog ? origLog.apply(this, arguments) : undefined;
    };
    document.getElementById('analysisMethod').value = m;
    onMethodChange();
    autoFit();
  }, method);
  await page.waitForFunction(() => APP.__fitDone === true, null, { timeout: 8000 });
  const r = await page.evaluate(() => APP.results);
  if (!r || !r.method) throw new Error('no results produced');
  if (r.T !== undefined && !(r.T > 0)) throw new Error(`T not positive: ${r.T}`);
  if (r.S !== undefined && !(r.S > 0)) throw new Error(`S not positive: ${r.S}`);
  if (expect && expect.minR2 !== undefined && r.R2 < expect.minR2) {
    throw new Error(`R² ${r.R2.toFixed(3)} < ${expect.minR2}`);
  }
  return `T=${r.T?.toFixed(2)} S=${r.S?.toExponential(2)} R²=${r.R2?.toFixed(3)}`;
}

(async () => {
  console.log(`AquiPro e2e — loading ${APP_URL}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('pageerror', err => console.error('  [page error]', err.message));

  await page.goto(APP_URL);
  await page.waitForFunction(() => typeof autoFit === 'function' && typeof APP === 'object');
  await page.waitForTimeout(300); // let init handlers settle

  // ---------------------------------------------------------------------
  // 1. Theis — built-in confined example
  // ---------------------------------------------------------------------
  await test('Theis (1935) — built-in confined example', page, async () => {
    await resetState(page);
    await reloadConfinedSample(page);
    return await runMethodAutoFit(page, 'theis', { minR2: 0.5 });
  });

  // ---------------------------------------------------------------------
  // 2. Cooper-Jacob — same dataset (reloaded for clean slider initials)
  // ---------------------------------------------------------------------
  await test('Cooper-Jacob (1946)', page, async () => {
    await resetState(page);
    await reloadConfinedSample(page);
    return await runMethodAutoFit(page, 'cooper-jacob', { minR2: 0.5 });
  });

  // ---------------------------------------------------------------------
  // 3. Hantush-Jacob — applied to confined data (model reduces to Theis as
  //    r/B → 0, so a reasonable fit is still expected)
  // ---------------------------------------------------------------------
  await test('Hantush-Jacob (1955)', page, async () => {
    await resetState(page);
    await reloadConfinedSample(page);
    return await runMethodAutoFit(page, 'hantush', { minR2: 0.5 });
  });

  // ---------------------------------------------------------------------
  // 4. Theis-Boundary
  // ---------------------------------------------------------------------
  await test('Theis-Boundary (image well)', page, async () => {
    await resetState(page);
    await reloadConfinedSample(page);
    return await runMethodAutoFit(page, 'theis-boundary', { minR2: 0.5 });
  });

  // ---------------------------------------------------------------------
  // 5. Neuman — unconfined sample
  // ---------------------------------------------------------------------
  await test('Neuman (1975) — unconfined example', page, async () => {
    await resetState(page);
    await page.evaluate(() => loadUnconfinedExampleData());
    await page.waitForTimeout(150);
    return await runMethodAutoFit(page, 'neuman', { minR2: 0.3 });
  });

  // ---------------------------------------------------------------------
  // 6. Theis Recovery
  // ---------------------------------------------------------------------
  await test('Theis Recovery', page, async () => {
    await resetState(page);
    // Synthesize a pump+recovery dataset: pump for 240 min, then recovery 240 min
    await page.evaluate(() => {
      const Q = 1000 / 86400, T = 200 / 86400, S = 1e-4, r = 25;
      const W = (u) => { // Theis well function via series
        if (u < 1e-9) return -0.5772 - Math.log(u);
        let s = -0.5772 - Math.log(u), term = -1;
        for (let n = 1; n < 60; n++) { term *= -u / n; s += term / n; if (Math.abs(term/n) < 1e-12) break; }
        return s;
      };
      const tOff = 240; // min
      const data = [];
      for (let i = 1; i <= 30; i++) {
        const t = i * (tOff / 30);
        const u = (r*r*S) / (4*T*t*60);
        data.push({ t, s: (Q/(4*Math.PI*T)) * W(u) });
      }
      // Recovery
      for (let i = 1; i <= 30; i++) {
        const tp = i * (tOff / 30);          // time since pump-off
        const tTotal = tOff + tp;
        const u1 = (r*r*S) / (4*T*tTotal*60);
        const u2 = (r*r*S) / (4*T*tp*60);
        const s = (Q/(4*Math.PI*T)) * (W(u1) - W(u2));
        data.push({ t: tTotal, s });
      }
      APP.data = data;
      populateDataTable();
      applyPreprocessing();
      document.getElementById('recoveryTime').value = tOff;
      extractRecovery();
    });
    await page.waitForTimeout(100);
    const recCount = await page.evaluate(() => APP.recovery.length);
    if (!recCount) throw new Error('extractRecovery produced no points');
    await page.evaluate(() => {
      APP.__fitDone = false;
      const orig = window.toast;
      window.toast = function(msg) {
        if (typeof msg === 'string' && /Recovery auto-fit complete|Auto-fit failed/.test(msg)) APP.__fitDone = true;
        return orig ? orig.apply(this, arguments) : undefined;
      };
      document.getElementById('analysisMethod').value = 'recovery';
      onMethodChange();
      autoFit();
    });
    await page.waitForFunction(() => APP.__fitDone === true, null, { timeout: 8000 });
    const r = await page.evaluate(() => APP.results);
    if (!r || !(r.T > 0)) throw new Error('recovery T not positive');
    return `T=${r.T.toFixed(2)} m²/day (recovery pts=${recCount})`;
  });

  // ---------------------------------------------------------------------
  // 7. Step-Drawdown (Hantush-Bierschenk)
  // ---------------------------------------------------------------------
  await test('Step-Drawdown (Hantush-Bierschenk)', page, async () => {
    await resetState(page);
    await page.evaluate(() => {
      // Synthesize 3 increasing-rate steps with known B, C.
      const B = 1e-3, C = 1e-7;
      const steps = [
        { dur: 60, q: 1000 },
        { dur: 60, q: 2000 },
        { dur: 60, q: 3000 }
      ];
      let cum = 0;
      const data = [];
      steps.forEach(st => {
        cum += st.dur;
        const s = B * st.q + C * st.q * st.q; // s/Q = B + C*Q
        data.push({ t: cum, s });
      });
      APP.data = data;
      populateDataTable();
      applyPreprocessing();
      // Populate UI step rows
      const rows = document.querySelectorAll('.step-row');
      rows.forEach((row, i) => {
        if (steps[i]) {
          row.querySelector('.step-dur').value = steps[i].dur;
          row.querySelector('.step-q').value = steps[i].q;
        }
      });
      document.getElementById('analysisMethod').value = 'step-drawdown';
      onMethodChange();
      runStepDrawdown();
    });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => APP.results);
    if (!r || r.method !== 'step-drawdown') throw new Error('no step-drawdown result');
    if (!(r.B > 0)) throw new Error(`B not positive: ${r.B}`);
    if (!(r.C > 0)) throw new Error(`C not positive: ${r.C}`);
    return `B=${r.B.toExponential(2)} C=${r.C.toExponential(2)}`;
  });

  // ---------------------------------------------------------------------
  // 8. Distance-Drawdown — sanity-only (needs multi-well UI)
  // ---------------------------------------------------------------------
  await test('Distance-Drawdown (renders without error)', page, async () => {
    await resetState(page);
    await page.evaluate(() => loadExampleData());
    await page.waitForTimeout(150);
    const err = await page.evaluate(() => {
      try {
        document.getElementById('analysisMethod').value = 'distance-dd';
        onMethodChange();
        return null;
      } catch (e) { return e.message; }
    });
    if (err) throw new Error(err);
    return 'method switch + plot path executed';
  });

  // ---------------------------------------------------------------------
  // 9. Slug Test — synthetic exponential decay, K back-solved
  // ---------------------------------------------------------------------
  await test('Slug Test — Hvorslev', page, async () => {
    await resetState(page);
    const expected = await page.evaluate(() => {
      const rc = 0.05, rw = 0.05, Le = 3;
      const K_target = 1e-5; // m/s
      const slope = -(2 * Le * K_target) / (rc * rc * Math.log(Le / rw)); // 1/s
      const H0 = 1.0;
      const data = [];
      for (let i = 1; i <= 40; i++) {
        const t_min = i * 0.25;
        const H = H0 * Math.exp(slope * t_min * 60);
        if (H > 1e-6) data.push({ t: t_min, s: H });
      }
      APP.data = data;
      populateDataTable();
      applyPreprocessing();
      document.getElementById('analysisMethod').value = 'slug-test';
      onMethodChange();
      document.getElementById('slugMethod').value = 'hvorslev';
      document.getElementById('slugRc').value = rc;
      document.getElementById('slugRw').value = rw;
      document.getElementById('slugLe').value = Le;
      document.getElementById('slugRe').value = Le;
      runSlugTest();
      return { K_target_mday: K_target * 86400 };
    });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => APP.results);
    if (!r || r.method !== 'slug-test') throw new Error('no slug-test result');
    const ratio = r.K / expected.K_target_mday;
    if (ratio < 0.9 || ratio > 1.1) throw new Error(`K=${r.K} expected ~${expected.K_target_mday} (ratio ${ratio.toFixed(3)})`);
    if (!(r.R2 > 0.99)) throw new Error(`R²=${r.R2} (synthetic should be ~1)`);
    return `K=${r.K.toFixed(4)} m/day (target ${expected.K_target_mday.toFixed(4)}, ratio ${ratio.toFixed(3)}), R²=${r.R2.toFixed(4)}`;
  });

  await test('Slug Test — Bouwer–Rice', page, async () => {
    await resetState(page);
    const expected = await page.evaluate(() => {
      const rc = 0.05, rw = 0.075, Le = 4, Re = 5;
      const K_target = 5e-6;
      const slope = -(2 * Le * K_target) / (rc * rc * Math.log(Re / rw));
      const H0 = 0.8;
      const data = [];
      for (let i = 1; i <= 40; i++) {
        const t_min = i * 0.5;
        const H = H0 * Math.exp(slope * t_min * 60);
        if (H > 1e-6) data.push({ t: t_min, s: H });
      }
      APP.data = data;
      populateDataTable();
      applyPreprocessing();
      document.getElementById('analysisMethod').value = 'slug-test';
      onMethodChange();
      document.getElementById('slugMethod').value = 'bouwer-rice';
      document.getElementById('slugRc').value = rc;
      document.getElementById('slugRw').value = rw;
      document.getElementById('slugLe').value = Le;
      document.getElementById('slugRe').value = Re;
      runSlugTest();
      return { K_target_mday: K_target * 86400 };
    });
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => APP.results);
    if (!r || r.subMethod !== 'bouwer-rice') throw new Error('no bouwer-rice result');
    const ratio = r.K / expected.K_target_mday;
    if (ratio < 0.9 || ratio > 1.1) throw new Error(`K ratio off: ${ratio.toFixed(3)}`);
    return `K=${r.K.toFixed(5)} m/day (target ${expected.K_target_mday.toFixed(5)}), R²=${r.R2.toFixed(4)}`;
  });

  // ---------------------------------------------------------------------
  // 9c. Slug Test built-in example loader
  // ---------------------------------------------------------------------
  await test('Slug Test — built-in example loader', page, async () => {
    await resetState(page);
    await page.evaluate(() => loadSlugTestExampleData());
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => APP.results);
    if (!r || r.method !== 'slug-test') throw new Error('loader did not run slug fit');
    if (r.subMethod !== 'hvorslev') throw new Error(`expected hvorslev sub-method, got ${r.subMethod}`);
    // K_target = 1e-5 m/s ≈ 0.864 m/day; ±2% noise → expect within ~10%.
    const ratio = r.K / 0.864;
    if (ratio < 0.85 || ratio > 1.15) throw new Error(`K=${r.K.toFixed(4)} far from target 0.864 (ratio ${ratio.toFixed(3)})`);
    if (!(r.R2 > 0.95)) throw new Error(`R²=${r.R2.toFixed(4)} below 0.95 (noise should still fit cleanly)`);
    return `K=${r.K.toFixed(4)} m/day (target 0.864, ratio ${ratio.toFixed(3)}), R²=${r.R2.toFixed(4)}`;
  });

  // ---------------------------------------------------------------------
  // 10. Outlier detection + Remove Permanently
  // ---------------------------------------------------------------------
  await test('Outlier flag + Remove Permanently', page, async () => {
    await resetState(page);
    await page.evaluate(() => {
      // Tame baseline + 2 obvious outliers
      const data = [];
      for (let i = 1; i <= 40; i++) data.push({ t: i, s: 0.1 * Math.log(1 + i) });
      data[10].s = 99;     // outlier
      data[25].s = 200;    // outlier
      APP.data = data;
      populateDataTable();
    });
    const before = await page.evaluate(() => APP.data.length);
    await page.evaluate(() => {
      document.getElementById('chkOutlier').checked = true;
      applyPreprocessing();
    });
    const flagged = await page.evaluate(() => (APP.outlierFlags || []).filter(Boolean).length);
    if (flagged < 2) throw new Error(`expected ≥2 flagged, got ${flagged}`);
    await page.evaluate(() => removeOutliersPermanently());
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => APP.data.length);
    if (after !== before - flagged) throw new Error(`expected ${before - flagged} rows after removal, got ${after}`);
    const stillFlagged = await page.evaluate(() => (APP.outlierFlags || []).filter(Boolean).length);
    if (stillFlagged !== 0) throw new Error(`outlier flags should clear, still ${stillFlagged}`);
    return `${before} → ${after} rows (removed ${flagged})`;
  });

  // ---------------------------------------------------------------------
  // 11. Preprocessing toggles do not throw
  // ---------------------------------------------------------------------
  await test('Preprocessing toggles (smooth + detrend + WBS)', page, async () => {
    await resetState(page);
    await page.evaluate(() => loadExampleData());
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      document.getElementById('chkSmooth').checked = true;
      document.getElementById('chkDetrend').checked = true;
      document.getElementById('chkWBS').checked = true;
      applyPreprocessing();
    });
    const len = await page.evaluate(() => APP.processed.length);
    if (!len) throw new Error('processed dataset empty');
    return `processed n=${len}`;
  });

  await browser.close();

  // -----------------------------------------------------------------
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n────────── Summary ──────────`);
  console.log(`  ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
  console.error('Runner crashed:', err);
  process.exit(2);
});
