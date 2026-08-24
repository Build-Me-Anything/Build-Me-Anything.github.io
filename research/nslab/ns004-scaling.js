// NS-004: gather the antiparallel-tube runs by Reynolds number, judge whether each Reynolds number's peak has
// converged under refinement, and — for those that have — fit the scaling of the converged maximum with viscosity.
// Usage: node research/nslab/ns004-scaling.js [--tol 2] [--md]
//   --tol  percentage change at the last rung below which a peak counts as converged (default 2 %)
//   --md   emit the markdown tables for the README / report instead of the console summary
// Reads every folder matching (expl-)tubes-Re<Re>-N<N>(-fp32)-gpu with a final.json. float32 runs are exploration
// grade and are marked as such; a float64 run at the same (Re, N) always wins.
const fs = require('fs'), path = require('path');
const here = __dirname, args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TOL = parseFloat(opt('tol', '2')) / 100, MD = args.includes('--md');
const BS = String.fromCharCode(92), OM = 'max' + BS + '|ω' + BS + '|';

const runs = [];
for (const d of fs.readdirSync(here)) {
  const m = d.match(/^(expl-)?tubes-Re(\d+)-N(\d+)(-fp32)?-gpu$/); if (!m) continue;
  const p = path.join(here, d, 'final.json'); if (!fs.existsSync(p)) continue;
  const r = JSON.parse(fs.readFileSync(p, 'utf8')), s = r.series;
  const pk = (a) => { let i = 0; for (let k = 0; k < a.length; k++) if (a[k] > a[i]) i = k; return { v: a[i], t: s.t[i] }; };
  const po = pk(s.omMax), pe = pk(s.eps), pz = pk(s.Z), pp = pk(s.Pspec);
  // the interpolated peak is the maximum over the peak tracker AND the archived snapshots — the tracker only fires on
  // 2 % increments of the grid maximum, so it can miss the instant where the interpolant peaks (same union the runner
  // uses for its DONE line; taking the tracker alone under-reports by ~1 %)
  const track = (r.peakTrack || []).concat((r.snapshots || []).filter(o => o.omMaxI != null).map(o => ({ t: o.t, omMaxI: o.omMaxI })));
  const pI = track.length ? track.reduce((a, b) => b.omMaxI > a.omMaxI ? b : a) : null;
  let I10 = 0; for (let k = 1; k < s.t.length && s.t[k] <= 10 + 1e-9; k++) I10 += 0.5 * (s.omMax[k] + s.omMax[k - 1]) * (s.t[k] - s.t[k - 1]);
  const kes = (r.snapshots || []).map(o => o.kmaxEta).filter(v => v != null);
  runs.push({ dir: d, Re: +m[2], N: +m[3], fp32: !!m[4], nu: r.case.nu, omPeak: po.v, tOm: po.t, omI: pI ? pI.omMaxI : null,
    epsPeak: pe.v, Zpeak: pz.v, Ppeak: pp.v, I10, minKe: kes.length ? Math.min(...kes) : null, health: r.health.worst });
}
// one entry per (Re, N): prefer float64
const byKey = new Map();
for (const r of runs) { const k = r.Re + '/' + r.N, prev = byKey.get(k); if (!prev || (prev.fp32 && !r.fp32)) byKey.set(k, r); }
const byRe = new Map();
for (const r of byKey.values()) { if (!byRe.has(r.Re)) byRe.set(r.Re, []); byRe.get(r.Re).push(r); }
for (const list of byRe.values()) list.sort((a, b) => a.N - b.N);

