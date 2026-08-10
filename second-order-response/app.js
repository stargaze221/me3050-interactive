(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const wnEl = $("wn"), zetaEl = $("zeta"), gainEl = $("gain"), stepEl = $("stepAmp");
  const responsePlot = $("responsePlot"), polePlot = $("polePlot");
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}, text = null) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function fmt(x, d = 2) { return Number(Math.abs(x) < 1e-12 ? 0 : x).toFixed(d); }

  function parameters() {
    const wn = +wnEl.value;
    const zeta = +zetaEl.value;
    const K = +gainEl.value;
    const U0 = +stepEl.value;
    return { wn, zeta, K, U0, yss: K * U0 };
  }

  function regime(zeta) {
    if (zeta < 0.01) return "Undamped";
    if (zeta < 0.99) return "Underdamped";
    if (zeta <= 1.01) return "Critically damped";
    return "Overdamped";
  }

  function poles(p) {
    const { wn, zeta } = p;
    if (zeta < 1) {
      const im = wn * Math.sqrt(Math.max(0, 1 - zeta * zeta));
      return [{ re: -zeta * wn, im }, { re: -zeta * wn, im: -im }];
    }
    if (Math.abs(zeta - 1) < 1e-10) return [{ re: -wn, im: 0 }, { re: -wn, im: 0 }];
    const q = Math.sqrt(zeta * zeta - 1);
    return [
      { re: -wn * (zeta - q), im: 0 },
      { re: -wn * (zeta + q), im: 0 }
    ];
  }

  function dampedFrequency(p) {
    return p.zeta < 1 ? p.wn * Math.sqrt(Math.max(0, 1 - p.zeta * p.zeta)) : null;
  }

  function chooseTimeEnd(p) {
    const { wn, zeta } = p;
    if (zeta < 0.01) return 6 * 2 * Math.PI / wn;
    if (zeta < 0.9) {
      const wd = dampedFrequency(p);
      const period = 2 * Math.PI / Math.max(wd, 0.05 * wn);
      const settleScale = 8 / (zeta * wn);
      return Math.max(2 * period, Math.min(settleScale, 10 * period));
    }
    if (zeta <= 1.01) return 10 / wn;
    const ps = poles(p);
    const slow = Math.max(1e-8, Math.min(Math.abs(ps[0].re), Math.abs(ps[1].re)));
    return 8 / slow;
  }

  function simulate(p) {
    const tEnd = chooseTimeEnd(p);
    const N = 1600;
    const h = tEnd / N;
    let y = 0, v = 0;
    const data = [{ t: 0, y: 0 }];

    function deriv(yv, vv) {
      return {
        dy: vv,
        dv: p.K * p.wn * p.wn * p.U0 - 2 * p.zeta * p.wn * vv - p.wn * p.wn * yv
      };
    }

    for (let i = 0; i < N; i++) {
      const k1 = deriv(y, v);
      const k2 = deriv(y + 0.5 * h * k1.dy, v + 0.5 * h * k1.dv);
      const k3 = deriv(y + 0.5 * h * k2.dy, v + 0.5 * h * k2.dv);
      const k4 = deriv(y + h * k3.dy, v + h * k3.dv);
      y += h * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) / 6;
      v += h * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv) / 6;
      data.push({ t: (i + 1) * h, y });
    }
    return { data, tEnd };
  }

  function metrics(p, sim) {
    const { data } = sim;
    const yss = p.yss;
    const wd = dampedFrequency(p);
    let overshoot = 0, peakTime = null;
    if (p.zeta < 1) {
      overshoot = 100 * Math.exp(-p.zeta * Math.PI / Math.sqrt(Math.max(1e-12, 1 - p.zeta * p.zeta)));
      peakTime = Math.PI / Math.max(1e-12, wd);
    }

    const tol = 0.02 * Math.abs(yss);
    let settlingTime = null;
    if (p.zeta > 0.001) {
      let lastOutside = -1;
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i].y - yss) > tol) lastOutside = i;
      }
      if (lastOutside < data.length - 1) settlingTime = data[Math.min(lastOutside + 1, data.length - 1)].t;
    }

    const y10 = 0.1 * yss, y90 = 0.9 * yss;
    let t10 = null, t90 = null;
    for (const pt of data) {
      if (t10 === null && pt.y >= y10) t10 = pt.t;
      if (t90 === null && pt.y >= y90) { t90 = pt.t; break; }
    }
    const riseTime = (t10 !== null && t90 !== null) ? t90 - t10 : null;
    return { overshoot, peakTime, settlingTime, riseTime };
  }

  function niceTicks(min, max, count = 6) {
    const raw = Math.max(1e-10, (max - min) / count);
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / power;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * power;
    const start = Math.ceil(min / step) * step;
    const vals = [];
    for (let x = start; x <= max + 0.2 * step; x += step) vals.push(x);
    return vals;
  }

  function path(points, x, y) {
    return points.map((pt, i) => `${i ? "L" : "M"}${x(pt.t).toFixed(2)},${y(pt.y).toFixed(2)}`).join(" ");
  }

  function drawResponse(p, sim, m) {
    clear(responsePlot);
    const W = 1000, H = 500, M = { l: 72, r: 26, t: 26, b: 58 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const vals = sim.data.map(d => d.y);
    let yMin = Math.min(0, ...vals), yMax = Math.max(p.yss, ...vals);
    const span = Math.max(0.25, yMax - yMin);
    yMin -= 0.08 * span; yMax += 0.12 * span;
    const x = t => M.l + t / sim.tEnd * pw;
    const y = v => M.t + (yMax - v) / (yMax - yMin) * ph;

    for (const t of niceTicks(0, sim.tEnd, 6)) {
      responsePlot.appendChild(svgEl("line", { x1: x(t), y1: M.t, x2: x(t), y2: H - M.b, class: "grid" }));
      responsePlot.appendChild(svgEl("text", { x: x(t), y: H - M.b + 22, "text-anchor": "middle", class: "ticktext" }, fmt(t, t < 10 ? 2 : 1)));
    }
    for (const v of niceTicks(yMin, yMax, 6)) {
      responsePlot.appendChild(svgEl("line", { x1: M.l, y1: y(v), x2: W - M.r, y2: y(v), class: "grid" }));
      responsePlot.appendChild(svgEl("text", { x: M.l - 9, y: y(v) + 4, "text-anchor": "end", class: "ticktext" }, fmt(v, 2)));
    }

    const bandLo = 0.98 * p.yss, bandHi = 1.02 * p.yss;
    responsePlot.appendChild(svgEl("rect", { x: M.l, y: y(bandHi), width: pw, height: Math.max(1, y(bandLo) - y(bandHi)), class: "settle-band" }));
    responsePlot.appendChild(svgEl("line", { x1: M.l, y1: y(p.yss), x2: W - M.r, y2: y(p.yss), class: "steady-line" }));
    responsePlot.appendChild(svgEl("path", { d: path(sim.data, x, y), class: "response-line" }));

    if (m.peakTime !== null && m.peakTime <= sim.tEnd) {
      const peakY = p.yss * (1 + m.overshoot / 100);
      responsePlot.appendChild(svgEl("line", { x1: x(m.peakTime), y1: y(0), x2: x(m.peakTime), y2: y(peakY), class: "marker-line" }));
      responsePlot.appendChild(svgEl("circle", { cx: x(m.peakTime), cy: y(peakY), r: 4.5, class: "marker-dot" }));
      responsePlot.appendChild(svgEl("text", { x: x(m.peakTime) + 8, y: y(peakY) - 8, class: "marker-label" }, "peak"));
    }
    if (m.settlingTime !== null && m.settlingTime <= sim.tEnd) {
      responsePlot.appendChild(svgEl("line", { x1: x(m.settlingTime), y1: M.t, x2: x(m.settlingTime), y2: H - M.b, class: "marker-line" }));
      responsePlot.appendChild(svgEl("text", { x: x(m.settlingTime) + 7, y: M.t + 16, class: "marker-label" }, "2% settled"));
    }

    responsePlot.appendChild(svgEl("line", { x1: M.l, y1: H - M.b, x2: W - M.r, y2: H - M.b, class: "axis" }));
    responsePlot.appendChild(svgEl("line", { x1: M.l, y1: M.t, x2: M.l, y2: H - M.b, class: "axis" }));
    responsePlot.appendChild(svgEl("text", { x: M.l + pw / 2, y: H - 14, "text-anchor": "middle", class: "axislabel" }, "time t (s)"));
    responsePlot.appendChild(svgEl("text", { x: 18, y: M.t + ph / 2, "text-anchor": "middle", class: "axislabel", transform: `rotate(-90 18 ${M.t + ph / 2})` }, "output y(t)"));
  }

  function drawPolePlot(p) {
    clear(polePlot);
    const W = 620, H = 520, M = { l: 58, r: 28, t: 28, b: 52 };
    const ps = poles(p);
    const maxPole = Math.max(...ps.map(q => Math.hypot(q.re, q.im)), p.wn);
    const R = 1.25 * maxPole;
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const scale = Math.min(pw, ph) / (2 * R);
    const cx = M.l + pw / 2, cy = M.t + ph / 2;
    const x = re => cx + re * scale;
    const y = im => cy - im * scale;

    const tickStep = Math.max(0.5, Math.pow(10, Math.floor(Math.log10(R))) / (R < 3 ? 2 : 1));
    for (let a = -Math.ceil(R / tickStep) * tickStep; a <= R; a += tickStep) {
      if (Math.abs(a) < 1e-10) continue;
      polePlot.appendChild(svgEl("line", { x1: x(a), y1: M.t, x2: x(a), y2: H - M.b, class: "grid" }));
      polePlot.appendChild(svgEl("line", { x1: M.l, y1: y(a), x2: W - M.r, y2: y(a), class: "grid" }));
    }

    polePlot.appendChild(svgEl("circle", { cx, cy, r: p.wn * scale, class: "pole-circle" }));
    polePlot.appendChild(svgEl("text", { x: x(-0.7 * p.wn), y: y(0.72 * p.wn), class: "wn-label" }, "|s| = ωₙ"));
    polePlot.appendChild(svgEl("line", { x1: M.l, y1: cy, x2: W - M.r, y2: cy, class: "axis" }));
    polePlot.appendChild(svgEl("line", { x1: cx, y1: M.t, x2: cx, y2: H - M.b, class: "axis" }));

    if (p.zeta < 1) {
      polePlot.appendChild(svgEl("line", { x1: cx, y1: cy, x2: x(ps[0].re), y2: y(ps[0].im), class: "pole-ray" }));
      polePlot.appendChild(svgEl("line", { x1: cx, y1: cy, x2: x(ps[1].re), y2: y(ps[1].im), class: "pole-ray" }));
    }

    ps.forEach((q, i) => {
      const px = x(q.re), py = y(q.im), s = 7;
      polePlot.appendChild(svgEl("line", { x1: px - s, y1: py - s, x2: px + s, y2: py + s, class: "pole" }));
      polePlot.appendChild(svgEl("line", { x1: px - s, y1: py + s, x2: px + s, y2: py - s, class: "pole" }));
      if (!(p.zeta === 1 && i === 1)) {
        polePlot.appendChild(svgEl("text", { x: px + 10, y: py - 10, class: "pole-label" }, i === 0 ? "p₁" : "p₂"));
      }
    });

    polePlot.appendChild(svgEl("text", { x: W - M.r, y: cy - 9, "text-anchor": "end", class: "axislabel" }, "Re(s)"));
    polePlot.appendChild(svgEl("text", { x: cx + 9, y: M.t + 13, class: "axislabel" }, "Im(s)"));
  }

  function poleText(p) {
    const ps = poles(p);
    if (p.zeta < 1) return `${fmt(ps[0].re, 2)} ± j${fmt(Math.abs(ps[0].im), 2)}`;
    if (Math.abs(p.zeta - 1) < 1e-10) return `${fmt(-p.wn, 2)} (double)`;
    return `${fmt(ps[0].re, 2)}, ${fmt(ps[1].re, 2)}`;
  }

  function render() {
    const p = parameters();
    const sim = simulate(p);
    const m = metrics(p, sim);
    const wd = dampedFrequency(p);

    $("wnVal").textContent = `${fmt(p.wn, 1)} rad/s`;
    $("zetaVal").textContent = fmt(p.zeta, 2);
    $("gainVal").textContent = fmt(p.K, 2);
    $("stepVal").textContent = fmt(p.U0, 2);
    $("regimeStat").textContent = regime(p.zeta);
    $("steadyStat").textContent = fmt(p.yss, 3);
    $("wdStat").textContent = wd === null ? "—" : `${fmt(wd, 2)} rad/s`;
    $("poleStat").textContent = poleText(p);

    $("overshootMetric").textContent = p.zeta < 1 ? `${fmt(m.overshoot, 1)}%` : "0%";
    $("overshootNote").textContent = p.zeta < 1 ? "From damping ratio ζ" : "No overshoot for this standard step response";
    $("peakMetric").textContent = m.peakTime === null ? "—" : `${fmt(m.peakTime, 3)} s`;
    $("settlingMetric").textContent = m.settlingTime === null ? "Not settled" : `${fmt(m.settlingTime, 3)} s`;
    $("riseMetric").textContent = m.riseTime === null ? "—" : `${fmt(m.riseTime, 3)} s`;

    drawResponse(p, sim, m);
    drawPolePlot(p);
  }

  [wnEl, zetaEl, gainEl, stepEl].forEach(el => el.addEventListener("input", render));
  document.querySelectorAll("button[data-zeta]").forEach(btn => btn.addEventListener("click", () => {
    zetaEl.value = btn.dataset.zeta;
    render();
  }));

  render();
})();
