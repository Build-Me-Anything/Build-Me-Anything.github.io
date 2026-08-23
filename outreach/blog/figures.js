#!/usr/bin/env node
/*
 * figures.js — generate the blog's SVG charts directly from the NSLab evidence archive.
 *
 * Zero dependencies. Reads research/nslab/<run>/final.json (or partial.json for a run still going) and
 * research/nslab/taylor-green-Re1600/ladder-96.json, and writes SVGs into assets/figures/.
 *
 * The SVGs carry CSS classes only (no hard-coded colours) because build.js inlines them into the page,
 * where the site stylesheet themes them for light and dark.
 *
 *   node figures.js            write the figures and print the numbers table
 *   node figures.js --check    print the numbers table only (no files written)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const { ROOT, readRun: readSeries, readLadderLevel, peak, integrate } = require('./archive.js');

const OUT = path.join(__dirname, 'assets', 'figures');
const CHECK = process.argv.includes('--check');

/* --------------------------------------------------------------- charts ---- */

function niceTicks(lo, hi, target) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toPrecision(12));
  return out;
}

const fmt = v => {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1e-3 || a >= 1e5) return v.toExponential(0).replace('e-', '·10⁻').replace('e+', '·10');
  if (a < 1) return String(+v.toFixed(a < 0.01 ? 4 : 3));
  return String(+v.toFixed(a < 10 ? 1 : 0));
};

// Bucket-maximum decimation: keeps peaks (the quantity the whole programme is about)
// while keeping the inlined SVG small. Stated in every caption that uses it.
function decimate(t, y, n) {
  if (t.length <= n) return t.map((tt, i) => [tt, y[i]]);
  const out = [];
  const per = t.length / n;
  for (let b = 0; b < n; b++) {
    const i0 = Math.floor(b * per), i1 = Math.min(t.length, Math.floor((b + 1) * per));
    let iBest = i0;
    for (let i = i0; i < i1; i++) if (y[i] > y[iBest]) iBest = i;
    if (i1 > i0) out.push([t[iBest], y[iBest]]);
  }
  return out;
}

