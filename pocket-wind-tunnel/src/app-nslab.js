/* Pocket Wind Tunnel — NSLab mode UI (3D incompressible Navier–Stokes laboratory in a Web Worker). Depends on NS and the shared helpers injected by app.js. */
const NsUI = (() => {
'use strict';
const ns = { N: 32, logRe: Math.log10(1600), ic: 'tgv', cfl: 0.4, dtFixed: 0, tEnd: 10, outEvery: 0.5, field: 'vort', axis: 'z', slice: 0, studyKind: 'none', gridLadder: '16,24,32', dtLadder: '0.08,0.04,0.02', icp: {} };
let S = null, worker = null, status = 'idle', prog = null, out = null, sliceData = null, sliceN = 0, sliceInfo = null, health = null, study = null, levels = [], err = '', stale = false;
let sliceCanvas = null, sliceKey = '', init0 = null, exact = null, lastHover = null, dossierPending = null;
const Re = () => Math.round(Math.pow(10, ns.logRe));
const FIELD = { vort: '|ω|', q: 'Q-criterion', stretch: 'ω·S·ω (stretching)', speed: '|u|', ke: '½|u|²', u: 'u', v: 'v', w: 'w', omx: 'ωx', omy: 'ωy', omz: 'ωz' };
const SIGNED = { q: 1, stretch: 1, u: 1, v: 1, w: 1, omx: 1, omy: 1, omz: 1 };
const ICP = {
  tubes: [['amp', 'ω amplitude', 8], ['sigma', 'core σ', 0.4], ['sep', 'half-separation', 0.7], ['pert', 'perturbation δ', 0.2]],
  random: [['seed', 'seed', 1], ['k0', 'peak k₀', 4], ['E0', 'energy E₀', 0.5]],
  abc: [['A', 'A', 1], ['B', 'B', 1], ['C', 'C', 1]],
};
const SL = [
  { id: 'nRe', key: 'logRe', out: v => 'Re ' + Math.round(Math.pow(10, v)).toLocaleString() + '  (ν ' + (1 / Math.pow(10, v)).toExponential(2) + ')' },
  { id: 'nCfl', key: 'cfl', out: v => v.toFixed(2) },
  { id: 'nTEnd', key: 'tEnd', out: v => v.toFixed(1) },
  { id: 'nSlice', key: 'slice', out: v => `${v} / ${ns.N - 1}  (${(v * 2 * Math.PI / ns.N).toFixed(2)})` },
];
const TILES = [
  ['t', 'Time', 't (box 2π, U 1)'], ['E', 'Energy', '½⟨|u|²⟩'], ['Z', 'Enstrophy', '½⟨|ω|²⟩'], ['eps', 'Dissipation', 'ε = 2νZ'], ['om', 'max |ω|', 'L∞ vorticity'],
  ['stretch', 'Stretching', '⟨ω·S·ω⟩'], ['keta', 'kmax·η', 'resolution (≥ 1)'], ['rel', 'Re λ', 'Taylor microscale'], ['skew', 'Skewness S', 'from ⟨ω·S·ω⟩ (Brachet)'], ['align', '|cos(ω, e₂)|', 'strain alignment'],
  ['dt', 'Δt', 'RK4 step'], ['steps', 'Steps', 'completed'], ['health', 'Health', 'verification'], ['speed', 'Speed', 'ms per step'],
];
const POLAR_TABS = [['series', 'E, Z history'], ['enst', 'Enstrophy budget'], ['spec', 'Spectrum E(k)'], ['study', 'Refinement'], ['align', 'Alignment']];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops) { const s = stops.map(([v, c]) => [v, hex(c)]); return t => { if (!(t > s[0][0])) return s[0][1]; if (t >= s[s.length - 1][0]) return s[s.length - 1][1]; for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), a = s[i - 1][1], b = s[i][1]; return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])]; } return s[0][1]; }; }
const viridis = ramp([[0, '#440154'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']]);
const diverge = ramp([[0, '#2166ac'], [0.5, '#1c2430'], [1, '#e9533b']]);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const REF = { tgv1600: { eps: [0.0126, 0.0133], t: 9, label: 'Brachet 1983 (256³) 0.0126 … 512³ spectral ≈ 0.013 at t ≈ 9' } };

// ------------------------------------------------------------------ worker
function makeWorker() {
  if (worker) { worker.terminate(); worker = null; }
  const src = S.$('wt-nslab').textContent + '\n' + S.$('wt-nslab-worker').textContent;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = e => onMessage(e.data);
  worker.onerror = e => { err = 'Worker error: ' + (e.message || e); status = 'error'; updateStatus(); };
}
function onMessage(m) {
  if (m.type === 'init') { init0 = m; sliceN = m.N; ns.N = m.N; syncSlider(SL[3]); }
  else if (m.type === 'progress') { prog = m; updateTiles(); updateStatus(); drawCp(); if (S.state.polarTab === 'series' || S.state.polarTab === 'enst') drawPolar(); }
  else if (m.type === 'output') { out = m.out; health = m.health; sliceData = m.slice; sliceN = m.N; sliceKey = ''; sliceInfo = { field: ns.field, axis: ns.axis, index: ns.slice }; renderHealth(); updateTiles(); drawPolar(); S.redraw(); }
  else if (m.type === 'slice') { sliceData = m.slice; sliceN = m.N; sliceKey = ''; sliceInfo = { field: m.field, axis: m.axis, index: m.index }; S.redraw(); }
  else if (m.type === 'levelDone') { levels.push(m.level); if (S.state.polarTab === 'study') drawPolar(); }
  else if (m.type === 'studyDone') { study = m.summary; levels = m.levels; status = 'done'; updateStatus(); renderHealth(); drawPolar(); }
  else if (m.type === 'done') { status = 'done'; updateStatus(); if (['abc', 'tgv2d'].includes(ns.ic)) worker.postMessage({ type: 'exact' }); }
  else if (m.type === 'exact') { exact = m.err; updateStatus(); }
  else if (m.type === 'dossier') { if (dossierPending) { dossierPending(m.dossier); dossierPending = null; } }
  else if (m.type === 'error') { err = m.message; status = 'error'; updateStatus(); }
}
function icParams() { const o = {}; for (const [k] of (ICP[ns.ic] || [])) if (ns.icp[k] != null && Number.isFinite(ns.icp[k])) o[k] = ns.icp[k]; return o; }
function opts() { return { N: ns.N, Re: Re(), ic: ns.ic, icParams: icParams(), cfl: ns.cfl, dt: ns.dtFixed > 0 ? ns.dtFixed : 0 }; }
function start() {
  if (!worker) makeWorker();
  err = ''; status = 'running'; stale = false; prog = null; out = null; sliceData = null; health = null; study = null; levels = []; exact = null; init0 = null; sliceKey = '';
  let studyMsg = null;
  if (ns.studyKind === 'grid') { const Ns = ns.gridLadder.split(/[,\s]+/).map(Number).filter(n => n >= 4 && n % 2 === 0); if (Ns.length > 1) studyMsg = { kind: 'grid', levels: Ns.map(N => ({ label: `${N}³`, N })) }; }
  else if (ns.studyKind === 'time') { const dts = ns.dtLadder.split(/[,\s]+/).map(Number).filter(d => d > 0); if (dts.length > 1) studyMsg = { kind: 'time', levels: dts.map(dt => ({ label: `Δt ${dt}`, N: ns.N, dt })) }; }
  worker.postMessage({ type: 'start', opts: opts(), tEnd: ns.tEnd, outEvery: ns.outEvery, field: ns.field, axis: ns.axis, slice: ns.slice, study: studyMsg });
  updateStatus(); updateTiles(); drawCp(); drawPolar();
}
function pause() { if (worker && status === 'running') { worker.postMessage({ type: 'pause' }); status = 'paused'; updateStatus(); } }
function resume() { if (worker && status === 'paused') { worker.postMessage({ type: 'resume' }); status = 'running'; updateStatus(); } }
function reset() { if (worker) { worker.terminate(); worker = null; } status = 'idle'; prog = null; out = null; sliceData = null; health = null; study = null; levels = []; renderHealth(); updateStatus(); updateTiles(); drawCp(); drawPolar(); S.redraw(); }
function markStale() { stale = true; updateStatus(); }
function requestSlice() { if (worker && status !== 'idle') worker.postMessage({ type: 'view', field: ns.field, axis: ns.axis, slice: ns.slice }); }

// ------------------------------------------------------------------ rendering
function fieldRange(kind, data) {
  const n = data.length, sorted = Float32Array.from(data).sort(), pct = q => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))];
  if (SIGNED[kind]) { const a = Math.max(Math.abs(pct(0.005)), Math.abs(pct(0.995)), 1e-12); return [-a, a]; }
  return [0, Math.max(pct(0.998), 1e-12)];
}
function renderSlice() {
  if (!sliceData) return null;
  const N = sliceN, key = `${N}|${sliceInfo && sliceInfo.field}|${out ? out.step : 0}|${sliceData.length}`;
  if (sliceKey === key && sliceCanvas) return sliceCanvas;
  sliceKey = key;
  if (!sliceCanvas) sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = N; sliceCanvas.height = N;
  const c = sliceCanvas.getContext('2d'), img = c.createImageData(N, N), d = img.data, kind = sliceInfo ? sliceInfo.field : ns.field;
  const [lo, hi] = fieldRange(kind, sliceData); sliceCanvas.range = [lo, hi]; const inv = 1 / (hi - lo || 1), cmap = SIGNED[kind] ? diverge : viridis;
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {   // row b (second coordinate) drawn upward: image row = N − 1 − b
    const t = Math.max(0, Math.min(1, (sliceData[b * N + a] - lo) * inv)), col = cmap(t), p = ((N - 1 - b) * N + a) * 4;
    d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return sliceCanvas;
}
function sliceRect() { const { W, H } = S.view; const side = Math.min(W - 60, H - 110); return { x: (W - side) / 2, y: 78 + (H - 110 - side) / 2, side }; }
function draw(ctx) {
  const { W, H } = S.view;
  ctx.fillStyle = '#0e141c'; ctx.fillRect(0, 0, W, H);
  const sc = renderSlice(), r = sliceRect();
  if (sc) { ctx.imageSmoothingEnabled = true; ctx.drawImage(sc, r.x, r.y, r.side, r.side); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.side, r.side); }
  else { ctx.fillStyle = '#5b6b80'; ctx.font = '13px ' + S.sans(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(status === 'idle' ? 'NSLab — set up the experiment and press Run' : 'waiting for the first snapshot…', W / 2, H / 2); ctx.textAlign = 'left'; }
  // axes labels for the slice
  ctx.font = '11px ' + S.mono(); ctx.fillStyle = '#8a9bb0'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  if (sc) { const ax = sliceInfo ? sliceInfo.axis : ns.axis, h = ax === 'z' ? 'x' : ax === 'y' ? 'x' : 'y', v = ax === 'z' ? 'y' : ax === 'y' ? 'z' : 'z';
    ctx.fillText(`${h} = 0`, r.x, r.y + r.side + 4); ctx.textAlign = 'right'; ctx.fillText(`${h} = 2π`, r.x + r.side, r.y + r.side + 4); ctx.textAlign = 'left';
    ctx.save(); ctx.translate(r.x - 6, r.y + r.side); ctx.rotate(-Math.PI / 2); ctx.fillText(`${v} = 0 … 2π ↑`, 0, -12); ctx.restore(); }
  // HUD
  const icn = NS.IC_INFO[ns.ic] ? NS.IC_INFO[ns.ic].name : ns.ic;
  const l1 = `NSLab · ${icn} · ${init0 ? init0.N : ns.N}³ (kmax ${init0 ? init0.kc : Math.floor(ns.N / 3)}) · Re ${Re().toLocaleString()} · ν ${(1 / Re()).toExponential(2)} · RK4 ${ns.dtFixed > 0 ? 'Δt ' + ns.dtFixed : 'CFL ' + ns.cfl}` + (study || (prog && prog.nLevels > 1) ? ` · study level ${prog ? prog.level : ''}` : '');
  const l2 = prog ? `t ${prog.t.toFixed(3)} / ${ns.tEnd}   step ${prog.step}   Δt ${prog.dt.toExponential(2)}   ${prog.elapsed.toFixed(0)} s (${prog.step ? (1000 * prog.elapsed / prog.step).toFixed(0) : '—'} ms/step)` : 'no run yet — press Run';
  const l3 = prog ? `E ${prog.E.toExponential(4)}   Z ${prog.Z.toFixed(4)}   ε ${prog.eps.toExponential(3)}   max|ω| ${prog.omMax.toFixed(3)}   ⟨ω·S·ω⟩ ${prog.Pspec.toExponential(3)}   health ${health ? health.worst : '—'}` : '';
  ctx.fillStyle = 'rgba(8,12,18,0.7)'; ctx.fillRect(8, 8, Math.min(760, W - 16), 54);
  ctx.fillStyle = '#d7e2ef'; ctx.font = '12px ' + S.mono(); ctx.fillText(l1, 14, 13); ctx.fillText(l2, 14, 29); ctx.fillText(l3, 14, 45);
  if (stale && status !== 'idle') { ctx.fillStyle = 'rgba(244,162,97,0.9)'; ctx.font = 'bold 12px ' + S.sans(); ctx.fillText('⚠ settings changed since this run — press Run to recompute', 14, 66); }
  if (status === 'error') { ctx.fillStyle = '#ff8fa8'; ctx.font = 'bold 12px ' + S.sans(); ctx.fillText('✖ ' + err, 14, 66); }
  // legend
  if (sc && sc.range) {
    const lw = 150, lh = 10, lx = W - 20 - lw, ly = 14, kind = sliceInfo ? sliceInfo.field : ns.field, cmap = SIGNED[kind] ? diverge : viridis;
    for (let i = 0; i < lw; i++) { ctx.fillStyle = rgb(cmap(i / (lw - 1))); ctx.fillRect(lx + i, ly, 1.2, lh); }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(lx, ly, lw, lh);
    ctx.font = '11px ' + S.mono(); ctx.fillStyle = '#d7e2ef'; ctx.textAlign = 'left'; ctx.fillText(sc.range[0].toPrecision(3), lx, ly + lh + 3); ctx.textAlign = 'right'; ctx.fillText(sc.range[1].toPrecision(3), lx + lw, ly + lh + 3);
    ctx.textAlign = 'center'; ctx.fillText(`${FIELD[kind] || kind} · plane ${sliceInfo ? sliceInfo.axis : ns.axis} = ${((sliceInfo ? sliceInfo.index : ns.slice) * 2 * Math.PI / sliceN).toFixed(2)}`, lx + lw / 2, ly + lh + 16); ctx.textAlign = 'left';
  }
  if (health && health.worst !== 'PASS') { ctx.fillStyle = health.worst === 'FAIL' ? '#ff8fa8' : '#f4a261'; ctx.font = 'bold 12px ' + S.sans(); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`verification ${health.worst} — see the health report; no feature of this run is evidence until it passes`, 14, H - 12); }
}

