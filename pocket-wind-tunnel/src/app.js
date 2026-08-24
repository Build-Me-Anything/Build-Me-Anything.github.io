/* Pocket Wind Tunnel — UI / rendering. Depends only on WT (solver.js). */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const fmtRe = v => !Number.isFinite(v) ? '—' : v >= 1e6 ? (v / 1e6).toFixed(2) + ' M' : (v / 1e3).toFixed(0) + ' k';
const fmtXc = v => (v == null ? '—' : v.toFixed(2));

// ------------------------------------------------------------------ state
const PRESETS = [['0006', 0, 0, 6], ['0009', 0, 0, 9], ['0012', 0, 0, 12], ['0015', 0, 0, 15], ['0018', 0, 0, 18], ['0024', 0, 0, 24],
  ['1408', 1, 4, 8], ['1412', 1, 4, 12], ['2408', 2, 4, 8], ['2412', 2, 4, 12], ['2415', 2, 4, 15], ['2418', 2, 4, 18],
  ['4412', 4, 4, 12], ['4415', 4, 4, 15], ['4418', 4, 4, 18], ['4421', 4, 4, 21], ['6409', 6, 4, 9], ['6412', 6, 4, 12]];
const state = {
  mode: 'sub', shape: null,
  M: 2, P: 4, T: 12, panels: 120, imported: null,
  alpha: 4, V: 50, chord: 1, alt: 0, compressible: true,
  trip: false, xtrU: 0.05, xtrL: 0.05,
  field: 'cp', streamlines: true, smoke: true, blMarkers: true, cpVectors: false, polarTab: 'cla',
};
let geo = null, sys = null, stats = null, an = null, polar = null;
let grid = null, fieldCanvas = null, streamlines = [], particles = [];
let worker = null, fieldReqId = 0, fieldBusy = false, fieldPending = null, fieldShown = 0;

// ------------------------------------------------------------------ canvas & view
const canvas = $('flow'), ctx = canvas.getContext('2d');
const view = { W: 0, H: 0, dpr: 1, scale: 1, wx0: -0.7, wy0: 0 };
function layoutView() {
  const r = canvas.getBoundingClientRect();
  view.W = Math.max(10, r.width); view.H = Math.max(10, r.height);
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(view.W * view.dpr); canvas.height = Math.round(view.H * view.dpr);
  if (state.mode === 'tunnel' && typeof TunnelUI !== 'undefined') {   // frame the test section (up to h/c 6), model offset included
    const b = TunnelUI.band(), h = b[1] - b[0], yc = 0.5 * (b[0] + b[1]);
    view.scale = Math.min(view.W / 2.6, view.H / (1.12 * Math.min(h, 6)));
    view.wx0 = 0.5 - (view.W / view.scale) / 2; view.wy0 = yc + (view.H / 2) / view.scale;
  } else { view.scale = view.W / 2.6; view.wx0 = -0.7; view.wy0 = (view.H / 2) / view.scale; }
}
const toScreen = (wx, wy) => [(wx - view.wx0) * view.scale, (view.wy0 - wy) * view.scale];
const toWorld = (sx, sy) => [view.wx0 + sx / view.scale, view.wy0 - sy / view.scale];
// solver frame (chord on x axis) → display frame (freestream horizontal), rotation by −α about quarter chord
const dispAlpha = () => (state.mode === 'hyper' ? HyperUI.alpha() : state.mode === 'cfd' ? CfdUI.alpha() : state.mode === 'ns' ? 0 : state.alpha);
const subLike = () => state.mode === 'sub' || state.mode === 'tunnel';
function solverToDisplay(px, py) {
  const a = dispAlpha() * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), dx = px - 0.25, dy = py;
  return [0.25 + dx * ca + dy * sa, -dx * sa + dy * ca];
}
const surfScreen = (px, py) => { const w = solverToDisplay(px, py); return toScreen(w[0], w[1]); };

// ------------------------------------------------------------------ worker
function makeWorker() {
  try {
    const src = $('wt-solver').textContent + '\n' + $('wt-worker').textContent;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = e => onField(e.data);
    worker.onerror = err => { console.warn('Field worker failed, falling back to main thread', err); worker = null; fieldBusy = false; requestField(false); };
  } catch (e) { console.warn('No worker available', e); worker = null; }
}
function requestField(coarse) {
  if (!an || !subLike()) return;
  const cell = coarse ? 9 : (state.mode === 'tunnel' ? 5 : 4);
  const d = cell / view.scale;
  const cols = Math.ceil(view.W / cell) + 2, rows = Math.ceil(view.H / cell) + 2;
  const fp = state.mode === 'tunnel' ? TunnelUI.fieldParams() : { gx: Array.from(geo.x), gy: Array.from(geo.y), q: Array.from(an.inv.q), gamma: an.inv.gamma, alpha: state.alpha };
  const msg = Object.assign({ id: ++fieldReqId, rows, cols, x0: view.wx0, y0: view.wy0, d, coarse }, fp);
  if (worker) { if (fieldBusy) fieldPending = msg; else { fieldBusy = true; worker.postMessage(msg); } }
  else onField(WT.fieldGrid(msg));
}
function onField(g) {
  fieldBusy = false;
  if (fieldPending && worker) { const m = fieldPending; fieldPending = null; fieldBusy = true; worker.postMessage(m); }
  if (g.id < fieldShown) return;
  const reseed = !grid || grid.x0 !== g.x0 || grid.y0 !== g.y0 || Math.abs(grid.cols * grid.d - g.cols * g.d) > 1e-6;
  fieldShown = g.id; grid = g;
  buildFieldImage(); computeStreamlines();
  if (reseed) initParticles();
}

// ------------------------------------------------------------------ colour maps
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops) { const s = stops.map(([v, c]) => [v, hex(c)]); return t => {
  if (t <= s[0][0]) return s[0][1]; if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), a = s[i - 1][1], b = s[i][1];
    return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])]; }
  return s[0][1]; }; }
const cpRamp = ramp([[-3, '#b8f6ff'], [-2, '#5fd4ff'], [-1.2, '#2b8fe0'], [-0.5, '#1e4e8a'], [0, '#141e2b'], [0.4, '#6b3a2a'], [0.75, '#c45a2e'], [1, '#ff9a4a']]);
const speedRamp = ramp([[0, '#0b0f14'], [0.45, '#2c1a52'], [0.75, '#7a2a7e'], [1, '#c8466d'], [1.3, '#f98a3a'], [1.7, '#ffe08a'], [2.2, '#ffffff']]);
const cpOf = (u, v) => (1 - (u * u + v * v)) * (an ? an.pg : 1);

