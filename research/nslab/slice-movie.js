// Render an archived NSLab run's slice sequence as a movie — every snapshot in slices/*.f32, one frame each, on a
// COLOUR SCALE FIXED ACROSS THE WHOLE SEQUENCE so that brightness means the same thing in every frame. (slice-png.js
// normalises per figure, which is right for a still strip and wrong for a movie: a per-frame scale makes a decaying
// field look steady and a growing one look flat.)
//
// Usage: node research/nslab/slice-movie.js <run-dir> [--field vort|q|stretch] [--planes xmid,x160,z0] [--fps 6]
//        [--scale 1] [--vmax auto|<number>] [--out file.mp4] [--gif]
//
// Panels are laid out left to right, one per plane, sharing the scale. A progress bar along the bottom marks t/t_max —
// no glyphs are drawn, so no font dependency. PNG frames are written with Node's own zlib; only the final mux calls
// ffmpeg, which is the one external tool here and is not part of the offline deliverable.
//
// The peak of a 3D field almost never lies exactly on an archived plane, so a panel's maximum is a LOWER BOUND on the
// instantaneous max|ω| — the printed per-frame numbers are slice maxima and must never be quoted as the run's peak.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const runDir = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '.');
const field = opt('field', 'vort'), fps = +opt('fps', 6), useAbs = !args.includes('--signed');
const scaleOpt = +opt('scale', 0), vmaxOpt = opt('vmax', 'auto'), wantGif = args.includes('--gif');

const sdir = path.join(runDir, 'slices');
const files = fs.readdirSync(sdir).filter(f => f.endsWith('.f32'));
const xs = [...new Set(files.map(f => (f.match(/_x(\d+)\.f32$/) || [])[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
const zs = [...new Set(files.map(f => (f.match(/_z([1-9]\d*)\.f32$/) || [])[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
const resolvePlane = p => p === 'x' ? 'x' + xs[0] : p === 'xmid' ? 'x' + xs[xs.length - 1] : p === 'zmid' ? 'z' + zs[0] : p;
const planes = opt('planes', 'xmid').split(',').map(resolvePlane);

// one entry per snapshot time, holding the file for each requested plane
const times = [...new Set(files.map(f => (f.match(/^t(\d+)p(\d+)_/) || []).slice(1).join('.')).filter(Boolean))]
  .map(Number).sort((a, b) => a - b);
const frames = times.map(t => {
  const tag = 't' + String(Math.floor(t)) + 'p' + String(Math.round((t % 1) * 100)).padStart(2, '0');
  const paths = planes.map(p => path.join(sdir, `${tag}_${field}_${p}.f32`));
  return paths.every(p => fs.existsSync(p)) ? { t, paths } : null;
}).filter(Boolean);
if (!frames.length) { console.error(`no complete snapshots for field ${field} planes ${planes.join(',')} in ${sdir}`); process.exit(1); }

const read = f => { const b = fs.readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };

// pass 1 — the fixed scale, and the per-frame slice maxima for the caption
let vmax = 0; const perFrame = [];
for (const fr of frames) {
  let m = 0;
  for (const p of fr.paths) { const d = read(p); for (let i = 0; i < d.length; i++) { const v = useAbs ? Math.abs(d[i]) : d[i]; if (v > m) m = v; } }
  perFrame.push(m); if (m > vmax) vmax = m;
}
if (vmaxOpt !== 'auto') vmax = +vmaxOpt;

const N = Math.round(Math.sqrt(read(frames[0].paths[0]).length));
const k0 = scaleOpt || Math.max(1, Math.round(512 / N));
const PANEL = N * k0, GAP = 3 * k0, BAR = Math.max(4, Math.round(6 * k0));
let W = planes.length * PANEL + (planes.length - 1) * GAP, H = PANEL + BAR;
const padW = W % 2, padH = H % 2;                       // h264 needs even dimensions
W += padW; H += padH;

const ramp = [[0, [14, 20, 28]], [0.3, [16, 76, 110]], [0.65, [0, 212, 255]], [1, [245, 252, 255]]];
const col = v => { v = Math.max(0, Math.min(1, v)); for (let i = 1; i < ramp.length; i++) if (v <= ramp[i][0]) { const [a, ca] = ramp[i - 1], [b, cb] = ramp[i], s = (v - a) / (b - a); return ca.map((c, j) => Math.round(c + (cb[j] - c) * s)); } return ramp[ramp.length - 1][1]; };

const crcT = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let q = 0; q < 8; q++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; }
const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
function writePng(rgb, file) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let i = 0; i < H; i++) { raw[i * (W * 3 + 1)] = 0; rgb.copy(raw, i * (W * 3 + 1) + 1, i * W * 3, (i + 1) * W * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nslab-mov-'));
const tEnd = frames[frames.length - 1].t;
frames.forEach((fr, fi) => {
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) { const o = (i * W + j) * 3; rgb[o] = 8; rgb[o + 1] = 11; rgb[o + 2] = 16; }
  fr.paths.forEach((p, pi) => {
    const d = read(p), x0 = pi * (PANEL + GAP), k = PANEL / N;
    for (let i = 0; i < PANEL; i++) for (let j = 0; j < PANEL; j++) {
      const y = i / k - 0.5, x = j / k - 0.5, y0 = Math.max(0, Math.floor(y)), xb = Math.max(0, Math.floor(x));
      const y1 = Math.min(N - 1, y0 + 1), x1 = Math.min(N - 1, xb + 1), fy = Math.max(0, y - y0), fx = Math.max(0, x - xb);
      const s = (1 - fy) * ((1 - fx) * d[y0 * N + xb] + fx * d[y0 * N + x1]) + fy * ((1 - fx) * d[y1 * N + xb] + fx * d[y1 * N + x1]);
      const v = useAbs ? Math.abs(s) : s, c = col(Math.sqrt(Math.max(0, v) / vmax)), o = (i * W + x0 + j) * 3;
      rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
    }
  });
  // progress bar: filled to t/tEnd, in the same cyan as the palette's mid stop
  const filled = Math.round((W - padW) * (fr.t / tEnd));
  for (let i = PANEL + Math.round(BAR / 3); i < PANEL + BAR - Math.round(BAR / 3); i++)
    for (let j = 0; j < W - padW; j++) { const o = (i * W + j) * 3; const on = j < filled; rgb[o] = on ? 0 : 24; rgb[o + 1] = on ? 212 : 30; rgb[o + 2] = on ? 255 : 38; }
  writePng(rgb, path.join(tmp, `f${String(fi).padStart(4, '0')}.png`));
});

const out = path.resolve(opt('out', path.join(runDir, `movie-${field}-${planes.join('-')}.mp4`)));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]);
if (wantGif) {
  const gif = out.replace(/\.mp4$/, '.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png'),
    '-vf', `fps=${fps},scale=${Math.min(720, W)}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`, gif]);
  console.log(`wrote ${gif}`);
}
for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f)); fs.rmdirSync(tmp);

console.log(`${path.basename(runDir)} · ${field} · planes ${planes.join(', ')} · ${frames.length} frames t 0→${tEnd}`);
console.log(`fixed colour scale sqrt(v / ${vmax.toFixed(2)}) — slice maxima (LOWER BOUNDS on max|ω|, the 3D peak is off-plane):`);
console.log('  ' + frames.map((fr, i) => `${fr.t.toFixed(1)}:${perFrame[i].toFixed(1)}`).join('  '));
console.log(`wrote ${out} (${W}×${H}, ${fps} fps)`);
