// Longer CFD runs: convergence behaviour and the NASA TMR reference cases (NACA 0012, M 0.15, Re 6e6) for Spalart–Allmaras and k-ω SST.
// Usage: node test/bench-cfd.js [all|euler|lam|sa|sst|stall]
const CFD = require('../src/cfd.js'), WT = require('../src/solver.js');
const potential = (geo, alpha) => { const sys = WT.buildSystem(geo), sol = WT.solveInviscid(sys, alpha || 0); return (x, y) => WT.velocityAt(sys, sol, x, y); };
const run = (label, geo, opts, n) => { const s = CFD.setup(geo.x, geo.y, Object.assign({ velocityFn: potential(geo, opts.alpha) }, opts)); const t = Date.now(); s.iterate(n); const st = s.st, f = s.forces(); let ypmax = 0; for (const y of f.yplus) ypmax = Math.max(ypmax, y);
  console.log(label.padEnd(40), `cells ${s.NI}x${s.NJ} r${s.mesh.ratio.toFixed(3)} d1 ${s.mesh.d1.toExponential(1)}  ${((Date.now()-t)/n).toFixed(1)} ms/it  drop ${Math.log10(st.res0/st.res[st.res.length-1]).toFixed(2)}  Cl ${st.Cl.toFixed(4)} Cd ${st.Cd.toFixed(5)} (p ${st.Cdp.toFixed(5)} f ${st.Cdf.toFixed(5)}) Cm ${st.Cm.toFixed(4)} CpMax ${Math.max(...f.Cp).toFixed(3)} y+max ${ypmax.toFixed(2)}`); return s; };
const g96 = WT.naca4(0,0,0.12,96), g192 = WT.naca4(0,0,0.12,192);
const which = process.argv[2] || 'all';
if (which === 'all' || which === 'euler') {
  run('X1 Euler 1st-order wall p', g96, { model:'euler', M:0.3, alpha:2, NJ:32, far:20, d1:2e-3, cfl:20 }, 2000);
  run('X2 Euler CFL 20', g96, { model:'euler', M:0.3, alpha:2, NJ:32, far:20, d1:2e-3, cfl:20 }, 1500);
  run('X3 Euler CFL 50', g96, { model:'euler', M:0.3, alpha:2, NJ:32, far:20, d1:2e-3, cfl:50 }, 1500);
}
if (which === 'all' || which === 'lam') run('X4 laminar Re5000 192x64', g192, { model:'laminar', M:0.5, Re:5000, alpha:0, NJ:64, far:20, d1:5e-4, cfl:30 }, 4000);
if (which === 'all' || which === 'sa') {
  run('X5 SA TMR a0 192x64 (ref Cd 0.0082)', g192, { model:'sa', M:0.15, Re:6e6, alpha:0, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
  run('X6 SA TMR a10 (ref Cl 1.091 Cd 0.0123)', g192, { model:'sa', M:0.15, Re:6e6, alpha:10, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
}
if (which === 'all' || which === 'sst') {
  run('X7 SST TMR a0 (ref Cd 0.0081)', g192, { model:'sst', M:0.15, Re:6e6, alpha:0, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
  run('X8 SST TMR a10 (ref Cl 1.080 Cd 0.0126)', g192, { model:'sst', M:0.15, Re:6e6, alpha:10, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
}
if (which === 'stall') {   // near-stall comparison: TMR SA Cl 1.546 / Cd 0.0212, SST Cl 1.502 / Cd 0.0230 at α 15°
  run('X9 SA a15 (ref Cl 1.546 Cd 0.0212)', g192, { model:'sa', M:0.15, Re:6e6, alpha:15, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
  run('X10 SST a15 (ref Cl 1.502 Cd 0.0230)', g192, { model:'sst', M:0.15, Re:6e6, alpha:15, NJ:64, far:25, yplus:1, cfl:50 }, 6000);
}
