// Build: inline src/* into one self-contained HTML file. Run: node build.js [--verify]
// --verify runs the fast validation suites first and refuses to build if any fails (the CFD suite is run separately).
const fs = require('fs'), path = require('path');
const APP_VERSION = '0.5.0';
if (process.argv.includes('--verify')) {
  const { spawnSync } = require('child_process');
  for (const t of ['test/validate.js', 'test/validate-hyper.js', 'test/validate-tunnel.js', 'test/validate-ns.js']) {
    const r = spawnSync(process.execPath, [path.join(__dirname, t)], { encoding: 'utf8' });
    const ok = r.status === 0 && /ALL PASS/.test(r.stdout);
    console.log((ok ? '✓ ' : '✗ ') + t + (ok ? '' : '\n' + r.stdout + r.stderr));
    if (!ok) { console.error('verification failed — not building'); process.exit(1); }
  }
}
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
let html = src('index.html');
const put = (marker, text) => { if (!html.includes(marker)) throw new Error('marker missing: ' + marker); html = html.replace(marker, () => text); };
put('<!-- INLINE:style -->', '<style>\n' + src('style.css') + '\n</style>');
put('<!-- INLINE:build -->', '<script>window.PWT_BUILD = ' + JSON.stringify({ version: APP_VERSION, date: new Date().toISOString().slice(0, 10), nslab: (src('nslab.js').match(/VERSION = '([^']+)'/) || [])[1] || null }) + ';</script>');
put('<!-- INLINE:solver -->', '<script id="wt-solver">\n' + src('solver.js') + '\n</script>');
put('<!-- INLINE:hyper -->', '<script id="wt-hyper">\n' + src('hyper.js') + '\n</script>');
put('<!-- INLINE:apphyper -->', '<script>\n' + src('app-hyper.js') + '\n</script>');
put('<!-- INLINE:cfd -->', '<script id="wt-cfd">\n' + src('cfd.js') + '\n</script>');
put('<!-- INLINE:cfdworker -->', '<script id="wt-cfd-worker" type="text/plain">\n' + src('cfd-worker.js') + '\n</script>');
put('<!-- INLINE:nslab -->', '<script id="wt-nslab">\n' + src('nslab.js') + '\n</script>');
put('<!-- INLINE:nslabworker -->', '<script id="wt-nslab-worker" type="text/plain">\n' + src('nslab-worker.js') + '\n</script>');
put('<!-- INLINE:appnslab -->', '<script>\n' + src('app-nslab.js') + '\n</script>');
put('<!-- INLINE:appcfd -->', '<script>\n' + src('app-cfd.js') + '\n</script>');
put('<!-- INLINE:appassist -->', '<script>\n' + src('app-assist.js') + '\n</script>');
put('<!-- INLINE:apptunnel -->', '<script>\n' + src('app-tunnel.js') + '\n</script>');
put('<!-- INLINE:worker -->', '<script id="wt-worker" type="text/plain">\n' + src('worker.js') + '\n</script>');
put('<!-- INLINE:app -->', '<script>\n' + src('app.js') + '\n</script>');
const out = path.join(__dirname, 'Pocket Wind Tunnel.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(1) + ' kB');