function buildFieldImage() {
  if (!grid) return;
  const { rows, cols, u, v, inside } = grid;
  if (!fieldCanvas) fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = cols; fieldCanvas.height = rows;
  const fctx = fieldCanvas.getContext('2d');
  const img = fctx.createImageData(cols, rows), px = img.data;
  const mode = state.field;
  for (let k = 0; k < rows * cols; k++) {
    let c;
    if (inside[k]) c = [27, 38, 52];
    else if (mode === 'speed') c = speedRamp(Math.hypot(u[k], v[k]));
    else c = cpRamp(cpOf(u[k], v[k]));
    px[k * 4] = c[0]; px[k * 4 + 1] = c[1]; px[k * 4 + 2] = c[2]; px[k * 4 + 3] = 255;
  }
  fctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ field sampling, streamlines, smoke
function sample(g, wx, wy, out) {
  const fc = (wx - g.x0) / g.d, fr = (g.y0 - wy) / g.d;
  const c0 = Math.floor(fc), r0 = Math.floor(fr);
  if (c0 < 0 || r0 < 0 || c0 >= g.cols - 1 || r0 >= g.rows - 1) return 0;
  const k = r0 * g.cols + c0, ins = g.inside;
  if (ins[k] | ins[k + 1] | ins[k + g.cols] | ins[k + g.cols + 1]) return -1;
  const tx = fc - c0, ty = fr - r0, w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
  out[0] = g.u[k] * w00 + g.u[k + 1] * w10 + g.u[k + g.cols] * w01 + g.u[k + g.cols + 1] * w11;
  out[1] = g.v[k] * w00 + g.v[k + 1] * w10 + g.v[k + g.cols] * w01 + g.v[k + g.cols + 1] * w11;
  return 1;
}
function computeStreamlines() {
  streamlines = [];
  if (!grid) return;
  const g = grid, wxMax = view.wx0 + view.W / view.scale, yTop = view.wy0, yBot = view.wy0 - view.H / view.scale;
  const nLines = Math.round(clamp(view.H / 26, 10, 40));
  const h = g.d * 0.9, vel = [0, 0];
  const seeds = [];
  for (let i = 0; i < nLines; i++) seeds.push(yBot + (i + 0.5) / nLines * (yTop - yBot));
  for (const y0 of seeds) {
    let x = view.wx0 + 0.002, y = y0; const pts = [x, y];
    for (let step = 0; step < 4000; step++) {
      // RK4 with unit-speed normalisation so step length is uniform
      const k = (px, py) => { const r = sample(g, px, py, vel); if (r !== 1) return null; const m = Math.hypot(vel[0], vel[1]) || 1e-9; return [vel[0] / m, vel[1] / m]; };
      const k1 = k(x, y); if (!k1) break;
      const k2 = k(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1]); if (!k2) break;
      const k3 = k(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1]); if (!k3) break;
      const k4 = k(x + h * k3[0], y + h * k3[1]); if (!k4) break;
      x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      pts.push(x, y);
      if (x > wxMax || y > yTop || y < yBot) break;
    }
    if (pts.length > 6) streamlines.push(pts);
  }
}
const N_PARTICLES = 1600;
function spawn(p, where) {   // where: 'edge' (re-inject at the left), 'upstream' (anywhere ahead of the LE), 'anywhere'
  const yTop = view.wy0, yBot = view.wy0 - view.H / view.scale;
  p.x = where === 'edge' ? view.wx0 + Math.random() * 0.03 : where === 'upstream' ? view.wx0 + Math.random() * (-0.15 - view.wx0) : view.wx0 + Math.random() * (view.W / view.scale);
  if (state.mode === 'tunnel') { const b = TunnelUI.band(); p.y = Math.max(yBot, b[0]) + Math.random() * (Math.min(yTop, b[1]) - Math.max(yBot, b[0])); }
  else p.y = Math.random() < 0.75 ? (Math.random() - 0.5) * 1.1 : yBot + Math.random() * (yTop - yBot);
  p.px = p.x; p.py = p.y; p.life = 0;
}
function initParticles() { particles = []; for (let i = 0; i < N_PARTICLES; i++) { const p = {}; spawn(p, 'anywhere'); particles.push(p); } }
function stepParticles(dt) {
  if (!grid) return;
  const vel = [0, 0], speed = 0.55 * Math.max(1, (view.W / view.scale) / 2.6); // chord lengths per second at V∞, scaled with the visible width
  for (const p of particles) {
    const r = sample(grid, p.x, p.y, vel);
    if (r !== 1) { spawn(p, r === 0 ? 'edge' : 'upstream'); continue; }
    p.px = p.x; p.py = p.y;
    p.x += vel[0] * speed * dt; p.y += vel[1] * speed * dt; p.life += dt;
  }
}

// ------------------------------------------------------------------ main draw
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (state.smoke && subLike()) stepParticles(dt);
  draw();
  requestAnimationFrame(frame);
}
function draw() {
  const { W, H, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.mode === 'hyper') { HyperUI.draw(ctx); return; }
  if (state.mode === 'cfd') { CfdUI.draw(ctx); return; }
  if (state.mode === 'ns') { NsUI.draw(ctx); return; }
  ctx.fillStyle = '#0e141c'; ctx.fillRect(0, 0, W, H);
  if (!an) return;
  // field
  if (state.field !== 'off' && grid && fieldCanvas) {
    const cellPx = grid.d * view.scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, -cellPx / 2, -cellPx / 2, grid.cols * cellPx, grid.rows * cellPx);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    const step = 0.25 * view.scale; ctx.beginPath();
    for (let x = ((0 - view.wx0) * view.scale) % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = (view.wy0 * view.scale) % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }
  // streamlines
  if (state.streamlines && streamlines.length) {
    ctx.strokeStyle = state.field === 'off' ? 'rgba(76,201,240,0.55)' : 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const pts of streamlines) { let s = toScreen(pts[0], pts[1]); ctx.moveTo(s[0], s[1]); for (let i = 2; i < pts.length; i += 2) { s = toScreen(pts[i], pts[i + 1]); ctx.lineTo(s[0], s[1]); } }
    ctx.stroke();
  }
  // smoke
  if (state.smoke && grid) {
    ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    for (const p of particles) { if (p.life < 0.02) continue; const a = toScreen(p.px, p.py), b = toScreen(p.x, p.y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
  }
  if (state.mode === 'tunnel') TunnelUI.drawWalls(ctx);
  drawAerofoil();
  drawHud();
  if (state.mode === 'tunnel') TunnelUI.drawHud(ctx);
}
function drawAerofoil() {
  const P = sys.P, n = P.n;
  // surface pressure arrows
  if (state.cpVectors) {
    const Cp = an.inv.Cp, pg = an.pg, k = 0.09 * view.scale;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i += 2) {
      const base = surfScreen(P.xm[i], P.ym[i]);
      const nd = solverToDisplay(P.xm[i] + P.nx[i], P.ym[i] + P.ny[i]), bd = solverToDisplay(P.xm[i], P.ym[i]);
      const nx = nd[0] - bd[0], ny = -(nd[1] - bd[1]);
      const len = -Cp[i] * pg * k; // suction (Cp<0) points outward
      ctx.strokeStyle = Cp[i] < 0 ? 'rgba(95,212,255,0.7)' : 'rgba(255,154,74,0.8)';
      ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(base[0] + nx * len, base[1] + ny * len); ctx.stroke();
    }
  }
  // body
  ctx.beginPath();
  let s = surfScreen(geo.x[0], geo.y[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 1; i < geo.x.length; i++) { s = surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(s[0], s[1]); }
  ctx.closePath();
  const le = surfScreen(0, 0), te = surfScreen(1, 0);
  const grad = ctx.createLinearGradient(le[0], le[1] - 40, le[0], le[1] + 40);
  grad.addColorStop(0, '#3a4b63'); grad.addColorStop(1, '#1c2634');
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = '#d7e2ef'; ctx.lineWidth = 1.5; ctx.stroke();
  // chord line & quarter chord
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(le[0], le[1]); ctx.lineTo(te[0], te[1]); ctx.stroke(); ctx.setLineDash([]);
  const qc = surfScreen(0.25, 0);
  ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(qc[0], qc[1], 3, 0, 7); ctx.fill();
  // BL markers
  const bl = an.bl;
  if (state.blMarkers && bl) {
    const st = surfScreen(bl.stagnation.x, bl.stagnation.y);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(st[0], st[1], 3.2, 0, 7); ctx.fill();
    const drawSide = (side, idx) => {
      const sep = side.separation;
      if (sep) {  // red ribbon from separation to TE along the surface
        ctx.strokeStyle = '#ef476f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
        const i0 = idx[sep.k];
        const forward = idx[idx.length - 1] > idx[0];
        if (forward) { let p = surfScreen(P.xm[i0], P.ym[i0]); ctx.moveTo(p[0], p[1]); for (let i = i0 + 1; i <= n; i++) { p = surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(p[0], p[1]); } }
        else { let p = surfScreen(P.xm[i0], P.ym[i0]); ctx.moveTo(p[0], p[1]); for (let i = i0; i >= 0; i--) { p = surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(p[0], p[1]); } }
        ctx.stroke();
      }
      const tr = side.transition;
      if (tr) {
        const i = idx[tr.k];
        const b = surfScreen(P.xm[i], P.ym[i]);
        const nd = solverToDisplay(P.xm[i] + P.nx[i] * 0.03, P.ym[i] + P.ny[i] * 0.03);
        const tip = toScreen(nd[0], nd[1]);
        const dx = tip[0] - b[0], dy = tip[1] - b[1], m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m;
        ctx.fillStyle = tr.why === 'forced' ? '#a78bfa' : '#06d6a0';
        ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] + ux * 10 - uy * 4, b[1] + uy * 10 + ux * 4); ctx.lineTo(b[0] + ux * 10 + uy * 4, b[1] + uy * 10 - ux * 4); ctx.closePath(); ctx.fill();
      }
    };
    drawSide(bl.upper, bl.idxU); drawSide(bl.lower, bl.idxL);
  }
}
function drawHud() {
  const { W, H } = view;
  ctx.font = '12px ' + getComputedStyle(document.body).getPropertyValue('--mono');
  ctx.textBaseline = 'top';
  // left-top readout
  const lines = [
    `V∞ ${state.V.toFixed(0)} m/s  (${(state.V * 1.94384).toFixed(0)} kt)   α ${state.alpha.toFixed(2)}°   c ${state.chord.toFixed(2)} m`,
    `Re ${fmtRe(an.Re)}   M ${an.M.toFixed(3)}   ISA ${state.alt.toFixed(0)} m   ρ ${an.atm.rho.toFixed(3)} kg/m³`,
  ];
  ctx.fillStyle = 'rgba(8,12,18,0.6)'; ctx.fillRect(8, 8, 430, 38);
  ctx.fillStyle = '#d7e2ef'; lines.forEach((l, i) => ctx.fillText(l, 14, 13 + i * 16));
  // wind arrow
  const y = H - 30; ctx.strokeStyle = '#4cc9f0'; ctx.fillStyle = '#4cc9f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(64, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(56, y - 4); ctx.lineTo(56, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillText('V∞', 70, y - 7);
  // scale bar: 0.25 c
  const bar = 0.25 * view.scale, bx = W - 20 - bar, by = H - 22;
  ctx.strokeStyle = '#d7e2ef'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + bar, by - 4); ctx.lineTo(bx + bar, by + 4); ctx.stroke();
  ctx.fillStyle = '#d7e2ef'; ctx.textAlign = 'center'; ctx.fillText('c/4 = ' + (state.chord / 4).toFixed(3) + ' m', bx + bar / 2, by - 18); ctx.textAlign = 'left';
  // legend
  if (state.field !== 'off') {
    const lw = 140, lh = 10, lx = W - 20 - lw, ly = 14;
    const isCp = state.field === 'cp';
    const lo = isCp ? -3 : 0, hi = isCp ? 1 : 2.2;
    for (let i = 0; i < lw; i++) { const t = lo + (hi - lo) * i / (lw - 1); const c = isCp ? cpRamp(t) : speedRamp(t); ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ctx.fillRect(lx + i, ly, 1.2, lh); }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(lx, ly, lw, lh);
    ctx.fillStyle = '#d7e2ef'; ctx.textAlign = 'left'; ctx.fillText(isCp ? 'Cp −3' : '|V|/V∞ 0', lx, ly + lh + 3);
    ctx.textAlign = 'right'; ctx.fillText(isCp ? '+1' : '2.2', lx + lw, ly + lh + 3); ctx.textAlign = 'left';
  }
  if (an.bl && an.bl.stallWarning) {
    ctx.font = 'bold 12px ' + getComputedStyle(document.body).getPropertyValue('--sans');
    const msg = '⚠ Extensive separation — inviscid lift unreliable (stall likely)';
    const tw = ctx.measureText(msg).width;
    ctx.fillStyle = 'rgba(60,14,28,0.85)'; ctx.fillRect(8, 54, tw + 14, 22);
    ctx.strokeStyle = 'rgba(239,71,111,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(8.5, 54.5, tw + 13, 21);
    ctx.fillStyle = '#ff8fa8'; ctx.fillText(msg, 15, 58);
  }
}

