// CFD Web Worker entry. solver.js (WT) and cfd.js (CFD) are prepended at build time.
let solver = null, running = false, kind = 'mach', maxIter = 4000, target = 4, chunk = 20, snapEvery = 8, chunkCount = 0, t0 = 0, lastPost = 0;

function snapshot(final) {
  const surf = solver.forces();
  const msg = { type: 'field', kind, data: solver.field(kind), surface: surf, hist: solver.st.hist, res: solver.st.res, iter: solver.st.iter, final: !!final };
  self.postMessage(msg, [msg.data.buffer]);
}
function progress() {
  const st = solver.st, n = st.res.length;
  self.postMessage({ type: 'progress', iter: st.iter, drop: st.res0 ? Math.log10(st.res0 / st.res[n - 1]) : 0, resNu: st.resNu, dropNu: st.resNu0 ? Math.log10(st.resNu0 / st.resNu) : 0,
    Cl: st.Cl, Cd: st.Cd, Cdp: st.Cdp, Cdf: st.Cdf, Cm: st.Cm, cfl: st.cfl, elapsed: (performance.now() - t0) / 1000, diverged: st.diverged, running });
}
function loop() {
  if (!running || !solver) return;
  solver.iterate(chunk);
  chunkCount++;
  const st = solver.st;
  const drop = st.res0 ? Math.log10(st.res0 / st.res[st.res.length - 1]) : 0;
  let stable = false;
  if (st.iter >= 1000 && st.hist.length > 60) {   // forces flat over the last ~500 iterations: converged for engineering purposes
    const h = st.hist.slice(-50); let clMin = Infinity, clMax = -Infinity, cdMin = Infinity, cdMax = -Infinity;
    for (const r of h) { clMin = Math.min(clMin, r[1]); clMax = Math.max(clMax, r[1]); cdMin = Math.min(cdMin, r[2]); cdMax = Math.max(cdMax, r[2]); }
    stable = (clMax - clMin) < 0.001 * Math.max(1, Math.abs(h[h.length - 1][1])) && (cdMax - cdMin) < 0.00005;
  }
  const done = st.iter >= maxIter || drop >= target || stable || st.diverged;
  progress();
  if (chunkCount % snapEvery === 0 || done) snapshot(done);
  if (done) { running = false; self.postMessage({ type: 'done', reason: st.diverged ? 'diverged' : drop >= target ? 'converged' : stable ? 'stable' : 'maxIter' }); return; }
  setTimeout(loop, 0);
}
self.onmessage = e => {
  const m = e.data;
  try {
    if (m.type === 'start') {
      running = false; solver = null; chunkCount = 0;
      kind = m.kind || kind; maxIter = m.maxIter || 4000; target = m.target || 4;
      const geo = { x: m.gx, y: m.gy };
      let velocityFn = null;
      if (m.potential) { const sys = WT.buildSystem(geo), sol = WT.solveInviscid(sys, m.opts.alpha || 0); velocityFn = (x, y) => WT.velocityAt(sys, sol, x, y); }
      t0 = performance.now();
      solver = CFD.setup(m.gx, m.gy, Object.assign({}, m.opts, { velocityFn }));
      const mesh = solver.mesh;
      self.postMessage({ type: 'mesh', NI: mesh.NI, NJ: mesh.NJ, X: mesh.X, Y: mesh.Y, ratio: mesh.ratio, d1: mesh.d1, far: mesh.far, minVol: solver.minVol, wd: solver.wallDistance, setupMs: performance.now() - t0 });
      snapshot(false);
      running = true; setTimeout(loop, 0);
    } else if (m.type === 'pause') { running = false; progress(); }
    else if (m.type === 'resume') { if (solver && !running) { running = true; setTimeout(loop, 0); } }
    else if (m.type === 'stop') { running = false; solver = null; }
    else if (m.type === 'kind') { kind = m.kind; if (solver) snapshot(false); }
    else if (m.type === 'snapshot') { if (solver) snapshot(false); }
    else if (m.type === 'limits') { if (m.maxIter) maxIter = m.maxIter; if (m.target) target = m.target; if (solver && !running && solver.st.iter < maxIter) { running = true; setTimeout(loop, 0); } }
    else if (m.type === 'velocity') { if (solver) { const v = solver.velocityField(); self.postMessage({ type: 'velocity', U: v.U, V: v.V }, [v.U.buffer, v.V.buffer]); } }
  } catch (err) { running = false; self.postMessage({ type: 'error', message: err.message || String(err) }); }
};
