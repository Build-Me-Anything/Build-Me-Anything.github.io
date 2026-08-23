/* Pocket Wind Tunnel — hypersonic mode UI. Depends on HT (hyper.js) and the shared helpers injected by app.js. */
const HyperUI = (() => {
'use strict';
const DEG = Math.PI / 180;
const hs = { M: 6, alt: 30000, alpha: 5, chord: 2, gamma: 1.4, Tw: 600, method: 'se', bl: 'trans', RexTr: 2e6, rnOverride: null, colour: 'cp', machLines: true };
let S = null, an = null, polar = null, polarTimer = null;
const SL = [
  { id: 'hM', key: 'M', out: v => 'M ' + v.toFixed(1) },
  { id: 'hAlt', key: 'alt', out: v => (v / 1000).toFixed(1) + ' km · ' + (v * 3.28084 / 1000).toFixed(0) + ' kft' },
  { id: 'hAlpha', key: 'alpha', out: v => v.toFixed(1) + '°' },
  { id: 'hChord', key: 'chord', out: v => v.toFixed(1) + ' m' },
  { id: 'hGamma', key: 'gamma', out: v => v.toFixed(2) },
  { id: 'hTw', key: 'Tw', out: v => v.toFixed(0) + ' K · ' + (v - 273.15).toFixed(0) + ' °C' },
];
const TILES = [
  ['cl', 'Cl', 'lift coefficient'], ['cd', 'Cd total', 'wave + friction'], ['cdw', 'Cd wave', 'pressure drag'], ['cdf', 'Cd friction', 'reference-T method'],
  ['ld', 'L / D', 'lift-to-drag'], ['cm', 'Cm c/4', 'pitching moment'], ['lift', 'Lift', 'N per m span'], ['drag', 'Drag', 'N per m span'],
  ['q', 'q∞', 'dynamic pressure'], ['re', 'Reynolds', 'ρ V c / μ'], ['kn', 'Knudsen', 'λ / c'],
  ['t0', 'T₀', 'perfect-gas stagnation'], ['p02', 'p₀₂', 'pitot pressure'], ['shu', 'LE shock U', 'wave angle'], ['shl', 'LE shock L', 'wave angle'],
  ['qs', 'q stagnation', 'Sutton–Graves (cyl.)'], ['qmax', 'q max (surface)', 'reference-T'], ['heat', 'Heat load', 'W per m span'],
];
const POLAR_TABS = [['cla', 'Cl–α'], ['clcd', 'Cl–Cd'], ['lda', 'L/D–α'], ['cma', 'Cm–α'], ['heat', 'Heat flux'], ['corr', 'Corridor']];

// colour ramps
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops) { const s = stops.map(([v, c]) => [v, hex(c)]); return t => {
  if (!(t > s[0][0])) return s[0][1]; if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const f = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), a = s[i - 1][1], b = s[i][1]; return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])]; }
  return s[0][1]; }; }
const thermal = ramp([[0, '#101418'], [0.25, '#5a1030'], [0.5, '#c42a2a'], [0.75, '#ff9a2e'], [1, '#fff2a8']]);
const diverge = ramp([[-1, '#3b82f6'], [0, '#2a3544'], [1, '#ff5a36']]);
const machRamp = ramp([[0, '#1a0b3a'], [0.3, '#3a2a8a'], [0.6, '#2b8fb8'], [0.85, '#4fd1a0'], [1, '#f5e663']]);
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function cond() { return { M: hs.M, altitude: hs.alt, alpha: hs.alpha, chord: hs.chord, gamma: hs.gamma, Tw: hs.Tw, method: hs.method, bl: hs.bl, RexTr: hs.RexTr, rnOverride: hs.rnOverride }; }
function recompute() {
  try { an = HT.analyse(S.geo(), cond()); } catch (e) { console.error(e); return; }
  updateTiles(); drawCp(); drawPolar();
  clearTimeout(polarTimer); polarTimer = setTimeout(() => { polar = HT.sweep(S.geo(), cond(), -10, 30, 1); drawPolar(); }, 120);
}
function onGeometryChanged() { polar = null; recompute(); }

