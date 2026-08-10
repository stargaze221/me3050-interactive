(() => {
"use strict";

const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const ctype = $("ctype"), Pg = $("plantGain"), Pwn = $("plantWn"), Pz = $("plantZeta");
const kc = $("kc"), ki = $("ki"), kd = $("kd");
const responsePlot = $("responsePlot"), controlPlot = $("controlPlot");
const rootLocusPlot = $("rootLocusPlot"), marginPlot = $("marginPlot");
const EPS = 1e-10;

function E(tag, attrs = {}, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== null) e.textContent = text;
  return e;
}
function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
function fmt(v, d = 2) { return Number(Math.abs(v) < 1e-12 ? 0 : v).toFixed(d); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function params() {
  const type = ctype.value;
  return {
    type,
    Kp: +Pg.value,
    wn: +Pwn.value,
    zeta: +Pz.value,
    Kc: +kc.value,
    Ki: (type === "PI" || type === "PID") ? +ki.value : 0,
    Kd: (type === "PD" || type === "PID") ? +kd.value : 0,
    r: 1
  };
}

function closedLoop(q, alpha = 1) {
  const a2 = 2 * q.zeta * q.wn + alpha * q.Kp * q.wn * q.wn * q.Kd;
  const a1 = q.wn * q.wn * (1 + alpha * q.Kp * q.Kc);
  const a0 = alpha * q.Kp * q.wn * q.wn * q.Ki;
  if (q.Ki <= EPS) return { stable: a2 > 0 && a1 > 0, a2, a1, a0, margin: null, order: 2 };
  const margin = a2 * a1 - a0;
  return { stable: a2 > 0 && a1 > 0 && a0 > 0 && margin > 0, a2, a1, a0, margin, order: 3 };
}

function finalValue(q, cl) {
  if (!cl.stable) return null;
  return q.Ki > EPS ? q.r : (q.Kp * q.Kc / (1 + q.Kp * q.Kc)) * q.r;
}

function simulate(q) {
  const tEnd = Math.min(45, Math.max(8, 8 / (Math.max(.1, q.zeta) * q.wn), 12 / q.wn));
  const N = 2600, h = tEnd / N;
  let y = 0, v = 0, I = 0;
  const data = [];
  let diverged = false;

  function f(Y, V, J) {
    const e = q.r - Y;
    const u = q.Kc * e + q.Ki * J - q.Kd * V;
    return {
      y: V,
      v: q.Kp * q.wn * q.wn * u - 2 * q.zeta * q.wn * V - q.wn * q.wn * Y,
      i: e,
      u
    };
  }

  for (let n = 0; n <= N; n++) {
    const t = n * h, a = f(y, v, I);
    data.push({ t, y, u: a.u });
    if (n === N) break;
    const b = f(y + .5 * h * a.y, v + .5 * h * a.v, I + .5 * h * a.i);
    const c = f(y + .5 * h * b.y, v + .5 * h * b.v, I + .5 * h * b.i);
    const d = f(y + h * c.y, v + h * c.v, I + h * c.i);
    y += h * (a.y + 2 * b.y + 2 * c.y + d.y) / 6;
    v += h * (a.v + 2 * b.v + 2 * c.v + d.v) / 6;
    I += h * (a.i + 2 * b.i + 2 * c.i + d.i) / 6;
    if (!Number.isFinite(y) || !Number.isFinite(v) || !Number.isFinite(I) ||
        Math.abs(y) > 50 || Math.abs(v) > 250 || Math.abs(I) > 250) {
      diverged = true;
      break;
    }
  }
  return { data, tEnd: data[data.length - 1].t || tEnd, diverged };
}

function metrics(q, cl, sim) {
  const yss = finalValue(q, cl);
  const uPeak = Math.max(...sim.data.map(d => Math.abs(d.u)));
  if (yss === null) return { yss: null, sse: null, os: null, uPeak, ts: null };
  const tol = .02 * Math.max(1e-6, Math.abs(yss));
  let maxY = -Infinity, last = -1;
  for (let i = 0; i < sim.data.length; i++) {
    const d = sim.data[i];
    maxY = Math.max(maxY, d.y);
    if (Math.abs(d.y - yss) > tol) last = i;
  }
  const ts = last < sim.data.length - 1 ? sim.data[Math.min(last + 1, sim.data.length - 1)].t : null;
  return { yss, sse: q.r - yss, os: Math.max(0, 100 * (maxY - q.r) / Math.abs(q.r)), uPeak, ts };
}

function nice(min, max, n = 6) {
  const raw = Math.max(1e-9, (max - min) / n);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const r = raw / pow;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * pow;
  const start = Math.ceil(min / step) * step;
  const a = [];
  for (let v = start; v <= max + .2 * step; v += step) a.push(v);
  return a;
}

function drawTimePlot(svg, sim, key, yref, klass, H, yss = null, unstable = false) {
  clear(svg);
  const W = 1000, M = { l: 70, r: 25, t: 20, b: 55 };
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const vals = sim.data.map(d => d[key]);
  let ymin = Math.min(0, ...vals), ymax = Math.max(yref ?? 0, ...vals);
  const pad = .12 * Math.max(.3, ymax - ymin);
  ymin -= pad; ymax += pad;
  const span = Math.max(1e-9, ymax - ymin);
  const x = t => M.l + t / Math.max(1e-9, sim.tEnd) * pw;
  const y = v => M.t + (ymax - v) / span * ph;

  for (let i = 0; i <= 6; i++) {
    const t = sim.tEnd * i / 6;
    svg.appendChild(E("line", { x1: x(t), y1: M.t, x2: x(t), y2: H - M.b, class: "grid" }));
    svg.appendChild(E("text", { x: x(t), y: H - M.b + 20, "text-anchor": "middle", class: "tick" }, fmt(t, t < 10 ? 2 : 1)));
  }
  nice(ymin, ymax, 6).forEach(vv => {
    svg.appendChild(E("line", { x1: M.l, y1: y(vv), x2: W - M.r, y2: y(vv), class: Math.abs(vv) < 1e-9 ? "zero" : "grid" }));
    svg.appendChild(E("text", { x: M.l - 8, y: y(vv) + 4, "text-anchor": "end", class: "tick" }, fmt(vv, 1)));
  });

  if (key === "y") {
    if (yss !== null) {
      const tol = .02 * Math.max(1e-6, Math.abs(yss));
      const yTop = Math.max(M.t, y(yss + tol));
      const yBottom = Math.min(H - M.b, y(yss - tol));
      svg.appendChild(E("rect", { x: M.l, y: yTop, width: pw, height: Math.max(1, yBottom - yTop), class: "settle-band" }));
    }
    svg.appendChild(E("line", { x1: M.l, y1: y(1), x2: W - M.r, y2: y(1), class: "setpoint-line" }));
  }

  const d = sim.data.map((q, i) => (i ? "L" : "M") + x(q.t).toFixed(2) + "," + y(q[key]).toFixed(2)).join(" ");
  svg.appendChild(E("path", { d, class: unstable && key === "y" ? "response unstable-response" : klass }));
  svg.appendChild(E("line", { x1: M.l, y1: H - M.b, x2: W - M.r, y2: H - M.b, class: "axis" }));
  svg.appendChild(E("line", { x1: M.l, y1: M.t, x2: M.l, y2: H - M.b, class: "axis" }));
  svg.appendChild(E("text", { x: M.l + pw / 2, y: H - 12, "text-anchor": "middle", class: "axislabel" }, "time t (s)"));
  svg.appendChild(E("text", { x: 18, y: M.t + ph / 2, "text-anchor": "middle", class: "axislabel", transform: `rotate(-90 18 ${M.t + ph / 2})` }, key === "y" ? "output y(t)" : "control u(t)"));
}

function quadraticRoots(a, b, c) {
  if (Math.abs(a) < EPS) return Math.abs(b) < EPS ? [] : [{ re: -c / b, im: 0 }];
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return [{ re: (-b + s) / (2 * a), im: 0 }, { re: (-b - s) / (2 * a), im: 0 }];
  }
  const s = Math.sqrt(-disc);
  return [{ re: -b / (2 * a), im: s / (2 * a) }, { re: -b / (2 * a), im: -s / (2 * a) }];
}

function cubicRoots(a, b, c, d) {
  if (Math.abs(a) < EPS) return quadraticRoots(b, c, d);
  const A = b / a, B = c / a, C = d / a;
  const p = B - A * A / 3;
  const q = 2 * A * A * A / 27 - A * B / 3 + C;
  const delta = q * q / 4 + p * p * p / 27;
  const shift = A / 3;

  if (delta >= -1e-12) {
    const sd = Math.sqrt(Math.max(0, delta));
    const u = Math.cbrt(-q / 2 + sd);
    const v = Math.cbrt(-q / 2 - sd);
    const x1 = u + v - shift;
    const re = -(u + v) / 2 - shift;
    const im = Math.sqrt(3) * (u - v) / 2;
    if (Math.abs(im) < 1e-9) return [{ re: x1, im: 0 }, { re, im: 0 }, { re, im: 0 }];
    return [{ re: x1, im: 0 }, { re, im }, { re, im: -im }];
  }

  const rho = 2 * Math.sqrt(-p / 3);
  const arg = clamp((3 * q / (2 * p)) * Math.sqrt(-3 / p), -1, 1);
  const theta = Math.acos(arg);
  return [0, 1, 2].map(k => ({ re: rho * Math.cos((theta + 2 * Math.PI * k) / 3) - shift, im: 0 }));
}

function rootsForAlpha(q, alpha) {
  const cl = closedLoop(q, alpha);
  return cl.order === 2 ? quadraticRoots(1, cl.a2, cl.a1) : cubicRoots(1, cl.a2, cl.a1, cl.a0);
}

function plantPoles(q) {
  return quadraticRoots(1, 2 * q.zeta * q.wn, q.wn * q.wn);
}

function controllerZeros(q) {
  if (q.Ki > EPS) {
    if (q.Kd > EPS) return quadraticRoots(q.Kd, q.Kc, q.Ki);
    if (q.Kc > EPS) return [{ re: -q.Ki / q.Kc, im: 0 }];
    return [];
  }
  if (q.Kd > EPS) return [{ re: -q.Kc / q.Kd, im: 0 }];
  return [];
}

function distance2(a, b) { return (a.re - b.re) ** 2 + (a.im - b.im) ** 2; }
function permutations(n) {
  if (n === 2) return [[0,1],[1,0]];
  if (n === 3) return [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  return [[0]];
}
function matchRoots(prev, next) {
  if (prev.length !== next.length) return next;
  let best = next, bestCost = Infinity;
  for (const p of permutations(next.length)) {
    let cost = 0;
    for (let i = 0; i < p.length; i++) cost += distance2(prev[i], next[p[i]]);
    if (cost < bestCost) { bestCost = cost; best = p.map(j => next[j]); }
  }
  return best;
}

function rootLocusData(q) {
  const openPoles = plantPoles(q);
  if (q.Ki > EPS) openPoles.push({ re: 0, im: 0 });
  const zeros = controllerZeros(q);
  const active = Math.abs(q.Kc) + Math.abs(q.Ki) + Math.abs(q.Kd) > EPS;
  if (!active) return { active, openPoles, zeros, branches: openPoles.map(p => [p]), current: openPoles, alphaMax: 0 };

  const alphaMax = 4;
  const alphas = [];
  for (let i = 1; i <= 180; i++) {
    const f = i / 180;
    alphas.push(alphaMax * f * f);
  }
  alphas.push(1);
  alphas.sort((a, b) => a - b);
  const unique = alphas.filter((a, i) => i === 0 || Math.abs(a - alphas[i - 1]) > 1e-8);

  let prev = openPoles.map(p => ({ ...p }));
  const branches = prev.map(p => [{ ...p }]);
  for (const alpha of unique) {
    let roots = rootsForAlpha(q, Math.max(alpha, 1e-8));
    roots = matchRoots(prev, roots);
    roots.forEach((r, i) => branches[i].push(r));
    prev = roots;
  }
  return { active, openPoles, zeros, branches, current: rootsForAlpha(q, 1), alphaMax };
}

function drawCross(svg, x, y, size, klass) {
  svg.appendChild(E("line", { x1: x - size, y1: y - size, x2: x + size, y2: y + size, class: klass }));
  svg.appendChild(E("line", { x1: x - size, y1: y + size, x2: x + size, y2: y - size, class: klass }));
}

function formatRoot(r) {
  if (Math.abs(r.im) < 1e-6) return fmt(r.re, 3);
  return `${fmt(r.re, 3)} ${r.im >= 0 ? "+" : "−"} j${fmt(Math.abs(r.im), 3)}`;
}

function drawRootLocus(q) {
  clear(rootLocusPlot);
  const data = rootLocusData(q);
  const W = 1000, H = 520, M = { l: 72, r: 30, t: 25, b: 55 };
  const all = [...data.openPoles, ...data.zeros, ...data.current, ...data.branches.flat()];
  let xmin = Math.min(-1, ...all.map(p => p.re)), xmax = Math.max(1, ...all.map(p => p.re));
  let yim = Math.max(1, ...all.map(p => Math.abs(p.im)));
  let xspan = Math.max(2, xmax - xmin);
  xmin -= .08 * xspan; xmax += .10 * xspan; yim *= 1.18;
  const ymin = -yim, ymax = yim;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const x = v => M.l + (v - xmin) / (xmax - xmin) * pw;
  const y = v => M.t + (ymax - v) / (ymax - ymin) * ph;

  if (xmax > 0) rootLocusPlot.appendChild(E("rect", { x: x(0), y: M.t, width: Math.max(0, W - M.r - x(0)), height: ph, class: "rl-rhp" }));

  nice(xmin, xmax, 7).forEach(v => {
    rootLocusPlot.appendChild(E("line", { x1: x(v), y1: M.t, x2: x(v), y2: H - M.b, class: Math.abs(v) < 1e-9 ? "rl-axis" : "grid" }));
    rootLocusPlot.appendChild(E("text", { x: x(v), y: H - M.b + 20, "text-anchor": "middle", class: "tick" }, fmt(v, Math.abs(v) < 10 ? 1 : 0)));
  });
  nice(ymin, ymax, 6).forEach(v => {
    rootLocusPlot.appendChild(E("line", { x1: M.l, y1: y(v), x2: W - M.r, y2: y(v), class: Math.abs(v) < 1e-9 ? "rl-axis" : "grid" }));
    rootLocusPlot.appendChild(E("text", { x: M.l - 9, y: y(v) + 4, "text-anchor": "end", class: "tick" }, fmt(v, Math.abs(v) < 10 ? 1 : 0)));
  });

  data.branches.forEach(branch => {
    const d = branch.map((p, i) => `${i ? "L" : "M"}${x(p.re).toFixed(2)},${y(p.im).toFixed(2)}`).join(" ");
    rootLocusPlot.appendChild(E("path", { d, class: "rl-line" }));
  });

  data.openPoles.forEach(p => drawCross(rootLocusPlot, x(p.re), y(p.im), 6, "rl-open-pole"));
  data.zeros.forEach(z => rootLocusPlot.appendChild(E("circle", { cx: x(z.re), cy: y(z.im), r: 6, class: "rl-open-zero" })));
  data.current.forEach(p => rootLocusPlot.appendChild(E("circle", { cx: x(p.re), cy: y(p.im), r: 5.5, class: "rl-current" })));

  rootLocusPlot.appendChild(E("text", { x: M.l + pw / 2, y: H - 12, "text-anchor": "middle", class: "axislabel" }, "Real axis Re(s)"));
  rootLocusPlot.appendChild(E("text", { x: 18, y: M.t + ph / 2, "text-anchor": "middle", class: "axislabel", transform: `rotate(-90 18 ${M.t + ph / 2})` }, "Imaginary axis Im(s)"));

  const rootsText = data.current.map(formatRoot).join(", ");
  $("rootLocusNote").innerHTML = data.active
    ? `Root-locus sweep: <strong>0 ≤ α ≤ ${fmt(data.alphaMax, 0)}</strong>; current tuning is α = 1.<br>Current closed-loop poles: <strong>${rootsText}</strong>.`
    : `All active controller gains are zero, so there is no feedback-gain root locus yet. The open-loop plant poles are shown.`;
}

function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function cabs(a) { return Math.hypot(a.re, a.im); }

function loopResponse(w, q) {
  const c = { re: q.Kc, im: q.Kd * w - (q.Ki > EPS ? q.Ki / w : 0) };
  const dr = q.wn * q.wn - w * w, di = 2 * q.zeta * q.wn * w;
  const den = dr * dr + di * di;
  const g = { re: q.Kp * q.wn * q.wn * dr / den, im: -q.Kp * q.wn * q.wn * di / den };
  return cmul(c, g);
}

function logspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => 10 ** (a + (b - a) * i / (n - 1)));
}