// ------------------------------------------------------------------ plots
function plotFrame(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#111821'; c.fillRect(0, 0, r.width, r.height);
  c.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--mono');
  return { c, W: r.width, H: r.height, pad: { l: 44, r: 12, t: 12, b: 26 } };
}
function axes(f, xmin, xmax, ymin, ymax, xlab, ylab, xstep, ystep) {
  const { c, W, H, pad } = f;
  const X = x => pad.l + (x - xmin) / (xmax - xmin) * (W - pad.l - pad.r);
  const Y = y => pad.t + (y - ymax) / (ymin - ymax) * (H - pad.t - pad.b);
  c.strokeStyle = '#223040'; c.lineWidth = 1; c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.textBaseline = 'top';
  const dec = st => Math.max(0, Math.min(6, -Math.floor(Math.log10(st) + 1e-9)));
  const nice = (v, st) => Math.abs(v) < 1e-9 ? '0' : v.toFixed(dec(st));
  for (let x = Math.ceil(xmin / xstep) * xstep; x <= xmax + 1e-9; x += xstep) { c.beginPath(); c.moveTo(X(x), pad.t); c.lineTo(X(x), H - pad.b); c.stroke(); c.fillText(nice(x, xstep), X(x), H - pad.b + 4); }
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let y = Math.ceil(ymin / ystep) * ystep; y <= ymax + 1e-9; y += ystep) { c.beginPath(); c.moveTo(pad.l, Y(y)); c.lineTo(W - pad.r, Y(y)); c.stroke(); c.fillText(nice(y, ystep), pad.l - 5, Y(y)); }
  if (xmin < 0 && xmax > 0) { c.strokeStyle = '#3a4d63'; c.beginPath(); c.moveTo(X(0), pad.t); c.lineTo(X(0), H - pad.b); c.stroke(); }
  if (ymin < 0 && ymax > 0) { c.strokeStyle = '#3a4d63'; c.beginPath(); c.moveTo(pad.l, Y(0)); c.lineTo(W - pad.r, Y(0)); c.stroke(); }
  c.fillStyle = '#aab8c9'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xlab, W - pad.r, H - 2);
  c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(ylab, pad.l + 4, pad.t + 2);
  return { X, Y };
}
function polyline(c, pts, color, width, dash) {
  if (pts.length < 2) return;
  c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.setLineDash([]);
}
function drawCp() {
  if (state.mode === 'hyper') return HyperUI.drawCp();
  if (state.mode === 'tunnel') return TunnelUI.drawCp();
  if (state.mode === 'cfd') return CfdUI.drawCp();
  if (state.mode === 'ns') return NsUI.drawCp();
  const f = plotFrame($('cpPlot')), { c } = f;
  if (!an) return;
  const P = sys.P, n = P.n, Cp = an.inv.Cp, pg = an.pg, bl = an.bl;
  const iS = bl ? bl.iStag : (() => { let b = 0; for (let i = 0; i < n; i++) if (P.xm[i] < P.xm[b]) b = i; return b; })();
  const upper = [], lower = [];
  for (let i = iS + 1; i < n; i++) upper.push([P.xm[i], Cp[i] * pg]);
  for (let i = iS; i >= 0; i--) lower.push([P.xm[i], Cp[i] * pg]);
  const cpmin = Math.min(an.inv.CpMin * pg, -1);
  const ymin = Math.floor(cpmin * 1.1 * 2) / 2, ymax = 1.1;
  const ystep = (ymax - ymin) > 6 ? 2 : (ymax - ymin) > 3 ? 1 : 0.5;
  const { X, Y } = axes(f, 0, 1, ymax, ymin, 'x/c', '−Cp ↑', 0.2, ystep); // inverted: ymin param is top
  if (state.compressible && an.M > 0.25) {
    const cps = WT.cpStar(an.M);
    if (cps > ymin) { polyline(c, [[X(0), Y(cps)], [X(1), Y(cps)]], '#ef476f', 1, [5, 4]); c.fillStyle = '#ef476f'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('Cp* (sonic) M ' + an.M.toFixed(2), X(1) - 2, Y(cps) - 1); }
  }
  polyline(c, lower.map(p => [X(p[0]), Y(p[1])]), '#f4a261', 1.6);
  polyline(c, upper.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.6);
  if (bl && state.blMarkers) {
    const mark = (side, pts, color) => {
      const at = x => { let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return best; };
      if (side.transition) { const p = at(side.transition.x); c.fillStyle = side.transition.why === 'forced' ? '#a78bfa' : '#06d6a0'; c.beginPath(); c.moveTo(X(p[0]), Y(p[1]) - 6); c.lineTo(X(p[0]) - 5, Y(p[1]) + 3); c.lineTo(X(p[0]) + 5, Y(p[1]) + 3); c.closePath(); c.fill(); }
      if (side.separation) { const p = at(side.separation.x); c.strokeStyle = '#ef476f'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(p[0]) - 4, Y(p[1]) - 4); c.lineTo(X(p[0]) + 4, Y(p[1]) + 4); c.moveTo(X(p[0]) + 4, Y(p[1]) - 4); c.lineTo(X(p[0]) - 4, Y(p[1]) + 4); c.stroke(); }
    };
    mark(bl.upper, upper, '#4cc9f0'); mark(bl.lower, lower, '#f4a261');
  }
}
function drawPolar() {
  if (state.mode === 'hyper') return HyperUI.drawPolar();
  if (state.mode === 'tunnel') return TunnelUI.drawPolar();
  if (state.mode === 'cfd') return CfdUI.drawPolar();
  if (state.mode === 'ns') return NsUI.drawPolar();
  const f = plotFrame($('polarPlot')), { c } = f;
  if (!polar) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText('computing…', f.W / 2, f.H / 2); return; }
  const pts = polar.points, tab = state.polarTab;
  const get = { cla: r => [r.inv.alpha, r.Cl], clcd: r => [r.Cd, r.Cl], cma: r => [r.inv.alpha, r.Cm], lda: r => [r.inv.alpha, r.LD] }[tab];
  const lab = { cla: ['α (°)', 'Cl'], clcd: ['Cd', 'Cl'], cma: ['α (°)', 'Cm c/4'], lda: ['α (°)', 'L/D'] }[tab];
  const data = pts.map(r => ({ p: get(r), warn: !!(r.bl && r.bl.stallWarning), r }));
  const xs = data.map(d => d.p[0]).filter(Number.isFinite), ys = data.map(d => d.p[1]).filter(Number.isFinite);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (tab === 'clcd') { xmin = 0; xmax = Math.max(0.02, Math.min(xmax, 0.1)); }
  if (tab === 'lda') { ymin = Math.max(ymin, -60); ymax = Math.min(ymax, 250); }
  const padY = (ymax - ymin) * 0.08 || 0.1; ymin -= padY; ymax += padY;
  const stepOf = span => { const raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const { X, Y } = axes(f, xmin, xmax, ymin, ymax, lab[0], lab[1], stepOf(xmax - xmin), stepOf(ymax - ymin));
  // attached segment solid, separated dashed
  let seg = [], segs = [];
  for (const d of data) { if (!Number.isFinite(d.p[0]) || !Number.isFinite(d.p[1])) continue; if (tab === 'clcd' && d.p[0] > xmax) continue; seg.push({ s: [X(d.p[0]), Y(d.p[1])], warn: d.warn }); }
  for (let i = 1; i < seg.length; i++) polyline(c, [seg[i - 1].s, seg[i].s], seg[i].warn || seg[i - 1].warn ? '#f4a261' : '#4cc9f0', 1.8, seg[i].warn || seg[i - 1].warn ? [4, 4] : []);
  for (const s of seg) { c.fillStyle = s.warn ? '#f4a261' : '#4cc9f0'; c.beginPath(); c.arc(s.s[0], s.s[1], 2, 0, 7); c.fill(); }
  // current point
  const cur = get(an);
  if (Number.isFinite(cur[0]) && Number.isFinite(cur[1]) && cur[0] >= xmin && cur[0] <= xmax) {
    c.fillStyle = '#ffffff'; c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.beginPath(); c.arc(X(cur[0]), Y(cur[1]), 4.5, 0, 7); c.fill(); c.stroke();
  }
  if (polar.alpha0 === polar.alpha0) { c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`α₀ ${polar.alpha0.toFixed(2)}°  Cl_α ${polar.clAlpha.toFixed(2)}/rad`, f.W - f.pad.r - 2, f.pad.t + 2); }
}
let polarTimer = null;
function schedulePolar() {
  if (state.mode !== 'sub') return;
  clearTimeout(polarTimer);
  polarTimer = setTimeout(() => { polar = WT.sweep(sys, cond(), -8, 20, 1); drawPolar(); }, 120);
}

