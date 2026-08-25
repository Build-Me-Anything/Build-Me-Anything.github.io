// NS-004 figure: (left) the spectrally interpolated peak max|ω| against grid size for every Reynolds number — the
// convergence curves that decide whether a peak is resolved; (right) the resolution those curves require, as rungs
// with the current candidate marked. Colour = Reynolds number; shape = status (filled converged, open under
// verification, triangle lower bound). No scaling fit is drawn. Zero dependencies, studio palette, one SVG.
// Usage: node research/nslab/ns004-figure.js [--out ns004-resolution.svg] [--tol 2]
const fs = require('fs'), path = require('path');
const here = __dirname, args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TOL = parseFloat(opt('tol', '2')) / 100, OUT = path.join(here, opt('out', 'ns004-resolution.svg'));

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

// ---- status per Reynolds number: ONE source of truth, used identically by both panels ----
// filled   = verified converged (criterion met and no verification rung outstanding)
// open     = under verification (criterion met, but a further rung is queued or running and has not landed)
// triangle = lower bound / non-convergence demonstrated (criterion not met)
// PENDING names the rung awaited for each Reynolds number; when that rung appears in the archive the status
// recomputes itself, so the figure cannot drift out of step with the runs.
const PENDING = { 707: 256, 1000: 288, 1414: 288 };
const status = (Re) => {
  const L = byRe.get(Re) || [], met = conv.some(c => c.Re === Re);
  const awaited = PENDING[Re], landed = awaited == null || L.some(r => r.N >= awaited);
  if (!met) {   // a sequence whose maximum is not at its finest rung plateaued and then fell: a shelf, not a climb
    const v = L.map(val); let im = 0; for (let k = 0; k < v.length; k++) if (v[k] > v[im]) im = k;
    return { kind: 'bound', label: (im > 0 && im < v.length - 1) ? 'false convergence shelf' : 'climbing' };
  }
  if (!landed) return { kind: 'open', label: 'under verification' };
  return { kind: 'filled', label: 'converged' };
};

// Layout is laid out so nothing overlaps: plot area ends at H − P.b, tick labels sit 15 px below it, the panel
// caption 20 px below those, and the two legend lines below that again.
const W = 1000, H = 500, P = { l: 64, r: 24, t: 30, b: 110 }, half = (W - P.l - P.r - 44) / 2;
const AX = H - P.b + 15, CAP = H - P.b + 36, LEG1 = H - P.b + 62, LEG2 = H - P.b + 82;
const COL = ['#4cc9f0', '#ffd166', '#f4a261', '#a78bfa', '#ff8fa8', '#06d6a0'];   // Re 1000 amber: the shelf case the figure is about should not read as muted grey
// Colour means Reynolds number, in both panels; SHAPE alone means status. (An earlier version coloured by status in
// the right panel, which collided with the series palette — Re 1000 read green there and green meant "converged".)
const colOf = Re => COL[Res.indexOf(Re) % COL.length];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0e141c;font-family:Segoe UI,Helvetica,Arial,sans-serif">`;
const frame = (x0, title) => { svg += `<rect x="${x0}" y="${P.t}" width="${half}" height="${H - P.t - P.b}" fill="#111821" stroke="#223040"/>`;
  svg += `<text x="${x0 + half / 2}" y="${CAP}" fill="#aab8c9" font-size="12" text-anchor="middle">${esc(title)}</text>`; };

