#!/usr/bin/env python
"""
NSLab GPU batch runner — a CuPy/cuFFT port of pocket-wind-tunnel/src/nslab.js.

Same equations, discretisation and diagnostics as the browser/Node solver (3D incompressible Navier–Stokes on the
periodic [0,2π]³ box, Fourier pseudo-spectral, 2/3 dealiasing, rotational form, exact projection, classical RK4,
RK4-consistent energy/enstrophy budgets, health report), in float64 by default, writing the same JSON as
test/run-ns-long.js so research/nslab/analyse.js reads it unchanged.

    python nslab_gpu.py --N 192 --Re 1600 --tEnd 16 --out "<dir>"          # GPU, float64
    python nslab_gpu.py --N 32 --Re 1600 --tEnd 2 --compare <js final.json>  # validate against the CPU solver
    python nslab_gpu.py --N 192 --bench                                      # timing + memory only
    --cpu (NumPy, no GPU), --fp32 (complex64; exploration only — not for archived evidence), --ic tgv|tgv2d|abc|tubes|random,
    --icp key=val ..., --cfl, --dt (fixed), --snap, --ckpt (checkpoint every n time units; resumes automatically)

Numerical evidence only: nothing computed here proves regularity or blow-up of the Navier–Stokes equations.
"""
import argparse, json, math, os, sys, time, glob
import numpy as np
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
if os.name == 'nt':   # make pip-installed NVIDIA CUDA library wheels (nvidia-*-cu12) visible to CuPy
    try:
        import site
        for sp in set(site.getsitepackages() + [site.getusersitepackages()]):
            for d in glob.glob(os.path.join(sp, 'nvidia', '*', 'bin')): os.add_dll_directory(d)
    except Exception:
        pass
try:
    import cupy as cp
except Exception:  # no GPU / no CuPy
    cp = None

VERSION = '0.1.2'
TWO_PI = 2 * math.pi
IC_INFO = {'tgv': 'Taylor–Green vortex (3D)', 'tgv2d': 'Taylor–Green 2D (exact decay)', 'abc': 'Arnold–Beltrami–Childress (exact decay)',
           'tubes': 'antiparallel vortex tubes', 'random': 'random solenoidal field'}


