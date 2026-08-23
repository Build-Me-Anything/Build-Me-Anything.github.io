/*
 * archive.js — read the NSLab evidence archive (research/nslab/) so that the blog's figures and its
 * tables come from the same numbers. No dependencies; used by figures.js and build.js.
 *
 * A run folder holds final.json when the run has finished and partial.json while it is still going,
 * so a post about a running experiment updates itself on the next build.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ARCHIVE = path.join(ROOT, 'research', 'nslab');

function readRun(folder) {
  const dir = path.join(ARCHIVE, folder);
  for (const name of ['final.json', 'partial.json']) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      t: j.series.t, E: j.series.E, Z: j.series.Z, eps: j.series.eps, omMax: j.series.omMax,
      N: j.case.N, Re: j.case.Re, ic: j.case.ic,
      done: !!j.final, health: j.health && j.health.worst, healthRows: (j.health && j.health.rows) || [],
      steps: j.steps, hours: j.elapsed_s / 3600, source: folder + '/' + name,
    };
  }
  return null;
}

function readLadderLevel(file, N) {
  const p = path.join(ARCHIVE, file);
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const L = (Array.isArray(j) ? j : [j]).find(l => l.N === N);
  if (!L) return null;
  return {
    t: L.series.t, E: L.series.E, eps: L.series.eps, omMax: L.series.omMax,
    N: L.N, Re: L.Re, ic: 'taylorGreen', done: true, health: L.health, healthRows: [],
    steps: L.steps, hours: L.secs / 3600, source: file + ' (level ' + N + ')',
  };
}

const has = r => !!(r && r.t && r.t.length > 1);

function peak(s, key) {
  let b = 0;
  for (let i = 1; i < s[key].length; i++) if (s[key][i] > s[key][b]) b = i;
  return { value: s[key][b], t: s.t[b] };
}

// Trapezoidal ∫₀^tMax y dt over the per-step series, interpolated exactly at tMax.
function integrate(s, key, tMax) {
  const t = s.t, y = s[key];
  let sum = 0;
  for (let i = 1; i < t.length; i++) {
    if (t[i - 1] >= tMax) break;
    const t1 = Math.min(t[i], tMax);
    const y1 = t[i] > tMax ? y[i - 1] + (y[i] - y[i - 1]) * (tMax - t[i - 1]) / (t[i] - t[i - 1]) : y[i];
    sum += 0.5 * (y[i - 1] + y1) * (t1 - t[i - 1]);
  }
  return sum;
}

// The three studies, in the order the programme ran them.
const STUDIES = {
  'ns-001': {
    id: 'NS-001', title: 'Taylor–Green vortex, Re 1600', tEnd: 10, tEvent: 9,
    levels: [
      { N: 96, run: () => readLadderLevel(path.join('taylor-green-Re1600', 'ladder-96.json'), 96) },
      { N: 192, run: () => readRun('tgv-Re1600-N192-gpu') },
      { N: 256, run: () => readRun('tgv-Re1600-N256-gpu') },
    ],
  },
  'ns-002': {
    id: 'NS-002', title: 'Antiparallel vortex tubes, Re 4000', tEnd: 16, tEvent: 8.6,
    levels: [
      { N: 96, run: () => readRun('tubes-Re4000-N96-gpu') },
      { N: 192, run: () => readRun('tubes-Re4000-N192-gpu') },
      { N: 256, run: () => readRun('tubes-Re4000-N256-gpu') },
    ],
  },
  'ns-003': {
    id: 'NS-003', title: 'Antiparallel vortex tubes, Re 2000', tEnd: 16, tEvent: 9,
    levels: [
      { N: 96, run: () => readRun('tubes-Re2000-N96-gpu') },
      { N: 192, run: () => readRun('tubes-Re2000-N192-gpu') },
      { N: 256, run: () => readRun('tubes-Re2000-N256-gpu') },
    ],
  },
};

// Load a study: its levels with peaks, BKM integrals and level-to-level changes.
function study(key) {
  const spec = STUDIES[key];
  const levels = spec.levels.map(l => {
    const r = l.run();
    if (!has(r)) return { N: l.N, present: false };
    const pk = peak(r, 'omMax'), pe = peak(r, 'eps');
    const tReached = r.t[r.t.length - 1];
    return {
      N: l.N, present: true, run: r, done: r.done, health: r.health,
      // A run that has not yet integrated past the event carries no meaning in a ladder: its "peak" is
      // whatever the approach happens to have reached. Such a level is shown as started, with its
      // progress, and excluded from every peak, integral and comparison.
      early: !r.done && tReached < spec.tEvent,
      omPeak: pk.value, tOmPeak: pk.t, epsMax: pe.value, tEpsMax: pe.t,
      bkm10: integrate(r, 'omMax', 10), bkmEnd: integrate(r, 'omMax', spec.tEnd),
      tReached, hours: r.hours, steps: r.steps,
    };
  });
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1], b = levels[i];
    // Only two finished levels may be compared: a partial peak is a lower bound, not a measurement.
    if (!a.present || !b.present || !a.done || !b.done) continue;
    b.dOmPeak = (b.omPeak / a.omPeak - 1) * 100;
    b.dBkm10 = (b.bkm10 / a.bkm10 - 1) * 100;
    b.dEpsMax = (b.epsMax / a.epsMax - 1) * 100;
    b.slopeOm = Math.log(b.omPeak / a.omPeak) / Math.log(b.N / a.N);
    b.slopeBkm = Math.log(b.bkm10 / a.bkm10) / Math.log(b.N / a.N);
  }
  return { key, ...spec, levels };
}

module.exports = { ROOT, ARCHIVE, readRun, readLadderLevel, has, peak, integrate, STUDIES, study };
