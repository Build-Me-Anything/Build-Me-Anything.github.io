/*
 * Pocket Wind Tunnel — 2D compressible Navier–Stokes / RANS finite-volume solver
 * --------------------------------------------------------------
 * The NASA Glenn compressible Navier–Stokes set (continuity, x/y momentum, energy) in 2D, plus a choice of
 * turbulence model — Spalart–Allmaras (one equation) or Menter k-ω SST (two equations) — solved on a structured
 * O-mesh around the section.
 *
 *   • Mesh: hyperbolic-style marching O-mesh with geometric wall clustering (y+ control), smoothed normals,
 *     radial blending to a far-field ~25 chords out; wall distance for the turbulence models
 *   • Discretisation: cell-centred finite volume; Roe flux-difference splitting with Harten entropy fix;
 *     MUSCL reconstruction of primitives with the van Albada limiter (2nd order); Green–Gauss gradients with
 *     directional face correction for the viscous fluxes; Sutherland viscosity
 *   • Turbulence: Spalart–Allmaras (SA-noft2 form as documented by the NASA Turbulence Modeling Resource) or
 *     Menter k-ω SST (the 2003 form: F1/F2 blending, strain-rate eddy-viscosity limiter, production limiter,
 *     ω wall condition 60ν/(β₁d²)); turbulence scalars convected first-order upwind with the discrete mass flux,
 *     point-implicit sources
 *   • Time integration: matrix-free LU-SGS (Jameson–Yoon) with local time stepping, CFL ramp — steady state
 *   • Boundaries: no-slip adiabatic/isothermal or slip wall via ghost cells, characteristic far-field with
 *     point-vortex lift correction, periodic wake cut
 *
 * Non-dimensional: ρ∞ = 1, a∞ = 1, chord = 1  →  V∞ = M∞, p∞ = 1/γ, T∞ = 1, μ∞ = M∞/Re.
 * Runs in the browser (inside a Web Worker) and in Node for the validation suite.
 */