def mulberry32(seed):
    """Bit-exact port of the JS PRNG so seeded random fields match the browser solver."""
    a = seed & 0xFFFFFFFF
    def imul(x, y): return (x * y) & 0xFFFFFFFF
    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(a ^ (a >> 15), (1 | a) & 0xFFFFFFFF)
        t = ((t + imul(t ^ (t >> 7), (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return rnd


class Solver:
    def __init__(self, N, Re, ic='tgv', icParams=None, cfl=0.4, dt=0.0, xp=None, fp32=False):
        self.xp = xp; self.N = N; self.NH = N // 2 + 1; self.N3 = N ** 3; self.Re = Re; self.nu = 1.0 / Re
        self.cfl = cfl; self.dtFixed = dt; self.ic = ic; self.icParams = icParams or {}
        self.rdt = xp.float32 if fp32 else xp.float64; self.cdt = xp.complex64 if fp32 else xp.complex128
        self.kc = N // 3
        kw = xp.asarray(np.fft.fftfreq(N, 1.0 / N), dtype=self.rdt)          # 0,1,…,N/2-1,-N/2,…,-1
        kx = xp.asarray(np.arange(self.NH), dtype=self.rdt)
        self.KZ = kw.reshape(N, 1, 1); self.KY = kw.reshape(1, N, 1); self.KX = kx.reshape(1, 1, self.NH)
        self.K2 = self.KX ** 2 + self.KY ** 2 + self.KZ ** 2
        self.K2inv = xp.where(self.K2 > 0, 1.0 / xp.where(self.K2 > 0, self.K2, 1), 0).astype(self.rdt)
        kc = self.kc
        self.mask = ((xp.abs(self.KX) <= kc) & (xp.abs(self.KY) <= kc) & (xp.abs(self.KZ) <= kc))
        self.pmask = (self.mask & (self.K2 > 0)).astype(self.rdt)           # projection also zeroes the mean
        self.hw = xp.where((self.KX == 0) | (self.KX == N // 2), 1.0, 2.0).astype(self.rdt)   # Hermitian weights
        self.kmax = math.sqrt(3) * kc
        self.st = dict(t=0.0, step=0, dt=0.0, series={k: [] for k in ['t', 'E', 'Z', 'eps', 'omMax', 'uMax', 'dt', 'ebal', 'zbal', 'Pspec', 'Pal']},
                       maxEbal=0.0, maxZbal=0.0, maxTnl=0.0, divMax=0.0, outputs=[])
        self.last = None
        self.setIC(ic, self.icParams)

    # ---- transforms (JS convention: coefficients of the Fourier series) ----
    def fwd(self, f): return (self.xp.fft.rfftn(f) / self.N3).astype(self.cdt)
    def inv(self, fh): return self.xp.fft.irfftn(fh * self.N3, s=(self.N, self.N, self.N)).astype(self.rdt)

    def project(self, A):
        KX, KY, KZ = self.KX, self.KY, self.KZ
        d = (KX * A[0] + KY * A[1] + KZ * A[2]) * self.K2inv
        return [(A[0] - KX * d) * self.pmask, (A[1] - KY * d) * self.pmask, (A[2] - KZ * d) * self.pmask]

    def curl(self, U):
        KX, KY, KZ = self.KX, self.KY, self.KZ
        return [1j * (KY * U[2] - KZ * U[1]), 1j * (KZ * U[0] - KX * U[2]), 1j * (KX * U[1] - KY * U[0])]

    def norms(self, U):
        xp = self.xp; e = self.hw * (abs(U[0]) ** 2 + abs(U[1]) ** 2 + abs(U[2]) ** 2)
        return dict(E=0.5 * float(xp.sum(e)), Z=0.5 * float(xp.sum(self.K2 * e)), P=0.5 * float(xp.sum(self.K2 ** 2 * e)))

    def rhs(self, U):
        xp = self.xp
        W = self.curl(U)
        u, v, w = self.inv(U[0]), self.inv(U[1]), self.inv(U[2])
        ox, oy, oz = self.inv(W[0]), self.inv(W[1]), self.inv(W[2])
        omMax = math.sqrt(float(xp.max(ox * ox + oy * oy + oz * oz))); uMax = math.sqrt(float(xp.max(u * u + v * v + w * w)))
        nx = v * oz - w * oy; ny = w * ox - u * oz; nz = u * oy - v * ox
        NL = self.project([self.fwd(nx), self.fwd(ny), self.fwd(nz)])
        dot = (U[0].conj() * NL[0] + U[1].conj() * NL[1] + U[2].conj() * NL[2]).real
        e = abs(U[0]) ** 2 + abs(U[1]) ** 2 + abs(U[2]) ** 2
        hw, K2 = self.hw, self.K2
        E = 0.5 * float(xp.sum(hw * e)); Z = 0.5 * float(xp.sum(hw * K2 * e)); Pal = 0.5 * float(xp.sum(hw * K2 * K2 * e))
        Tnl = float(xp.sum(hw * dot)); Pspec = float(xp.sum(hw * K2 * dot))
        self.last = dict(E=E, Z=Z, P=Pal, eps=2 * self.nu * Z, Tnl=Tnl, Pspec=Pspec, omMax=omMax, uMax=uMax)
        return [NL[c] - self.nu * K2 * U[c] for c in range(3)]

    # ---- initial conditions ----
    def setIC(self, kind, prm):
        xp, N = self.xp, self.N; self.ic = kind; self.icParams = prm
        h = TWO_PI / N
        z, y, x = xp.meshgrid(xp.arange(N, dtype=self.rdt) * h, xp.arange(N, dtype=self.rdt) * h, xp.arange(N, dtype=self.rdt) * h, indexing='ij')
        if kind == 'tgv':
            u = xp.sin(x) * xp.cos(y) * xp.cos(z); v = -xp.cos(x) * xp.sin(y) * xp.cos(z); w = xp.zeros_like(u)
        elif kind == 'tgv2d':
            u = xp.sin(x) * xp.cos(y); v = -xp.cos(x) * xp.sin(y); w = xp.zeros_like(u)
        elif kind == 'abc':
            A, B, C = prm.get('A', 1.0), prm.get('B', 1.0), prm.get('C', 1.0)
            u = A * xp.sin(z) + C * xp.cos(y); v = B * xp.sin(x) + A * xp.cos(z); w = C * xp.sin(y) + B * xp.cos(x)
        elif kind == 'tubes':
            amp, sig, d0, de = prm.get('amp', 8.0), prm.get('sigma', 0.4), prm.get('sep', 0.7), prm.get('pert', 0.2)
            d = d0 + de * xp.cos(x); ox = xp.zeros_like(x)
            for sgn in (-1, 1):
                yc = math.pi + sgn * d; zc = math.pi; best = None
                for py in (-1, 0, 1):
                    for pz in (-1, 0, 1):
                        dd = (y - yc + py * TWO_PI) ** 2 + (z - zc + pz * TWO_PI) ** 2
                        best = dd if best is None else xp.minimum(best, dd)
                ox = ox - sgn * amp * xp.exp(-best / (sig * sig))
            W = self.project([self.fwd(ox), self.fwd(xp.zeros_like(ox)), self.fwd(xp.zeros_like(ox))])
            U = self.curl(W); U = [c * self.K2inv for c in U]
            self.S = self.project(U); del z, y, x
            return self.finishIC()
        elif kind == 'random':
            rnd = mulberry32(int(prm.get('seed', 1))); k0 = prm.get('k0', 4.0); E0 = prm.get('E0', 0.5)
            def gauss():
                a = max(rnd(), 1e-12); b = rnd(); return math.sqrt(-2 * math.log(a)) * math.cos(TWO_PI * b)
            NH = self.NH; kwn = np.fft.fftfreq(N, 1.0 / N); kc = self.kc
            S = [np.zeros((N, N, NH), dtype=np.complex128) for _ in range(3)]
            for l in range(N):
                kz = kwn[l]
                if abs(kz) > kc: continue
                for j in range(N):
                    ky = kwn[j]
                    if abs(ky) > kc: continue
                    for i in range(NH):
                        if i > kc: continue
                        k2 = i * i + ky * ky + kz * kz
                        if k2 == 0: continue
                        if i == 0 and (kz < 0 or (kz == 0 and ky < 0)): continue
                        k = math.sqrt(k2); ampl = math.sqrt(k ** 4 * math.exp(-2 * (k / k0) ** 2) / (4 * math.pi * k2))
                        for c in range(3):
                            S[c][l, j, i] = ampl * gauss() + 1j * ampl * gauss()
                        if i == 0:
                            jm, lm = (N - j) % N, (N - l) % N
                            for c in range(3): S[c][lm, jm, 0] = S[c][l, j, 0].conjugate()
            self.S = self.project([xp.asarray(c, dtype=self.cdt) for c in S])
            e = self.norms(self.S)['E']; sc = math.sqrt(E0 / e); self.S = [c * sc for c in self.S]
            return self.finishIC()
        else:
            raise ValueError('unknown initial condition ' + kind)
        self.S = self.project([self.fwd(u), self.fwd(v), self.fwd(w)]); del z, y, x, u, v, w
        return self.finishIC()

    def finishIC(self):
        st = self.st; st['t'] = 0.0; st['step'] = 0
        for k in st['series']: st['series'][k].clear()
        st['outputs'].clear(); st['maxEbal'] = st['maxZbal'] = st['maxTnl'] = st['divMax'] = 0.0
        self.rhs(self.S); st['E0'] = self.last['E']; st['Z0'] = self.last['Z']; self.record(0.0)
        return self.last

    def record(self, dt):
        s, d = self.st['series'], self.last
        s['t'].append(self.st['t']); s['E'].append(d['E']); s['Z'].append(d['Z']); s['eps'].append(d['eps']); s['omMax'].append(d['omMax']); s['uMax'].append(d['uMax']); s['dt'].append(dt); s['Pspec'].append(d['Pspec']); s['Pal'].append(d['P'])

    # ---- time stepping ----
    def chooseDt(self):
        if self.dtFixed > 0: return self.dtFixed
        dx = TWO_PI / self.N; uMax = max(self.last['uMax'], 1e-9)
        return min(self.cfl * dx / uMax, 2.5 / (3 * self.nu * self.kc * self.kc + 1e-30))

    def step(self):
        S = self.S; K = self.rhs(S); d0 = self.last; dt = self.chooseDt(); self.st['dt'] = dt; nu = self.nu
        E0, Z0 = d0['E'], d0['Z']; eps = [d0['eps']]; zr = [d0['Pspec'] - 2 * nu * d0['P']]
        self.st['maxTnl'] = max(self.st['maxTnl'], abs(d0['Tnl']) / max(d0['eps'], 1e-300))
        ACC = [k.copy() for k in K]; T = [S[c] + 0.5 * dt * K[c] for c in range(3)]
        K = self.rhs(T); eps.append(self.last['eps']); zr.append(self.last['Pspec'] - 2 * nu * self.last['P'])
        for c in range(3): ACC[c] += 2 * K[c]; T[c] = S[c] + 0.5 * dt * K[c]
        K = self.rhs(T); eps.append(self.last['eps']); zr.append(self.last['Pspec'] - 2 * nu * self.last['P'])
        for c in range(3): ACC[c] += 2 * K[c]; T[c] = S[c] + dt * K[c]
        K = self.rhs(T); eps.append(self.last['eps']); zr.append(self.last['Pspec'] - 2 * nu * self.last['P'])
        for c in range(3): S[c] += (dt / 6) * (ACC[c] + K[c])
        del ACC, T, K
        self.st['t'] += dt; self.st['step'] += 1
        nn = self.norms(S)
        dEpred = -dt / 6 * (eps[0] + 2 * eps[1] + 2 * eps[2] + eps[3]); dZpred = dt / 6 * (zr[0] + 2 * zr[1] + 2 * zr[2] + zr[3])
        ebal = abs((nn['E'] - E0) - dEpred) / max(self.st['E0'], 1e-300); zbal = abs((nn['Z'] - Z0) - dZpred) / max(nn['Z'], Z0, 1e-300)
        self.st['maxEbal'] = max(self.st['maxEbal'], ebal); self.st['maxZbal'] = max(self.st['maxZbal'], zbal)
        self.rhs(S); self.record(dt); self.st['series']['ebal'].append(ebal); self.st['series']['zbal'].append(zbal)
        return self.last

    def run(self, nSteps, tEnd=None):
        for _ in range(nSteps):
            if tEnd is not None and self.st['t'] >= tEnd - 1e-12: break
            self.step()
        return self.last

    # ---- full diagnostics ----
    def diagnose(self):
        xp, N, S = self.xp, self.N, self.S
        self.rhs(S)
        u, v, w = self.inv(S[0]), self.inv(S[1]), self.inv(S[2]); W = self.curl(S); ox, oy, oz = self.inv(W[0]), self.inv(W[1]), self.inv(W[2])
        o2 = ox * ox + oy * oy + oz * oz; im = self.interpMax(W, o2); del W
        # periodic-image diagnostic (NS-003): enstrophy profile along z (the tube pair's direction of travel) — circular
        # centroid, extent of the region carrying > 1 % of the profile's maximum, and the gap left to its periodic image
        Ez = xp.sum(o2, axis=(1, 2)); Ez = np.asarray(Ez.get() if hasattr(Ez, 'get') else Ez); zg = np.arange(N) * (TWO_PI / N)
        zc = float(math.atan2(float(np.sum(Ez * np.sin(zg))), float(np.sum(Ez * np.cos(zg)))) % TWO_PI)
        on = Ez > 0.01 * Ez.max(); runs = []; start = None
        for i in range(N):
            if on[i] and start is None: start = i
            if not on[i] and start is not None: runs.append((start, i)); start = None
        if start is not None: runs.append((start, N))
        if on[0] and on[-1] and len(runs) > 1: runs = [(runs[-1][0], runs[0][1] + N)] + runs[1:-1]   # wrap-around run
        zExt = (max(r[1] - r[0] for r in runs) if runs else N) * (TWO_PI / N)
        img = dict(zCentroid=zc, zExtent=float(min(zExt, TWO_PI)), imageGap=float(max(TWO_PI - zExt, 0.0)), zBands=len(runs))
        om = [ox, oy, oz]; G2 = xp.zeros_like(u); PST = xp.zeros_like(u); skew3 = 0.0; skew2 = 0.0
        Sc = {}
        for c in range(3):
            gx, gy, gz = self.inv(1j * self.KX * S[c]), self.inv(1j * self.KY * S[c]), self.inv(1j * self.KZ * S[c])
            G2 += gx * gx + gy * gy + gz * gz; PST += om[c] * (ox * gx + oy * gy + oz * gz)
            dg = (gx, gy, gz)[c]; skew3 += float(xp.sum(dg ** 3)); skew2 += float(xp.sum(dg ** 2))
            if c == 0: Sc['xx'] = gx; Sc['xy'] = 0.5 * gy; Sc['xz'] = 0.5 * gz
            elif c == 1: Sc['yy'] = gy; Sc['xy'] += 0.5 * gx; Sc['yz'] = 0.5 * gz
            else: Sc['zz'] = gz; Sc['xz'] += 0.5 * gx; Sc['yz'] += 0.5 * gy
            del gx, gy, gz
        divMax = float(xp.max(xp.abs(Sc['xx'] + Sc['yy'] + Sc['zz'])))
        uL3 = float(xp.mean((u * u + v * v + w * w) ** 1.5)) ** (1.0 / 3.0)   # ‖u‖_{L³} (volume-averaged): the Escauriaza–Seregin–Šverák continuation quantity
        Q = 0.25 * o2 - 0.5 * G2; del G2
        Pphys = float(xp.mean(PST))
        # alignment with strain eigenvectors, in z-slabs to bound temporaries
        bins = 16; hist = np.zeros((3, bins)); asum = np.zeros(3); cnt = 0
        step = max(1, N // 8)
        for z0 in range(0, N, step):
            sl = slice(z0, z0 + step)
            a, b, c_, d, e, f = Sc['xx'][sl], Sc['yy'][sl], Sc['zz'][sl], Sc['xy'][sl], Sc['xz'][sl], Sc['yz'][sl]
            p1 = d * d + e * e + f * f
            q = (a + b + c_) / 3; p2 = (a - q) ** 2 + (b - q) ** 2 + (c_ - q) ** 2 + 2 * p1; p = xp.sqrt(p2 / 6); pz = p > 1e-30
            ps = xp.where(pz, p, 1.0)
            A_, B_, C_, D_, E_, F_ = (a - q) / ps, (b - q) / ps, (c_ - q) / ps, d / ps, e / ps, f / ps
            r = 0.5 * (A_ * (B_ * C_ - F_ * F_) - D_ * (D_ * C_ - F_ * E_) + E_ * (D_ * F_ - B_ * E_)); r = xp.clip(r, -1, 1)
            phi = xp.arccos(r) / 3
            l1 = q + 2 * p * xp.cos(phi); l3 = q + 2 * p * xp.cos(phi + 2 * math.pi / 3)
            def vec(lam):
                r0 = (a - lam, d, e); r1 = (d, b - lam, f); r2 = (e, f, c_ - lam)
                def cr(x_, y_): return (x_[1] * y_[2] - x_[2] * y_[1], x_[2] * y_[0] - x_[0] * y_[2], x_[0] * y_[1] - x_[1] * y_[0])
                c01, c02, c12 = cr(r0, r1), cr(r0, r2), cr(r1, r2)
                n01 = c01[0] ** 2 + c01[1] ** 2 + c01[2] ** 2; n02 = c02[0] ** 2 + c02[1] ** 2 + c02[2] ** 2; n12 = c12[0] ** 2 + c12[1] ** 2 + c12[2] ** 2
                use02 = (n02 > n01) & (n02 >= n12); use12 = (n12 > n01) & (n12 > n02)
                comp = [xp.where(use12, c12[i], xp.where(use02, c02[i], c01[i])) for i in range(3)]
                nn = xp.sqrt(comp[0] ** 2 + comp[1] ** 2 + comp[2] ** 2); nn = xp.where(nn > 0, nn, 1.0)
                return [ci / nn for ci in comp]
            e1 = vec(l1); e3 = vec(l3)
            e2 = [e3[1] * e1[2] - e3[2] * e1[1], e3[2] * e1[0] - e3[0] * e1[2], e3[0] * e1[1] - e3[1] * e1[0]]
            wx, wy, wz = ox[sl], oy[sl], oz[sl]; o2s = o2[sl]; valid = (o2s > 1e-20) & pz
            io = 1.0 / xp.sqrt(xp.where(o2s > 1e-20, o2s, 1.0))
            for k, ev in enumerate((e1, e2, e3)):
                cs = xp.abs((wx * ev[0] + wy * ev[1] + wz * ev[2]) * io)[valid]
                if cs.size:
                    asum[k] += float(xp.sum(cs)); h, _ = xp.histogram(xp.clip(cs, 0, 1 - 1e-9), bins=bins, range=(0.0, 1.0)); hist[k] += np.asarray(h.get() if hasattr(h, 'get') else h)
            cnt += int(valid.sum())
        del Sc
        self.st['divMax'] = max(self.st['divMax'], divMax)
        d = self.last; nu = self.nu
        eta = (nu ** 3 / max(d['eps'], 1e-300)) ** 0.25
        lam = math.sqrt(10 * nu * d['E'] / max(d['eps'], 1e-300)); Rel = math.sqrt(2 * d['E'] / 3) * lam / nu
        out = dict(t=self.st['t'], step=self.st['step'], E=d['E'], Z=d['Z'], P=d['P'], eps=d['eps'], omMax=d['omMax'], omMaxI=im['omMaxI'], omMaxIpos=im['omMaxIpos'], uMax=d['uMax'], Pspec=d['Pspec'], Pphys=Pphys, Tnl=d['Tnl'],
                   skew=(skew3 / 3) / (skew2 / 3) ** 1.5 if skew2 > 0 else 0.0, skewIso=-(6 * math.sqrt(15) / 7) * d['Pspec'] / max(2 * d['Z'], 1e-300) ** 1.5,
                   divMax=divMax, eta=eta, kmaxEta=self.kmax * eta, Rel=Rel, **{'lambda': lam},
                   align=(asum / max(cnt, 1)).tolist(), alignHist=(hist / max(cnt, 1)).tolist(), spectrum=self.spectrum(), uL3=uL3, **img)
        out['pileUp'] = self.pileUp(out['spectrum'])
        self.st['outputs'].append(out)
        self.fields = dict(u=u, v=v, w=w, omx=ox, omy=oy, omz=oz, q=Q, stretch=PST, vort=xp.sqrt(o2))
        return out

    def interpMax(self, W=None, o2=None, top=16, iters=20):
        """Spectrally interpolated maximum of |ω| (added for NS-003). The grid maximum samples the band-limited field the
        solver actually represents at the nodes only and underestimates its continuous maximum by O(Δx²); here the
        trigonometric interpolant ω(x) = Re Σ_k hw_k ω̂_k e^{ik·x} (exact for that field), its gradient and its Hessian
        are evaluated at arbitrary x by staged contractions (O(N³) each) and |ω|² is maximised by a safeguarded Newton
        ascent started from the `top` largest grid nodes. Returns the interpolated maximum, its position and the grid
        maximum of the node it started from."""
        xp, N, NH = self.xp, self.N, self.NH; h = TWO_PI / N
        if W is None: W = self.curl(self.S)
        if o2 is None:
            ox, oy, oz = self.inv(W[0]), self.inv(W[1]), self.inv(W[2]); o2 = ox * ox + oy * oy + oz * oz; del ox, oy, oz
        flat = o2.ravel(); n = int(flat.size)
        # start from the largest LOCAL maxima of the grid field (>= its 6 neighbours), not the largest values: the top values
        # cluster on one node-aligned structure while the continuous maximum can sit between nodes that rank far lower
        lm = xp.ones(o2.shape, dtype=bool)
        for ax in range(3):
            for sh in (1, -1): lm &= o2 >= xp.roll(o2, sh, axis=ax)
        cand = xp.flatnonzero(lm.ravel())
        if int(cand.size) == 0: cand = xp.arange(n)
        k = min(top, int(cand.size)); cv = flat[cand]
        sel = cand[xp.argpartition(cv, -k)[-k:]] if k < int(cand.size) else cand
        kv = min(top, n); selv = xp.argpartition(flat, -kv)[-kv:]          # …and the largest values themselves, which may not be local maxima of the sampled field
        sel = xp.unique(xp.concatenate([sel, selv])); sel = sel[xp.argsort(flat[sel])][::-1]
        idx = [int(i) for i in (sel.get() if hasattr(sel, 'get') else sel)]
        vals = [float(flat[i]) for i in idx]
        kxv = xp.arange(NH, dtype=self.rdt); kyv = xp.asarray(np.fft.fftfreq(N, 1.0 / N), dtype=self.rdt); kzv = kyv
        hw1 = xp.where((kxv == 0) | (kxv == N // 2), 1.0, 2.0).astype(self.cdt)
        Wm = [c.reshape(N * N, NH) for c in W]
        def tensors(x):
            ex = xp.exp(1j * kxv * x[0]) * hw1; ey = xp.exp(1j * kyv * x[1]); ez = xp.exp(1j * kzv * x[2])
            Ex = xp.stack([ex, 1j * kxv * ex, -(kxv ** 2) * ex], axis=1).astype(self.cdt)
            Ey = xp.stack([ey, 1j * kyv * ey, -(kyv ** 2) * ey], axis=1).astype(self.cdt)
            Ez = xp.stack([ez, 1j * kzv * ez, -(kzv ** 2) * ez], axis=1).astype(self.cdt)
            out = []
            for c in range(3):
                A = (Wm[c] @ Ex).reshape(N, N, 3)                 # [kz, ky, a]  a = x-derivative order
                B = xp.einsum('zya,yb->zab', A, Ey)               # [kz, a, b]
                C = xp.einsum('zab,zc->abc', B, Ez).real           # [a, b, c]
                out.append(np.asarray(C.get() if hasattr(C, 'get') else C))
            return out
        def fgh(x):
            f = 0.0; g = np.zeros(3); H = np.zeros((3, 3))
            for T in tensors(x):
                w = T[0, 0, 0]; gw = np.array([T[1, 0, 0], T[0, 1, 0], T[0, 0, 1]])
                Hw = np.array([[T[2, 0, 0], T[1, 1, 0], T[1, 0, 1]], [T[1, 1, 0], T[0, 2, 0], T[0, 1, 1]], [T[1, 0, 1], T[0, 1, 1], T[0, 0, 2]]])
                f += w * w; g += 2 * w * gw; H += 2 * (np.outer(gw, gw) + w * Hw)
            return f, g, H
        best = None
        for i, f0 in zip(idx, vals):
            iz, iy, ix = np.unravel_index(i, (N, N, N)); x = np.array([ix * h, iy * h, iz * h], dtype=float)
            f, g, H = fgh(x)
            for _ in range(iters):
                try: step = -np.linalg.solve(H, g)
                except np.linalg.LinAlgError: step = g * h * h
                if float(g @ step) <= 0: step = g / max(float(np.linalg.norm(g)), 1e-300) * (0.25 * h)   # not an ascent direction: gradient step
                n = float(np.linalg.norm(step))
                if n > h: step *= h / n; n = h
                fn, gn, Hn = fgh(x + step)
                while fn < f and n > 1e-9 * h: step *= 0.5; n *= 0.5; fn, gn, Hn = fgh(x + step)
                if fn < f: break
                x, f, g, H = x + step, fn, gn, Hn
                if n < 1e-7 * h: break
            if best is None or f > best[0]: best = (f, x, f0)
        return dict(omMaxI=math.sqrt(max(best[0], 0.0)), omMaxIpos=[float(v % TWO_PI) for v in best[1]], omMaxNode=math.sqrt(max(best[2], 0.0)))

    def pileUp(self, spec):
        """max E(k)/E(0.8·kc) over the top of the spectrum: > 1 means energy is accumulating at the dealiasing cutoff
        (the truncation bottleneck), which the E(kc)/E(peak) tail check can miss."""
        kc = self.kc; k8 = int(round(0.8 * kc)); peak = max(spec[1:]) if len(spec) > 1 else 0.0
        if not (spec[k8] > 1e-20 * peak): return None
        return max(spec[k] / spec[k8] for k in range(k8, kc + 1))

    def spectrum(self):
        xp = self.xp; nb = int(math.ceil(math.sqrt(3) * self.kc)) + 2
        S = self.S; e = 0.5 * self.hw * (abs(S[0]) ** 2 + abs(S[1]) ** 2 + abs(S[2]) ** 2)
        kmag = xp.rint(xp.sqrt(self.K2)).astype(xp.int64)
        m = self.mask & (kmag < nb)
        Ek = xp.bincount(kmag[m].ravel(), weights=e[m].ravel().astype(xp.float64), minlength=nb)
        return [float(v) for v in (Ek.get() if hasattr(Ek, 'get') else Ek)]

    def slice(self, kind, axis, index):
        F = self.fields; N = self.N; idx = max(0, min(N - 1, int(index)))
        if kind == 'speed': arr = self.xp.sqrt(F['u'] ** 2 + F['v'] ** 2 + F['w'] ** 2)
        elif kind == 'ke': arr = 0.5 * (F['u'] ** 2 + F['v'] ** 2 + F['w'] ** 2)
        else: arr = F[kind]
        s = arr[idx, :, :] if axis == 'z' else arr[:, idx, :] if axis == 'y' else arr[:, :, idx]
        s = s.get() if hasattr(s, 'get') else s
        return np.ascontiguousarray(s, dtype=np.float32)

    def exactError(self):
        xp, N, prm = self.xp, self.N, self.icParams; h = TWO_PI / N; t = self.st['t']; nu = self.nu
        z, y, x = xp.meshgrid(xp.arange(N, dtype=self.rdt) * h, xp.arange(N, dtype=self.rdt) * h, xp.arange(N, dtype=self.rdt) * h, indexing='ij')
        u, v, w = self.inv(self.S[0]), self.inv(self.S[1]), self.inv(self.S[2])
        if self.ic == 'tgv2d':
            f = math.exp(-2 * nu * t); ue, ve, we = xp.sin(x) * xp.cos(y) * f, -xp.cos(x) * xp.sin(y) * f, xp.zeros_like(u)
        elif self.ic == 'abc':
            A, B, C = prm.get('A', 1.0), prm.get('B', 1.0), prm.get('C', 1.0); f = math.exp(-nu * t)
            ue, ve, we = (A * xp.sin(z) + C * xp.cos(y)) * f, (B * xp.sin(x) + A * xp.cos(z)) * f, (C * xp.sin(y) + B * xp.cos(x)) * f
        else: return None
        err = max(float(xp.max(xp.abs(u - ue))), float(xp.max(xp.abs(v - ve))), float(xp.max(xp.abs(w - we))))
        ref = max(float(xp.max(xp.abs(ue))), float(xp.max(xp.abs(ve))), float(xp.max(xp.abs(we))))
        return dict(linf=err, rel=err / max(ref, 1e-300))

    def health(self, study=None):
        d = self.last; st = self.st; nu = self.nu; o = st['outputs'][-1] if st['outputs'] else None
        eta = (nu ** 3 / max(d['eps'], 1e-300)) ** 0.25; ke = self.kmax * eta
        spec = o['spectrum'] if o else self.spectrum(); kp = int(np.argmax(spec[1:]) + 1) if len(spec) > 1 else 0
        tail = spec[self.kc] / max(spec[kp], 1e-300)
        cflNow = d['uMax'] * st['dt'] / (TWO_PI / self.N)
        def grade(v, good, warn, lower=True):
            return ('PASS' if v <= good else 'WARN' if v <= warn else 'FAIL') if lower else ('PASS' if v >= good else 'WARN' if v >= warn else 'FAIL')
        sv = (abs(o['Pspec'] - o['Pphys']) / max(abs(o['Pspec']), 2 * nu * o['P'], 1e-300)) if o else None
        rows = [['grid', f'{self.N}³ (kmax {self.kc}, dealiased 2/3)', ''], ['Δt', f"{st['dt']:.3e}" + (' fixed' if self.dtFixed else ' adaptive'), ''],
                ['CFL (u_max Δt/Δx)', f'{cflNow:.3f}', grade(cflNow, 0.8, 1.2)], ['divergence L∞', f"{st['divMax']:.2e}", grade(st['divMax'], 1e-10, 1e-6)],
                ['nonlinear energy transfer |T|/ε', f"{st['maxTnl']:.2e}", grade(st['maxTnl'], 1e-9, 1e-6)],
                ['energy budget residual (RK4-consistent)', f"{st['maxEbal']:.2e}", grade(st['maxEbal'], 1e-5, 1e-3)],
                ['enstrophy budget residual', f"{st['maxZbal']:.2e}", grade(st['maxZbal'], 1e-4, 1e-2)],
                ['resolution kmax·η', f'{ke:.2f}', grade(ke, 1.0, 0.5, False)], ['spectral tail E(kmax)/E(peak)', f'{tail:.2e}', grade(tail, 1e-4, 1e-2)],
                ['stretching: spectral vs physical', f'{sv:.2e}' if o else '—', grade(sv, 1e-2, 1e-1) if o else ''],
                ['cutoff pile-up E(k)/E(0.8kmax)', f"{o['pileUp']:.2f}" if o and o.get('pileUp') else '—', grade(o['pileUp'], 1.2, 2.0) if o and o.get('pileUp') else ''],
                ['‖u‖_L³ (ESS criterion)', f"{o['uL3']:.5f}" if o and o.get('uL3') is not None else '—', ''],
                ['max |ω|', f"{d['omMax']:.4f}", ''], ['enstrophy Z', f"{d['Z']:.5f}", ''], ['stretching ⟨ω·S·ω⟩', f"{d['Pspec']:.5f}", ''], ['dissipation ε = 2νZ', f"{d['eps']:.4e}", ''],
                ['grid convergence', 'not run', 'N/A'], ['time-step convergence', 'not run', 'N/A']]
        worstEnd = 'FAIL' if any(r[2] == 'FAIL' for r in rows) else 'WARN' if any(r[2] == 'WARN' for r in rows) else 'PASS'
        # worst instant over the archived snapshots (NS-003): the event itself can be the least healthy part of a run whose
        # last snapshot passes; the verdict carries the worst snapshot, the end-of-run verdict is kept alongside
        snaps = st['outputs']; inst = []
        if snaps:
            oKe = min(snaps, key=lambda q: q['kmaxEta']); inst.append(['worst instant: kmax·η', f"{oKe['kmaxEta']:.2f} at t {oKe['t']:.2f}", grade(oKe['kmaxEta'], 1.0, 0.5, False)])
            def tl(q): sp = q['spectrum']; kp = int(np.argmax(sp[1:]) + 1) if len(sp) > 1 else 0; return sp[self.kc] / max(sp[kp], 1e-300)
            oT = max(snaps, key=tl); inst.append(['worst instant: spectral tail', f'{tl(oT):.2e} at t {oT["t"]:.2f}', grade(tl(oT), 1e-4, 1e-2)])
            def sd(q): return abs(q['Pspec'] - q['Pphys']) / max(abs(q['Pspec']), 2 * nu * q['P'], 1e-300)
            oS = max(snaps, key=sd); inst.append(['worst instant: stretching spectral vs physical', f'{sd(oS):.2e} at t {oS["t"]:.2f}', grade(sd(oS), 1e-2, 1e-1)])
            ps = [q for q in snaps if q.get('pileUp')]
            if ps:
                oP = max(ps, key=lambda q: q['pileUp']); inst.append(['worst instant: cutoff pile-up', f"{oP['pileUp']:.2f} at t {oP['t']:.2f}", grade(oP['pileUp'], 1.2, 2.0)])
        rows += inst
        worst = 'FAIL' if any(r[2] == 'FAIL' for r in rows) else 'WARN' if any(r[2] == 'WARN' for r in rows) else 'PASS'
        return dict(rows=rows, worst=worst, worstEnd=worstEnd, note='A run that does not PASS resolution, budgets and refinement cannot support any claim about the equations. Numerical growth ≠ mathematical singularity. The verdict includes the worst archived snapshot; worstEnd is the end-of-run verdict alone.')


# ============================================================ CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--N', type=int, default=64); ap.add_argument('--Re', type=float, default=1600); ap.add_argument('--ic', default='tgv'); ap.add_argument('--icp', nargs='*', default=[])
    ap.add_argument('--cfl', type=float, default=0.4); ap.add_argument('--dt', type=float, default=0.0); ap.add_argument('--tEnd', type=float, default=10)
    ap.add_argument('--snap', type=float, default=0.5); ap.add_argument('--ckpt', type=float, default=2); ap.add_argument('--out', default=None)
    ap.add_argument('--cpu', action='store_true'); ap.add_argument('--fp32', action='store_true'); ap.add_argument('--bench', action='store_true'); ap.add_argument('--compare', default=None)
    a = ap.parse_args()
    xp = np if (a.cpu or cp is None) else cp
    device = 'cpu/numpy' if xp is np else cp.cuda.runtime.getDeviceProperties(0)['name'].decode()
    prm = {}
    for kv in a.icp:
        k, v = kv.split('='); prm[k] = float(v)
    out = a.out or os.path.join(os.path.dirname(__file__), '..', '..', 'research', 'nslab', f'{a.ic}-Re{int(a.Re)}-N{a.N}-gpu')
    os.makedirs(os.path.join(out, 'slices'), exist_ok=True)
    def log(s):
        line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {s}"; print(line, flush=True)
        with open(os.path.join(out, 'run.log'), 'a', encoding='utf-8') as f: f.write(line + '\n')
    bpath = os.path.join(os.path.dirname(__file__), '..', 'build.js'); build = {}
    try:
        import re as _re; m = _re.search(r"APP_VERSION = '([^']+)'", open(bpath, encoding='utf-8').read()); build = {'version': m.group(1)} if m else {}
    except Exception: pass
    log(f"NSLab GPU {VERSION} (app {build.get('version', '?')}) — {a.ic} N={a.N}³ Re={a.Re:g} tEnd={a.tEnd} cfl={a.cfl} dt={a.dt or 'adaptive'} snap={a.snap} ckpt={a.ckpt}  device {device}  {'float32' if a.fp32 else 'float64'}")
    t0 = time.time()
    s = Solver(a.N, a.Re, a.ic, prm, a.cfl, a.dt, xp, a.fp32)
    if xp is not np: cp.cuda.Device().synchronize()
    def devmem():
        if xp is np: return 0.0
        free, total = cp.cuda.runtime.memGetInfo(); return (total - free) / 1e9
    mem = devmem()
    log(f"solver ready in {time.time() - t0:.1f} s, device memory {mem:.2f} GB, kc {s.kc}, E0 {s.st['E0']}, Z0 {s.st['Z0']}")
    if a.bench:
        s.run(1)
        if xp is not np: cp.cuda.Device().synchronize()
        tb = time.time(); s.run(5)
        if xp is not np: cp.cuda.Device().synchronize()
        ms = (time.time() - tb) / 5 * 1000; td = time.time(); s.diagnose()
        if xp is not np: cp.cuda.Device().synchronize()
        mem = devmem()
        log(f"bench: {ms:.0f} ms/step, diagnose {1000 * (time.time() - td):.0f} ms, dt {s.st['dt']:.3e} → ~{round(a.tEnd / s.st['dt'])} steps ≈ {a.tEnd / s.st['dt'] * ms / 3600e3:.2f} h, peak device memory {mem:.2f} GB")
        return
    if a.compare:
        ref = json.load(open(a.compare, encoding='utf-8')); rs = ref['series']; tEnd = ref['t']
        while s.st['t'] < tEnd - 1e-9 and s.st['step'] < len(rs['t']) - 1: s.step()
        n = min(len(rs['t']), len(s.st['series']['t'])); worst = {}
        for k in ['t', 'E', 'Z', 'eps', 'omMax', 'Pspec']:
            w = 0.0; scale = max(abs(v) for v in rs[k][:n]) or 1.0
            for i in range(n):
                r = rs[k][i]; g = s.st['series'][k][i]; w = max(w, abs(g - r) / scale)
            worst[k] = w
        d = s.diagnose(); h = s.health()
        log(f"compare vs {os.path.basename(a.compare)} over {n} steps: max rel diff " + ' '.join(f'{k} {v:.2e}' for k, v in worst.items()) + f"; final E {s.last['E']:.12g} (ref {rs['E'][n - 1]:.12g}); Pspec {d['Pspec']:.6e} Pphys {d['Pphys']:.6e}; divMax {d['divMax']:.1e}; ebal {s.st['maxEbal']:.1e}; health {h['worst']}")
        ex = s.exactError()
        if ex: log(f"exact-solution L∞ error {ex['linf']:.2e}")
        return
    # ---- resume ----
    ckNpz, ckJson = os.path.join(out, 'checkpoint.npz'), os.path.join(out, 'checkpoint.json'); outs = []; nextSnap = a.snap; nextCkpt = a.ckpt; elapsedBefore = 0.0
    if os.path.exists(ckNpz) and os.path.exists(ckJson):
        meta = json.load(open(ckJson, encoding='utf-8'))
        if meta['N'] == a.N and meta['Re'] == a.Re and meta['ic'] == a.ic:
            with np.load(ckNpz) as z: s.S = [xp.asarray(z[f'S{c}'], dtype=s.cdt) for c in range(3)]   # close the file: an open NpzFile makes the next os.replace fail on Windows
            for k in ['t', 'step', 'series', 'maxEbal', 'maxZbal', 'maxTnl', 'divMax', 'E0', 'Z0']: s.st[k] = meta[k]
            outs = meta['outs']; nextSnap = meta['nextSnap']; nextCkpt = meta['nextCkpt']; elapsedBefore = meta.get('elapsed', 0.0); s.st['outputs'] = list(outs)   # a copy: diagnose() appends to st['outputs'] and snapshot() to outs — aliasing duplicated every snapshot after a resume
            s.st['peakTrack'] = meta.get('peakTrack', []); s.st['peakGrid'] = meta.get('peakGrid', 0.0)
            s.rhs(s.S); log(f"resumed from checkpoint at t={meta['t']:.4f} step {meta['step']} ({len(outs)} snapshots)")
    def health(): h = s.health(); return dict(worst=h['worst'], worstEnd=h['worstEnd'], rows=h['rows'], note=h['note'])
    def writePartial(final):
        j = dict(instrument='Pocket Wind Tunnel NSLab ' + VERSION + ' (GPU/CuPy)', build=build, device=device, precision='float32' if a.fp32 else 'float64',
                 case=dict(ic=a.ic, N=a.N, Re=a.Re, nu=1 / a.Re, cfl=a.cfl, tEnd=a.tEnd, snapEvery=a.snap, icParams=prm), t=s.st['t'], steps=s.st['step'], elapsed_s=elapsedBefore + time.time() - t0,
                 series=s.st['series'], snapshots=outs, peakTrack=s.st.get('peakTrack', []), health=health(), final=bool(final), disclaimer='Numerical evidence only; nothing here proves regularity or blow-up of the Navier–Stokes equations.')
        json.dump(j, open(os.path.join(out, 'final.json' if final else 'partial.json'), 'w', encoding='utf-8'))
    def snapshot():
        d = s.diagnose(); outs.append(d); tag = f"{d['t']:.2f}".replace('.', 'p')
        for kind in ['vort', 'q', 'stretch']:
            for axis, idx in [('z', 0), ('z', a.N // 4), ('x', a.N // 4), ('x', a.N // 2)]:   # x = π added for NS-003: the tubes' closest approach, where the reconnection bridge lives
                s.slice(kind, axis, idx).tofile(os.path.join(out, 'slices', f't{tag}_{kind}_{axis}{idx}.f32'))
        s.fields = None; writePartial(False)
        h = health(); done = s.st['t'] / a.tEnd; el = elapsedBefore + time.time() - t0
        log(f"t {d['t']:.3f} step {s.st['step']} dt {s.st['dt']:.2e}  E {d['E']:.6f} Z {d['Z']:.4f} ε {d['eps']:.6f} max|ω| {d['omMax']:.3f} (interp {d['omMaxI']:.3f}) ⟨ωSω⟩ {d['Pspec']:.4f} (phys {d['Pphys']:.4f}) kmaxη {d['kmaxEta']:.2f} S {d['skewIso']:.3f} align {'/'.join(f'{v:.2f}' for v in d['align'])} zgap {d['imageGap']:.2f}  health {h['worst']} (end {h['worstEnd']})  ebal {s.st['maxEbal']:.1e} zbal {s.st['maxZbal']:.1e}  {el / 3600:.2f} h, ETA {(el / max(done, 1e-6)) * (1 - done) / 3600:.2f} h")
    def checkpoint():
        np.savez(ckNpz + '.tmp.npz', **{f'S{c}': (s.S[c].get() if hasattr(s.S[c], 'get') else s.S[c]) for c in range(3)})
        os.replace(ckNpz + '.tmp.npz', ckNpz)
        json.dump(dict(N=a.N, Re=a.Re, ic=a.ic, t=s.st['t'], step=s.st['step'], series=s.st['series'], outs=outs, peakTrack=s.st.get('peakTrack', []), peakGrid=s.st.get('peakGrid', 0.0),nextSnap=nextSnap, nextCkpt=nextCkpt, maxEbal=s.st['maxEbal'], maxZbal=s.st['maxZbal'], maxTnl=s.st['maxTnl'], divMax=s.st['divMax'], E0=s.st['E0'], Z0=s.st['Z0'], elapsed=elapsedBefore + time.time() - t0), open(ckJson, 'w', encoding='utf-8'))
        log(f"checkpoint written at t={s.st['t']:.4f}")
    if s.st['step'] == 0: snapshot()
    s.st.setdefault('peakTrack', []); s.st.setdefault('peakGrid', 0.0)
    while s.st['t'] < a.tEnd - 1e-12:
        s.step()
        if s.last['omMax'] > 1.02 * s.st['peakGrid']:   # running grid peak: interpolate the maximum at every new record that exceeds the last one by 2 % (≈ 150 firings per run at most; firing on every record made 256³ 7× slower during the laminar rise), so the peak instant is covered to ±2 % (NS-003)
            s.st['peakGrid'] = s.last['omMax']; im = s.interpMax(top=8, iters=12)
            s.st['peakTrack'].append(dict(t=s.st['t'], step=s.st['step'], omMax=s.last['omMax'], omMaxI=im['omMaxI'], pos=im['omMaxIpos']))
        if s.st['t'] >= nextSnap - 1e-9: nextSnap += a.snap; snapshot()
        if s.st['t'] >= nextCkpt - 1e-9: nextCkpt += a.ckpt; checkpoint()
    if not outs or outs[-1]['t'] < s.st['t'] - 1e-9: snapshot()
    writePartial(True)
    ser = s.st['series']; ip = int(np.argmax(ser['eps'])); io = int(np.argmax(ser['omMax']))
    pt = s.st.get('peakTrack', []) + [dict(t=o['t'], omMaxI=o['omMaxI']) for o in outs if 'omMaxI' in o]; pI = max(pt, key=lambda p: p['omMaxI']) if pt else None
    log(f"DONE: ε_max {ser['eps'][ip]:.6f} at t {ser['t'][ip]:.3f}; max|ω| peak {ser['omMax'][io]:.3f} at t {ser['t'][io]:.3f}; interpolated peak {pI['omMaxI'] if pI else float('nan'):.3f} at t {pI['t'] if pI else float('nan'):.3f}; E({a.tEnd:g}) {ser['E'][-1]:.6f}; health {health()['worst']}; {(elapsedBefore + time.time() - t0) / 3600:.2f} h")


if __name__ == '__main__':
    main()
