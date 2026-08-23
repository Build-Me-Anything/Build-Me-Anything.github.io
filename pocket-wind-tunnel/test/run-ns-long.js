// Long NSLab run with checkpoint/resume and continuously written partial results — for overnight DNS batches.
// Usage: node test/run-ns-long.js --N 192 --Re 1600 --tEnd 16 --out "<dir>" [--ic tgv] [--cfl 0.4] [--snap 0.5] [--ckpt 2] [--bench]
// Writes into <dir>: run.log, partial.json (series + snapshots + health, rewritten at every snapshot), slices/*.f32,
// checkpoint.bin + checkpoint.json (every --ckpt time units; the run resumes from them if present), final.json.
const fs = require('fs'), path = require('path');
const NS = require('../src/nslab.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const N = +arg('N', 64), Re = +arg('Re', 1600), tEnd = +arg('tEnd', 10), ic = arg('ic', 'tgv'), cfl = +arg('cfl', 0.4), snapEvery = +arg('snap', 0.5), ckptEvery = +arg('ckpt', 2), bench = process.argv.includes('--bench');
const out = arg('out', path.join(__dirname, '..', '..', 'research', 'nslab', `${ic}-Re${Re}-N${N}`));
fs.mkdirSync(path.join(out, 'slices'), { recursive: true });
const log = s => { const line = `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] ${s}`; console.log(line); fs.appendFileSync(path.join(out, 'run.log'), line + '\n'); };
const build = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) ? `{"version":"${fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1]}"}` : '{}');

log(`NSLab ${NS.VERSION} (app ${build.version}) — ${ic} N=${N}³ Re=${Re} tEnd=${tEnd} cfl=${cfl} snap=${snapEvery} ckpt=${ckptEvery}  node ${process.version}`);
const t0 = Date.now();
const s = NS.createSolver({ N, Re, ic, cfl });
log(`solver ready in ${((Date.now() - t0) / 1000).toFixed(1)} s, rss ${(process.memoryUsage().rss / 1e9).toFixed(2)} GB, kc ${s.kc}, E0 ${s.st.E0}, Z0 ${s.st.Z0}`);

if (bench) { const tb = Date.now(); s.run(2); const ms = (Date.now() - tb) / 2; const td = Date.now(); s.diagnose(); log(`bench: ${ms.toFixed(0)} ms/step, diagnose ${Date.now() - td} ms, dt ${s.st.dt.toExponential(3)} → ~${Math.round(tEnd / s.st.dt)} steps ≈ ${(tEnd / s.st.dt * ms / 3600e3).toFixed(2)} h, rss ${(process.memoryUsage().rss / 1e9).toFixed(2)} GB`); process.exit(0); }