const CFD = (() => {
'use strict';
const G = 1.4, GM1 = 0.4, PR = 0.72, PRT = 0.9, CP = 1 / GM1;
const SA = { cb1: 0.1355, sigma: 2 / 3, cb2: 0.622, kappa: 0.41, cw2: 0.3, cw3: 2, cv1: 7.1, cv2: 0.7, cv3: 0.9 };
SA.cw1 = SA.cb1 / (SA.kappa * SA.kappa) + (1 + SA.cb2) / SA.sigma;
// Menter k-ω SST, 2003 constants (NASA TMR "SST-2003"): set 1 = inner k-ω, set 2 = transformed k-ε; blended by F1
const SST = { bstar: 0.09, a1: 0.31, kappa: 0.41, sk1: 0.85, sw1: 0.5, b1: 0.075, g1: 5 / 9, sk2: 1.0, sw2: 0.856, b2: 0.0828, g2: 0.44, plim: 10 };

// ============================================================
// 1. MESH
// ============================================================
function growthRatio(d1, NJ, D) {
  let lo = 1.0001, hi = 3;
  for (let k = 0; k < 100; k++) { const r = 0.5 * (lo + hi); const L = d1 * (Math.pow(r, NJ) - 1) / (r - 1); if (L < D) lo = r; else hi = r; }
  return 0.5 * (lo + hi);
}
/** First-cell height for a target y+ from the flat-plate turbulent skin-friction estimate. */
function wallSpacing(Re, yplus) { const cf = 0.026 / Math.pow(Math.max(Re, 1e4), 1 / 7); return yplus / (Re * Math.sqrt(cf / 2)); }

/** O-mesh. surfX/Y: NI+1 clockwise nodes with node NI === node 0 (trailing edge). */
function makeMesh(surfX, surfY, NJ, d1, farDist) {
  const NI = surfX.length - 1, NX = NI + 1;
  const X = new Float64Array(NX * (NJ + 1)), Y = new Float64Array(NX * (NJ + 1));
  const n = (i, j) => j * NX + i;
  for (let i = 0; i <= NI; i++) { X[n(i, 0)] = surfX[i]; Y[n(i, 0)] = surfY[i]; }
  const r = growthRatio(d1, NJ, farDist);
  let px = Float64Array.from(surfX.slice(0, NI)), py = Float64Array.from(surfY.slice(0, NI));
  const nx = new Float64Array(NI), ny = new Float64Array(NI), tx = new Float64Array(NI), ty = new Float64Array(NI);
  let dist = 0;
  for (let j = 1; j <= NJ; j++) {
    const delta = d1 * Math.pow(r, j - 1);
    for (let i = 0; i < NI; i++) { const ip = (i + 1) % NI, im = (i - 1 + NI) % NI; const dx = px[ip] - px[im], dy = py[ip] - py[im]; const l = Math.hypot(dx, dy) || 1; nx[i] = -dy / l; ny[i] = dx / l; }
    const K = Math.min(2 + (j >> 1), 14);
    for (let k = 0; k < K; k++) {
      for (let i = 0; i < NI; i++) { const ip = (i + 1) % NI, im = (i - 1 + NI) % NI; tx[i] = 0.5 * nx[i] + 0.25 * (nx[ip] + nx[im]); ty[i] = 0.5 * ny[i] + 0.25 * (ny[ip] + ny[im]); }
      for (let i = 0; i < NI; i++) { const l = Math.hypot(tx[i], ty[i]) || 1; nx[i] = tx[i] / l; ny[i] = ty[i] / l; }
    }
    const s = Math.min(1, dist / 1.0), beta = s * s * (3 - 2 * s);
    const qx = new Float64Array(NI), qy = new Float64Array(NI);
    for (let i = 0; i < NI; i++) {
      const rx = px[i] - 0.5, ry = py[i], rl = Math.hypot(rx, ry) || 1;
      let bx = (1 - beta) * nx[i] + beta * rx / rl, by = (1 - beta) * ny[i] + beta * ry / rl;
      const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
      qx[i] = px[i] + delta * bx; qy[i] = py[i] + delta * by;
    }
    if (j > 6) {
      const w = 0.3 * Math.min(1, (j - 6) / 20);
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < NI; i++) {
        const ip = (i + 1) % NI, im = (i - 1 + NI) % NI;
        const cx = 0.5 * (qx[ip] + qx[im]) - qx[i], cy = 0.5 * (qy[ip] + qy[im]) - qy[i];
        let ex = qx[ip] - qx[im], ey = qy[ip] - qy[im]; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
        const d = cx * ex + cy * ey; qx[i] += w * d * ex; qy[i] += w * d * ey;
      }
    }
    for (let i = 0; i < NI; i++) { X[n(i, j)] = qx[i]; Y[n(i, j)] = qy[i]; }
    X[n(NI, j)] = qx[0]; Y[n(NI, j)] = qy[0];
    px = qx; py = qy; dist += delta;
  }
  return { NI, NJ, X, Y, ratio: r, far: dist, d1 };
}

// ============================================================
// 2. SOLVER
// ============================================================
function createSolver(mesh, cond) {
  const { NI, NJ, X, Y } = mesh, NX = NI + 1;
  const NIG = NI + 4, NJG = NJ + 4, NTOT = NIG * NJG;
  const id = (i, j) => (j + 2) * NIG + (i + 2);
  const nd = (i, j) => j * NX + i;
  const model = cond.model || 'sa', viscous = model !== 'euler', sa = model === 'sa', sst = model === 'sst', turb = sa || sst;
  const NT = sst ? 2 : sa ? 1 : 0, NEQ = 4 + NT;   // transported turbulence scalars: ρν̃ (SA) or ρk, ρω (SST)
  const Minf = cond.M, Re = cond.Re || 1e6, alpha = (cond.alpha || 0) * Math.PI / 180;
  const Vinf = Minf, uinf = Minf * Math.cos(alpha), vinf = Minf * Math.sin(alpha), pinf = 1 / G, rhoinf = 1, Tinf = 1;
  const muinf = viscous ? Minf / Re : 0, Sstar = 110.4 / (cond.Tinf || 288.15);
  const nuTinf = sa ? 3 * muinf : 0;
  // SST free stream (TMR recommendation): k∞ = 9e-9 a∞², ω∞ = 1e-6 ρ∞a∞²/μ∞  →  μt∞/μ∞ = 0.009. Both decay along the
  // inflow (dω/dt = −βω²), which is the standard SST behaviour and what the model was calibrated with.
  const kinf = sst ? (cond.kinf != null ? cond.kinf : 9e-9) : 0, winf = sst ? (cond.winf != null ? cond.winf : 1e-6 / muinf) : 0;
  const wmin = 1e-4 * winf, kref = 1e-5 * Vinf * Vinf;   // ω floor and the k scale used by the update limiter
  const Tw = cond.Tw != null ? cond.Tw : null;          // wall temperature ratio Tw/T∞, null = adiabatic
  const qinf = 0.5 * rhoinf * Vinf * Vinf;
  const EFIX = cond.efix != null ? cond.efix : 0.1;
  const TCPL = cond.saCoupling !== false;
  const LOWMACH = cond.lowMach !== false;

  // ---- metrics ----
  const vol = new Float64Array(NTOT), xc = new Float64Array(NTOT), yc = new Float64Array(NTOT), wd = new Float64Array(NTOT);
  const SIx = new Float64Array(NX * NJ), SIy = new Float64Array(NX * NJ);       // i-faces fi(i,j), i=0..NI
  const SJx = new Float64Array(NI * (NJ + 1)), SJy = new Float64Array(NI * (NJ + 1)); // j-faces fj(i,j), j=0..NJ
  const fi = (i, j) => j * NX + i, fj = (i, j) => j * NI + i;
  for (let j = 0; j < NJ; j++) for (let i = 0; i <= NI; i++) { SIx[fi(i, j)] = Y[nd(i, j + 1)] - Y[nd(i, j)]; SIy[fi(i, j)] = -(X[nd(i, j + 1)] - X[nd(i, j)]); }
  for (let j = 0; j <= NJ; j++) for (let i = 0; i < NI; i++) { SJx[fj(i, j)] = -(Y[nd(i + 1, j)] - Y[nd(i, j)]); SJy[fj(i, j)] = X[nd(i + 1, j)] - X[nd(i, j)]; }
  let minVol = Infinity;
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = nd(i, j), b = nd(i + 1, j), c = nd(i + 1, j + 1), d = nd(i, j + 1);
    const v = 0.5 * ((X[a] * Y[b] - X[b] * Y[a]) + (X[b] * Y[c] - X[c] * Y[b]) + (X[c] * Y[d] - X[d] * Y[c]) + (X[d] * Y[a] - X[a] * Y[d]));
    const k = id(i, j); vol[k] = v; minVol = Math.min(minVol, v);
    xc[k] = 0.25 * (X[a] + X[b] + X[c] + X[d]); yc[k] = 0.25 * (Y[a] + Y[b] + Y[c] + Y[d]);
  }
  if (!(minVol > 0)) throw new Error('Mesh has non-positive cell volumes (min ' + minVol.toExponential(2) + ') — try fewer layers or a larger first cell');
  // ghost-cell centres: periodic copies in i, mirrored across wall / far-field faces in j
  const reflect = (k, kin, ax, ay, snx, sny) => { const l = Math.hypot(snx, sny) || 1, nx = snx / l, ny = sny / l; const dx = xc[kin] - ax, dy = yc[kin] - ay, dn = dx * nx + dy * ny; xc[k] = xc[kin] - 2 * dn * nx; yc[k] = yc[kin] - 2 * dn * ny; vol[k] = vol[kin]; };
  for (let i = 0; i < NI; i++) {
    reflect(id(i, -1), id(i, 0), X[nd(i, 0)], Y[nd(i, 0)], SJx[fj(i, 0)], SJy[fj(i, 0)]);
    reflect(id(i, -2), id(i, 1), X[nd(i, 0)], Y[nd(i, 0)], SJx[fj(i, 0)], SJy[fj(i, 0)]);
    reflect(id(i, NJ), id(i, NJ - 1), X[nd(i, NJ)], Y[nd(i, NJ)], SJx[fj(i, NJ)], SJy[fj(i, NJ)]);
    reflect(id(i, NJ + 1), id(i, NJ - 2), X[nd(i, NJ)], Y[nd(i, NJ)], SJx[fj(i, NJ)], SJy[fj(i, NJ)]);
  }
  for (let j = -2; j < NJ + 2; j++) for (const [g, s] of [[-1, NI - 1], [-2, NI - 2], [NI, 0], [NI + 1, 1]]) { xc[id(g, j)] = xc[id(s, j)]; yc[id(g, j)] = yc[id(s, j)]; vol[id(g, j)] = vol[id(s, j)]; }
  // wall distance (to wall segments)
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const k = id(i, j), px = xc[k], py = yc[k]; let best = Infinity;
    for (let s = 0; s < NI; s++) {
      const ax = X[nd(s, 0)], ay = Y[nd(s, 0)], bx = X[nd(s + 1, 0)], by = Y[nd(s + 1, 0)];
      const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-30;
      let t = ((px - ax) * ex + (py - ay) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - (ax + t * ex), dy = py - (ay + t * ey), d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    wd[k] = Math.sqrt(best);
  }

  // ---- state ----
  // conserved: rho, ru, rv, rE, rn (= ρν̃ for SA, ρk for SST), rw (= ρω, SST only)
  const rho = new Float64Array(NTOT), ru = new Float64Array(NTOT), rv = new Float64Array(NTOT), rE = new Float64Array(NTOT), rn = new Float64Array(NTOT), rw = new Float64Array(NTOT);
  const TQ = sst ? [rn, rw] : sa ? [rn] : [];
  // primitives: nut = ν̃ (SA) or k (SST); tw = ω (SST); mut = eddy viscosity; F1a = SST blending function
  const u = new Float64Array(NTOT), v = new Float64Array(NTOT), p = new Float64Array(NTOT), T = new Float64Array(NTOT), mu = new Float64Array(NTOT), mut = new Float64Array(NTOT), nut = new Float64Array(NTOT), tw = new Float64Array(NTOT), F1a = new Float64Array(NTOT);
  const gux = new Float64Array(NTOT), guy = new Float64Array(NTOT), gvx = new Float64Array(NTOT), gvy = new Float64Array(NTOT), gTx = new Float64Array(NTOT), gTy = new Float64Array(NTOT), gnx = new Float64Array(NTOT), gny = new Float64Array(NTOT), gwx = new Float64Array(NTOT), gwy = new Float64Array(NTOT);
  const R = [], dW = []; for (let m = 0; m < 6; m++) { R.push(new Float64Array(NTOT)); dW.push(new Float64Array(NTOT)); }
  const lamI = new Float64Array(NTOT), lamJ = new Float64Array(NTOT), diag = new Float64Array(NTOT), dt = new Float64Array(NTOT);
  const lamIs = new Float64Array(NTOT), lamJs = new Float64Array(NTOT);   // turbulence-equation operator (convective + diffusive speeds only)
  const diagS = [new Float64Array(NTOT), new Float64Array(NTOT)], diagSrc = [new Float64Array(NTOT), new Float64Array(NTOT)];   // per turbulence scalar: full diagonal, source Jacobian
  const diagNu = diagSrc[0];
  const Einf = pinf / (GM1 * rhoinf) + 0.5 * Vinf * Vinf;
  for (let k = 0; k < NTOT; k++) { rho[k] = rhoinf; ru[k] = rhoinf * uinf; rv[k] = rhoinf * vinf; rE[k] = rhoinf * Einf; rn[k] = rhoinf * (sst ? kinf : nuTinf); rw[k] = rhoinf * winf; }
  if (cond.velocityFn) {   // potential-flow initial field (V∞ = 1 units) with an analytic boundary-layer profile
    const kap = 0.41;
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j);
      let [up, vp] = cond.velocityFn(xc[k], yc[k]);
      let V2 = up * up + vp * vp; if (!(V2 < 4)) { up = Math.cos(alpha); vp = Math.sin(alpha); V2 = 1; }
      const pp = pinf * Math.pow(Math.max(1e-3, 1 + 0.5 * GM1 * Minf * Minf * (1 - V2)), G / GM1), rr = rhoinf * Math.pow(pp / pinf, 1 / G);
      let fac = 1, nuT = nuTinf, kk = kinf, ww = winf;
      if (viscous) {
        const x = Math.min(Math.max(xc[k], 0.005), 1), Rex = Re * x, d = wd[k];
        const delta = turb ? 0.37 * x / Math.pow(Rex, 0.2) : 5 * x / Math.sqrt(Rex);
        const eta = Math.min(1, d / delta), inBL = !(xc[k] > 1.05 || d > 0.25);
        fac = turb ? Math.pow(eta, 1 / 7) : 2 * eta - 2 * eta * eta * eta + eta * eta * eta * eta;
        if (!inBL) fac = 1;
        if (turb) {
          const cf = 0.026 / Math.pow(Rex, 1 / 7), utau = Minf * Math.sqrt(cf / 2);
          if (sa) nuT = Math.max(nuTinf, kap * utau * d * Math.max(0, 1 - d / (1.2 * delta)));
          else if (inBL && d < 1.2 * delta) {   // log-law k and ω (viscous-sublayer ω blended in quadratically, as in Menter's wall treatment)
            const nu = muinf / rr, dp = utau * d / nu, g = Math.max(0, 1 - d / (1.2 * delta));
            kk = Math.max(kinf, utau * utau / Math.sqrt(SST.bstar) * Math.min(1, dp * dp / 64) * g);
            ww = Math.max(winf, Math.hypot(6 * nu / (SST.b1 * d * d), utau / (Math.sqrt(SST.bstar) * kap * d)));
          }
        }
      }
      const uu = Minf * up * fac, vv = Minf * vp * fac;
      rho[k] = rr; ru[k] = rr * uu; rv[k] = rr * vv; rE[k] = pp / GM1 + 0.5 * rr * (uu * uu + vv * vv); rn[k] = rr * (sst ? kk : nuT); rw[k] = rr * ww;
    }
  }

  const st = { iter: 0, res: [], res0: null, Cl: 0, Cd: 0, Cdp: 0, Cdf: 0, Cm: 0, hist: [], diverged: false, cfl: 1 };
  const sutherland = t => muinf * Math.pow(t, 1.5) * (1 + Sstar) / (t + Sstar);

  function primitives(k) {
    const r = rho[k], ui = ru[k] / r, vi = rv[k] / r;
    u[k] = ui; v[k] = vi; p[k] = GM1 * (rE[k] - 0.5 * r * (ui * ui + vi * vi)); T[k] = G * p[k] / r;
    if (viscous) {
      mu[k] = sutherland(Math.max(T[k], 0.05)); nut[k] = rn[k] / r;
      if (sa) { const chi = nut[k] * r / mu[k]; const c3 = chi * chi * chi; mut[k] = Math.max(0, rn[k] * c3 / (c3 + SA.cv1 ** 3)); }
      else if (sst) tw[k] = rw[k] / r;   // SST eddy viscosity needs the strain rate → sstClosure() after gradients()
    }
  }

  // ---- boundary conditions ----
  function farState(xf, yf) {
    // freestream with point-vortex correction (Thomas & Salas) for subsonic lift
    let ua = uinf, va = vinf;
    if (cond.farVortex !== false && Minf < 0.98 && Math.abs(st.Cl) > 1e-6) {
      const bet = Math.sqrt(1 - Minf * Minf), Gam = 0.5 * Vinf * st.Cl;
      const dx = xf - 0.25, dy = yf, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      const den = 1 - Minf * Minf * Math.sin(th - alpha) ** 2;
      ua += Gam * bet / (2 * Math.PI * r) * Math.sin(th) / den; va -= Gam * bet / (2 * Math.PI * r) * Math.cos(th) / den;
    }
    const V2 = ua * ua + va * va;
    const pa = pinf * Math.pow(Math.max(1e-3, 1 + 0.5 * GM1 * Minf * Minf * (1 - V2 / (Vinf * Vinf))), G / GM1);
    const ra = rhoinf * Math.pow(pa / pinf, 1 / G);
    return [ra, ua, va, pa];
  }
  function applyBC() {
    // periodic in i
    for (let j = -2; j < NJ + 2; j++) for (const [g, s] of [[-1, NI - 1], [-2, NI - 2], [NI, 0], [NI + 1, 1]]) {
      const kg = id(g, j), ks = id(s, j); rho[kg] = rho[ks]; ru[kg] = ru[ks]; rv[kg] = rv[ks]; rE[kg] = rE[ks]; rn[kg] = rn[ks]; rw[kg] = rw[ks];
    }
    for (let i = 0; i < NI; i++) {
      // wall
      for (const [gj, sj] of [[-1, 0], [-2, 1]]) {
        const kg = id(i, gj), ks = id(i, sj); primitives(ks);
        const r = rho[ks], ui = u[ks], vi = v[ks], pi = p[ks];
        let ug, vg, Tg;
        if (viscous) { ug = -ui; vg = -vi; Tg = Tw != null ? 2 * Tw - T[ks] : T[ks]; }
        else { const snx = SJx[fj(i, 0)], sny = SJy[fj(i, 0)], l = Math.hypot(snx, sny) || 1, nx = snx / l, ny = sny / l; const un = ui * nx + vi * ny; ug = ui - 2 * un * nx; vg = vi - 2 * un * ny; Tg = T[ks]; }
        Tg = Math.max(Tg, 0.05);
        const rg = G * pi / Tg;
        rho[kg] = rg; ru[kg] = rg * ug; rv[kg] = rg * vg; rE[kg] = pi / GM1 + 0.5 * rg * (ug * ug + vg * vg); rn[kg] = viscous ? -rn[ks] : rn[ks];   // ν̃ = 0 / k = 0 at the wall
        if (sst) {   // Menter wall condition ω_w = 60ν/(β₁d₁²), d₁ = first cell-centre distance; ghost extrapolated so the face carries ω_w
          const d1 = wd[id(i, 0)], ww = 60 * (mu[ks] / r) / (SST.b1 * d1 * d1);
          rw[kg] = rg * Math.max(2 * ww - tw[ks], ww);
        }
      }
      // far-field (characteristic)
      const ks = id(i, NJ - 1); primitives(ks);
      const f = fj(i, NJ), snx = SJx[f], sny = SJy[f], l = Math.hypot(snx, sny) || 1, nx = snx / l, ny = sny / l;
      const xf = 0.5 * (X[nd(i, NJ)] + X[nd(i + 1, NJ)]), yf = 0.5 * (Y[nd(i, NJ)] + Y[nd(i + 1, NJ)]);
      const [ra, ua, va, pa] = farState(xf, yf);
      const rd = rho[ks], ud = u[ks], vd = v[ks], pd = p[ks], ad = Math.sqrt(G * pd / rd), aa = Math.sqrt(G * pa / ra);
      const und = ud * nx + vd * ny, una = ua * nx + va * ny;
      let rb, ub, vb, pb, inflow;
      if (Math.abs(und) >= ad) { if (und < 0) { rb = ra; ub = ua; vb = va; pb = pa; inflow = true; } else { rb = rd; ub = ud; vb = vd; pb = pd; inflow = false; } }
      else {
        const Rp = und + 2 * ad / GM1, Rm = una - 2 * aa / GM1;
        const unb = 0.5 * (Rp + Rm), ab = 0.25 * GM1 * (Rp - Rm);
        inflow = unb < 0;
        const s = inflow ? pa / Math.pow(ra, G) : pd / Math.pow(rd, G);
        const utx = inflow ? ua - una * nx : ud - und * nx, uty = inflow ? va - una * ny : vd - und * ny;
        rb = Math.pow(ab * ab / (G * s), 1 / GM1); pb = rb * ab * ab / G; ub = utx + unb * nx; vb = uty + unb * ny;
      }
      const nub = inflow ? (sst ? kinf : nuTinf) : nut[ks], wb = inflow ? winf : tw[ks];
      for (const gj of [NJ, NJ + 1]) { const kg = id(i, gj); rho[kg] = rb; ru[kg] = rb * ub; rv[kg] = rb * vb; rE[kg] = pb / GM1 + 0.5 * rb * (ub * ub + vb * vb); rn[kg] = rb * nub; rw[kg] = rb * wb; }
    }
    for (let k = 0; k < NTOT; k++) primitives(k);
  }

  // ---- gradients (Green–Gauss) ----
  function gradients() {
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j), kw = id(i - 1, j), ke = id(i + 1, j), ks = id(i, j - 1), kn = id(i, j + 1);
      const fw = fi(i, j), fe = fi(i + 1, j), fs = fj(i, j), fn = fj(i, j + 1), iv = 1 / vol[k];
      const acc = (arr, gx, gy) => {
        const c = arr[k];
        const ew = 0.5 * (arr[kw] + c), ee = 0.5 * (arr[ke] + c), es = 0.5 * (arr[ks] + c), en = 0.5 * (arr[kn] + c);
        gx[k] = (ee * SIx[fe] - ew * SIx[fw] + en * SJx[fn] - es * SJx[fs]) * iv;
        gy[k] = (ee * SIy[fe] - ew * SIy[fw] + en * SJy[fn] - es * SJy[fs]) * iv;
      };
      acc(u, gux, guy); acc(v, gvx, gvy); acc(T, gTx, gTy); if (turb) acc(nut, gnx, gny); if (sst) acc(tw, gwx, gwy);
    }
    // ghost gradients = neighbouring interior (wall/far) or periodic copies
    const copy = (kg, ks) => { gux[kg] = gux[ks]; guy[kg] = guy[ks]; gvx[kg] = gvx[ks]; gvy[kg] = gvy[ks]; gTx[kg] = gTx[ks]; gTy[kg] = gTy[ks]; gnx[kg] = gnx[ks]; gny[kg] = gny[ks]; gwx[kg] = gwx[ks]; gwy[kg] = gwy[ks]; };
    for (let i = 0; i < NI; i++) { copy(id(i, -1), id(i, 0)); copy(id(i, -2), id(i, 1)); copy(id(i, NJ), id(i, NJ - 1)); copy(id(i, NJ + 1), id(i, NJ - 2)); }
    for (let j = -2; j < NJ + 2; j++) for (const [g, s] of [[-1, NI - 1], [-2, NI - 2], [NI, 0], [NI + 1, 1]]) copy(id(g, j), id(s, j));
  }

  /** SST closure: blending functions F1/F2 and the eddy viscosity μt = ρa₁k / max(a₁ω, S·F2). Needs gradients. */
  function sstClosure() {
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j), r = rho[k], nu = mu[k] / r, kk = Math.max(nut[k], 0), ww = Math.max(tw[k], wmin), d = Math.max(wd[k], 1e-9);
      const ux = gux[k], uy = guy[k], vx = gvx[k], vy = gvy[k];
      const Sm = Math.sqrt(2 * (ux * ux + vy * vy) + (uy + vx) * (uy + vx));   // |S| = √(2 Sij Sij)
      const arg2 = Math.max(2 * Math.sqrt(kk) / (SST.bstar * ww * d), 500 * nu / (d * d * ww)), F2 = Math.tanh(arg2 * arg2);
      mut[k] = r * SST.a1 * kk / Math.max(SST.a1 * ww, Sm * F2);
      const CD = Math.max(2 * r * SST.sw2 / ww * (gnx[k] * gwx[k] + gny[k] * gwy[k]), 1e-10);
      const arg1 = Math.min(Math.max(Math.sqrt(kk) / (SST.bstar * ww * d), 500 * nu / (d * d * ww)), 4 * r * SST.sw2 * kk / (CD * d * d));
      F1a[k] = Math.tanh(arg1 * arg1 * arg1 * arg1);
    }
    for (let i = 0; i < NI; i++) {
      for (const gj of [-1, -2]) { const kg = id(i, gj); mut[kg] = 0; F1a[kg] = 1; }   // μt = 0 at the wall, inner (k-ω) branch
      for (const [gj, sj] of [[NJ, NJ - 1], [NJ + 1, NJ - 2]]) { const kg = id(i, gj), ks = id(i, sj); mut[kg] = mut[ks]; F1a[kg] = F1a[ks]; }
    }
    for (let j = -2; j < NJ + 2; j++) for (const [g, s] of [[-1, NI - 1], [-2, NI - 2], [NI, 0], [NI + 1, 1]]) { mut[id(g, j)] = mut[id(s, j)]; F1a[id(g, j)] = F1a[id(s, j)]; }
  }

  // ---- fluxes ----
  const limAvg = (a, b) => { const e = 1e-10; return ((b * b + e) * a + (a * a + e) * b) / (a * a + b * b + 2 * e); };
  const FF = new Float64Array(6);
  /** Roe flux (×|S|) between primitive states L and R across unit normal (nx,ny). Writes FF[0..3]. */
  function roe(rL, uL, vL, pL, rR, uR, vR, pR, nx, ny, S) {
    const unL = uL * nx + vL * ny, unR = uR * nx + vR * ny;
    const HL = G * pL / (GM1 * rL) + 0.5 * (uL * uL + vL * vL), HR = G * pR / (GM1 * rR) + 0.5 * (uR * uR + vR * vR);
    const sL = Math.sqrt(rL), sR = Math.sqrt(rR), w = 1 / (sL + sR);
    const ut = (sL * uL + sR * uR) * w, vt = (sL * vL + sR * vR) * w, Ht = (sL * HL + sR * HR) * w, rt = sL * sR;
    const q2 = ut * ut + vt * vt, a2 = Math.max(GM1 * (Ht - 0.5 * q2), 1e-8), at = Math.sqrt(a2), unt = ut * nx + vt * ny;
    // Rieper/Thornber low-Mach fix: scale the velocity jumps in the dissipation by the local Mach number so the
    // scheme's pressure error does not grow like 1/M as the flow becomes incompressible
    const zz = LOWMACH ? Math.min(1, Math.max(Math.sqrt((uL * uL + vL * vL) / (G * pL / rL)), Math.sqrt((uR * uR + vR * vR) / (G * pR / rR)))) : 1;
    const dr = rR - rL, du = zz * (uR - uL), dv = zz * (vR - vL), dp = pR - pL, dun = zz * (unR - unL);
    const eps = EFIX * (Math.abs(unt) + at);
    const fix = l => (l < eps ? (l * l + eps * eps) / (2 * eps) : l);
    // entropy fix on the acoustic waves only: fixing the convective eigenvalue too would add O(0.05·a) artificial
    // diffusion normal to the wall — at low Mach that swamps the physical viscosity inside the boundary layer
    const l1 = fix(Math.abs(unt - at)), l2 = Math.max(Math.abs(unt), 1e-4 * at), l3 = fix(Math.abs(unt + at));
    const c1 = l1 * (dp - rt * at * dun) / (2 * a2), c3 = l3 * (dp + rt * at * dun) / (2 * a2), c2 = l2 * (dr - dp / a2);
    const d0 = c1 + c2 + c3;
    const d1 = c1 * (ut - at * nx) + c2 * ut + l2 * rt * (du - dun * nx) + c3 * (ut + at * nx);
    const d2 = c1 * (vt - at * ny) + c2 * vt + l2 * rt * (dv - dun * ny) + c3 * (vt + at * ny);
    const d3 = c1 * (Ht - at * unt) + c2 * 0.5 * q2 + l2 * rt * (ut * du + vt * dv - unt * dun) + c3 * (Ht + at * unt);
    FF[0] = 0.5 * (rL * unL + rR * unR - d0) * S;
    FF[1] = 0.5 * (rL * uL * unL + pL * nx + rR * uR * unR + pR * nx - d1) * S;
    FF[2] = 0.5 * (rL * vL * unL + pL * ny + rR * vR * unR + pR * ny - d2) * S;
    FF[3] = 0.5 * (rL * HL * unL + rR * HR * unR - d3) * S;
  }
  /** Turbulence scalars convected with the discrete mass flux FF[0] (first-order upwind); writes FF[4..]. */
  function convT(kL, kR, rL, rR) {
    const mf = FF[0];
    if (mf >= 0) { const ir = 1 / rL; for (let m = 0; m < NT; m++) FF[4 + m] = mf * TQ[m][kL] * ir; }
    else { const ir = 1 / rR; for (let m = 0; m < NT; m++) FF[4 + m] = mf * TQ[m][kR] * ir; }
  }
  /** Viscous flux (×|S|) at a face between cells kL and kR; writes FF[1..] (momentum, energy, turbulence diffusion). */
  function viscFlux(kL, kR, nx, ny, S, wallFace) {
    const dx = xc[kR] - xc[kL], dy = yc[kR] - yc[kL], dl = Math.hypot(dx, dy) || 1e-12, ex = dx / dl, ey = dy / dl;
    const corr = (gx, gy, arr) => { let ax = 0.5 * (gx[kL] + gx[kR]), ay = 0.5 * (gy[kL] + gy[kR]); const c = (arr[kR] - arr[kL]) / dl - (ax * ex + ay * ey); return [ax + c * ex, ay + c * ey]; };
    const [ux, uy] = corr(gux, guy, u), [vx, vy] = corr(gvx, gvy, v), [Tx, Ty] = corr(gTx, gTy, T);
    const muf = 0.5 * (mu[kL] + mu[kR]), mutf = turb ? Math.max(0, 0.5 * (mut[kL] + mut[kR])) : 0, me = muf + mutf;
    const div = ux + vy, txx = me * (2 * ux - 2 / 3 * div), tyy = me * (2 * vy - 2 / 3 * div), txy = me * (uy + vx);
    const uf = 0.5 * (u[kL] + u[kR]), vf = 0.5 * (v[kL] + v[kR]), kcond = CP * (muf / PR + mutf / PRT);
    FF[1] = (txx * nx + txy * ny) * S; FF[2] = (txy * nx + tyy * ny) * S;
    FF[3] = ((uf * txx + vf * txy) * nx + (uf * txy + vf * tyy) * ny + kcond * (Tx * nx + Ty * ny)) * S;
    if (sa) { const [nxg, nyg] = corr(gnx, gny, nut); const rnf = wallFace ? 0 : 0.5 * (rn[kL] + rn[kR]); FF[4] = (muf + Math.max(rnf, 0)) / SA.sigma * (nxg * nx + nyg * ny) * S; }
    else if (sst) {   // (μ + σk μt)∇k·n, (μ + σω μt)∇ω·n with F1-blended σ; μt = 0 on the wall face
      const [kx, ky] = corr(gnx, gny, nut), [wx, wy] = corr(gwx, gwy, tw);
      const F1 = 0.5 * (F1a[kL] + F1a[kR]), mtf = wallFace ? 0 : mutf;
      FF[4] = (muf + (F1 * SST.sk1 + (1 - F1) * SST.sk2) * mtf) * (kx * nx + ky * ny) * S;
      FF[5] = (muf + (F1 * SST.sw1 + (1 - F1) * SST.sw2) * mtf) * (wx * nx + wy * ny) * S;
    } else FF[4] = 0;
  }
  function residual() {
    for (let m = 0; m < 6; m++) R[m].fill(0);
    const order2 = cond.order !== 1;
    // i-faces (periodic: face i=0 shared with i=NI)
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const f = fi(i, j), Sx = SIx[f], Sy = SIy[f], S = Math.hypot(Sx, Sy), nx = Sx / S, ny = Sy / S;
      const kL = i === 0 ? id(NI - 1, j) : id(i - 1, j), kR = id(i, j), kLL = id(i - 2, j), kRR = id(i + 1, j);
      let rL, uL, vL, pL, rR, uR, vR, pR;
      if (order2) {
        rL = rho[kL] + 0.5 * limAvg(rho[kL] - rho[kLL], rho[kR] - rho[kL]); rR = rho[kR] - 0.5 * limAvg(rho[kR] - rho[kL], rho[kRR] - rho[kR]);
        uL = u[kL] + 0.5 * limAvg(u[kL] - u[kLL], u[kR] - u[kL]); uR = u[kR] - 0.5 * limAvg(u[kR] - u[kL], u[kRR] - u[kR]);
        vL = v[kL] + 0.5 * limAvg(v[kL] - v[kLL], v[kR] - v[kL]); vR = v[kR] - 0.5 * limAvg(v[kR] - v[kL], v[kRR] - v[kR]);
        pL = p[kL] + 0.5 * limAvg(p[kL] - p[kLL], p[kR] - p[kL]); pR = p[kR] - 0.5 * limAvg(p[kR] - p[kL], p[kRR] - p[kR]);
        if (!(rL > 0 && rR > 0 && pL > 0 && pR > 0)) { rL = rho[kL]; rR = rho[kR]; uL = u[kL]; uR = u[kR]; vL = v[kL]; vR = v[kR]; pL = p[kL]; pR = p[kR]; }
      } else { rL = rho[kL]; rR = rho[kR]; uL = u[kL]; uR = u[kR]; vL = v[kL]; vR = v[kR]; pL = p[kL]; pR = p[kR]; }
      roe(rL, uL, vL, pL, rR, uR, vR, pR, nx, ny, S); convT(kL, kR, rL, rR);
      for (let m = 0; m < NEQ; m++) { R[m][kL] += FF[m]; R[m][kR] -= FF[m]; }
      if (viscous) { viscFlux(kL, kR, nx, ny, S, false); for (let m = 1; m < NEQ; m++) { R[m][kL] -= FF[m]; R[m][kR] += FF[m]; } }
    }
    // j-faces
    for (let j = 0; j <= NJ; j++) for (let i = 0; i < NI; i++) {
      const f = fj(i, j), Sx = SJx[f], Sy = SJy[f], S = Math.hypot(Sx, Sy), nx = Sx / S, ny = Sy / S;
      const kL = id(i, j - 1), kR = id(i, j);
      if (j === 0) {   // wall: pressure flux only (extrapolated), viscous flux via mirrored ghost
        const k0 = id(i, 0), k1 = id(i, 1), h0 = wd[k0], h1 = wd[k1];
        let pw = cond.wallExtrap === true ? p[k0] + (p[k0] - p[k1]) * h0 / Math.max(h1 - h0, 1e-12) : p[k0]; if (!(pw > 0.1 * p[k0])) pw = p[k0];
        R[1][kR] -= pw * Sx; R[2][kR] -= pw * Sy;
        if (viscous) { viscFlux(kL, kR, nx, ny, S, true); for (let m = 1; m < NEQ; m++) R[m][kR] += FF[m]; }
        continue;
      }
      if (j === NJ) {  // far-field: first-order Roe against the characteristic ghost state
        roe(rho[kL], u[kL], v[kL], p[kL], rho[kR], u[kR], v[kR], p[kR], nx, ny, S); convT(kL, kR, rho[kL], rho[kR]);
        for (let m = 0; m < NEQ; m++) R[m][kL] += FF[m];
        if (viscous) { viscFlux(kL, kR, nx, ny, S, false); for (let m = 1; m < NEQ; m++) R[m][kL] -= FF[m]; }
        continue;
      }
      const kLL = id(i, j - 2), kRR = id(i, j + 1);
      let rL, uL, vL, pL, rR, uR, vR, pR;
      if (order2) {
        rL = rho[kL] + 0.5 * limAvg(rho[kL] - rho[kLL], rho[kR] - rho[kL]); rR = rho[kR] - 0.5 * limAvg(rho[kR] - rho[kL], rho[kRR] - rho[kR]);
        uL = u[kL] + 0.5 * limAvg(u[kL] - u[kLL], u[kR] - u[kL]); uR = u[kR] - 0.5 * limAvg(u[kR] - u[kL], u[kRR] - u[kR]);
        vL = v[kL] + 0.5 * limAvg(v[kL] - v[kLL], v[kR] - v[kL]); vR = v[kR] - 0.5 * limAvg(v[kR] - v[kL], v[kRR] - v[kR]);
        pL = p[kL] + 0.5 * limAvg(p[kL] - p[kLL], p[kR] - p[kL]); pR = p[kR] - 0.5 * limAvg(p[kR] - p[kL], p[kRR] - p[kR]);
        if (!(rL > 0 && rR > 0 && pL > 0 && pR > 0)) { rL = rho[kL]; rR = rho[kR]; uL = u[kL]; uR = u[kR]; vL = v[kL]; vR = v[kR]; pL = p[kL]; pR = p[kR]; }
      } else { rL = rho[kL]; rR = rho[kR]; uL = u[kL]; uR = u[kR]; vL = v[kL]; vR = v[kR]; pL = p[kL]; pR = p[kR]; }
      roe(rL, uL, vL, pL, rR, uR, vR, pR, nx, ny, S); convT(kL, kR, rL, rR);
      for (let m = 0; m < NEQ; m++) { R[m][kL] += FF[m]; R[m][kR] -= FF[m]; }
      if (viscous) { viscFlux(kL, kR, nx, ny, S, false); for (let m = 1; m < NEQ; m++) { R[m][kL] -= FF[m]; R[m][kR] += FF[m]; } }
    }
    // turbulence sources
    diagSrc[0].fill(0); diagSrc[1].fill(0);
    if (sa) for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j), r = rho[k], nu = mu[k] / r, nt = Math.max(nut[k], 0), d = Math.max(wd[k], 1e-9);
      const chi = nt / nu, c3 = chi * chi * chi, fv1 = c3 / (c3 + SA.cv1 ** 3), fv2 = 1 - chi / (1 + chi * fv1);
      const Om = Math.abs(gvx[k] - guy[k]), kd2 = SA.kappa * SA.kappa * d * d;
      const Sbar = nt * fv2 / kd2;
      const St = Sbar >= -SA.cv2 * Om ? Om + Sbar : Om + Om * (SA.cv2 * SA.cv2 * Om + SA.cv3 * Sbar) / ((SA.cv3 - 2 * SA.cv2) * Om - Sbar);
      const rr = St > 1e-12 ? Math.min(nt / (St * kd2), 10) : 10;
      const g = rr + SA.cw2 * (Math.pow(rr, 6) - rr), fw = g * Math.pow((1 + Math.pow(SA.cw3, 6)) / (Math.pow(g, 6) + Math.pow(SA.cw3, 6)), 1 / 6);
      const P = SA.cb1 * St * r * nt, D = SA.cw1 * fw * r * (nt / d) * (nt / d), C = SA.cb2 / SA.sigma * r * (gnx[k] * gnx[k] + gny[k] * gny[k]);
      R[4][k] -= (P - D + C) * vol[k];
      diagNu[k] = vol[k] * (2 * SA.cw1 * fw * nt / (d * d) + SA.cb1 * St);   // destruction + production Jacobians (both kept on the diagonal for robustness)
    }
    if (sst) for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j), r = rho[k], kk = Math.max(nut[k], 0), ww = Math.max(tw[k], wmin), F1 = F1a[k], mt = mut[k];
      const beta = F1 * SST.b1 + (1 - F1) * SST.b2, gam = F1 * SST.g1 + (1 - F1) * SST.g2;
      const ux = gux[k], uy = guy[k], vx = gvx[k], vy = gvy[k], div = ux + vy;
      const S2 = 2 * (ux * ux + vy * vy) + (uy + vx) * (uy + vx) - 2 / 3 * div * div;   // 2 Sij Sij − ⅔ (∇·u)²
      const P = mt * S2 - 2 / 3 * r * kk * div;                                          // τij ∂ui/∂xj
      const Pk = Math.min(P, SST.plim * SST.bstar * r * ww * kk), Dk = SST.bstar * r * ww * kk;   // production limiter (2003: 10 β* ρ ω k)
      const Pw = gam * r * Math.max(S2, 0), Dw = beta * r * ww * ww;                      // ω production γρS² (Menter 2003), destruction βρω²
      const CD = 2 * (1 - F1) * r * SST.sw2 / ww * (gnx[k] * gwx[k] + gny[k] * gwy[k]);   // cross-diffusion (outer branch only)
      R[4][k] -= (Pk - Dk) * vol[k]; R[5][k] -= (Pw - Dw + CD) * vol[k];
      diagSrc[0][k] = vol[k] * (SST.bstar * ww + (kk > 1e-30 ? Math.max(Pk, 0) / (r * kk) : 0));   // destruction (+ production, for damping) on the diagonal
      diagSrc[1][k] = vol[k] * (2 * beta * ww + (CD < 0 ? -CD / (r * ww) : 0));                  // negative cross-diffusion treated implicitly
    }
  }

  // ---- LU-SGS ----
  function spectral() {
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j), a = Math.sqrt(G * p[k] / rho[k]);
      const six = 0.5 * (SIx[fi(i, j)] + SIx[fi(i + 1, j)]), siy = 0.5 * (SIy[fi(i, j)] + SIy[fi(i + 1, j)]), Si = Math.hypot(six, siy);
      const sjx = 0.5 * (SJx[fj(i, j)] + SJx[fj(i, j + 1)]), sjy = 0.5 * (SJy[fj(i, j)] + SJy[fj(i, j + 1)]), Sj = Math.hypot(sjx, sjy);
      let li = Math.abs(u[k] * six + v[k] * siy) + a * Si, lj = Math.abs(u[k] * sjx + v[k] * sjy) + a * Sj;
      if (viscous) { const me = (mu[k] + mut[k]) / rho[k], cv = Math.max(4 / 3, G / PR) * me / vol[k]; li += 2 * cv * Si * Si; lj += 2 * cv * Sj * Sj; }
      lamI[k] = li; lamJ[k] = lj;
      dt[k] = st.cfl * vol[k] / (li + lj);
      diag[k] = vol[k] / dt[k] + 1.2 * (li + lj);
      if (turb) {
        const dif = sa ? 2 * (mu[k] + Math.max(rn[k], 0)) / (SA.sigma * rho[k] * vol[k]) : 2 * (mu[k] + mut[k]) / (rho[k] * vol[k]);
        const lis = Math.abs(u[k] * six + v[k] * siy) + dif * Si * Si, ljs = Math.abs(u[k] * sjx + v[k] * sjy) + dif * Sj * Sj;
        lamIs[k] = lis; lamJs[k] = ljs;
        const dts = (cond.cflTurb || cond.cflSa || 10) * vol[k] / (lis + ljs);
        for (let m = 0; m < NT; m++) diagS[m][k] = vol[k] / dts + (lis + ljs) + diagSrc[m][k];
      }
    }
  }
  const dF = new Float64Array(4);
  /** ΔF = F(W+ΔW)·S − F(W)·S for the mean-flow convective flux across (Sx,Sy); writes dF. */
  function fluxDelta(k, Sx, Sy) {
    const r0 = rho[k], u0 = u[k], v0 = v[k], p0 = p[k], un0 = u0 * Sx + v0 * Sy, H0 = (rE[k] + p0) / r0;
    const r1 = r0 + dW[0][k]; if (!(r1 > 0)) { dF.fill(0); return; }
    const u1 = (ru[k] + dW[1][k]) / r1, v1 = (rv[k] + dW[2][k]) / r1, E1 = rE[k] + dW[3][k];
    const p1 = GM1 * (E1 - 0.5 * r1 * (u1 * u1 + v1 * v1)); if (!(p1 > 0)) { dF.fill(0); return; }
    const un1 = u1 * Sx + v1 * Sy;
    dF[0] = r1 * un1 - r0 * un0;
    dF[1] = (r1 * u1 * un1 + p1 * Sx) - (r0 * u0 * un0 + p0 * Sx);
    dF[2] = (r1 * v1 * un1 + p1 * Sy) - (r0 * v0 * un0 + p0 * Sy);
    dF[3] = (E1 + p1) * un1 - r0 * H0 * un0;
  }
  function lusgs(pass) {
    const rhs = [0, 0, 0, 0, 0, 0];
    // forward sweep (on later passes the upper neighbours enter with their previous values → symmetric Gauss–Seidel)
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j);
      for (let m = 0; m < NEQ; m++) rhs[m] = -R[m][k];
      if (pass > 0) {
        if (i < NI - 1) { const kn = id(i + 1, j), f = fi(i + 1, j); fluxDelta(kn, SIx[f], SIy[f]); const lam = lamI[kn]; for (let m = 0; m < 4; m++) rhs[m] -= 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SIx[f] + v[kn] * SIy[f] - lamIs[kn]); for (let m = 4; m < NEQ; m++) rhs[m] -= c * dW[m][kn]; } }
        if (j < NJ - 1) { const kn = id(i, j + 1), f = fj(i, j + 1); fluxDelta(kn, SJx[f], SJy[f]); const lam = lamJ[kn]; for (let m = 0; m < 4; m++) rhs[m] -= 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SJx[f] + v[kn] * SJy[f] - lamJs[kn]); for (let m = 4; m < NEQ; m++) rhs[m] -= c * dW[m][kn]; } }
      }
      if (i > 0) { const kn = id(i - 1, j), f = fi(i, j); fluxDelta(kn, -SIx[f], -SIy[f]); const lam = lamI[kn]; for (let m = 0; m < 4; m++) rhs[m] -= 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SIx[f] + v[kn] * SIy[f] + lamIs[kn]); for (let m = 4; m < NEQ; m++) rhs[m] += c * dW[m][kn]; } }
      if (j > 0) { const kn = id(i, j - 1), f = fj(i, j); fluxDelta(kn, -SJx[f], -SJy[f]); const lam = lamJ[kn]; for (let m = 0; m < 4; m++) rhs[m] -= 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SJx[f] + v[kn] * SJy[f] + lamJs[kn]); for (let m = 4; m < NEQ; m++) rhs[m] += c * dW[m][kn]; } }
      const D = diag[k];
      for (let m = 0; m < 4; m++) dW[m][k] = rhs[m] / D;
      for (let m = 0; m < NT; m++) dW[4 + m][k] = rhs[4 + m] / diagS[m][k];
    }
    // backward sweep
    const corr = [0, 0, 0, 0, 0, 0];
    for (let j = NJ - 1; j >= 0; j--) for (let i = NI - 1; i >= 0; i--) {
      const k = id(i, j);
      corr.fill(0);
      if (i < NI - 1) { const kn = id(i + 1, j), f = fi(i + 1, j); fluxDelta(kn, SIx[f], SIy[f]); const lam = lamI[kn]; for (let m = 0; m < 4; m++) corr[m] += 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SIx[f] + v[kn] * SIy[f] - lamIs[kn]); for (let m = 4; m < NEQ; m++) corr[m] += c * dW[m][kn]; } }
      if (j < NJ - 1) { const kn = id(i, j + 1), f = fj(i, j + 1); fluxDelta(kn, SJx[f], SJy[f]); const lam = lamJ[kn]; for (let m = 0; m < 4; m++) corr[m] += 0.5 * (dF[m] - lam * dW[m][kn]); if (TCPL) { const c = 0.5 * (u[kn] * SJx[f] + v[kn] * SJy[f] - lamJs[kn]); for (let m = 4; m < NEQ; m++) corr[m] += c * dW[m][kn]; } }
      const D = diag[k];
      for (let m = 0; m < 4; m++) dW[m][k] -= corr[m] / D;
      for (let m = 0; m < NT; m++) dW[4 + m][k] -= corr[4 + m] / diagS[m][k];
    }
  }
  function update() {
    let bad = 0;
    const clamp = (x, lim) => (x > lim ? lim : x < -lim ? -lim : x);
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j);
      let r = rho[k] + dW[0][k], mx = ru[k] + dW[1][k], my = rv[k] + dW[2][k], E = rE[k] + dW[3][k];
      if (!(r > 1e-4)) { r = 1e-4; bad++; }
      let pp = GM1 * (E - 0.5 * (mx * mx + my * my) / r);
      if (!(pp > 1e-5)) { pp = 1e-5; E = pp / GM1 + 0.5 * (mx * mx + my * my) / r; bad++; }
      rho[k] = r; ru[k] = mx; rv[k] = my; rE[k] = E;
      // turbulence updates bounded to ±50 % of the local value (the point-implicit linearisation overshoots otherwise)
      if (sa) { const ref = Math.max(rn[k], rho[k] * nuTinf); rn[k] = Math.max(0, rn[k] + clamp(dW[4][k], 0.5 * ref)); }
      else if (sst) {
        rn[k] = Math.max(0, rn[k] + clamp(dW[4][k], 0.5 * Math.max(rn[k], r * kref)));
        rw[k] = Math.max(r * wmin, rw[k] + clamp(dW[5][k], 0.5 * Math.max(rw[k], r * winf)));
      }
      if (!Number.isFinite(r + mx + my + E)) st.diverged = true;
    }
    return bad;
  }

  // ---- forces & surface data ----
  function forces() {
    let fx = 0, fy = 0, fpx = 0, fpy = 0, mz = 0;
    const Cp = new Float64Array(NI), Cf = new Float64Array(NI), xs = new Float64Array(NI), ys = new Float64Array(NI), yp = new Float64Array(NI);
    for (let i = 0; i < NI; i++) {
      const f = fj(i, 0), Sx = SJx[f], Sy = SJy[f], S = Math.hypot(Sx, Sy), nx = Sx / S, ny = Sy / S;
      const k0 = id(i, 0), k1 = id(i, 1), h0 = wd[k0], h1 = wd[k1];
      let pw = cond.wallExtrap === true ? p[k0] + (p[k0] - p[k1]) * h0 / Math.max(h1 - h0, 1e-12) : p[k0]; if (!(pw > 0.1 * p[k0])) pw = p[k0];
      const xf = 0.5 * (X[nd(i, 0)] + X[nd(i + 1, 0)]), yf = 0.5 * (Y[nd(i, 0)] + Y[nd(i + 1, 0)]);
      xs[i] = xf; ys[i] = yf; Cp[i] = (pw - pinf) / qinf;
      let Fx = -(pw - pinf) * Sx, Fy = -(pw - pinf) * Sy; fpx += Fx; fpy += Fy;
      if (viscous) {
        viscFlux(id(i, -1), k0, nx, ny, S, true);
        const tx = Sy / S, ty = -Sx / S;   // wall tangent in +i direction
        Cf[i] = (FF[1] * tx + FF[2] * ty) / S / qinf;
        Fx += FF[1]; Fy += FF[2];
        const tauw = Math.abs(FF[1] * tx + FF[2] * ty) / S, utau = Math.sqrt(tauw / rho[k0]);
        yp[i] = utau * h0 * rho[k0] / mu[k0];
      }
      fx += Fx; fy += Fy; mz += (xf - 0.25) * Fy - yf * Fx;
    }
    const ca = Math.cos(alpha), sa_ = Math.sin(alpha);
    st.Cl = (fy * ca - fx * sa_) / qinf; st.Cd = (fx * ca + fy * sa_) / qinf; st.Cdp = (fpx * ca + fpy * sa_) / qinf; st.Cdf = st.Cd - st.Cdp; st.Cm = -mz / qinf;
    return { x: xs, y: ys, Cp, Cf, yplus: yp };
  }

  function iterate(n) {
    for (let it = 0; it < n; it++) {
      st.iter++;
      st.cfl = Math.min(cond.cfl || 5, 1 + (cond.cfl || 5) * st.iter / 150);
      applyBC();
      if (viscous || turb) gradients();
      if (sst) sstClosure();
      residual();
      spectral();
      for (let m = 0; m < 6; m++) dW[m].fill(0);
      const passes = cond.sweeps || 1;   // a second symmetric pass over the Jameson–Yoon operator is unstable — keep to one
      for (let ps = 0; ps < passes; ps++) lusgs(ps);
      update();
      let s = 0, s4 = 0, s5 = 0, cnt = 0;
      for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const k = id(i, j); s += R[0][k] * R[0][k]; s4 += R[4][k] * R[4][k]; s5 += R[5][k] * R[5][k]; cnt++; }
      const res = Math.sqrt(s / cnt); st.resNu = Math.sqrt(s4 / cnt); st.resW = Math.sqrt(s5 / cnt);
      if (st.resNu0 == null && st.iter >= 2) { st.resNu0 = st.resNu; st.resW0 = st.resW; }
      if (st.res0 == null && st.iter >= 2) st.res0 = res;
      st.res.push(res);
      if (st.iter % 10 === 0 || it === n - 1) { forces(); st.hist.push([st.iter, st.Cl, st.Cd, st.Cm]); }
      if (st.diverged) break;
    }
    return st;
  }

  /** Field quantity on interior cells (NI×NJ, row-major by j). */
  function field(kind) {
    const out = new Float32Array(NI * NJ);
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = id(i, j); let val;
      switch (kind) {
        case 'mach': val = Math.sqrt((u[k] * u[k] + v[k] * v[k]) / (G * p[k] / rho[k])); break;
        case 'cp': val = (p[k] - pinf) / qinf; break;
        case 'p': val = p[k] / pinf; break;
        case 'rho': val = rho[k] / rhoinf; break;
        case 'T': val = T[k] / Tinf; break;
        case 'V': val = Math.hypot(u[k], v[k]) / Vinf; break;
        case 'mut': val = viscous ? mut[k] / Math.max(mu[k], 1e-30) : 0; break;
        case 'vort': val = (gvx[k] - guy[k]) / Vinf; break;
        case 'u': val = u[k] / Vinf; break;
        case 'tke': val = sst ? Math.max(nut[k], 0) / (Vinf * Vinf) : 0; break;                       // k / V∞²
        case 'omega': val = sst ? Math.log10(Math.max(tw[k], 1e-30) / Vinf) : 0; break;              // log10(ω c / V∞)
        case 'f1': val = sst ? F1a[k] : 0; break;
        default: val = 0;
      }
      out[j * NI + i] = val;
    }
    return out;
  }
  function velocityField() { const U = new Float32Array(NI * NJ), Vv = new Float32Array(NI * NJ); for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const k = id(i, j); U[j * NI + i] = u[k] / Vinf; Vv[j * NI + i] = v[k] / Vinf; } return { U, V: Vv }; }

  applyBC();
  return { mesh, cond, st, iterate, forces, field, velocityField, NI, NJ, minVol, wallDistance: wd, id, model,
    _a: { rho, ru, rv, rE, rn, rw, u, v, p, T, mu, mut, nut, tw, F1a, gux, guy, gvx, gvy, gnx, gny, gwx, gwy, wd, vol, xc, yc, R, SIx, SIy, SJx, SJy, fi, fj, lamI, lamJ, diag, diagNu, diagS, dt } };
}

/** Convenience: build mesh + solver from a closed node list. */
function setup(surfX, surfY, opts) {
  const NJ = opts.NJ || 64, far = opts.far || 25;
  const d1 = opts.d1 || (opts.model === 'euler' ? 2e-3 : wallSpacing(opts.Re || 1e6, opts.yplus || 1));
  const mesh = makeMesh(surfX, surfY, NJ, d1, far);
  return createSolver(mesh, opts);
}

return { makeMesh, createSolver, setup, wallSpacing, growthRatio, SA, SST };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CFD;