// ------------------------------------------------------------------ colour scale for the surface band
function scale() {
  const g = an.gamma, M = an.M, vac = 2 / (g * M * M);
  switch (hs.colour) {
    case 'p': { const hi = Math.log10(an.p02 / an.atm.p); return { title: 'p / p∞ (log)', lo: '0.1', hi: (an.p02 / an.atm.p).toFixed(0), f: (inv, v, k) => thermal((Math.log10(Math.max(inv.pp[k], 0.1)) + 1) / (hi + 1)) }; }
    case 'q': { const qm = Math.max(an.heat.qMax, 1); return { title: 'wall heat flux q̇ (kW/m²)', lo: '0', hi: (qm / 1000).toFixed(qm > 1e4 ? 0 : 1), f: (inv, v, k) => thermal(v.qw[k] / qm) }; }
    case 'M': { const hi = M * 1.3; return { title: 'local Mach', lo: '0', hi: hi.toFixed(1), f: (inv, v, k) => machRamp(Math.min(inv.M[k], hi) / hi) }; }
    case 'T': { const lo = an.atm.T, hi = an.T0; return { title: 'edge temperature (K)', lo: lo.toFixed(0), hi: hi.toFixed(0), f: (inv, v, k) => thermal((v.Te[k] - lo) / (hi - lo)) }; }
    default: return { title: 'Cp', lo: (-vac).toFixed(2), hi: an.CpMax.toFixed(2), f: (inv, v, k) => diverge(inv.Cp[k] >= 0 ? inv.Cp[k] / an.CpMax : inv.Cp[k] / vac) };
  }
}

