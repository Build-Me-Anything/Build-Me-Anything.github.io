// Validation of the 2D Navier–Stokes / RANS solver. Quick cases only (the full TMR RANS case lives in test/bench-cfd.js).
const CFD = require('../src/cfd.js');
const WT = require('../src/solver.js');
const potential = (geo, alpha) => { const sys = WT.buildSystem(geo), sol = WT.solveInviscid(sys, alpha); return (x, y) => WT.velocityAt(sys, sol, x, y); };
let fails = 0;
function check(name, val, lo, hi) {
  const ok = val >= lo && val <= hi; if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(62)} ${typeof val === 'number' ? val.toFixed(5) : val}   [${lo}, ${hi}]`);
}
const t0 = Date.now();
const n0012 = WT.naca4(0, 0, 0.12, 96);

// --- mesh ---
let mesh = CFD.makeMesh(n0012.x, n0012.y, 32, 1e-3, 20);
{
  const { NI, NJ, X, Y } = mesh; let minV = Infinity, minAng = 180;
  const nd = (i, j) => j * (NI + 1) + i;
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = nd(i, j), b = nd(i + 1, j), c = nd(i + 1, j + 1), d = nd(i, j + 1);
    const v = 0.5 * ((X[a] * Y[b] - X[b] * Y[a]) + (X[b] * Y[c] - X[c] * Y[b]) + (X[c] * Y[d] - X[d] * Y[c]) + (X[d] * Y[a] - X[a] * Y[d]));
    minV = Math.min(minV, v);
    const e1 = [X[b] - X[a], Y[b] - Y[a]], e2 = [X[d] - X[a], Y[d] - Y[a]];
    const ang = Math.acos((e1[0] * e2[0] + e1[1] * e2[1]) / (Math.hypot(...e1) * Math.hypot(...e2))) * 180 / Math.PI;
    minAng = Math.min(minAng, ang, 180 - ang);
  }
  check('mesh: all cell volumes positive', minV > 0 ? 1 : 0, 1, 1);
  check('mesh: minimum corner angle (deg)', minAng, 8, 90);
  check('mesh: far-field distance ≈ 20 c', mesh.far, 19, 21);
  check('mesh: first-layer spacing honoured', Math.hypot(X[nd(48, 1)] - X[nd(48, 0)], Y[nd(48, 1)] - Y[nd(48, 0)]), 0.9e-3, 1.1e-3);
}

// --- Euler, NACA 0012, M 0.3, α 2°: compare with the panel method + Prandtl–Glauert ---
{
  const sysP = WT.buildSystem(n0012), ref = WT.solveInviscid(sysP, 2).Cl / Math.sqrt(1 - 0.09);
  const s = CFD.setup(n0012.x, n0012.y, { model: 'euler', M: 0.3, alpha: 2, NJ: 32, far: 20, d1: 2e-3, cfl: 20, velocityFn: potential(n0012, 2) });
  const t1 = Date.now(); s.iterate(1500);
  console.log(`  Euler M0.3 α2: ${s.st.iter} it in ${Date.now() - t1} ms, res drop ${Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]).toFixed(2)} orders, Cl ${s.st.Cl.toFixed(4)} (panel+PG ${ref.toFixed(4)}), Cd ${s.st.Cd.toFixed(5)}, Cm ${s.st.Cm.toFixed(4)}`);
  check('Euler 0012 M0.3 α2: converged ≥ 3 orders', Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]), 3, 20);
  check('Euler 0012 M0.3 α2: Cl within 4 % of panel+PG', s.st.Cl / ref, 0.96, 1.04);
  check('Euler 0012 M0.3 α2: spurious drag small (< 0.002)', Math.abs(s.st.Cd), 0, 0.002);
  check('Euler 0012 M0.3 α2: Cm c/4 ≈ 0', Math.abs(s.st.Cm), 0, 0.01);
  const sf = s.forces();
  check('Euler: stagnation Cp ≈ 1 (compressible 1.02)', Math.max(...sf.Cp), 0.95, 1.06);
  check('Euler: y+ array unused (0)', sf.yplus[0], 0, 0);
}

// --- Euler transonic, NACA 0012, M 0.8, α 1.25° (AGARD 211 case: Cl ≈ 0.35, Cd ≈ 0.022) ---
{
  const s = CFD.setup(n0012.x, n0012.y, { model: 'euler', M: 0.8, alpha: 1.25, NJ: 32, far: 20, d1: 2e-3, cfl: 6, velocityFn: potential(n0012, 1.25) });
  const t1 = Date.now(); s.iterate(1500);
  const f = s.field('mach'); let mmax = 0; for (const m of f) mmax = Math.max(mmax, m);
  console.log(`  Euler M0.8 α1.25: ${Date.now() - t1} ms, Cl ${s.st.Cl.toFixed(4)}, Cd ${s.st.Cd.toFixed(5)}, Mmax ${mmax.toFixed(3)}, res drop ${Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]).toFixed(2)}`);
  check('transonic 0012: supersonic pocket present (Mmax > 1.15)', mmax, 1.15, 1.6);
  check('transonic 0012: Cl (ref 0.35 ± coarse-grid 20 %)', s.st.Cl, 0.27, 0.43);
  check('transonic 0012: wave drag Cd (ref 0.022; coarse 0.015–0.035)', s.st.Cd, 0.014, 0.036);
}

// --- laminar NS, NACA 0012, M 0.5, Re 5000, α 0 (Swanson & Langer: Cd ≈ 0.055, Cdp ≈ 0.022, Cdf ≈ 0.033) ---
{
  const s = CFD.setup(n0012.x, n0012.y, { model: 'laminar', M: 0.5, Re: 5000, alpha: 0, NJ: 48, far: 20, d1: 8e-4, cfl: 30, velocityFn: potential(n0012, 0) });
  const t1 = Date.now(); s.iterate(2500);
  console.log(`  laminar Re5000: ${Date.now() - t1} ms, Cd ${s.st.Cd.toFixed(5)} (Cdp ${s.st.Cdp.toFixed(5)}, Cdf ${s.st.Cdf.toFixed(5)}), Cl ${s.st.Cl.toFixed(5)}, res drop ${Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]).toFixed(2)}`);
  check('laminar 0012 Re5000: Cd total (ref 0.055 ± 15 %)', s.st.Cd, 0.047, 0.064);
  check('laminar 0012 Re5000: friction fraction (ref ≈ 0.6)', s.st.Cdf / s.st.Cd, 0.45, 0.75);
  check('laminar 0012 Re5000: Cl ≈ 0 by symmetry', Math.abs(s.st.Cl), 0, 0.01);
}

// --- RANS Spalart–Allmaras, NACA 0012, M 0.15, Re 6e6, α 10° (NASA TMR: Cl 1.091, Cd 0.0123) — short run on a coarse mesh ---
{
  const g = WT.naca4(0, 0, 0.12, 128);
  const s = CFD.setup(g.x, g.y, { model: 'sa', M: 0.15, Re: 6e6, alpha: 10, NJ: 48, far: 25, yplus: 1, cfl: 50, velocityFn: potential(g, 10) });
  const t1 = Date.now(); s.iterate(1500);
  const f = s.forces(); let ypmax = 0; for (const y of f.yplus) ypmax = Math.max(ypmax, y);
  let mtmax = 0; for (const m of s.field('mut')) mtmax = Math.max(mtmax, m);
  console.log(`  SA α10 128x48: ${Date.now() - t1} ms, Cl ${s.st.Cl.toFixed(4)}, Cd ${s.st.Cd.toFixed(5)} (p ${s.st.Cdp.toFixed(5)} f ${s.st.Cdf.toFixed(5)}), y+max ${ypmax.toFixed(2)}, mut/mu max ${mtmax.toFixed(0)}, drop ${Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]).toFixed(2)}`);
  check('SA 0012 α10: Cl within 10 % of TMR (1.091)', s.st.Cl, 0.98, 1.20);
  check('SA 0012 α10: Cd in range (TMR 0.0123; coarse 0.010–0.025)', s.st.Cd, 0.010, 0.025);
  check('SA 0012 α10: turbulent eddy viscosity developed (μt/μ > 100)', mtmax, 100, 1e5);
  check('SA 0012 α10: first-cell y+ ≈ 1', ypmax, 0.3, 3);
}

// --- RANS k-ω SST, same case (NASA TMR SST: Cl 1.080, Cd 0.01256 at α 10°) — same mesh and run length as the SA case above ---
{
  const g = WT.naca4(0, 0, 0.12, 128);
  const s = CFD.setup(g.x, g.y, { model: 'sst', M: 0.15, Re: 6e6, alpha: 10, NJ: 48, far: 25, yplus: 1, cfl: 50, velocityFn: potential(g, 10) });
  const t1 = Date.now(); s.iterate(1500);
  const f = s.forces(); let ypmax = 0; for (const y of f.yplus) ypmax = Math.max(ypmax, y);
  let mtmax = 0; for (const m of s.field('mut')) mtmax = Math.max(mtmax, m);
  // wall condition and blending: first-cell ω against the analytic near-wall solution 6ν/(β₁d²), F1 → 1 at the wall and → 0 in the outer layer
  const A = s._a, NI = s.NI; let i50 = 0; for (let i = 0; i < NI; i++) { const k = s.id(i, 0); if (A.yc[k] > 0 && Math.abs(A.xc[k] - 0.5) < Math.abs(A.xc[s.id(i50, 0)] - 0.5)) i50 = i; }
  const k0 = s.id(i50, 0), wAnalytic = 6 * (A.mu[k0] / A.rho[k0]) / (CFD.SST.b1 * A.wd[k0] * A.wd[k0]);
  let f1min = 1, f1wall = 0; for (let j = 0; j < s.NJ; j++) { const k = s.id(i50, j); if (j === 0) f1wall = A.F1a[k]; if (A.wd[k] < 0.1) f1min = Math.min(f1min, A.F1a[k]); }
  console.log(`  SST α10 128x48: ${Date.now() - t1} ms, Cl ${s.st.Cl.toFixed(4)}, Cd ${s.st.Cd.toFixed(5)} (p ${s.st.Cdp.toFixed(5)} f ${s.st.Cdf.toFixed(5)}), y+max ${ypmax.toFixed(2)}, mut/mu max ${mtmax.toFixed(0)}, drop ${Math.log10(s.st.res0 / s.st.res[s.st.res.length - 1]).toFixed(2)}, ω1/ω_analytic ${(A.tw[k0] / wAnalytic).toFixed(2)}`);
  check('SST 0012 α10: Cl within 10 % of TMR (1.080)', s.st.Cl, 0.97, 1.19);
  check('SST 0012 α10: Cd in range (TMR 0.0126; coarse 0.010–0.025)', s.st.Cd, 0.010, 0.025);
  check('SST 0012 α10: eddy viscosity developed (μt/μ > 100)', mtmax, 100, 1e5);
  check('SST 0012 α10: first-cell y+ ≈ 1', ypmax, 0.3, 3);
  check('SST 0012: first-cell ω ≈ 6ν/(β₁d²) (ratio 0.5–2)', A.tw[k0] / wAnalytic, 0.5, 2);
  check('SST 0012: F1 = 1 at the wall, < 0.05 in the outer layer', f1wall > 0.99 && f1min < 0.05 ? 1 : 0, 1, 1);
  check('SST 0012: no negative k anywhere', Math.min(...s.field('tke')) >= 0 ? 1 : 0, 1, 1);
}

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
