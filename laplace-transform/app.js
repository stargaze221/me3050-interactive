(() => {
  "use strict";

  const T = 10;
  const N = 900;
  const omegaMax = 6.0;
  const EPS = 1e-9;

  const presets = {
    decaying: {
      formula: "f(t) = e<sup>−0.35t</sup> cos(3t)",
      hint: "What to notice: the signal already decays. Even at σ = 0 its long-time integral can converge; adding σ gives additional exponential weighting.",
      keyFreqs: [3],
      keyAmps: [1],
      defaultOmega: 3,
      defaultSigma: 0,
      value: t => Math.exp(-0.35 * t) * Math.cos(3 * t)
    },
    pure: {
      formula: "f(t) = cos(3t)",
      hint: "What to notice: first use σ = 0 as a finite-window frequency-matching view near ω = 3 rad/s. Then add σ > 0 and watch the running integral settle.",
      keyFreqs: [3],
      keyAmps: [1],
      defaultOmega: 3,
      defaultSigma: 0,
      value: t => Math.cos(3 * t)
    },
    two: {
      formula: "f(t) = cos(2t) + 0.6 cos(5t)",
      hint: "What to notice: one signal can contain more than one oscillatory component. At σ = 0, the finite-window scan shows peaks near 2 and 5 rad/s.",
      keyFreqs: [2, 5],
      keyAmps: [1, 0.6],
      defaultOmega: 2,
      defaultSigma: 0,
      value: t => Math.cos(2 * t) + 0.6 * Math.cos(5 * t)
    },
    step: {
      formula: "f(t) = 1, &nbsp; t ≥ 0",
      hint: "What to notice: at ω = 0, σ > 0 is what makes the infinite-time Laplace integral converge. Increase σ and watch late-time contributions disappear.",
      keyFreqs: [0],
      keyAmps: [1],
      defaultOmega: 0,
      defaultSigma: 0.6,
      value: () => 1
    }
  };

  const omegaEl = document.getElementById("omega");
  const sigmaEl = document.getElementById("sigma");
  const presetEl = document.getElementById("signalPreset");
  const omegaVal = document.getElementById("omegaVal");
  const sigmaVal = document.getElementById("sigmaVal");
  const reStat = document.getElementById("reStat");
  const imStat = document.getElementById("imStat");
  const magStat = document.getElementById("magStat");
  const viewStat = document.getElementById("viewStat");
  const presetHint = document.getElementById("presetHint");
  const signalFormula = document.getElementById("signalFormula");
  const targetLegend = document.getElementById("targetLegend");
  const compareNote = document.getElementById("compareNote");
  const accumulationNote = document.getElementById("accumulationNote");
  const modeNote = document.getElementById("modeNote");
  const sweepLead = document.getElementById("sweepLead");
  const sweepNote = document.getElementById("sweepNote");
  const averageAid = document.getElementById("averageAid");
  const averageNote = document.getElementById("averageNote");
  const comparePlot = document.getElementById("comparePlot");
  const productPlot = document.getElementById("productPlot");
  const averagePlot = document.getElementById("averagePlot");
  const sweepPlot = document.getElementById("sweepPlot");
  const matchBtn = document.getElementById("matchBtn");

  const NS = "http://www.w3.org/2000/svg";
  const M = { left: 72, right: 28, top: 28, bottom: 58 };
  const W = 1000;
  const H = 430;
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const times = Array.from({ length: N }, (_, i) => (T * i) / (N - 1));
  let currentPreset = presets.decaying;
  let signal = times.map(currentPreset.value);
  let targetIndex = 0;

  function svgEl(name, attrs = {}, text = "") {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text) el.textContent = text;
    return el;
  }

  function clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function yScale(y, ymin, ymax) {
    return M.top + ((ymax - y) / (ymax - ymin)) * PH;
  }

  function niceExtent(values, pad = 0.12, includeZero = true) {
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (includeZero) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (Math.abs(hi - lo) < 1e-9) {
      hi += 1;
      lo -= 1;
    }
    const span = hi - lo;
    return [lo - pad * span, hi + pad * span];
  }

  function pathFrom(xs, ys, xmin, xmax, ymin, ymax) {
    let d = "";
    for (let i = 0; i < xs.length; i++) {
      const x = M.left + ((xs[i] - xmin) / (xmax - xmin)) * PW;
      const y = yScale(ys[i], ymin, ymax);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
    }
    return d.trim();
  }

  function drawAxes(svg, { xmin, xmax, ymin, ymax, xLabel, yLabel, xTicks = 6, yTicks = 5 }) {
    for (let i = 0; i <= xTicks; i++) {
      const v = xmin + ((xmax - xmin) * i) / xTicks;
      const x = M.left + ((v - xmin) / (xmax - xmin)) * PW;
      svg.appendChild(svgEl("line", { x1: x, x2: x, y1: M.top, y2: H - M.bottom, class: "grid" }));
      svg.appendChild(svgEl("text", { x, y: H - M.bottom + 22, "text-anchor": "middle", class: "ticktext" }, formatTick(v)));
    }

    for (let i = 0; i <= yTicks; i++) {
      const v = ymin + ((ymax - ymin) * i) / yTicks;
      const y = yScale(v, ymin, ymax);
      svg.appendChild(svgEl("line", { x1: M.left, x2: W - M.right, y1: y, y2: y, class: "grid" }));
      svg.appendChild(svgEl("text", { x: M.left - 10, y: y + 4, "text-anchor": "end", class: "ticktext" }, formatTick(v)));
    }

    svg.appendChild(svgEl("line", { x1: M.left, x2: W - M.right, y1: H - M.bottom, y2: H - M.bottom, class: "axis" }));
    svg.appendChild(svgEl("line", { x1: M.left, x2: M.left, y1: M.top, y2: H - M.bottom, class: "axis" }));

    if (ymin <= 0 && ymax >= 0) {
      const yz = yScale(0, ymin, ymax);
      svg.appendChild(svgEl("line", { x1: M.left, x2: W - M.right, y1: yz, y2: yz, class: "zero-line" }));
    }

    svg.appendChild(svgEl("text", { x: M.left + PW / 2, y: H - 12, "text-anchor": "middle", class: "axislabel" }, xLabel));
    svg.appendChild(svgEl("text", {
      x: 18,
      y: M.top + PH / 2,
      "text-anchor": "middle",
      class: "axislabel",
      transform: `rotate(-90 18 ${M.top + PH / 2})`
    }, yLabel));
  }

  function formatTick(v) {
    if (Math.abs(v) < 1e-10) return "0";
    if (Math.abs(v) >= 10) return v.toFixed(0);
    return v.toFixed(1).replace(/\.0$/, "");
  }

  function trapz(values) {
    const dt = T / (N - 1);
    let sum = 0;
    for (let i = 1; i < values.length; i++) {
      sum += 0.5 * (values[i - 1] + values[i]) * dt;
    }
    return sum;
  }

  function finiteTransform(omega, sigma) {
    const reVals = new Array(N);
    const imVals = new Array(N);

    for (let i = 0; i < N; i++) {
      const t = times[i];
      const weight = Math.exp(-sigma * t);
      reVals[i] = signal[i] * weight * Math.cos(omega * t);
      imVals[i] = -signal[i] * weight * Math.sin(omega * t);
    }

    const re = trapz(reVals);
    const im = trapz(imVals);
    return { re, im, mag: Math.hypot(re, im), reVals, imVals };
  }

  function runningTrapz(values) {
    const dt = T / (N - 1);
    const out = new Array(N).fill(0);
    for (let i = 1; i < N; i++) {
      out[i] = out[i - 1] + 0.5 * (values[i - 1] + values[i]) * dt;
    }
    return out;
  }

  function runningAverage(running, sourceValues) {
    const out = new Array(N);
    out[0] = sourceValues[0];
    for (let i = 1; i < N; i++) {
      out[i] = running[i] / times[i];
    }
    return out;
  }

  function nearestKeyFrequency(omega) {
    return currentPreset.keyFreqs.reduce((best, f) => {
      return Math.abs(omega - f) < Math.abs(omega - best) ? f : best;
    }, currentPreset.keyFreqs[0]);
  }

  function nearestKeyIndex(omega) {
    let best = 0;
    for (let i = 1; i < currentPreset.keyFreqs.length; i++) {
      if (Math.abs(omega - currentPreset.keyFreqs[i]) < Math.abs(omega - currentPreset.keyFreqs[best])) best = i;
    }
    return best;
  }

  function isSigmaZero(sigma) {
    return Math.abs(sigma) < EPS;
  }

  function drawCompare(omega, sigma) {
    clear(comparePlot);
    const kernel = times.map(t => Math.exp(-sigma * t) * Math.cos(omega * t));
    const [ymin, ymax] = niceExtent(signal.concat(kernel), 0.1, true);

    drawAxes(comparePlot, {
      xmin: 0,
      xmax: T,
      ymin,
      ymax,
      xLabel: "time t",
      yLabel: "amplitude"
    });

    comparePlot.appendChild(svgEl("path", {
      d: pathFrom(times, signal, 0, T, ymin, ymax),
      class: "signal-line"
    }));
    comparePlot.appendChild(svgEl("path", {
      d: pathFrom(times, kernel, 0, T, ymin, ymax),
      class: "kernel-line"
    }));

    if (presetEl.value === "step") {
      if (omega < 0.18) {
        compareNote.innerHTML = `<strong>No oscillatory cancellation:</strong> with ω near 0, the real kernel is essentially e<sup>−σt</sup>. ${sigma > 0 ? "Positive σ suppresses later-time area and makes the step's Laplace integral converge." : "With σ = 0, every time contributes equally and the accumulation grows without bound as T increases."}`;
      } else {
        compareNote.innerHTML = `<strong>Oscillatory cancellation:</strong> the step signal does not oscillate, but the test kernel does. Over a finite window, positive and negative pieces partly cancel.${sigma > 0 ? " Exponential weighting also suppresses late-time pieces." : " Without damping, the ordinary infinite-time integral still does not settle."}`;
      }
      return;
    }

    const nearest = nearestKeyFrequency(omega);
    const freqDiff = Math.abs(omega - nearest);
    if (freqDiff < 0.18) {
      compareNote.innerHTML = `<strong>Frequency alignment:</strong> ω is near ${nearest} rad/s, one of this signal's main oscillatory components. ${isSigmaZero(sigma) ? "The oscillations stay aligned in the real channel." : "The factor e<sup>−σt</sup> additionally reduces later-time contributions."}`;
    } else if (freqDiff < 0.8) {
      compareNote.innerHTML = `<strong>Partial alignment:</strong> the test oscillation is near a signal component, but its phase slowly drifts relative to the signal.${sigma > 0 ? " Exponential weighting reduces the influence of later drift." : ""}`;
    } else {
      compareNote.innerHTML = `<strong>Frequency mismatch:</strong> the test pattern repeatedly moves in and out of phase with the signal, producing positive and negative contributions that tend to cancel.${sigma > 0 ? " Exponential weighting reduces the influence of later time." : ""}`;
    }
  }

  function drawProduct(tf, omega, sigma) {
    clear(productPlot);
    const running = runningTrapz(tf.reVals);
    const [ymin, ymax] = niceExtent(tf.reVals.concat(running), 0.12, true);

    drawAxes(productPlot, {
      xmin: 0,
      xmax: T,
      ymin,
      ymax,
      xLabel: "time t",
      yLabel: "product / finite-window accumulation"
    });

    productPlot.appendChild(svgEl("path", {
      d: pathFrom(times, tf.reVals, 0, T, ymin, ymax),
      class: "product-line"
    }));
    productPlot.appendChild(svgEl("path", {
      d: pathFrom(times, running, 0, T, ymin, ymax),
      class: "running-line"
    }));

    const nearest = nearestKeyFrequency(omega);
    const matched = Math.abs(omega - nearest) < 0.18;

    if (sigma > 0) {
      accumulationNote.innerHTML = `<strong>Laplace convergence picture:</strong> e<sup>−σt</sup> makes the product shrink with time. The running integral should flatten as late-time additions become negligible. A flatter tail means F<sub>T</sub>(s) is approaching its infinite-time value F(s).`;
    } else if (presetEl.value === "decaying") {
      accumulationNote.innerHTML = `<strong>The signal itself supplies the decay:</strong> even with σ = 0, f(t) contains e<sup>−0.35t</sup>, so the product shrinks and the running integral can converge.`;
    } else if (presetEl.value === "step") {
      accumulationNote.innerHTML = omega < 0.18
        ? `<strong>No damping and no cancellation:</strong> at σ = 0 and ω = 0, the product is 1, so the running integral grows approximately as T. This is why ℒ{1} requires Re(s) &gt; 0.`
        : `<strong>Finite-window oscillation:</strong> positive and negative pieces cancel, but the raw running integral can keep oscillating instead of approaching a single limit. This σ = 0 display is therefore a finite-window view.`;
    } else if (matched) {
      accumulationNote.innerHTML = `<strong>Matched undamped oscillation:</strong> the product contains a persistent nonzero average component, so the raw running integral grows with the observation window. Use the time-averaged teaching aid below to isolate the stable frequency-match level.`;
    } else {
      accumulationNote.innerHTML = `<strong>Mismatched undamped oscillation:</strong> positive and negative contributions repeatedly cancel. The raw running integral can remain bounded yet oscillatory; it does not have to converge to zero. The time-averaged teaching aid below makes the cancellation trend clearer.`;
    }

    return running;
  }

  function drawAverage(running, tf, omega, sigma) {
    const show = isSigmaZero(sigma) && (presetEl.value === "pure" || presetEl.value === "two");
    averageAid.hidden = !show;
    if (!show) return;

    clear(averagePlot);
    const avg = runningAverage(running, tf.reVals);
    const trimmed = avg.slice(Math.max(1, Math.floor(N * 0.01)));
    let [ymin, ymax] = niceExtent(trimmed, 0.12, true);
    ymin = Math.max(ymin, -1.25);
    ymax = Math.min(ymax, 1.25);
    if (ymax - ymin < 0.3) {
      ymin -= 0.15;
      ymax += 0.15;
    }

    drawAxes(averagePlot, {
      xmin: 0,
      xmax: T,
      ymin,
      ymax,
      xLabel: "elapsed time t",
      yLabel: "time-averaged matching A(t)"
    });

    averagePlot.appendChild(svgEl("path", {
      d: pathFrom(times, avg, 0, T, ymin, ymax),
      class: "average-line"
    }));

    const idx = nearestKeyIndex(omega);
    const nearest = currentPreset.keyFreqs[idx];
    const diff = Math.abs(omega - nearest);
    const expected = currentPreset.keyAmps[idx] / 2;
    const currentAvg = avg[N - 1];

    if (diff < 0.18) {
      averageNote.innerHTML = `<strong>Matched frequency:</strong> for this cosine component, the real-channel time average approaches about ${expected.toFixed(2)} for a long window (amplitude ÷ 2). Current A(T) = ${currentAvg.toFixed(3)}. The remaining ripple comes from the finite window and other oscillatory terms.`;
    } else {
      averageNote.innerHTML = `<strong>Mismatched frequency:</strong> the time average trends toward 0 as the positive and negative product contributions cancel over longer windows. Current A(T) = ${currentAvg.toFixed(3)}. This is an orthogonality-style teaching aid, not F(s).`;
    }
  }

  function drawSweep(sigma, omega) {
    clear(sweepPlot);
    const count = 241;
    const omegas = Array.from({ length: count }, (_, i) => (omegaMax * i) / (count - 1));
    const mags = omegas.map(w => finiteTransform(w, sigma).mag);
    const ymax = Math.max(...mags) * 1.12 || 1;
    const ymin = 0;

    drawAxes(sweepPlot, {
      xmin: 0,
      xmax: omegaMax,
      ymin,
      ymax,
      xLabel: "test frequency ω (rad/s)",
      yLabel: "|F_T(σ + jω)|",
      xTicks: 6,
      yTicks: 5
    });

    sweepPlot.appendChild(svgEl("path", {
      d: pathFrom(omegas, mags, 0, omegaMax, ymin, ymax),
      class: "sweep-line"
    }));

    const currentTf = finiteTransform(omega, sigma);
    const xcur = M.left + (omega / omegaMax) * PW;
    const ycur = yScale(currentTf.mag, ymin, ymax);
    sweepPlot.appendChild(svgEl("line", {
      x1: xcur,
      x2: xcur,
      y1: M.top,
      y2: H - M.bottom,
      class: "current-line"
    }));
    sweepPlot.appendChild(svgEl("circle", {
      cx: xcur,
      cy: ycur,
      r: 6,
      class: "current-dot"
    }));

    currentPreset.keyFreqs.forEach(freq => {
      const xtarget = M.left + (freq / omegaMax) * PW;
      sweepPlot.appendChild(svgEl("line", {
        x1: xtarget,
        x2: xtarget,
        y1: M.top,
        y2: H - M.bottom,
        class: "target-line"
      }));
    });

    if (isSigmaZero(sigma) && (presetEl.value === "pure" || presetEl.value === "two" || presetEl.value === "step")) {
      sweepLead.innerHTML = `Hold σ = 0 and scan ω. This graph shows the <strong>finite-window</strong> magnitude <span class="formula">|F<sub>T</sub>(jω)|</span>. Peaks reveal frequencies that accumulate strongly over the displayed window.`;
      sweepNote.innerHTML = `<strong>Finite-window warning:</strong> for an undamped sinusoid or step, this σ = 0 scan is not an ordinary convergent Laplace transform to ∞. Peak width, sidelobes, and nonzero off-frequency values depend on the finite observation window.`;
    } else if (isSigmaZero(sigma) && presetEl.value === "decaying") {
      sweepLead.innerHTML = `Hold σ = 0 and scan ω. Because the selected signal already decays, <span class="formula">F<sub>T</sub>(jω)</span> approaches a convergent infinite-time transform as T becomes large.`;
      sweepNote.innerHTML = `<strong>Why this case is different:</strong> the factor e<sup>−0.35t</sup> is already inside f(t), so late-time contributions vanish even when the test kernel has σ = 0.`;
    } else {
      sweepLead.innerHTML = `Hold σ &gt; 0 and scan ω. The finite-window value <span class="formula">F<sub>T</sub>(σ + jω)</span> approaches the Laplace transform along the vertical line Re(s) = σ as the observation window becomes long enough.`;
      sweepNote.innerHTML = `<strong>Laplace view:</strong> positive σ exponentially suppresses late-time contributions. Once the running integral has settled, increasing the observation window changes F<sub>T</sub>(s) very little.`;
    }
  }

  function updatePresetText() {
    signalFormula.innerHTML = currentPreset.formula;
    presetHint.textContent = currentPreset.hint;
    const freqs = currentPreset.keyFreqs;
    targetLegend.textContent = freqs.length === 1
      ? `Key frequency ${freqs[0]} rad/s`
      : `Key frequencies ${freqs.join(" and ")} rad/s`;
    matchBtn.textContent = freqs.length > 1 ? "Jump to next key frequency" : "Jump to key frequency";
  }

  function updateModeNote(sigma) {
    if (sigma > 0) {
      modeNote.className = "mode-note laplace-mode";
      modeNote.innerHTML = `<strong>Laplace mode:</strong> σ &gt; 0 adds exponential damping e<sup>−σt</sup>. For the signals shown here, this makes the infinite-time transform converge.`;
      return;
    }

    modeNote.className = "mode-note fourier-mode";
    if (presetEl.value === "decaying") {
      modeNote.innerHTML = `<strong>Frequency-only kernel:</strong> σ = 0 removes extra kernel damping, but this particular signal already decays, so its infinite-time integral still converges.`;
    } else {
      modeNote.innerHTML = `<strong>Finite-window frequency view:</strong> σ = 0 removes exponential damping. For this non-decaying signal, interpret F<sub>T</sub>(jω) over the displayed finite window; do not treat it as an ordinary convergent Laplace integral to ∞.`;
    }
  }

  function update() {
    const omega = Number(omegaEl.value);
    const sigma = Number(sigmaEl.value);
    const tf = finiteTransform(omega, sigma);

    omegaVal.textContent = `${omega.toFixed(2)} rad/s`;
    sigmaVal.textContent = sigma.toFixed(2);
    reStat.textContent = tf.re.toFixed(3);
    imStat.textContent = tf.im.toFixed(3);
    magStat.textContent = tf.mag.toFixed(3);

    if (sigma > 0) {
      viewStat.textContent = "Laplace weighting (σ > 0)";
    } else if (presetEl.value === "decaying") {
      viewStat.textContent = "σ = 0, but signal decays";
    } else {
      viewStat.textContent = "Finite-window frequency view";
    }

    updateModeNote(sigma);
    drawCompare(omega, sigma);
    const running = drawProduct(tf, omega, sigma);
    drawAverage(running, tf, omega, sigma);
    drawSweep(sigma, omega);
  }

  presetEl.addEventListener("change", () => {
    currentPreset = presets[presetEl.value];
    signal = times.map(currentPreset.value);
    targetIndex = 0;
    omegaEl.value = String(currentPreset.defaultOmega);
    sigmaEl.value = String(currentPreset.defaultSigma);
    updatePresetText();
    update();
  });

  omegaEl.addEventListener("input", update);
  sigmaEl.addEventListener("input", update);

  document.getElementById("fourierBtn").addEventListener("click", () => {
    sigmaEl.value = "0";
    update();
  });

  document.getElementById("laplaceBtn").addEventListener("click", () => {
    sigmaEl.value = "0.6";
    update();
  });

  matchBtn.addEventListener("click", () => {
    const freqs = currentPreset.keyFreqs;
    omegaEl.value = String(freqs[targetIndex]);
    targetIndex = (targetIndex + 1) % freqs.length;
    update();
  });

  updatePresetText();
  update();
})();