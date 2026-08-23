/*
 * Pocket Wind Tunnel — hypersonic / supersonic core
 * --------------------------------------------------------------
 *   • US Standard Atmosphere 1976 to 86 km (geometric → geopotential), Sutherland viscosity, mean free path
 *   • Exact perfect-gas relations: oblique shock (θ–β–M, weak solution), normal shock, Rayleigh pitot,
 *     isentropic relations, Prandtl–Meyer function and inverse — all for arbitrary γ
 *   • Local-inclination methods for an arbitrary 2D section (NASA HABP style):
 *       - shock-expansion marching, with modified-Newtonian treatment of a detached (blunt) nose
 *         up to the sonic point, then Prandtl–Meyer expansion from the stagnation-streamline state
 *       - tangent-wedge (+ Prandtl–Meyer on leeward panels, Newtonian fallback beyond detachment)
 *       - modified / classic Newtonian
 *   • Eckert reference-temperature flat-plate skin friction and heating (laminar / turbulent / Re_x transition)
 *   • Sutton–Graves stagnation-point heating, Billig bow-shock stand-off and shape
 *   • Geometry generators for sharp and blunted hypersonic shapes
 *
 * Non-dimensional inside (chord = 1), scaled at the edges. Runs in the browser (global HT) and Node.
 */
