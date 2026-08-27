(() => {
  "use strict";

  const T = 10;
  const N = 900;
  const omegaMax = 6.0;

  const presets = {
    decaying: {
      formula: "f(t) = e<sup>−0.35t</sup> cos(3t)",
      hint: "What to notice: the signal contains both oscillation and decay. Start near ω = 3, then add σ to see exponential weighting.",
      keyFreqs: [3],
      defaultOmega: 3,
      defaultSigma: 0,
      value: t => Math.exp(-0.35 * t) * Math.cos(3 * t)
    },
    pure: {
      formula: "f(t) = cos(3t)",
      hint: "What to notice: with σ = 0, the frequency scan gives the clearest Fourier-like matching near ω = 3 rad/s.",
      keyFreqs: [3],
      defaultOmega: 3,
      defaultSigma: 0,
      value: t => Math.cos(3 * t)
    },
    two: {
      formula: "f(t) = cos(2t) + 0.6 cos(5t)",
      hint: "What to notice: one signal can contain more than one oscillatory component. Look for two peaks near 2 and 5 rad/s.",
      keyFreqs: [2, 5],
      defaultOmega: 2,
      defaultSigma: 0,
      value: t => Math.cos(2 * t) + 0.6 * Math.cos(5 * t)
    },
    step: {
      formula: "f(t) = 1, &nbsp; t ≥ 0",
      hint: "What to notice: there is no oscillation to match. At ω = 0, changing σ directly changes the exponential weighting of the accumulated area.",
      keyFreqs: [0],
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
  const comparePlot = document.getElementById("comparePlot");
  const productPlot = document.getElementById("productPlot");
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

  function nearestKeyFrequency(omega) {
    return currentPreset.keyFreqs.reduce((best, f) => {
      return Math.abs(omega - f) < Math.abs(omega - best) ? f : best;
    }, currentPreset.keyFreqs[0]);
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
        compareNote.innerHTML = `<strong>No oscillatory mismatch:</strong> with ω near 0, the kernel is essentially e<sup>−σt</sup>. ${sigma > 0 ? "Changing σ changes how strongly later time is weighted." : "With σ = 0, every time contributes equally over this finite window."}`;
      } else {
        compareNote.innerHTML = `<strong>Oscillatory cancellation:</strong> the step signal does not oscillate, but the test kernel does. Positive and negative contributions increasingly cancel.`;
      }
      return;
    }

    const nearest = nearestKeyFrequency(omega);
    const freqDiff = Math.abs(omega - nearest);
    if (freqDiff < 0.18) {
      compareNote.innerHTML = `<strong>Frequency alignment:</strong> ω is near ${nearest} rad/s, one of this signal's main oscillatory components. ${sigma === 0 ? "With σ = 0, there is no extra exponential weighting." : "The factor e<sup>−σt</sup> additionally emphasizes earlier time."}`;
    } else if (freqDiff < 0.8) {
      compareNote.innerHTML = `<strong>Partial alignment:</strong> the test oscillation is near a signal component, but agreement drifts over time. ${sigma > 0 ? "Exponential weighting also reduces later-time contributions." : ""}`;
    } else {
      compareNote.innerHTML = `<strong>Frequency mismatch:</strong> positive and negative contributions tend to cancel because the test pattern does not remain aligned with a main signal component. ${sigma > 0 ? "Exponential weighting reduces the influence of later time." : ""}`;
    }
  }

  function drawProduct(tf) {
    clear(productPlot);
    const running = runningTrapz(tf.reVals);
    const [ymin, ymax] = niceExtent(tf.reVals.concat(running), 0.12, true);

    drawAxes(productPlot, {
      xmin: 0,
      xmax: T,
      ymin,
      ymax,
      xLabel: "time t",
      yLabel: "product / accumulated value"
    });

    productPlot.appendChild(svgEl("path", {
      d: pathFrom(times, tf.reVals, 0, T, ymin, ymax),
      class: "product-line"
    }));
    productPlot.appendChild(svgEl("path", {
      d: pathFrom(times, running, 0, T, ymin, ymax),
      class: "running-line"
    }));
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

  function update() {
    const omega = Number(omegaEl.value);
    const sigma = Number(sigmaEl.value);
    const tf = finiteTransform(omega, sigma);

    omegaVal.textContent = `${omega.toFixed(2)} rad/s`;
    sigmaVal.textContent = sigma.toFixed(2);
    reStat.textContent = tf.re.toFixed(3);
    imStat.textContent = tf.im.toFixed(3);
    magStat.textContent = tf.mag.toFixed(3);
    viewStat.textContent = sigma < 1e-9 ? "Fourier-like (σ = 0)" : "Laplace weighting (σ > 0)";

    drawCompare(omega, sigma);
    drawProduct(tf);
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