// ------------------------------------------------------------------ tiles
const TILES = [
  ['cl', 'Cl', 'lift coefficient'], ['cd', 'Cd', 'profile drag'], ['ld', 'L / D', 'lift-to-drag'], ['cm', 'Cm c/4', 'pitching moment'],
  ['lift', 'Lift', 'N per m span'], ['drag', 'Drag', 'N per m span'], ['re', 'Reynolds', 'V c / ν'], ['mach', 'Mach', 'V / a'],
  ['mcr', 'M crit', 'critical Mach'], ['cpmin', 'Cp min', 'peak suction'], ['xtru', 'Transition U', 'x/c upper'], ['xtrl', 'Transition L', 'x/c lower'],
  ['sepu', 'Separation U', 'x/c upper'], ['sepl', 'Separation L', 'x/c lower'], ['q', 'q∞', 'dynamic pressure'], ['atm', 'Atmosphere', 'T · p · a'],
];
function buildTiles(list = TILES) {
  $('tiles').innerHTML = list.map(([id, k, u]) => `<div class="tile" id="tile-${id}"><div class="k">${k}</div><div class="v" id="tv-${id}">—</div><div class="u" id="tu-${id}">${u}</div></div>`).join('');
}
function setTile(id, v, cls, u) {   // a mode may update a tile that the current layout does not render — skip silently rather than throwing
  const t = $('tile-' + id), tv = $('tv-' + id); if (!t || !tv) return;
  tv.textContent = v; t.className = 'tile' + (cls ? ' ' + cls : ''); const tu = $('tu-' + id); if (u != null && tu) tu.textContent = u;
}
function updateTiles() {
  if (state.mode === 'tunnel') return TunnelUI.updateTiles();
  const bl = an.bl, warn = bl && bl.stallWarning;
  setTile('cl', fmt(an.Cl, 3), warn ? 'warn' : '');
  setTile('cd', fmt(an.Cd, 4), warn ? 'warn' : '');
  setTile('ld', fmt(an.LD, 1), warn ? 'warn' : '');
  setTile('cm', fmt(an.Cm, 3), '');
  setTile('lift', fmt(an.lift, 0), warn ? 'warn' : '', 'N per m span · ' + fmt(an.lift / 9.80665, 0) + ' kgf');
  setTile('drag', fmt(an.drag, 1), '');
  setTile('re', fmtRe(an.Re), '', an.Re < 2e5 ? 'low Re — laminar effects dominate' : 'V c / ν');
  setTile('mach', fmt(an.M, 3), an.M > 0.7 ? 'bad' : an.M > 0.3 ? 'warn' : '', an.M > 0.3 ? (state.compressible ? 'PG ×' + an.pg.toFixed(3) : 'compressible — enable PG') : 'incompressible');
  setTile('mcr', fmt(an.Mcr, 3), an.M >= an.Mcr ? 'bad' : an.M > 0.85 * an.Mcr ? 'warn' : 'good', an.M >= an.Mcr ? 'supersonic flow on surface!' : 'margin ' + fmt(an.Mcr - an.M, 2));
  setTile('cpmin', fmt(an.CpMin, 2), '', 'at x/c ' + fmt(an.inv.xCpMin, 2));
  const side = (id, s) => {
    if (!s) { setTile(id, '—', '', 'no BL solution'); return; }
    const t = s.transition;
    setTile(id, t ? fmtXc(t.x) : 'laminar', t && t.why === 'forced' ? '' : '', t ? (t.why === 'natural' ? 'natural (Michel)' : t.why === 'forced' ? 'tripped' : 'laminar sep. bubble') : 'laminar to TE');
  };
  side('xtru', bl && bl.upper); side('xtrl', bl && bl.lower);
  const sep = (id, s) => { if (!s) { setTile(id, '—', ''); return; } setTile(id, s.separation ? fmtXc(s.separation.x) : 'attached', s.separation ? (s.separation.x < 0.8 ? 'bad' : 'warn') : 'good', s.separation ? 'turbulent separation (H > 2.4)' : 'attached to 97 % c'); };
  sep('sepu', bl && bl.upper); sep('sepl', bl && bl.lower);
  setTile('q', fmt(an.q, 0) + ' Pa', '', fmt(an.q / 1000, 2) + ' kPa');
  setTile('atm', (an.atm.T - 273.15).toFixed(1) + ' °C', '', fmt(an.atm.p / 100, 1) + ' hPa · a ' + fmt(an.atm.a, 0) + ' m/s');
  $('foilStats').textContent = stats ? `· t/c ${(stats.thickness * 100).toFixed(1)} % @ ${(stats.xThickness * 100).toFixed(0)} % · camber ${(stats.camber * 100).toFixed(1)} % @ ${(stats.xCamber * 100).toFixed(0)} %` : '';
}

