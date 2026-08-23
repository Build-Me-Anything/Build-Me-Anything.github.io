/* Pocket Wind Tunnel — CFD mode UI (2D Navier–Stokes / RANS in a Web Worker). Depends on WT, CFD and the shared helpers injected by app.js. */
const CfdUI = (() => {
'use strict';
const cs = { model: 'sa', M: 0.15, logRe: 6.5, alpha: 4, alt: 0, NJ: 64, yplus: 1, far: 25, cfl: 30, maxIter: 4000, target: 4, potential: true, field: 'mach', mesh: false, overlay: true };
let S = null, worker = null, mesh = null, snap = null, prog = null, status = 'idle', stale = true, err = '';
let fieldCanvas = null, fieldKey = '', nodeSX = null, nodeSY = null, panelCp = null, doneReason = '';
const Re = () => Math.pow(10, cs.logRe);
const isTurb = () => cs.model === 'sa' || cs.model === 'sst';
const MODEL_NAME = { euler: 'Euler (inviscid)', laminar: 'laminar Navier–Stokes', sa: 'RANS · Spalart–Allmaras', sst: 'RANS · k-ω SST' };
const SL = [
  { id: 'cM', key: 'M', out: v => 'M ' + v.toFixed(2) },
  { id: 'cRe', key: 'logRe', out: v => { const r = Math.pow(10, v); return r >= 1e6 ? (r / 1e6).toFixed(2) + ' × 10⁶' : r >= 1e3 ? (r / 1e3).toFixed(0) + ' × 10³' : r.toFixed(0); } },
  { id: 'cAlpha', key: 'alpha', out: v => v.toFixed(2) + '°' },
  { id: 'cAlt', key: 'alt', out: v => (v / 1000).toFixed(1) + ' km' },
  { id: 'cCfl', key: 'cfl', out: v => v.toFixed(0) },
  { id: 'cMaxIter', key: 'maxIter', out: v => v.toFixed(0) },
  { id: 'cTarget', key: 'target', out: v => v.toFixed(1) + ' orders' },
];
const TILES = [
  ['cl', 'Cl', 'lift coefficient'], ['cd', 'Cd', 'total drag'], ['cdp', 'Cd pressure', 'form + wave'], ['cdf', 'Cd friction', 'viscous'],
  ['ld', 'L / D', 'lift-to-drag'], ['cm', 'Cm c/4', 'pitching moment'], ['lift', 'Lift', 'N per m span'], ['drag', 'Drag', 'N per m span'],
  ['re', 'Reynolds', 'ρ V c / μ'], ['mach', 'Mach', 'V / a'], ['chord', 'Implied chord', 'for this Re & altitude'], ['iter', 'Iterations', 'LU-SGS steps'],
  ['res', 'Residual', 'orders dropped'], ['resnu', 'Turb. residual', 'ν̃ or k equation'], ['cells', 'Cells', 'NI × NJ'], ['yp', 'y+ max', 'first cell'], ['speed', 'Speed', 'ms per iteration'],
];
const POLAR_TABS = [['res', 'Residuals'], ['forces', 'Cl, Cd history'], ['cf', 'Skin friction'], ['yplus', 'y+']];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops) { const s = stops.map(([v, c]) => [v, hex(c)]); return t => { if (!(t > s[0][0])) return s[0][1]; if (t >= s[s.length - 1][0]) return s[s.length - 1][1]; for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), a = s[i - 1][1], b = s[i][1]; return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])]; } return s[0][1]; }; }
const viridis = ramp([[0, '#440154'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']]);
const diverge = ramp([[0, '#2166ac'], [0.5, '#1c2430'], [1, '#e9533b']]);
const thermal = ramp([[0, '#101418'], [0.3, '#5a1030'], [0.6, '#c42a2a'], [0.85, '#ff9a2e'], [1, '#fff2a8']]);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const KINDS = { mach: 'Mach number', cp: 'Cp', p: 'p / p∞', rho: 'ρ / ρ∞', V: '|V| / V∞', T: 'T / T∞', mut: 'μt / μ', vort: 'vorticity · c / V∞', tke: 'k / V∞² (SST)', omega: 'log10 ω c / V∞ (SST)', f1: 'F1 blending (SST)' };

// ------------------------------------------------------------------ worker
function makeWorker() {
  if (worker) { worker.terminate(); worker = null; }
  const src = S.$('wt-solver').textContent + '\n' + S.$('wt-cfd').textContent + '\n' + S.$('wt-cfd-worker').textContent;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = e => onMessage(e.data);
  worker.onerror = e => { err = 'Worker error: ' + (e.message || e); status = 'error'; updateStatus(); };
}
function onMessage(m) {
  if (m.type === 'mesh') { mesh = m; nodeSX = null; fieldCanvas = null; }
  else if (m.type === 'progress') { prog = m; updateTiles(); updateStatus(); }
  else if (m.type === 'field') { snap = m; fieldKey = ''; drawCp(); drawPolar(); }
  else if (m.type === 'done') { status = 'done'; doneReason = m.reason; updateStatus(); }
  else if (m.type === 'error') { err = m.message; status = 'error'; updateStatus(); }
}
function opts() {
  const atm = WT.isa(cs.alt), re = Re();
  const o = { model: cs.model, M: cs.M, Re: re, alpha: cs.alpha, NJ: cs.NJ, far: cs.far, cfl: cs.cfl, Tinf: atm.T, wallExtrap: false };
  const geo = S.geo(), NI = geo.x.length - 1;
  if (cs.model === 'euler') o.d1 = 2e-3 * Math.sqrt(120 / NI);
  else if (cs.model === 'laminar') o.d1 = Math.max(2e-5, Math.min(5e-3, 0.12 / Math.sqrt(re)));
  else o.yplus = cs.yplus;
  return o;
}
function start() {
  if (!worker) makeWorker();
  const geo = S.geo();
  err = ''; status = 'running'; stale = false; doneReason = ''; snap = null; prog = null; mesh = null; fieldCanvas = null;
  worker.postMessage({ type: 'start', gx: Array.from(geo.x), gy: Array.from(geo.y), opts: opts(), potential: cs.potential, kind: cs.field, maxIter: cs.maxIter, target: cs.target });
  computePanelOverlay();
  updateStatus(); updateTiles();
}
function pause() { if (worker && status === 'running') { worker.postMessage({ type: 'pause' }); status = 'paused'; updateStatus(); } }
function resume() {
  if (!worker) return;
  if (status === 'paused') { worker.postMessage({ type: 'resume' }); status = 'running'; }
  else if (status === 'done' && doneReason !== 'diverged') { cs.maxIter += 2000; syncSlider(SL.find(s => s.key === 'maxIter')); worker.postMessage({ type: 'limits', maxIter: cs.maxIter, target: cs.target + 2 }); status = 'running'; }
  updateStatus();
}
function reset() { if (worker) { worker.terminate(); worker = null; } status = 'idle'; snap = null; prog = null; mesh = null; fieldCanvas = null; updateStatus(); updateTiles(); drawCp(); drawPolar(); }
function markStale() { stale = true; if (status === 'running') pause(); updateStatus(); }
function computePanelOverlay() {
  panelCp = null;
  try {
    const geo = S.geo(), sys = WT.buildSystem(geo), sol = WT.solveInviscid(sys, cs.alpha);
    const pg = cs.M < 0.95 ? 1 / Math.sqrt(1 - cs.M * cs.M) : 1;
    panelCp = { x: Array.from(sys.P.xm), Cp: Array.from(sol.Cp).map(c => c * pg), iLE: (() => { let b = 0; for (let i = 0; i < sys.n; i++) if (sys.P.xm[i] < sys.P.xm[b]) b = i; return b; })(), Cl: sol.Cl * pg };
  } catch (e) { panelCp = null; }
}

// ------------------------------------------------------------------ rendering
function nodeScreen() {
  const { NI, NJ, X, Y } = mesh, NX = NI + 1;
  nodeSX = new Float32Array(NX * (NJ + 1)); nodeSY = new Float32Array(NX * (NJ + 1));
  for (let k = 0; k < NX * (NJ + 1); k++) { const p = S.surfScreen(X[k], Y[k]); nodeSX[k] = p[0]; nodeSY[k] = p[1]; }
}
function range(kind, data) {
  let lo = Infinity, hi = -Infinity; const n = data.length;
  const sorted = Float32Array.from(data).sort();
  const pct = q => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))];
  switch (kind) {
    case 'mach': return [0, Math.max(1, pct(0.999))];
    case 'cp': return [Math.min(pct(0.002), -0.5), 1.05];
    case 'vort': { const a = Math.max(Math.abs(pct(0.01)), Math.abs(pct(0.99)), 1e-3); return [-a, a]; }
    case 'mut': return [0, Math.max(1, pct(0.995))];
    case 'tke': return [0, Math.max(1e-6, pct(0.995))];
    case 'f1': return [0, 1];
    case 'V': return [0, Math.max(1, pct(0.999))];
    default: lo = pct(0.002); hi = pct(0.998); if (hi - lo < 1e-6) { lo -= 1e-3; hi += 1e-3; } return [lo, hi];
  }
}
function colour(kind, t) { return kind === 'cp' || kind === 'vort' ? diverge(t) : kind === 'T' || kind === 'p' ? thermal(t) : viridis(t); }
function renderField() {
  if (!mesh || !snap) return;
  const { W, H, dpr } = S.view;
  const key = `${snap.iter}|${snap.kind}|${W}x${H}|${S.view.scale}|${cs.alpha}`;
  if (fieldKey === key && fieldCanvas) return;
  fieldKey = key;
  if (!nodeSX) nodeScreen();
  if (!fieldCanvas) fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = Math.round(W * dpr); fieldCanvas.height = Math.round(H * dpr);
  const c = fieldCanvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#0e141c'; c.fillRect(0, 0, W, H);
  const { NI, NJ } = mesh, NX = NI + 1, data = snap.data, [lo, hi] = range(snap.kind, data);
  snap.range = [lo, hi];
  const inv = 1 / (hi - lo || 1);
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1;
    const x0 = nodeSX[a], y0 = nodeSY[a];
    if ((x0 < -50 || x0 > W + 50 || y0 < -50 || y0 > H + 50) && (nodeSX[e] < -50 || nodeSX[e] > W + 50 || nodeSY[e] < -50 || nodeSY[e] > H + 50)) continue;
    const t = Math.max(0, Math.min(1, (data[j * NI + i] - lo) * inv));
    c.fillStyle = rgb(colour(snap.kind, t));
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(nodeSX[b], nodeSY[b]); c.lineTo(nodeSX[e], nodeSY[e]); c.lineTo(nodeSX[d], nodeSY[d]); c.closePath(); c.fill();
    c.strokeStyle = c.fillStyle; c.lineWidth = 0.6; c.stroke();   // hairline to hide anti-aliasing seams between cells
  }
}
function draw(ctx) {
  const { W, H, dpr } = S.view;
  ctx.fillStyle = '#0e141c'; ctx.fillRect(0, 0, W, H);
  const geo = S.geo();
  if (mesh && snap) { renderField(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fieldCanvas, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  if (mesh && cs.mesh) {
    if (!nodeSX) nodeScreen();
    const { NI, NJ } = mesh, NX = NI + 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let j = 0; j <= NJ; j += (j < 8 ? 1 : 2)) { ctx.moveTo(nodeSX[j * NX], nodeSY[j * NX]); for (let i = 1; i <= NI; i++) ctx.lineTo(nodeSX[j * NX + i], nodeSY[j * NX + i]); }
    for (let i = 0; i < NI; i += 2) { ctx.moveTo(nodeSX[i], nodeSY[i]); for (let j = 1; j <= NJ; j++) ctx.lineTo(nodeSX[j * NX + i], nodeSY[j * NX + i]); }
    ctx.stroke();
  }
  // body
  ctx.beginPath(); let s = S.surfScreen(geo.x[0], geo.y[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 1; i < geo.x.length; i++) { s = S.surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(s[0], s[1]); }
  ctx.closePath(); ctx.fillStyle = '#1b2634'; ctx.fill(); ctx.strokeStyle = '#d7e2ef'; ctx.lineWidth = 1.2; ctx.stroke();
  const qc = S.surfScreen(0.25, 0); ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(qc[0], qc[1], 3, 0, 7); ctx.fill();
  // HUD
  ctx.font = '12px ' + S.mono(); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const atm = WT.isa(cs.alt), V = cs.M * atm.a, modelName = MODEL_NAME[cs.model];
  const l1 = `${modelName}   M ${cs.M.toFixed(2)}   Re ${Re().toExponential(2)}   α ${cs.alpha.toFixed(1)}°   V∞ ${V.toFixed(0)} m/s`;
  const l2 = mesh ? `mesh ${mesh.NI}×${mesh.NJ} = ${(mesh.NI * mesh.NJ).toLocaleString()} cells · first cell ${mesh.d1.toExponential(1)} c · ratio ${mesh.ratio.toFixed(3)} · far-field ${mesh.far.toFixed(0)} c` : 'no mesh yet — press Run';
  const l3 = prog ? `iteration ${prog.iter}   residual ↓ ${prog.drop.toFixed(2)} orders${isTurb() ? ` (${cs.model === 'sst' ? 'k' : 'ν̃'} ${prog.dropNu.toFixed(2)})` : ''}   Cl ${prog.Cl.toFixed(4)}   Cd ${prog.Cd.toFixed(5)}   CFL ${prog.cfl.toFixed(0)}   ${prog.elapsed.toFixed(0)} s` : '';
  ctx.fillStyle = 'rgba(8,12,18,0.65)'; ctx.fillRect(8, 8, Math.min(700, W - 16), 54);
  ctx.fillStyle = '#d7e2ef'; ctx.fillText(l1, 14, 13); ctx.fillText(l2, 14, 29); ctx.fillText(l3, 14, 45);
  if (stale && status !== 'idle') { ctx.fillStyle = 'rgba(244,162,97,0.9)'; ctx.font = 'bold 12px ' + S.sans(); ctx.fillText('⚠ settings changed since this solution — press Run to recompute', 14, 68); }
  if (status === 'error') { ctx.fillStyle = '#ff8fa8'; ctx.font = 'bold 12px ' + S.sans(); ctx.fillText('✖ ' + err, 14, 68); }
  if (prog && prog.diverged) { ctx.fillStyle = '#ff8fa8'; ctx.font = 'bold 12px ' + S.sans(); ctx.fillText('✖ solution diverged — lower the CFL, use freestream initialisation, or coarsen the first cell', 14, 68); }
  // legend
  if (snap && snap.range) {
    const lw = 150, lh = 10, lx = W - 20 - lw, ly = W < 900 ? 70 : 14;
    for (let i = 0; i < lw; i++) { ctx.fillStyle = rgb(colour(snap.kind, i / (lw - 1))); ctx.fillRect(lx + i, ly, 1.2, lh); }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, lw, lh);
    ctx.font = '11px ' + S.mono(); ctx.fillStyle = '#d7e2ef'; ctx.textAlign = 'left'; ctx.fillText(snap.range[0].toFixed(2), lx, ly + lh + 3); ctx.textAlign = 'right'; ctx.fillText(snap.range[1].toFixed(2), lx + lw, ly + lh + 3);
    ctx.textAlign = 'center'; ctx.fillText(KINDS[snap.kind] || snap.kind, lx + lw / 2, ly + lh + 16); ctx.textAlign = 'left';
  }
  const yy = H - 30; ctx.strokeStyle = '#4cc9f0'; ctx.fillStyle = '#4cc9f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(14, yy); ctx.lineTo(64, yy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(64, yy); ctx.lineTo(56, yy - 4); ctx.lineTo(56, yy + 4); ctx.closePath(); ctx.fill();
  ctx.font = '12px ' + S.mono(); ctx.fillText('V∞', 70, yy - 7);
}

// ------------------------------------------------------------------ plots
function surfaceSplit() {
  if (!snap) return null;
  const sf = snap.surface, n = sf.x.length; let iLE = 0; for (let i = 0; i < n; i++) if (sf.x[i] < sf.x[iLE]) iLE = i;
  const lower = [], upper = [];
  for (let i = 0; i <= iLE; i++) lower.push(i); for (let i = iLE + 1; i < n; i++) upper.push(i);
  return { sf, lower, upper };
}
function drawCp() {
  const f = S.plotFrame(S.$('cpPlot')), { c } = f;
  const sp = surfaceSplit();
  if (!sp) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText(status === 'idle' ? 'press Run to start the solver' : 'waiting for first snapshot…', f.W / 2, f.H / 2); return; }
  const { sf, lower, upper } = sp;
  const all = Array.from(sf.Cp), cpmin = Math.min(...all), cpmax = Math.max(...all);
  const ymax = Math.max(1.1, cpmax * 1.05), ymin = Math.min(-1, cpmin * 1.1);
  const ystep = (ymax - ymin) > 6 ? 2 : (ymax - ymin) > 3 ? 1 : 0.5;
  const { X, Y } = S.axes(f, 0, 1, ymax, ymin, 'x/c', '−Cp ↑', 0.2, ystep);
  if (cs.overlay && panelCp) {
    const pc = panelCp, up = [], lo = [];
    for (let i = 0; i < pc.x.length; i++) (i > pc.iLE ? up : lo).push([X(pc.x[i]), Y(pc.Cp[i])]);
    S.polyline(c, lo, 'rgba(244,162,97,0.45)', 1, [3, 3]); S.polyline(c, up, 'rgba(76,201,240,0.45)', 1, [3, 3]);
    c.fillStyle = '#5b6b80'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('dashed: panel method + Prandtl–Glauert (Cl ' + pc.Cl.toFixed(3) + ')', f.W - f.pad.r - 2, f.pad.t + 2);
  }
  S.polyline(c, lower.map(i => [X(sf.x[i]), Y(sf.Cp[i])]), '#f4a261', 1.6);
  S.polyline(c, upper.map(i => [X(sf.x[i]), Y(sf.Cp[i])]), '#4cc9f0', 1.6);
}
function drawPolar() {
  const f = S.plotFrame(S.$('polarPlot')), { c } = f, tab = S.state.polarTab;
  if (!snap) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText('no data yet', f.W / 2, f.H / 2); return; }
  const stepOf = span => { const raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-12)))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  if (tab === 'res') {
    const r = Array.from(snap.res), r0 = r[1] || r[0] || 1, pts = [];
    for (let i = 0; i < r.length; i += Math.max(1, Math.floor(r.length / 600))) { const v = Math.log10(r[i] / r0); if (Number.isFinite(v)) pts.push([i + 1, v]); }
    if (!pts.length) return;
    let ymin = -1, ymax = 0.5; for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } ymin -= 0.3;
    const { X, Y } = S.axes(f, 0, Math.max(100, r.length), ymin, ymax, 'iteration', 'log10 residual (continuity)', stepOf(Math.max(100, r.length)), stepOf(ymax - ymin));
    S.polyline(c, pts.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.5);
    S.polyline(c, [[X(0), Y(-cs.target)], [X(r.length), Y(-cs.target)]], '#06d6a0', 1, [4, 4]);
    c.fillStyle = '#06d6a0'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('target', X(0) + 4, Y(-cs.target) - 2);
  } else if (tab === 'forces') {
    const h = snap.hist; if (!h.length) return;
    const cl = h.map(p => p[1]), cd = h.map(p => p[2]);
    const clmin = Math.min(...cl), clmax = Math.max(...cl), cdmin = Math.min(...cd), cdmax = Math.max(...cd);
    const ymin = Math.min(clmin, cdmin * 10) - 0.05, ymax = Math.max(clmax, cdmax * 10) + 0.05;
    const { X, Y } = S.axes(f, 0, h[h.length - 1][0], ymin, ymax, 'iteration', 'Cl (cyan), 10·Cd (amber)', stepOf(h[h.length - 1][0]), stepOf(ymax - ymin));
    S.polyline(c, h.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.5); S.polyline(c, h.map(p => [X(p[0]), Y(10 * p[2])]), '#f4a261', 1.5);
    const last = h[h.length - 1]; c.fillStyle = '#d7e2ef'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`Cl ${last[1].toFixed(4)}  Cd ${last[2].toFixed(5)}  Cm ${last[3].toFixed(4)}`, f.W - f.pad.r - 2, f.pad.t + 2);
  } else if (tab === 'cf' || tab === 'yplus') {
    const { sf, lower, upper } = surfaceSplit(), arr = tab === 'cf' ? sf.Cf : sf.yplus;
    const vals = Array.from(arr).filter(Number.isFinite), vmin = Math.min(0, ...vals), vmax = Math.max(1e-4, ...vals);
    const { X, Y } = S.axes(f, 0, 1, vmin * 1.1, vmax * 1.1, 'x/c', tab === 'cf' ? 'Cf (+ along flow)' : 'y+ of first cell centre', 0.2, stepOf(vmax * 1.1 - vmin * 1.1));
    if (tab === 'cf' && cs.model !== 'euler') {
      const re = Re(), pts = []; for (let x = 0.02; x <= 1; x += 0.02) pts.push([X(x), Y(isTurb() ? 0.0576 / Math.pow(re * x, 0.2) : 0.664 / Math.sqrt(re * x))]);
      S.polyline(c, pts, 'rgba(255,255,255,0.3)', 1, [3, 3]); c.fillStyle = '#5b6b80'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(isTurb() ? 'dashed: turbulent flat plate 0.0576 Re_x^-0.2' : 'dashed: Blasius 0.664 Re_x^-0.5', f.W - f.pad.r - 2, f.pad.t + 2);
    }
    S.polyline(c, lower.map(i => [X(sf.x[i]), Y(-arr[i])]), '#f4a261', 1.5);   // lower surface runs TE→LE: flip sign so "along the flow" is positive
    S.polyline(c, upper.map(i => [X(sf.x[i]), Y(arr[i])]), '#4cc9f0', 1.5);
  }
}

