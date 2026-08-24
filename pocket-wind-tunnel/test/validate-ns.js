// Validation of NSLab (3D incompressible Navier–Stokes, pseudo-spectral). Fast (~40 s). Reference values:
//   exact: Arnold–Beltrami–Childress flow decays as e^{−νt}; 2D Taylor–Green decays as e^{−2νt}
//   Taylor–Green Re 1600: Brachet et al. (1983, JFM 130) ε_max ≈ 0.0126 near t ≈ 9 (256³ spectral); 512³ spectral (van Rees 2011) ≈ 0.013
const NS = require('../src/nslab.js');
let fails = 0;
function check(name, val, lo, hi) {
  const ok = val >= lo && val <= hi; if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(66)} ${typeof val === 'number' ? (Math.abs(val) < 1e-3 && val !== 0 ? val.toExponential(3) : val.toFixed(5)) : val}   [${lo}, ${hi}]`);
}
const t0 = Date.now();

// --- FFT against a direct DFT, every radix combination used by the grid menu ---
{
  let worst = 0;
  for (const N of [12, 16, 24, 32, 48, 64, 96]) {
    const plan = NS.fftPlan(N), xr = new Float64Array(N), xi = new Float64Array(N);
    for (let i = 0; i < N; i++) { xr[i] = Math.sin(1.3 * i) + 0.2 * i; xi[i] = Math.cos(0.7 * i * i); }
    plan.xr.set(xr); plan.xi.set(xi); const [Fr, Fi] = NS.fft1(plan, -1);
    for (let k = 0; k < N; k++) { let dr = 0, di = 0; for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; dr += xr[n] * Math.cos(a) - xi[n] * Math.sin(a); di += xr[n] * Math.sin(a) + xi[n] * Math.cos(a); } worst = Math.max(worst, Math.abs(Fr[k] - dr), Math.abs(Fi[k] - di)); }
  }
  check('FFT: max |FFT − direct DFT| over N = 12…96', worst, 0, 1e-9);
  const N = 24, sp = new NS.Spectral(N), f = new Float64Array(N ** 3), g = new Float64Array(N ** 3), h = 2 * Math.PI / N;
  for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) f[(l * N + j) * N + i] = Math.sin(3 * i * h) * Math.cos(2 * j * h) + 0.5 * Math.cos(5 * l * h) * Math.sin(i * h) + 0.1;
  const re = new Float64Array(sp.NS), im = new Float64Array(sp.NS); sp.forward(f, re, im); sp.inverse(re, im, g);
  let e = 0; for (let i = 0; i < f.length; i++) e = Math.max(e, Math.abs(f[i] - g[i]));
  check('3D real transform round trip (24³)', e, 0, 1e-12);
  check('3D transform: mean mode equals the field mean (0.1)', Math.abs(re[0] - 0.1), 0, 1e-14);
}

// --- exact solutions: ABC (3D Beltrami, e^{−νt}) and 2D Taylor–Green (e^{−2νt}) ---
{
  const s = NS.createSolver({ N: 16, Re: 10, ic: 'abc', cfl: 0.4 }); s.run(1e6, 1.0); const ex = s.exactError(); const d = s.diagnose();
  console.log(`  ABC N16 Re10 t=${s.st.t.toFixed(3)}: ${s.st.step} steps, L∞ err ${ex.linf.toExponential(2)}, E ${d.E.toExponential(6)} (exact ${(1.5 * Math.exp(-2 * 0.1 * s.st.t)).toExponential(6)})`);
  check('ABC exact solution: L∞ velocity error at t = 1', ex.linf, 0, 1e-10);
  check('ABC: energy matches 1.5·e^{−2νt}', Math.abs(d.E / (1.5 * Math.exp(-2 * 0.1 * s.st.t)) - 1), 0, 1e-10);
  check('ABC: divergence round-off', d.divMax, 0, 1e-12);
  check('ABC: nonlinear energy transfer vanishes (|T|/ε)', Math.abs(d.Tnl) / d.eps, 0, 1e-12);
  const s2 = NS.createSolver({ N: 16, Re: 10, ic: 'tgv2d', cfl: 0.4 }); s2.run(1e6, 1.0);
  check('2D Taylor–Green exact decay: L∞ error at t = 1', s2.exactError().linf, 0, 1e-8);
  const e = []; for (const dt of [0.1, 0.05, 0.025]) { const q = NS.createSolver({ N: 16, Re: 10, ic: 'abc', dt }); q.run(1e6, 1.0); e.push(q.exactError().linf); }
  const p1 = Math.log2(e[0] / e[1]), p2 = Math.log2(e[1] / e[2]);
  console.log(`  temporal errors Δt 0.1/0.05/0.025: ${e.map(x => x.toExponential(2)).join(' ')}  orders ${p1.toFixed(2)} ${p2.toFixed(2)}`);
  check('RK4 temporal order (Δt → Δt/2)', p1, 3.7, 4.3);
  check('RK4 temporal order (Δt/2 → Δt/4)', p2, 3.7, 4.3);
}

// --- 3D Taylor–Green at Re 1600: budgets, stretching two ways, refinement ladder toward Brachet's peak ---
{
  const s = NS.createSolver({ N: 32, Re: 1600, ic: 'tgv', cfl: 0.4 }); s.run(1e6, 2.0); const d = s.diagnose();
  console.log(`  TGV 32³ Re1600 t=${s.st.t.toFixed(2)}: E ${d.E.toFixed(6)} Z ${d.Z.toFixed(5)} Pspec ${d.Pspec.toExponential(4)} Pphys ${d.Pphys.toExponential(4)} ebal ${s.st.maxEbal.toExponential(1)} zbal ${s.st.maxZbal.toExponential(1)} kmaxη ${d.kmaxEta.toFixed(2)}`);
  check('TGV: initial energy 1/8', Math.abs(s.st.E0 - 0.125), 0, 1e-14);
  check('TGV: initial enstrophy 3/8', Math.abs(s.st.Z0 - 0.375), 0, 1e-14);
  check('TGV: RK4-consistent energy budget residual', s.st.maxEbal, 0, 1e-5);
  check('TGV: enstrophy budget residual', s.st.maxZbal, 0, 1e-4);
  check('TGV: stretching spectral vs physical (resolved stage, t = 2)', Math.abs(d.Pspec - d.Pphys) / Math.abs(d.Pspec), 0, 1e-6);
  check('TGV: direct skewness ⟨(∂u/∂x)³⟩ vanishes by the TGV reflection symmetry', Math.abs(d.skew), 0, 0.02);
  check('TGV: initial enstrophy production is zero (Pspec at t=0)', Math.abs(s.st.series.Pspec[0]), 0, 1e-12);
  const peaks = []; let dEnd = null, sEnd = null;
  for (const N of [16, 24, 32]) {
    const q = NS.createSolver({ N, Re: 1600, ic: 'tgv', cfl: 0.4 }); q.run(1e6, 10.0); if (N === 32) { dEnd = q.diagnose(); sEnd = q; }
    const ser = q.st.series; let ip = 0; for (let i = 0; i < ser.eps.length; i++) if (ser.eps[i] > ser.eps[ip]) ip = i;
    peaks.push({ N, eps: ser.eps[ip], t: ser.t[ip], health: q.health().worst });
  }
  console.log('  ladder: ' + peaks.map(p => `${p.N}³ ε_max ${p.eps.toFixed(5)} @ t ${p.t.toFixed(2)} (${p.health})`).join(' · ') + '   reference 0.0126–0.013 @ t ≈ 9');
  check('TGV ladder: ε_max increases monotonically with resolution', peaks[0].eps < peaks[1].eps && peaks[1].eps < peaks[2].eps ? 1 : 0, 1, 1);
  check('TGV ladder: under-resolved grids are graded FAIL, not passed off as results', peaks.every(p => p.health === 'FAIL') ? 1 : 0, 1, 1);
  check('TGV 32³: ε_max / Brachet 0.0126 (under-resolved: 0.5–1.05)', peaks[2].eps / 0.0126, 0.5, 1.05);
  check('TGV 32³: time of ε_max (Brachet ≈ 9)', peaks[2].t, 8, 10.5);
  console.log(`  32³ at t=10: align ${dEnd.align.map(a => a.toFixed(3)).join(' ')}  S_iso ${dEnd.skewIso.toFixed(3)}  direct ${dEnd.skew.toFixed(4)}`);
  check('TGV 32³ t=10: vorticity aligns with the intermediate strain eigenvector e₂', dEnd.align[1] > dEnd.align[0] && dEnd.align[1] > dEnd.align[2] ? 1 : 0, 1, 1);
  { const ser = sEnd.st.series; let smin = 0, tmin = 0; for (let i = 0; i < ser.t.length; i++) { const S = -(6 * Math.sqrt(15) / 7) * ser.Pspec[i] / Math.pow(2 * ser.Z[i], 1.5); if (S < smin) { smin = S; tmin = ser.t[i]; } }
    console.log(`  32³: most negative enstrophy-production skewness ${smin.toFixed(3)} at t ${tmin.toFixed(2)} (Brachet: grows from 0 to ≈ −0.5 during the cascade)`);
    check('TGV 32³: peak enstrophy-production skewness (−0.8 … −0.15)', smin, -0.8, -0.15); }
}

// --- vortex tubes and random field: solenoidal, sane energies ---
{
  const s = NS.createSolver({ N: 24, Re: 500, ic: 'tubes' }); s.run(20); const d = s.diagnose();
  check('vortex tubes: divergence-free initial/evolved field', d.divMax, 0, 1e-10);
  check('vortex tubes: energy positive and finite', Number.isFinite(d.E) && d.E > 0 ? 1 : 0, 1, 1);
  const r = NS.createSolver({ N: 24, Re: 500, ic: 'random', icParams: { seed: 7, E0: 0.5 } });
  check('random field: energy scaled to E₀ = 0.5', Math.abs(r.st.E0 - 0.5), 0, 1e-10);
  r.run(10); const dr = r.diagnose(); check('random field: divergence-free after stepping', dr.divMax, 0, 1e-10);
}

// --- diagnostics added for NS-003 (parity with GPU runner 0.1.1): interpolated max|ω|, image gap, pile-up, ‖u‖_L³ ---
{
  // (a) Taylor–Green shifted off the grid by a sub-cell offset in spectral space: the grid maximum must drop below the
  // exact value 2, the spectrally interpolated maximum must recover it. This is the whole point of the diagnostic.
  const N = 32, NH = N / 2 + 1, s = NS.createSolver({ N, Re: 1600, ic: 'tgv' });
  const h = 2 * Math.PI / N, d0 = [0.37 * h, 0.21 * h, 0.44 * h], kw = new Float64Array(N);
  for (let i = 0; i < N; i++) kw[i] = i <= N / 2 ? i : i - N;
  const S = s._S;
  for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < NH; i++) {
    const idx = (l * N + j) * NH + i, ph = -(i * d0[0] + kw[j] * d0[1] + kw[l] * d0[2]), c = Math.cos(ph), sn = Math.sin(ph);
    for (let cc = 0; cc < 3; cc++) { const re0 = S[2 * cc][idx], im0 = S[2 * cc + 1][idx]; S[2 * cc][idx] = re0 * c - im0 * sn; S[2 * cc + 1][idx] = re0 * sn + im0 * c; }
  }
  const d = s.diagnose();
  check('shifted TGV: grid maximum under-reports the exact 2 (sub-grid peak)', d.omMax, 1.90, 1.999);
  check('shifted TGV: spectrally interpolated maximum recovers 2', Math.abs(d.omMaxI - 2), 0, 1e-9);
  check('interpolated maximum ≥ grid maximum', d.omMaxI >= d.omMax ? 1 : 0, 1, 1);
  // (b) cross-instrument: the GPU runner (nslab_gpu.py, float64) gives 7.73221 for the tubes field at 24³ Re 4000, t = 0
  const t24 = NS.createSolver({ N: 24, Re: 4000, ic: 'tubes' }); const dt24 = t24.diagnose();
  check('tubes 24³ interpolated max|ω| vs the GPU runner (7.73221)', Math.abs(dt24.omMaxI - 7.73221), 0, 2e-4);
  check('tubes 24³ grid max|ω| vs the GPU runner (7.69712)', Math.abs(dt24.omMax - 7.69712), 0, 2e-4);
  // (c) image diagnostic: the tube pair occupies a band in z, so the gap to its periodic image is positive;
  //     Taylor–Green fills the box, so its gap is zero.
  check('tubes: periodic-image gap in z is positive at t = 0', dt24.imageGap, 0.5, 6.0);
  check('tubes: enstrophy band z-centroid at π (symmetric initial condition)', Math.abs(dt24.zCentroid - Math.PI), 0, 1e-6);
  const tg = NS.createSolver({ N: 24, Re: 1600, ic: 'tgv' }); const dtg = tg.diagnose();
  check('Taylor–Green fills the box in z: image gap zero', dtg.imageGap, 0, 1e-12);
  // (d) ‖u‖_L³ of the Taylor–Green initial field: ⟨|u|³⟩^{1/3} with |u|² = sin²x cos²y cos²z + cos²x sin²y cos²z
  const ref = (() => { const M = 96; let s3 = 0; for (let l = 0; l < M; l++) for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = i * 2 * Math.PI / M, y = j * 2 * Math.PI / M, z = l * 2 * Math.PI / M;
    const u = Math.sin(x) * Math.cos(y) * Math.cos(z), v = -Math.cos(x) * Math.sin(y) * Math.cos(z);
    s3 += Math.pow(u * u + v * v, 1.5); } return Math.pow(s3 / (M * M * M), 1 / 3); })();
  check('TGV ‖u‖_L³ against a direct quadrature', Math.abs(dtg.uL3 / ref - 1), 0, 5e-3);
  // (e) cutoff pile-up: a smooth, well-resolved field does not accumulate energy at the dealiasing edge
  const sm = NS.createSolver({ N: 48, Re: 1600, ic: 'tgv' }); sm.run(20); const dsm = sm.diagnose();
  check('resolved TGV: no energy pile-up at the cutoff (≤ 1.05)', dsm.pileUp == null ? 1 : dsm.pileUp, 0, 1.05);
  // (f) the health verdict carries its worst archived instant, never only the last
  const hh = sm.health();
  check('health report exposes the worst-instant rows', hh.rows.filter(r => /worst instant/.test(r[0])).length, 3, 4);
  check('health worst verdict is at least as severe as the end-of-run verdict',
    ({ PASS: 0, WARN: 1, FAIL: 2 }[hh.worst] >= { PASS: 0, WARN: 1, FAIL: 2 }[hh.worstEnd]) ? 1 : 0, 1, 1);
}

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