// ---- resume ----
const ckBin = path.join(out, 'checkpoint.bin'), ckJson = path.join(out, 'checkpoint.json');
let outs = [], nextSnap = snapEvery, nextCkpt = ckptEvery, elapsedBefore = 0;
if (fs.existsSync(ckBin) && fs.existsSync(ckJson)) {
  const meta = JSON.parse(fs.readFileSync(ckJson, 'utf8'));
  if (meta.N === N && meta.Re === Re && meta.ic === ic) {
    const buf = fs.readFileSync(ckBin), NS_ = s._S[0].length;
    for (let c = 0; c < 6; c++) s._S[c].set(new Float64Array(buf.buffer, buf.byteOffset + c * NS_ * 8, NS_));
    Object.assign(s.st, { t: meta.t, step: meta.step, series: meta.series, maxEbal: meta.maxEbal, maxZbal: meta.maxZbal, maxTnl: meta.maxTnl, divMax: meta.divMax, E0: meta.E0, Z0: meta.Z0 });
    outs = meta.outs; nextSnap = meta.nextSnap; nextCkpt = meta.nextCkpt; elapsedBefore = meta.elapsed || 0;
    log(`resumed from checkpoint at t=${meta.t.toFixed(4)} step ${meta.step} (${outs.length} snapshots)`);
  } else log('checkpoint present but for a different case — ignored');
}
const health = () => { const h = s.health(); return { worst: h.worst, rows: h.rows }; };
function writePartial(final) {
  const j = { instrument: 'Pocket Wind Tunnel NSLab ' + NS.VERSION, build, case: { ic, N, Re, nu: 1 / Re, cfl, tEnd, snapEvery }, t: s.st.t, steps: s.st.step, elapsed_s: elapsedBefore + (Date.now() - t0) / 1000, series: s.st.series, snapshots: outs, health: health(), final: !!final,
    disclaimer: 'Numerical evidence only; nothing here proves regularity or blow-up of the Navier–Stokes equations.' };
  fs.writeFileSync(path.join(out, final ? 'final.json' : 'partial.json'), JSON.stringify(j));
}
function snapshot() {
  const d = s.diagnose(); outs.push(d);
  const tag = d.t.toFixed(2).replace('.', 'p');
  for (const kind of ['vort', 'q', 'stretch']) for (const [axis, idx] of [['z', 0], ['z', N / 4], ['x', N / 4]]) fs.writeFileSync(path.join(out, 'slices', `t${tag}_${kind}_${axis}${idx}.f32`), Buffer.from(s.slice(kind, axis, idx).buffer));
  writePartial(false);
  const h = health(), ser = s.st.series, done = s.st.t / tEnd, el = elapsedBefore + (Date.now() - t0) / 1000;
  log(`t ${d.t.toFixed(3)} step ${s.st.step} dt ${s.st.dt.toExponential(2)}  E ${d.E.toFixed(6)} Z ${d.Z.toFixed(4)} ε ${d.eps.toFixed(6)} max|ω| ${d.omMax.toFixed(3)} ⟨ωSω⟩ ${d.Pspec.toFixed(4)} (phys ${d.Pphys.toFixed(4)}) kmaxη ${d.kmaxEta.toFixed(2)} S ${d.skewIso.toFixed(3)} align ${d.align.map(a => a.toFixed(2)).join('/')}  health ${h.worst}  ebal ${s.st.maxEbal.toExponential(1)} zbal ${s.st.maxZbal.toExponential(1)}  ${(el / 3600).toFixed(2)} h, ETA ${((el / Math.max(done, 1e-6)) * (1 - done) / 3600).toFixed(2)} h`);
}
function checkpoint() {
  const NS_ = s._S[0].length, buf = Buffer.alloc(6 * NS_ * 8);
  for (let c = 0; c < 6; c++) Buffer.from(s._S[c].buffer).copy(buf, c * NS_ * 8);
  fs.writeFileSync(ckBin + '.tmp', buf); fs.renameSync(ckBin + '.tmp', ckBin);
  fs.writeFileSync(ckJson, JSON.stringify({ N, Re, ic, t: s.st.t, step: s.st.step, series: s.st.series, outs, nextSnap, nextCkpt, maxEbal: s.st.maxEbal, maxZbal: s.st.maxZbal, maxTnl: s.st.maxTnl, divMax: s.st.divMax, E0: s.st.E0, Z0: s.st.Z0, elapsed: elapsedBefore + (Date.now() - t0) / 1000 }));
  log(`checkpoint written at t=${s.st.t.toFixed(4)}`);
}
if (s.st.step === 0) snapshot();
while (s.st.t < tEnd - 1e-12) {
  s.step();
  if (s.st.t >= nextSnap - 1e-9) { nextSnap += snapEvery; snapshot(); }
  if (s.st.t >= nextCkpt - 1e-9) { nextCkpt += ckptEvery; checkpoint(); }
}
if (outs.length === 0 || outs[outs.length - 1].t < s.st.t - 1e-9) snapshot();
writePartial(true);
const ser = s.st.series; let ip = 0, io = 0; for (let i = 0; i < ser.t.length; i++) { if (ser.eps[i] > ser.eps[ip]) ip = i; if (ser.omMax[i] > ser.omMax[io]) io = i; }
log(`DONE: ε_max ${ser.eps[ip].toFixed(6)} at t ${ser.t[ip].toFixed(3)}; max|ω| peak ${ser.omMax[io].toFixed(3)} at t ${ser.t[io].toFixed(3)}; E(${tEnd}) ${ser.E[ser.E.length - 1].toFixed(6)}; health ${health().worst}; ${((elapsedBefore + (Date.now() - t0) / 1000) / 3600).toFixed(2)} h`);