// ------------------------------------------------------------------ tiles & status
function updateTiles() {
  const t = S.setTile, fmt = S.fmt, atm = WT.isa(cs.alt), V = cs.M * atm.a, re = Re(), chord = re * atm.nu / V, q = 0.5 * atm.rho * V * V;
  const p = prog;
  t('cl', p ? fmt(p.Cl, 4) : '—', ''); t('cd', p ? fmt(p.Cd, 5) : '—', ''); t('cdp', p ? fmt(p.Cdp, 5) : '—', ''); t('cdf', p ? fmt(p.Cdf, 5) : '—', cs.model === 'euler' ? '' : '', cs.model === 'euler' ? 'inviscid: none' : 'viscous');
  t('ld', p && p.Cd > 0 ? fmt(p.Cl / p.Cd, 1) : '—', ''); t('cm', p ? fmt(p.Cm, 4) : '—', '');
  t('lift', p ? fmt(q * chord * p.Cl, 0) : '—', '', 'N per m span (c ' + chord.toFixed(2) + ' m)'); t('drag', p ? fmt(q * chord * p.Cd, 1) : '—', '');
  t('re', re.toExponential(2), '', cs.model === 'euler' ? 'not used (inviscid)' : 'ρ V c / μ'); t('mach', cs.M.toFixed(2), cs.M > 0.95 ? 'warn' : '', cs.M > 0.7 ? 'transonic' : 'subsonic');
  t('chord', chord.toFixed(2) + ' m', '', V.toFixed(0) + ' m/s at ' + (cs.alt / 1000).toFixed(1) + ' km');
  t('iter', p ? p.iter : '—', '', status); t('res', p ? p.drop.toFixed(2) : '—', p && p.drop >= cs.target ? 'good' : '', 'target ' + cs.target.toFixed(1));
  t('resnu', p && isTurb() ? p.dropNu.toFixed(2) : '—', '', cs.model === 'sa' ? 'Spalart–Allmaras ν̃' : cs.model === 'sst' ? 'k-ω SST (k equation)' : 'no turbulence eq.');
  t('cells', mesh ? (mesh.NI * mesh.NJ).toLocaleString() : '—', '', mesh ? `${mesh.NI} × ${mesh.NJ}` : 'NI × NJ');
  let ypm = 0; if (snap) for (const y of snap.surface.yplus) ypm = Math.max(ypm, y);
  t('yp', snap && cs.model !== 'euler' ? ypm.toFixed(2) : '—', ypm > 5 ? 'bad' : ypm > 2 ? 'warn' : '', isTurb() ? 'aim for ≤ 1' : 'first cell');
  t('speed', p && p.iter ? (1000 * p.elapsed / p.iter).toFixed(1) : '—', '', 'ms per iteration');
}
function updateStatus() {
  const el = S.$('cStatus'); if (!el) return;
  const msg = status === 'idle' ? 'Idle — set up the case and press Run.' : status === 'running' ? `Running… iteration ${prog ? prog.iter : 0}` : status === 'paused' ? 'Paused.' : status === 'done' ? (doneReason === 'converged' ? '✓ Converged to target.' : doneReason === 'stable' ? '✓ Forces converged (Cl, Cd flat over 500 iterations).' : doneReason === 'diverged' ? '✖ Diverged.' : 'Stopped at the iteration limit (press Continue for more).') : '✖ ' + err;
  el.textContent = msg; el.style.color = status === 'error' || doneReason === 'diverged' ? 'var(--red)' : doneReason === 'converged' || doneReason === 'stable' ? 'var(--green)' : 'var(--muted)';
  S.$('cRun').textContent = status === 'running' ? 'Restart' : 'Run';
  S.$('cPause').textContent = status === 'running' ? 'Pause' : 'Continue';
  S.$('cPause').disabled = !(status === 'running' || status === 'paused' || status === 'done');
}

