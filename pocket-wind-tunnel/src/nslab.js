/*
 * Pocket Wind Tunnel — NSLab: 3D incompressible Navier–Stokes laboratory
 * --------------------------------------------------------------
 *   ∂u/∂t + (u·∇)u = −∇p + ν∇²u,   ∇·u = 0   on the periodic box [0, 2π]³
 *
 *   • Fourier pseudo-spectral in space (mixed-radix 2/3/4 FFT written here; real-to-complex 3D transforms),
 *     rotational form u×ω for the nonlinear term, 2/3-rule dealiasing, exact projection → ∇·u = 0 to round-off
 *   • Classical RK4 in time, adaptive Δt from a CFL condition or fixed Δt for temporal-refinement studies
 *   • Diagnostics: energy E, enstrophy Z, palinstrophy P, dissipation ε = 2νZ, max |ω| and |u|, spectral and
 *     physical-space vortex stretching ⟨ω·S·ω⟩, energy spectrum E(k), Kolmogorov scale and kmax·η, velocity-
 *     derivative skewness, vorticity/strain-eigenvector alignment, Q-criterion and stretching fields for slices
 *   • Verification: exact nonlinear energy conservation, RK4-consistent energy and enstrophy budgets, divergence,
 *     resolution checks — everything a run needs to be trusted or rejected
 *   • Initial conditions: Taylor–Green (3D and 2D), Arnold–Beltrami–Childress (exact 3D decaying solution),
 *     antiparallel vortex tubes, random solenoidal field with a prescribed spectrum
 *
 * Non-dimensional: box 2π, velocity scale 1, Re = 1/ν. Runs in the browser (Web Worker) and in Node.
 * It is a conjecture generator, not a proof engine: numerical growth is not a mathematical singularity.
 */
const NS = (() => {
'use strict';
const VERSION = '0.1.2';
const TWO_PI = 2 * Math.PI;

// ============================================================
// 1. FFT — mixed-radix (2, 3, 4) Stockham autosort, complex, in place on separate re/im arrays
// ============================================================
function factorize(N) {
  const f = []; let n = N;
  while (n % 4 === 0) { f.push(4); n /= 4; }
  while (n % 2 === 0) { f.push(2); n /= 2; }
  while (n % 3 === 0) { f.push(3); n /= 3; }
  if (n !== 1 || N < 4) throw new Error('grid size must be 2^a·3^b ≥ 4 (got ' + N + ')');
  return f;
}
function fftPlan(N) {
  const stages = []; let n = N;
  for (const r of factorize(N)) {
    const m = n / r, wc = new Float64Array((r - 1) * m), ws = new Float64Array((r - 1) * m);
    for (let j = 1; j < r; j++) for (let p = 0; p < m; p++) { const a = TWO_PI * j * p / n; wc[(j - 1) * m + p] = Math.cos(a); ws[(j - 1) * m + p] = Math.sin(a); }
    stages.push({ r, n, m, wc, ws }); n = m;
  }
  return { N, stages, xr: new Float64Array(N), xi: new Float64Array(N), yr: new Float64Array(N), yi: new Float64Array(N) };
}
/** In-place transform of plan.xr/xi. sign −1 = forward e^{−ikx}, +1 = inverse (unnormalised). Returns [re, im]. */
function fft1(plan, sign) {
  let xr = plan.xr, xi = plan.xi, yr = plan.yr, yi = plan.yi, s = 1;
  const S3 = -sign * 0.8660254037844386;   // forward: −i·(√3/2) in the radix-3 butterfly
  for (const st of plan.stages) {
    const { r, m, wc, ws } = st;
    if (r === 2) {
      for (let p = 0; p < m; p++) {
        const c = wc[p], d = sign * ws[p];
        for (let q = 0; q < s; q++) {
          const i0 = q + s * p, i1 = i0 + s * m, o0 = q + s * 2 * p, o1 = o0 + s;
          const ar = xr[i0], ai = xi[i0], br = xr[i1], bi = xi[i1];
          yr[o0] = ar + br; yi[o0] = ai + bi;
          const tr = ar - br, ti = ai - bi; yr[o1] = tr * c - ti * d; yi[o1] = tr * d + ti * c;
        }
      }
    } else if (r === 4) {
      for (let p = 0; p < m; p++) {
        const c1 = wc[p], d1 = sign * ws[p], c2 = wc[m + p], d2 = sign * ws[m + p], c3 = wc[2 * m + p], d3 = sign * ws[2 * m + p];
        for (let q = 0; q < s; q++) {
          const i0 = q + s * p, i1 = i0 + s * m, i2 = i1 + s * m, i3 = i2 + s * m, o0 = q + s * 4 * p, o1 = o0 + s, o2 = o1 + s, o3 = o2 + s;
          const a0r = xr[i0], a0i = xi[i0], a1r = xr[i1], a1i = xi[i1], a2r = xr[i2], a2i = xi[i2], a3r = xr[i3], a3i = xi[i3];
          const t0r = a0r + a2r, t0i = a0i + a2i, t1r = a0r - a2r, t1i = a0i - a2i, t2r = a1r + a3r, t2i = a1i + a3i, t3r = a1r - a3r, t3i = a1i - a3i;
          yr[o0] = t0r + t2r; yi[o0] = t0i + t2i;
          let br = t1r - sign * t3i, bi = t1i + sign * t3r;            // b1 = t1 + sign·i·t3
          yr[o1] = br * c1 - bi * d1; yi[o1] = br * d1 + bi * c1;
          br = t0r - t2r; bi = t0i - t2i; yr[o2] = br * c2 - bi * d2; yi[o2] = br * d2 + bi * c2;
          br = t1r + sign * t3i; bi = t1i - sign * t3r;                // b3 = t1 − sign·i·t3
          yr[o3] = br * c3 - bi * d3; yi[o3] = br * d3 + bi * c3;
        }
      }
    } else {   // r === 3
      for (let p = 0; p < m; p++) {
        const c1 = wc[p], d1 = sign * ws[p], c2 = wc[m + p], d2 = sign * ws[m + p];
        for (let q = 0; q < s; q++) {
          const i0 = q + s * p, i1 = i0 + s * m, i2 = i1 + s * m, o0 = q + s * 3 * p, o1 = o0 + s, o2 = o1 + s;
          const a0r = xr[i0], a0i = xi[i0], a1r = xr[i1], a1i = xi[i1], a2r = xr[i2], a2i = xi[i2];
          const sr = a1r + a2r, si = a1i + a2i, ur = a0r - 0.5 * sr, ui = a0i - 0.5 * si, vr = S3 * (a1r - a2r), vi = S3 * (a1i - a2i);
          yr[o0] = a0r + sr; yi[o0] = a0i + si;
          let br = ur + vi, bi = ui - vr; yr[o1] = br * c1 - bi * d1; yi[o1] = br * d1 + bi * c1;   // b1 = u − i·v
          br = ur - vi; bi = ui + vr; yr[o2] = br * c2 - bi * d2; yi[o2] = br * d2 + bi * c2;       // b2 = u + i·v
        }
      }
    }
    let t = xr; xr = yr; yr = t; t = xi; xi = yi; yi = t; s *= r;
  }
  return [xr, xi];
}

/** 3D real ↔ half-spectrum transforms on an N³ periodic grid. Spectral layout: index (kz·N + ky)·NH + kx, kx = 0..N/2. */
class Spectral {
  constructor(N) {
    this.N = N; this.NH = N / 2 + 1; this.NS = N * N * this.NH; this.N3 = N * N * N;
    this.plan = fftPlan(N);
    this.wr = new Float64Array(this.NS); this.wi = new Float64Array(this.NS);
  }
  /** Forward: real f[N³] → (re, im) Fourier coefficients (normalised so that f = Σ û e^{ik·x}). */
  forward(f, re, im) {
    const { N, NH, plan } = this, xr = plan.xr, xi = plan.xi, half = N / 2;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y += 2) {        // x: two real lines packed as one complex line
      const b0 = (z * N + y) * N, b1 = b0 + N;
      for (let x = 0; x < N; x++) { xr[x] = f[b0 + x]; xi[x] = f[b1 + x]; }
      const [Zr, Zi] = fft1(plan, -1);
      const o0 = (z * N + y) * NH, o1 = o0 + NH;
      for (let k = 0; k <= half; k++) {
        const kk = (N - k) % N, zr = Zr[k], zi = Zi[k], cr = Zr[kk], ci = -Zi[kk];
        re[o0 + k] = 0.5 * (zr + cr); im[o0 + k] = 0.5 * (zi + ci);
        re[o1 + k] = 0.5 * (zi - ci); im[o1 + k] = -0.5 * (zr - cr);
      }
    }
    for (let z = 0; z < N; z++) for (let k = 0; k < NH; k++) {           // y
      const base = z * N * NH + k;
      for (let j = 0; j < N; j++) { const idx = base + j * NH; xr[j] = re[idx]; xi[j] = im[idx]; }
      const [Zr, Zi] = fft1(plan, -1);
      for (let j = 0; j < N; j++) { const idx = base + j * NH; re[idx] = Zr[j]; im[idx] = Zi[j]; }
    }
    const inv = 1 / this.N3, stride = N * NH;
    for (let j = 0; j < N; j++) for (let k = 0; k < NH; k++) {           // z (+ normalisation)
      const base = j * NH + k;
      for (let l = 0; l < N; l++) { const idx = base + l * stride; xr[l] = re[idx]; xi[l] = im[idx]; }
      const [Zr, Zi] = fft1(plan, -1);
      for (let l = 0; l < N; l++) { const idx = base + l * stride; re[idx] = Zr[l] * inv; im[idx] = Zi[l] * inv; }
    }
  }
  /** Inverse: (re, im) → real f[N³]. The spectral input is not modified. */
  inverse(re, im, f) {
    const { N, NH, plan, wr, wi } = this, xr = plan.xr, xi = plan.xi, half = N / 2, stride = N * NH;
    for (let j = 0; j < N; j++) for (let k = 0; k < NH; k++) {           // z
      const base = j * NH + k;
      for (let l = 0; l < N; l++) { const idx = base + l * stride; xr[l] = re[idx]; xi[l] = im[idx]; }
      const [Zr, Zi] = fft1(plan, 1);
      for (let l = 0; l < N; l++) { const idx = base + l * stride; wr[idx] = Zr[l]; wi[idx] = Zi[l]; }
    }
    for (let z = 0; z < N; z++) for (let k = 0; k < NH; k++) {           // y
      const base = z * N * NH + k;
      for (let j = 0; j < N; j++) { const idx = base + j * NH; xr[j] = wr[idx]; xi[j] = wi[idx]; }
      const [Zr, Zi] = fft1(plan, 1);
      for (let j = 0; j < N; j++) { const idx = base + j * NH; wr[idx] = Zr[j]; wi[idx] = Zi[j]; }
    }
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y += 2) {        // x: rebuild the full line by Hermitian symmetry, two outputs per transform
      const o0 = (z * N + y) * NH, o1 = o0 + NH;
      for (let k = 0; k <= half; k++) {
        const Ar = wr[o0 + k], Ai = wi[o0 + k], Br = wr[o1 + k], Bi = wi[o1 + k];
        xr[k] = Ar - Bi; xi[k] = Ai + Br;
        if (k > 0 && k < half) { xr[N - k] = Ar + Bi; xi[N - k] = Br - Ai; }
      }
      const [Zr, Zi] = fft1(plan, 1);
      const b0 = (z * N + y) * N, b1 = b0 + N;
      for (let x = 0; x < N; x++) { f[b0 + x] = Zr[x]; f[b1 + x] = Zi[x]; }
    }
  }
}

