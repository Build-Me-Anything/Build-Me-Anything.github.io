/*
 * Pocket Wind Tunnel — physics core
 * --------------------------------------------------------------
 * Zero-dependency 2D aerofoil analysis in plain JavaScript.
 *
 *   • NACA 4-digit geometry generator + arbitrary coordinate import (Selig / Lednicer)
 *   • Hess–Smith panel method (constant-strength sources + uniform vortex, Kutta condition)
 *   • Integral boundary layer: Thwaites (laminar) → Michel transition → Head (turbulent)
 *     with Squire–Young profile-drag closure
 *   • ISA atmosphere (to 20 km), Sutherland viscosity
 *   • Prandtl–Glauert compressibility correction and critical Mach estimate
 *
 * Everything is non-dimensional inside (chord = 1, V∞ = 1) and scaled at the edges.
 * Runs identically in the browser (global `WT`) and in Node (module.exports) so the
 * validation suite in test/ exercises exactly the code the page uses.
 */
const WT = (() => {
  'use strict';
  const PI = Math.PI, TWO_PI = 2 * Math.PI;

  // ============================================================
  // 1. GEOMETRY
  // ============================================================

  /** NACA 4-digit section. m = max camber, p = camber position, t = thickness (all chord fractions).
   *  Returns n+1 nodes ordered TE → lower surface → LE → upper surface → TE (clockwise). */
  function naca4(m, p, t, n) {
    const half = Math.max(8, Math.floor(n / 2));
    const X = [], Yc = [], Yt = [], Th = [];
    for (let i = 0; i <= half; i++) {
      const b = PI * i / half;
      const x = 0.5 * (1 - Math.cos(b));                       // cosine spacing: dense at LE/TE
      const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4); // closed TE
      let yc = 0, dyc = 0;
      if (m > 0 && p > 0 && p < 1) {
        if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dyc = 2 * m / (p * p) * (p - x); }
        else { yc = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x); dyc = 2 * m / ((1 - p) ** 2) * (p - x); }
      }
      X.push(x); Yc.push(yc); Yt.push(yt); Th.push(Math.atan(dyc));
    }
    const xs = [], ys = [];
    for (let i = half; i >= 0; i--) { xs.push(X[i] + Yt[i] * Math.sin(Th[i])); ys.push(Yc[i] - Yt[i] * Math.cos(Th[i])); }
    for (let i = 1; i <= half; i++) { xs.push(X[i] - Yt[i] * Math.sin(Th[i])); ys.push(Yc[i] + Yt[i] * Math.cos(Th[i])); }
    xs[0] = 1; ys[0] = 0; xs[xs.length - 1] = 1; ys[ys.length - 1] = 0;
    return { x: xs, y: ys, name: nacaName(m, p, t), t, iLE: half };
  }

  function nacaName(m, p, t) {
    const M = Math.round(m * 100), P = M === 0 ? 0 : Math.round(p * 10), T = Math.round(t * 100);
    return 'NACA ' + M + P + String(T).padStart(2, '0');
  }

  /** Parse an aerofoil coordinate file (UIUC Selig or Lednicer format). Returns {name, pts:[[x,y],...]}
   *  in clockwise order (TE → lower → LE → upper → TE) normalised to unit chord. */
  function parseCoordinates(text) {
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length);
    if (!lines.length) throw new Error('Empty coordinate file');
    let name = 'Imported';
    const nums = [];
    for (const ln of lines) {
      const m = ln.match(/^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)[\s,]+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)$/);
      if (m) nums.push([parseFloat(m[1]), parseFloat(m[2])]);
      else if (nums.length === 0) name = ln;
    }
    if (nums.length < 6) throw new Error('Could not find enough coordinate pairs');
    let pts;
    if (nums[0][0] > 1.5 && nums[0][1] > 1.5) {
      // Lednicer: first line = point counts, then upper LE→TE, then lower LE→TE
      const nu = Math.round(nums[0][0]), nl = Math.round(nums[0][1]);
      const up = nums.slice(1, 1 + nu), lo = nums.slice(1 + nu, 1 + nu + nl);
      if (up.length !== nu || lo.length !== nl) throw new Error('Lednicer point counts do not match data');
      pts = lo.slice().reverse().concat(up.slice(1));   // TE→lower→LE→upper→TE
    } else {
      // Selig: TE → upper → LE → lower → TE (anticlockwise). Reverse to clockwise.
      pts = nums.slice().reverse();
    }
    // normalise chord & position: LE at x=0, TE at x=1
    let xmin = Infinity, xmax = -Infinity;
    for (const [x] of pts) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
    const c = xmax - xmin;
    if (!(c > 0)) throw new Error('Degenerate chord');
    pts = pts.map(([x, y]) => [(x - xmin) / c, y / c]);
    // orientation check: signed area should be negative for clockwise
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    if (area > 0) pts.reverse();
    return { name, pts };
  }

  /** Resample an arbitrary closed aerofoil (clockwise point list) onto n cosine-spaced panels. */
  function repanel(pts, n) {
    const half = Math.max(8, Math.floor(n / 2));
    // locate LE = point farthest from TE midpoint
    const tex = 0.5 * (pts[0][0] + pts[pts.length - 1][0]), tey = 0.5 * (pts[0][1] + pts[pts.length - 1][1]);
    let iLE = 0, dmax = -1;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - tex) ** 2 + (pts[i][1] - tey) ** 2;
      if (d > dmax) { dmax = d; iLE = i; }
    }
    const lower = pts.slice(0, iLE + 1);          // TE → LE
    const upper = pts.slice(iLE);                 // LE → TE
    const sampleSurface = (poly, fromLE) => {
      // parametrise by arc length, then place nodes at cosine-spaced x via interpolation in x along arc
      const s = [0];
      for (let i = 1; i < poly.length; i++) s.push(s[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
      const L = s[s.length - 1];
      const out = [];
      for (let k = 0; k <= half; k++) {
        const b = PI * k / half;
        const xt = 0.5 * (1 - Math.cos(b));       // target x (0 at LE, 1 at TE)
        // find arc position where x ≈ xt (surfaces are monotone in x for sane sections)
        let best = 0;
        const seq = fromLE ? poly : poly.slice().reverse();
        const sseq = fromLE ? s : s.map(v => L - v).reverse();
        for (let i = 0; i < seq.length - 1; i++) {
          const x0 = seq[i][0], x1 = seq[i + 1][0];
          if ((xt >= Math.min(x0, x1) && xt <= Math.max(x0, x1))) {
            const f = Math.abs(x1 - x0) < 1e-12 ? 0 : (xt - x0) / (x1 - x0);
            out.push([x0 + f * (x1 - x0), seq[i][1] + f * (seq[i + 1][1] - seq[i][1])]);
            best = 1; break;
          }
        }
        if (!best) out.push(xt <= 0.5 ? seq[0].slice() : seq[seq.length - 1].slice());
      }
      return out; // LE → TE
    };
    const up = sampleSurface(upper, true);
    const lo = sampleSurface(lower, true);
    const xs = [], ys = [];
    for (let i = half; i >= 0; i--) { xs.push(lo[i][0]); ys.push(lo[i][1]); }
    for (let i = 1; i <= half; i++) { xs.push(up[i][0]); ys.push(up[i][1]); }
    // close TE to the mean TE point
    xs[0] = xs[xs.length - 1] = 0.5 * (xs[0] + xs[xs.length - 1]);
    ys[0] = ys[ys.length - 1] = 0.5 * (ys[0] + ys[ys.length - 1]);
    xs[half] = 0; // LE exactly at origin
    return { x: xs, y: ys, iLE: half };
  }

  function geometryStats(geo) {
    const n = geo.x.length - 1;
    let iLE = geo.iLE != null ? geo.iLE : 0;
    if (geo.iLE == null) for (let i = 0; i <= n; i++) if (geo.x[i] < geo.x[iLE]) iLE = i;
    const interp = (xs, ys, x) => { for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; if (a !== b && (x - a) * (x - b) <= 0) return ys[i] + (x - a) / (b - a) * (ys[i + 1] - ys[i]); } return NaN; };
    const ux = geo.x.slice(iLE), uy = geo.y.slice(iLE), lx = geo.x.slice(0, iLE + 1), ly = geo.y.slice(0, iLE + 1);
    let tmax = 0, xt = 0, cmax = 0, xc = 0;
    for (let k = 1; k < 100; k++) {
      const x = k / 100, yu = interp(ux, uy, x), yl = interp(lx, ly, x);
      if (!Number.isFinite(yu) || !Number.isFinite(yl)) continue;
      const th = yu - yl, cm = 0.5 * (yu + yl);
      if (th > tmax) { tmax = th; xt = x; }
      if (Math.abs(cm) > Math.abs(cmax)) { cmax = cm; xc = x; }
    }
    return { thickness: tmax, xThickness: xt, camber: cmax, xCamber: xc };
  }

  // ============================================================
  // 1b. WIND-TUNNEL WALLS — method of images with closed-form row kernels
  // ============================================================
  // Walls at y = yc ± h/2. A singularity at (x0,y0) reflects into two infinite vertical rows of period 2h:
  //   row A at y0 + 2nh and row B at 2yc − y0 + (2n+1)h.  Closed walls: sources keep their sign, vortices flip in
  //   row B.  Open jet (constant-pressure boundary): sources flip, vortices keep their sign.
  // The complex velocity of a vertical row with spacing a is W = (iq/(2a) + Γ/(2a))·cot(iπ(z − z0)/a).
  const GAUSS = { 1: [[0.5, 1]], 3: [[0.5 - 0.5 * Math.sqrt(0.6), 5 / 18], [0.5, 8 / 18], [0.5 + 0.5 * Math.sqrt(0.6), 5 / 18]] };
  function rowVelocity(px, py, x0, y0, h, q, G, out) {
    const p = -PI * (py - y0) / (2 * h), sArg = PI * (px - x0) / (2 * h);
    const den = Math.cosh(2 * sArg) - Math.cos(2 * p);
    if (den < 1e-14) { out[0] = 0; out[1] = 0; return; }
    const cr = Math.sin(2 * p) / den, ci = -Math.sinh(2 * sArg) / den;    // cot(p + i s)
    const ar = G / (4 * h), ai = q / (4 * h);                              // (Γ + i q)/(4h)
    out[0] = ar * cr - ai * ci; out[1] = -(ar * ci + ai * cr);             // u = Re W, v = −Im W
  }
  /** Image-only velocity (rows minus the free-air point term, which the analytic panel already carries).
   *  q = source strength, G = anticlockwise vortex strength (both total, not per unit length). */
  function imageVelocity(px, py, x0, y0, walls, q, G, out) {
    const t = imageVelocity.tmp || (imageVelocity.tmp = [0, 0]);
    rowVelocity(px, py, x0, y0, walls.h, q, G, t); let u = t[0], v = t[1];
    rowVelocity(px, py, x0, 2 * walls.yc - y0 + walls.h, walls.h, walls.open ? -q : q, walls.open ? G : -G, t); u += t[0]; v += t[1];
    const dx = px - x0, dy = py - y0, r2 = dx * dx + dy * dy;
    if (r2 > 1e-24) { u -= (q * dx - G * dy) / (TWO_PI * r2); v -= (q * dy + G * dx) / (TWO_PI * r2); }
    out[0] = u; out[1] = v;
  }
  /** Image contribution of panel j (unit source / unit clockwise vortex per unit length) at (px,py). Writes [us,vs,uv,vv]. */
  function panelImage(P, j, px, py, walls, out) {
    const gp = GAUSS[walls.G || 3], l = P.len[j], t = panelImage.tmp || (panelImage.tmp = [0, 0]);
    let us = 0, vs = 0, uv = 0, vv = 0;
    for (let g = 0; g < gp.length; g++) {
      const f = gp[g][0], w = gp[g][1] * l;
      const x0 = P.x[j] + f * (P.x[j + 1] - P.x[j]), y0 = P.y[j] + f * (P.y[j + 1] - P.y[j]);
      imageVelocity(px, py, x0, y0, walls, w, 0, t); us += t[0]; vs += t[1];
      imageVelocity(px, py, x0, y0, walls, 0, -w, t); uv += t[0]; vv += t[1];   // clockwise unit vortex = anticlockwise −1
    }
    out[0] = us; out[1] = vs; out[2] = uv; out[3] = vv;
  }
  /** Section nodes expressed in the tunnel frame: freestream along +x, chord pitched nose-up by alpha about c/4. */
  function rotateGeo(geo, alphaDeg) {
    const a = alphaDeg * PI / 180, ca = Math.cos(a), sa = Math.sin(a), xs = [], ys = [];
    for (let i = 0; i < geo.x.length; i++) { const dx = geo.x[i] - 0.25, dy = geo.y[i]; xs.push(0.25 + dx * ca + dy * sa); ys.push(-dx * sa + dy * ca); }
    return Object.assign({}, geo, { x: xs, y: ys });
  }
  /** Flow-aligned doublet strength of the free-air solution (m = Σ q ℓ x along the flow) → Allen–Vincenti shape factor Λ = 8m/(π c²). */
  function shapeFactor(sys, sol) {
    const P = sys.P, a = sol.alpha * PI / 180, ca = Math.cos(a), sa = Math.sin(a); let m = 0;
    for (let j = 0; j < sys.n; j++) m += sol.q[j] * P.len[j] * (P.xm[j] * ca + P.ym[j] * sa);
    return { moment: -m, Lambda: -8 * m / PI };   // sources are positive where the stream enters the body, hence the sign
  }
  /** Classical 2D closed-test-section corrections (Barlow, Rae & Pope; Allen & Vincenti). Inputs are the uncorrected values. */
  function tunnelCorrections(hc, ClU, CmU, CdU, alphaDeg, Lambda) {
    const sigma = PI * PI / 48 / (hc * hc), eSb = Lambda * sigma, eWb = CdU / (2 * hc), eps = eSb + eWb;
    const dAlpha = sigma / (2 * PI) * (ClU + 4 * CmU) * 180 / PI;
    return { sigma, Lambda, eSb, eWb, eps, dAlpha, alphaC: alphaDeg + dAlpha, ClC: ClU * (1 - sigma - 2 * eps), CmC: CmU * (1 - 2 * eps) + sigma * ClU / 4,
      CdC: CdU * (1 - 3 * eSb - 2 * eWb), Vratio: 1 + eps, qRatio: 1 + 2 * eps };
  }

  // ============================================================
  // 2. PANEL METHOD (Hess–Smith)
  // ============================================================

  function buildPanels(geo) {
    const n = geo.x.length - 1;
    const P = { n, x: Float64Array.from(geo.x), y: Float64Array.from(geo.y),
      xm: new Float64Array(n), ym: new Float64Array(n), len: new Float64Array(n),
      sin: new Float64Array(n), cos: new Float64Array(n), nx: new Float64Array(n), ny: new Float64Array(n),
      s: new Float64Array(n + 1) };
    for (let i = 0; i < n; i++) {
      const dx = geo.x[i + 1] - geo.x[i], dy = geo.y[i + 1] - geo.y[i];
      const l = Math.hypot(dx, dy);
      P.len[i] = l; P.cos[i] = dx / l; P.sin[i] = dy / l;
      P.nx[i] = -P.sin[i]; P.ny[i] = P.cos[i];                // outward normal for clockwise ordering
      P.xm[i] = 0.5 * (geo.x[i] + geo.x[i + 1]); P.ym[i] = 0.5 * (geo.y[i] + geo.y[i + 1]);
      P.s[i + 1] = P.s[i] + l;                                 // arc length at nodes
    }
    return P;
  }

  /** Velocity at (px,py) induced by unit source and unit (clockwise) vortex on panel j. Writes [us,vs,uv,vv]. */
  function influence(P, j, px, py, out) {
    const c = P.cos[j], s = P.sin[j], l = P.len[j];
    const dx = px - P.x[j], dy = py - P.y[j];
    const xl = dx * c + dy * s, yl = -dx * s + dy * c;
    const r1 = xl * xl + yl * yl, r2 = (xl - l) * (xl - l) + yl * yl;
    let lnr, beta;
    if (r1 < 1e-24 || r2 < 1e-24) { lnr = 0; beta = 0.5; }
    else {
      lnr = 0.5 * Math.log(r1 / r2) / TWO_PI;
      beta = (Math.abs(yl) < 1e-10 * l && xl > 0 && xl < l) ? 0.5 : (Math.atan2(yl, xl - l) - Math.atan2(yl, xl)) / TWO_PI;
    }
    // local → global. Source: (lnr, beta). Clockwise vortex: (beta, -lnr).
    out[0] = lnr * c - beta * s; out[1] = lnr * s + beta * c;
    out[2] = beta * c + lnr * s; out[3] = beta * s - lnr * c;
  }

  /** Assemble and LU-factorise the influence system for a geometry. Independent of angle of attack. */
  function buildSystem(geo, opts) {
    const walls = opts && opts.walls ? opts.walls : null;
    const P = buildPanels(geo), n = P.n, N = n + 1;
    const A = new Float64Array(N * N);
    const At = new Float64Array(n * n), Bt = new Float64Array(n);
    const tmp = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const nx = P.nx[i], ny = P.ny[i], tx = P.cos[i], ty = P.sin[i];
      let bn = 0, bt = 0;
      for (let j = 0; j < n; j++) {
        influence(P, j, P.xm[i], P.ym[i], tmp);
        if (walls) { const im = [0, 0, 0, 0]; panelImage(P, j, P.xm[i], P.ym[i], walls, im); for (let k = 0; k < 4; k++) tmp[k] += im[k]; }
        A[i * N + j] = tmp[0] * nx + tmp[1] * ny;           // source j → normal velocity at i
        At[i * n + j] = tmp[0] * tx + tmp[1] * ty;           // source j → tangential velocity at i
        bn += tmp[2] * nx + tmp[3] * ny;                     // vortex → normal
        bt += tmp[2] * tx + tmp[3] * ty;                     // vortex → tangential
      }
      A[i * N + n] = bn; Bt[i] = bt;
    }
    // Kutta condition: tangential velocities on first and last panel sum to zero
    for (let j = 0; j < n; j++) A[n * N + j] = At[0 * n + j] + At[(n - 1) * n + j];
    A[n * N + n] = Bt[0] + Bt[n - 1];
    const piv = luDecompose(A, N);
    return { P, n, N, A, piv, At, Bt, geo, walls };
  }

  function luDecompose(A, n) {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let pmax = Math.abs(A[k * n + k]), pr = k;
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > pmax) { pmax = v; pr = i; } }
      piv[k] = pr;
      if (pr !== k) for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[pr * n + j]; A[pr * n + j] = t; }
      const akk = A[k * n + k];
      if (Math.abs(akk) < 1e-300) throw new Error('Singular influence matrix — check geometry (self-intersecting or zero-thickness?)');
      for (let i = k + 1; i < n; i++) {
        const f = A[i * n + k] / akk; A[i * n + k] = f;
        if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
    return piv;
  }

  function luSolve(A, piv, n, b) {
    const x = Float64Array.from(b);
    for (let k = 0; k < n; k++) { const pr = piv[k]; if (pr !== k) { const t = x[k]; x[k] = x[pr]; x[pr] = t; } }
    for (let i = 0; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= A[i * n + j] * x[j]; x[i] = s; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j]; x[i] = s / A[i * n + i]; }
    return x;
  }

  /** Solve the inviscid flow at angle of attack alphaDeg. Returns Cp distribution and integrated coefficients. */
  function solveInviscid(sys, alphaDeg) {
    const { P, n, N, A, piv, At, Bt } = sys;
    const a = alphaDeg * PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const b = new Float64Array(N);
    for (let i = 0; i < n; i++) b[i] = -(ca * P.nx[i] + sa * P.ny[i]);
    b[n] = -((ca * P.cos[0] + sa * P.sin[0]) + (ca * P.cos[n - 1] + sa * P.sin[n - 1]));
    const x = luSolve(A, piv, N, b);
    const q = x.subarray(0, n), gamma = x[n];
    const Vt = new Float64Array(n), Cp = new Float64Array(n);
    let cfx = 0, cfy = 0, cm = 0, cpmin = Infinity, icpmin = 0;
    for (let i = 0; i < n; i++) {
      let vt = ca * P.cos[i] + sa * P.sin[i] + gamma * Bt[i];
      for (let j = 0; j < n; j++) vt += q[j] * At[i * n + j];
      Vt[i] = vt; Cp[i] = 1 - vt * vt;
      if (Cp[i] < cpmin) { cpmin = Cp[i]; icpmin = i; }
      const f = -Cp[i] * P.len[i];
      cfx += f * P.nx[i]; cfy += f * P.ny[i];
      cm += f * ((P.xm[i] - 0.25) * P.ny[i] - P.ym[i] * P.nx[i]);
    }
    const Cl = cfy * ca - cfx * sa, CdInv = cfx * ca + cfy * sa;
    let perim = 0; for (let i = 0; i < n; i++) perim += P.len[i];
    // cm is anticlockwise-positive about (c/4, 0); aero convention is nose-up positive, which is clockwise here
    return { alpha: alphaDeg, q, gamma, Vt, Cp, Cl, CdInv, Cm: -cm, ClGamma: 2 * gamma * perim, CpMin: cpmin, xCpMin: P.xm[icpmin] };
  }

  /** Velocity (u,v) at a field point for a solved case. */
  function velocityAt(sys, sol, px, py) {
    const { P, n } = sys; const tmp = [0, 0, 0, 0];
    const a = sol.alpha * PI / 180;
    let u = Math.cos(a), v = Math.sin(a);
    for (let j = 0; j < n; j++) {
      influence(P, j, px, py, tmp);
      if (sys.walls) { const im = [0, 0, 0, 0]; panelImage(P, j, px, py, sys.walls, im); for (let k = 0; k < 4; k++) tmp[k] += im[k]; }
      u += sol.q[j] * tmp[0] + sol.gamma * tmp[2];
      v += sol.q[j] * tmp[1] + sol.gamma * tmp[3];
    }
    return [u, v];
  }

  /** Point-in-polygon (ray casting) against the aerofoil contour. */
  function insideBody(geo, px, py) {
    const X = geo.x, Y = geo.y; let inside = false;
    for (let i = 0, j = X.length - 1; i < X.length; j = i++) {
      if (((Y[i] > py) !== (Y[j] > py)) && (px < (X[j] - X[i]) * (py - Y[i]) / (Y[j] - Y[i]) + X[i])) inside = !inside;
    }
    return inside;
  }

  /** Velocity field on a screen-aligned grid. m = {id, gx, gy, q, gamma, alpha, rows, cols, x0, y0, d}
   *  Grid is in the "display" frame (freestream horizontal, aerofoil pitched by alpha about c/4);
   *  point (r,c) sits at world (x0 + c*d, y0 - r*d). Returns u,v in the display frame and an inside-body mask. */
  function fieldGrid(m) {
    const geo = { x: m.gx, y: m.gy }, P = buildPanels(geo), n = P.n;
    const q = m.q, gamma = m.gamma, a = m.alpha * PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const rows = m.rows, cols = m.cols;
    const u = new Float32Array(rows * cols), v = new Float32Array(rows * cols), inside = new Uint8Array(rows * cols);
    const tmp = [0, 0, 0, 0];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = m.x0 + c * m.d, wy = m.y0 - r * m.d;
        const dx = wx - 0.25, dy = wy;
        const px = 0.25 + dx * ca - dy * sa, py = dx * sa + dy * ca;   // display → solver frame
        const k = r * cols + c;
        if (m.walls && Math.abs(py - m.walls.yc) > m.walls.h / 2) { inside[k] = 1; continue; }
        if (px > -0.02 && px < 1.02 && Math.abs(py) < 0.35 && insideBody(geo, px, py)) { inside[k] = 1; continue; }
        let uu = ca, vv = sa;
        for (let j = 0; j < n; j++) { influence(P, j, px, py, tmp); uu += q[j] * tmp[0] + gamma * tmp[2]; vv += q[j] * tmp[1] + gamma * tmp[3]; }
        if (m.walls) { const w1 = Object.assign({}, m.walls, { G: 1 }); for (let j = 0; j < n; j++) { panelImage(P, j, px, py, w1, tmp); uu += q[j] * tmp[0] + gamma * tmp[2]; vv += q[j] * tmp[1] + gamma * tmp[3]; } }
        u[k] = uu * ca + vv * sa; v[k] = -uu * sa + vv * ca;           // rotate velocity into display frame
      }
    }
    return { id: m.id, u, v, inside, rows, cols, x0: m.x0, y0: m.y0, d: m.d };
  }

  // ============================================================
  // 3. BOUNDARY LAYER (Thwaites → Michel → Head, Squire–Young)
  // ============================================================

  function thwaitesClosure(lam) {
    lam = Math.max(-0.1, Math.min(0.1, lam));
    if (lam >= 0) return { H: 2.61 - 3.75 * lam + 5.24 * lam * lam, l: 0.22 + 1.57 * lam - 1.8 * lam * lam };
    return { H: 2.088 + 0.0731 / (lam + 0.14), l: 0.22 + 1.402 * lam + 0.018 * lam / (lam + 0.107) };
  }
  function headH1(H) { return H <= 1.6 ? 3.3 + 0.8234 * Math.pow(H - 1.1, -1.287) : 3.3 + 1.5501 * Math.pow(H - 0.6778, -3.064); }
  function headH(H1) {
    if (H1 <= 3.32) return 3.0;
    return H1 >= 5.3 ? 1.1 + Math.pow((H1 - 3.3) / 0.8234, -1 / 1.287) : 0.6778 + Math.pow((H1 - 3.3) / 1.5501, -1 / 3.064);
  }
  function ludwiegTillmann(H, ReTheta) { return 0.246 * Math.pow(10, -0.678 * H) * Math.pow(Math.max(ReTheta, 1), -0.268); }

  /** March the boundary layer along one surface.
   *  s[] arc length from stagnation, Ue[] edge velocity (>0), x[] chordwise station. nu = 1/Re. */
  function marchSurface(s, Ue, x, nu, opts) {
    const K = s.length;
    const forcedXtr = opts && opts.forcedXtr != null ? opts.forcedXtr : null;
    const theta = new Float64Array(K), H = new Float64Array(K), Cf = new Float64Array(K);
    const state = { transition: null, separation: null, laminarSep: null, regime: [] };
    // dUe/ds by finite differences
    const dUe = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(K - 1, k + 1);
      dUe[k] = (Ue[k1] - Ue[k0]) / Math.max(s[k1] - s[k0], 1e-12);
    }
    let turbulent = false, separated = false;
    let integ = 0; // ∫ Ue^5 ds
    let H1 = 0;
    for (let k = 0; k < K; k++) {
      if (k === 0) { // stagnation point
        theta[0] = Math.sqrt(0.075 * nu / Math.max(dUe[0], 1e-9)); H[0] = 2.24; Cf[0] = 0; state.regime.push('L'); continue;
      }
      const ds = s[k] - s[k - 1];
      if (!turbulent) {
        integ += 0.5 * (Math.pow(Ue[k], 5) + Math.pow(Ue[k - 1], 5)) * ds;
        const th2 = 0.45 * nu * integ / Math.pow(Math.max(Ue[k], 1e-9), 6);
        theta[k] = Math.sqrt(th2);
        const lam = th2 / nu * dUe[k];
        const cl = thwaitesClosure(lam);
        H[k] = cl.H;
        const ReTh = Ue[k] * theta[k] / nu, ReS = Ue[k] * s[k] / nu;
        Cf[k] = 2 * cl.l / Math.max(ReTh, 1e-9);
        let trip = false, why = '';
        if (forcedXtr != null && x[k] >= forcedXtr) { trip = true; why = 'forced'; }
        else if (lam < -0.09) { trip = true; why = 'laminar separation'; state.laminarSep = { x: x[k], k }; }
        else if (ReTh > 1.174 * (1 + 22400 / Math.max(ReS, 1)) * Math.pow(Math.max(ReS, 1), 0.46)) { trip = true; why = 'natural'; }
        if (trip) {
          turbulent = true; state.transition = { x: x[k], s: s[k], k, why };
          H[k] = 1.4; H1 = headH1(H[k]); Cf[k] = ludwiegTillmann(H[k], ReTh);
          state.regime.push('T');
        } else state.regime.push('L');
      } else {
        // Head's method, RK2 (midpoint) in s, with Ue and dUe linear over the step
        const f = (th, h1, ue, due, sep) => {
          const h = headH(h1);
          const ReTh = ue * th / nu;
          const cf = sep ? 0 : ludwiegTillmann(h, ReTh);
          const dth = cf / 2 - (h + 2) * th / ue * due;
          const dH1 = 0.0306 * Math.pow(Math.max(h1 - 3, 1e-3), -0.6169) / th - h1 * (dth / th + due / ue);
          return [dth, dH1];
        };
        const th0 = theta[k - 1], h10 = H1;
        const ueM = 0.5 * (Ue[k] + Ue[k - 1]), dueM = 0.5 * (dUe[k] + dUe[k - 1]);
        const k1v = f(th0, h10, Ue[k - 1], dUe[k - 1], separated);
        const thM = Math.max(th0 + 0.5 * ds * k1v[0], 1e-12), h1M = Math.max(h10 + 0.5 * ds * k1v[1], 3.05);
        const k2v = f(thM, h1M, ueM, dueM, separated);
        theta[k] = Math.max(th0 + ds * k2v[0], 1e-12);
        H1 = separated ? h10 : Math.max(h10 + ds * k2v[1], 3.05);
        H[k] = headH(H1);
        Cf[k] = separated ? 0 : ludwiegTillmann(H[k], Ue[k] * theta[k] / nu);
        if (!separated && H[k] > 2.4) { separated = true; state.separation = { x: x[k], s: s[k], k }; }
        state.regime.push(separated ? 'S' : 'T');
      }
    }
    const kE = K - 1;
    const Hte = Math.min(H[kE], 2.6);
    const Cd = 2 * theta[kE] * Math.pow(Ue[kE], (Hte + 5) / 2);   // Squire–Young
    return { theta, H, Cf, Ue: Float64Array.from(Ue), Cd, ...state };
  }

  /** Build surface BL inputs from a panel solution and march both surfaces. */
  function boundaryLayer(sys, sol, Re, opts) {
    const { P, n } = sys; const nu = 1 / Re;
    const xCut = (opts && opts.xCut) || 0.97;
    const Vt = sol.Vt;
    // stagnation: sign change − → + scanning along the panels (lower surface has Vt<0 flowing LE→TE)
    let is = -1, bestX = Infinity;
    for (let i = 0; i < n - 1; i++) if (Vt[i] <= 0 && Vt[i + 1] > 0 && P.xm[i] < bestX) { bestX = P.xm[i]; is = i; }
    if (is < 0) return null;
    // interpolate stagnation arc position between midpoints is and is+1
    const f = -Vt[is] / (Vt[is + 1] - Vt[is]);
    const sMid = i => 0.5 * (P.s[i] + P.s[i + 1]);
    const s0 = sMid(is) + f * (sMid(is + 1) - sMid(is));
    const x0 = P.xm[is] + f * (P.xm[is + 1] - P.xm[is]);
    const y0 = P.ym[is] + f * (P.ym[is + 1] - P.ym[is]);
    // upper surface: midpoints is+1 … n-1
    const su = [0], uu = [0], xu = [x0], iu = [is];
    for (let i = is + 1; i < n; i++) { if (P.xm[i] > xCut) break; su.push(sMid(i) - s0); uu.push(Math.abs(Vt[i])); xu.push(P.xm[i]); iu.push(i); }
    const sl = [0], ul = [0], xl = [x0], il = [is];
    for (let i = is; i >= 0; i--) { if (P.xm[i] > xCut) break; sl.push(s0 - sMid(i)); ul.push(Math.abs(Vt[i])); xl.push(P.xm[i]); il.push(i); }
    const upper = marchSurface(su, uu, xu, nu, { forcedXtr: opts && opts.xtrUpper });
    const lower = marchSurface(sl, ul, xl, nu, { forcedXtr: opts && opts.xtrLower });
    const out = { upper, lower, Cd: upper.Cd + lower.Cd, stagnation: { x: x0, y: y0, s: s0 },
      xU: xu, xL: xl, sU: su, sL: sl, idxU: iu, idxL: il, iStag: is, Re };
    // indicative stall flag: turbulent separation over more than ~20 % of the upper surface. The uncoupled integral
    // method predicts separation late, so this fires a degree or two after the real Cl,max — treat it as a warning, not a prediction.
    out.stallWarning = !!(upper.separation && upper.separation.x < 0.8) || !!(upper.laminarSep && !upper.transition);
    return out;
  }

  // ============================================================
  // 4. ATMOSPHERE & COMPRESSIBILITY
  // ============================================================

  function isa(h) {
    const g = 9.80665, R = 287.05287, T0 = 288.15, p0 = 101325, L = 0.0065;
    h = Math.max(-1000, Math.min(20000, h));
    let T, p;
    if (h <= 11000) { T = T0 - L * h; p = p0 * Math.pow(T / T0, g / (R * L)); }
    else { T = 216.65; const p11 = p0 * Math.pow(216.65 / T0, g / (R * L)); p = p11 * Math.exp(-g * (h - 11000) / (R * T)); }
    const rho = p / (R * T), mu = 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4), a = Math.sqrt(1.4 * R * T);
    return { h, T, p, rho, mu, nu: mu / rho, a };
  }

  const prandtlGlauert = M => (M < 0.99 ? 1 / Math.sqrt(1 - M * M) : 1 / Math.sqrt(1 - 0.99 * 0.99));

  /** Critical pressure coefficient at freestream Mach M (isentropic, γ = 1.4). */
  function cpStar(M) {
    const g = 1.4;
    return 2 / (g * M * M) * (Math.pow((2 + (g - 1) * M * M) / (g + 1), g / (g - 1)) - 1);
  }
  /** Critical Mach number for a given incompressible Cp,min (Prandtl–Glauert scaling). */
  function criticalMach(cpMin) {
    if (cpMin >= 0) return 1;
    let lo = 0.05, hi = 0.99;
    const f = M => cpMin * prandtlGlauert(M) - cpStar(M);
    for (let it = 0; it < 60; it++) { const mid = 0.5 * (lo + hi); if (f(mid) > 0) lo = mid; else hi = mid; }
    return 0.5 * (lo + hi);
  }

  // ============================================================
  // 5. HIGH-LEVEL ANALYSIS
  // ============================================================

  /** Full analysis at one condition. cond = {V, chord, altitude, alpha, compressible, xtrUpper, xtrLower} */
  function analyse(sys, cond) {
    const atm = isa(cond.altitude || 0);
    const V = cond.V, c = cond.chord;
    const Re = V * c / atm.nu, M = V / atm.a;
    const inv = solveInviscid(sys, cond.alpha);
    const bl = boundaryLayer(sys, inv, Re, { xtrUpper: cond.xtrUpper, xtrLower: cond.xtrLower });
    const pg = cond.compressible ? prandtlGlauert(M) : 1;
    const q = 0.5 * atm.rho * V * V;
    const Cl = inv.Cl * pg, Cm = inv.Cm * pg;
    const Cd = bl ? bl.Cd : NaN;
    return {
      atm, Re, M, q, pg, inv, bl, Cl, Cm, Cd, LD: Cd > 0 ? Cl / Cd : NaN,
      lift: q * c * Cl, drag: q * c * Cd, moment: q * c * c * Cm,
      Mcr: criticalMach(inv.CpMin), CpMin: inv.CpMin * pg,
    };
  }

  /** Sweep angle of attack; returns arrays for polar plots. */
  function sweep(sys, cond, a0, a1, step) {
    const out = [];
    for (let a = a0; a <= a1 + 1e-9; a += step) out.push(analyse(sys, Object.assign({}, cond, { alpha: a })));
    // zero-lift angle by linear interpolation
    let alpha0 = NaN;
    for (let i = 1; i < out.length; i++) {
      if (out[i - 1].Cl <= 0 && out[i].Cl > 0) { const f = -out[i - 1].Cl / (out[i].Cl - out[i - 1].Cl); alpha0 = out[i - 1].inv.alpha + f * step; break; }
    }
    // lift-curve slope per radian from a linear fit over attached region (-4…+6°)
    let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
    for (const r of out) { const a = r.inv.alpha; if (a >= -4 && a <= 6) { sx += a; sy += r.Cl; sxx += a * a; sxy += a * r.Cl; cnt++; } }
    const slopeDeg = cnt > 1 ? (cnt * sxy - sx * sy) / (cnt * sxx - sx * sx) : NaN;
    return { points: out, alpha0, clAlpha: slopeDeg * 180 / PI };
  }

  return { naca4, nacaName, parseCoordinates, repanel, geometryStats, buildPanels, buildSystem, solveInviscid, influence, rowVelocity, imageVelocity, panelImage, rotateGeo, shapeFactor, tunnelCorrections,
    velocityAt, insideBody, fieldGrid, boundaryLayer, isa, prandtlGlauert, cpStar, criticalMach, analyse, sweep };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WT;