function chart(opts) {
  const W = opts.width || 760, H = opts.height || 320;
  const padL = 62, padR = opts.padR != null ? opts.padR : 14, padT = 16, padB = 42;
  const iw = W - padL - padR, ih = H - padT - padB;
  const ylog = !!opts.ylog;

  let [x0, x1] = opts.xdomain;
  let [y0, y1] = opts.ydomain;
  const X = v => padL + (v - x0) / (x1 - x0) * iw;
  const Y = ylog
    ? v => padT + ih - (Math.log10(Math.max(v, y0)) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) * ih
    : v => padT + ih - (v - y0) / (y1 - y0) * ih;

  const xt = niceTicks(x0, x1, 8);
  let yt;
  if (ylog) {
    yt = [];
    for (let d = Math.floor(Math.log10(y0)); d <= Math.ceil(Math.log10(y1)); d++)
      for (const m of [1, 2, 5]) { const v = m * Math.pow(10, d); if (v >= y0 * 0.999 && v <= y1 * 1.001) yt.push(v); }
  } else yt = niceTicks(y0, y1, 6);

  const p = [];
  p.push(`<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || opts.ylabel)}" xmlns="http://www.w3.org/2000/svg">`);
  p.push(`<g class="grid">`);
  for (const v of yt) p.push(`<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${padL + iw}" y2="${Y(v).toFixed(1)}"/>`);
  p.push(`</g>`);
  p.push(`<g class="axis">`);
  p.push(`<line x1="${padL}" y1="${padT + ih}" x2="${padL + iw}" y2="${padT + ih}"/>`);
  p.push(`<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ih}"/>`);
  p.push(`</g>`);
  p.push(`<g class="tick">`);
  for (const v of xt) p.push(`<text x="${X(v).toFixed(1)}" y="${padT + ih + 16}" text-anchor="middle">${fmt(v)}</text>`);
  for (const v of yt) p.push(`<text x="${padL - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`);
  p.push(`</g>`);
  p.push(`<text class="axlabel" x="${padL + iw / 2}" y="${H - 6}" text-anchor="middle">${esc(opts.xlabel)}</text>`);
  p.push(`<text class="axlabel" x="14" y="${padT + ih / 2}" text-anchor="middle" transform="rotate(-90 14 ${padT + ih / 2})">${esc(opts.ylabel)}</text>`);

  for (const h of opts.hlines || []) {
    p.push(`<line class="ref" x1="${padL}" y1="${Y(h.y).toFixed(1)}" x2="${padL + iw}" y2="${Y(h.y).toFixed(1)}"/>`);
    if (h.label) p.push(`<text class="reflabel" x="${padL + iw - 4}" y="${(Y(h.y) - 5).toFixed(1)}" text-anchor="end">${esc(h.label)}</text>`);
  }

  for (const s of opts.series) {
    const pts = s.pts.filter(q => q[0] >= x0 - 1e-9 && q[0] <= x1 + 1e-9)
      .map(q => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
    p.push(`<polyline class="s ${s.cls}${s.dash ? ' dash' : ''}" points="${pts}"/>`);
    for (const m of s.marks || [])
      p.push(`<circle class="mark ${s.cls}" cx="${X(m[0]).toFixed(1)}" cy="${Y(m[1]).toFixed(1)}" r="3.2"/>`);
  }

  // legend, top-left inside the plot
  let ly = padT + 14;
  for (const s of opts.series) {
    if (!s.label) continue;
    p.push(`<line class="s ${s.cls}${s.dash ? ' dash' : ''}" x1="${padL + 12}" y1="${ly - 4}" x2="${padL + 40}" y2="${ly - 4}"/>`);
    p.push(`<text class="legend" x="${padL + 46}" y="${ly}">${esc(s.label)}</text>`);
    ly += 17;
  }
  p.push(`</svg>`);
  return p.join('\n');
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ----------------------------------------------------------------- runs ---- */

const runs = {
  tgv96: readLadderLevel(path.join('taylor-green-Re1600', 'ladder-96.json'), 96),
  tgv192: readSeries('tgv-Re1600-N192-gpu'),
  tgv256: readSeries('tgv-Re1600-N256-gpu'),
  tub96: readSeries('tubes-Re4000-N96-gpu'),
  tub192: readSeries('tubes-Re4000-N192-gpu'),
  tub256: readSeries('tubes-Re4000-N256-gpu'),
  t2k96: readSeries('tubes-Re2000-N96-gpu'),
  t2k192: readSeries('tubes-Re2000-N192-gpu'),
  t2k256: readSeries('tubes-Re2000-N256-gpu'),
};

// A level counts once it has integrated past t = 1; before that its series is the initial condition.
const have = k => runs[k] && runs[k].t && runs[k].t.length > 1 && runs[k].t[runs[k].t.length - 1] >= 1;
const done = k => have(k) && runs[k].done;

/* -------------------------------------------------------------- figures ---- */

const figures = {};

function ladderFigure(name, levels, key, o) {
  const series = levels.filter(l => have(l.k)).map(l => {
    const s = runs[l.k];
    return { label: l.label + (s.done ? '' : ' (running)'), cls: l.cls, dash: !s.done, pts: decimate(s.t, s[key], 900) };
  });
  if (!series.length) return;
  const yMax = Math.max(...series.flatMap(s => s.pts.map(p => p[1])));
  figures[name] = chart(Object.assign({
    xdomain: [0, o.tMax], ydomain: [0, yMax * 1.08], series,
    xlabel: 't', ylabel: o.ylabel, aria: o.aria,
  }, o.chart || {}));
}

const TGV = [
  { k: 'tgv96', label: '96³', cls: 'c1' },
  { k: 'tgv192', label: '192³', cls: 'c2' },
  { k: 'tgv256', label: '256³', cls: 'c3' },
];
const TUB = [
  { k: 'tub96', label: '96³', cls: 'c1' },
  { k: 'tub192', label: '192³', cls: 'c2' },
  { k: 'tub256', label: '256³', cls: 'c3' },
];
const T2K = [
  { k: 't2k96', label: '96³', cls: 'c1' },
  { k: 't2k192', label: '192³', cls: 'c2' },
  { k: 't2k256', label: '256³', cls: 'c3' },
];

ladderFigure('ns001-eps', TGV, 'eps', {
  tMax: 10, ylabel: 'ε = 2νZ', aria: 'Dissipation rate against time at three grid resolutions; the curves lie on top of one another',
  chart: { hlines: [{ y: 0.013, label: '512³ reference ≈ 0.013' }] },
});
ladderFigure('ns001-ommax', TGV, 'omMax', {
  tMax: 10, ylabel: 'max |ω|', aria: 'Maximum vorticity against time at three grid resolutions; each finer grid gives a larger maximum',
});
ladderFigure('ns002-eps', TUB, 'eps', { tMax: 16, ylabel: 'ε = 2νZ', aria: 'Dissipation rate against time, vortex tubes at Re 4000' });
ladderFigure('ns002-ommax', TUB, 'omMax', { tMax: 16, ylabel: 'max |ω|', aria: 'Maximum vorticity against time, vortex tubes at Re 4000' });
ladderFigure('ns003-ommax', T2K, 'omMax', { tMax: 16, ylabel: 'max |ω|', aria: 'Maximum vorticity against time, vortex tubes at Re 2000' });

// Peak and BKM integral against N, log–log, both studies.
function scalingFigure() {
  const studies = [
    { label: 'NS-001 · Taylor–Green Re 1600', cls: 'c4', keys: ['tgv96', 'tgv192', 'tgv256'] },
    { label: 'NS-002 · tubes Re 4000', cls: 'c5', keys: ['tub96', 'tub192', 'tub256'] },
    { label: 'NS-003 · tubes Re 2000', cls: 'c6', keys: ['t2k96', 't2k192', 't2k256'] },
  ];
  // Only finished levels: a running level's peak is a lower bound and would draw a falling curve.
  const mk = (fn) => studies.map(st => {
    const pts = st.keys.filter(done).map(k => [runs[k].N, fn(runs[k])]);
    return { label: st.label, cls: st.cls, pts, marks: pts };
  }).filter(s => s.pts.length > 1);

  const peaks = mk(s => peak(s, 'omMax').value);
  const bkm = mk(s => integrate(s, 'omMax', 10));
  if (!peaks.length) return;

  const logChart = (series, ylabel, aria, padR) => {
    const ys = series.flatMap(s => s.pts.map(p => p[1]));
    const W = 760, H = 330, padL = 62, padT = 16, padB = 42;
    const iw = W - padL - (padR || 14), ih = H - padT - padB;
    const x0 = 80, x1 = 300, y0 = Math.pow(10, Math.floor(Math.log10(Math.min(...ys)) * 4) / 4) * 0.9, y1 = Math.max(...ys) * 1.25;
    const X = v => padL + (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) * iw;
    const Y = v => padT + ih - (Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) * ih;
    const p = [`<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}" xmlns="http://www.w3.org/2000/svg">`];
    const yticks = [];
    for (let d = -1; d <= 4; d++) for (const m of [1, 2, 5]) { const v = m * Math.pow(10, d); if (v >= y0 && v <= y1) yticks.push(v); }
    p.push('<g class="grid">');
    for (const v of yticks) p.push(`<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${padL + iw}" y2="${Y(v).toFixed(1)}"/>`);
    p.push('</g><g class="axis">');
    p.push(`<line x1="${padL}" y1="${padT + ih}" x2="${padL + iw}" y2="${padT + ih}"/>`);
    p.push(`<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ih}"/></g><g class="tick">`);
    for (const v of [96, 128, 192, 256]) p.push(`<text x="${X(v).toFixed(1)}" y="${padT + ih + 16}" text-anchor="middle">${v}</text>`);
    for (const v of yticks) p.push(`<text x="${padL - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`);
    p.push('</g>');
    p.push(`<text class="axlabel" x="${padL + iw / 2}" y="${H - 6}" text-anchor="middle">grid points per side, N</text>`);
    p.push(`<text class="axlabel" x="14" y="${padT + ih / 2}" text-anchor="middle" transform="rotate(-90 14 ${padT + ih / 2})">${esc(ylabel)}</text>`);
    for (const s of series) {
      p.push(`<polyline class="s ${s.cls}" points="${s.pts.map(q => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ')}"/>`);
      for (const m of s.pts) p.push(`<circle class="mark ${s.cls}" cx="${X(m[0]).toFixed(1)}" cy="${Y(m[1]).toFixed(1)}" r="3.6"/>`);
      // slope of the last leg, N^p
      const a = s.pts[s.pts.length - 2], b = s.pts[s.pts.length - 1];
      const pw = Math.log(b[1] / a[1]) / Math.log(b[0] / a[0]);
      p.push(`<text class="slope ${s.cls}" x="${(X(b[0]) + 6).toFixed(1)}" y="${(Y(b[1]) + 4).toFixed(1)}">N^${pw.toFixed(2)}</text>`);
    }
    let ly = padT + 14;
    for (const s of series) {
      p.push(`<line class="s ${s.cls}" x1="${padL + 12}" y1="${ly - 4}" x2="${padL + 40}" y2="${ly - 4}"/>`);
      p.push(`<text class="legend" x="${padL + 46}" y="${ly}">${esc(s.label)}</text>`);
      ly += 17;
    }
    p.push('</svg>');
    return p.join('\n');
  };

  figures['peak-vs-n'] = logChart(peaks, 'peak max |ω|', 'Peak maximum vorticity against grid resolution, log-log, rising with no sign of saturation', 66);
  figures['bkm-vs-n'] = logChart(bkm, '∫₀¹⁰ max|ω| dt', 'Beale-Kato-Majda integral against grid resolution, log-log', 66);
}
scalingFigure();

/* ---------------------------------------------------------------- output ---- */

const table = [];
for (const [k, label] of [
  ['tgv96', 'NS-001 TGV Re1600 96³'], ['tgv192', 'NS-001 TGV Re1600 192³'], ['tgv256', 'NS-001 TGV Re1600 256³'],
  ['tub96', 'NS-002 tubes Re4000 96³'], ['tub192', 'NS-002 tubes Re4000 192³'], ['tub256', 'NS-002 tubes Re4000 256³'],
  ['t2k96', 'NS-003 tubes Re2000 96³'], ['t2k192', 'NS-003 tubes Re2000 192³'], ['t2k256', 'NS-003 tubes Re2000 256³'],
]) {
  if (!have(k)) { table.push([label, '—', 'not present']); continue; }
  const s = runs[k];
  const pk = peak(s, 'omMax'), pe = peak(s, 'eps');
  table.push([
    label,
    `ε_max ${pe.value.toPrecision(4)} @ t ${pe.t.toFixed(2)}`,
    `max|ω| ${pk.value.toFixed(2)} @ t ${pk.t.toFixed(3)}`,
    `∫₀¹⁰ ${integrate(s, 'omMax', 10).toFixed(1)}`,
    `∫₀¹⁶ ${integrate(s, 'omMax', 16).toFixed(1)}`,
    `t_end ${s.t[s.t.length - 1].toFixed(2)}`,
    s.done ? `done, health ${s.health}` : `RUNNING, health ${s.health}`,
  ]);
}
console.log('NSLab archive — numbers behind the figures\n');
for (const row of table) console.log('  ' + row.join('  |  '));

if (!CHECK) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, svg] of Object.entries(figures)) {
    fs.writeFileSync(path.join(OUT, name + '.svg'), svg + '\n');
  }
  console.log(`\nwrote ${Object.keys(figures).length} figures to ${path.relative(ROOT, OUT)}`);
}