// ============================================================
// 2. SOLVER
// ============================================================
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const IC_INFO = {
  tgv: { name: 'Taylor–Green vortex (3D)', exact: null, desc: 'u = sin x cos y cos z, v = −cos x sin y cos z, w = 0 (Brachet et al. 1983)' },
  tgv2d: { name: 'Taylor–Green vortex (2D, exact decay)', exact: 'e^{-2νt}', desc: 'u = sin x cos y, v = −cos x sin y, w = 0 — exact solution ∝ e^{−2νt}' },
  abc: { name: 'Arnold–Beltrami–Childress (exact decay)', exact: 'e^{-νt}', desc: 'u = A sin z + C cos y, v = B sin x + A cos z, w = C sin y + B cos x — Beltrami, exact solution ∝ e^{−νt}' },
  tubes: { name: 'Antiparallel vortex tubes', exact: null, desc: 'two Gaussian-core tubes of opposite circulation along x, sinusoidally perturbed (Kerr-type reconnection / stretching experiment)' },
  random: { name: 'Random solenoidal field', exact: null, desc: 'Gaussian random field with E(k) ∝ k⁴ exp(−2(k/k₀)²), seeded (decaying isotropic turbulence)' },
};

function createSolver(opts) {
  const N = opts.N || 32, NH = N / 2 + 1, NS = N * N * NH, N3 = N * N * N;
  const nu = opts.nu != null ? opts.nu : 1 / (opts.Re || 100), Re = 1 / nu;
  const cfl = opts.cfl || 0.4, dtFixed = opts.dt || 0;
  const sp = new Spectral(N);
  const kc = Math.floor(N / 3);                     // 2/3-rule cut-off: keep |k_i| ≤ kc
  const kx = new Float64Array(NH), kw = new Float64Array(N);
  for (let i = 0; i < NH; i++) kx[i] = i;
  for (let j = 0; j < N; j++) kw[j] = j <= N / 2 ? j : j - N;
  const mask = new Uint8Array(NS);
  for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < NH; i++) mask[(l * N + j) * NH + i] = (Math.abs(kw[l]) <= kc && Math.abs(kw[j]) <= kc && i <= kc) ? 1 : 0;
  const hw = new Float64Array(NH); for (let i = 0; i < NH; i++) hw[i] = (i === 0 || i === N / 2) ? 1 : 2;   // Hermitian weights for sums over all k
  const alloc = () => new Float64Array(NS), allocP = () => new Float64Array(N3);
  const S = [alloc(), alloc(), alloc(), alloc(), alloc(), alloc()];   // ûx re,im, ûy re,im, ûz re,im
  const T = S.map(alloc), K = S.map(alloc), ACC = S.map(alloc);
  const NL = [alloc(), alloc(), alloc(), alloc(), alloc(), alloc()];  // ω̂ then (u×ω)^
  const up = [allocP(), allocP(), allocP()], om = [allocP(), allocP(), allocP()];
  const st = { t: 0, step: 0, dt: 0, N, Re, nu, kc, ic: opts.ic || 'tgv', icParams: opts.icParams || {}, version: VERSION,
    series: { t: [], E: [], Z: [], eps: [], omMax: [], uMax: [], dt: [], ebal: [], zbal: [], Pspec: [], Pal: [] },
    maxEbal: 0, maxZbal: 0, maxTnl: 0, divMax: 0, outputs: [] };
  let last = null;   // diagnostics of the most recent rhs() input state

  // ---- spectral helpers ----
  function project(U, applyMask) {   // remove the gradient part: v̂ ← v̂ − k (k·v̂)/k²; zero the mean and the dealiased modes
    const [ar, ai, br, bi, cr, ci] = U;
    for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
      for (let i = 0; i < NH; i++) { const idx = row + i, kxx = kx[i], k2 = kxx * kxx + ky * ky + kz * kz;
        if (k2 === 0 || (applyMask && !mask[idx])) { ar[idx] = ai[idx] = br[idx] = bi[idx] = cr[idx] = ci[idx] = 0; continue; }
        const dr = (kxx * ar[idx] + ky * br[idx] + kz * cr[idx]) / k2, di = (kxx * ai[idx] + ky * bi[idx] + kz * ci[idx]) / k2;
        ar[idx] -= kxx * dr; ai[idx] -= kxx * di; br[idx] -= ky * dr; bi[idx] -= ky * di; cr[idx] -= kz * dr; ci[idx] -= kz * di;
      } } }
  }
  function curlHat(U, W) {   // ω̂ = i k × û
    const [ar, ai, br, bi, cr, ci] = U, [wxr, wxi, wyr, wyi, wzr, wzi] = W;
    for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
      for (let i = 0; i < NH; i++) { const idx = row + i, kxx = kx[i];
        // i·(a + ib) = −b + ia
        let pr = ky * cr[idx] - kz * br[idx], pi = ky * ci[idx] - kz * bi[idx]; wxr[idx] = -pi; wxi[idx] = pr;
        pr = kz * ar[idx] - kxx * cr[idx]; pi = kz * ai[idx] - kxx * ci[idx]; wyr[idx] = -pi; wyi[idx] = pr;
        pr = kxx * br[idx] - ky * ar[idx]; pi = kxx * bi[idx] - ky * ai[idx]; wzr[idx] = -pi; wzi[idx] = pr;
      } } }
  }
  /** Energy, enstrophy, palinstrophy of a spectral state. */
  function norms(U) {
    let E = 0, Z = 0, P = 0;
    for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
      for (let i = 0; i < NH; i++) { const idx = row + i, k2 = kx[i] * kx[i] + ky * ky + kz * kz;
        const e = hw[i] * (U[0][idx] * U[0][idx] + U[1][idx] * U[1][idx] + U[2][idx] * U[2][idx] + U[3][idx] * U[3][idx] + U[4][idx] * U[4][idx] + U[5][idx] * U[5][idx]);
        E += e; Z += k2 * e; P += k2 * k2 * e;
      } } }
    return { E: 0.5 * E, Z: 0.5 * Z, P: 0.5 * P };
  }
  /** RHS of dû/dt = P[(u×ω)^] − νk²û. Also fills diagnostics of the input state into `last`. */
  function rhs(U, OUT) {
    curlHat(U, NL);
    for (let c = 0; c < 3; c++) { sp.inverse(U[2 * c], U[2 * c + 1], up[c]); sp.inverse(NL[2 * c], NL[2 * c + 1], om[c]); }
    let omMax = 0, uMax = 0;
    const [u, v, w] = up, [ox, oy, oz] = om;
    for (let n = 0; n < N3; n++) {
      const a = u[n], b = v[n], c = w[n], p = ox[n], q = oy[n], r = oz[n];
      const o2 = p * p + q * q + r * r, u2 = a * a + b * b + c * c; if (o2 > omMax) omMax = o2; if (u2 > uMax) uMax = u2;
      ox[n] = b * r - c * q; oy[n] = c * p - a * r; oz[n] = a * q - b * p;   // u × ω (in place)
    }
    for (let c = 0; c < 3; c++) sp.forward(om[c], NL[2 * c], NL[2 * c + 1]);
    project(NL, true);
    // nonlinear energy transfer (must vanish), spectral stretching Pspec = Re Σ k² û*·n̂, viscous term
    let Tnl = 0, Pspec = 0, E = 0, Z = 0, Pal = 0;
    for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
      for (let i = 0; i < NH; i++) { const idx = row + i, k2 = kx[i] * kx[i] + ky * ky + kz * kz, h = hw[i];
        let dot = 0, e = 0;
        for (let c = 0; c < 3; c++) { const ur = U[2 * c][idx], ui = U[2 * c + 1][idx], nr = NL[2 * c][idx], ni = NL[2 * c + 1][idx]; dot += ur * nr + ui * ni; e += ur * ur + ui * ui;
          OUT[2 * c][idx] = nr - nu * k2 * ur; OUT[2 * c + 1][idx] = ni - nu * k2 * ui; }
        Tnl += h * dot; Pspec += h * k2 * dot; E += h * e; Z += h * k2 * e; Pal += h * k2 * k2 * e;
      } } }
    last = { E: 0.5 * E, Z: 0.5 * Z, P: 0.5 * Pal, eps: nu * Z, Tnl, Pspec, omMax: Math.sqrt(omMax), uMax: Math.sqrt(uMax) };
    return last;
  }

  // ---- initial conditions ----
  function setIC(kind, prm) {
    prm = Object.assign({}, prm || {}); st.ic = kind; st.icParams = prm;
    const h = TWO_PI / N, [u, v, w] = up;
    const fill = fn => { for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const n = (l * N + j) * N + i; fn(i * h, j * h, l * h, n); } };
    if (kind === 'tgv') fill((x, y, z, n) => { u[n] = Math.sin(x) * Math.cos(y) * Math.cos(z); v[n] = -Math.cos(x) * Math.sin(y) * Math.cos(z); w[n] = 0; });
    else if (kind === 'tgv2d') fill((x, y, z, n) => { u[n] = Math.sin(x) * Math.cos(y); v[n] = -Math.cos(x) * Math.sin(y); w[n] = 0; });
    else if (kind === 'abc') { const A = prm.A != null ? prm.A : 1, B = prm.B != null ? prm.B : 1, C = prm.C != null ? prm.C : 1; fill((x, y, z, n) => { u[n] = A * Math.sin(z) + C * Math.cos(y); v[n] = B * Math.sin(x) + A * Math.cos(z); w[n] = C * Math.sin(y) + B * Math.cos(x); }); }
    else if (kind === 'tubes') {
      // vorticity along ±x: tube 1 at (y, z) = (π − d(x), π), tube 2 at (π + d(x), π); d(x) = d0 + δ cos x brings them closest at x = π
      const amp = prm.amp != null ? prm.amp : 8, sig = prm.sigma != null ? prm.sigma : 0.4, d0 = prm.sep != null ? prm.sep : 0.7, del = prm.pert != null ? prm.pert : 0.2;
      const [ox, oy, oz] = om;
      fill((x, y, z, n) => { const d = d0 + del * Math.cos(x); let s = 0;
        for (let sgn = -1; sgn <= 1; sgn += 2) { const yc = Math.PI + sgn * d, zc = Math.PI; let best = Infinity;
          for (let py = -1; py <= 1; py++) for (let pz = -1; pz <= 1; pz++) { const dy = y - yc + py * TWO_PI, dz = z - zc + pz * TWO_PI; best = Math.min(best, dy * dy + dz * dz); }
          s += -sgn * amp * Math.exp(-best / (sig * sig)); }
        ox[n] = s; oy[n] = 0; oz[n] = 0; });
      for (let c = 0; c < 3; c++) sp.forward(om[c], NL[2 * c], NL[2 * c + 1]);
      project(NL, true);   // solenoidal vorticity
      // û = i k × ω̂ / k²
      curlHat(NL, S);
      for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
        for (let i = 0; i < NH; i++) { const idx = row + i, k2 = kx[i] * kx[i] + ky * ky + kz * kz || 1; for (let c = 0; c < 6; c++) S[c][idx] /= k2; } } }
      project(S, true); st.t = 0; st.step = 0; return finishIC();
    } else if (kind === 'random') {
      const rnd = mulberry32((prm.seed || 1) | 0), k0 = prm.k0 || 4, E0 = prm.E0 || 0.5;
      const gauss = () => { const a = Math.max(rnd(), 1e-12), b = rnd(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(TWO_PI * b); };
      for (let c = 0; c < 6; c++) S[c].fill(0);
      for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
        for (let i = 0; i < NH; i++) { const idx = row + i; if (!mask[idx]) continue; const k2 = kx[i] * kx[i] + ky * ky + kz * kz; if (k2 === 0) continue;
          if (i === 0 && (kz < 0 || (kz === 0 && ky < 0))) continue;   // filled by Hermitian symmetry below
          const k = Math.sqrt(k2), amp = Math.sqrt(Math.pow(k, 4) * Math.exp(-2 * (k / k0) * (k / k0)) / (4 * Math.PI * k2));
          for (let c = 0; c < 3; c++) { S[2 * c][idx] = amp * gauss(); S[2 * c + 1][idx] = amp * gauss(); }
          if (i === 0) { const jm = (N - j) % N, lm = (N - l) % N, idm = (lm * N + jm) * NH; for (let c = 0; c < 3; c++) { S[2 * c][idm] = S[2 * c][idx]; S[2 * c + 1][idm] = -S[2 * c + 1][idx]; } }
        } } }
      project(S, true);
      const e = norms(S).E, sc = Math.sqrt(E0 / e); for (let c = 0; c < 6; c++) for (let n = 0; n < NS; n++) S[c][n] *= sc;
      st.t = 0; st.step = 0; return finishIC();
    } else throw new Error('unknown initial condition ' + kind);
    for (let c = 0; c < 3; c++) sp.forward(up[c], S[2 * c], S[2 * c + 1]);
    project(S, true);
    st.t = 0; st.step = 0;
    return finishIC();
  }
  function finishIC() {
    for (const k of Object.keys(st.series)) st.series[k].length = 0;
    st.outputs.length = 0; st.maxEbal = st.maxZbal = st.maxTnl = st.divMax = 0;
    rhs(S, K); st.E0 = last.E; st.Z0 = last.Z;
    record(0);
    return last;
  }
  function record(dt) {
    const s = st.series; s.t.push(st.t); s.E.push(last.E); s.Z.push(last.Z); s.eps.push(last.eps); s.omMax.push(last.omMax); s.uMax.push(last.uMax); s.dt.push(dt); s.Pspec.push(last.Pspec); s.Pal.push(last.P);
  }

  // ---- time stepping ----
  function chooseDt() {
    if (dtFixed > 0) return dtFixed;
    const dx = TWO_PI / N, uMax = Math.max(last.uMax, 1e-9);
    const dtc = cfl * dx / uMax, dtv = 2.5 / (3 * nu * kc * kc + 1e-30);
    return Math.min(dtc, dtv);
  }
  /** One RK4 step with RK4-consistent energy/enstrophy budget checks (Simpson weights over the stage states). */
  function step() {
    rhs(S, K);   // stage 1 (also refreshes `last` for the current state)
    const d0 = last, dt = chooseDt(); st.dt = dt;
    const E0 = d0.E, Z0 = d0.Z, eps = [d0.eps], zr = [d0.Pspec - 2 * nu * d0.P];
    st.maxTnl = Math.max(st.maxTnl, Math.abs(d0.Tnl) / Math.max(d0.eps, 1e-300));
    for (let c = 0; c < 6; c++) { const s = S[c], k = K[c], a = ACC[c], t = T[c]; for (let n = 0; n < NS; n++) { a[n] = k[n]; t[n] = s[n] + 0.5 * dt * k[n]; } }
    rhs(T, K); eps.push(last.eps); zr.push(last.Pspec - 2 * nu * last.P);
    for (let c = 0; c < 6; c++) { const s = S[c], k = K[c], a = ACC[c], t = T[c]; for (let n = 0; n < NS; n++) { a[n] += 2 * k[n]; t[n] = s[n] + 0.5 * dt * k[n]; } }
    rhs(T, K); eps.push(last.eps); zr.push(last.Pspec - 2 * nu * last.P);
    for (let c = 0; c < 6; c++) { const s = S[c], k = K[c], a = ACC[c], t = T[c]; for (let n = 0; n < NS; n++) { a[n] += 2 * k[n]; t[n] = s[n] + dt * k[n]; } }
    rhs(T, K); eps.push(last.eps); zr.push(last.Pspec - 2 * nu * last.P);
    for (let c = 0; c < 6; c++) { const s = S[c], k = K[c], a = ACC[c]; const f = dt / 6; for (let n = 0; n < NS; n++) s[n] += f * (a[n] + k[n]); }
    st.t += dt; st.step++;
    // budgets: E(t+dt) − E(t) = −∫ε dt,  Z(t+dt) − Z(t) = ∫(Pspec − 2νP) dt, Simpson over the RK4 stages
    const nn = norms(S);
    const dEpred = -dt / 6 * (eps[0] + 2 * eps[1] + 2 * eps[2] + eps[3]), dZpred = dt / 6 * (zr[0] + 2 * zr[1] + 2 * zr[2] + zr[3]);
    const ebal = Math.abs((nn.E - E0) - dEpred) / Math.max(st.E0, 1e-300), zbal = Math.abs((nn.Z - Z0) - dZpred) / Math.max(nn.Z, Z0, 1e-300);
    st.maxEbal = Math.max(st.maxEbal, ebal); st.maxZbal = Math.max(st.maxZbal, zbal);
    rhs(S, K);   // diagnostics of the new state (one extra evaluation per step; keeps the series exact at t_{n+1})
    record(dt); st.series.ebal.push(ebal); st.series.zbal.push(zbal);
    return last;
  }
  function run(nSteps, tEnd) { for (let i = 0; i < nSteps; i++) { if (tEnd != null && st.t >= tEnd - 1e-12) break; step(); } return last; }

  // ---- full diagnostics (physical-space gradients, spectrum, alignment) ----
  const G = [allocP(), allocP(), allocP()], Sxx = allocP(), Syy = allocP(), Szz = allocP(), Sxy = allocP(), Sxz = allocP(), Syz = allocP(), G2 = allocP(), PST = allocP();
  const fields = { u: up[0], v: up[1], w: up[2], omx: om[0], omy: om[1], omz: om[2], stretch: PST, q: G2 };   // q = Q-criterion after diagnose(); G2 reused
  function diagnose() {
    rhs(S, K);   // u, ω physical for the current state (om is overwritten with u×ω by rhs → recompute ω below)
    curlHat(S, NL); for (let c = 0; c < 3; c++) sp.inverse(NL[2 * c], NL[2 * c + 1], om[c]);
    const [u, v, w] = up, [ox, oy, oz] = om;
    Sxx.fill(0); Syy.fill(0); Szz.fill(0); Sxy.fill(0); Sxz.fill(0); Syz.fill(0); G2.fill(0); PST.fill(0);
    let skew3 = 0, skew2 = 0, divMax = 0;
    const dre = sp.wr, dim_ = sp.wi;   // borrow the inverse's work arrays? no — inverse uses them; allocate dedicated
    const tr = NL[0], ti = NL[1];
    for (let c = 0; c < 3; c++) {   // ∂_j u_c for j = x, y, z
      const ur = S[2 * c], ui = S[2 * c + 1];
      for (let jdir = 0; jdir < 3; jdir++) {
        for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
          for (let i = 0; i < NH; i++) { const idx = row + i, kk = jdir === 0 ? kx[i] : jdir === 1 ? ky : kz; tr[idx] = -kk * ui[idx]; ti[idx] = kk * ur[idx]; } } }
        sp.inverse(tr, ti, G[jdir]);
      }
      const oc = om[c], gx = G[0], gy = G[1], gz = G[2];
      for (let n = 0; n < N3; n++) {
        const a = gx[n], b = gy[n], d = gz[n];
        G2[n] += a * a + b * b + d * d;
        PST[n] += oc[n] * (ox[n] * a + oy[n] * b + oz[n] * d);
        const dg = c === 0 ? a : c === 1 ? b : d; skew3 += dg * dg * dg; skew2 += dg * dg;
      }
      if (c === 0) { for (let n = 0; n < N3; n++) { Sxx[n] = gx[n]; Sxy[n] += 0.5 * gy[n]; Sxz[n] += 0.5 * gz[n]; } }
      else if (c === 1) { for (let n = 0; n < N3; n++) { Syy[n] = gy[n]; Sxy[n] += 0.5 * gx[n]; Syz[n] += 0.5 * gz[n]; } }
      else { for (let n = 0; n < N3; n++) { Szz[n] = gz[n]; Sxz[n] += 0.5 * gx[n]; Syz[n] += 0.5 * gy[n]; } }
    }
    // divergence (should be round-off), Q-criterion, physical stretching ⟨ω·S·ω⟩, alignment statistics, ⟨|u|³⟩ (the L³ norm of the ESS criterion)
    let Pphys = 0, align = [0, 0, 0], cnt = 0, u3 = 0; const bins = 16, hist = [new Float64Array(bins), new Float64Array(bins), new Float64Array(bins)];
    for (let n = 0; n < N3; n++) {
      const dv = Math.abs(Sxx[n] + Syy[n] + Szz[n]); if (dv > divMax) divMax = dv;
      const o2 = ox[n] * ox[n] + oy[n] * oy[n] + oz[n] * oz[n];
      u3 += Math.pow(u[n] * u[n] + v[n] * v[n] + w[n] * w[n], 1.5);
      G2[n] = 0.25 * o2 - 0.5 * G2[n];   // Q = ¼|ω|² − ½ ‖∇u‖²
      Pphys += PST[n];
      if (o2 > 1e-20) {
        const ev = eig3(Sxx[n], Syy[n], Szz[n], Sxy[n], Sxz[n], Syz[n]), io = 1 / Math.sqrt(o2);
        for (let e = 0; e < 3; e++) { const cs = Math.abs((ox[n] * ev[e][0] + oy[n] * ev[e][1] + oz[n] * ev[e][2]) * io); align[e] += cs; hist[e][Math.min(bins - 1, Math.floor(cs * bins))]++; }
        cnt++;
      }
    }
    st.divMax = Math.max(st.divMax, divMax);
    const spec = spectrum();
    const d = last, eta = Math.pow(nu * nu * nu / Math.max(d.eps, 1e-300), 0.25), kmax = Math.sqrt(3) * kc;
    const lam = Math.sqrt(10 * nu * d.E / Math.max(d.eps, 1e-300)), Rel = Math.sqrt(2 * d.E / 3) * lam / nu;
    const out = { t: st.t, step: st.step, E: d.E, Z: d.Z, P: d.P, eps: d.eps, omMax: d.omMax, uMax: d.uMax, Pspec: d.Pspec, Pphys: Pphys / N3, Tnl: d.Tnl,
      skew: skew2 > 0 ? (skew3 / 3) / Math.pow(skew2 / 3, 1.5) : 0, divMax, eta, kmaxEta: kmax * eta, Rel, lambda: lam,
      skewIso: -(6 * Math.sqrt(15) / 7) * d.Pspec / Math.pow(Math.max(2 * d.Z, 1e-300), 1.5),   // Brachet's form: S from enstrophy production via the isotropic relation ⟨ωSω⟩ = −(7/6√15) S ⟨ω²⟩^{3/2}
      align: align.map(a => a / Math.max(cnt, 1)), alignHist: hist.map(h => Array.from(h, x => x / Math.max(cnt, 1))), spectrum: spec,
      uL3: Math.pow(u3 / N3, 1 / 3), pileUp: cutoffPileUp(spec) };                       // ESS diagnostic ‖u‖_{L³} (volume-averaged) and the cutoff pile-up
    Object.assign(out, imageDiag());                                                      // zCentroid, zExtent, imageGap, zBands
    if (N <= interpMaxN) Object.assign(out, interpMax());                                 // omMaxI, omMaxIpos, omMaxNode — O(N³) per evaluation, gated by grid size
    st.outputs.push(out);
    return out;
  }
  /** Eigenvectors of a symmetric 3×3 (Sxx, Syy, Szz, Sxy, Sxz, Syz), ordered λ1 ≥ λ2 ≥ λ3. */
  function eig3(a, b, c, d, e, f) {
    const p1 = d * d + e * e + f * f;
    if (p1 < 1e-30) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const q = (a + b + c) / 3, p2 = (a - q) * (a - q) + (b - q) * (b - q) + (c - q) * (c - q) + 2 * p1, p = Math.sqrt(p2 / 6);
    const A = (a - q) / p, B = (b - q) / p, C = (c - q) / p, D = d / p, Ee = e / p, F = f / p;
    let r = 0.5 * (A * (B * C - F * F) - D * (D * C - F * Ee) + Ee * (D * F - B * Ee)); r = Math.max(-1, Math.min(1, r));
    const phi = Math.acos(r) / 3;
    const l1 = q + 2 * p * Math.cos(phi), l3 = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3), l2 = 3 * q - l1 - l3;
    const vec = lam => {   // cross product of two rows of (S − λI), pick the largest
      const r0 = [a - lam, d, e], r1 = [d, b - lam, f], r2 = [e, f, c - lam];
      const cr = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
      const cands = [cr(r0, r1), cr(r0, r2), cr(r1, r2)]; let best = cands[0], bl = -1;
      for (const v of cands) { const l = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; if (l > bl) { bl = l; best = v; } }
      const l = Math.sqrt(bl) || 1; return [best[0] / l, best[1] / l, best[2] / l];
    };
    const e1 = vec(l1), e3 = vec(l3);
    const e2 = [e3[1] * e1[2] - e3[2] * e1[1], e3[2] * e1[0] - e3[0] * e1[2], e3[0] * e1[1] - e3[1] * e1[0]];
    return [e1, e2, e3];
  }
  /** Shell-averaged energy spectrum E(k), k = 0 … ⌈√3·kc⌉. */
  function spectrum() {
    const nb = Math.ceil(Math.sqrt(3) * kc) + 2, Ek = new Float64Array(nb);
    for (let l = 0; l < N; l++) { const kz = kw[l]; for (let j = 0; j < N; j++) { const ky = kw[j]; const row = (l * N + j) * NH;
      for (let i = 0; i < NH; i++) { const idx = row + i; if (!mask[idx]) continue; const k = Math.round(Math.sqrt(kx[i] * kx[i] + ky * ky + kz * kz)); if (k >= nb) continue;
        let e = 0; for (let c = 0; c < 6; c++) e += S[c][idx] * S[c][idx]; Ek[k] += 0.5 * hw[i] * e; } } }
    return Array.from(Ek);
  }
  /**
   * Spectrally interpolated maximum of |ω| (parity with the GPU runner 0.1.1).
   * The grid maximum samples the band-limited field at the nodes only and underestimates its continuous maximum by
   * O(Δx²). Here the trigonometric interpolant ω(x) = Re Σ_k hw_k ω̂_k e^{ik·x} — exact for the field the solver
   * represents — its gradient and its Hessian are evaluated at arbitrary x by staged contractions (kx, then ky, then
   * kz), and |ω|² is maximised by a safeguarded Newton ascent from the largest grid values ∪ largest grid local
   * maxima. Reported beside the grid maximum, never in its place.
   */
  const IW = [alloc(), alloc(), alloc(), alloc(), alloc(), alloc()];   // vorticity half-spectrum for the interpolant
  const interpMaxN = 128;   // the interpolant costs O(N³) per evaluation; above this the diagnostic is skipped in diagnose() (call interpMax() explicitly if wanted)
  function interpMax(top = 24, iters = 12) {
    curlHat(S, IW);
    // candidate start nodes from the physical |ω|² field (om holds ω after diagnose())
    const [ox, oy, oz] = om, o2 = (n) => ox[n] * ox[n] + oy[n] * oy[n] + oz[n] * oz[n];
    const cand = [];
    for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const n = (l * N + j) * N + i, v = o2(n);
      const lm = v >= o2(((l + 1) % N * N + j) * N + i) && v >= o2(((l + N - 1) % N * N + j) * N + i)
        && v >= o2((l * N + (j + 1) % N) * N + i) && v >= o2((l * N + (j + N - 1) % N) * N + i)
        && v >= o2((l * N + j) * N + (i + 1) % N) && v >= o2((l * N + j) * N + (i + N - 1) % N);
      if (lm) cand.push([v, i, j, l]);
    }
    let flat = [];
    for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) flat.push([o2((l * N + j) * N + i), i, j, l]);
    flat.sort((a, b) => b[0] - a[0]); cand.sort((a, b) => b[0] - a[0]);
    const starts = [], seen = new Set();
    for (const c of cand.slice(0, top).concat(flat.slice(0, top))) { const k = c[1] + ',' + c[2] + ',' + c[3]; if (!seen.has(k)) { seen.add(k); starts.push(c); } }
    flat = null;
    const h = TWO_PI / N;
    // staged contraction: returns [f, g(3), H(6)] of ω_c at x, for c = 0,1,2
    const A = new Float64Array(2 * N * N * 3), B = new Float64Array(2 * N * 3 * 3);
    function tensors(x, c) {
      const wr = IW[2 * c], wi = IW[2 * c + 1];
      A.fill(0);
      for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) {
        const row = (l * N + j) * NH; let s0r = 0, s0i = 0, s1r = 0, s1i = 0, s2r = 0, s2i = 0;
        for (let i = 0; i < NH; i++) {
          const idx = row + i, kxx = kx[i], ph = kxx * x[0], cr = Math.cos(ph), ci = Math.sin(ph), w = hw[i];
          const ar = w * (wr[idx] * cr - wi[idx] * ci), ai = w * (wr[idx] * ci + wi[idx] * cr);   // hw·ŵ·e^{ikx x}
          s0r += ar; s0i += ai;
          s1r += -kxx * ai; s1i += kxx * ar;                                                     // ×(i kx)
          s2r += -kxx * kxx * ar; s2i += -kxx * kxx * ai;                                        // ×(i kx)²
        }
        const b = ((l * N + j) * 3) * 2; A[b] = s0r; A[b + 1] = s0i; A[b + 2] = s1r; A[b + 3] = s1i; A[b + 4] = s2r; A[b + 5] = s2i;
      }
      B.fill(0);
      for (let l = 0; l < N; l++) {
        for (let j = 0; j < N; j++) {
          const ky = kw[j], ph = ky * x[1], cy = Math.cos(ph), sy = Math.sin(ph), base = ((l * N + j) * 3) * 2;
          for (let a = 0; a < 3; a++) {
            const ar0 = A[base + 2 * a], ai0 = A[base + 2 * a + 1];
            const er = ar0 * cy - ai0 * sy, ei = ar0 * sy + ai0 * cy;
            for (let bb = 0; bb + a < 3; bb++) {
              const f = bb === 0 ? 1 : bb === 1 ? ky : -ky * ky, rot = bb === 1;   // (i ky)^bb
              const rr = rot ? -f * ei : f * er, ri = rot ? f * er : f * ei;
              const o = ((l * 3 + a) * 3 + bb) * 2; B[o] += rr; B[o + 1] += ri;
            }
          }
        }
      }
      const T = new Float64Array(27);
      for (let l = 0; l < N; l++) {
        const kz = kw[l], ph = kz * x[2], cz = Math.cos(ph), sz = Math.sin(ph);
        for (let a = 0; a < 3; a++) for (let bb = 0; bb + a < 3; bb++) {
          const o = ((l * 3 + a) * 3 + bb) * 2, br0 = B[o], bi0 = B[o + 1];
          const er = br0 * cz - bi0 * sz, ei = br0 * sz + bi0 * cz;
          for (let cc = 0; cc + a + bb < 3; cc++) {
            const f = cc === 0 ? 1 : cc === 1 ? kz : -kz * kz, rot = cc === 1;
            T[(a * 3 + bb) * 3 + cc] += rot ? -f * ei : f * er;   // real part only
          }
        }
      }
      return T;
    }
    const fgh = (x) => {
      let f = 0; const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let c = 0; c < 3; c++) {
        const T = tensors(x, c), w = T[0], gw = [T[(1 * 3 + 0) * 3 + 0], T[(0 * 3 + 1) * 3 + 0], T[(0 * 3 + 0) * 3 + 1]];
        const Hw = [[T[(2 * 3 + 0) * 3 + 0], T[(1 * 3 + 1) * 3 + 0], T[(1 * 3 + 0) * 3 + 1]],
                    [T[(1 * 3 + 1) * 3 + 0], T[(0 * 3 + 2) * 3 + 0], T[(0 * 3 + 1) * 3 + 1]],
                    [T[(1 * 3 + 0) * 3 + 1], T[(0 * 3 + 1) * 3 + 1], T[(0 * 3 + 0) * 3 + 2]]];
        f += w * w;
        for (let p = 0; p < 3; p++) { g[p] += 2 * w * gw[p]; for (let q = 0; q < 3; q++) H[p][q] += 2 * (gw[p] * gw[q] + w * Hw[p][q]); }
      }
      return { f, g, H };
    };
    const solve3 = (M, r) => {   // Cramer
      const d = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      if (Math.abs(d) < 1e-300) return null;
      const col = (i) => { const A2 = M.map(row => row.slice()); for (let q = 0; q < 3; q++) A2[q][i] = r[q]; return A2; };
      const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
    };
    let best = null;
    starts.sort((a, b) => b[0] - a[0]);
    for (const [v0, i0, j0, l0] of starts) {
      // the continuous maximum exceeds its nearest node value by a few per cent at most, so a start well below the best
      // found so far cannot win: prune it (this is what keeps the O(N³)-per-evaluation search affordable)
      if (best && Math.sqrt(v0) < 0.85 * Math.sqrt(best.f)) continue;
      let x = [i0 * h, j0 * h, l0 * h], cur = fgh(x);
      for (let it = 0; it < iters; it++) {
        let stp = solve3(cur.H, cur.g.map(v => -v));
        const gn = Math.hypot(cur.g[0], cur.g[1], cur.g[2]);
        if (!stp || stp[0] * cur.g[0] + stp[1] * cur.g[1] + stp[2] * cur.g[2] <= 0) stp = cur.g.map(v => v / Math.max(gn, 1e-300) * 0.25 * h);
        let n = Math.hypot(stp[0], stp[1], stp[2]); if (n > h) { stp = stp.map(v => v * h / n); n = h; }
        let trial = fgh([x[0] + stp[0], x[1] + stp[1], x[2] + stp[2]]);
        while (trial.f < cur.f && n > 1e-9 * h) { stp = stp.map(v => v * 0.5); n *= 0.5; trial = fgh([x[0] + stp[0], x[1] + stp[1], x[2] + stp[2]]); }
        if (trial.f < cur.f) break;
        x = [x[0] + stp[0], x[1] + stp[1], x[2] + stp[2]]; cur = trial;
        if (n < 1e-7 * h) break;
      }
      if (!best || cur.f > best.f) best = { f: cur.f, x, node: v0 };
    }
    const mod = v => ((v % TWO_PI) + TWO_PI) % TWO_PI;
    return { omMaxI: Math.sqrt(Math.max(best.f, 0)), omMaxIpos: best.x.map(mod), omMaxNode: Math.sqrt(Math.max(best.node, 0)) };
  }
  /** Periodic-image diagnostic (parity with GPU 0.1.1): enstrophy profile along z — circular centroid, extent of the
   *  band carrying > 1 % of the profile maximum, and the gap left to its own periodic image. */
  function imageDiag() {
    const [ox, oy, oz] = om, Ez = new Float64Array(N);
    for (let l = 0; l < N; l++) { let s = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const n = (l * N + j) * N + i; s += ox[n] * ox[n] + oy[n] * oy[n] + oz[n] * oz[n]; } Ez[l] = s; }
    let mx = 0, cs = 0, sn = 0; for (let l = 0; l < N; l++) { mx = Math.max(mx, Ez[l]); const z = l * TWO_PI / N; cs += Ez[l] * Math.cos(z); sn += Ez[l] * Math.sin(z); }
    const zc = ((Math.atan2(sn, cs) % TWO_PI) + TWO_PI) % TWO_PI;
    const on = Array.from(Ez, v => v > 0.01 * mx); const runs = []; let start = null;
    for (let l = 0; l < N; l++) { if (on[l] && start === null) start = l; if (!on[l] && start !== null) { runs.push([start, l]); start = null; } }
    if (start !== null) runs.push([start, N]);
    let rr = runs; if (runs.length > 1 && on[0] && on[N - 1]) rr = [[runs[runs.length - 1][0], runs[0][1] + N]].concat(runs.slice(1, -1));
    const ext = Math.min((rr.length ? Math.max(...rr.map(r => r[1] - r[0])) : N) * TWO_PI / N, TWO_PI);
    return { zCentroid: zc, zExtent: ext, imageGap: Math.max(TWO_PI - ext, 0), zBands: rr.length };
  }
  /** max E(k)/E(0.8·kc) over the top of the spectrum: > 1 means energy is piling up at the dealiasing cutoff. */
  /* Returns null — ungraded, not "healthy" — when E(0.8·kc) is at the arithmetic's own noise floor. E is quadratic
     in the field, so a relative field error of ~ε reaches the spectrum at ~ε²; SPEC_FLOOR is that floor with a
     margin of 100. This instrument is always float64, so the number is fixed here; the GPU runner derives the same
     quantity from its working precision because it also runs float32, where the old fixed 1e-20 guard sat six
     orders of magnitude BELOW the noise floor and graded roundoff as though it were spectrum. Kept identical in
     form so the two instruments state one rule. */
  const SPEC_FLOOR = 100 * Number.EPSILON * Number.EPSILON;                  // float64: 4.9e-30
  function cutoffPileUp(spec) {
    const k8 = Math.round(0.8 * kc); let peak = 0; for (let k = 1; k < spec.length; k++) peak = Math.max(peak, spec[k]);
    if (!(spec[k8] > SPEC_FLOOR * peak)) return null;
    let m = 0; for (let k = k8; k <= kc; k++) m = Math.max(m, spec[k] / spec[k8]);
    return m;
  }
  /** 2D slice (N×N, Float32) of a physical field after diagnose(). axis 'x'|'y'|'z', index 0..N−1. */
  function slice(kind, axis, index) {
    const out = new Float32Array(N * N), [u, v, w] = up, [ox, oy, oz] = om;
    const val = n => { switch (kind) {
      case 'vort': return Math.sqrt(ox[n] * ox[n] + oy[n] * oy[n] + oz[n] * oz[n]);
      case 'speed': return Math.sqrt(u[n] * u[n] + v[n] * v[n] + w[n] * w[n]);
      case 'ke': return 0.5 * (u[n] * u[n] + v[n] * v[n] + w[n] * w[n]);
      case 'q': return G2[n];
      case 'stretch': return PST[n];
      case 'u': return u[n]; case 'v': return v[n]; case 'w': return w[n];
      case 'omx': return ox[n]; case 'omy': return oy[n]; case 'omz': return oz[n];
      default: return 0; } };
    const ix = Math.max(0, Math.min(N - 1, index | 0));
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      const n = axis === 'z' ? (ix * N + b) * N + a : axis === 'y' ? (b * N + ix) * N + a : (b * N + a) * N + ix;
      out[b * N + a] = val(n);
    }
    return out;
  }
  /** Exact solutions for the benchmark initial conditions (L∞ error of the current state). */
  function exactError() {
    const kind = st.ic, prm = st.icParams, h = TWO_PI / N, [u, v, w] = up;
    for (let c = 0; c < 3; c++) sp.inverse(S[2 * c], S[2 * c + 1], up[c]);
    let err = 0, ref = 0;
    if (kind === 'tgv2d') { const f = Math.exp(-2 * nu * st.t); for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const n = (l * N + j) * N + i, x = i * h, y = j * h; const ue = Math.sin(x) * Math.cos(y) * f, ve = -Math.cos(x) * Math.sin(y) * f; err = Math.max(err, Math.abs(u[n] - ue), Math.abs(v[n] - ve), Math.abs(w[n])); ref = Math.max(ref, Math.abs(ue)); } }
    else if (kind === 'abc') { const A = prm.A != null ? prm.A : 1, B = prm.B != null ? prm.B : 1, C = prm.C != null ? prm.C : 1, f = Math.exp(-nu * st.t); for (let l = 0; l < N; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const n = (l * N + j) * N + i, x = i * h, y = j * h, z = l * h; const ue = (A * Math.sin(z) + C * Math.cos(y)) * f, ve = (B * Math.sin(x) + A * Math.cos(z)) * f, we = (C * Math.sin(y) + B * Math.cos(x)) * f; err = Math.max(err, Math.abs(u[n] - ue), Math.abs(v[n] - ve), Math.abs(w[n] - we)); ref = Math.max(ref, Math.abs(ue), Math.abs(ve), Math.abs(we)); } }
    else return null;
    return { linf: err, rel: err / Math.max(ref, 1e-300) };
  }
  /** Health report: every number a run needs before any feature in it is believed. */
  function health(study) {
    const d = last, o = st.outputs.length ? st.outputs[st.outputs.length - 1] : null;
    const eta = Math.pow(nu * nu * nu / Math.max(d.eps, 1e-300), 0.25), kmax = Math.sqrt(3) * kc, ke = kmax * eta;
    const spec = o ? o.spectrum : spectrum(); let kp = 0; for (let k = 1; k < spec.length; k++) if (spec[k] > spec[kp]) kp = k;
    const tail = spec[kc] / Math.max(spec[kp], 1e-300), pile = cutoffPileUp(spec);
    const cflNow = d.uMax * st.dt / (TWO_PI / N);
    const grade = (v, good, warn, lowerIsBetter = true) => (lowerIsBetter ? (v <= good ? 'PASS' : v <= warn ? 'WARN' : 'FAIL') : (v >= good ? 'PASS' : v >= warn ? 'WARN' : 'FAIL'));
    const rows = [
      ['grid', `${N}³ (kmax ${kc}, dealiased 2/3)`, ''],
      ['Δt', st.dt.toExponential(3) + (dtFixed ? ' fixed' : ' adaptive'), ''],
      ['CFL (u_max Δt/Δx)', cflNow.toFixed(3), grade(cflNow, 0.8, 1.2)],
      ['divergence L∞', st.divMax.toExponential(2), grade(st.divMax, 1e-10, 1e-6)],
      ['nonlinear energy transfer |T|/ε', st.maxTnl.toExponential(2), grade(st.maxTnl, 1e-9, 1e-6)],
      ['energy budget residual (RK4-consistent)', st.maxEbal.toExponential(2), grade(st.maxEbal, 1e-5, 1e-3)],
      ['enstrophy budget residual', st.maxZbal.toExponential(2), grade(st.maxZbal, 1e-4, 1e-2)],
      ['resolution kmax·η', ke.toFixed(2), grade(ke, 1.0, 0.5, false)],
      ['spectral tail E(kmax)/E(peak)', tail.toExponential(2), grade(tail, 1e-4, 1e-2)],
      ['stretching: spectral vs physical', o ? (Math.abs(o.Pspec - o.Pphys) / Math.max(Math.abs(o.Pspec), 2 * nu * o.P, 1e-300)).toExponential(2) : '—', o ? grade(Math.abs(o.Pspec - o.Pphys) / Math.max(Math.abs(o.Pspec), 2 * nu * o.P, 1e-300), 1e-2, 1e-1) : ''],
      ['cutoff pile-up E(k)/E(0.8kmax)', pile != null ? pile.toFixed(2) : '—', pile != null ? grade(pile, 1.2, 2.0) : ''],   // > 1: energy accumulating at the dealiasing edge (the truncation bottleneck), even when the tail check passes
      ['max |ω|', d.omMax.toFixed(4) + (o && o.omMaxI != null ? ` (interpolated ${o.omMaxI.toFixed(4)})` : ''), ''], ['enstrophy Z', d.Z.toFixed(5), ''], ['stretching ⟨ω·S·ω⟩', d.Pspec.toFixed(5), ''], ['dissipation ε = 2νZ', d.eps.toExponential(4), ''],
      ['‖u‖_L³ (ESS criterion)', o && o.uL3 != null ? o.uL3.toFixed(5) : '—', ''],
      ['periodic-image gap in z', o && o.imageGap != null ? o.imageGap.toFixed(2) : '—', ''],
      ['grid convergence', study && study.grid ? study.grid.text : 'not run', study && study.grid ? study.grid.verdict : 'N/A'],
      ['time-step convergence', study && study.time ? study.time.text : 'not run', study && study.time ? study.time.verdict : 'N/A'],
    ];
    const worstEnd = rows.some(r => r[2] === 'FAIL') ? 'FAIL' : rows.some(r => r[2] === 'WARN') ? 'WARN' : 'PASS';
    // worst archived instant: the event itself can be the least healthy part of a run whose last snapshot passes
    const snaps = st.outputs;
    if (snaps.length) {
      const tailOf = q => { let kq = 0; for (let k = 1; k < q.spectrum.length; k++) if (q.spectrum[k] > q.spectrum[kq]) kq = k; return q.spectrum[kc] / Math.max(q.spectrum[kq], 1e-300); };
      const sdOf = q => Math.abs(q.Pspec - q.Pphys) / Math.max(Math.abs(q.Pspec), 2 * nu * q.P, 1e-300);
      const wKe = snaps.reduce((a, b) => b.kmaxEta < a.kmaxEta ? b : a), wT = snaps.reduce((a, b) => tailOf(b) > tailOf(a) ? b : a), wS = snaps.reduce((a, b) => sdOf(b) > sdOf(a) ? b : a);
      const wP = snaps.filter(q => q.pileUp != null).reduce((a, b) => (a == null || b.pileUp > a.pileUp) ? b : a, null);
      rows.push(['worst instant: kmax·η', `${wKe.kmaxEta.toFixed(2)} at t ${wKe.t.toFixed(2)}`, grade(wKe.kmaxEta, 1.0, 0.5, false)]);
      rows.push(['worst instant: spectral tail', `${tailOf(wT).toExponential(2)} at t ${wT.t.toFixed(2)}`, grade(tailOf(wT), 1e-4, 1e-2)]);
      rows.push(['worst instant: stretching spectral vs physical', `${sdOf(wS).toExponential(2)} at t ${wS.t.toFixed(2)}`, grade(sdOf(wS), 1e-2, 1e-1)]);
      if (wP) rows.push(['worst instant: cutoff pile-up', `${wP.pileUp.toFixed(2)} at t ${wP.t.toFixed(2)}`, grade(wP.pileUp, 1.2, 2.0)]);
    }
    const worst = rows.some(r => r[2] === 'FAIL') ? 'FAIL' : rows.some(r => r[2] === 'WARN') ? 'WARN' : 'PASS';
    return { rows, worst, worstEnd, note: 'A run that does not PASS resolution, budgets and refinement cannot support any claim about the equations. Numerical growth ≠ mathematical singularity. The verdict includes the worst archived snapshot; worstEnd is the end-of-run verdict alone.' };
  }
  /** Evidence dossier: everything needed to reproduce and audit the run. */
  function dossier(extra) {
    return Object.assign({
      instrument: 'Pocket Wind Tunnel · NSLab ' + VERSION, build: (typeof self !== 'undefined' && self.PWT_BUILD) || (typeof window !== 'undefined' && window.PWT_BUILD) || null,
      equations: '3D incompressible Navier–Stokes, periodic [0,2π]³, Re = 1/ν, Fourier pseudo-spectral (2/3 dealiased, rotational form), RK4',
      parameters: { N, Re, nu, cfl, dt: dtFixed || 'adaptive', ic: st.ic, icParams: st.icParams, kc },
      state: { t: st.t, steps: st.step }, series: st.series, outputs: st.outputs, health: health(extra && extra.study),
      disclaimer: 'Numerical evidence only. Nothing here is a proof of global regularity or of finite-time blow-up of the Navier–Stokes equations; every feature must survive spatial and temporal refinement before it is even a conjecture.',
    }, extra || {});
  }

  setIC(st.ic, st.icParams);
  return { st, get last() { return last; }, step, run, diagnose, spectrum, slice, exactError, health, dossier, setIC, norms: () => norms(S), interpMax, imageDiag, fields, N, nu, Re, kc, _S: S, _sp: sp };
}