// ------------------------------------------------------------------ hover, export, controls
function hover(sx, sy) {
  if (!mesh || !snap || !nodeSX) return null;
  const { NI, NJ } = mesh, NX = NI + 1;
  const inside = (ax, ay, bx, by, cx, cy, dx, dy) => { const cr = (x0, y0, x1, y1) => (x1 - x0) * (sy - y0) - (y1 - y0) * (sx - x0); const s1 = cr(ax, ay, bx, by), s2 = cr(bx, by, cx, cy), s3 = cr(cx, cy, dx, dy), s4 = cr(dx, dy, ax, ay); return (s1 >= 0 && s2 >= 0 && s3 >= 0 && s4 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0 && s4 <= 0); };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1;
    if (Math.abs(nodeSX[a] - sx) > 60 && Math.abs(nodeSX[e] - sx) > 60) continue;
    if (inside(nodeSX[a], nodeSY[a], nodeSX[b], nodeSY[b], nodeSX[e], nodeSY[e], nodeSX[d], nodeSY[d])) return `${KINDS[snap.kind]} ${snap.data[j * NI + i].toFixed(3)} · cell (${i}, ${j}) · wall distance ${mesh.wd ? mesh.wd[(j + 2) * (NI + 4) + i + 2].toExponential(2) + ' c' : '—'}`;
  }
  return null;
}
function exportData(kind) {
  const geo = S.geo(), slug = geo.name.replace(/[^\w]+/g, '_'), tag = `${cs.model}_M${cs.M}_Re${Re().toExponential(1)}_a${cs.alpha}`;
  if (!snap) return;
  if (kind === 'cp') {
    const sf = snap.surface; let s = `# ${geo.name} CFD ${tag} iteration ${snap.iter}\nx_c,y_c,Cp,Cf,yplus\n`;
    for (let i = 0; i < sf.x.length; i++) s += `${sf.x[i].toFixed(6)},${sf.y[i].toFixed(6)},${sf.Cp[i].toFixed(6)},${sf.Cf[i].toExponential(4)},${sf.yplus[i].toFixed(3)}\n`;
    S.download(`${slug}_CFD_surface_${tag}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'polar') {
    let s = `# ${geo.name} CFD ${tag} convergence history\niteration,log10_residual,Cl,Cd,Cm\n`;
    const r0 = snap.res[1] || snap.res[0] || 1;
    for (const h of snap.hist) s += `${h[0]},${Math.log10((snap.res[h[0] - 1] || r0) / r0).toFixed(4)},${h[1].toFixed(6)},${h[2].toFixed(6)},${h[3].toFixed(6)}\n`;
    S.download(`${slug}_CFD_history_${tag}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'bl') {
    if (!mesh) return; const { NI, NJ, X, Y } = mesh, NX = NI + 1;
    let s = `# ${geo.name} CFD ${tag} field (${KINDS[snap.kind]}) at cell centres, iteration ${snap.iter}\ni,j,x_c,y_c,${snap.kind}\n`;
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1; s += `${i},${j},${(0.25 * (X[a] + X[b] + X[d] + X[e])).toFixed(6)},${(0.25 * (Y[a] + Y[b] + Y[d] + Y[e])).toFixed(6)},${snap.data[j * NI + i].toExponential(5)}\n`; }
    S.download(`${slug}_CFD_field_${snap.kind}_${tag}.csv`, new Blob([s], { type: 'text/csv' }));
  }
}
function syncSlider(s) { const el = S.$(s.id); el.value = cs[s.key]; S.$(s.id + 'Out').textContent = s.out(cs[s.key]); }
function nudge(key, dv, lo, hi) { cs[key] = Math.max(lo, Math.min(hi, Math.round((cs[key] + dv) * 100) / 100)); syncSlider(SL.find(s => s.key === key)); markStale(); computePanelOverlay(); drawCp(); }
function wire() {
  for (const s of SL) { const el = S.$(s.id); el.addEventListener('input', () => { cs[s.key] = parseFloat(el.value); S.$(s.id + 'Out').textContent = s.out(cs[s.key]); if (s.key === 'maxIter' || s.key === 'target') { if (worker) worker.postMessage({ type: 'limits', maxIter: cs.maxIter, target: cs.target }); } else markStale(); if (s.key === 'alpha' || s.key === 'M') { computePanelOverlay(); drawCp(); } updateTiles(); }); syncSlider(s); }
  S.$('cModel').addEventListener('change', e => { cs.model = e.target.value; S.$('cYplusRow').style.opacity = isTurb() ? 1 : .45; markStale(); updateTiles(); });
  S.$('cNJ').addEventListener('change', e => { cs.NJ = +e.target.value; markStale(); });
  S.$('cYplus').addEventListener('change', e => { cs.yplus = +e.target.value; markStale(); });
  S.$('cFar').addEventListener('change', e => { cs.far = +e.target.value; markStale(); });
  S.$('cField').addEventListener('change', e => { cs.field = e.target.value; if (worker) worker.postMessage({ type: 'kind', kind: cs.field }); });
  S.$('cInit').addEventListener('change', e => { cs.potential = e.target.checked; markStale(); });
  S.$('cMesh').addEventListener('change', e => { cs.mesh = e.target.checked; });
  S.$('cOverlay').addEventListener('change', e => { cs.overlay = e.target.checked; drawCp(); });
  S.$('cRun').addEventListener('click', start);
  S.$('cPause').addEventListener('click', () => { if (status === 'running') pause(); else resume(); });
  S.$('cReset').addEventListener('click', reset);
}
function set(patch) {
  const lim = { M: [0.05, 1.5], logRe: [3, 8], alpha: [-10, 20], alt: [0, 20000], cfl: [5, 100], maxIter: [500, 20000] };
  for (const k of Object.keys(patch)) {
    if (k in lim && Number.isFinite(patch[k])) { cs[k] = Math.max(lim[k][0], Math.min(lim[k][1], patch[k])); syncSlider(SL.find(s => s.key === k)); }
    else if (k === 'model' && ['euler', 'laminar', 'sa', 'sst'].includes(patch[k])) { cs.model = patch[k]; S.$('cModel').value = patch[k]; S.$('cYplusRow').style.opacity = isTurb() ? 1 : .45; }
    else if (k === 'NJ' && [32, 48, 64, 96, 128].includes(+patch[k])) { cs.NJ = +patch[k]; S.$('cNJ').value = String(cs.NJ); }
  }
  markStale(); computePanelOverlay(); drawCp(); updateTiles();
}
function waitForDone(ms) {
  return new Promise(resolve => { const t0 = Date.now(); const tick = () => { if (status !== 'running' || Date.now() - t0 > ms) { if (status === 'running') pause(); resolve({ status, reason: doneReason, prog }); } else setTimeout(tick, 250); }; tick(); });
}
function init(shared) { S = shared; wire(); }
function tabsHtml() { return POLAR_TABS.map(([k, l], i) => `<button data-tab="${k}" class="${i === 0 ? 'active' : ''}">${l}</button>`).join(''); }
function onGeometryChanged() { markStale(); computePanelOverlay(); drawCp(); drawPolar(); updateTiles(); }
function onViewChanged() { nodeSX = null; fieldKey = ''; }

return { init, set, waitForDone, cs, TILES, tabsHtml, draw, drawCp, drawPolar, hover, exportData, nudge, onGeometryChanged, onViewChanged, start, pause, reset, alpha: () => cs.alpha, get snapshot() { return snap; }, get progress() { return prog; }, get status() { return status; }, get mesh() { return mesh; }, get stale() { return stale; } };
})();