// ------------------------------------------------------------------ plots
const stepOf = span => { const raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-12)))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
function drawCp() {   // left plot: dissipation ε(t) and max |ω| — the two quantities a regularity argument must control
  const f = S.plotFrame(S.$('cpPlot')), { c } = f;
  const ser = prog && prog.series; if (!ser || ser.t.length < 2) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText(status === 'idle' ? 'press Run to start the experiment' : 'waiting for data…', f.W / 2, f.H / 2); return; }
  const om0 = ser.omMax[0] || 1; let emax = 0, omax = 0; for (let i = 0; i < ser.t.length; i++) { emax = Math.max(emax, ser.eps[i]); omax = Math.max(omax, ser.omMax[i] / om0); }
  const ref = ns.ic === 'tgv' && Math.abs(Re() - 1600) < 1 ? REF.tgv1600 : null;
  if (ref) emax = Math.max(emax, ref.eps[1]);
  const ymax = Math.max(emax * 1.15, 1e-6), { X, Y } = S.axes(f, 0, Math.max(ns.tEnd, ser.t[ser.t.length - 1]), 0, ymax, 't', 'ε · max|ω| (scaled)', stepOf(ns.tEnd), stepOf(ymax));
  if (ref) { c.fillStyle = 'rgba(6,214,160,0.15)'; c.fillRect(X(0), Y(ref.eps[1]), X(ns.tEnd) - X(0), Y(ref.eps[0]) - Y(ref.eps[1])); S.polyline(c, [[X(ref.t), f.pad.t], [X(ref.t), f.H - f.pad.b]], 'rgba(6,214,160,0.5)', 1, [3, 3]); c.fillStyle = '#06d6a0'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('reference: ' + ref.label, f.W - f.pad.r - 2, Y(ref.eps[0]) + 3); }
  const sc = ymax / Math.max(omax, 1e-9) * 0.9;
  S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.eps[i])]), '#f4a261', 1.6);
  S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.omMax[i] / om0 * sc)]), '#4cc9f0', 1.4);
  c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(`max|ω| peak ${Math.max(...ser.omMax).toFixed(3)} (×${(Math.max(...ser.omMax) / om0).toFixed(2)}) · ε peak ${Math.max(...ser.eps).toExponential(3)}`, f.W - f.pad.r - 2, f.H - f.pad.b - 4);
}
function drawPolar() {
  const f = S.plotFrame(S.$('polarPlot')), { c } = f, tab = S.state.polarTab;
  const ser = prog && prog.series;
  const none = msg => { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText(msg, f.W / 2, f.H / 2); };
  if (tab === 'series') {
    if (!ser || ser.t.length < 2) return none('no data yet');
    const E0 = ser.E[0] || 1, Z0 = ser.Z[0] || 1; let zmax = 0; for (const z of ser.Z) zmax = Math.max(zmax, z / Z0);
    const ymax = Math.max(1.05, zmax * 1.05), { X, Y } = S.axes(f, 0, Math.max(ns.tEnd, ser.t[ser.t.length - 1]), 0, ymax, 't', 'E/E₀ (cyan) · Z/Z₀ (amber)', stepOf(ns.tEnd), stepOf(ymax));
    S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.E[i] / E0)]), '#4cc9f0', 1.6); S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.Z[i] / Z0)]), '#f4a261', 1.6);
    c.fillStyle = '#d7e2ef'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`E₀ ${E0.toExponential(4)}  Z₀ ${Z0.toExponential(4)}  E ${ser.E[ser.E.length - 1].toExponential(4)}`, f.W - f.pad.r - 2, f.pad.t + 2);
  } else if (tab === 'enst') {
    if (!ser || ser.t.length < 2) return none('no data yet');
    const nu = 1 / Re(); let vmax = 1e-12; for (let i = 0; i < ser.t.length; i++) vmax = Math.max(vmax, Math.abs(ser.Pspec[i]), 2 * nu * ser.Pal[i]);
    const { X, Y } = S.axes(f, 0, Math.max(ns.tEnd, ser.t[ser.t.length - 1]), -vmax * 0.2, vmax * 1.1, 't', 'dZ/dt budget: ⟨ω·S·ω⟩ (cyan) · 2νP viscous (amber) · net (white)', stepOf(ns.tEnd), stepOf(vmax));
    S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.Pspec[i])]), '#4cc9f0', 1.5); S.polyline(c, ser.t.map((t, i) => [X(t), Y(2 * nu * ser.Pal[i])]), '#f4a261', 1.5);
    S.polyline(c, ser.t.map((t, i) => [X(t), Y(ser.Pspec[i] - 2 * nu * ser.Pal[i])]), 'rgba(255,255,255,0.6)', 1, [3, 3]);
    if (out) { c.fillStyle = '#d7e2ef'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`at t ${out.t.toFixed(2)}: spectral ${out.Pspec.toExponential(3)} · physical ⟨ω·S·ω⟩ ${out.Pphys.toExponential(3)}`, f.W - f.pad.r - 2, f.pad.t + 2); }
  } else if (tab === 'spec') {
    if (!out || !out.spectrum) return none('no spectrum yet');
    const Ek = out.spectrum, pts = []; let lmin = 0, lmax = -30;
    for (let k = 1; k < Ek.length; k++) if (Ek[k] > 0) { const v = Math.log10(Ek[k]); pts.push([Math.log10(k), v]); lmin = Math.min(lmin, v); lmax = Math.max(lmax, v); }
    if (!pts.length) return none('spectrum is empty');
    lmin = Math.max(lmin, lmax - 16);
    const xmax = Math.log10(Ek.length), { X, Y } = S.axes(f, 0, xmax, Math.floor(lmin) - 0.5, Math.ceil(lmax) + 0.5, 'log₁₀ k', 'log₁₀ E(k)', 0.5, 2);
    S.polyline(c, pts.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.6);
    const k0 = Math.log10(4), e0 = pts.length > 3 ? pts[Math.min(pts.length - 1, 3)][1] : lmax;
    S.polyline(c, [[X(k0), Y(e0)], [X(xmax), Y(e0 - 5 / 3 * (xmax - k0))]], 'rgba(255,255,255,0.35)', 1, [4, 4]);
    c.fillStyle = '#5b6b80'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`t ${out.t.toFixed(2)} · dashed k^(−5/3) guide · kmax·η ${out.kmaxEta.toFixed(2)}`, f.W - f.pad.r - 2, f.pad.t + 2);
  } else if (tab === 'study') {
    if (!levels.length) return none(ns.studyKind === 'none' ? 'choose a grid or time-step study in the sidebar and press Run' : 'refinement study running — levels appear as they finish');
    let emax = 0, tmax = 0; for (const L of levels) { for (const e of L.series.eps) emax = Math.max(emax, e); tmax = Math.max(tmax, L.series.t[L.series.t.length - 1]); }
    const { X, Y } = S.axes(f, 0, tmax, 0, emax * 1.15, 't', 'ε(t) per level', stepOf(tmax), stepOf(emax));
    const cols = ['#5b6b80', '#8a9bb0', '#f4a261', '#4cc9f0', '#06d6a0', '#a78bfa'];
    levels.forEach((L, i) => { const col = cols[Math.min(cols.length - 1, i + Math.max(0, cols.length - levels.length))]; S.polyline(c, L.series.t.map((t, j) => [X(t), Y(L.series.eps[j])]), col, i === levels.length - 1 ? 2 : 1.2); c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(`${L.label}: ε peak ${L.epsPeak.v.toExponential(3)} @ t ${L.epsPeak.t.toFixed(2)} · max|ω| ${L.peak.omMax.toFixed(2)} · ${L.health}`, f.pad.l + 6, f.pad.t + 16 + 13 * i); });
    if (study) { const s = study.grid || study.time; if (s) { const r = s.rows[s.rows.length - 1]; c.fillStyle = s.verdict === 'PASS' ? '#06d6a0' : s.verdict === 'WARN' ? '#f4a261' : '#ff8fa8'; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(`${s.verdict}${s.order != null ? ' · observed order ' + s.order.toFixed(2) : ''}`, f.W - f.pad.r - 2, f.H - f.pad.b - 17);
      c.fillText(`${r.from} → ${r.to}: Δ max|ω| ${(r.omMax * 100).toFixed(1)} % · Δ ε_peak ${(r.eps * 100).toFixed(1)} % · Δ E(t_end) ${(r.Eend * 100).toFixed(2)} %`, f.W - f.pad.r - 2, f.H - f.pad.b - 4); } }
  } else if (tab === 'align') {
    if (!out || !out.alignHist) return none('no alignment statistics yet');
    const h = out.alignHist, nb = h[0].length; let pmax = 0; for (const a of h) for (const v of a) pmax = Math.max(pmax, v);
    const { X, Y } = S.axes(f, 0, 1, 0, pmax * 1.15 * nb, '|cos θ| between ω and strain eigenvectors', 'PDF (e₁ amber, e₂ cyan, e₃ violet)', 0.2, stepOf(pmax * nb));
    [['#f4a261', 0], ['#4cc9f0', 1], ['#a78bfa', 2]].forEach(([col, e]) => S.polyline(c, Array.from(h[e], (v, i) => [X((i + 0.5) / nb), Y(v * nb)]), col, 1.6));
    c.fillStyle = '#d7e2ef'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`mean |cos|: e₁ ${out.align[0].toFixed(3)} · e₂ ${out.align[1].toFixed(3)} · e₃ ${out.align[2].toFixed(3)}  (isotropic 0.5; turbulence favours e₂)`, f.W - f.pad.r - 2, f.pad.t + 2);
  }
}

