// NS-004 figures: (left) the interpolated peak max|ω| against grid size for every Reynolds number — the convergence
// curves that decide whether a peak is resolved; (right) the converged peaks against viscosity on log–log with the
// fitted slope. Zero dependencies, studio palette, one SVG.
// Usage: node research/nslab/ns004-figure.js [--out ns004-scaling.svg] [--tol 2]
const fs = require('fs'), path = require('path');
const here = __dirname, args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TOL = parseFloat(opt('tol', '2')) / 100, OUT = path.join(here, opt('out', 'ns004-scaling.svg'));

const runs = [];
for (const d of fs.readdirSync(here)) {
  const m = d.match(/^(expl-)?tubes-Re(\d+)-N(\d+)(-fp32)?-gpu$/); if (!m) continue;
  const p = path.join(here, d, 'final.json'); if (!fs.existsSync(p)) continue;
  const r = JSON.parse(fs.readFileSync(p, 'utf8')), s = r.series;
  let io = 0; for (let k = 0; k < s.omMax.length; k++) if (s.omMax[k] > s.omMax[io]) io = k;
  let iz = 0; for (let k = 0; k < s.Z.length; k++) if (s.Z[k] > s.Z[iz]) iz = k;
  const track = (r.peakTrack || []).concat((r.snapshots || []).filter(o => o.omMaxI != null).map(o => ({ omMaxI: o.omMaxI })));
  const omI = track.length ? track.reduce((a, b) => b.omMaxI > a.omMaxI ? b : a).omMaxI : null;
  runs.push({ Re: +m[2], N: +m[3], fp32: !!m[4], nu: r.case.nu, om: s.omMax[io], omI, Z: s.Z[iz] });
}
const byKey = new Map();
for (const r of runs) { const k = r.Re + '/' + r.N, p = byKey.get(k); if (!p || (p.fp32 && !r.fp32)) byKey.set(k, r); }
const byRe = new Map();
for (const r of byKey.values()) { if (!byRe.has(r.Re)) byRe.set(r.Re, []); byRe.get(r.Re).push(r); }
for (const L of byRe.values()) L.sort((a, b) => a.N - b.N);
const Res = [...byRe.keys()].sort((a, b) => a - b);
const val = r => r.omI != null ? r.omI : r.om;
const conv = [];
// same dual criterion as ns004-scaling.js: a settled last step, or the last three rungs inside a 1.5×tol band
for (const Re of Res) {
  const L = byRe.get(Re); if (L.length < 2) continue;
  const a = L[L.length - 2], b = L[L.length - 1], vals = L.map(val);
  const t3 = vals.slice(-3), m3 = t3.reduce((x, y) => x + y, 0) / t3.length;
  const band = t3.length >= 3 ? Math.max(...t3.map(v => Math.abs(v - m3))) / m3 : null;
  const settled = Math.abs(val(b) - val(a)) / Math.abs(val(b)) < TOL;
  if (settled || (band != null && band < 1.5 * TOL)) conv.push({ Re, nu: b.nu, v: band != null && !settled ? m3 : val(b), Z: b.Z, N: b.N });
}