function frequencyData(q) {
  const scales = [q.wn];
  if (q.Ki > EPS && q.Kc > EPS) scales.push(q.Ki / q.Kc);
  if (q.Kd > EPS && q.Kc > EPS) scales.push(q.Kc / q.Kd);
  if (q.Ki > EPS && q.Kd > EPS) scales.push(Math.sqrt(q.Ki / q.Kd));
  const valid = scales.filter(v => Number.isFinite(v) && v > 1e-6);
  const minScale = Math.min(...valid), maxScale = Math.max(...valid);
  const wmin = Math.max(1e-4, minScale / 1000);
  const wmax = Math.min(1e5, maxScale * 1000);
  const freqs = logspace(Math.log10(wmin), Math.log10(wmax), 1500);
  const data = [];
  let prevPhase = null;

  for (const w of freqs) {
    const L = loopResponse(w, q);
    const mag = Math.max(1e-12, cabs(L));
    let phase = Math.atan2(L.im, L.re) * 180 / Math.PI;
    if (prevPhase !== null) {
      while (phase - prevPhase > 180) phase -= 360;
      while (phase - prevPhase < -180) phase += 360;
    }
    prevPhase = phase;
    data.push({ w, db: 20 * Math.log10(mag), phase });
  }
  return data;
}

function interpolateCrossing(a, b, key, target) {
  const y1 = a[key] - target, y2 = b[key] - target;
  const f = Math.abs(y2 - y1) < 1e-12 ? 0 : -y1 / (y2 - y1);
  const ff = clamp(f, 0, 1);
  const logw = Math.log10(a.w) + ff * (Math.log10(b.w) - Math.log10(a.w));
  return {
    w: 10 ** logw,
    db: a.db + ff * (b.db - a.db),
    phase: a.phase + ff * (b.phase - a.phase)
  };
}