// ------------------------------------------------------------------ compute pipeline
function cond() {
  return { V: state.V, chord: state.chord, altitude: state.alt, alpha: state.alpha, compressible: state.compressible,
    xtrUpper: state.trip ? state.xtrU : null, xtrLower: state.trip ? state.xtrL : null };
}
const SHAPES = { flatPlate: () => HT.shapes.flatPlate(0.01, 60), diamond: () => HT.shapes.diamond(0.10, 0.5, 60), wedge10: () => HT.shapes.wedge(10, 60), bluntedWedge: () => HT.shapes.bluntedWedge(10, 0.03, 60), bluntedPlate: () => HT.shapes.bluntedPlate(0.03, 60), biconvex: () => HT.shapes.biconvex(0.08, 60) };
function rebuildGeometry(coarse) {
  if (state.shape) geo = SHAPES[state.shape]();
  else if (state.imported) { geo = WT.repanel(state.imported.pts, state.panels); geo.name = state.imported.name; }
  else geo = WT.naca4(state.M / 100, state.P / 10, state.T / 100, state.panels);
  stats = WT.geometryStats(geo);
  $('foilName').textContent = geo.name;
  $('foilStats').textContent = stats ? `· t/c ${(stats.thickness * 100).toFixed(1)} % @ ${(stats.xThickness * 100).toFixed(0)} % · camber ${(stats.camber * 100).toFixed(1)} % @ ${(stats.xCamber * 100).toFixed(0)} %` : '';
  if (state.mode === 'hyper') { sys = null; HyperUI.onGeometryChanged(); return; }
  if (state.mode === 'cfd') { sys = null; CfdUI.onGeometryChanged(); return; }
  if (state.mode === 'ns') { sys = null; return; }
  sys = WT.buildSystem(geo);
  recompute(coarse);
}
let idleTimer = null;
function recompute(coarse) {
  if (state.mode === 'hyper') { HyperUI.recompute(); return; }
  if (state.mode === 'cfd') { CfdUI.onGeometryChanged(); return; }
  if (state.mode === 'ns') return;
  if (!sys) sys = WT.buildSystem(geo);
  an = state.mode === 'tunnel' ? TunnelUI.recompute() : WT.analyse(sys, cond());
  layoutView();
  updateTiles(); drawCp(); drawPolar();
  requestField(!!coarse);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (coarse) requestField(false); }, 220);
  schedulePolar();
}

// ------------------------------------------------------------------ controls
const SLIDERS = [
  { id: 'M', out: v => v.toFixed(1) + ' %', geom: true }, { id: 'P', out: v => (v * 10).toFixed(0) + ' % c', geom: true },
  { id: 'T', out: v => v.toFixed(1) + ' %', geom: true }, { id: 'panels', out: v => v.toFixed(0), geom: true },
  { id: 'alpha', out: v => v.toFixed(2) + '°' }, { id: 'V', out: v => v.toFixed(0) + ' m/s · ' + (v * 1.94384).toFixed(0) + ' kt' },
  { id: 'chord', out: v => v.toFixed(2) + ' m' }, { id: 'alt', out: v => v.toFixed(0) + ' m · ' + (v * 3.28084).toFixed(0) + ' ft' },
];
function syncSlider(s) { const el = $(s.id); el.value = state[s.id]; $(s.id + 'Out').textContent = s.out(state[s.id]); }
function wireControls() {
  for (const s of SLIDERS) {
    const el = $(s.id);
    el.addEventListener('input', () => { state[s.id] = parseFloat(el.value); $(s.id + 'Out').textContent = s.out(state[s.id]); if (s.geom && ['M', 'P', 'T'].includes(s.id)) $('preset').value = 'custom'; s.geom ? rebuildGeometry(true) : recompute(true); });
    el.addEventListener('change', () => { s.geom ? rebuildGeometry(false) : recompute(false); });
    syncSlider(s);
  }
  const sel = $('preset');
  sel.innerHTML = '<option value="custom">Custom (sliders)</option><optgroup label="NACA 4-digit">' + PRESETS.map(p => `<option value="${p[0]}">NACA ${p[0]}</option>`).join('') + '</optgroup><optgroup label="Supersonic / hypersonic shapes"><option value="shape:flatPlate">Flat plate 1 %</option><option value="shape:diamond">Diamond 10 %</option><option value="shape:wedge10">Wedge 10° (blunt base)</option><option value="shape:bluntedWedge">Blunted wedge 10°, r/c 3 %</option><option value="shape:bluntedPlate">Blunted plate 3 %</option><option value="shape:biconvex">Biconvex 8 %</option></optgroup>';
  sel.value = '2412';
  sel.addEventListener('change', () => {
    if (sel.value.startsWith('shape:')) { state.shape = sel.value.slice(6); state.imported = null; showImportBanner(true, 'Shape:', sel.options[sel.selectedIndex].textContent); rebuildGeometry(false); return; }
    const p = PRESETS.find(q => q[0] === sel.value); if (!p) return;
    state.M = p[1]; state.P = Math.max(1, p[2]); state.T = p[3]; state.imported = null; state.shape = null; showImportBanner(false);
    SLIDERS.slice(0, 3).forEach(syncSlider); rebuildGeometry(false);
  });
  $('btnBackNaca').addEventListener('click', () => { state.imported = null; state.shape = null; $('preset').value = 'custom'; showImportBanner(false); rebuildGeometry(false); });
  $('modeSwitch').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  $('compressible').addEventListener('change', e => { state.compressible = e.target.checked; recompute(false); });
  $('trip').addEventListener('change', e => { state.trip = e.target.checked; $('tripRow').style.opacity = state.trip ? 1 : .45; recompute(false); });
  for (const id of ['xtrU', 'xtrL']) $(id).addEventListener('change', e => { state[id] = clamp(parseFloat(e.target.value) || 0.05, 0.01, 0.95); e.target.value = state[id]; recompute(false); });
  $('fieldMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setField(b.dataset.field); });
  for (const id of ['streamlines', 'smoke', 'blMarkers', 'cpVectors']) $(id).addEventListener('change', e => { state[id] = e.target.checked; });
  $('polarTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.polarTab = b.dataset.tab; [...$('polarTabs').children].forEach(x => x.classList.toggle('active', x === b)); drawPolar(); });
  // export menu
  const menu = $('exportMenu');
  $('btnExport').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => { menu.classList.remove('open'); doExport(b.dataset.export); }));
  // dialogs
  $('btnImport').addEventListener('click', () => { $('importErr').textContent = ''; $('dlgImport').showModal(); });
  $('btnHelp').addEventListener('click', () => $('dlgHelp').showModal());
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $('fileInput').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { $('pasteArea').value = t; tryImport(t); }); });
  $('btnDoImport').addEventListener('click', () => tryImport($('pasteArea').value));
  // hover readout
  const hov = $('hover');
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    if (state.mode === 'cfd') { const t = CfdUI.hover(e.clientX - r.left, e.clientY - r.top); if (!t) { hov.style.display = 'none'; return; } hov.textContent = t; hov.style.display = 'block'; hov.style.left = Math.max(0, Math.min(e.clientX - r.left + 14, r.width - 300)) + 'px'; hov.style.top = (e.clientY - r.top + 14) + 'px'; return; }
    if (state.mode === 'ns') { const t = NsUI.hover(e.clientX - r.left, e.clientY - r.top); if (!t) { hov.style.display = 'none'; return; } hov.textContent = t; hov.style.display = 'block'; hov.style.left = Math.max(0, Math.min(e.clientX - r.left + 14, r.width - 360)) + 'px'; hov.style.top = (e.clientY - r.top + 14) + 'px'; return; }
    if (state.mode === 'hyper') { const t = HyperUI.hover(e.clientX - r.left, e.clientY - r.top); if (!t) { hov.style.display = 'none'; return; } hov.textContent = t; hov.style.display = 'block'; hov.style.left = Math.max(0, Math.min(e.clientX - r.left + 14, r.width - 560)) + 'px'; hov.style.top = (e.clientY - r.top + 14) + 'px'; return; }
    if (!grid) return; const w = toWorld(e.clientX - r.left, e.clientY - r.top); const vel = [0, 0];
    const s = sample(grid, w[0], w[1], vel);
    if (s !== 1) { hov.style.display = 'none'; return; }
    const sp = Math.hypot(vel[0], vel[1]);
    hov.textContent = `Cp ${cpOf(vel[0], vel[1]).toFixed(2)}   V ${(sp * state.V).toFixed(1)} m/s (${sp.toFixed(2)} V∞)`;
    hov.style.display = 'block'; hov.style.left = (e.clientX - r.left + 14) + 'px'; hov.style.top = (e.clientY - r.top + 14) + 'px';
  });
  canvas.addEventListener('mouseleave', () => { hov.style.display = 'none'; });
  // keyboard
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.querySelector('dialog[open]')) return;
    if (state.mode === 'cfd') {
      if (e.key === 'ArrowUp') CfdUI.nudge('alpha', 0.5, -10, 20); else if (e.key === 'ArrowDown') CfdUI.nudge('alpha', -0.5, -10, 20);
      else if (e.key === 'ArrowRight') CfdUI.nudge('M', 0.05, 0.05, 1.5); else if (e.key === 'ArrowLeft') CfdUI.nudge('M', -0.05, 0.05, 1.5);
      else if (e.key === 'Enter') CfdUI.start(); else if (e.key === '?') $('dlgHelp').showModal(); else return;
      e.preventDefault(); return;
    }
    if (state.mode === 'hyper') {
      if (e.key === 'ArrowUp') HyperUI.nudge('alpha', 0.5, -20, 30); else if (e.key === 'ArrowDown') HyperUI.nudge('alpha', -0.5, -20, 30);
      else if (e.key === 'ArrowRight') HyperUI.nudge('M', 0.5, 1.5, 25); else if (e.key === 'ArrowLeft') HyperUI.nudge('M', -0.5, 1.5, 25);
      else if (e.key === '?') $('dlgHelp').showModal(); else return;
      e.preventDefault(); return;
    }
    const nudge = (id, dv, lo, hi) => { state[id] = clamp(Math.round((state[id] + dv) * 100) / 100, lo, hi); syncSlider(SLIDERS.find(s => s.id === id)); recompute(false); e.preventDefault(); };
    if (e.key === 'ArrowUp') nudge('alpha', 0.5, -15, 20); else if (e.key === 'ArrowDown') nudge('alpha', -0.5, -15, 20);
    else if (e.key === 'ArrowRight') nudge('V', 5, 5, 340); else if (e.key === 'ArrowLeft') nudge('V', -5, 5, 340);
    else if (e.key === 's' || e.key === 'S') { state.smoke = !state.smoke; $('smoke').checked = state.smoke; }
    else if (e.key === 'f' || e.key === 'F') { const order = ['cp', 'speed', 'off']; setField(order[(order.indexOf(state.field) + 1) % 3]); }
    else if (e.key === '?') $('dlgHelp').showModal();
  });
}
function setField(mode) { state.field = mode; [...$('fieldMode').children].forEach(x => x.classList.toggle('active', x.dataset.field === mode)); buildFieldImage(); }
function showImportBanner(show, kind, name) { $('importBanner').classList.toggle('show', show); $('nacaControls').classList.toggle('disabled', show); if (show) { $('importKind').textContent = kind || 'Imported:'; if (name) $('importName').textContent = name; } }
const SUB_TABS = '<button data-tab="cla" class="active">Cl–α</button><button data-tab="clcd">Cl–Cd</button><button data-tab="cma">Cm–α</button><button data-tab="lda">L/D–α</button>';
function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode; state.polarTab = mode === 'cfd' ? 'res' : mode === 'tunnel' ? 'corr' : mode === 'ns' ? 'series' : 'cla';
  $('cpHeadTitle').textContent = mode === 'ns' ? 'Dissipation & peak vorticity' : 'Pressure distribution'; $('cpHeadSub').textContent = mode === 'ns' ? 'ε(t) and max|ω|(t)' : 'Cp vs x/c (inverted)';
  $('cpLegend').innerHTML = mode === 'ns' ? '<span style="color:var(--amber)">— ε</span> &nbsp; <span style="color:var(--cyan)">— max|ω| (scaled)</span>' : '<span style="color:var(--cyan)">— upper</span> &nbsp; <span style="color:var(--amber)">— lower</span>';
  [...$('modeSwitch').children].forEach(x => x.classList.toggle('active', x.dataset.mode === mode));
  document.querySelectorAll('section[data-mode]').forEach(s => { s.hidden = !s.dataset.mode.split(' ').includes(mode); });
  $('polarTabs').innerHTML = mode === 'hyper' ? HyperUI.tabsHtml() : mode === 'cfd' ? CfdUI.tabsHtml() : mode === 'tunnel' ? TunnelUI.tabsHtml() : mode === 'ns' ? NsUI.tabsHtml() : SUB_TABS;
  $('polarNote').textContent = mode === 'hyper' ? 'sweep −10° … 30°' : mode === 'cfd' ? 'convergence & surface data' : mode === 'tunnel' ? 'blockage & wall corrections' : mode === 'ns' ? 'histories, budget, spectrum, refinement' : 'sweep −8° … 20°';
  buildTiles(mode === 'hyper' ? HyperUI.TILES : mode === 'cfd' ? CfdUI.TILES : mode === 'tunnel' ? TunnelUI.TILES : mode === 'ns' ? NsUI.TILES : TILES);
  $('hover').style.display = 'none';
  rebuildGeometry(false);
  initParticles();   // re-seed smoke uniformly so a mode switch does not launch a wave of particles from the inlet
}
function tryImport(text) {
  try {
    const r = WT.parseCoordinates(text);
    state.imported = r; state.shape = null; $('preset').value = 'custom'; showImportBanner(true, 'Imported:', r.name);
    $('dlgImport').close(); rebuildGeometry(false);
  } catch (err) { $('importErr').textContent = err.message; }
}

