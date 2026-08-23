// TGV refinement ladder: peak dissipation and its time vs N (reference: Brachet 1983 ε_max ≈ 0.0126 at t ≈ 9, Re 1600; 512³ spectral ≈ 0.0129–0.0133)
const NS = require('C:/Users/User/OneDrive/Build Me Anything/pocket-wind-tunnel/src/nslab.js');
const fs = require('fs');
const Re = +(process.argv[2] || 1600), tEnd = +(process.argv[3] || 10), Ns = (process.argv[4] || '24,32,48,64').split(',').map(Number), out = process.argv[5];
const results = [];
for (const N of Ns) {
  const s = NS.createSolver({ N, Re, ic: 'tgv', cfl: 0.4 }); const t0 = Date.now();
  let nextOut = 0; const outs = [];
  while (s.st.t < tEnd - 1e-12) { s.step(); if (s.st.t >= nextOut - 1e-9) { const d = s.diagnose(); outs.push({ t: d.t, E: d.E, eps: d.eps, Z: d.Z, omMax: d.omMax, Pspec: d.Pspec, Pphys: d.Pphys, kmaxEta: d.kmaxEta, skew: d.skew, align: d.align }); nextOut += 1; } }
  const ser = s.st.series; let ip = 0; for (let i = 0; i < ser.eps.length; i++) if (ser.eps[i] > ser.eps[ip]) ip = i;
  let io = 0; for (let i = 0; i < ser.omMax.length; i++) if (ser.omMax[i] > ser.omMax[io]) io = i;
  const h = s.health();
  const r = { N, Re, steps: s.st.step, secs: (Date.now() - t0) / 1000, epsPeak: ser.eps[ip], tEpsPeak: ser.t[ip], omMaxPeak: ser.omMax[io], tOmPeak: ser.t[io], Eend: ser.E[ser.E.length - 1], health: h.worst, ebal: s.st.maxEbal, zbal: s.st.maxZbal, outs, series: { t: ser.t, E: ser.E, eps: ser.eps, omMax: ser.omMax } };
  results.push(r);
  console.log(`N=${N} Re=${Re}: ${s.st.step} steps ${r.secs.toFixed(0)} s  ε_peak ${r.epsPeak.toFixed(5)} at t ${r.tEpsPeak.toFixed(2)}  ω_max peak ${r.omMaxPeak.toFixed(3)} at t ${r.tOmPeak.toFixed(2)}  E(${tEnd}) ${r.Eend.toFixed(5)}  health ${h.worst}  ebal ${s.st.maxEbal.toExponential(1)} zbal ${s.st.maxZbal.toExponential(1)}`);
  for (const row of h.rows) if (row[2] === 'FAIL' || row[2] === 'WARN') console.log('    ', row.join(' | '));
}
if (out) fs.writeFileSync(out, JSON.stringify(results));