function crossings(data, key, target) {
  const out = [];
  for (let i = 0; i < data.length - 1; i++) {
    const y1 = data[i][key] - target, y2 = data[i + 1][key] - target;
    if (Math.abs(y1) < 1e-10) out.push({ ...data[i] });
    else if (y1 * y2 < 0) out.push(interpolateCrossing(data[i], data[i + 1], key, target));
  }
  return out;
}

function stabilityMargins(q, data) {
  const active = Math.abs(q.Kc) + Math.abs(q.Ki) + Math.abs(q.Kd) > EPS;
  if (!active) return { active: false, pm: null, gmDb: null, gm: null, wgc: null, wpc: null, gcPoint: null, pcPoint: null };

  const gcs = crossings(data, "db", 0).map(p => ({ ...p, pm: 180 + p.phase }));
  const pcs = crossings(data, "phase", -180).map(p => ({ ...p, gmDb: -p.db, gm: 10 ** (-p.db / 20) }));
  const gcPoint = gcs.length ? gcs.reduce((a, b) => b.pm < a.pm ? b : a) : null;
  const pcPoint = pcs.length ? pcs.reduce((a, b) => b.gmDb < a.gmDb ? b : a) : null;
  return {
    active: true,
    pm: gcPoint ? gcPoint.pm : null,
    gmDb: pcPoint ? pcPoint.gmDb : Infinity,
    gm: pcPoint ? pcPoint.gm : Infinity,
    wgc: gcPoint ? gcPoint.w : null,
    wpc: pcPoint ? pcPoint.w : null,
    gcPoint,
    pcPoint
  };
}