// ------------------------------------------------------------------ drawing
function draw(ctx) {
  const { W, H } = S.view;
  ctx.fillStyle = '#0e141c'; ctx.fillRect(0, 0, W, H);
  if (!an) return;
  const geo = S.geo();
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1; ctx.beginPath();
  const step = 0.25 * S.view.scale;
  for (let x = ((0 - S.view.wx0) * S.view.scale) % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = (S.view.wy0 * S.view.scale) % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  drawWaves(ctx, geo);
  // body
  ctx.beginPath(); let s = S.surfScreen(geo.x[0], geo.y[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 1; i < geo.x.length; i++) { s = S.surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(s[0], s[1]); }
  ctx.closePath(); ctx.fillStyle = '#243142'; ctx.fill();
  drawBand(ctx);
  ctx.beginPath(); s = S.surfScreen(geo.x[0], geo.y[0]); ctx.moveTo(s[0], s[1]);
  for (let i = 1; i < geo.x.length; i++) { s = S.surfScreen(geo.x[i], geo.y[i]); ctx.lineTo(s[0], s[1]); }
  ctx.closePath(); ctx.strokeStyle = 'rgba(215,226,239,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  const le = S.surfScreen(0, 0), te = S.surfScreen(1, 0);
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(le[0], le[1]); ctx.lineTo(te[0], te[1]); ctx.stroke(); ctx.setLineDash([]);
  const qc = S.surfScreen(0.25, 0); ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.arc(qc[0], qc[1], 3, 0, 7); ctx.fill();
  drawHud(ctx);
}
function ray(ctx, x, y, dir, len) { const a = S.surfScreen(x, y), b = S.surfScreen(x + len * Math.cos(dir), y + len * Math.sin(dir)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function drawWaves(ctx, geo) {
  const a = hs.alpha * DEG, M = an.M, g = an.gamma, iLE = an.surf.iLE;
  const lex = geo.x[iLE], ley = geo.y[iLE];
  const shockStyle = () => { ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(255,180,60,0.8)'; ctx.shadowBlur = 8; };
  const fanStyle = () => { ctx.strokeStyle = 'rgba(120,200,255,0.28)'; ctx.lineWidth = 1; ctx.shadowBlur = 0; };
  // leading-edge wave
  if (an.detached && an.rn > 0 && an.billig) {
    const rn = an.rn, d = an.billig.standoff * rn, Rc = an.billig.Rc * rn;
    const e = [Math.cos(a), Math.sin(a)], nn = [-Math.sin(a), Math.cos(a)];
    const C = [lex + rn * e[0], ley + rn * e[1]];
    const betaSide = (side, sgn) => { const pan = sgn > 0 ? an.surf.upper : an.surf.lower; let k = 0; while (k < pan.length - 1 && side.regime[k] === 'N') k++; const th = Math.max(0, sgn * (pan[k].phi - a)); const os = HT.obliqueShock(M, th, g); return os ? os.beta : Math.asin(1 / M); };
    const bu = betaSide(an.upper, +1), bl = betaSide(an.lower, -1);
    shockStyle(); ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const y = -3 + 6 * i / 160, b = y >= 0 ? bu : bl, t = Math.tan(b);
      const xb = rn + d - Rc / (t * t) * (Math.sqrt(1 + y * y * t * t / (Rc * Rc)) - 1);
      const p = S.surfScreen(C[0] - xb * e[0] + y * nn[0], C[1] - xb * e[1] + y * nn[1]);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  } else {
    for (const [side, sgn] of [[an.upper, +1], [an.lower, -1]]) {
      const ls = side.leShock; if (!ls) continue;
      if (ls.expansion) { if (hs.machLines) { fanStyle(); ctx.setLineDash([3, 5]); ray(ctx, lex, ley, a + sgn * Math.asin(1 / M), 2.5); ctx.setLineDash([]); } }
      else if (ls.attached) { shockStyle(); ray(ctx, lex, ley, a + sgn * ls.beta, 3); ctx.shadowBlur = 0; }
    }
  }
  // interior waves from the shock-expansion march
  for (const [side, sgn] of [[an.upper, +1], [an.lower, -1]]) {
    for (const w of side.waves) {
      if (w.k === 0) continue;
      if (w.type === 'shock') { shockStyle(); ray(ctx, w.x, w.y, w.dir, 2); ctx.shadowBlur = 0; }
      else if (hs.machLines && w.M1 > 1.3 && w.s > 0.02 && w.turn > 8 * DEG) { /* fans only at real corners; smooth expansions get sparse Mach lines */ fanStyle(); for (let j = 0; j <= 3; j++) ray(ctx, w.x, w.y, w.dir1 + (w.dir2 - w.dir1) * j / 3, 1.2); }
    }
    if (side.teWave) { shockStyle(); ray(ctx, side.teWave.x, side.teWave.y, side.teWave.dir, 2); ctx.shadowBlur = 0; }
    // sparse Mach lines along smoothly expanding supersonic surfaces
    if (hs.machLines) {
      fanStyle(); const pan = sgn > 0 ? an.surf.upper : an.surf.lower;
      for (let k = 4; k < pan.length; k += 8) if (side.regime[k] === 'E' && side.M[k] > 1.3 && side.M[k] < 60 && pan[k].s > 0.03 && !side.waves.some(w => Math.abs(w.k - k) < 2)) ray(ctx, pan[k].xm, pan[k].ym, pan[k].phi + sgn * Math.asin(1 / side.M[k]), 0.5);
    }
  }
  ctx.shadowBlur = 0;
}
function drawBand(ctx) {
  const sc = scale();
  ctx.lineWidth = 7; ctx.lineCap = 'butt';
  for (const [pan, inv, vis] of [[an.surf.upper, an.upper, an.upperV], [an.surf.lower, an.lower, an.lowerV]]) {
    for (let k = 0; k < pan.length; k++) {
      const a = S.surfScreen(pan[k].x0, pan[k].y0), b = S.surfScreen(pan[k].x1, pan[k].y1);
      ctx.strokeStyle = rgb(sc.f(inv, vis, k)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  // legend
  const { W } = S.view, lw = 150, lh = 10, lx = W - 20 - lw, ly = W < 850 ? 70 : 14;
  for (let i = 0; i < lw; i++) { const t = i / (lw - 1); let c; if (hs.colour === 'cp') c = diverge(t * 2 - 1); else if (hs.colour === 'M') c = machRamp(t); else c = thermal(t); ctx.fillStyle = rgb(c); ctx.fillRect(lx + i, ly, 1.2, lh); }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, lw, lh);
  ctx.font = '11px ' + S.mono(); ctx.fillStyle = '#d7e2ef'; ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.fillText(sc.lo, lx, ly + lh + 3); ctx.textAlign = 'right'; ctx.fillText(sc.hi, lx + lw, ly + lh + 3);
  ctx.textAlign = 'center'; ctx.fillText(sc.title, lx + lw / 2, ly + lh + 16); ctx.textAlign = 'left';
}
function drawHud(ctx) {
  const { W, H } = S.view, atm = an.atm;
  ctx.font = '12px ' + S.mono(); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const knLabel = an.Kn > 10 ? 'free-molecular' : an.Kn > 0.1 ? 'transitional' : an.Kn > 0.01 ? 'slip' : 'continuum';
  const lines = [
    `M ${an.M.toFixed(2)}   V∞ ${an.V.toFixed(0)} m/s (${(an.V * 1.94384).toFixed(0)} kt)   α ${hs.alpha.toFixed(1)}°   h ${(hs.alt / 1000).toFixed(1)} km   c ${hs.chord.toFixed(1)} m`,
    `q∞ ${(an.q / 1000).toFixed(1)} kPa   T∞ ${atm.T.toFixed(0)} K   p∞ ${atm.p < 100 ? atm.p.toFixed(2) : atm.p.toFixed(0)} Pa   ρ∞ ${atm.rho.toExponential(2)} kg/m³   Kn ${an.Kn.toExponential(1)} (${knLabel})`,
    `T₀ ${an.T0.toFixed(0)} K (perfect gas, γ ${an.gamma.toFixed(2)})   p₀₂ ${(an.p02 / 1000).toFixed(1)} kPa   method: ${{ se: 'shock-expansion', wedge: 'tangent-wedge', newton: 'modified Newtonian', newtonClassic: 'classic Newtonian' }[an.method]}`,
  ];
  ctx.fillStyle = 'rgba(8,12,18,0.65)'; ctx.fillRect(8, 8, Math.min(640, W - 16), 54);
  ctx.fillStyle = '#d7e2ef'; lines.forEach((l, i) => ctx.fillText(l, 14, 13 + i * 16));
  let y = 70;
  ctx.font = 'bold 12px ' + S.sans();
  for (const w of an.warnings) { const tw = ctx.measureText('⚠ ' + w).width; ctx.fillStyle = 'rgba(70,45,10,0.85)'; ctx.fillRect(8, y, tw + 14, 21); ctx.strokeStyle = 'rgba(244,162,97,0.7)'; ctx.strokeRect(8.5, y + .5, tw + 13, 20); ctx.fillStyle = '#ffd08a'; ctx.fillText('⚠ ' + w, 15, y + 4); y += 25; }
  // wind arrow + scale bar
  ctx.font = '12px ' + S.mono();
  const yy = H - 30; ctx.strokeStyle = '#4cc9f0'; ctx.fillStyle = '#4cc9f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(14, yy); ctx.lineTo(64, yy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(64, yy); ctx.lineTo(56, yy - 4); ctx.lineTo(56, yy + 4); ctx.closePath(); ctx.fill();
  ctx.fillText('M∞ ' + an.M.toFixed(1), 70, yy - 7);
  const bar = 0.25 * S.view.scale, bx = W - 20 - bar, by = H - 22;
  ctx.strokeStyle = '#d7e2ef'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + bar, by - 4); ctx.lineTo(bx + bar, by + 4); ctx.stroke();
  ctx.fillStyle = '#d7e2ef'; ctx.textAlign = 'center'; ctx.fillText('c/4 = ' + (hs.chord / 4).toFixed(2) + ' m', bx + bar / 2, by - 18); ctx.textAlign = 'left';
}

// ------------------------------------------------------------------ plots
function drawCp() {
  const f = S.plotFrame(S.$('cpPlot')), { c } = f; if (!an) return;
  const up = an.surf.upper.map((p, k) => [p.xm, an.upper.Cp[k]]), lo = an.surf.lower.map((p, k) => [p.xm, an.lower.Cp[k]]);
  const cpmin = Math.min(...up.map(p => p[1]), ...lo.map(p => p[1]));
  const cpmax = Math.max(...up.map(p => p[1]), ...lo.map(p => p[1]));
  const ymax = Math.max(cpmax * 1.25, 0.05), ymin = Math.min(cpmin * 1.25, -0.04 * ymax);
  const span = ymax - ymin, ystep = span > 1.5 ? 0.5 : span > 0.6 ? 0.2 : span > 0.25 ? 0.1 : span > 0.1 ? 0.05 : 0.02;
  const { X, Y } = S.axes(f, 0, 1, ymax, ymin, 'x/c', '−Cp ↑', 0.2, ystep);
  if (an.CpMax <= ymax) { S.polyline(c, [[X(0), Y(an.CpMax)], [X(1), Y(an.CpMax)]], '#ef476f', 1, [5, 4]); c.fillStyle = '#ef476f'; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('Cp,max ' + an.CpMax.toFixed(3), X(1) - 2, Y(an.CpMax) - 1); }
  else { c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('Cp,max ' + an.CpMax.toFixed(3) + ' (off scale)', X(1) - 2, f.pad.t + 2); }
  S.polyline(c, lo.map(p => [X(p[0]), Y(p[1])]), '#f4a261', 1.6);
  S.polyline(c, up.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.6);
}
function drawPolar() {
  const f = S.plotFrame(S.$('polarPlot')), { c } = f; if (!an) return;
  const tab = S.state.polarTab;
  if (tab === 'heat') return drawHeat(f);
  if (tab === 'corr') return drawCorridor(f);
  if (!polar) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText('computing…', f.W / 2, f.H / 2); return; }
  const get = { cla: r => [r.alpha, r.Cl], clcd: r => [r.Cd, r.Cl], lda: r => [r.alpha, r.LD], cma: r => [r.alpha, r.Cm] }[tab] || (r => [r.alpha, r.Cl]);
  const lab = { cla: ['α (°)', 'Cl'], clcd: ['Cd', 'Cl'], lda: ['α (°)', 'L/D'], cma: ['α (°)', 'Cm c/4'] }[tab] || ['α (°)', 'Cl'];
  const pts = polar.points.map(get).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  let xmin = Math.min(...pts.map(p => p[0])), xmax = Math.max(...pts.map(p => p[0])), ymin = Math.min(...pts.map(p => p[1])), ymax = Math.max(...pts.map(p => p[1]));
  if (tab === 'lda') { ymin = Math.max(ymin, -20); ymax = Math.min(ymax, 40); }
  if (tab === 'clcd') xmin = 0;
  const py = (ymax - ymin) * 0.08 || 0.1; ymin -= py; ymax += py;
  const stepOf = span => { const raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const { X, Y } = S.axes(f, xmin, xmax, ymin, ymax, lab[0], lab[1], stepOf(xmax - xmin), stepOf(ymax - ymin));
  S.polyline(c, pts.filter(p => p[1] >= ymin && p[1] <= ymax).map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.8);
  for (const p of pts) if (p[1] >= ymin && p[1] <= ymax) { c.fillStyle = '#4cc9f0'; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 2, 0, 7); c.fill(); }
  const cur = get(an);
  if (Number.isFinite(cur[0]) && Number.isFinite(cur[1]) && cur[1] >= ymin && cur[1] <= ymax) { c.fillStyle = '#fff'; c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.beginPath(); c.arc(X(cur[0]), Y(cur[1]), 4.5, 0, 7); c.fill(); c.stroke(); }
  if (polar.bestLD) { c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(`best L/D ${polar.bestLD.LD.toFixed(2)} at α ${polar.bestLD.alpha.toFixed(0)}°`, f.W - f.pad.r - 2, f.pad.t + 2); }
}
function drawHeat(f) {
  const { c } = f;
  const up = an.surf.upper.map((p, k) => [p.xm, an.upperV.qw[k] / 1000]), lo = an.surf.lower.map((p, k) => [p.xm, an.lowerV.qw[k] / 1000]);
  const qmax = Math.max(1e-3, an.heat.qMax / 1000) * 1.15;
  const stepOf = span => { const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const { X, Y } = S.axes(f, 0, 1, 0, qmax * 1.1, 'x/c', 'q̇ wall (kW/m²)', 0.2, stepOf(qmax * 1.1));
  const clip = p => [X(p[0]), Y(Math.min(p[1], qmax * 1.1))];
  S.polyline(c, lo.map(clip), '#f4a261', 1.6);
  S.polyline(c, up.map(clip), '#4cc9f0', 1.6);
  c.fillStyle = '#5b6b80'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('scale excludes the x → 0 flat-plate singularity', f.pad.l + 4, f.pad.t + 14);
  c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'top';
  c.fillText(`Tw ${hs.Tw} K · ${hs.bl === 'lam' ? 'laminar' : hs.bl === 'turb' ? 'turbulent' : 'transition at Re_x ' + hs.RexTr.toExponential(0)} · stagnation ${Number.isFinite(an.qStag) ? (an.qStag / 1000).toFixed(0) + ' kW/m²' : '— (sharp LE)'}`, f.W - f.pad.r - 2, f.pad.t + 2);
}
function drawCorridor(f) {
  const { c } = f;
  const { X, Y } = S.axes(f, 0, 8, 0, 86, 'V∞ (km/s)', 'altitude (km)', 1, 10);
  const qs = [[2, '#3a5a7a'], [10, '#4cc9f0'], [50, '#f4a261'], [200, '#ef476f']];
  for (const [q, col] of qs) {
    const pts = [];
    for (let h = 0; h <= 86000; h += 1000) { const rho = HT.us76(h).rho; const V = Math.sqrt(2 * q * 1000 / rho) / 1000; if (V <= 8) pts.push([X(V), Y(h / 1000)]); }
    S.polyline(c, pts, col, 1.2, [4, 3]);
    if (pts.length) { c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'bottom'; const last = pts[pts.length - 1]; c.fillText(`q ${q} kPa`, Math.min(last[0] + 3, f.W - 60), last[1]); }
  }
  // Mach lines (a varies weakly with altitude) for M = 5, 10, 20
  for (const M of [5, 10, 20]) { const pts = []; for (let h = 0; h <= 86000; h += 2000) { const V = M * HT.us76(h).a / 1000; if (V <= 8) pts.push([X(V), Y(h / 1000)]); } S.polyline(c, pts, 'rgba(255,255,255,0.18)', 1); if (pts.length) { c.fillStyle = 'rgba(255,255,255,0.45)'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('M ' + M, pts[pts.length - 1][0], pts[pts.length - 1][1] - 2); } }
  const cx = X(an.V / 1000), cy = Y(hs.alt / 1000);
  c.fillStyle = '#fff'; c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#d7e2ef'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`you: M ${an.M.toFixed(1)}, ${(an.q / 1000).toFixed(1)} kPa`, cx + 9, cy);
}

// ------------------------------------------------------------------ tiles
function updateTiles() {
  const t = S.setTile, fmt = S.fmt;
  t('cl', fmt(an.Cl, 3), ''); t('cd', fmt(an.Cd, 4), ''); t('cdw', fmt(an.CdWave, 4), ''); t('cdf', fmt(an.CdF, 5), '', an.CdF / an.Cd > 0.5 ? 'friction-dominated' : 'reference-T method');
  t('ld', fmt(an.LD, 2), ''); t('cm', fmt(an.Cm, 4), '');
  t('lift', fmt(an.lift, 0), '', 'N per m span · ' + fmt(an.lift / 9.80665, 0) + ' kgf'); t('drag', fmt(an.drag, 0), '');
  t('q', (an.q / 1000).toFixed(1) + ' kPa', an.q > 100e3 ? 'warn' : '', an.q > 100e3 ? 'very high structural loading' : 'dynamic pressure');
  t('re', S.fmtRe(an.Re), '', 'ρ V c / μ');
  const knc = an.Kn > 0.1 ? 'bad' : an.Kn > 0.01 ? 'warn' : 'good';
  t('kn', an.Kn.toExponential(1), knc, an.Kn > 10 ? 'free-molecular' : an.Kn > 0.1 ? 'transitional' : an.Kn > 0.01 ? 'slip flow' : 'continuum');
  t('t0', fmt(an.T0, 0) + ' K', an.T0 > 4000 ? 'bad' : an.T0 > 800 ? 'warn' : '', an.T0 > 2500 ? 'real gas: much lower' : an.T0 > 800 ? 'vibration excited' : 'perfect-gas stagnation');
  t('p02', an.p02 > 1e5 ? (an.p02 / 1000).toFixed(0) + ' kPa' : (an.p02 / 1000).toFixed(2) + ' kPa', '', '×' + (an.p02 / an.atm.p).toFixed(1) + ' p∞');
  const sh = (id, side) => { const ls = side.leShock; if (!ls) { t(id, '—', ''); return; } if (!ls.attached) t(id, 'detached', 'warn', an.billig ? 'stand-off ' + (an.billig.standoff * an.Rn * 1000).toFixed(1) + ' mm' : 'bow shock'); else if (ls.expansion) t(id, 'expansion', '', 'Mach angle ' + (Math.asin(1 / an.M) / DEG).toFixed(1) + '°'); else t(id, (ls.beta / DEG).toFixed(1) + '°', 'good', 'attached oblique shock'); };
  sh('shu', an.upper); sh('shl', an.lower);
  t('qs', Number.isFinite(an.qStag) ? (an.qStag >= 1e6 ? (an.qStag / 1e6).toFixed(2) + ' MW/m²' : (an.qStag / 1000).toFixed(0) + ' kW/m²') : 'sharp LE', Number.isFinite(an.qStag) && an.qStag > 1e6 ? 'bad' : '', Number.isFinite(an.qStag) ? 'R_n ' + (an.Rn * 1000).toFixed(1) + ' mm (cyl.)' : 'set a nose radius');
  t('qmax', an.heat.qMax >= 1e6 ? (an.heat.qMax / 1e6).toFixed(2) + ' MW/m²' : (an.heat.qMax / 1000).toFixed(1) + ' kW/m²', '', 'x/c ' + an.heat.xqMax.toFixed(2) + (an.heat.upperSide ? ' upper' : ' lower') + ' (beyond 1 % c)');
  t('heat', an.heat.Q >= 1e6 ? (an.heat.Q / 1e6).toFixed(2) + ' MW/m' : (an.heat.Q / 1000).toFixed(1) + ' kW/m', '', 'Tw ' + hs.Tw + ' K, both surfaces');
}

// ------------------------------------------------------------------ hover, export, controls
function hover(sx, sy) {
  if (!an) return null; let best = null, bd = 22;
  for (const [name, pan, inv, vis] of [['upper', an.surf.upper, an.upper, an.upperV], ['lower', an.surf.lower, an.lower, an.lowerV]]) {
    for (let k = 0; k < pan.length; k++) { const p = S.surfScreen(pan[k].xm, pan[k].ym); const d = Math.hypot(p[0] - sx, p[1] - sy); if (d < bd) { bd = d; best = { name, k, inv, vis, pan }; } }
  }
  if (!best) return null;
  const { name, k, inv, vis, pan } = best, reg = { N: 'Newtonian nose', S: 'behind shock', E: 'expansion', F: 'freestream', V: 'vacuum limit' }[inv.regime[k]];
  return `${name} x/c ${pan[k].xm.toFixed(2)} · Cp ${inv.Cp[k].toFixed(3)} · p/p∞ ${inv.pp[k].toFixed(2)} · M ${inv.M[k] >= 60 ? '∞' : inv.M[k].toFixed(2)} · T ${vis.Te[k].toFixed(0)} K · q̇ ${(vis.qw[k] / 1000).toFixed(1)} kW/m² · ${vis.laminar[k] ? 'laminar' : 'turbulent'} · ${reg}`;
}
function exportData(kind) {
  const geo = S.geo(), slug = geo.name.replace(/[^\w]+/g, '_');
  if (kind === 'cp' || kind === 'bl') {
    let s = `# ${geo.name}  M=${hs.M}  alt=${hs.alt} m  alpha=${hs.alpha}  gamma=${hs.gamma}  Tw=${hs.Tw} K  method=${hs.method}  BL=${hs.bl}\nsurface,x_c,y_c,Cp,p_pinf,M_local,T_edge_K,Cf,q_wall_W_m2,laminar,regime\n`;
    for (const [name, pan, inv, vis] of [['upper', an.surf.upper, an.upper, an.upperV], ['lower', an.surf.lower, an.lower, an.lowerV]])
      for (let k = 0; k < pan.length; k++) s += `${name},${pan[k].xm.toFixed(6)},${pan[k].ym.toFixed(6)},${inv.Cp[k].toFixed(6)},${inv.pp[k].toFixed(5)},${inv.M[k].toFixed(4)},${vis.Te[k].toFixed(1)},${vis.Cf[k].toExponential(4)},${vis.qw[k].toExponential(4)},${vis.laminar[k] ? 1 : 0},${inv.regime[k]}\n`;
    S.download(`${slug}_hypersonic_M${hs.M}_a${hs.alpha}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'polar') {
    if (!polar) return;
    let s = `# ${geo.name}  M=${hs.M}  alt=${hs.alt} m  c=${hs.chord} m  gamma=${hs.gamma}  Tw=${hs.Tw} K  method=${hs.method}\nalpha,Cl,Cd,Cd_wave,Cd_friction,L_D,Cm_c4,lift_N_m,drag_N_m,heat_load_W_m,q_max_W_m2\n`;
    for (const r of polar.points) s += `${r.alpha},${r.Cl.toFixed(5)},${r.Cd.toFixed(6)},${r.CdWave.toFixed(6)},${r.CdF.toFixed(6)},${r.LD.toFixed(3)},${r.Cm.toFixed(5)},${r.lift.toFixed(1)},${r.drag.toFixed(1)},${r.heat.Q.toExponential(4)},${r.heat.qMax.toExponential(4)}\n`;
    S.download(`${slug}_hypersonic_polar_M${hs.M}.csv`, new Blob([s], { type: 'text/csv' }));
  }
}
function syncSlider(s) { const el = S.$(s.id); el.value = hs[s.key]; S.$(s.id + 'Out').textContent = s.out(hs[s.key]); }
function nudge(key, dv, lo, hi) { hs[key] = Math.max(lo, Math.min(hi, Math.round((hs[key] + dv) * 100) / 100)); syncSlider(SL.find(s => s.key === key)); recompute(); }
function wire() {
  for (const s of SL) { const el = S.$(s.id); el.addEventListener('input', () => { hs[s.key] = parseFloat(el.value); S.$(s.id + 'Out').textContent = s.out(hs[s.key]); recompute(); }); syncSlider(s); }
  S.$('hMethod').addEventListener('change', e => { hs.method = e.target.value; recompute(); });
  S.$('hBL').addEventListener('change', e => { hs.bl = e.target.value; S.$('hRexTr').disabled = hs.bl !== 'trans'; recompute(); });
  S.$('hRexTr').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) hs.RexTr = v; e.target.value = hs.RexTr; recompute(); });
  S.$('hRn').addEventListener('change', e => { const v = parseFloat(e.target.value); hs.rnOverride = v > 0 ? v / 1000 : null; if (!(v > 0)) e.target.value = ''; recompute(); });
  S.$('hColour').addEventListener('change', e => { hs.colour = e.target.value; });
  S.$('hMachLines').addEventListener('change', e => { hs.machLines = e.target.checked; });
}
function set(patch) {
  const lim = { M: [1.5, 25], alt: [0, 86000], alpha: [-20, 30], chord: [0.1, 20], gamma: [1.1, 1.67], Tw: [200, 2500] };
  for (const k of Object.keys(patch)) {
    if (k in lim && Number.isFinite(patch[k])) { hs[k] = Math.max(lim[k][0], Math.min(lim[k][1], patch[k])); syncSlider(SL.find(s => s.key === k)); }
    else if (k === 'method' && ['se', 'wedge', 'newton', 'newtonClassic'].includes(patch[k])) { hs.method = patch[k]; S.$('hMethod').value = patch[k]; }
    else if (k === 'bl' && ['lam', 'turb', 'trans'].includes(patch[k])) { hs.bl = patch[k]; S.$('hBL').value = patch[k]; }
  }
  recompute();
}
function init(shared) { S = shared; wire(); }
function tabsHtml() { return POLAR_TABS.map(([k, l], i) => `<button data-tab="${k}" class="${i === 0 ? 'active' : ''}">${l}</button>`).join(''); }

return { init, set, hs, TILES, tabsHtml, recompute, onGeometryChanged, draw, drawCp, drawPolar, hover, exportData, nudge, alpha: () => hs.alpha, cond, get an() { return an; }, get polar() { return polar; } };
})();