const rel = (a, b) => Math.abs(b - a) / Math.abs(b);
const conv = [];
let out = '';
// Convergence is judged on the SPECTRALLY INTERPOLATED peak, not the grid peak: the grid maximum carries node-sampling
// jitter (at Re 707 it reads 37.2 → 36.4 → 37.9 while the interpolant reads 38.2 → 39.1 → 38.9), which is exactly the
// artefact the interpolant removes. The grid peak is reported alongside, never used for the verdict.
out += MD ? `| Re | Re_Γ | rungs N | interpolated peak by rung | last change | band of last 3 | grid peak (last) | converged? | precision |\n|---|---|---|---|---|---|---|---|---|\n` : '';
for (const Re of [...byRe.keys()].sort((a, b) => a - b)) {
  const L = byRe.get(Re), last = L[L.length - 1], prev = L.length > 1 ? L[L.length - 2] : null;
  const useI = last.omI != null && prev && prev.omI != null;
  const change = prev ? rel(useI ? prev.omI : prev.omPeak, useI ? last.omI : last.omPeak) : null;
  // Two ways to be converged, because a single-step test is fragile against the few per cent of jitter this quantity
  // carries: (a) the last refinement moved it by less than the tolerance — a clean approach that has settled; or
  // (b) the last three rungs all sit inside a band of 1.5×tolerance about their mean — fluctuating about a plateau
  // with no trend (Re 707 reads 39.1, 38.9, 39.9: a ±1.5 % band, obviously converged, but its last step is 2.5 %).
  const vals = L.map(r => (r.omI != null ? r.omI : r.omPeak));
  const tail3 = vals.slice(-3), mean3 = tail3.reduce((a, b) => a + b, 0) / tail3.length;
  const band = tail3.length >= 3 ? Math.max(...tail3.map(v => Math.abs(v - mean3))) / mean3 : null;
  const ok = (change != null && change < TOL) || (band != null && band < 1.5 * TOL);
  if (ok) conv.push({ Re, nu: last.nu, om: last.omPeak, omI: last.omI, N: last.N, Z: last.Zpeak, P: last.Ppeak, I10: last.I10, fp32: L.some(r => r.fp32) });
  const reG = Math.round(4.0 * Re / 100) * 100;   // Γ ≈ 4.0 for the standard tube preset
  const series = L.map(r => r.omI != null ? r.omI.toFixed(1) : '(' + r.omPeak.toFixed(1) + ')').join(' → ');
  if (MD) out += `| ${Re} | ≈ ${reG.toLocaleString()} | ${L.map(r => r.N).join(', ')} | ${series} | ${change == null ? '—' : (100 * change).toFixed(1) + ' %'}${useI ? '' : ' (grid)'} | ${band == null ? '—' : '±' + (100 * band).toFixed(1) + ' %'} | ${last.omPeak.toFixed(1)} | ${ok ? '**yes**' : 'no'} | ${L.some(r => r.fp32) ? 'float32 (exploration)' : 'float64'} |\n`;
  else out += `Re ${String(Re).padStart(5)}  N ${L.map(r => r.N).join(',').padEnd(20)} interp ${series.padEnd(34)} last ${change == null ? '  —  ' : (100 * change).toFixed(1).padStart(5) + ' %'}  band ${band == null ? '  —  ' : ('±' + (100 * band).toFixed(1) + ' %').padStart(7)}  ${ok ? 'CONVERGED' : 'not converged'}  ${L.some(r => r.fp32) ? '(fp32)' : '(fp64)'}\n`;
}
// scaling fit over the converged Reynolds numbers: peak ∝ ν^−p
if (conv.length >= 2) {
  const fit = (key) => { let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0; for (const c of conv) { const v = c[key]; if (!(v > 0)) continue; const x = Math.log(c.nu), y = Math.log(v); sx += x; sy += y; sxx += x * x; sxy += x * y; n++; } if (n < 2) return null; const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); return { p: -b, n }; };
  const fo = fit('om'), fi = fit('omI'), fz = fit('Z'), fp = fit('P'), fI = fit('I10');
  const line = (name, f) => f ? `${name} ∝ ν^−${f.p.toFixed(2)} (${f.n} Reynolds numbers)` : `${name}: too few converged levels`;
  out += MD ? `\nConverged peaks: ${conv.map(c => `Re ${c.Re} → ${c.om.toFixed(1)} at ${c.N}³`).join('; ')}.\n\nScaling of the converged quantities with viscosity (least squares on log ν):\n\n- ${line('grid ' + OM + ' peak', fo)}\n- ${line('interpolated peak', fi)}\n- ${line('Z_max', fz)}\n- ${line('peak ⟨ω·S·ω⟩', fp)}\n- ${line('∫₀¹⁰ ' + OM + ' dt', fI)}\n\nKerr (2018) reports √ν-type scaling for reconnection enstrophy; a ν^−0.5 exponent here would be the comparable observation. Nothing is claimed until the ladder is float64 or the precision policy is amended.\n`
    : `\nconverged: ${conv.map(c => `Re ${c.Re} → ${c.om.toFixed(1)} (N ${c.N}, ν ${c.nu.toExponential(2)})`).join('; ')}\n` + [line('peak', fo), line('interp', fi), line('Z_max', fz), line('⟨ωSω⟩', fp), line('BKM10', fI)].map(s => '  ' + s).join('\n') + '\n';
} else out += `\nOnly ${conv.length} Reynolds number(s) converged at tolerance ${(100 * TOL).toFixed(0)} % — no scaling fit.\n`;
console.log(out);