/** Refinement study: run the same case on a ladder of grids (or Δt values); returns per-level series and verdicts. */
function studySummary(levels, key) {
  // levels: [{ label, N, dt, peak: {omMax, t}, epsPeak: {v, t}, Eend }]
  if (levels.length < 2) return null;
  const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
  const rows = []; let lastChange = null, prevChange = null;
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1], b = levels[i];
    const c = { from: a.label, to: b.label, omMax: rel(a.peak.omMax, b.peak.omMax), eps: rel(a.epsPeak.v, b.epsPeak.v), Eend: rel(a.Eend, b.Eend), tPeak: Math.abs(a.epsPeak.t - b.epsPeak.t) };
    rows.push(c); prevChange = lastChange; lastChange = Math.max(c.omMax, c.eps, c.Eend);
  }
  const order = prevChange != null && lastChange > 0 ? Math.log(prevChange / lastChange) / Math.log(key === 'time' ? 2 : levels[levels.length - 1].N / levels[levels.length - 2].N) : null;
  const verdict = lastChange < 0.01 && (prevChange == null || lastChange < prevChange) ? 'PASS' : lastChange < 0.05 ? 'WARN' : 'FAIL';
  const text = `${levels.map(l => l.label).join(' → ')}: last change ω_max ${(rows[rows.length - 1].omMax * 100).toFixed(2)} %, ε_peak ${(rows[rows.length - 1].eps * 100).toFixed(2)} %, E(t_end) ${(rows[rows.length - 1].Eend * 100).toFixed(3)} %` + (order != null ? `, observed order ${order.toFixed(2)}` : '');
  return { rows, verdict, text, order };
}

return { VERSION, IC_INFO, createSolver, studySummary, Spectral, fftPlan, fft1, factorize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NS;
