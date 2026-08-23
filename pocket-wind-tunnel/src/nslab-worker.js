// NSLab Web Worker entry. nslab.js (NS) is prepended at build time.
let solver = null, running = false, cfg = null, t0 = 0, nextOut = 0, study = null, levelIdx = 0, levels = [];

function snapshotOutput(final) {
  const out = solver.diagnose();
  const sl = solver.slice(cfg.field, cfg.axis, cfg.slice);
  const msg = { type: 'output', out, slice: sl, N: solver.N, health: solver.health(study ? study.summary : null), final: !!final, level: study ? levels[levelIdx].label : null };
  self.postMessage(msg, [sl.buffer]);
}
function progress() {
  const st = solver.st, d = solver.last;
  self.postMessage({ type: 'progress', t: st.t, step: st.step, dt: st.dt, E: d.E, Z: d.Z, eps: d.eps, omMax: d.omMax, uMax: d.uMax, Pspec: d.Pspec, elapsed: (performance.now() - t0) / 1000, running, series: st.series, level: study ? levels[levelIdx].label : null, levelIdx, nLevels: levels.length });
}
function peakOf(arr, t) { let i = 0; for (let k = 0; k < arr.length; k++) if (arr[k] > arr[i]) i = k; return { v: arr[i], t: t[i] }; }
function finishLevel() {
  const s = solver.st.series, pe = peakOf(s.eps, s.t), po = peakOf(s.omMax, s.t), L = levels[levelIdx];
  L.peak = { omMax: po.v, t: po.t }; L.epsPeak = pe; L.Eend = s.E[s.E.length - 1]; L.series = { t: s.t.slice(), E: s.E.slice(), eps: s.eps.slice(), omMax: s.omMax.slice() }; L.health = solver.health().worst;
  self.postMessage({ type: 'levelDone', level: L });
}
function loop() {
  if (!running || !solver) return;
  const tChunk = performance.now();
  while (performance.now() - tChunk < 120 && solver.st.t < cfg.tEnd - 1e-12) {
    solver.step();
    if (solver.st.t >= nextOut - 1e-9) { nextOut += cfg.outEvery; progress(); snapshotOutput(false); }
  }
  const done = solver.st.t >= cfg.tEnd - 1e-12;
  progress();
  if (done) {
    if (study) {
      finishLevel();
      if (levelIdx < levels.length - 1) { levelIdx++; startLevel(); return; }
      study.summary = { [study.kind]: NS.studySummary(levels, study.kind) };
      snapshotOutput(true); running = false;
      self.postMessage({ type: 'studyDone', summary: study.summary, levels: levels.map(L => ({ label: L.label, N: L.N, dt: L.dt, peak: L.peak, epsPeak: L.epsPeak, Eend: L.Eend, health: L.health, series: L.series })) });
      return;
    }
    snapshotOutput(true); running = false; self.postMessage({ type: 'done' }); return;
  }
  setTimeout(loop, 0);
}
function startLevel() {
  const L = levels[levelIdx];
  const opts = Object.assign({}, cfg.opts, { N: L.N, dt: L.dt || 0 });
  solver = NS.createSolver(opts); nextOut = cfg.outEvery; t0 = performance.now();
  self.postMessage({ type: 'init', N: solver.N, kc: solver.kc, Re: solver.Re, nu: solver.nu, E0: solver.last.E, Z0: solver.last.Z, level: L.label, levelIdx, nLevels: levels.length });
  progress(); snapshotOutput(false);
  running = true; setTimeout(loop, 0);
}
self.onmessage = e => {
  const m = e.data;
  try {
    if (m.type === 'start') {
      running = false; solver = null; study = null; levelIdx = 0;
      cfg = { opts: m.opts, tEnd: m.tEnd, outEvery: m.outEvery || 0.5, field: m.field || 'vort', axis: m.axis || 'z', slice: m.slice || 0 };
      if (m.study && m.study.levels && m.study.levels.length > 1) {
        study = { kind: m.study.kind, summary: null };
        levels = m.study.levels.map(L => ({ label: L.label, N: L.N || m.opts.N, dt: L.dt || 0 }));
      } else levels = [{ label: `${m.opts.N}³`, N: m.opts.N, dt: m.opts.dt || 0 }];
      startLevel();
    } else if (m.type === 'pause') { running = false; progress(); }
    else if (m.type === 'resume') { if (solver && !running) { running = true; t0 = performance.now() - (solver.st.elapsed || 0); setTimeout(loop, 0); } }
    else if (m.type === 'stop') { running = false; solver = null; study = null; }
    else if (m.type === 'view') { cfg.field = m.field || cfg.field; cfg.axis = m.axis || cfg.axis; if (m.slice != null) cfg.slice = m.slice; if (solver) { const sl = solver.slice(cfg.field, cfg.axis, cfg.slice); self.postMessage({ type: 'slice', slice: sl, N: solver.N, field: cfg.field, axis: cfg.axis, index: cfg.slice }, [sl.buffer]); } }
    else if (m.type === 'dossier') { if (solver) self.postMessage({ type: 'dossier', dossier: solver.dossier({ study: study ? study.summary : null, studyLevels: study ? levels.map(L => ({ label: L.label, N: L.N, dt: L.dt, peak: L.peak, epsPeak: L.epsPeak, Eend: L.Eend, health: L.health })) : null }) }); }
    else if (m.type === 'exact') { if (solver) self.postMessage({ type: 'exact', err: solver.exactError() }); }
  } catch (err) { running = false; self.postMessage({ type: 'error', message: err.message || String(err) }); }
};