function logAxis(svg, xmin, xmax, ymin, ymax, box, xlab, ylab, xticks, yticks) {
  const { l, r, t, b, W, H } = box, pw = W - l - r, ph = H - t - b;
  const x = v => l + (Math.log10(v) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) * pw;
  const y = v => t + (ymax - v) / (ymax - ymin) * ph;
  xticks.forEach(v => {
    svg.appendChild(E("line", { x1: x(v), y1: t, x2: x(v), y2: H - b, class: "grid" }));
    svg.appendChild(E("text", { x: x(v), y: H - b + 19, "text-anchor": "middle", class: "tick" }, v >= 1 ? fmt(v, v >= 10 ? 0 : 1) : fmt(v, v >= .1 ? 1 : 2)));
  });
  yticks.forEach(v => {
    svg.appendChild(E("line", { x1: l, y1: y(v), x2: W - r, y2: y(v), class: "grid" }));
    svg.appendChild(E("text", { x: l - 9, y: y(v) + 4, "text-anchor": "end", class: "tick" }, fmt(v, 0)));
  });
  svg.appendChild(E("line", { x1: l, y1: H - b, x2: W - r, y2: H - b, class: "axis" }));
  svg.appendChild(E("line", { x1: l, y1: t, x2: l, y2: H - b, class: "axis" }));
  svg.appendChild(E("text", { x: l + pw / 2, y: H - 9, "text-anchor": "middle", class: "axislabel" }, xlab));
  svg.appendChild(E("text", { x: 17, y: t + ph / 2, "text-anchor": "middle", class: "axislabel", transform: `rotate(-90 17 ${t + ph / 2})` }, ylab));
  return { x, y, l, r, t, b, W, H };
}

