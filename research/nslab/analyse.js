// Analyse an NSLab long run against the refinement ladder of the same case (and, for Taylor–Green Re 1600, the published references).
// Usage: node research/nslab/analyse.js [run-dir]   (default tgv-Re1600-N192; uses final.json, else partial.json)
// The other levels are every archived run folder named <ic>-Re<Re>-N<N>[-gpu] with a final.json, plus the CPU ladders for TGV Re 1600.
// Writes <run-dir>/analysis.md and <run-dir>/analysis.svg (ε(t) and max|ω|(t) for every level, reference band when one exists).
// Tables: peaks by resolution; enstrophy peak and the BKM integral ∫max|ω|dt by resolution (the quantity to judge vorticity
// growth on — the peak is the least converged number in every ladder so far); level-to-level convergence; snapshots.
const fs = require('fs'), path = require('path');
const BS = String.fromCharCode(92), OM = 'max' + BS + '|ω' + BS + '|', COS = BS + '|cos' + BS + '|';   // escaped pipes for markdown table cells
const here = __dirname, dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'tgv-Re1600-N192');
const src = fs.existsSync(path.join(dir, 'final.json')) ? 'final.json' : 'partial.json';
const run = JSON.parse(fs.readFileSync(path.join(dir, src), 'utf8'));
const REF = { brachet: { eps: 0.0126, t: 9, label: 'Brachet et al. 1983, 256³ (symmetries)' }, spectral512: { eps: 0.0130, t: 9, label: 'van Rees et al. 2011 / HiOCFD, 512³ spectral (≈)' } };
const ic = run.case.ic || 'tgv', Re = run.case.Re, icp = run.case.icParams || {};
const CASES = {
  tgv: { title: 'Taylor–Green', ref: REF, ladders: ['taylor-green-Re1600/ladder-24-32-48-64.json', 'taylor-green-Re1600/ladder-96.json'] },
  tubes: { title: 'Antiparallel vortex tubes', ref: null, ladders: [], note: 'No published reference value exists for this initial condition (two Gaussian-core tubes of opposite circulation along x, amp 8, core σ 0.4, half-separation 0.7 + 0.2 cos x, 2π box — a Kerr-type configuration, not Kerr 1993\'s profile or box), so the ladder itself is the only grade.' },
  random: { title: 'Random solenoidal field', ref: null, ladders: [] }, abc: { title: 'ABC flow', ref: null, ladders: [] }, tgv2d: { title: '2D Taylor–Green', ref: null, ladders: [] },
};
const CASE = CASES[ic] || { title: ic, ref: null, ladders: [] };
// lower levels from the archived CPU ladders (Taylor–Green Re 1600 only)
const levels = [];
if (ic === 'tgv' && Re === 1600) for (const f of CASE.ladders) { const p = path.join(here, f); if (fs.existsSync(p)) for (const L of JSON.parse(fs.readFileSync(p, 'utf8'))) levels.push({ N: L.N, series: L.series, epsPeak: L.epsPeak, tEpsPeak: L.tEpsPeak, omMaxPeak: L.omMaxPeak, tOmPeak: L.tOmPeak, Eend: L.Eend, health: L.health, outs: L.outs }); }
// archived long runs of the same case (CPU or GPU; a GPU folder wins when both exist) become levels too, unless they are the run being analysed
const runDirs = fs.readdirSync(here).filter(d => d.startsWith(`${ic}-Re${Re}-N`) && fs.existsSync(path.join(here, d, 'final.json'))).sort((a, b) => (b.endsWith('-gpu') - a.endsWith('-gpu')) || a.localeCompare(b));
for (const d of runDirs) {
  const p = path.join(here, d, 'final.json'); if (path.resolve(path.dirname(p)) === path.resolve(dir)) continue;
  const r = JSON.parse(fs.readFileSync(p, 'utf8')); if (levels.some(L => L.N === r.case.N)) continue; const s = r.series;
  const pk = (a, t) => { let i = 0; for (let k = 0; k < a.length; k++) if (a[k] > a[i]) i = k; return { v: a[i], t: t[i] }; }; const pe = pk(s.eps, s.t), po = pk(s.omMax, s.t);
  levels.push({ N: r.case.N, nu: r.case.nu, series: s, epsPeak: pe.v, tEpsPeak: pe.t, omMaxPeak: po.v, tOmPeak: po.t, Eend: s.E[s.E.length - 1], health: r.health.worst, outs: r.snapshots });
}
const ser = run.series, N = run.case.N;
const peak = (arr, t) => { let i = 0; for (let k = 0; k < arr.length; k++) if (arr[k] > arr[i]) i = k; return { v: arr[i], t: t[i], i }; };
const pe = peak(ser.eps, ser.t), po = peak(ser.omMax, ser.t), tNow = ser.t[ser.t.length - 1], done = run.final;
levels.push({ N, nu: run.case.nu, series: ser, epsPeak: pe.v, tEpsPeak: pe.t, omMaxPeak: po.v, tOmPeak: po.t, Eend: ser.E[ser.E.length - 1], health: run.health.worst, outs: run.snapshots, current: true });
levels.sort((a, b) => a.N - b.N);
const at = (L, t) => { const s = L.series; let i = 0; for (let k = 0; k < s.t.length; k++) if (Math.abs(s.t[k] - t) < Math.abs(s.t[i] - t)) i = k; return i; };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const f3 = v => (v == null ? '—' : typeof v === 'number' ? (Math.abs(v) < 1e-2 ? v.toExponential(3) : v.toFixed(3)) : v);
let md = `# ${CASE.title} Re ${Re} — ${N}³ analysis (${done ? 'final' : 'PARTIAL, t = ' + tNow.toFixed(2) + ' of ' + run.case.tEnd})\n\n`;
md += `Source: \`${src}\` · NSLab ${run.instrument.split(' ').pop()} · build ${run.build.version || '?'} · ${run.steps} steps · ${(run.elapsed_s / 3600).toFixed(2)} h · health ${run.health.worst}${run.health.worstEnd ? ' (worst archived instant; end of run ' + run.health.worstEnd + ')' : ' (end of run)'}${Object.keys(icp).length ? ' · IC parameters ' + JSON.stringify(icp) : ''}\n\n`;
if (CASE.note) md += `${CASE.note}\n\n`;
// health at the most demanding snapshot
const snaps = run.snapshots || [];
let worstKe = null; for (const o of snaps) if (!worstKe || o.kmaxEta < worstKe.kmaxEta) worstKe = o;
if (worstKe) md += `Resolution: minimum kmax·η = ${worstKe.kmaxEta.toFixed(2)} at t = ${worstKe.t.toFixed(2)} (PASS ≥ 1). Budgets: energy ${run.health.rows.find(r => r[0].startsWith('energy'))[1]}, enstrophy ${run.health.rows.find(r => r[0].startsWith('enstrophy'))[1]}.\n\n`;
md += `## Peaks by resolution\n\n| N | ε_max | t(ε_max) | ${OM} peak | t | E(${Math.min(10, Math.floor(tNow))}) | health |\n|---|---|---|---|---|---|---|\n`;
const tE = Math.min(10, Math.floor(tNow));
for (const L of levels) { const i = at(L, tE); md += `| ${L.N}³${L.current && !done ? ' (partial)' : ''} | ${L.epsPeak.toFixed(5)} | ${L.tEpsPeak.toFixed(2)} | ${L.omMaxPeak.toFixed(2)} | ${L.tOmPeak.toFixed(2)} | ${L.series.E[i].toFixed(5)} | ${L.health} |\n`; }
if (CASE.ref) md += `| reference | ${REF.brachet.eps} / ≈ ${REF.spectral512.eps} | ≈ 9 | | | | ${REF.brachet.label}; ${REF.spectral512.label} |\n`;
md += '\n';
// analyticity-strip width δ(t) (Sulem–Sulem–Frisch 1983; Bustamante & Brachet 2012): least-squares fit of ln E(k) = a − n ln k − 2δk over the
// dissipation range k ∈ [kc/3, kc] of each archived spectrum, above the round-off floor. δ is the distance of the nearest complex
// singularity from the real domain; the run is reliable while δ exceeds a few grid spacings (δ/Δx ≥ 2 is the usual reliability line).
const deltaFit = (spec, N, nFix) => {   // nFix: freeze the power-law exponent and fit δ alone (two parameters) — the three-parameter fit is ill-conditioned on a narrow dissipation range
  const kc = Math.floor(N / 3), peak = Math.max(...spec.slice(1)), pts = [];
  // fit window: from kc/3 up to the last bin before the spectrum turns up again (the pile-up at the dealiasing edge), capped at 0.85 kc;
  // pileUp = max E(k)/E(0.8 kc) over [0.8 kc, kc] — above 1 the spectrum is accumulating energy at the cutoff
  let kHi = Math.round(0.85 * kc); for (let k = Math.round(kc / 2); k < kHi; k++) if (spec[k + 1] > spec[k]) { kHi = k; break; }
  const k8 = Math.round(0.8 * kc); let pileUp = NaN; if (spec[k8] > 1e-20 * peak) { pileUp = 0; for (let k = k8; k <= kc; k++) pileUp = Math.max(pileUp, spec[k] / spec[k8]); }
  if (kc < 60) return { delta: NaN, n: NaN, npts: 0, dx: 2 * Math.PI / N, pileUp };   // the dissipation-range window is too short below 192³ for the fit to mean anything
  for (let k = Math.max(3, Math.round(kc / 3)); k <= kHi; k++) if (spec[k] > 1e-28 * peak && spec[k] > 0) pts.push([k, Math.log(spec[k])]);
  if (pts.length < 6) return { delta: NaN, n: NaN, npts: pts.length, dx: 2 * Math.PI / N, pileUp };
  if (nFix != null) {   // linear fit of (ln E + nFix ln k) = a + c k
    let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [k, y] of pts) { const yy = y + nFix * Math.log(k); sx += k; sy += yy; sxx += k * k; sxy += k * yy; }
    const m = pts.length, c = (m * sxy - sx * sy) / (m * sxx - sx * sx); return { delta: -c / 2, n: nFix, npts: m, dx: 2 * Math.PI / N, pileUp, kHi };
  }
  // normal equations for y = a + b·ln k + c·k  (b = −n, c = −2δ)
  let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
  for (const [k, y] of pts) { const x = [1, Math.log(k), k]; for (let i = 0; i < 3; i++) { r[i] += x[i] * y; for (let j = 0; j < 3; j++) S[i][j] += x[i] * x[j]; } }
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(S); if (Math.abs(D) < 1e-300) return { delta: NaN, n: NaN, npts: pts.length, dx: 2 * Math.PI / N, pileUp };
  const col = (m, i, v) => m.map((row, q) => row.map((e, j) => j === i ? v[q] : e));
  const b = det(col(S, 1, r)) / D, c = det(col(S, 2, r)) / D;
  return { delta: -c / 2, n: -b, npts: pts.length, dx: 2 * Math.PI / N, pileUp, kHi };
};
// the exponent n is frozen per level at the median of the three-parameter fits over the early, well-resolved snapshots (t ≤ 4, n > 0, δ > 0)
const nFreeze = L => { const ns = []; for (const o of (L.outs || [])) { if (!o.spectrum || o.t > 4) continue; const f = deltaFit(o.spectrum, L.N); if (f && f.n > 0 && f.delta > 0) ns.push(f.n); } if (!ns.length) return 3; ns.sort((a, b) => a - b); return ns[Math.floor(ns.length / 2)]; };
const stripSummary = L => { const outs = L.outs || []; const nF = nFreeze(L); let worst = null, fits = 0, pile = 0, tPile = 0; for (const o of outs) { if (!o.spectrum) continue; const f = deltaFit(o.spectrum, L.N, nF); if (!f) continue; if (f.pileUp > pile) { pile = f.pileUp; tPile = o.t; } if (!(f.delta > 0) || !(f.npts >= 6)) continue; fits++; const r = f.delta / f.dx; if (!worst || r < worst.r) worst = { r, t: o.t, n: f.n }; } return (worst || pile > 0) ? { r: worst ? worst.r : NaN, t: worst ? worst.t : NaN, fits, pile, tPile, nF } : null; };
// enstrophy peak and the BKM integral ∫₀ᵗ max|ω| dt (trapezoid over the per-step series) — the programme's rule: judge vorticity growth on this, with a ladder, never on the peak
const bkm = (L, T) => { const s = L.series; let I = 0; for (let k = 1; k < s.t.length && s.t[k] <= T + 1e-9; k++) I += 0.5 * (s.omMax[k] + s.omMax[k - 1]) * (s.t[k] - s.t[k - 1]); return I; };
md += `## Enstrophy peak and BKM integral by resolution\n\n| N | Z_max | t(Z_max) | ∫₀^${tE} ${OM} dt | Δ vs previous level | ∫₀^t_end ${OM} dt (t_end) | min kmax·η | max cutoff pile-up (t) | max (dZ/dt)·ν³/Z³ (t) |\n|---|---|---|---|---|---|---|---|---|\n`;
{ let prev = null; for (const L of levels) { const s = L.series, tend = s.t[s.t.length - 1], pz = s.Z ? peak(s.Z, s.t) : null, I = bkm(L, tE), kes = (L.outs || []).map(o => o.kmaxEta).filter(v => v != null), st = stripSummary(L); md += `| ${L.N}³${L.current && !done ? ' (partial)' : ''} | ${pz ? pz.v.toFixed(3) : '—'} | ${pz ? pz.t.toFixed(2) : '—'} | ${I.toFixed(1)} | ${prev == null ? '—' : (100 * (I / prev - 1)).toFixed(1) + ' %'} | ${bkm(L, tend).toFixed(1)} (${tend.toFixed(1)}) | ${kes.length ? Math.min(...kes).toFixed(2) : '—'} | ${st && st.pile > 0 ? st.pile.toFixed(2) + ' (' + st.tPile.toFixed(1) + ')' : '—'} | ${(() => { if (!s.Z || !L.nu) return '—'; let best = 0, tb = 0; for (let k = 2; k < s.t.length; k++) { const dz = (s.Z[k] - s.Z[k - 2]) / (s.t[k] - s.t[k - 2]); const v = dz * L.nu ** 3 / s.Z[k - 1] ** 3; if (v > best) { best = v; tb = s.t[k - 1]; } } return best.toExponential(2) + ' (' + tb.toFixed(2) + ')'; })()} |\n`; prev = I; } }
md += `\nThe last column is the observed ratio in the rigorous enstrophy-growth bound dZ/dt ≤ c·Z³/ν³ (Doering & Foias 2002; Lu & Doering 2008), i.e. the constant these runs actually realise; the rigorous c is box-normalisation dependent and is not quoted here until checked against the original — the point of tabulating the ratio is its convergence across the ladder and its comparison between flows.\n\nThe cutoff pile-up is max E(k)/E(0.8 kc) over [0.8 kc, kc] at the archived snapshots: above 1 the spectrum turns up again at the dealiasing edge — energy accumulating at the cutoff, the truncation bottleneck — even when E(kc)/E(peak) passes its threshold. (An analyticity-strip width δ(t), E(k) ∝ k^−n e^−2δk, was also fitted; at kc ≤ 85 the dissipation-range window spans less than a decade in k, n and δ trade off and the estimate is not reliable, so it is not tabulated — the code stays for rungs with kc ≥ 120.)\n\n`;
// convergence between the top two levels
if (levels.length >= 2) {
  const a = levels[levels.length - 2], b = levels[levels.length - 1];
  const tc = Math.min(a.series.t[a.series.t.length - 1], b.series.t[b.series.t.length - 1]);
  md += `## Convergence ${a.N}³ → ${b.N}³ (common window t ≤ ${tc.toFixed(2)})\n\n`;
  const rows = [];
  for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16]) { if (t > tc + 1e-9) break; const ia = at(a, t), ib = at(b, t); rows.push([t, a.series.eps[ia], b.series.eps[ib], rel(a.series.eps[ia], b.series.eps[ib]), a.series.omMax[ia], b.series.omMax[ib], rel(a.series.omMax[ia], b.series.omMax[ib]), rel(a.series.E[ia], b.series.E[ib])]); }
  md += `| t | ε ${a.N}³ | ε ${b.N}³ | Δε | ${OM} ${a.N}³ | ${OM} ${b.N}³ | Δ${OM} | ΔE |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r[0]} | ${r[1].toExponential(3)} | ${r[2].toExponential(3)} | ${(100 * r[3]).toFixed(1)} % | ${r[4].toFixed(2)} | ${r[5].toFixed(2)} | ${(100 * r[6]).toFixed(1)} % | ${(100 * r[7]).toFixed(2)} % |\n`;
  md += '\n';
  // convergence by window: before and after the tube pair crosses the periodic boundary in z (t ≈ 7 for the tube runs);
  // the maximum level-to-level difference over the window at Δt = 0.5 samples, and the window's BKM integral per level
  const win = [[0, 7], [7, 16]]; md += `### Convergence by window, ${a.N}³ → ${b.N}³ (max level-to-level difference over the window; BKM integral over the window)\n\n| window | max Δε | max ΔE | max Δ${OM} | ∫ ${OM} dt ${a.N}³ | ∫ ${OM} dt ${b.N}³ | Δ∫ |\n|---|---|---|---|---|---|---|\n`;
  for (const [w0, w1] of win) { if (w0 > tc + 1e-9) break; const hi = Math.min(w1, tc); let de = 0, dE = 0, dw = 0; for (let t = w0; t <= hi + 1e-9; t += 0.5) { const ia = at(a, t), ib = at(b, t); de = Math.max(de, rel(a.series.eps[ia], b.series.eps[ib])); dE = Math.max(dE, rel(a.series.E[ia], b.series.E[ib])); dw = Math.max(dw, rel(a.series.omMax[ia], b.series.omMax[ib])); }
    const Ia = bkm(a, hi) - bkm(a, w0), Ib = bkm(b, hi) - bkm(b, w0); md += `| ${w0} ≤ t ≤ ${hi} | ${(100 * de).toFixed(1)} % | ${(100 * dE).toFixed(2)} % | ${(100 * dw).toFixed(1)} % | ${Ia.toFixed(1)} | ${Ib.toFixed(1)} | ${(100 * (Ib / Ia - 1)).toFixed(1)} % |\n`; }
  md += '\n';
  if (tc >= 9.5) { md += `Peak changes: ε_max ${(100 * rel(a.epsPeak, b.epsPeak)).toFixed(1)} % (t shift ${(b.tEpsPeak - a.tEpsPeak).toFixed(2)}), max|ω| peak ${(100 * rel(a.omMaxPeak, b.omMaxPeak)).toFixed(1)} %, BKM integral to t = ${tE}: ${(100 * (bkm(b, tE) / bkm(a, tE) - 1)).toFixed(1)} %.\n`; if (CASE.ref) md += `${b.N}³ ε_max vs Brachet: ${(100 * (b.epsPeak / REF.brachet.eps - 1)).toFixed(1)} %; vs 512³ spectral ≈ 0.013: ${(100 * (b.epsPeak / REF.spectral512.eps - 1)).toFixed(1)} %.\n`; md += '\n'; }
}
// diagnostics along the run
if (snaps.length) {
  const hasI = snaps.some(o => o.omMaxI != null), hasG = snaps.some(o => o.imageGap != null);   // NS-003 diagnostics: spectrally interpolated maximum, periodic-image gap
  md += `## Snapshots (${N}³)\n\n| t | E | Z | ε | ${OM} grid${hasI ? ' | interp' : ''}${hasG ? ' | z-gap' : ''} | ⟨ω·S·ω⟩ spec | phys | kmax·η | pile-up | S (Brachet form) | ${COS} e₁/e₂/e₃ | E(kmax)/E(peak) |\n|---|---|---|---|---|${hasI ? '---|' : ''}${hasG ? '---|' : ''}---|---|---|---|---|---|---|\n`;
  const nFcur = nFreeze({ outs: snaps, N });
  for (const o of snaps) { const sp = o.spectrum; let kp = 1; for (let k = 1; k < sp.length; k++) if (sp[k] > sp[kp]) kp = k; const kc = Math.floor(N / 3); const f = deltaFit(sp, N, nFcur); md += `| ${o.t.toFixed(2)} | ${o.E.toFixed(5)} | ${o.Z.toFixed(3)} | ${o.eps.toExponential(3)} | ${o.omMax.toFixed(2)}${hasI ? ' | ' + (o.omMaxI != null ? o.omMaxI.toFixed(2) : '—') : ''}${hasG ? ' | ' + (o.imageGap != null ? o.imageGap.toFixed(2) : '—') : ''} | ${o.Pspec.toFixed(3)} | ${o.Pphys.toFixed(3)} | ${o.kmaxEta.toFixed(2)} | ${f && f.pileUp > 0 ? f.pileUp.toFixed(2) : '—'} | ${o.skewIso.toFixed(3)} | ${o.align.map(v => v.toFixed(2)).join('/')} | ${(sp[kc] / sp[kp]).toExponential(1)} |\n`; }
  if (run.peakTrack && run.peakTrack.length) { const pk = run.peakTrack.reduce((b, p) => p.omMaxI > b.omMaxI ? p : b); const pg = run.peakTrack.reduce((b, p) => p.omMax > b.omMax ? p : b); md += `\nSpectrally interpolated maximum (peak tracker, evaluated at every new running maximum of the grid value): interpolated peak ${pk.omMaxI.toFixed(2)} at t ${pk.t.toFixed(3)} (grid value there ${pk.omMax.toFixed(2)}); grid peak ${pg.omMax.toFixed(2)} at t ${pg.t.toFixed(3)} (interpolated there ${pg.omMaxI.toFixed(2)}). The two are reported separately everywhere; the grid maximum is the quantity in the ladder tables.\n`; }
  md += '\n';
}
md += `## Reading\n\n`;
md += done ? '' : `The run is still in progress; every statement above is provisional until \`final.json\` exists.\n\n`;
md += `Numerical evidence only. A converged dissipation peak says the *integral* energetics of this flow are captured; it says nothing about regularity. max|ω| is a local quantity — its level-to-level change is the number to watch, and the BKM integral ∫max|ω|dt, not the peak, is the quantity on which vorticity growth is judged.\n`;
fs.writeFileSync(path.join(dir, 'analysis.md'), md);
// ---- SVG: ε(t) and max|ω|(t) per level ----
const W = 960, H = 420, P = { l: 60, r: 20, t: 20, b: 40 }, half = (W - P.l - P.r - 30) / 2;
const cols = ['#7a8aa0', '#9fb0c5', '#f4a261', '#4cc9f0', '#a78bfa', '#06d6a0'];
const tmax = Math.max(10, ...levels.map(L => L.series.t[L.series.t.length - 1]));
const pane = (x0, ymax, key, title, refBand) => {
  const X = t => x0 + t / tmax * half, Y = v => P.t + (1 - v / ymax) * (H - P.t - P.b);
  let s = `<rect x="${x0}" y="${P.t}" width="${half}" height="${H - P.t - P.b}" fill="#111821" stroke="#223040"/>`;
  for (let t = 0; t <= tmax; t += 2) s += `<line x1="${X(t)}" y1="${P.t}" x2="${X(t)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(t)}" y="${H - P.b + 14}" fill="#8a9bb0" font-size="11" text-anchor="middle">${t}</text>`;
  const ys = ymax / 5; for (let v = 0; v <= ymax + 1e-12; v += ys) s += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + half}" y2="${Y(v)}" stroke="#223040"/><text x="${x0 - 4}" y="${Y(v) + 4}" fill="#8a9bb0" font-size="11" text-anchor="end">${v < 0.1 ? v.toFixed(4) : v.toFixed(0)}</text>`;
  if (refBand) s += `<rect x="${x0}" y="${Y(refBand[1])}" width="${half}" height="${Y(refBand[0]) - Y(refBand[1])}" fill="rgba(6,214,160,0.15)"/><line x1="${X(9)}" y1="${P.t}" x2="${X(9)}" y2="${H - P.b}" stroke="rgba(6,214,160,0.5)" stroke-dasharray="3,3"/>`;
  levels.forEach((L, i) => { const c = cols[Math.min(cols.length - 1, i + Math.max(0, cols.length - levels.length))]; const pts = L.series.t.map((t, k) => `${X(t).toFixed(1)},${Y(L.series[key][k]).toFixed(1)}`).join(' '); s += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${L.current ? 2.2 : 1.3}"/>`; s += `<text x="${x0 + 8}" y="${P.t + 16 + 14 * i}" fill="${c}" font-size="12">${L.N}³${L.current && !done ? ' (partial)' : ''}</text>`; });
  s += `<text x="${x0 + half / 2}" y="${H - 6}" fill="#aab8c9" font-size="12" text-anchor="middle">${title}</text>`;
  return s;
};
const emax = Math.max(CASE.ref ? 0.015 : 0, ...levels.map(L => Math.max(...L.series.eps))) * 1.05, omax = Math.max(...levels.map(L => Math.max(...L.series.omMax))) * 1.05;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0e141c;font-family:Segoe UI,Helvetica,Arial,sans-serif">${pane(P.l, emax, 'eps', CASE.ref ? 'dissipation ε(t) — band: Brachet 0.0126 … 512³ ≈ 0.013, t ≈ 9' : `dissipation ε(t) — ${CASE.title} Re ${Re}`, CASE.ref ? [0.0126, 0.0133] : null)}${pane(P.l + half + 30, omax, 'omMax', 'max|ω|(t)')}</svg>`;
fs.writeFileSync(path.join(dir, 'analysis.svg'), svg);
console.log(md);
console.log(`wrote ${path.join(dir, 'analysis.md')} and analysis.svg`);