const HT = (() => {
  'use strict';
  const PI = Math.PI, R = 287.05287, G0 = 9.80665, DEG = PI / 180;
  const sutherland = T => 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4);

  // ============================================================
  // 1. ATMOSPHERE — US Standard Atmosphere 1976
  // ============================================================
  const HB = [0, 11000, 20000, 32000, 47000, 51000, 71000, 84852];
  const LB = [-0.0065, 0, 0.001, 0.0028, 0, -0.0028, -0.002];
  function us76(z) {
    z = Math.max(-2000, Math.min(86000, z));
    const r0 = 6356766, h = r0 * z / (r0 + z);            // geopotential altitude
    let T = 288.15, p = 101325;
    if (h < 0) { T = 288.15 - LB[0] * h; p = 101325 * Math.pow(T / 288.15, -G0 / (R * LB[0])); }
    for (let i = 0; i < 7 && h > HB[i]; i++) {
      const top = Math.min(h, HB[i + 1]), dh = top - HB[i], L = LB[i];
      if (L === 0) p *= Math.exp(-G0 * dh / (R * T));
      else { const Tn = T + L * dh; p *= Math.pow(Tn / T, -G0 / (R * L)); T = Tn; }
    }
    const rho = p / (R * T), mu = sutherland(T), a = Math.sqrt(1.4 * R * T);
    const lambda = mu / p * Math.sqrt(PI * R * T / 2);    // mean free path (hard-sphere, Chapman–Enskog form)
    return { z, h, T, p, rho, mu, nu: mu / rho, a, lambda };
  }

  // ============================================================
  // 2. PERFECT-GAS RELATIONS (arbitrary γ)
  // ============================================================
  const isenP = (M, g) => Math.pow(1 + (g - 1) / 2 * M * M, -g / (g - 1));      // p/p0
  const isenT = (M, g) => 1 / (1 + (g - 1) / 2 * M * M);                        // T/T0
  function machFromP(pp0, g) {                                                  // M from p/p0
    if (pp0 >= 1) return 0;
    if (pp0 <= 0) return 60;
    return Math.min(60, Math.sqrt(2 / (g - 1) * (Math.pow(pp0, -(g - 1) / g) - 1)));
  }
  function normalShock(M, g) {
    const M2 = M * M;
    const p2p1 = 1 + 2 * g / (g + 1) * (M2 - 1), r2r1 = (g + 1) * M2 / ((g - 1) * M2 + 2);
    const Mb = Math.sqrt((1 + (g - 1) / 2 * M2) / (g * M2 - (g - 1) / 2));
    const p02p01 = Math.pow(r2r1, g / (g - 1)) * Math.pow((g + 1) / (2 * g * M2 - (g - 1)), 1 / (g - 1));
    return { p2p1, r2r1, T2T1: p2p1 / r2r1, M2: Mb, p02p01 };
  }
  /** Rayleigh pitot: stagnation pressure behind a normal shock over freestream static pressure. */
  function pitot(M, g) {
    if (M <= 1) return 1 / isenP(M, g);
    return Math.pow((g + 1) * (g + 1) * M * M / (4 * g * M * M - 2 * (g - 1)), g / (g - 1)) * (1 - g + 2 * g * M * M) / (g + 1);
  }
  /** Flow deflection θ produced by a shock at wave angle β (θ–β–M relation). */
  const thetaOfBeta = (beta, M, g) => Math.atan(2 / Math.tan(beta) * (M * M * Math.sin(beta) ** 2 - 1) / (M * M * (g + Math.cos(2 * beta)) + 2));
  /** Maximum deflection for an attached shock, and the wave angle at which it occurs. */
  function thetaMax(M, g) {
    let a = Math.asin(1 / M), b = PI / 2;
    const phi = (Math.sqrt(5) - 1) / 2;
    let x1 = b - phi * (b - a), x2 = a + phi * (b - a), f1 = thetaOfBeta(x1, M, g), f2 = thetaOfBeta(x2, M, g);
    for (let i = 0; i < 60; i++) {
      if (f1 < f2) { a = x1; x1 = x2; f1 = f2; x2 = a + phi * (b - a); f2 = thetaOfBeta(x2, M, g); }
      else { b = x2; x2 = x1; f2 = f1; x1 = b - phi * (b - a); f1 = thetaOfBeta(x1, M, g); }
    }
    const beta = 0.5 * (a + b);
    return { theta: thetaOfBeta(beta, M, g), beta };
  }
  /** Weak oblique shock for deflection θ (rad) at Mach M. Returns null when the shock would detach. */
  function obliqueShock(M, theta, g) {
    if (M <= 1) return null;
    if (theta <= 1e-9) return { beta: Math.asin(1 / M), M2: M, p2p1: 1, r2r1: 1, T2T1: 1, p02p01: 1, Mn1: 1 };
    const tm = thetaMax(M, g);
    if (theta > tm.theta) return null;
    let lo = Math.asin(1 / M), hi = tm.beta;
    for (let i = 0; i < 80; i++) { const mid = 0.5 * (lo + hi); if (thetaOfBeta(mid, M, g) < theta) lo = mid; else hi = mid; }
    const beta = 0.5 * (lo + hi), Mn1 = M * Math.sin(beta);
    const ns = normalShock(Mn1, g);
    return { beta, M2: ns.M2 / Math.sin(beta - theta), p2p1: ns.p2p1, r2r1: ns.r2r1, T2T1: ns.T2T1, p02p01: ns.p02p01, Mn1 };
  }
  /** Prandtl–Meyer function ν(M) in radians. */
  function pm(M, g) {
    if (M <= 1) return 0;
    const k = Math.sqrt((g + 1) / (g - 1)), s = Math.sqrt(M * M - 1);
    return k * Math.atan(s / k) - Math.atan(s);
  }
  const pmMax = g => PI / 2 * (Math.sqrt((g + 1) / (g - 1)) - 1);
  function pmInverse(nu, g) {
    if (nu <= 0) return 1;
    if (nu >= pmMax(g)) return Infinity;
    let lo = 1, hi = 200;
    for (let i = 0; i < 80; i++) { const mid = 0.5 * (lo + hi); if (pm(mid, g) < nu) lo = mid; else hi = mid; }
    return 0.5 * (lo + hi);
  }

  // ============================================================
  // 3. GEOMETRY — surfaces, generators, nose radius
  // ============================================================
  /** Split a closed node list (TE→lower→LE→upper→TE) into upper/lower panel lists ordered LE→TE. */
  function surfaces(geo) {
    const n = geo.x.length - 1;
    const iLE = geo.iLE != null ? geo.iLE : (() => { let b = 0; for (let i = 0; i <= n; i++) if (geo.x[i] < geo.x[b]) b = i; return b; })();
    const mk = (i0, i1) => {
      const dx = geo.x[i1] - geo.x[i0], dy = geo.y[i1] - geo.y[i0], len = Math.hypot(dx, dy);
      return { x0: geo.x[i0], y0: geo.y[i0], x1: geo.x[i1], y1: geo.y[i1], xm: 0.5 * (geo.x[i0] + geo.x[i1]), ym: 0.5 * (geo.y[i0] + geo.y[i1]), phi: Math.atan2(dy, dx), len, s: 0 };
    };
    const upper = [], lower = [];
    for (let i = iLE; i < n; i++) { const p = mk(i, i + 1); if (p.len > 1e-12) upper.push(p); }
    for (let i = iLE; i > 0; i--) { const p = mk(i, i - 1); if (p.len > 1e-12) lower.push(p); }
    for (const arr of [upper, lower]) { let s = 0; for (const p of arr) { p.s = s + 0.5 * p.len; s += p.len; } }
    return { upper, lower, iLE };
  }
  /** Build a section from upper/lower polylines (LE→TE, LE at [0,0]), resampled by arc length but keeping every vertex. */
  function polyShape(name, upper, lower, perSide, extra) {
    const resample = poly => {
      let L = 0; for (let i = 1; i < poly.length; i++) L += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      const out = [poly[0].slice()];
      for (let i = 1; i < poly.length; i++) {
        const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
        const k = Math.max(1, Math.round(perSide * l / L));
        for (let j = 1; j <= k; j++) { const f = j / k; out.push([poly[i - 1][0] + f * (poly[i][0] - poly[i - 1][0]), poly[i - 1][1] + f * (poly[i][1] - poly[i - 1][1])]); }
      }
      return out;
    };
    const up = resample(upper), lo = resample(lower);
    const xs = [], ys = [];
    for (let i = lo.length - 1; i >= 0; i--) { xs.push(lo[i][0]); ys.push(lo[i][1]); }
    for (let i = 1; i < up.length; i++) { xs.push(up[i][0]); ys.push(up[i][1]); }
    return Object.assign({ x: xs, y: ys, name, iLE: lo.length - 1, rn: 0 }, extra || {});
  }
  function arcPoints(cx, cy, r, a0, a1, k) { const out = []; for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
  const shapes = {
    flatPlate: (t = 0.01, n = 60) => polyShape(`Flat plate ${(t * 100).toFixed(0)} %`, [[0, 0], [0.5, t / 2], [1, 0]], [[0, 0], [0.5, -t / 2], [1, 0]], n),
    diamond: (tc = 0.1, xm = 0.5, n = 60) => polyShape(`Diamond ${(tc * 100).toFixed(0)} % (ε = ${(Math.atan(tc / 2 / xm) / DEG).toFixed(1)}°)`, [[0, 0], [xm, tc / 2], [1, 0]], [[0, 0], [xm, -tc / 2], [1, 0]], n),
    wedge: (halfDeg = 10, n = 60) => { const h = Math.tan(halfDeg * DEG); return polyShape(`Wedge ${halfDeg}° half-angle`, [[0, 0], [1, h], [1, 0]], [[0, 0], [1, -h], [1, 0]], n); },
    bluntedWedge: (halfDeg = 10, rn = 0.03, n = 60) => {
      const d = halfDeg * DEG, cx = rn;                       // nose circle centred (rn, 0) so the LE sits at x = 0
      const tx = cx - rn * Math.sin(d), ty = rn * Math.cos(d); // tangent point of the upper flank
      const up = arcPoints(cx, 0, rn, PI, PI / 2 + d, 14).concat([[1, ty + (1 - tx) * Math.tan(d)], [1, 0]]);
      const lo = up.map(p => [p[0], -p[1]]);
      return polyShape(`Blunted wedge ${halfDeg}°, r/c = ${(rn * 100).toFixed(1)} %`, up, lo, n, { rn });
    },
    bluntedPlate: (t = 0.03, n = 60) => {
      const rn = t / 2, up = arcPoints(rn, 0, rn, PI, PI / 2, 14).concat([[1, rn], [1, 0]]);
      return polyShape(`Blunted plate ${(t * 100).toFixed(0)} %`, up, up.map(p => [p[0], -p[1]]), n, { rn });
    },
    biconvex: (tc = 0.08, n = 60) => {
      const up = []; for (let i = 0; i <= 40; i++) { const x = i / 40; up.push([x, 2 * tc * x * (1 - x)]); }
      return polyShape(`Biconvex ${(tc * 100).toFixed(0)} %`, up, up.map(p => [p[0], -p[1]]), n);
    },
  };
  /** Leading-edge radius (chord units) from the geometry: NACA formula when thickness is known, else a circle fit. */
  function leRadius(geo) {
    if (geo.rn != null) return geo.rn;
    if (geo.t != null) return 1.1019 * geo.t * geo.t;
    const iLE = geo.iLE != null ? geo.iLE : Math.floor((geo.x.length - 1) / 2), k = 2;
    if (iLE - k < 0 || iLE + k >= geo.x.length) return 0;
    const ax = geo.x[iLE - k], ay = geo.y[iLE - k], bx = geo.x[iLE], by = geo.y[iLE], cx = geo.x[iLE + k], cy = geo.y[iLE + k];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-14) return 0;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return Math.min(0.5, Math.hypot(ax - ux, ay - uy));
  }

  // ============================================================
  // 4. SURFACE PRESSURE — local-inclination methods
  // ============================================================
  /** March one surface. s = +1 upper, −1 lower. Returns per-panel arrays plus wave geometry for drawing. */
  function marchSurface(panels, s, M, g, alpha, method, CpMax) {
    const K = panels.length, q = g * M * M / 2;
    const Cp = new Float64Array(K), pp = new Float64Array(K), Ml = new Float64Array(K), TT = new Float64Array(K);
    const regime = new Array(K), waves = [];
    const p02 = pitot(M, g), T0T = 1 + (g - 1) / 2 * M * M, p0inf = 1 / isenP(M, g);
    const tmInf = thetaMax(M, g).theta;
    let Mloc = M, p0 = p0inf, flowDir = alpha, nose = false, leShock = null;
    const setState = (k, p, Mk, reg) => { pp[k] = p; Cp[k] = (p - 1) / q; Ml[k] = Mk; TT[k] = T0T * isenT(Mk, g); regime[k] = reg; };
    const newtonian = (k, theta) => {          // modified Newtonian on the stagnation streamline (p0 = pitot pressure)
      const cp = theta > 0 ? CpMax * Math.sin(theta) ** 2 : 0;
      const p = 1 + cp * q, Mk = theta > 0 ? machFromP(p / p02, g) : M;
      setState(k, p, Mk, theta > 0 ? 'N' : 'F');
      return Mk;
    };
    // Blunt-nose hand-off: modified Newtonian holds on the subsonic nose; the sonic point is where the Newtonian
    // pressure equals the sonic pressure on the stagnation streamline (p* = p02·(2/(γ+1))^(γ/(γ−1))). Downstream of
    // that exact inclination θ* the surface flow expands isentropically from M = 1 with p0 = p02.
    const pStar = p02 * Math.pow(2 / (g + 1), g / (g - 1));
    const thetaStar = pStar > 1 && CpMax > 0 ? Math.asin(Math.min(1, Math.sqrt((pStar - 1) / (CpMax * q)))) : 0;
    const noseStep = (k, theta) => {
      if (theta > thetaStar) { newtonian(k, theta); return true; }
      p0 = p02; Mloc = expand(k, 1, Math.max(0, thetaStar - theta), p02, 'E');
      return false;
    };
    const expand = (k, Mfrom, dTurn, p0from, reg) => {
      const nu = pm(Mfrom, g) + dTurn;
      if (nu >= pmMax(g)) { setState(k, 0, 60, 'V'); return 60; }
      const M2 = pmInverse(nu, g);
      setState(k, p0from * isenP(M2, g), M2, reg);
      return M2;
    };
    for (let k = 0; k < K; k++) {
      const phi = panels[k].phi, theta = s * (phi - alpha);    // inclination to the freestream, + = windward
      if (method === 'newton' || method === 'newtonClassic') { newtonian(k, theta); }
      else if (method === 'wedge') {                               // tangent-wedge
        if (theta > 1e-9) {
          const os = obliqueShock(M, theta, g);
          if (os) { setState(k, os.p2p1, os.M2, 'S'); if (k === 0) leShock = { attached: true, beta: os.beta }; }
          else { newtonian(k, theta); if (k === 0) leShock = { attached: false }; }
        } else if (theta < -1e-9) { expand(k, M, -theta, p0inf, 'E'); if (k === 0) leShock = { attached: true, beta: Math.asin(1 / M), expansion: true }; }
        else { setState(k, 1, M, 'F'); if (k === 0) leShock = { attached: true, beta: Math.asin(1 / M) }; }
      } else {                                                     // shock-expansion
        const prevDir = k === 0 ? alpha : panels[k - 1].phi;
        const delta = s * (phi - prevDir);                         // turning relative to the upstream flow, + = compression
        if (nose) { nose = noseStep(k, theta); }
        else if (delta > 1e-9) {
          const os = obliqueShock(Mloc, delta, g);
          if (os) {
            Mloc = os.M2; p0 *= os.p02p01; setState(k, p0 * isenP(Mloc, g), Mloc, 'S');
            waves.push({ type: 'shock', x: panels[k].x0, y: panels[k].y0, dir: prevDir + s * os.beta, k });
            if (k === 0) leShock = { attached: true, beta: os.beta };
          } else {                                                 // detached: Newtonian nose regime
            nose = noseStep(k, theta);
            if (k === 0) leShock = { attached: false };
          }
        } else if (delta < -1e-9) {
          const M1 = Mloc;
          Mloc = expand(k, Mloc, -delta, p0, 'E');
          if (-delta > 2 * DEG || k === 0) waves.push({ type: 'fan', x: panels[k].x0, y: panels[k].y0, dir1: prevDir + s * Math.asin(1 / Math.min(M1, 60)), dir2: phi + s * Math.asin(1 / Math.min(Mloc, 60)), k, M1, s: panels[k].s, turn: -delta });
          if (k === 0) leShock = { attached: true, beta: Math.asin(1 / M), expansion: true };
        } else {
          setState(k, p0 * isenP(Mloc, g), Mloc, regime[k - 1] === 'V' ? 'V' : (k === 0 ? 'F' : regime[k - 1]));
          if (k === 0) leShock = { attached: true, beta: Math.asin(1 / M) };
        }
      }
      flowDir = phi;
    }
    // trailing-edge recompression (flow must return towards the freestream direction)
    let teWave = null;
    if (K && method === 'se' && Ml[K - 1] > 1 && regime[K - 1] !== 'V') {
      const dte = s * (alpha - panels[K - 1].phi);
      if (dte > 1e-3) { const os = obliqueShock(Ml[K - 1], dte, g); if (os) teWave = { type: 'shock', x: panels[K - 1].x1, y: panels[K - 1].y1, dir: panels[K - 1].phi + s * os.beta }; }
    }
    if (!leShock) leShock = { attached: s * (panels[0].phi - alpha) <= tmInf, beta: (obliqueShock(M, Math.max(0, s * (panels[0].phi - alpha)), g) || { beta: Math.asin(1 / M) }).beta };
    return { Cp, pp, M: Ml, TT, regime, waves, teWave, leShock };
  }

  // ============================================================
  // 5. VISCOUS — Eckert reference temperature (flat-plate correlations along the surface)
  // ============================================================
  function viscousSurface(panels, inv, atm, chord, g, Tw, blMode, RexTr) {
    const K = panels.length, Pr = 0.71, cp = g * R / (g - 1);
    const Cf = new Float64Array(K), qw = new Float64Array(K), Te = new Float64Array(K), tau = new Float64Array(K), lam = new Array(K);
    let Q = 0, qMax = 0, xqMax = 0;
    for (let k = 0; k < K; k++) {
      const pe = inv.pp[k] * atm.p, Me = inv.M[k], T = inv.TT[k] * atm.T, x = panels[k].s * chord;
      Te[k] = T;
      if (pe <= 0 || Me < 0.02 || x <= 0) { lam[k] = true; continue; }
      const ue = Me * Math.sqrt(g * R * T), rhoe = pe / (R * T), mue = sutherland(T);
      const Rex = rhoe * ue * x / mue;
      const laminar = blMode === 'lam' || (blMode === 'trans' && Rex < RexTr);
      const r = laminar ? Math.sqrt(Pr) : Math.cbrt(Pr);
      const Taw = T * (1 + r * (g - 1) / 2 * Me * Me);
      const Ts = T * (0.5 + 0.5 * Tw / T + 0.22 * r * (g - 1) / 2 * Me * Me);   // Eckert reference temperature
      const rhos = pe / (R * Ts), mus = sutherland(Ts);
      const Res = Math.max(rhos * ue * x / mus, 1);
      const cf = Math.min(0.05, laminar ? 0.664 / Math.sqrt(Res) : 0.0592 / Math.pow(Res, 0.2));
      tau[k] = 0.5 * rhos * ue * ue * cf;
      const St = cf / 2 * Math.pow(Pr, -2 / 3);
      qw[k] = St * rhos * ue * cp * (Taw - Tw);
      Cf[k] = tau[k] / (0.5 * atm.rho * (inv.Vinf * inv.Vinf)); lam[k] = laminar;
      Q += qw[k] * panels[k].len * chord;
      if (qw[k] > qMax && panels[k].s > 0.01) { qMax = qw[k]; xqMax = panels[k].xm; }   // flat-plate correlations are singular at x → 0; the nose is covered by Sutton–Graves
    }
    return { Cf, qw, Te, tau, laminar: lam, Q, qMax, xqMax };
  }

  // ============================================================
  // 6. BLUNT-BODY CORRELATIONS
  // ============================================================
  /** Sutton–Graves stagnation heating, W/m² (sphere); 2D cylinder ≈ 1/√2 of the sphere value. */
  const suttonGraves = (rho, V, Rn) => 1.7415e-4 * Math.sqrt(rho / Rn) * V * V * V;
  /** Billig (1967) bow-shock stand-off and vertex radius for a cylinder, in nose radii. */
  const billig = M => ({ standoff: 0.386 * Math.exp(4.67 / (M * M)), Rc: 1.386 * Math.exp(1.8 / Math.pow(Math.max(M - 1, 0.05), 0.75)) });

  // ============================================================
  // 7. HIGH-LEVEL ANALYSIS
  // ============================================================
  /** cond = { M, altitude, alpha (deg), chord, gamma, Tw, method, bl, RexTr, rnOverride } */
  function analyse(geo, cond) {
    const g = cond.gamma || 1.4, M = cond.M, a = cond.alpha * DEG;
    const atm = us76(cond.altitude || 0), V = M * atm.a, q = 0.5 * atm.rho * V * V, c = cond.chord;
    const surf = surfaces(geo);
    const CpMax = cond.method === 'newtonClassic' ? 2 : (pitot(M, g) - 1) / (g * M * M / 2);
    const method = cond.method || 'se';
    const up = marchSurface(surf.upper, +1, M, g, a, method, CpMax), lo = marchSurface(surf.lower, -1, M, g, a, method, CpMax);
    up.Vinf = lo.Vinf = V;
    const upV = viscousSurface(surf.upper, up, atm, c, g, cond.Tw || 300, cond.bl || 'lam', cond.RexTr || 2e6);
    const loV = viscousSurface(surf.lower, lo, atm, c, g, cond.Tw || 300, cond.bl || 'lam', cond.RexTr || 2e6);
    // integrate pressure and friction forces (per q∞ c)
    let fx = 0, fy = 0, m = 0, ffx = 0, ffy = 0;
    const acc = (panels, inv, vis, s) => {
      for (let k = 0; k < panels.length; k++) {
        const p = panels[k], nx = -s * Math.sin(p.phi), ny = s * Math.cos(p.phi);   // outward normal
        const dfx = -inv.Cp[k] * nx * p.len, dfy = -inv.Cp[k] * ny * p.len;
        const cf = vis.Cf[k], tfx = cf * Math.cos(p.phi) * p.len, tfy = cf * Math.sin(p.phi) * p.len;
        fx += dfx; fy += dfy; ffx += tfx; ffy += tfy;
        m += (p.xm - 0.25) * (dfy + tfy) - p.ym * (dfx + tfx);
      }
    };
    acc(surf.upper, up, upV, +1); acc(surf.lower, lo, loV, -1);
    const ca = Math.cos(a), sa = Math.sin(a);
    const Cl = (fy + ffy) * ca - (fx + ffx) * sa, CdWave = fx * ca + fy * sa, CdF = ffx * ca + ffy * sa, Cd = CdWave + CdF, Cm = -m;
    const rn = cond.rnOverride != null ? cond.rnOverride / c : leRadius(geo);
    const Rn = rn * c;
    const qStag = Rn > 1e-5 ? suttonGraves(atm.rho, V, Rn) / Math.SQRT2 : NaN;
    const T0 = atm.T * (1 + (g - 1) / 2 * M * M);
    const Kn = atm.lambda / c;
    const warnings = [];
    if (T0 > 9000) warnings.push('T₀ > 9000 K: ionisation — perfect-gas results are qualitative only');
    else if (T0 > 4000) warnings.push('T₀ > 4000 K: N₂ dissociation — real T₀ substantially lower than perfect-gas value');
    else if (T0 > 2500) warnings.push('T₀ > 2500 K: O₂ dissociation — lower γ / real-gas effects significant');
    else if (T0 > 800) warnings.push('T₀ > 800 K: vibrational excitation — try γ ≈ 1.3 to mimic');
    if (Kn > 10) warnings.push('Kn > 10: free-molecular flow — continuum methods invalid');
    else if (Kn > 0.1) warnings.push('Kn > 0.1: transitional rarefied flow — results unreliable');
    else if (Kn > 0.01) warnings.push('Kn > 0.01: slip flow — treat viscous results with caution');
    if (M < 1.2) warnings.push('M < 1.2: shock-expansion relations degrade near sonic speed');
    const detached = !up.leShock.attached || !lo.leShock.attached;
    const bs = detached && rn > 0 ? billig(M) : null;
    return { atm, V, q, Re: atm.rho * V * c / atm.mu, Kn, T0, p02: pitot(M, g) * atm.p, CpMax, gamma: g, M, alpha: cond.alpha, chord: c,
      surf, upper: up, lower: lo, upperV: upV, lowerV: loV, Cl, Cd, CdWave, CdF, Cm, LD: Cd > 0 ? Cl / Cd : NaN,
      lift: q * c * Cl, drag: q * c * Cd, rn, Rn, qStag, heat: { Q: upV.Q + loV.Q, qMax: Math.max(upV.qMax, loV.qMax), xqMax: upV.qMax >= loV.qMax ? upV.xqMax : loV.xqMax, upperSide: upV.qMax >= loV.qMax },
      detached, billig: bs, warnings, method };
  }
  function sweep(geo, cond, a0, a1, step) {
    const points = [];
    for (let a = a0; a <= a1 + 1e-9; a += step) points.push(analyse(geo, Object.assign({}, cond, { alpha: a })));
    let best = null; for (const r of points) if (Number.isFinite(r.LD) && (!best || r.LD > best.LD)) best = r;
    return { points, bestLD: best };
  }

  return { us76, sutherland, isenP, isenT, machFromP, normalShock, pitot, thetaOfBeta, thetaMax, obliqueShock, pm, pmMax, pmInverse,
    surfaces, polyShape, shapes, leRadius, marchSurface, viscousSurface, suttonGraves, billig, analyse, sweep };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HT;