// ---- left: interpolated peak vs N, one line per Re ----
{
  const x0 = P.l, all = [...byKey.values()];
  const Nmin = 96, Nmax = Math.max(...all.map(r => r.N)) * 1.05, vmax = Math.max(...all.map(val)) * 1.08;
  const X = n => x0 + (Math.log(n) - Math.log(Nmin)) / (Math.log(Nmax) - Math.log(Nmin)) * half;
  const Y = v => P.t + (1 - v / vmax) * (H - P.t - P.b);
  frame(x0, 'spectrally interpolated peak max|ω| against grid size');
  for (const n of [96, 128, 160, 192, 224, 256, 288, 320, 384]) { svg += `<line x1="${X(n)}" y1="${P.t}" x2="${X(n)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(n)}" y="${AX}" fill="#8a9bb0" font-size="10" text-anchor="middle">${n}³</text>`; }
  for (let v = 0; v <= vmax; v += 25) { svg += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + half}" y2="${Y(v)}" stroke="#223040"/><text x="${x0 - 6}" y="${Y(v) + 4}" fill="#8a9bb0" font-size="10" text-anchor="end">${v}</text>`; }
  Res.forEach((Re, i) => {
    const L = byRe.get(Re), c = COL[i % COL.length], st = status(Re);
    svg += `<polyline points="${L.map(r => X(r.N).toFixed(1) + ',' + Y(val(r)).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="1.8"/>`;
    L.forEach((r, j) => {
      const last = j === L.length - 1, cx = X(r.N), cy = Y(val(r));
      if (last && st.kind === 'bound') svg += `<path d="M ${cx.toFixed(1)} ${(cy - 6).toFixed(1)} l -5.5 9.5 h 11 z" fill="${c}"/>`;
      else svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${last ? 5 : 3.4}" fill="${last && st.kind === 'filled' ? c : '#111821'}" stroke="${c}" stroke-width="${last ? 2 : 1.6}"/>`;
    });
  });
  // series key stacked in the empty top-left of the panel (all curves start low, so this region is clear) —
  // labels next to the last point overlapped each other and the curves
  Res.forEach((Re, i) => {
    const c = COL[i % COL.length], st = status(Re), ty = P.t + 20 + 15 * i;
    if (st.kind === 'bound') svg += `<path d="M ${x0 + 14} ${ty - 9} l -5 8 h 10 z" fill="${c}"/>`;
    else svg += `<circle cx="${x0 + 14}" cy="${ty - 4}" r="4.5" fill="${st.kind === 'filled' ? c : '#111821'}" stroke="${c}" stroke-width="1.8"/>`;
    svg += `<text x="${x0 + 26}" y="${ty}" fill="${c}" font-size="11">Re ${Re} — ${st.label}</text>`;
  });
}
// ---- right: the resolution requirement, as brackets and lower bounds ----
// Deliberately NOT a log–log scaling fit. Until the verification rungs return, drawing a fit line across these
// Reynolds numbers would imply a scaling law the evidence does not support, however it were labelled. The visual
// hierarchy is: demonstrated convergence, then non-converged cases, then the resolution requirement — and only after
// the verification rungs would any Re-to-peak relationship belong on a figure at all.
{
  const x0 = P.l + half + 44;
  frame(x0, 'resolution required for a converged pointwise maximum (ticks = ladder rungs)');
  const RES = Res.filter(r => byRe.get(r).length);
  const rlo = Math.min(...RES) / 1.25, rhi = Math.max(...RES) * 1.25;
  const allN = [...byKey.values()].map(r => r.N), nlo = Math.min(...allN) / 1.15, nhi = Math.max(...allN) * 1.25;
  const X = r => x0 + (Math.log(r) - Math.log(rlo)) / (Math.log(rhi) - Math.log(rlo)) * half;
  const Y = n => P.t + (1 - (Math.log(n) - Math.log(nlo)) / (Math.log(nhi) - Math.log(nlo))) * (H - P.t - P.b);
  for (const r of RES) svg += `<line x1="${X(r)}" y1="${P.t}" x2="${X(r)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(r)}" y="${AX}" fill="#8a9bb0" font-size="10" text-anchor="middle">Re ${r}</text>`;
  for (const n of [128, 192, 256, 320]) if (n > nlo && n < nhi) svg += `<line x1="${x0}" y1="${Y(n)}" x2="${x0 + half}" y2="${Y(n)}" stroke="#223040"/><text x="${x0 - 6}" y="${Y(n) + 4}" fill="#8a9bb0" font-size="10" text-anchor="end">${n}³</text>`;
  for (const r of RES) {
    const L = byRe.get(r), st = status(r), c = colOf(r);
    svg += `<line x1="${X(r)}" y1="${Y(L[0].N)}" x2="${X(r)}" y2="${Y(L[L.length - 1].N)}" stroke="${c}" stroke-width="1.4" opacity="0.5"/>`;
    L.forEach(rr => { svg += `<line x1="${X(r) - 7}" y1="${Y(rr.N)}" x2="${X(r) + 7}" y2="${Y(rr.N)}" stroke="${c}" stroke-width="1.4" opacity="0.75"/>`; });
    const cand = L[L.length - 1];
    if (st.kind === 'bound') svg += `<path d="M ${X(r)} ${Y(cand.N) - 7} l -6 10 h 12 z" fill="${c}"/>`;
    else svg += `<circle cx="${X(r)}" cy="${Y(cand.N)}" r="5.5" fill="${st.kind === 'filled' ? c : 'none'}" stroke="${c}" stroke-width="2"/>`;
    // only the rung size is written at the point — the status words went to the key, where they cannot collide
    svg += `<text x="${X(r)}" y="${Y(cand.N) - 14}" fill="${c}" font-size="10" text-anchor="middle">${cand.N}³</text>`;
  }
  const nConv = RES.filter(r => status(r).kind === 'filled').length;
  svg += `<text x="${x0 + 12}" y="${P.t + 20}" fill="#8a9bb0" font-size="11">no viscosity-scaling fit is drawn:</text>`;
  svg += `<text x="${x0 + 12}" y="${P.t + 36}" fill="#8a9bb0" font-size="11">only ${nConv} of ${RES.length} Reynolds numbers</text>`;
  svg += `<text x="${x0 + 12}" y="${P.t + 52}" fill="#8a9bb0" font-size="11">have a converged pointwise maximum</text>`;
}
// ---- (retained, unused) log–log scaling panel ----
if (false) {
  const x0 = P.l + half + 44;
  if (conv.length >= 2) {
    const nus = conv.map(c => c.nu), vs = conv.map(c => c.v);
    const lx = [Math.min(...nus) * 0.85, Math.max(...nus) * 1.18], ly = [Math.min(...vs) * 0.7, Math.max(...vs) * 1.45];
    const X = n => x0 + (Math.log(n) - Math.log(lx[0])) / (Math.log(lx[1]) - Math.log(lx[0])) * half;
    const Y = v => P.t + (1 - (Math.log(v) - Math.log(ly[0])) / (Math.log(ly[1]) - Math.log(ly[0]))) * (H - P.t - P.b);
    for (const c of conv) { svg += `<line x1="${X(c.nu)}" y1="${P.t}" x2="${X(c.nu)}" y2="${H - P.b}" stroke="#223040"/><text x="${X(c.nu)}" y="${H - P.b + 15}" fill="#8a9bb0" font-size="10" text-anchor="middle">${c.nu.toExponential(1)}</text>`; }
    for (const v of [25, 50, 100, 200]) if (v > ly[0] && v < ly[1]) svg += `<line x1="${x0}" y1="${Y(v)}" x2="${x0 + half}" y2="${Y(v)}" stroke="#223040"/><text x="${x0 - 6}" y="${Y(v) + 4}" fill="#8a9bb0" font-size="10" text-anchor="end">${v}</text>`;
    const fit = key => { let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0; for (const c of conv) { const x = Math.log(c.nu), y = Math.log(c[key]); sx += x; sy += y; sxx += x * x; sxy += x * y; n++; }
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n; return { p: -b, a }; };
    // The fitted exponents are WITHDRAWN (a time-step check showed the Re 1000 sequence dropping 15 % at its finest
    // rung, so the convergence verdicts behind two of these three points are under verification). The points are drawn
    // because they are the data; the fit line is drawn faint and labelled as suspended so the figure cannot be read
    // as a current result.
    const f = fit('v');
    svg += `<line x1="${X(lx[0])}" y1="${Y(Math.exp(f.a + Math.log(lx[0]) * -f.p))}" x2="${X(lx[1])}" y2="${Y(Math.exp(f.a + Math.log(lx[1]) * -f.p))}" stroke="#3d4a5c" stroke-width="1" stroke-dasharray="3,5"/>`;
    conv.forEach(c => { svg += `<circle cx="${X(c.nu).toFixed(1)}" cy="${Y(c.v).toFixed(1)}" r="5" fill="${c.Re === 2000 ? '#4cc9f0' : 'none'}" stroke="#4cc9f0" stroke-width="1.8"/><text x="${X(c.nu)}" y="${Y(c.v) - 12}" fill="#8a9bb0" font-size="11" text-anchor="middle">Re ${c.Re} · ${c.v.toFixed(0)} (${c.N}³)${c.Re === 2000 ? '' : ' — under verification'}</text>`; });
    svg += `<text x="${x0 + 12}" y="${P.t + 22}" fill="#ff8fa8" font-size="13">viscosity scaling SUSPENDED — not a result</text>`;
    svg += `<text x="${x0 + 12}" y="${P.t + 42}" fill="#8a9bb0" font-size="11">a time-step check showed the Re 1000 sequence falling 15 % at its finest rung, so two of these</text>`;
    svg += `<text x="${x0 + 12}" y="${P.t + 58}" fill="#8a9bb0" font-size="11">three convergence verdicts are being re-tested; only Re 2000 (filled) currently stands.</text>`;
    svg += `<text x="${x0 + 12}" y="${P.t + 78}" fill="#5b6b80" font-size="10">withdrawn fit, kept for audit: max|ω| ∝ ν^−${f.p.toFixed(2)}, Z_max ∝ ν^−${fit('Z').p.toFixed(2)} · float32 exploration grade</text>`;
  } else svg += `<text x="${x0 + half / 2}" y="${H / 2}" fill="#5b6b80" font-size="13" text-anchor="middle">fewer than two converged Reynolds numbers</text>`;
}
svg += `<text x="${P.l}" y="${P.t - 10}" fill="#e6edf5" font-size="13">NS-004 · Resolution cost of the pointwise maximum — two converged Reynolds numbers, two false-convergence shelves</text>`;
// legend: the three marker states, stated once and applying to both panels
{
  const lx = P.l;
  svg += `<circle cx="${lx + 6}" cy="${LEG1 - 4}" r="5.5" fill="#8a9bb0" stroke="#8a9bb0" stroke-width="2"/><text x="${lx + 18}" y="${LEG1}" fill="#aab8c9" font-size="11">filled — verified converged</text>`;
  svg += `<circle cx="${lx + 216}" cy="${LEG1 - 4}" r="5.5" fill="none" stroke="#8a9bb0" stroke-width="2"/><text x="${lx + 228}" y="${LEG1}" fill="#aab8c9" font-size="11">open — under verification: a previously accepted verdict, held provisional until its further rung lands</text>`;
  svg += `<path d="M ${lx + 6} ${LEG2 - 10} l -6 10 h 12 z" fill="#8a9bb0"/><text x="${lx + 18}" y="${LEG2}" fill="#aab8c9" font-size="11">triangle — lower bound: non-convergence demonstrated, the sequence has not stopped moving</text>`;
}
svg += `</svg>`;
fs.writeFileSync(OUT, svg);
console.log('wrote', OUT, '·', conv.length, 'converged of', Res.length, 'Reynolds numbers');