function pathFrom(data, xKey, yKey, x, y) {
  return data.map((p, i) => `${i ? "L" : "M"}${x(p[xKey]).toFixed(2)},${y(p[yKey]).toFixed(2)}`).join(" ");
}

function decadeTicks(xmin, xmax) {
  const a = Math.ceil(Math.log10(xmin)), b = Math.floor(Math.log10(xmax));
  const ticks = [];
  for (let e = a; e <= b; e++) ticks.push(10 ** e);
  return ticks;
}

function drawMargins(q) {
  clear(marginPlot);
  const data = frequencyData(q);
  const margins = stabilityMargins(q, data);

  const W = 1000, l = 72, r = 28;
  const xmin = data[0].w, xmax = data[data.length - 1].w;
  let dmin = Math.min(-20, ...data.map(d => d.db)), dmax = Math.max(20, ...data.map(d => d.db));
  dmin = Math.floor(dmin / 20) * 20; dmax = Math.ceil(dmax / 20) * 20;
  dmin = Math.max(-240, dmin); dmax = Math.min(160, dmax);
  const xt = decadeTicks(xmin, xmax);
  const magTicks = nice(dmin, dmax, 6);
  const phaseMin = Math.min(-270, Math.floor(Math.min(...data.map(d => d.phase), -180) / 45) * 45);
  const phaseMax = Math.max(90, Math.ceil(Math.max(...data.map(d => d.phase), 0) / 45) * 45);
  const phaseTicks = nice(phaseMin, phaseMax, 6);

  const top = { W, H: 305, l, r, t: 20, b: 40 };
  const bot = { W, H: 650, l, r, t: 345, b: 28 };
  const A = logAxis(marginPlot, xmin, xmax, dmin, dmax, top, "ω (rad/s)", "Magnitude (dB)", xt, magTicks);
  const B = logAxis(marginPlot, xmin, xmax, phaseMin, phaseMax, bot, "ω (rad/s)", "Phase (deg)", xt, phaseTicks);

  marginPlot.appendChild(E("line", { x1: A.l, y1: A.y(0), x2: W - A.r, y2: A.y(0), class: "reference-line" }));
  marginPlot.appendChild(E("line", { x1: B.l, y1: B.y(-180), x2: W - B.r, y2: B.y(-180), class: "reference-line" }));
  marginPlot.appendChild(E("path", { d: pathFrom(data, "w", "db", A.x, A.y), class: "loop-mag" }));
  marginPlot.appendChild(E("path", { d: pathFrom(data, "w", "phase", B.x, B.y), class: "loop-phase" }));

  if (margins.gcPoint) {
    const p = margins.gcPoint, xx = A.x(p.w);
    marginPlot.appendChild(E("line", { x1: xx, y1: top.t, x2: xx, y2: top.H - top.b, class: "pm-line" }));
    marginPlot.appendChild(E("line", { x1: B.x(p.w), y1: bot.t, x2: B.x(p.w), y2: bot.H - bot.b, class: "pm-line" }));
    marginPlot.appendChild(E("circle", { cx: xx, cy: A.y(0), r: 4.5, class: "pm-dot" }));
    marginPlot.appendChild(E("circle", { cx: B.x(p.w), cy: B.y(p.phase), r: 4.5, class: "pm-dot" }));
    marginPlot.appendChild(E("line", { x1: B.x(p.w), y1: B.y(-180), x2: B.x(p.w), y2: B.y(p.phase), class: "margin-segment-pm" }));
  }

  if (margins.pcPoint) {
    const p = margins.pcPoint, xx = B.x(p.w);
    marginPlot.appendChild(E("line", { x1: A.x(p.w), y1: top.t, x2: A.x(p.w), y2: top.H - top.b, class: "gm-line" }));
    marginPlot.appendChild(E("line", { x1: xx, y1: bot.t, x2: xx, y2: bot.H - bot.b, class: "gm-line" }));
    marginPlot.appendChild(E("circle", { cx: xx, cy: B.y(-180), r: 4.5, class: "gm-dot" }));
    marginPlot.appendChild(E("circle", { cx: A.x(p.w), cy: A.y(p.db), r: 4.5, class: "gm-dot" }));
    marginPlot.appendChild(E("line", { x1: A.x(p.w), y1: A.y(0), x2: A.x(p.w), y2: A.y(p.db), class: "margin-segment-gm" }));
  }

  $("gcStat").textContent = margins.wgc === null ? "none" : `${fmt(margins.wgc, margins.wgc < 10 ? 2 : 1)} rad/s`;
  const pmEl = $("pmStat");
  pmEl.textContent = margins.pm === null ? "—" : `${fmt(margins.pm, 1)}°`;
  pmEl.className = "v " + (margins.pm !== null && margins.pm <= 0 ? "unstable-text" : margins.pm !== null ? "stable-text" : "");

  $("pcStat").textContent = margins.wpc === null ? "none" : `${fmt(margins.wpc, margins.wpc < 10 ? 2 : 1)} rad/s`;
  const gmEl = $("gmStat");
  if (!margins.active) gmEl.textContent = "—";
  else if (margins.gm === Infinity) gmEl.textContent = "∞";
  else gmEl.textContent = `${fmt(margins.gmDb, 1)} dB (${fmt(margins.gm, 2)}×)`;
  gmEl.className = "v " + (Number.isFinite(margins.gmDb) && margins.gmDb <= 0 ? "unstable-text" : margins.active ? "stable-text" : "");

  let note;
  if (!margins.active) {
    note = "All active controller gains are zero, so the open-loop gain is zero and classical gain/phase margins are undefined.";
  } else {
    const pmText = margins.pm === null ? "No finite 0 dB gain crossover was found." : `Phase margin = <strong>${fmt(margins.pm, 1)}°</strong> at ωgc = ${fmt(margins.wgc, 3)} rad/s.`;
    const gmText = margins.gm === Infinity ? "No finite −180° phase crossover was found, so the classical gain margin is infinite over the plotted frequency range." : `Gain margin = <strong>${fmt(margins.gmDb, 1)} dB</strong> (${fmt(margins.gm, 2)}×) at ωpc = ${fmt(margins.wpc, 3)} rad/s.`;
    note = `${pmText}<br>${gmText}`;
  }
  $("marginNote").innerHTML = note;
}