const W = 1000, H = 430, P = { l: 64, r: 24, t: 30, b: 52 }, half = (W - P.l - P.r - 44) / 2;
const COL = ['#4cc9f0', '#06d6a0', '#f4a261', '#a78bfa', '#ff8fa8', '#9fb0c5'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0e141c;font-family:Segoe UI,Helvetica,Arial,sans-serif">`;
const frame = (x0, title) => { svg += `<rect x="${x0}" y="${P.t}" width="${half}" height="${H - P.t - P.b}" fill="#111821" stroke="#223040"/>`;
  svg += `<text x="${x0 + half / 2}" y="${H - 14}" fill="#aab8c9" font-size="12" text-anchor="middle">${esc(title)}</text>`; };

// ---- left: interpolated peak vs N, one line per Re ----
{
  const x0 = P.l, all = [...byKey.values()];
  const Nmin = 96, Nmax = Math.max(...all.map(r => r.N)) * 1.05, vmax = Math.max(...all.map(val)) * 1.08;
  const X = n => x0 + (Math.log(n) - Math.log(Nmin)) / (Math.log(Nmax) - Math.log(Nmin)) * half;
  const Y = v => P.t + (1 - v / vmax) * (H - P.t - P.b);
  frame(x0, 'spectrally interpolated peak max|ω| against grid size (filled = converged rung)');
  for (const n of [96, 128, 160, 192, 224, 256, 288, 320]) { svg += `<line x1="${X(n)}" y1="${P.t}" x2="${X(n)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(n)}" y="${H - P.b + 15}" fill="#8a9bb0" font-size="10" text-anchor="middle">${n}</text>`; }
  for (let v = 0; v <= vmax; v += 25) { svg += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + half}" y2="${Y(v)}" stroke="#223040"/><text x="${x0 - 6}" y="${Y(v) + 4}" fill="#8a9bb0" font-size="10" text-anchor="end">${v}</text>`; }
  Res.forEach((Re, i) => {
    const L = byRe.get(Re), c = COL[i % COL.length], isConv = conv.some(k => k.Re === Re);
    svg += `<polyline points="${L.map(r => X(r.N).toFixed(1) + ',' + Y(val(r)).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="1.8"/>`;
    L.forEach((r, j) => { const last = j === L.length - 1 && isConv;
      svg += `<circle cx="${X(r.N).toFixed(1)}" cy="${Y(val(r)).toFixed(1)}" r="${last ? 5 : 3.4}" fill="${last ? c : '#111821'}" stroke="${c}" stroke-width="1.6"/>`; });
    const lr = L[L.length - 1];
    svg += `<text x="${X(lr.N) - 8}" y="${Y(val(lr)) - 10}" fill="${c}" font-size="11" text-anchor="end">Re ${Re}${isConv ? '' : ' (climbing)'}</text>`;
  });
}
// ---- right: converged peak and Z_max vs ν, log–log ----
{
  const x0 = P.l + half + 44;
  frame(x0, 'converged peak against viscosity (log–log): the ν-scaling of a resolved reconnection');
  if (conv.length >= 2) {
    const nus = conv.map(c => c.nu), vs = conv.map(c => c.v);
    const lx = [Math.min(...nus) * 0.85, Math.max(...nus) * 1.18], ly = [Math.min(...vs) * 0.7, Math.max(...vs) * 1.45];
    const X = n => x0 + (Math.log(n) - Math.log(lx[0])) / (Math.log(lx[1]) - Math.log(lx[0])) * half;
    const Y = v => P.t + (1 - (Math.log(v) - Math.log(ly[0])) / (Math.log(ly[1]) - Math.log(ly[0]))) * (H - P.t - P.b);
    for (const c of conv) { svg += `<line x1="${X(c.nu)}" y1="${P.t}" x2="${X(c.nu)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(c.nu)}" y="${H - P.b + 15}" fill="#8a9bb0" font-size="10" text-anchor="middle">${c.nu.toExponential(1)}</text>`; }
    for (const v of [25, 50, 100, 200]) if (v > ly[0] && v < ly[1]) svg += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + half}" y2="${Y(v)}" stroke="#223040"/><text x="${x0 - 6}" y="${Y(v) + 4}" fill="#8a9bb0" font-size="10" text-anchor="end">${v}</text>`;
    const fit = key => { let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0; for (const c of conv) { const x = Math.log(c.nu), y = Math.log(c[key]); sx += x; sy += y; sxx += x * x; sxy += x * y; n++; }
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n; return { p: -b, a }; };
    const f = fit('v');
    svg += `<line x1="${X(lx[0])}" y1="${Y(Math.exp(f.a + Math.log(lx[0]) * -f.p))}" x2="${X(lx[1])}" y2="${Y(Math.exp(f.a + Math.log(lx[1]) * -f.p))}" stroke="#4cc9f0" stroke-width="1.2" stroke-dasharray="5,4"/>`;
    conv.forEach(c => { svg += `<circle cx="${X(c.nu).toFixed(1)}" cy="${Y(c.v).toFixed(1)}" r="5" fill="#4cc9f0"/><text x="${X(c.nu)}" y="${Y(c.v) - 12}" fill="#4cc9f0" font-size="11" text-anchor="middle">Re ${c.Re} · ${c.v.toFixed(0)} (${c.N}³)</text>`; });
    svg += `<text x="${x0 + 12}" y="${P.t + 22}" fill="#4cc9f0" font-size="13">max|ω|_converged ∝ ν^−${f.p.toFixed(2)}</text>`;
    const fz = fit('Z');
    svg += `<text x="${x0 + 12}" y="${P.t + 42}" fill="#06d6a0" font-size="12">Z_max ∝ ν^−${fz.p.toFixed(2)}  (Kerr 2018 reports ≈ ν^−0.5 for reconnection enstrophy)</text>`;
    svg += `<text x="${x0 + 12}" y="${P.t + 62}" fill="#8a9bb0" font-size="11">${conv.length} converged Reynolds numbers · float32 exploration grade</text>`;
  } else svg += `<text x="${x0 + half / 2}" y="${H / 2}" fill="#5b6b80" font-size="13" text-anchor="middle">fewer than two converged Reynolds numbers</text>`;
}
svg += `<text x="${P.l}" y="${P.t - 10}" fill="#e6edf5" font-size="13">NS-004 · antiparallel vortex tubes · resolution needed for a converged pointwise maximum, and its scaling with viscosity</text></svg>`;
fs.writeFileSync(OUT, svg);
console.log('wrote', OUT, '·', conv.length, 'converged of', Res.length, 'Reynolds numbers');
