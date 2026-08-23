// Render archived NSLab slice fields (slices/*.f32, Float32 N×N row-major) as a PNG strip, one panel per requested time —
// or, with --dirs, one panel per run folder at one time (a ladder comparison). Common colour scale (sqrt of the field over
// the maximum of the selected panels), studio palette (gunmetal → cyan → white).
// Usage: node research/nslab/slice-png.js <run-dir> [--field vort|q|stretch] [--plane x|z0|zmid] [--times 0,6,7.5,8.5,10]
//        [--scale 2] [--abs] [--out file.png]
//        node research/nslab/slice-png.js --dirs dirA,dirB,dirC --plane z0 --times 8.5 [--field …] --out file.png
// Planes: x = the y–z cross-section at x = π/2 (archived as x<N/4>), xmid = x = π (x<N/2>, archived from NS-003 on — the
// tubes' closest approach), z0 = z = 0, zmid = z = π/2 (archived as z<N/4>);
// the archived names (x24, z48 …) are accepted too. Zero dependencies: the PNG is written with zlib from Node itself.
// No labels are drawn — the panel times and maxima are printed to stdout for the caption.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const field = opt('field', 'vort'), times = opt('times', '0,6,7.5,8.5,10').split(',').map(Number), scale = +opt('scale', 0), useAbs = args.includes('--abs');
const dirs = opt('dirs', null) ? opt('dirs').split(',').map(d => path.resolve(d)) : [path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '.')];
const planeOpt = opt('plane', 'x');
function listSlices(dir) {
  const sdir = path.join(dir, 'slices'); const files = fs.readdirSync(sdir).filter(f => f.endsWith('.f32'));
  const idx = re => [...new Set(files.map(f => (f.match(re) || [])[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
  const xs = idx(/_x(\d+)\.f32$/), zs = idx(/_z([1-9]\d*)\.f32$/);   // x planes: N/4 (x = π/2) and, from NS-003 on, N/2 (x = π)
  const plane = planeOpt === 'x' ? 'x' + xs[0] : planeOpt === 'xmid' ? 'x' + xs[xs.length - 1] : planeOpt === 'zmid' ? 'z' + zs[0] : planeOpt;
  const avail = files.filter(f => f.endsWith(`_${field}_${plane}.f32`)).map(f => ({ f: path.join(sdir, f), t: +f.match(/^t(\d+)p(\d+)_/).slice(1).join('.') })).sort((a, b) => a.t - b.t);
  if (!avail.length) { console.error(`no slices for field ${field} plane ${plane} in ${sdir}`); process.exit(1); }
  return { plane, avail };
}
const nearest = (avail, t) => avail.reduce((b, a) => Math.abs(a.t - t) < Math.abs(b.t - t) ? a : b);
const read = f => { const b = fs.readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
// panels: [{label, t, data, N}]
const panels = [];
if (dirs.length > 1) { for (const d of dirs) { const { plane, avail } = listSlices(d); const p = nearest(avail, times[0]); const data = read(p.f); panels.push({ label: `${path.basename(d)} ${plane}`, t: p.t, data, N: Math.round(Math.sqrt(data.length)) }); } }
else { const { plane, avail } = listSlices(dirs[0]); for (const t of times) { const p = nearest(avail, t); const data = read(p.f); panels.push({ label: `${path.basename(dirs[0])} ${plane}`, t: p.t, data, N: Math.round(Math.sqrt(data.length)) }); } }
const Nmax = Math.max(...panels.map(p => p.N)); const k0 = scale || Math.max(1, Math.round(384 / Nmax)); const PANEL = Nmax * k0, GAP = 3 * k0;
let vmax = 0; const maxes = panels.map(p => { let m = 0; for (let i = 0; i < p.data.length; i++) { const v = useAbs ? Math.abs(p.data[i]) : p.data[i]; if (v > m) m = v; } vmax = Math.max(vmax, m); return m; });
const ramp = [[0, [14, 20, 28]], [0.3, [16, 76, 110]], [0.65, [0, 212, 255]], [1, [245, 252, 255]]];
const col = v => { v = Math.max(0, Math.min(1, v)); for (let i = 1; i < ramp.length; i++) if (v <= ramp[i][0]) { const [a, ca] = ramp[i - 1], [b, cb] = ramp[i], s = (v - a) / (b - a); return ca.map((c, j) => Math.round(c + (cb[j] - c) * s)); } return ramp[ramp.length - 1][1]; };
const totalW = panels.length * PANEL + (panels.length - 1) * GAP, H = PANEL; const rgb = Buffer.alloc(totalW * H * 3, 0);
for (let i = 0; i < H; i++) for (let j = 0; j < totalW; j++) { const o = (i * totalW + j) * 3; rgb[o] = 8; rgb[o + 1] = 11; rgb[o + 2] = 16; }
panels.forEach((p, pi) => {
  const d = p.data, N = p.N, k = PANEL / N, x0 = pi * (PANEL + GAP);
  for (let i = 0; i < PANEL; i++) for (let j = 0; j < PANEL; j++) {
    const y = i / k - 0.5, x = j / k - 0.5, y0 = Math.max(0, Math.floor(y)), xb = Math.max(0, Math.floor(x)), y1 = Math.min(N - 1, y0 + 1), x1 = Math.min(N - 1, xb + 1), fy = Math.max(0, y - y0), fx = Math.max(0, x - xb);
    const s = (1 - fy) * ((1 - fx) * d[y0 * N + xb] + fx * d[y0 * N + x1]) + fy * ((1 - fx) * d[y1 * N + xb] + fx * d[y1 * N + x1]);
    const v = useAbs ? Math.abs(s) : s; const c = col(Math.sqrt(Math.max(0, v) / vmax)); const o = (i * totalW + x0 + j) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
  }
});
// ---- PNG encoder ----
const crcT = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let q = 0; q < 8; q++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; }
const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
const raw = Buffer.alloc((totalW * 3 + 1) * H); for (let i = 0; i < H; i++) { raw[i * (totalW * 3 + 1)] = 0; rgb.copy(raw, i * (totalW * 3 + 1) + 1, i * totalW * 3, (i + 1) * totalW * 3); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(totalW, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = opt('out', dirs.length > 1 ? `slices-${field}-${planeOpt}-ladder.png` : path.join(dirs[0], `slices-${field}-${listSlices(dirs[0]).plane}.png`)); fs.writeFileSync(out, png);
console.log(`${field}: ` + panels.map((p, i) => `${dirs.length > 1 ? p.label + ' ' : ''}t ${p.t.toFixed(2)} (${p.N}²) max ${maxes[i].toFixed(2)}`).join(' · ') + ` — colour: sqrt(v / ${vmax.toFixed(2)})`);
console.log(`wrote ${out} (${totalW}×${H})`);