function updateActive() {
  const t = ctype.value, integ = t === "PI" || t === "PID", deriv = t === "PD" || t === "PID";
  document.querySelector(".integral").classList.toggle("inactive", !integ);
  document.querySelector(".derivative").classList.toggle("inactive", !deriv);
  ki.disabled = !integ; kd.disabled = !deriv;
}

function render() {
  updateActive();
  const q = params(), cl = closedLoop(q), sim = simulate(q), m = metrics(q, cl, sim);
  const unstable = !cl.stable || sim.diverged;

  $("plantGainVal").textContent = fmt(q.Kp, 2);
  $("plantWnVal").textContent = fmt(q.wn, 2) + " rad/s";
  $("plantZetaVal").textContent = fmt(q.zeta, 2);
  $("kcVal").textContent = fmt(q.Kc, 1);
  $("kiVal").textContent = fmt(+ki.value, 1);
  $("kdVal").textContent = fmt(+kd.value, 2);

  const stab = $("stabilityStat");
  stab.textContent = unstable ? "Unstable" : "Stable";
  stab.className = "v " + (unstable ? "unstable-text" : "stable-text");
  $("sseStat").textContent = m.sse === null ? "—" : fmt(m.sse, 4);
  $("osStat").textContent = m.os === null ? "—" : fmt(m.os, 1) + "%";
  $("tsStat").textContent = unstable ? "—" : m.ts === null ? "not settled" : fmt(m.ts, 2) + " s";
  $("uPeakStat").textContent = fmt(m.uPeak, 2);

  const terms = `u = ${fmt(q.Kc, 1)}e ${q.Ki ? `+ ${fmt(q.Ki, 1)}∫e dt ` : ""}${q.Kd ? `− ${fmt(q.Kd, 2)}ẏ` : ""}`;
  const poly = cl.order === 2
    ? `s² + ${fmt(cl.a2, 2)}s + ${fmt(cl.a1, 2)}`
    : `s³ + ${fmt(cl.a2, 2)}s² + ${fmt(cl.a1, 2)}s + ${fmt(cl.a0, 2)}`;
  const routh = cl.order === 3 ? ` &nbsp; Routh test: a₂a₁ − a₀ = ${fmt(cl.margin, 2)} ${cl.stable ? "> 0" : "≤ 0"}.` : "";
  $("controllerFormula").innerHTML = `Active controller: <strong>${q.type}</strong>. &nbsp; ${terms}.<br>Closed-loop characteristic polynomial: <strong>${poly}</strong>.${routh}`;

  drawTimePlot(responsePlot, sim, "y", 1, "response", 470, m.yss, unstable);
  drawTimePlot(controlPlot, sim, "u", 0, "control-line", 380, null, unstable);
  drawRootLocus(q);
  drawMargins(q);
}

[ctype, Pg, Pwn, Pz, kc, ki, kd].forEach(e => e.addEventListener("input", render));
document.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => {
  ctype.value = b.dataset.type;
  kc.value = b.dataset.kc;
  ki.value = b.dataset.ki;
  kd.value = b.dataset.kd;
  render();
}));
render();
})();