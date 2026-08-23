// Validation of the wind-tunnel wall (method of images) extension and the classical blockage corrections.
const WT = require('../src/solver.js');
const HT = require('../src/hyper.js');
let fails = 0;
function check(name, val, lo, hi) {
  const ok = val >= lo && val <= hi; if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(66)} ${typeof val === 'number' ? (Math.abs(val) < 1e-3 ? val.toExponential(3) : val.toFixed(5)) : val}   [${lo}, ${hi}]`);
}
const t0 = Date.now();
const cond = { V: 40, chord: 1, altitude: 0, compressible: false };

// --- 1. wall boundary condition is satisfied exactly by the image system ---
{
  const geo = WT.rotateGeo(WT.naca4(0.02, 0.4, 0.12, 100), 6);
  const walls = { h: 3, yc: 0, open: false, G: 3 };
  const sys = WT.buildSystem(geo, { walls }), sol = WT.solveInviscid(sys, 0);
  let vmax = 0; for (const x of [-1.5, -0.5, 0, 0.3, 0.7, 1.2, 2.5]) for (const y of [1.5, -1.5]) { const v = WT.velocityAt(sys, sol, x, y); vmax = Math.max(vmax, Math.abs(v[1])); }
  check('closed walls: |v| on the wall (NACA 2412 α6 h/c 3)', vmax, 0, 1e-9);
  const far = WT.velocityAt(sys, sol, -40, 0.7);
  check('closed walls: far upstream velocity → (1, 0)', Math.hypot(far[0] - 1, far[1]), 0, 2e-3);
  const wo = { h: 3, yc: 0, open: true, G: 3 };
  const so = WT.buildSystem(geo, { walls: wo }), solo = WT.solveInviscid(so, 0);
  let umax = 0; for (const x of [-1.5, -0.5, 0.3, 0.7, 1.2, 2.5]) for (const y of [1.5, -1.5]) { const v = WT.velocityAt(so, solo, x, y); umax = Math.max(umax, Math.abs(v[0] - 1)); }
  check('open jet: |u − U| on the free boundary (linearised constant pressure)', umax, 0, 1e-9);
  // offset walls
  const wOff = { h: 3, yc: 0.6, open: false, G: 3 };
  const sOff = WT.buildSystem(geo, { walls: wOff }), solOff = WT.solveInviscid(sOff, 0);
  let vm2 = 0; for (const x of [-1, 0.2, 0.8, 2]) for (const y of [2.1, -0.9]) { const v = WT.velocityAt(sOff, solOff, x, y); vm2 = Math.max(vm2, Math.abs(v[1])); }
  check('offset walls (yc 0.6): |v| on both walls', vm2, 0, 1e-9);
}

// --- 2. solid blockage of a cylinder: exact doublet-row result ε = (π²/12)(d/h)² ---
{
  const pts = []; const N = 160; for (let k = 0; k <= N; k++) { const th = -Math.PI + 2 * Math.PI * k / N; pts.push([0.5 + 0.5 * Math.cos(th), 0.5 * Math.sin(th)]); }
  // clockwise closed list starting/ending at the rear point (0,1)… convert: our convention TE→lower→LE→upper→TE
  const cyl = { x: pts.map(p => p[0]), y: pts.map(p => -p[1]), iLE: N / 2, name: 'cylinder' };
  const free = WT.buildSystem(cyl), sF = WT.solveInviscid(free, 0);
  const hc = 8, walls = { h: hc, yc: 0, open: false, G: 3 };
  const tun = WT.buildSystem(cyl, { walls }), sT = WT.solveInviscid(tun, 0);
  let vF = 0, vT = 0; for (let i = 0; i < free.n; i++) { vF = Math.max(vF, Math.abs(sF.Vt[i])); vT = Math.max(vT, Math.abs(sT.Vt[i])); }
  const epsNum = vT / vF - 1, epsTh = Math.PI * Math.PI / 12 / (hc * hc);
  console.log(`  cylinder d/h = ${(1 / hc).toFixed(3)}: peak-velocity blockage ${epsNum.toExponential(3)}, theory (π²/12)(d/h)² = ${epsTh.toExponential(3)}`);
  check('cylinder solid blockage vs doublet-row theory (±15 %)', epsNum / epsTh, 0.85, 1.15);
  const Lam = WT.shapeFactor(free, sF).Lambda;
  check('cylinder shape factor Λ = 8μ/(πUc²) = 4 (μ = 2πUR², c = 2R)', Lam, 3.9, 4.1);
}

// --- 3. NACA 0012 shape factor and blockage ---
{
  const g = WT.naca4(0, 0, 0.12, 120), free = WT.buildSystem(g), sF = WT.solveInviscid(free, 0);
  const Lam = WT.shapeFactor(free, sF).Lambda;
  console.log(`  NACA 0012 shape factor Λ = ${Lam.toFixed(3)} (charted values ≈ 0.2–0.3 for 12 % sections)`);
  check('NACA 0012 Λ in the charted range', Lam, 0.15, 0.40);
  const hc = 4, walls = { h: hc, yc: 0, open: false, G: 3 };
  const tun = WT.buildSystem(g, { walls }), sT = WT.solveInviscid(tun, 0);
  const epsNum = Math.sqrt(1 - sT.CpMin) / Math.sqrt(1 - sF.CpMin) - 1, sigma = Math.PI ** 2 / 48 / hc ** 2;
  console.log(`  NACA 0012 h/c 4: peak-velocity increase ${epsNum.toExponential(3)}, Λσ = ${(Lam * sigma).toExponential(3)}`);
  check('NACA 0012 blockage: peak-velocity increase ≈ Λσ (±35 %)', epsNum / (Lam * sigma), 0.65, 1.35);
}

// --- 4. lift in a closed tunnel: flat plate vs classical streamline-curvature theory ---
{
  const plate = WT.naca4(0, 0, 0.06, 120);   // thin symmetric section (a 1 % diamond is too thin for constant-source panels)
  const alpha = 4, hc = 3, sigma = Math.PI ** 2 / 48 / hc ** 2;
  const free = WT.buildSystem(plate), sF = WT.solveInviscid(free, alpha);
  const tun = WT.buildSystem(WT.rotateGeo(plate, alpha), { walls: { h: hc, yc: 0, open: false, G: 3 } }), sT = WT.solveInviscid(tun, 0);
  const ratio = sT.Cl / sF.Cl;
  // classical thin-plate estimate: Cl_u(1−σ) = Cl_free(α + Δα), Δα = σ Cl_u/(2π) → ratio ≈ 1.047, plus 2ε_sb ≈ +0.5 % for 6 % thickness
  const Lam6 = WT.shapeFactor(free, sF).Lambda;
  const corr = WT.tunnelCorrections(hc, sT.Cl, sT.Cm, 0, alpha, Lam6);
  const sFc = WT.solveInviscid(free, corr.alphaC);
  console.log(`  NACA 0006 α4 h/c 3: Cl tunnel/free = ${ratio.toFixed(4)} (thin-plate theory ≈ 1.047 + 2Λσ = ${(1.047 + 2 * Lam6 * sigma).toFixed(4)}); corrected Cl ${corr.ClC.toFixed(4)} vs free air at α_c ${corr.alphaC.toFixed(3)}°: ${sFc.Cl.toFixed(4)}`);
  check('NACA 0006 h/c 3: tunnel lift increase vs classical theory', ratio, 1.03, 1.075);
  check('NACA 0006 h/c 3: classical correction recovers free air within 1.5 %', corr.ClC / sFc.Cl, 0.985, 1.015);
  const open = WT.buildSystem(WT.rotateGeo(plate, alpha), { walls: { h: hc, yc: 0, open: true, G: 3 } }), sO = WT.solveInviscid(open, 0);
  check('open jet reduces lift (ratio < 1)', sO.Cl / sF.Cl, 0.85, 0.995);
  console.log(`  open jet h/c 3: Cl ratio ${(sO.Cl / sF.Cl).toFixed(4)}`);
}

// --- 5. full section (NACA 2412, α 6, h/c 2.5): corrected values vs free air ---
{
  const g = WT.naca4(0.02, 0.4, 0.12, 120), alpha = 6, hc = 2.5;
  const free = WT.buildSystem(g), aF = WT.analyse(free, Object.assign({ alpha }, cond));
  const tun = WT.buildSystem(WT.rotateGeo(g, alpha), { walls: { h: hc, yc: 0, open: false, G: 3 } }), aT = WT.analyse(tun, Object.assign({ alpha: 0 }, cond));
  const Lam = WT.shapeFactor(free, aF.inv).Lambda;
  const c = WT.tunnelCorrections(hc, aT.Cl, aT.Cm, aT.Cd, alpha, Lam);
  const aFc = WT.analyse(free, Object.assign({ alpha: c.alphaC }, cond));
  console.log(`  NACA 2412 α6 h/c 2.5: measured Cl ${aT.Cl.toFixed(4)} Cm ${aT.Cm.toFixed(4)} Cd ${aT.Cd.toFixed(5)} | corrected Cl ${c.ClC.toFixed(4)} Cm ${c.CmC.toFixed(4)} Cd ${c.CdC.toFixed(5)} at α_c ${c.alphaC.toFixed(2)} | free air Cl ${aFc.Cl.toFixed(4)} Cm ${aFc.Cm.toFixed(4)} Cd ${aFc.Cd.toFixed(5)} | σ ${c.sigma.toFixed(4)} Λ ${Lam.toFixed(3)} ε_sb ${c.eSb.toExponential(2)} ε_wb ${c.eWb.toExponential(2)}`);
  check('2412 h/c 2.5: tunnel overpredicts lift (Cl_u > Cl_free)', aT.Cl / aF.Cl, 1.02, 1.25);
  check('2412 h/c 2.5: corrected Cl within 2 % of free air at α_c', c.ClC / aFc.Cl, 0.98, 1.02);
  check('2412 h/c 2.5: corrected Cm within 0.01 of free air', Math.abs(c.CmC - aFc.Cm), 0, 0.01);
  const t1 = Date.now(); for (let k = 0; k < 10; k++) WT.buildSystem(WT.rotateGeo(g, alpha + k), { walls: { h: hc, yc: 0, open: false, G: 3 } });
  console.log(`  build time with walls: ${((Date.now() - t1) / 10).toFixed(1)} ms per system (120 panels)`);
}

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURES'}  (${Date.now() - t0} ms)`);
process.exit(fails ? 1 : 0);
