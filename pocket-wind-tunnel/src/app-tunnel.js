/* Pocket Wind Tunnel — test-section mode: the section between tunnel walls (method of images) with the classical
 * blockage / streamline-curvature corrections applied to the "measured" values and checked against free air. */
const TunnelUI = (() => {
'use strict';
const ts = { hc: 4, open: false, yOff: 0 };
let S = null, geoT = null, sysT = null, anT = null, anF = null, anFc = null, corr = null, lam = null, sweepHc = null, polarT = null, sweepTimer = null;
const SL = [
  { id: 'tHc', key: 'hc', out: v => 'h/c ' + v.toFixed(1) + '  (h = ' + (v * S.state.chord).toFixed(2) + ' m)' },
  { id: 'tOff', key: 'yOff', out: v => (v * 100).toFixed(0) + ' % of h' },
];
const TILES = [
  ['hc', 'Test section', 'h / c'], ['sigma', 'σ', 'π²/48 (c/h)²'], ['lambda', 'Λ', 'shape factor (doublet)'], ['esb', 'ε solid', 'Λ σ'], ['ewb', 'ε wake', 'c Cd,u / 2h'], ['eps', 'ε total', 'velocity increment'],
  ['qr', 'q correction', '(1 + 2ε)'], ['clu', 'Cl measured', 'in the tunnel'], ['clc', 'Cl corrected', 'classical'], ['clf', 'Cl free air', 'at corrected α'], ['res', 'Residual', 'corrected vs free'], ['alphac', 'α corrected', 'streamline curvature'],
  ['cmu', 'Cm measured', 'c/4'], ['cmc', 'Cm corrected', 'c/4'], ['cmf', 'Cm free air', 'c/4'], ['cdu', 'Cd measured', 'profile drag'], ['cdc', 'Cd corrected', 'classical'], ['cdf', 'Cd free air', 'profile drag'],
];
const POLAR_TABS = [['corr', 'Corrections'], ['hc', 'vs h/c'], ['cla', 'Cl–α'], ['cma', 'Cm–α']];
const walls = () => ({ h: ts.hc, yc: -ts.yOff * ts.hc, open: ts.open, G: 3 });

function solveTunnel(geo, alphaDeg, cond, w) {
  const g = WT.rotateGeo(geo, alphaDeg), sys = WT.buildSystem(g, { walls: w });
  return { geo: g, sys, an: WT.analyse(sys, Object.assign({}, cond, { alpha: 0 })) };
}
/** Compute the tunnel solution for the current case. Returns the tunnel analysis (used for drawing / Cp / field). */
function recompute() {
  const geo = S.geo(), cond = S.cond(), sysF = S.sys();
  const t = solveTunnel(geo, S.state.alpha, cond, walls());
  geoT = t.geo; sysT = t.sys; anT = t.an;
  anF = WT.analyse(sysF, cond);
  lam = WT.shapeFactor(sysF, anF.inv);
  corr = WT.tunnelCorrections(ts.hc, anT.Cl, anT.Cm, anT.Cd, S.state.alpha, lam.Lambda);
  anFc = WT.analyse(sysF, Object.assign({}, cond, { alpha: corr.alphaC }));
  clearTimeout(sweepTimer); sweepTimer = setTimeout(sweeps, 150);
  return anT;
}
function sweeps() {
  const geo = S.geo(), cond = S.cond(), sysF = S.sys(), a = S.state.alpha;
  sweepHc = [];
  for (const hc of [1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12]) {
    const t = solveTunnel(geo, a, cond, { h: hc, yc: -ts.yOff * hc, open: ts.open, G: 3 });
    const c = WT.tunnelCorrections(hc, t.an.Cl, t.an.Cm, t.an.Cd, a, lam.Lambda), fc = WT.analyse(sysF, Object.assign({}, cond, { alpha: c.alphaC }));
    sweepHc.push({ hc, ratio: t.an.Cl / anF.Cl, corrected: c.ClC / fc.Cl, eps: c.eps, sigma: c.sigma, cdRatio: t.an.Cd / anF.Cd, cdCorr: c.CdC / fc.Cd });
  }
  polarT = [];
  for (let al = -8; al <= 16; al += 2) {
    const t = solveTunnel(geo, al, cond, walls()), f = WT.analyse(sysF, Object.assign({}, cond, { alpha: al }));
    const c = WT.tunnelCorrections(ts.hc, t.an.Cl, t.an.Cm, t.an.Cd, al, lam.Lambda);
    polarT.push({ alpha: al, ClU: t.an.Cl, ClF: f.Cl, alphaC: c.alphaC, ClC: c.ClC, CmU: t.an.Cm, CmF: f.Cm, CmC: c.CmC });
  }
  drawPolar();
}
function fieldParams() { return { gx: Array.from(geoT.x), gy: Array.from(geoT.y), q: Array.from(anT.inv.q), gamma: anT.inv.gamma, alpha: 0, walls: walls() }; }
function band() { const w = walls(); return [w.yc - w.h / 2, w.yc + w.h / 2]; }

// ------------------------------------------------------------------ drawing
function drawWalls(ctx) {
  const w = walls(), { W } = S.view;
  const yTop = S.toScreen(0, w.yc + w.h / 2)[1], yBot = S.toScreen(0, w.yc - w.h / 2)[1];
  ctx.save();
  if (w.open) { ctx.setLineDash([10, 7]); ctx.strokeStyle = 'rgba(76,201,240,0.8)'; ctx.lineWidth = 1.5; }
  else { ctx.setLineDash([]); ctx.strokeStyle = '#d7e2ef'; ctx.lineWidth = 3; }
  for (const y of [yTop, yBot]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (!w.open) {   // hatching on the solid side
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(215,226,239,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = -12; x < W; x += 12) { ctx.moveTo(x, yTop); ctx.lineTo(x - 8, yTop - 8); ctx.moveTo(x, yBot); ctx.lineTo(x - 8, yBot + 8); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = '12px ' + S.mono(); ctx.fillStyle = '#d7e2ef'; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
  ctx.fillText((w.open ? 'open jet boundary' : 'solid wall') + '   h = ' + ts.hc.toFixed(1) + ' c = ' + (ts.hc * S.state.chord).toFixed(2) + ' m', 12, Math.max(24, yTop - 4));
  // dimension line
  const x = W - 40; ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yTop + 1); ctx.lineTo(x, yBot - 1); ctx.moveTo(x - 4, yTop + 1); ctx.lineTo(x + 4, yTop + 1); ctx.moveTo(x - 4, yBot - 1); ctx.lineTo(x + 4, yBot - 1); ctx.stroke();
  ctx.save(); ctx.translate(x - 6, 0.5 * (yTop + yBot)); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#a78bfa'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('h', 0, 0); ctx.restore();
}
function drawHud(ctx) {
  if (!corr) return;
  const { W } = S.view;
  ctx.font = '12px ' + S.mono(); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const l1 = `Cl measured ${anT.Cl.toFixed(4)} → corrected ${corr.ClC.toFixed(4)} → free air ${anFc.Cl.toFixed(4)} at α ${corr.alphaC.toFixed(2)}°   residual ${((corr.ClC / anFc.Cl - 1) * 100).toFixed(2)} %`;
  const l2 = `σ ${corr.sigma.toFixed(4)}   Λ ${lam.Lambda.toFixed(3)}   ε_sb ${(corr.eSb * 100).toFixed(2)} %   ε_wb ${(corr.eWb * 100).toFixed(2)} %   q × ${corr.qRatio.toFixed(4)}${ts.open ? '   (classical corrections assume a closed section)' : Math.abs(ts.yOff) > 0.05 ? '   (classical corrections assume a centred model)' : ''}`;
  ctx.fillStyle = 'rgba(8,12,18,0.65)'; ctx.fillRect(8, 48, Math.min(720, W - 16), 38);
  ctx.fillStyle = '#d7e2ef'; ctx.fillText(l1, 14, 53); ctx.fillText(l2, 14, 69);
}

// ------------------------------------------------------------------ plots
function drawCp() {
  const f = S.plotFrame(S.$('cpPlot')), { c } = f; if (!anT) return;
  const PT = sysT.P, PF = S.sys().P, iS = anT.bl ? anT.bl.iStag : 0, pg = anT.pg;
  const up = [], lo = [], upF = [], loF = [];
  for (let i = 0; i < PT.n; i++) { const px = PF.xm[i]; (i > iS ? up : lo).push([px, anT.inv.Cp[i] * pg]); (i > (anF.bl ? anF.bl.iStag : 0) ? upF : loF).push([px, anF.inv.Cp[i] * anF.pg]); }
  const cpmin = Math.min(anT.inv.CpMin * pg, anF.inv.CpMin * anF.pg, -1), ymin = Math.floor(cpmin * 1.1 * 2) / 2, ymax = 1.1;
  const ystep = (ymax - ymin) > 6 ? 2 : (ymax - ymin) > 3 ? 1 : 0.5;
  const { X, Y } = S.axes(f, 0, 1, ymax, ymin, 'x/c', '−Cp ↑', 0.2, ystep);
  S.polyline(c, loF.map(p => [X(p[0]), Y(p[1])]), 'rgba(244,162,97,0.45)', 1, [3, 3]); S.polyline(c, upF.map(p => [X(p[0]), Y(p[1])]), 'rgba(76,201,240,0.45)', 1, [3, 3]);
  S.polyline(c, lo.map(p => [X(p[0]), Y(p[1])]), '#f4a261', 1.6); S.polyline(c, up.map(p => [X(p[0]), Y(p[1])]), '#4cc9f0', 1.6);
  c.fillStyle = '#8a9bb0'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('solid: in the tunnel · dashed: free air (same α)', f.W - f.pad.r - 2, f.pad.t + 2);
}
function bars(f, X0, items) {
  const { c } = f, n = items.length, pad = f.pad, W = f.W, H = f.H;
  const vmax = Math.max(...items.map(it => Math.max(...it.vals.map(Math.abs)))) * 1.25 || 1;
  const groupW = (W - pad.l - pad.r) / n, bw = groupW / 4;
  const Y = v => pad.t + (H - pad.t - pad.b) * (1 - (v + vmax) / (2 * vmax));
  c.strokeStyle = '#3a4d63'; c.beginPath(); c.moveTo(pad.l, Y(0)); c.lineTo(W - pad.r, Y(0)); c.stroke();
  const cols = ['#f4a261', '#4cc9f0', '#06d6a0'];
  items.forEach((it, k) => {
    const x0 = pad.l + k * groupW + groupW * 0.15;
    it.vals.forEach((v, j) => { c.fillStyle = cols[j]; const y = Y(v), y0 = Y(0); c.fillRect(x0 + j * bw, Math.min(y, y0), bw - 2, Math.abs(y - y0) || 1); c.fillStyle = cols[j]; c.textAlign = 'center'; c.textBaseline = v >= 0 ? 'bottom' : 'top'; c.font = '10px ' + S.mono(); c.fillText(it.fmt(v), x0 + j * bw + bw / 2 - 1, v >= 0 ? y - 2 - j * 11 : y + 2 + j * 11); });
    c.fillStyle = '#aab8c9'; c.font = '11px ' + S.mono(); c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(it.label, x0 + 1.5 * bw, H - 4);
  });
  c.font = '11px ' + S.mono(); c.textAlign = 'left'; c.textBaseline = 'top';
  [['measured in tunnel', cols[0]], ['classical correction', cols[1]], ['free air at α corrected', cols[2]]].forEach(([t, col], j) => { c.fillStyle = col; c.fillRect(pad.l + 4 + j * 170, pad.t + 4, 10, 10); c.fillStyle = '#aab8c9'; c.fillText(t, pad.l + 18 + j * 170, pad.t + 3); });
}
function drawPolar() {
  const f = S.plotFrame(S.$('polarPlot')), { c } = f, tab = S.state.polarTab;
  if (!corr) return;
  if (tab === 'corr') { bars(f, 0, [
    { label: 'Cl', vals: [anT.Cl, corr.ClC, anFc.Cl], fmt: v => v.toFixed(3) },
    { label: 'Cm c/4', vals: [anT.Cm, corr.CmC, anFc.Cm], fmt: v => v.toFixed(3) },
    { label: 'Cd × 100', vals: [anT.Cd * 100, corr.CdC * 100, anFc.Cd * 100], fmt: v => v.toFixed(2) },
    { label: 'α (°)', vals: [S.state.alpha, corr.alphaC, corr.alphaC], fmt: v => v.toFixed(2) },
  ]); return; }
  if (tab === 'hc') {
    if (!sweepHc) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText('computing…', f.W / 2, f.H / 2); return; }
    const ys = sweepHc.flatMap(r => [r.ratio, r.corrected]), ymin = Math.min(0.95, ...ys) - 0.01, ymax = Math.max(1.05, ...ys) + 0.01;
    const { X, Y } = S.axes(f, 1, 12, ymin, ymax, 'tunnel height h/c', 'Cl / Cl free air', 1, 0.02);
    S.polyline(c, [[X(1), Y(1)], [X(12), Y(1)]], '#3a4d63', 1);
    S.polyline(c, sweepHc.map(r => [X(r.hc), Y(r.ratio)]), '#f4a261', 1.8); S.polyline(c, sweepHc.map(r => [X(r.hc), Y(r.corrected)]), '#06d6a0', 1.8);
    for (const r of sweepHc) { c.fillStyle = '#f4a261'; c.beginPath(); c.arc(X(r.hc), Y(r.ratio), 2.5, 0, 7); c.fill(); c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(X(r.hc), Y(r.corrected), 2.5, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.beginPath(); c.arc(X(ts.hc), Y(anT.Cl / anF.Cl), 4.5, 0, 7); c.fill(); c.stroke();
    c.font = '11px ' + S.mono(); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillStyle = '#f4a261'; c.fillText('measured / free air', f.W - f.pad.r - 2, f.pad.t + 2); c.fillStyle = '#06d6a0'; c.fillText('after classical correction', f.W - f.pad.r - 2, f.pad.t + 15);
    return;
  }
  if (!polarT) { c.fillStyle = '#8a9bb0'; c.textAlign = 'center'; c.fillText('computing…', f.W / 2, f.H / 2); return; }
  const key = tab === 'cma' ? ['CmU', 'CmF', 'CmC'] : ['ClU', 'ClF', 'ClC'], lab = tab === 'cma' ? 'Cm c/4' : 'Cl';
  const vals = polarT.flatMap(r => [r[key[0]], r[key[1]], r[key[2]]]), ymin = Math.min(...vals) - 0.05, ymax = Math.max(...vals) + 0.05;
  const { X, Y } = S.axes(f, -8, 16, ymin, ymax, 'α (°)', lab, 4, (ymax - ymin) > 1.5 ? 0.5 : 0.1);
  S.polyline(c, polarT.map(r => [X(r.alpha), Y(r[key[0]])]), '#f4a261', 1.8);
  S.polyline(c, polarT.map(r => [X(r.alpha), Y(r[key[1]])]), '#4cc9f0', 1.8);
  for (const r of polarT) { c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(X(r.alphaC), Y(r[key[2]]), 3, 0, 7); c.fill(); }
  c.font = '11px ' + S.mono(); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillStyle = '#f4a261'; c.fillText('measured in tunnel (at geometric α)', f.W - f.pad.r - 2, f.pad.t + 2); c.fillStyle = '#4cc9f0'; c.fillText('free air', f.W - f.pad.r - 2, f.pad.t + 15); c.fillStyle = '#06d6a0'; c.fillText('● corrected points (α_c, value_c)', f.W - f.pad.r - 2, f.pad.t + 28);
}

// ------------------------------------------------------------------ tiles
function updateTiles() {
  const t = S.setTile, fmt = S.fmt; if (!corr) return;
  const res = corr.ClC / anFc.Cl - 1;
  t('hc', ts.hc.toFixed(1), '', (ts.open ? 'open jet' : 'closed') + ' · offset ' + (ts.yOff * 100).toFixed(0) + ' %');
  t('sigma', corr.sigma.toFixed(4), ''); t('lambda', lam.Lambda.toFixed(3), '', 'from doublet strength');
  t('esb', (corr.eSb * 100).toFixed(2) + ' %', ''); t('ewb', (corr.eWb * 100).toFixed(2) + ' %', ''); t('eps', (corr.eps * 100).toFixed(2) + ' %', corr.eps > 0.05 ? 'warn' : '', 'V × ' + corr.Vratio.toFixed(4));
  t('qr', '× ' + corr.qRatio.toFixed(4), corr.qRatio > 1.1 ? 'warn' : '', 'dynamic pressure');
  t('clu', fmt(anT.Cl, 4), ''); t('clc', fmt(corr.ClC, 4), ''); t('clf', fmt(anFc.Cl, 4), '');
  t('res', (res * 100).toFixed(2) + ' %', Math.abs(res) > 0.03 ? 'bad' : Math.abs(res) > 0.01 ? 'warn' : 'good', ts.open ? 'closed-section formulae used' : Math.abs(ts.yOff) > 0.05 ? 'formulae assume a centred model' : 'classical vs exact');
  t('alphac', corr.alphaC.toFixed(2) + '°', '', 'Δα ' + corr.dAlpha.toFixed(3) + '°');
  t('cmu', fmt(anT.Cm, 4), ''); t('cmc', fmt(corr.CmC, 4), ''); t('cmf', fmt(anFc.Cm, 4), '');
  t('cdu', fmt(anT.Cd, 5), ''); t('cdc', fmt(corr.CdC, 5), ''); t('cdf', fmt(anFc.Cd, 5), '');
}

// ------------------------------------------------------------------ export, controls
function exportData(kind) {
  const geo = S.geo(), slug = geo.name.replace(/[^\w]+/g, '_');
  if (kind === 'cp') {
    const PF = S.sys().P, iS = anT.bl ? anT.bl.iStag : 0; let s = `# ${geo.name}  alpha=${S.state.alpha}  h/c=${ts.hc}  ${ts.open ? 'open jet' : 'closed'}  offset=${ts.yOff}\nx_c,y_c,Cp_tunnel,Cp_free,surface\n`;
    for (let i = 0; i < PF.n; i++) s += `${PF.xm[i].toFixed(6)},${PF.ym[i].toFixed(6)},${(anT.inv.Cp[i] * anT.pg).toFixed(6)},${(anF.inv.Cp[i] * anF.pg).toFixed(6)},${i > iS ? 'upper' : 'lower'}\n`;
    S.download(`${slug}_tunnel_Cp_hc${ts.hc}.csv`, new Blob([s], { type: 'text/csv' }));
  } else if (kind === 'polar') {
    if (!sweepHc) return;
    let s = `# ${geo.name}  alpha=${S.state.alpha}  ${ts.open ? 'open jet' : 'closed'}  Lambda=${lam.Lambda.toFixed(4)}\nh_c,sigma,eps,Cl_tunnel_over_free,Cl_corrected_over_free,Cd_tunnel_over_free,Cd_corrected_over_free\n`;
    for (const r of sweepHc) s += `${r.hc},${r.sigma.toFixed(6)},${r.eps.toFixed(6)},${r.ratio.toFixed(5)},${r.corrected.toFixed(5)},${r.cdRatio.toFixed(5)},${r.cdCorr.toFixed(5)}\n`;
    S.download(`${slug}_tunnel_blockage_sweep.csv`, new Blob([s], { type: 'text/csv' }));
  }
}
function syncSlider(s) { const el = S.$(s.id); el.value = ts[s.key]; S.$(s.id + 'Out').textContent = s.out(ts[s.key]); }
function set(patch) {
  if (Number.isFinite(patch.hc)) { ts.hc = Math.max(1.5, Math.min(12, patch.hc)); syncSlider(SL[0]); }
  if (Number.isFinite(patch.yOff)) { ts.yOff = Math.max(-0.3, Math.min(0.3, patch.yOff)); syncSlider(SL[1]); }
  if (typeof patch.open === 'boolean') { ts.open = patch.open; S.$('tType').value = ts.open ? 'open' : 'closed'; }
  S.recompute(false);
}
function wire() {
  for (const s of SL) { const el = S.$(s.id); el.addEventListener('input', () => { ts[s.key] = parseFloat(el.value); S.$(s.id + 'Out').textContent = s.out(ts[s.key]); S.recompute(true); }); el.addEventListener('change', () => { S.recompute(false); if (S.initParticles) S.initParticles(); }); syncSlider(s); }
  S.$('tType').addEventListener('change', e => { ts.open = e.target.value === 'open'; S.recompute(false); });
}
function init(shared) { S = shared; wire(); }
function tabsHtml() { return POLAR_TABS.map(([k, l], i) => `<button data-tab="${k}" class="${i === 0 ? 'active' : ''}">${l}</button>`).join(''); }
function summary() {
  if (!corr) return null;
  return { test_section: ts.open ? 'open jet' : 'closed', h_over_c: ts.hc, model_offset_fraction: ts.yOff, sigma: corr.sigma, Lambda: lam.Lambda, eps_solid: corr.eSb, eps_wake: corr.eWb, eps_total: corr.eps, q_correction_factor: corr.qRatio,
    measured_in_tunnel: { Cl: anT.Cl, Cm_c4: anT.Cm, Cd: anT.Cd, alpha_deg: S.state.alpha }, classical_corrected: { Cl: corr.ClC, Cm_c4: corr.CmC, Cd: corr.CdC, alpha_deg: corr.alphaC },
    free_air_at_corrected_alpha: { Cl: anFc.Cl, Cm_c4: anFc.Cm, Cd: anFc.Cd }, residual_Cl_pc: (corr.ClC / anFc.Cl - 1) * 100, note: ts.open ? 'classical formulae are for closed sections; open-jet values are the exact image solution' : 'Barlow-Rae-Pope / Allen-Vincenti closed-section corrections' };
}
return { init, set, ts, TILES, tabsHtml, recompute, fieldParams, band, drawWalls, drawHud, drawCp, drawPolar, updateTiles, exportData, summary, get an() { return anT; }, get corr() { return corr; } };
})();