// ------------------------------------------------------------------ tiles, status, health
function updateTiles() {
  const t = S.setTile, p = prog, o = out;
  t('t', p ? p.t.toFixed(3) : '—', '', `of ${ns.tEnd}`); t('E', p ? p.E.toExponential(4) : '—', ''); t('Z', p ? p.Z.toFixed(4) : '—', ''); t('eps', p ? p.eps.toExponential(3) : '—', '');
  t('om', p ? p.omMax.toFixed(3) : '—', '', p && p.series && p.series.omMax.length ? `×${(p.omMax / (p.series.omMax[0] || 1)).toFixed(2)} of initial` : 'L∞ vorticity');
  t('stretch', p ? p.Pspec.toExponential(3) : '—', '', o ? `physical ${o.Pphys.toExponential(3)}` : '⟨ω·S·ω⟩');
  t('keta', o ? o.kmaxEta.toFixed(2) : '—', o ? (o.kmaxEta >= 1 ? 'good' : o.kmaxEta >= 0.5 ? 'warn' : 'bad') : '', o ? `η ${o.eta.toExponential(2)}` : 'resolution (≥ 1)');
  t('rel', o ? o.Rel.toFixed(1) : '—', '', o ? `λ ${o.lambda.toFixed(3)}` : 'Taylor microscale'); t('skew', o ? o.skewIso.toFixed(3) : '—', '', o ? `direct ⟨(∂u/∂x)³⟩ form ${o.skew.toFixed(3)}` : 'isotropic relation');
  t('align', o ? o.align[1].toFixed(3) : '—', '', o ? `e₁ ${o.align[0].toFixed(2)} · e₃ ${o.align[2].toFixed(2)}` : 'strain alignment');
  t('dt', p ? p.dt.toExponential(2) : '—', '', ns.dtFixed > 0 ? 'fixed' : `adaptive, CFL ${ns.cfl}`); t('steps', p ? p.step : '—', '', status);
  t('health', health ? health.worst : '—', health ? (health.worst === 'PASS' ? 'good' : health.worst === 'WARN' ? 'warn' : 'bad') : '', health ? `${health.rows.filter(r => r[2] === 'FAIL').length} fail · ${health.rows.filter(r => r[2] === 'WARN').length} warn` : 'verification');
  t('speed', p && p.step ? (1000 * p.elapsed / p.step).toFixed(0) : '—', '', 'ms per step');
}
function updateStatus() {
  const el = S.$('nStatus'); if (!el) return;
  let msg = status === 'idle' ? 'Idle — set up the experiment and press Run.' : status === 'running' ? `Running… t = ${prog ? prog.t.toFixed(2) : 0}` + (prog && prog.nLevels > 1 ? ` (level ${prog.levelIdx + 1}/${prog.nLevels}: ${prog.level})` : '') : status === 'paused' ? 'Paused.' : status === 'done' ? ('✓ Finished.' + (exact ? ` Exact-solution L∞ error ${exact.linf.toExponential(2)}.` : '') + (health ? ` Verification: ${health.worst}.` : '')) : '✖ ' + err;
  el.textContent = msg; el.style.color = status === 'error' ? 'var(--red)' : status === 'done' ? (health && health.worst === 'FAIL' ? 'var(--amber)' : 'var(--green)') : 'var(--muted)';
  S.$('nRun').textContent = status === 'running' ? 'Restart' : 'Run';
  S.$('nPause').textContent = status === 'running' ? 'Pause' : 'Continue';
  S.$('nPause').disabled = !(status === 'running' || status === 'paused');
}
function renderHealth() {
  const el = S.$('nHealth'); if (!el) return;
  if (!health) { el.innerHTML = '<div class="note">No run yet. Every run is graded before any feature in it is believed.</div>'; return; }
  el.innerHTML = health.rows.map(r => `<div class="hrow"><span class="hk">${r[0]}</span><span class="hv">${r[1]}</span><span class="hg ${r[2] ? r[2].toLowerCase() : ''}">${r[2] || ''}</span></div>`).join('') + `<div class="note" style="margin-top:6px">${health.note}</div>`;
}