// ------------------------------------------------------------------ export
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const slug = () => geo.name.replace(/[^\w]+/g, '_');
function doExport(kind) {
  if (state.mode === 'hyper' && (kind === 'cp' || kind === 'polar' || kind === 'bl')) return HyperUI.exportData(kind);
  if (state.mode === 'cfd' && (kind === 'cp' || kind === 'polar' || kind === 'bl')) return CfdUI.exportData(kind);
  if (state.mode === 'ns' && (kind === 'cp' || kind === 'polar' || kind === 'bl')) return NsUI.exportData(kind);
  if (state.mode === 'tunnel' && (kind === 'cp' || kind === 'polar')) return TunnelUI.exportData(kind);
  if (kind === 'cp') {
    const P = sys.P, iS = an.bl ? an.bl.iStag : 0; let s = `# ${geo.name}  alpha=${state.alpha}  Re=${an.Re.toExponential(3)}  M=${an.M.toFixed(3)}  PG=${an.pg.toFixed(4)}\nx_c,y_c,Cp,surface\n`;
    for (let i = 0; i < P.n; i++) s += `${P.xm[i].toFixed(6)},${P.ym[i].toFixed(6)},${(an.inv.Cp[i] * an.pg).toFixed(6)},${i > iS ? 'upper' : 'lower'}\n`;
    download(`${slug()}_Cp_a${state.alpha}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'polar') {
    if (!polar) return; const c = cond();
    let s = `# ${geo.name}  V=${c.V} m/s  c=${c.chord} m  alt=${c.altitude} m  Re=${an.Re.toExponential(3)}  M=${an.M.toFixed(3)}\nalpha,Cl,Cd,Cm_c4,L_D,xtr_upper,xtr_lower,sep_upper,sep_lower,stall_flag\n`;
    for (const r of polar.points) { const b = r.bl; s += `${r.inv.alpha},${r.Cl.toFixed(5)},${r.Cd.toFixed(6)},${r.Cm.toFixed(5)},${r.LD.toFixed(2)},${b && b.upper.transition ? b.upper.transition.x.toFixed(4) : ''},${b && b.lower.transition ? b.lower.transition.x.toFixed(4) : ''},${b && b.upper.separation ? b.upper.separation.x.toFixed(4) : ''},${b && b.lower.separation ? b.lower.separation.x.toFixed(4) : ''},${b && b.stallWarning ? 1 : 0}\n`; }
    download(`${slug()}_polar.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'bl') {
    const bl = an.bl; if (!bl) return;
    let s = `# ${geo.name}  alpha=${state.alpha}  Re=${an.Re.toExponential(3)}\nsurface,x_c,s_c,Ue_Vinf,theta_c,H,Cf,regime\n`;
    const dump = (name, side, xs, ss) => { for (let k = 0; k < xs.length; k++) s += `${name},${xs[k].toFixed(5)},${ss[k].toFixed(5)},${side.Ue[k].toFixed(5)},${side.theta[k].toExponential(4)},${side.H[k].toFixed(4)},${side.Cf[k].toExponential(4)},${side.regime[k]}
`; };
    dump('upper', bl.upper, bl.xU, bl.sU); dump('lower', bl.lower, bl.xL, bl.sL);
    download(`${slug()}_BL_a${state.alpha}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'dat') {
    let s = geo.name + '\n'; for (let i = geo.x.length - 1; i >= 0; i--) s += ` ${geo.x[i].toFixed(6)}  ${geo.y[i] < 0 ? '' : ' '}${geo.y[i].toFixed(6)}\n`;
    download(`${slug()}.dat`, new Blob([s], { type: 'text/plain' }));
  } else if (kind === 'png') {
    draw(); canvas.toBlob(b => download(`${slug()}_a${state.alpha}.png`, b), 'image/png');
  }
}

// ------------------------------------------------------------------ app API for the assistant (and scripting)
const r3 = v => (Number.isFinite(v) ? +v.toPrecision(4) : null);
const AppAPI = {
  getState() {
    const out = { mode: state.mode, aerofoil: geo.name, thickness_pc: r3(stats.thickness * 100), camber_pc: r3(stats.camber * 100), panels: geo.x.length - 1 };
    if (state.mode === 'tunnel') {
      out.conditions = { alpha_deg: state.alpha, airspeed_mps: state.V, chord_m: state.chord, altitude_m: state.alt, tunnel_height_over_chord: TunnelUI.ts.hc, test_section: TunnelUI.ts.open ? 'open' : 'closed', model_offset_fraction: TunnelUI.ts.yOff };
      out.results = TunnelUI.summary();
    } else if (state.mode === 'sub' && an) {
      const bl = an.bl;
      out.conditions = { alpha_deg: state.alpha, airspeed_mps: state.V, chord_m: state.chord, altitude_m: state.alt, mach: r3(an.M), reynolds: r3(an.Re), compressibility_correction: state.compressible };
      out.results = { Cl: r3(an.Cl), Cd: r3(an.Cd), L_over_D: r3(an.LD), pitching_moment_Cm_c4: r3(an.Cm), lift_N_per_m: r3(an.lift), drag_N_per_m: r3(an.drag), Cp_min: r3(an.CpMin), critical_mach: r3(an.Mcr),
        transition_upper_xc: bl && bl.upper.transition ? r3(bl.upper.transition.x) : null, transition_lower_xc: bl && bl.lower.transition ? r3(bl.lower.transition.x) : null,
        separation_upper_xc: bl && bl.upper.separation ? r3(bl.upper.separation.x) : null, separation_lower_xc: bl && bl.lower.separation ? r3(bl.lower.separation.x) : null,
        stall_warning: !!(bl && bl.stallWarning), zero_lift_alpha_deg: polar ? r3(polar.alpha0) : null, lift_slope_per_rad: polar ? r3(polar.clAlpha) : null, method: 'Hess-Smith panel method + integral boundary layer (inviscid lift, viscous drag)' };
    } else if (state.mode === 'hyper') {
      const h = HyperUI.an, hs = HyperUI.hs;
      out.conditions = { mach: hs.M, altitude_m: hs.alt, alpha_deg: hs.alpha, chord_m: hs.chord, gamma: hs.gamma, wall_temperature_K: hs.Tw, method: hs.method, boundary_layer: hs.bl };
      if (h) out.results = { Cl: r3(h.Cl), Cd: r3(h.Cd), Cd_wave_pressure: r3(h.CdWave), Cd_friction: r3(h.CdF), L_over_D: r3(h.LD), pitching_moment_Cm_c4: r3(h.Cm), lift_N_per_m: r3(h.lift), drag_N_per_m: r3(h.drag), V_mps: r3(h.V), q_Pa: r3(h.q), reynolds: r3(h.Re), knudsen: r3(h.Kn),
        T0_K_perfect_gas: r3(h.T0), pitot_pressure_Pa: r3(h.p02), leading_edge_shock: h.detached ? 'detached (bow shock)' : 'attached', stagnation_heat_flux_W_m2: r3(h.qStag), max_surface_heat_flux_W_m2: r3(h.heat.qMax), heat_load_W_per_m: r3(h.heat.Q), warnings: h.warnings, method: h.method,
        gas_model: 'perfect gas with constant gamma — real-gas effects are NOT modelled, only flagged in warnings', heating_method: 'Eckert reference-temperature correlations; stagnation point by Sutton-Graves' };
    } else if (state.mode === 'ns') {
      const n = NsUI.ns;
      out.conditions = { initial_condition: n.ic, initial_condition_params: n.icp, grid: n.N + '^3', reynolds: Math.round(Math.pow(10, n.logRe)), nu: 1 / Math.pow(10, n.logRe), cfl: n.cfl, fixed_dt: n.dtFixed || null, t_end: n.tEnd, study: n.studyKind };
      out.solver_status = NsUI.status;
      out.solver_description = '3D incompressible Navier-Stokes on the periodic [0,2pi]^3 box, Fourier pseudo-spectral (2/3 dealiased, rotational form, exact projection), RK4; a numerical laboratory — produces evidence and conjectures, never proofs';
      const sm = NsUI.summary();
      if (sm && !NsUI.stale && NsUI.status !== 'running') out.results = sm; else { out.results = null; out.note = NsUI.status === 'running' ? 'experiment is running — call run_nslab to wait for it' : 'NO RESULTS for the current settings yet — call run_nslab to compute them'; }
      delete out.aerofoil; delete out.thickness_pc; delete out.camber_pc; delete out.panels;
    } else if (state.mode === 'cfd') {
      const cs = CfdUI.cs, p = CfdUI.progress, m = CfdUI.mesh;
      out.conditions = { model: cs.model, mach: cs.M, reynolds: r3(Math.pow(10, cs.logRe)), alpha_deg: cs.alpha, altitude_m: cs.alt, normal_layers: cs.NJ, target_yplus: cs.yplus, cfl: cs.cfl, iteration_limit: cs.maxIter };
      out.solver_status = CfdUI.status;
      out.solver_description = cs.model === 'euler' ? 'compressible Euler equations (inviscid), finite volume' : cs.model === 'laminar' ? 'compressible laminar Navier-Stokes, finite volume' : cs.model === 'sst' ? 'compressible RANS (Navier-Stokes + Menter k-omega SST 2003), fully turbulent from the leading edge, no transition model, finite volume, 2D steady' : 'compressible RANS (Navier-Stokes + Spalart-Allmaras), fully turbulent from the leading edge, no transition model, finite volume, 2D steady';
      if (p && !CfdUI.stale && CfdUI.status !== 'running') out.results = { Cl: r3(p.Cl), Cd: r3(p.Cd), Cd_pressure_form: r3(p.Cdp), Cd_friction: r3(p.Cdf), pitching_moment_Cm_c4: r3(p.Cm), iterations: p.iter, residual_orders_dropped: r3(p.drop), elapsed_s: r3(p.elapsed), cells: m ? m.NI * m.NJ : null, diverged: !!p.diverged, panel_method_reference: this.panelRef() };
      else { out.results = null; out.note = CfdUI.status === 'running' ? 'solver is running — call run_cfd to wait for it' : 'NO RESULTS for the current settings yet — call run_cfd to compute them'; }
    }
    return out;
  },
  setMode(mode) { if (!['sub', 'tunnel', 'cfd', 'hyper', 'ns'].includes(mode)) return { error: 'mode must be sub, tunnel, cfd, hyper or ns' }; setMode(mode); return this.getState(); },
  setGeometry(a) {
    a = a || {};
    if (a.naca) {
      const d = String(a.naca).replace(/\D/g, '');
      if (d.length !== 4) return { error: 'naca must be 4 digits' };
      state.M = +d[0]; state.P = Math.max(1, +d[1]); state.T = +d.slice(2); state.imported = null; state.shape = null;
      $('preset').value = PRESETS.some(p => p[0] === d) ? d : 'custom'; showImportBanner(false); SLIDERS.slice(0, 3).forEach(syncSlider);
    }
    if (a.shape && !a.naca) { if (!SHAPES[a.shape]) return { error: 'unknown shape' }; state.shape = a.shape; state.imported = null; $('preset').value = 'shape:' + a.shape; showImportBanner(true, 'Shape:', a.shape); }
    if (Number.isFinite(a.panels)) { state.panels = Math.max(60, Math.min(240, Math.round(a.panels / 20) * 20)); syncSlider(SLIDERS.find(s => s.id === 'panels')); }
    rebuildGeometry(false);
    return this.getState();
  },
  setConditions(a) {
    a = a || {};
    if (state.mode === 'sub' || state.mode === 'tunnel') {
      const set = (k, v, lo, hi) => { if (Number.isFinite(v)) { state[k] = Math.max(lo, Math.min(hi, v)); syncSlider(SLIDERS.find(s => s.id === k)); } };
      set('alpha', a.alpha_deg, -15, 20); set('V', a.airspeed_mps, 5, 340); set('chord', a.chord_m, 0.1, 10); set('alt', a.altitude_m, 0, 20000);
      if (Number.isFinite(a.mach) && !Number.isFinite(a.airspeed_mps)) set('V', a.mach * WT.isa(state.alt).a, 5, 340);
      if (state.mode === 'tunnel') { TunnelUI.set({ hc: a.tunnel_height_over_chord, yOff: a.model_offset_fraction, open: a.test_section === 'open' ? true : a.test_section === 'closed' ? false : undefined }); return this.getState(); }
      recompute(false); polar = WT.sweep(sys, cond(), -8, 20, 1);
    } else if (state.mode === 'hyper') {
      const ok = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
      HyperUI.set({ alpha: ok(a.alpha_deg, -20, 30), M: ok(a.mach, 1.5, 25), alt: ok(a.altitude_m, 0, 86000), chord: ok(a.chord_m, 0.1, 20), gamma: ok(a.gamma, 1.1, 1.67), Tw: ok(a.wall_temperature_K, 150, 2500), method: a.method, bl: a.boundary_layer });
    } else if (state.mode === 'ns') {
      NsUI.set({ N: a.grid_n, Re: a.reynolds, ic: a.initial_condition, tEnd: a.t_end, cfl: a.cfl, study: a.study, icParams: a.initial_condition_params });
    } else {
      const ok = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
      CfdUI.set({ alpha: ok(a.alpha_deg, -10, 20), M: ok(a.mach, 0.05, 1.5), logRe: Number.isFinite(a.reynolds) && a.reynolds > 0 ? Math.log10(a.reynolds) : undefined, alt: ok(a.altitude_m, 0, 20000), model: a.model });
    }
    return this.getState();
  },
  async runNslab(a) {
    a = a || {}; if (state.mode !== 'ns') setMode('ns');
    NsUI.start();
    const r = await NsUI.waitForDone(Math.max(10, Math.min(1800, a.wait_seconds || 300)) * 1000);
    const out = this.getState(); out.run_status = r.status; if (r.status === 'running') out.note = 'stopped waiting before the end time; the run was paused — call again to continue';
    return out;
  },
  async runCfd(waitSeconds) {
    if (state.mode !== 'cfd') setMode('cfd');
    CfdUI.start();
    const r = await CfdUI.waitForDone((waitSeconds || 90) * 1000);
    const p = r.prog;
    return p ? { status: r.status, reason: r.reason || (r.status === 'running' ? 'still running — paused at time limit' : ''), iterations: p.iter, Cl: r3(p.Cl), Cd: r3(p.Cd), Cd_pressure_form: r3(p.Cdp), Cd_friction: r3(p.Cdf), pitching_moment_Cm_c4: r3(p.Cm), residual_orders_dropped: r3(p.drop), elapsed_s: r3(p.elapsed), diverged: !!p.diverged, model: CfdUI.cs.model, aerofoil: geo.name, conditions: { mach: CfdUI.cs.M, reynolds: r3(Math.pow(10, CfdUI.cs.logRe)), alpha_deg: CfdUI.cs.alpha }, panel_method_reference: this.panelRef() } : { status: r.status, error: 'no results' };
  },
  panelRef() {
    try { const s2 = WT.buildSystem(geo), sol = WT.solveInviscid(s2, CfdUI.cs.alpha), pg = CfdUI.cs.M < 0.95 ? 1 / Math.sqrt(1 - CfdUI.cs.M * CfdUI.cs.M) : 1; return { Cl: r3(sol.Cl * pg), note: 'panel method + Prandtl-Glauert at the same alpha and Mach (inviscid)' }; } catch (e) { return null; }
  },
  sweep(from, to, step) {
    from = Number.isFinite(from) ? from : -4; to = Number.isFinite(to) ? to : 12; step = Number.isFinite(step) && step > 0 ? step : 2;
    if ((to - from) / step > 40) step = (to - from) / 40;
    const digest = (rows, extra) => {
      let best = null, maxCl = null, stall = null;
      for (const r of rows) { if (Number.isFinite(r.L_over_D) && (!best || r.L_over_D > best.L_over_D)) best = r; if (!maxCl || r.Cl > maxCl.Cl) maxCl = r; if (stall == null && r.stall_warning) stall = r.alpha_deg; }
      return Object.assign({ mode: state.mode, alpha_range_deg: [from, to], step_deg: r3(step), n_points: rows.length,
        best_L_over_D: best ? { alpha_deg: best.alpha_deg, L_over_D: best.L_over_D, Cl: best.Cl, Cd: best.Cd } : null,
        max_Cl_in_range: maxCl ? { alpha_deg: maxCl.alpha_deg, Cl: maxCl.Cl } : null, stall_onset_alpha_deg: stall }, extra, { rows });
    };
    if (state.mode === 'sub') { const sw = WT.sweep(sys, cond(), from, to, step); const rows = sw.points.map(r => ({ alpha_deg: r3(r.inv.alpha), Cl: r3(r.Cl), Cd: r3(r.Cd), Cm: r3(r.Cm), L_over_D: r3(r.LD), separation_upper_xc: r.bl && r.bl.upper.separation ? r3(r.bl.upper.separation.x) : null, stall_warning: !!(r.bl && r.bl.stallWarning) })); return digest(rows, { zero_lift_alpha_deg: r3(sw.alpha0), lift_slope_per_rad: r3(sw.clAlpha), note: 'inviscid lift with viscous drag; Cl is unreliable once stall_warning is true' }); }
    if (state.mode === 'hyper') { const sw = HT.sweep(geo, HyperUI.cond(), from, to, step); const rows = sw.points.map(r => ({ alpha_deg: r3(r.alpha), Cl: r3(r.Cl), Cd: r3(r.Cd), Cm: r3(r.Cm), L_over_D: r3(r.LD) })); return digest(rows, {}); }
    return { error: 'sweep_alpha is only available in sub or hyper mode (CFD would need one run per angle)' };
  },
};

// ------------------------------------------------------------------ boot
function boot() {
  buildTiles(); wireControls(); makeWorker();
  const shared = { $, state, view, toScreen, toWorld, solverToDisplay, surfScreen, plotFrame, axes, polyline, download, buildTiles, setTile, fmt, fmtRe, geo: () => geo,
    mono: () => getComputedStyle(document.body).getPropertyValue('--mono'), sans: () => getComputedStyle(document.body).getPropertyValue('--sans') };
  HyperUI.init(Object.assign({}, shared, { sys: () => sys, cond, recompute })); CfdUI.init(shared); NsUI.init(Object.assign({}, shared, { redraw: () => draw() })); TunnelUI.init(Object.assign({}, shared, { sys: () => sys, cond, recompute, initParticles })); AssistUI.init(shared, AppAPI);
  layoutView(); initParticles();
  rebuildGeometry(false);
  const ro = new ResizeObserver(() => { layoutView(); CfdUI.onViewChanged(); requestField(false); drawCp(); drawPolar(); });
  ro.observe(canvas); ro.observe($('cpPlot')); ro.observe($('polarPlot'));
  requestAnimationFrame(frame);
}
// debug / scripting hook: WTApp.state, WTApp.an, WTApp.polar, WTApp.grid, WTApp.set({alpha: 8})
window.WTApp = { state, hyper: HyperUI, cfd: CfdUI, tunnel: TunnelUI, assist: AssistUI, api: AppAPI, setMode, get an() { return an; }, get polar() { return polar; }, get grid() { return grid; }, get geo() { return geo; },
  set(patch) { Object.assign(state, patch); SLIDERS.forEach(syncSlider); const geomKeys = ['M', 'P', 'T', 'panels']; Object.keys(patch).some(k => geomKeys.includes(k)) ? rebuildGeometry(false) : recompute(false); } };
boot();
})();
