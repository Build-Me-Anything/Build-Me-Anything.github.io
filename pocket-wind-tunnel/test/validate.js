// Validation suite: checks the solver against thin-aerofoil theory and published NACA data.
const WT = require('../src/solver.js');
let fails = 0;
function check(name, val, lo, hi) {
  const ok = val >= lo && val <= hi;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${typeof val === 'number' ? val.toFixed(4) : val}   [${lo}, ${hi}]`);
}
const t0 = Date.now();
const N = 140;
const sys0012 = WT.buildSystem(WT.naca4(0, 0, 0.12, N));
const sys2412 = WT.buildSystem(WT.naca4(0.02, 0.4, 0.12, N));
const sys4412 = WT.buildSystem(WT.naca4(0.04, 0.4, 0.12, N));
console.log('build time ms', Date.now() - t0);

// --- inviscid ---
let r = WT.solveInviscid(sys0012, 0);
check('0012 a=0 Cl ≈ 0', r.Cl, -1e-3, 1e-3);
check('0012 a=0 Cm ≈ 0', r.Cm, -1e-3, 1e-3);
check('0012 a=0 Cd_inviscid ≈ 0', Math.abs(r.CdInv), 0, 2e-3);
check('0012 a=0 Cp at stagnation ≈ 1', Math.max(...r.Cp), 0.97, 1.001);
check('0012 a=0 Cp,min (ref ≈ -0.43)', r.CpMin, -0.48, -0.38);
r = WT.solveInviscid(sys0012, 5);
check('0012 a=5 Cl (ref panel ≈ 0.60)', r.Cl, 0.57, 0.63);
check('0012 a=5 Cl from circulation matches Cp integration', r.ClGamma / r.Cl, 0.98, 1.02);
check('0012 a=5 Cd_inviscid ≈ 0', Math.abs(r.CdInv), 0, 3e-3);
check('0012 a=5 Cm c/4 ≈ 0', r.Cm, -0.01, 0.01);
r = WT.solveInviscid(sys0012, 8);
check('0012 a=8 Cp,min (ref ≈ -4.2 inviscid)', r.CpMin, -4.8, -3.6);

r = WT.solveInviscid(sys2412, 0);
check('2412 a=0 Cl (ref ≈ 0.25)', r.Cl, 0.22, 0.28);
check('2412 a=0 Cm c/4 (ref ≈ -0.05)', r.Cm, -0.065, -0.04);
r = WT.solveInviscid(sys4412, 0);
check('4412 a=0 Cl (ref ≈ 0.50)', r.Cl, 0.45, 0.55);
check('4412 a=0 Cm c/4 (ref ≈ -0.10)', r.Cm, -0.12, -0.085);

// --- sweeps ---
const cond = { V: 50, chord: 1, altitude: 0, compressible: false };
let sw = WT.sweep(sys2412, cond, -6, 6, 1);
check('2412 zero-lift angle (ref ≈ -2.1°)', sw.alpha0, -2.5, -1.7);
check('2412 lift slope /rad (ref ≈ 6.6 panel)', sw.clAlpha, 6.3, 7.2);
sw = WT.sweep(sys4412, cond, -6, 6, 1);
check('4412 zero-lift angle (ref ≈ -4.0°)', sw.alpha0, -4.6, -3.5);

// --- symmetry ---
const rp = WT.solveInviscid(sys0012, 4), rm = WT.solveInviscid(sys0012, -4);
check('0012 Cl(+4) = -Cl(-4)', rp.Cl + rm.Cl, -1e-6, 1e-6);

// --- field velocity far away → freestream ---
const vf = WT.velocityAt(sys0012, rp, 50, 30);
check('far-field u → cos a', vf[0], Math.cos(4 * Math.PI / 180) - 0.002, Math.cos(4 * Math.PI / 180) + 0.002);
check('far-field v → sin a', vf[1], Math.sin(4 * Math.PI / 180) - 0.002, Math.sin(4 * Math.PI / 180) + 0.002);
check('inside body test', WT.insideBody(sys0012.geo, 0.5, 0) ? 1 : 0, 1, 1);
check('outside body test', WT.insideBody(sys0012.geo, 0.5, 0.2) ? 1 : 0, 0, 0);

// --- ISA ---
let a = WT.isa(0);
check('ISA sea level rho', a.rho, 1.2248, 1.2252);
check('ISA sea level a', a.a, 340.2, 340.4);
a = WT.isa(11000);
check('ISA 11 km p', a.p, 22600, 22660);
check('ISA 11 km T', a.T, 216.6, 216.7);
a = WT.isa(15000);
check('ISA 15 km p (ref 12045)', a.p, 12000, 12100);

// --- viscous ---
let an = WT.analyse(sys0012, { V: 43.8, chord: 1, altitude: 0, alpha: 0, compressible: false }); // Re ≈ 3e6
console.log('  Re', an.Re.toExponential(3), 'xtr U', an.bl.upper.transition && an.bl.upper.transition.x.toFixed(3), 'Cd', an.Cd.toFixed(5));
check('0012 Re 3e6 a=0 Cd (ref exp ≈ 0.0060–0.0070)', an.Cd, 0.005, 0.0085);
check('0012 Re 3e6 a=0 transition location (ref xfoil ≈ 0.5-0.6)', an.bl.upper.transition.x, 0.35, 0.7);
check('0012 a=0 no separation', an.bl.upper.separation ? 1 : 0, 0, 0);
an = WT.analyse(sys0012, { V: 43.8, chord: 1, altitude: 0, alpha: 4, compressible: false });
console.log('  a=4 xtrU', an.bl.upper.transition.x.toFixed(3), 'xtrL', an.bl.lower.transition && an.bl.lower.transition.x.toFixed(3), 'Cd', an.Cd.toFixed(5), 'sepU', an.bl.upper.separation && an.bl.upper.separation.x.toFixed(3));
check('0012 Re 3e6 a=4 Cd (ref ≈ 0.0075–0.0095)', an.Cd, 0.006, 0.011);
an = WT.analyse(sys0012, { V: 43.8, chord: 1, altitude: 0, alpha: 14, compressible: false });
console.log('  a=14 sepU', an.bl.upper.separation && an.bl.upper.separation.x.toFixed(3), 'stall', an.bl.stallWarning, 'Cd', an.Cd.toFixed(5));
check('0012 a=14 upper separation exists', an.bl.upper.separation ? 1 : 0, 1, 1);
an = WT.analyse(sys0012, { V: 14.6, chord: 1, altitude: 0, alpha: 0, compressible: false }); // Re 1e6
console.log('  Re 1e6 xtr', an.bl.upper.transition.x.toFixed(3), 'Cd', an.Cd.toFixed(5));
check('0012 Re 1e6 a=0 Cd (ref ≈ 0.007–0.009)', an.Cd, 0.006, 0.011);
an = WT.analyse(sys0012, { V: 1.46, chord: 1, altitude: 0, alpha: 0, compressible: false }); // Re 1e5
console.log('  Re 1e5 xtr', an.bl.upper.transition && an.bl.upper.transition.x.toFixed(3), an.bl.upper.transition && an.bl.upper.transition.why, 'Cd', an.Cd.toFixed(5));
check('0012 Re 1e5 a=0 Cd (ref ≈ 0.012–0.020)', an.Cd, 0.009, 0.025);

// --- compressibility ---
an = WT.analyse(sys0012, { V: 200, chord: 1, altitude: 0, alpha: 0, compressible: true });
check('0012 Mcr at a=0 (ref ≈ 0.72-0.76)', an.Mcr, 0.68, 0.80);
check('PG factor at M=0.588', an.pg, 1.23, 1.25);
check('Cp* at M=0.7 (ref -0.779)', WT.cpStar(0.7), -0.80, -0.76);

// --- import/repanel round-trip ---
const g = WT.naca4(0.02, 0.4, 0.12, 120);
let txt = 'NACA 2412 test\n';
for (let i = g.x.length - 1; i >= 0; i--) txt += g.x[i].toFixed(6) + ' ' + g.y[i].toFixed(6) + '\n'; // Selig order (TE→upper→LE→lower)
const parsed = WT.parseCoordinates(txt);
const rp2 = WT.repanel(parsed.pts, N);
const sysImp = WT.buildSystem(rp2);
const ri = WT.solveInviscid(sysImp, 3), rr = WT.solveInviscid(sys2412, 3);
check('imported Selig 2412 reproduces Cl', ri.Cl / rr.Cl, 0.98, 1.02);
const st = WT.geometryStats(rp2);
check('imported thickness ≈ 12%', st.thickness, 0.115, 0.125);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}  (${Date.now() - t0} ms)`);
process.exit(fails ? 1 : 0);