// ------------------------------------------------------------------ hover, export, controls
function hover(sx, sy) {
  if (!sliceData) return null;
  const r = sliceRect(), N = sliceN; if (sx < r.x || sx > r.x + r.side || sy < r.y || sy > r.y + r.side) return null;
  const a = Math.min(N - 1, Math.floor((sx - r.x) / r.side * N)), b = Math.min(N - 1, Math.floor((1 - (sy - r.y) / r.side) * N));
  const ax = sliceInfo ? sliceInfo.axis : ns.axis, h = ax === 'x' ? 'y' : 'x', v = ax === 'z' ? 'y' : 'z';
  return `${FIELD[sliceInfo ? sliceInfo.field : ns.field]} = ${sliceData[b * N + a].toPrecision(4)} at ${h} = ${(a * 2 * Math.PI / N).toFixed(3)}, ${v} = ${(b * 2 * Math.PI / N).toFixed(3)} (cell ${a}, ${b})`;
}
function exportData(kind) {
  const tag = `${ns.ic}_N${ns.N}_Re${Re()}`;
  if (kind === 'cp') {
    const ser = prog && prog.series; if (!ser) return;
    let s = `# NSLab ${tag} time series (box 2π, U 1, Re = 1/nu)\nt,E,Z,eps,omMax,uMax,dt,Pspec,Pal\n`;
    for (let i = 0; i < ser.t.length; i++) s += `${ser.t[i].toFixed(6)},${ser.E[i].toExponential(8)},${ser.Z[i].toExponential(8)},${ser.eps[i].toExponential(8)},${ser.omMax[i].toExponential(6)},${ser.uMax[i].toExponential(6)},${ser.dt[i].toExponential(4)},${ser.Pspec[i].toExponential(6)},${ser.Pal[i].toExponential(6)}\n`;
    S.download(`NSLab_series_${tag}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'polar') {
    if (!out) return;
    let s = `# NSLab ${tag} energy spectrum at t = ${out.t}\nk,E(k)\n`; out.spectrum.forEach((e, k) => { s += `${k},${e.toExponential(8)}\n`; });
    S.download(`NSLab_spectrum_${tag}_t${out.t.toFixed(2)}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'bl') {
    if (!worker || status === 'idle') return;
    dossierPending = d => S.download(`NSLab_dossier_${tag}.json`, new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }));
    worker.postMessage({ type: 'dossier' });
  }
}
function syncSlider(s) { const el = S.$(s.id); if (!el) return; if (s.key === 'slice') { el.max = String(Math.max(0, ns.N - 1)); ns.slice = Math.min(ns.slice, ns.N - 1); } el.value = ns[s.key]; S.$(s.id + 'Out').textContent = s.out(ns[s.key]); }
function syncIcParams() {
  const list = ICP[ns.ic] || []; S.$('nIcNote').textContent = NS.IC_INFO[ns.ic] ? NS.IC_INFO[ns.ic].desc : '';
  for (let i = 0; i < 4; i++) { const row = S.$('nP' + i + 'Row'), inp = S.$('nP' + i), lab = S.$('nP' + i + 'L'); if (!row) continue; const p = list[i]; row.style.display = p ? '' : 'none'; if (p) { lab.textContent = p[1]; if (ns.icp[p[0]] == null) ns.icp[p[0]] = p[2]; inp.value = ns.icp[p[0]]; inp.dataset.key = p[0]; } }
}
function wire() {
  for (const s of SL) { const el = S.$(s.id); el.addEventListener('input', () => { ns[s.key] = parseFloat(el.value); S.$(s.id + 'Out').textContent = s.out(ns[s.key]); if (s.key === 'slice') requestSlice(); else if (s.key === 'tEnd' && status !== 'idle') { /* harmless */ } else markStale(); }); syncSlider(s); }
  S.$('nIc').addEventListener('change', e => { ns.ic = e.target.value; syncIcParams(); markStale(); });
  for (let i = 0; i < 4; i++) { const inp = S.$('nP' + i); if (inp) inp.addEventListener('change', () => { ns.icp[inp.dataset.key] = parseFloat(inp.value); markStale(); }); }
  S.$('nN').addEventListener('change', e => { ns.N = +e.target.value; syncSlider(SL[3]); markStale(); });
  S.$('nDt').addEventListener('change', e => { ns.dtFixed = Math.max(0, parseFloat(e.target.value) || 0); markStale(); });
  S.$('nOut').addEventListener('change', e => { ns.outEvery = +e.target.value; markStale(); });
  S.$('nField').addEventListener('change', e => { ns.field = e.target.value; requestSlice(); });
  S.$('nAxis').addEventListener('change', e => { ns.axis = e.target.value; requestSlice(); });
  S.$('nStudy').addEventListener('change', e => { ns.studyKind = e.target.value; S.$('nGridRow').style.display = ns.studyKind === 'grid' ? '' : 'none'; S.$('nDtRow').style.display = ns.studyKind === 'time' ? '' : 'none'; markStale(); });
  S.$('nGrid').addEventListener('change', e => { ns.gridLadder = e.target.value; markStale(); });
  S.$('nDtLadder').addEventListener('change', e => { ns.dtLadder = e.target.value; markStale(); });
  S.$('nRun').addEventListener('click', start);
  S.$('nPause').addEventListener('click', () => { if (status === 'running') pause(); else resume(); });
  S.$('nReset').addEventListener('click', reset);
  syncIcParams(); renderHealth();
}
function set(patch) {
  if (Number.isFinite(patch.N) && [8, 12, 16, 24, 32, 48, 64, 96, 128].includes(+patch.N)) { ns.N = +patch.N; S.$('nN').value = String(ns.N); syncSlider(SL[3]); }
  if (Number.isFinite(patch.Re) && patch.Re >= 1 && patch.Re <= 1e5) { ns.logRe = Math.log10(patch.Re); syncSlider(SL[0]); }
  if (patch.ic && NS.IC_INFO[patch.ic]) { ns.ic = patch.ic; S.$('nIc').value = patch.ic; syncIcParams(); }
  if (Number.isFinite(patch.tEnd) && patch.tEnd > 0 && patch.tEnd <= 100) { ns.tEnd = patch.tEnd; syncSlider(SL[2]); }
  if (Number.isFinite(patch.cfl) && patch.cfl > 0.05 && patch.cfl <= 0.8) { ns.cfl = patch.cfl; syncSlider(SL[1]); }
  if (patch.study && ['none', 'grid', 'time'].includes(patch.study)) { ns.studyKind = patch.study; S.$('nStudy').value = patch.study; S.$('nGridRow').style.display = ns.studyKind === 'grid' ? '' : 'none'; S.$('nDtRow').style.display = ns.studyKind === 'time' ? '' : 'none'; }
  if (patch.icParams && typeof patch.icParams === 'object') { Object.assign(ns.icp, patch.icParams); syncIcParams(); }
  markStale();
}
function waitForDone(ms) { return new Promise(resolve => { const t0 = Date.now(); const tick = () => { if (status !== 'running' || Date.now() - t0 > ms) { if (status === 'running') pause(); resolve({ status, prog, out, health, study, levels }); } else setTimeout(tick, 250); }; tick(); }); }
function summary() {
  const r3 = v => (Number.isFinite(v) ? +v.toPrecision(4) : null);
  if (!prog) return null;
  const ser = prog.series, om0 = ser.omMax[0] || 1; let ip = 0, io = 0; for (let i = 0; i < ser.t.length; i++) { if (ser.eps[i] > ser.eps[ip]) ip = i; if (ser.omMax[i] > ser.omMax[io]) io = i; }
  return { t: r3(prog.t), steps: prog.step, E: r3(prog.E), enstrophy: r3(prog.Z), dissipation: r3(prog.eps), max_vorticity: r3(prog.omMax), max_vorticity_growth_factor: r3(prog.omMax / om0), peak_dissipation: r3(ser.eps[ip]), peak_dissipation_time: r3(ser.t[ip]), peak_max_vorticity: r3(ser.omMax[io]), peak_max_vorticity_time: r3(ser.t[io]),
    stretching_spectral: r3(prog.Pspec), stretching_physical: out ? r3(out.Pphys) : null, kmax_eta: out ? r3(out.kmaxEta) : null, Re_lambda: out ? r3(out.Rel) : null, skewness_from_enstrophy_production: out ? r3(out.skewIso) : null, skewness_direct: out ? r3(out.skew) : null, alignment_mean_abs_cos_e1_e2_e3: out ? out.align.map(r3) : null,
    verification: health ? { overall: health.worst, rows: health.rows.map(r => ({ check: r[0], value: r[1], grade: r[2] || null })) } : null,
    refinement_study: study ? (study.grid || study.time) : null, refinement_levels: levels.length ? levels.map(L => ({ level: L.label, peak_dissipation: r3(L.epsPeak.v), peak_time: r3(L.epsPeak.t), peak_max_vorticity: r3(L.peak.omMax), E_end: r3(L.Eend), health: L.health })) : null,
    exact_solution_error: exact ? r3(exact.linf) : null,
    caveat: 'Numerical evidence only; nothing here proves regularity or blow-up. A feature is not even a conjecture until the health report passes and it survives grid and time-step refinement.' };
}
function init(shared) { S = shared; wire(); }
function tabsHtml() { return POLAR_TABS.map(([k, l], i) => `<button data-tab="${k}" class="${i === 0 ? 'active' : ''}">${l}</button>`).join(''); }
function onViewChanged() { sliceKey = ''; }

return { init, set, waitForDone, summary, ns, TILES, tabsHtml, draw, drawCp, drawPolar, hover, exportData, onViewChanged, start, pause, reset, get status() { return status; }, get stale() { return stale; }, get progress() { return prog; }, get health() { return health; } };
})();
