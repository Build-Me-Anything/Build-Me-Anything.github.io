// Validation suite for the hypersonic core: NACA 1135 tables, Anderson worked examples, US Standard Atmosphere 1976.
const HT = require('../src/hyper.js');
const WT = require('../src/solver.js');
const DEG = Math.PI / 180;
let fails = 0;
function check(name, val, lo, hi) {
  const ok = val >= lo && val <= hi;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${typeof val === 'number' ? (Math.abs(val) < 1e-2 || Math.abs(val) > 1e5 ? val.toExponential(3) : val.toFixed(4)) : val}   [${lo}, ${hi}]`);
}
const t0 = Date.now();

// --- US Standard Atmosphere 1976 (geometric altitudes) ---
let a = HT.us76(0); check('US76 sea level p', a.p, 101320, 101330);
a = HT.us76(11000); check('US76 11 km T (geopotential 10.98 km → 216.8 K)', a.T, 216.6, 217.0);
a = HT.us76(30000); check('US76 30 km p (ref 1197 Pa)', a.p, 1185, 1210); check('US76 30 km T (ref 226.5 K)', a.T, 226.0, 227.0);
a = HT.us76(50000); check('US76 50 km p (ref 79.78 Pa)', a.p, 79.0, 80.5); check('US76 50 km T (ref 270.65 K)', a.T, 270.6, 270.7);
a = HT.us76(70000); check('US76 70 km p (ref 5.221 Pa)', a.p, 5.15, 5.30); check('US76 70 km T (ref 219.6 K)', a.T, 219.3, 219.9);
a = HT.us76(80000); check('US76 80 km p (ref 1.052 Pa)', a.p, 1.03, 1.08); check('US76 80 km T (ref 198.6 K)', a.T, 198.3, 199.0);
check('US76 80 km mean free path (ref ≈ 4 mm)', a.lambda, 0.003, 0.006);

// --- shock & expansion relations (NACA 1135, γ = 1.4) ---
let os = HT.obliqueShock(2, 10 * DEG, 1.4);
check('M2 θ10° β (ref 39.31°)', os.beta / DEG, 39.2, 39.4);
check('M2 θ10° p2/p1 (ref 1.7066)', os.p2p1, 1.70, 1.71);
check('M2 θ10° M2 (ref 1.6405)', os.M2, 1.635, 1.645);
os = HT.obliqueShock(3, 20 * DEG, 1.4);
check('M3 θ20° β (ref 37.76°)', os.beta / DEG, 37.6, 37.9);
check('M3 θ20° p2/p1 (ref 3.771)', os.p2p1, 3.75, 3.80);
check('M3 θ20° M2 (ref 1.994)', os.M2, 1.98, 2.01);
check('θmax M2 (ref 22.97°)', HT.thetaMax(2, 1.4).theta / DEG, 22.9, 23.1);
check('θmax M3 (ref 34.07°)', HT.thetaMax(3, 1.4).theta / DEG, 34.0, 34.2);
check('detachment: M2 θ25° → null', HT.obliqueShock(2, 25 * DEG, 1.4) === null ? 1 : 0, 1, 1);
let ns = HT.normalShock(5, 1.4);
check('normal shock M5 p2/p1 (ref 29.0)', ns.p2p1, 28.9, 29.1);
check('normal shock M5 T2/T1 (ref 5.80)', ns.T2T1, 5.78, 5.82);
check('normal shock M5 M2 (ref 0.4152)', ns.M2, 0.414, 0.416);
check('pitot M5 p02/p1 (ref 32.65)', HT.pitot(5, 1.4), 32.6, 32.7);
check('pitot M1.5 (ref 3.413)', HT.pitot(1.5, 1.4), 3.40, 3.42);
check('PM ν(2) (ref 26.38°)', HT.pm(2, 1.4) / DEG, 26.3, 26.45);
check('PM ν(3) (ref 49.76°)', HT.pm(3, 1.4) / DEG, 49.7, 49.8);
check('PM inverse ν=49.76° → M3', HT.pmInverse(49.76 * DEG, 1.4), 2.99, 3.01);
check('PM νmax γ1.4 (ref 130.45°)', HT.pmMax(1.4) / DEG, 130.4, 130.5);
check('PM ν(2) γ=1.3 (ref 28.6°)', HT.pm(2, 1.3) / DEG, 28.3, 28.9);

// --- Newtonian flat plate (classic Cp,max = 2): Cl = 2 sin²α cosα, L/D = cot α ---
const plate = HT.shapes.flatPlate(0.0001, 20);
let r = HT.analyse(plate, { M: 10, altitude: 30000, alpha: 10, chord: 1, gamma: 1.4, Tw: 300, method: 'newtonClassic', bl: 'lam' });
check('Newtonian plate α10 Cl (ref 0.0594)', r.Cl, 0.058, 0.061);
check('Newtonian plate α10 L/D inviscid ≈ cot α = 5.67', r.Cl / r.CdWave, 5.6, 5.75);
check('Newtonian plate: Cd_wave = 2 sin³α = 0.01047', r.CdWave, 0.0102, 0.0107);

// --- modified Newtonian Cp,max at M5 = (32.65−1)/17.5 = 1.809 ---
r = HT.analyse(plate, { M: 5, altitude: 30000, alpha: 10, chord: 1, gamma: 1.4, method: 'newton', bl: 'lam' });
check('modified Newtonian Cp,max M5 (ref 1.809)', r.CpMax, 1.80, 1.82);

// --- shock-expansion: flat plate at M=3, α=5° vs exact oblique shock / PM ---
r = HT.analyse(plate, { M: 3, altitude: 20000, alpha: 5, chord: 1, gamma: 1.4, method: 'se', bl: 'lam' });
const osP = HT.obliqueShock(3, 5 * DEG, 1.4), Mexp = HT.pmInverse(HT.pm(3, 1.4) + 5 * DEG, 1.4);
const cpL = (osP.p2p1 - 1) / (0.7 * 9), cpU = (HT.isenP(Mexp, 1.4) / HT.isenP(3, 1.4) - 1) / (0.7 * 9);
check('SE plate M3 α5 lower Cp = oblique shock value', r.lower.Cp[5] / cpL, 0.99, 1.01);
check('SE plate M3 α5 upper Cp = PM value', r.upper.Cp[5] / cpU, 0.99, 1.01);
check('SE plate M3 α5 Cn ≈ (cpL − cpU) = ' + (cpL - cpU).toFixed(4), r.Cl / Math.cos(5 * DEG), (cpL - cpU) * 0.98, (cpL - cpU) * 1.02);
check('SE plate: linear theory Cl = 4α/√(M²−1) = 0.1234 within 6 %', r.Cl, 0.116, 0.131);

// --- symmetric diamond at α=0, M=3: wave drag vs linear theory 4ε²/√(M²−1) ---
const dia = HT.shapes.diamond(2 * Math.tan(5 * DEG) * 0.5, 0.5, 40);  // ε = 5°
r = HT.analyse(dia, { M: 3, altitude: 20000, alpha: 0, chord: 1, gamma: 1.4, method: 'se', bl: 'lam' });
check('diamond ε5° M3 Cd,wave (linear 0.01078; exact ≈ 0.0110)', r.CdWave, 0.0105, 0.0118);
check('diamond ε5° M3 Cl = 0 by symmetry', Math.abs(r.Cl), 0, 1e-6);
check('diamond: LE shock attached', r.upper.leShock.attached ? 1 : 0, 1, 1);
check('diamond: expansion fan recorded at shoulder', r.upper.waves.some(w => w.type === 'fan') ? 1 : 0, 1, 1);
check('diamond: TE recompression shock recorded', r.upper.teWave ? 1 : 0, 1, 1);
// tangent-wedge on the diamond front faces must equal the exact wedge value
const rw = HT.analyse(dia, { M: 3, altitude: 20000, alpha: 0, chord: 1, gamma: 1.4, method: 'wedge', bl: 'lam' });
check('tangent-wedge front face Cp = SE front face Cp', rw.upper.Cp[2] / r.upper.Cp[2], 0.999, 1.001);

// --- blunt nose: NACA 0012 at M8 — detached shock, Newtonian nose, sonic switch, then expansion ---
const n0012 = WT.naca4(0, 0, 0.12, 120); n0012.t = 0.12;
r = HT.analyse(n0012, { M: 8, altitude: 30000, alpha: 0, chord: 1, gamma: 1.4, Tw: 800, method: 'se', bl: 'trans', RexTr: 2e6 });
check('0012 M8: LE shock detached', r.detached ? 1 : 0, 1, 1);
check('0012 M8: stagnation Cp ≈ Cp,max (1.836)', Math.max(...r.upper.Cp), r.CpMax * 0.9, r.CpMax * 1.001);
check('0012 M8: nose regime present then supersonic expansion', r.upper.regime.indexOf('N') >= 0 && r.upper.regime.indexOf('E') > 0 ? 1 : 0, 1, 1);
check('0012 M8: Cl = 0 by symmetry', Math.abs(r.Cl), 0, 1e-6);
check('0012 M8: Cd,wave order of magnitude (0.02–0.08)', r.CdWave, 0.02, 0.08);
check('0012 M8: LE radius 1.1019 t² = 0.01587', r.rn, 0.0158, 0.0159);
check('0012 M8: Sutton–Graves stagnation heating finite and positive', r.qStag > 0 && Number.isFinite(r.qStag) ? 1 : 0, 1, 1);
check('0012 M8: Cd_f positive, smaller than wave drag', r.CdF > 0 && r.CdF < r.CdWave ? 1 : 0, 1, 1);
check('0012 M8: T0 perfect gas = 226.5·(1+0.2·64) = 3125 K', r.T0, 3100, 3150);
check('0012 M8: real-gas warning raised', r.warnings.some(w => /dissociation/.test(w)) ? 1 : 0, 1, 1);
check('0012 M8: Billig stand-off Δ/R = 0.386·exp(4.67/64) = 0.415', r.billig.standoff, 0.41, 0.42);

// --- Sutton–Graves & Billig direct ---
check('Sutton–Graves ρ=1e-4, V=7 km/s, Rn=1 m (sphere 5.97e5 W/m²)', HT.suttonGraves(1e-4, 7000, 1), 5.9e5, 6.05e5);
check('Billig cylinder M→∞ stand-off → 0.386', HT.billig(1000).standoff, 0.385, 0.387);

// --- reference-temperature method reduces to Blasius / Schlichting at low speed with Tw = Te ---
const flat = HT.shapes.flatPlate(0.0001, 40);
r = HT.analyse(flat, { M: 1.3, altitude: 0, alpha: 0, chord: 1, gamma: 1.4, Tw: 288.15 * (1 + 0.2 * 1.69), method: 'se', bl: 'lam' });
// at Tw chosen = T0 ≈ Taw-ish the reference temperature stays close to Te; check Cf ~ 0.664/√Rex within 25 %
{ const k = 20, p = r.surf.upper[k], Rex = r.atm.rho * r.V * p.s / r.atm.mu; check('ref-T laminar Cf ≈ Blasius (within 25 %)', r.upperV.Cf[k] / (0.664 / Math.sqrt(Rex)), 0.75, 1.25); }
r = HT.analyse(flat, { M: 1.3, altitude: 0, alpha: 0, chord: 1, gamma: 1.4, Tw: 288.15 * (1 + 0.2 * 1.69), method: 'se', bl: 'turb' });
{ const k = 20, p = r.surf.upper[k], Rex = r.atm.rho * r.V * p.s / r.atm.mu; check('ref-T turbulent Cf ≈ 0.0592 Re^-0.2 (within 25 %)', r.upperV.Cf[k] / (0.0592 / Math.pow(Rex, 0.2)), 0.75, 1.25); }
// hot wall reduces heat flux; cold wall increases it
const hot = HT.analyse(flat, { M: 6, altitude: 30000, alpha: 0, chord: 1, gamma: 1.4, Tw: 1500, method: 'se', bl: 'lam' });
const cold = HT.analyse(flat, { M: 6, altitude: 30000, alpha: 0, chord: 1, gamma: 1.4, Tw: 300, method: 'se', bl: 'lam' });
check('cold wall heats more than hot wall', cold.heat.Q / hot.heat.Q, 1.2, 40);
check('M6 plate 30 km: laminar heat flux at x=0.5 m order 1e4–1e5 W/m²', cold.upperV.qw[20], 5e3, 3e5);

// --- sweep ---
const sw = HT.sweep(dia, { M: 6, altitude: 30000, chord: 2, gamma: 1.4, Tw: 600, method: 'se', bl: 'trans', RexTr: 2e6 }, -4, 20, 2);
check('sweep returns 13 points', sw.points.length, 13, 13);
check('sweep best L/D exists and is positive', sw.bestLD && sw.bestLD.LD > 0 ? 1 : 0, 1, 1);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}  (${Date.now() - t0} ms)`);
process.exit(fails ? 1 : 0);
