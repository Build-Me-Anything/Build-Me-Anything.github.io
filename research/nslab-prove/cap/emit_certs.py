"""Run the R1b provers and write their certificates in the frozen contract format.

Parameters are chosen to be **exactly representable in both binary floating point and as rationals** — mu = 1/8,
nu = 3/2, q = 1/2 — so the prover's mpf values and the auditor's Fractions denote the same numbers. With mu = 1/10
they would not: mpf('0.1') is the nearest double, not one tenth, and a disagreement of 1e-40 between prover and
auditor would be a formatting artefact rather than a finding. Removing that ambiguity costs nothing and means any
disagreement the auditor reports is real.

    python emit_certs.py [outdir]
"""
import os
import sys
from fractions import Fraction

from ivutil import setprec, lo, hi
import certificate as C

setprec(45)

import problem_quadratic as PQ
import problem_clm_fourier as CF
import problem_degregorio as DG
import problem_burgers as BG
import problem_eigen as PE
import clm as CLM
from clm import TrigPoly
from krawczyk import UNIQUE, refine
from mpmath import iv as _iv_ctx
from mpmath import mp, mpf

MU = '0.125'      # 1/8
NU = '1.5'        # 3/2
T = '1.0'         # q = 1/2
QN = 30           # modes for the quadratic problem
CN = 25           # modes for CLM
DGN = 7           # De Gregorio Galerkin size - must be ODD (even N is structurally singular)
DGR = Fraction(1, 1000)   # half-width of the verified box
BMU = '2.0'       # Burgers viscosity; Z1 = ||ubar||/mu so this must exceed ||ubar|| ~ 1
BPERT = '0.03125' # 1/32 - exact in binary AND rational, so prover and auditor denote the same number
BN = 12
EIGN = 14         # R4 block size
EIGVB = 2         # eigenvector decay base: v_m = 2^-m
EIGDB = 4         # diagonal decay base:   d_m = 4^-m, so tau(n) = 4^-n -> 0, which IS the compactness
EIGLAM = '1.375'  # 11/8 - dyadic
EIGK = 20         # perturbed mode; MUST exceed EIGN so Y0 is auditable without the preconditioner
EIGCEXP = 26      # perturbation is 2^-EIGCEXP, as an exponent so no decimal string can misrepresent it


def exact(x):
    """An mpf is a dyadic rational - sign * man * 2^exp - so it converts to a Fraction with no loss at all.

    Certificates must carry exact values or the auditor cannot tell a real disagreement from a rounding artefact,
    and rendering to decimal and reparsing would introduce exactly that ambiguity.
    """
    sign, man, expo, _bc = mpf(x)._mpf_
    v = Fraction(man) * (Fraction(2) ** expo)
    return -v if sign else v


def _up(x):
    """Round an mpf upward to a rational, so the certificate's claimed bound is never *smaller* than what the
    prover computed. Certificates carry upper bounds; converting one downward would manufacture a false claim."""
    f = Fraction(str(mp.nstr(x, 30, strip_zeros=False)))
    # nstr rounds to nearest, so nudge up by one unit in the last place quoted
    return f + Fraction(1, 10 ** 28) if f > 0 else f


def emit_quadratic(outdir):
    cert, abar, N, mu_f, nu_f = PQ.prove(N=QN, mu=MU, nu=NU)
    if not cert.proved:
        raise SystemExit('quadratic prover did not close: ' + cert.reason)
    path = os.path.join(outdir, 'certificate-quadratic.json')
    C.write(path,
            problem='quadratic',
            params={'N': QN, 'mu': Fraction(1, 8), 'nu': Fraction(3, 2)},
            abar=C.quadratic_abar(QN, Fraction(1, 8)),
            bounds={'Y0': _up(cert.Y0), 'Z1': _up(cert.Z1), 'Z2': _up(cert.Z2)},
            r=_up(cert.r),
            claim=('A unique solution of a = e_1 + mu*(a*a) exists within r of abar in ell^1_nu. This is a '
                   'statement about that algebraic equation only - not about any PDE.'),
            notes={'exact_solution': 'a_m = Catalan(m-1) * mu^(m-1)'})
    return path, cert


def emit_clm(outdir):
    cert, abar = CF.prove_at(T, nu='1.0', N=CN)
    if not cert.proved:
        raise SystemExit('clm prover did not close: ' + cert.reason)
    path = os.path.join(outdir, 'certificate-clm.json')
    C.write(path,
            problem='clm',
            params={'N': CN, 'q': Fraction(1, 2), 'nu': Fraction(1)},
            abar=C.clm_abar(CN, Fraction(1, 2)),
            bounds={'Y0': _up(cert.Y0), 'Z1': _up(cert.Z1), 'Z2': Fraction(0)},
            r=_up(cert.r),
            claim=('The Constantin-Lax-Majda solution at t = 1 exists, its Fourier series converges in ell^1_nu, '
                   'and it lies within r of abar. A statement about the CLM equation only.'),
            notes={'exact_solution': 'a_{-m} = i^m q^(m-1)', 'blowup_time': 'T = 2 exactly'})
    return path, cert


def emit_degregorio(outdir):
    """R2: a Krawczyk certificate, so the file carries the BOX rather than a contraction radius.

    The auditor recomputes K(X) with its own exact preconditioner and checks strict containment; it does not need
    - and is not given - the prover's Y, because Y affects only whether the test closes, never the truth of what
    it concludes.
    """
    v = DG.verify_galerkin(N=DGN, radius=str(DGR))
    if v.status != UNIQUE:
        raise SystemExit('degregorio prover did not close at N=%d: %s' % (DGN, v.status))
    path = os.path.join(outdir, 'certificate-degregorio.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'degregorio_galerkin',
        'params': {'N': DGN},
        'box': [[str(-DGR), str(DGR)] for _ in range(DGN - 1)],
        'claims_contains_zero': True,
        'claim': ('The phase-fixed De Gregorio Galerkin system of size N has exactly one solution in this box, '
                  'and it is the exact steady state omega = sin x. A theorem about the TRUNCATED system only - '
                  'not about the De Gregorio PDE, which is blocked by derivative loss.'),
        'notes': {'parity': 'N must be odd; even N makes the Galerkin Jacobian singular'},
    }
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(doc, f, indent=2)
    return path, v


def emit_burgers(outdir):
    """R3: preconditioned steady Burgers, exact solution u = sin x."""
    cert, ubar, nu_f = BG.prove(mu=BMU, nu='1.0', N=BN, perturb=['0', BPERT])
    if not cert.proved:
        raise SystemExit('burgers prover did not close: ' + cert.reason)
    path = os.path.join(outdir, 'certificate-burgers.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'burgers',
        'params': {'N': BN, 'mu': str(Fraction(BMU)), 'nu': '1'},
        'ubar_sine': [str(Fraction(1)), str(Fraction(BPERT))] + ['0'] * (BN - 2),
        'bounds': {'Y0': str(_up(cert.Y0)), 'Z1': str(_up(cert.Z1)), 'Z2': str(_up(cert.Z2))},
        'r': str(_up(cert.r)),
        'radii_polynomial': 'p(r) = Z2*r^2 - (1 - Z1)*r + Y0 ;  CLOSED requires p(r) < 0 and Z1 < 1',
        'claim': ('A unique solution of the preconditioned steady Burgers fixed point exists within r of ubar in '
                  'ell^1_nu. A statement about steady viscous Burgers with this forcing, only.'),
        'notes': {'exact_solution': 'u = sin x', 'preconditioner': 'K = (mu d_xx)^-1 o d_x'},
    }
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(doc, f, indent=2)
    return path, cert


def emit_r0(outdir):
    """R0: three root enclosures. Endpoints are carried exactly, since an mpf is a dyadic rational."""
    import json as _json
    from ivutil import ival

    cases = {}

    f = lambda X: [X[0] * X[0] - ival(2)]
    Df = lambda X: [[ival(2) * X[0]]]
    v = refine(f, Df, [ival(1, 2)])
    cases['sqrt2'] = v

    Fs = lambda X: [X[0] * X[0] + X[1] * X[1] - ival(4), X[0] - X[1]]
    DFs = lambda X: [[ival(2) * X[0], ival(2) * X[1]], [ival(1), ival(-1)]]
    cases['system2d'] = refine(Fs, DFs, [ival(1, 2), ival(1, 2)])

    h = lambda X: [_iv_ctx.cos(X[0]) - X[0]]
    Dh = lambda X: [[-_iv_ctx.sin(X[0]) - ival(1)]]
    cases['dottie'] = refine(h, Dh, [ival(0, 1)])

    paths = []
    for case, v in cases.items():
        if not v.proved:
            raise SystemExit('R0 case %s did not close: %s' % (case, v.status))
        path = os.path.join(outdir, 'certificate-r0-%s.json' % case)
        doc = {
            'contract': C.CONTRACT_VERSION,
            'problem': 'r0_enclosure',
            'case': case,
            'box': [[str(exact(b.a)), str(exact(b.b))] for b in v.box],
            'claim': 'The stated function has exactly one zero in this box (Krawczyk), enclosed as given.',
        }
        with open(path, 'w', encoding='utf-8') as fh:
            _json.dump(doc, fh, indent=2)
        paths.append(path)
    return paths[0], cases['sqrt2']


def emit_r1a(outdir):
    """R1a: the CLM blow-up time from the closed form, with its complete zero set.

    The certificate carries the zero enclosures and the resulting T. The auditor must confirm the zeros are real,
    that NONE WAS MISSED, and that T follows - and it does all three by arguments the prover does not use.
    """
    import json as _json
    w = TrigPoly([(1, 1, 0)])                     # omega0 = cos x
    r = CLM.blowup_time(w)
    if r['verdict'] != 'BLOWUP':
        raise SystemExit('R1a prover did not produce a blow-up time: %s' % r.get('reason'))
    path = os.path.join(outdir, 'certificate-r1a-clm.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'clm_blowup_time',
        'omega0': [[1, '1', '0']],                # a_1 = 1, b_1 = 0  ->  cos x
        'zeros': [[str(exact(z.a)), str(exact(z.b))] for z in r['zeros']],
        'T': [str(exact(r['T'].a)), str(exact(r['T'].b))],
        'claim': ('The Constantin-Lax-Majda solution with omega0 = cos x blows up at a time inside this '
                  'enclosure. The exact answer is T = 2. A statement about the CLM equation only.'),
    }
    with open(path, 'w', encoding='utf-8') as fh:
        _json.dump(doc, fh, indent=2)

    class _S:
        status = 'BLOWUP'
    return path, _S()


def emit_eigen(outdir):
    """R4: the compact-operator eigenpair, on the dyadic instance so the auditor can recompute exactly.

    Two choices here are what make this certificate auditable at all, and both are deliberate:

    * **The dyadic instance, not the geometric one.** `problem_eigen.dyadic_instance` picks the eigenvector and
      derives the operator, so every number is a dyadic rational and prover and auditor denote the same values.
      The 1/m² instance the R4 suite headlines cannot do that — see that function's docstring.
    * **The perturbation sits above N.** A is the exact inverse of the finite block on modes ≤ N and −1/λ̄ times
      the identity above it. A residual confined above N is therefore mapped by the closed-form half of A, and Y₀
      becomes reproducible without the preconditioner — exactly the trick `_quadratic_bounds` uses at R1b, where
      F(ā) is supported on modes N+1..2N. Perturb below N and only the prover could ever check its own Y₀.
    """
    cert, T, vbar, lam = PE.prove_dyadic(lam=EIGLAM, nu=NU, N=EIGN, vbase=EIGVB, dbase=EIGDB,
                                         kpert=EIGK, cexp=EIGCEXP)
    if not cert.proved:
        raise SystemExit('eigen prover did not close: ' + cert.reason)
    M = 3 * EIGN
    abar = []
    for m in range(1, M + 1):
        v = Fraction(1, EIGVB ** m)
        if m == EIGK:
            v += Fraction(1, 2 ** EIGCEXP)
        abar.append((v, Fraction(0)))
    path = os.path.join(outdir, 'certificate-r4-eigen.json')
    C.write(path,
            problem='eigen_dyadic',
            params={'N': EIGN, 'M': M, 'nu': Fraction(3, 2), 'lam': Fraction(11, 8),
                    'vbase': EIGVB, 'dbase': EIGDB, 'kpert': EIGK},
            abar=abar,
            bounds={'Y0': _up(cert.Y0), 'Z1': _up(cert.Z1), 'Z2': _up(cert.Z2)},
            r=_up(cert.r),
            claim=('A unique eigenpair (v, lambda) of the compact operator T = D + u<.,w> exists within r of '
                   '(vbar, lambdabar) in ell^1_nu x R, subject to the phase condition <v,w> = 1. A statement '
                   'about this operator only - not about De Gregorio, and not about any PDE.'),
            notes={'operator': 'd_m = dbase^-m, v_m = vbase^-m, u_m = v_m*(lam - d_m), w = {1: vbase}',
                   'exact_eigenpair': 'exact by construction: (Tv)_m = d_m v_m + u_m<v,w> = lam v_m for every m',
                   'why_dyadic': 'so the prover mpf values and the auditor Fractions denote the same numbers',
                   'why_kpert_above_N': 'A = -(1/lam)*I above N, so Y0 is reachable without the preconditioner'})
    return path, cert


def emit_r4b(outdir):
    """R4b: the Gram matrix as certified intervals, for the exact-rational auditor.

    Entries are emitted through `A_entry_enclosure_via_cin` — the Cin form — because that is the representation
    an auditor restricted to fractions/json/math can reach. The Ci form is the derivation; the Cin form is the
    contract. Endpoints are exact rationals, as everywhere else in this directory.
    """
    import problem_dg_profile as DGP
    pairs = [(1, 1), (2, 2), (1, 2), (2, 3), (3, 7), (1, 12), (5, 5), (4, 9)]
    gram = {}
    for (n, m) in pairs:
        e = DGP.A_entry_enclosure_via_cin(n, m)
        gram['%d,%d' % (n, m)] = [str(exact(lo(e))), str(exact(hi(e)))]
    path = os.path.join(outdir, 'certificate-r4b-gram.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'r4b_gram',
        'params': {'basis': 'chi*sin(n*pi*x)', 'inner_product': 'Hdot^{1/2}(R)'},
        'gram': gram,
        'claim': ('Certified enclosures of A_{nm} = <s_n, s_m>_{Hdot^{1/2}(R)} for the Huang-Tong-Wei profile '
                  'operator, via the Cin closed form. A statement about this Gram matrix only - not about the '
                  'spectrum, not about an eigenfunction, and not about the De Gregorio equation.'),
        'notes': {'closed_form': 'A_nn = 2n Si(2n pi); A_nm = -(2nm(-1)^(n+m)/(pi(m^2-n^2)))[Cin(2m pi) - Cin(2n pi)]',
                  'why_cin': 'gamma and log cancel, so an auditor with only fractions/json/math can reach it'},
    }
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(doc, f, indent=2)
    return path, type('V', (), {'status': 'CERTIFIED', 'proved': True})()


def emit_r4b_a2(outdir):
    """R4b Rung 2: A2 = A^T B^-1 A as certified intervals, for the independent auditor."""
    import problem_dg_profile as DGP
    pairs = [(1, 1), (1, 2), (2, 2), (2, 3)]
    a2 = {}
    for (i, j) in pairs:
        e = DGP.A2_enclosure(i, j)
        a2['%d,%d' % (i, j)] = [str(exact(lo(e))), str(exact(hi(e)))]
    path = os.path.join(outdir, 'certificate-r4b-a2.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'r4b_a2',
        'audit_K': 80,
        'a2': a2,
        'claim': ('Certified enclosures of A2_ij = <M s_i, M s_j>_{Hdot1} = sum_k A_ki A_kj/(k pi)^2. A statement '
                  'about this matrix only - not about the spectrum, and not about any PDE.'),
        'notes': {'prover_tail': 'entry asymptotics: |Ci|<=2/x, |A_km| bound, three log-moment integrals',
                  'auditor_tail': 'MUST NOT reuse the above; see R2-AUDIT-CONTRACT.md section 3'},
    }
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(doc, f, indent=2)
    return path, type('V', (), {'status': 'CERTIFIED', 'proved': True})()


_R4B_SHARED = {}


def _r4b_lehmann_data():
    """Build the Rung 3 pencil data once per process; `emit_r4b_lehmann` and `emit_r4b_final` share it.

    Prover-side sharing only: the two certificates must embed the SAME pencil block, and recomputing it would
    double the most expensive emission step for no independence gain — the auditor re-derives all of it from
    the certificate data regardless of how the prover produced it.
    """
    if _R4B_SHARED:
        return _R4B_SHARED
    import problem_dg_profile as DGP
    import lehmann as LEH
    from mpmath import iv as _iv
    K, J, Ksum, target, Kbr = 8, 3, 80, 30, 16
    V = DGP._approx_eigenvectors(K, J)
    A0, A1, A2 = DGP.lehmann_matrices(V, K, Ksum, target)
    Vbr = DGP._approx_eigenvectors(Kbr, J)
    br = DGP.certified_bracket(K=Kbr, J=J)
    L_J = br[J - 1][0]
    U_next = 1 / ((J + 1) * DGP.MPPI)
    if not (U_next < L_J):
        raise SystemExit('r4b lehmann: empty shift window')
    rho = -(U_next + L_J) / 2
    Lm = [[A1[i][j] - _iv.mpf(rho) * A0[i][j] for j in range(J)] for i in range(J)]
    Rm = [[A2[i][j] - _iv.mpf(2 * rho) * A1[i][j] + _iv.mpf(rho ** 2) * A0[i][j] for j in range(J)] for i in range(J)]
    taus = []
    for k in range(1, J + 1):
        b = LEH.bracket_tau(Lm, Rm, J, k, mpf('-1e12'), mpf('-1e-12'))
        if b is None:
            raise SystemExit('r4b lehmann: tau_%d could not be isolated' % k)
        taus.append((exact(b[0]), exact(b[1])))
    rho_x = exact(rho)
    upper = []
    for j in range(1, J + 1):
        a_x, b_x = taus[J - j]                       # tau_{J+1-j} bounds lambda_j
        if not b_x < 0:
            raise SystemExit('r4b lehmann: tau bracket endpoint not negative')
        upper.append(-rho_x - Fraction(1) / b_x)     # the exact sup over the claimed bracket

    def mat(M):
        return [[[str(exact(lo(M[a][b]))), str(exact(hi(M[a][b])))] for b in range(J)] for a in range(J)]

    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'r4b_lehmann',
        'params': {'K': K, 'J': J, 'Ksum': Ksum, 'K_bracket': Kbr},
        'audit_Ksum': 80,
        'rho': str(rho_x),
        'window': [str(exact(U_next)), str(exact(L_J))],
        'V': [[str(exact(c)) for c in row] for row in V],
        'V_bracket': [[str(exact(c)) for c in row] for row in Vbr],
        'matrices': {'A0': mat(A0), 'A1': mat(A1), 'A2': mat(A2)},
        'tau': [[str(a), str(b)] for (a, b) in taus],
        'upper': [str(u) for u in upper],
        'claim': ('Certified Lehmann-Maehly upper bounds on the leading eigenvalues of the Huang-Tong-Wei '
                  'profile operator, via Sylvester inertia counting on the pencil (A1 - rho A0, A2 - 2 rho A1 '
                  '+ rho^2 A0). A statement about the spectrum of M only - not about an eigenfunction, and not '
                  'about any PDE.'),
        'notes': {'prover_route': 'LDL^T pivot counting; vector tail by entry asymptotics (needs Ksum >= 2K)',
                  'auditor_route': 'MUST NOT reuse the above; see R3-AUDIT-CONTRACT.md section 3',
                  'upper_is_exact_sup': '-rho - 1/b over the claimed bracket, in exact rationals'},
    }
    _R4B_SHARED.update(doc=doc, br=br, upper=upper, J=J, Kbr=Kbr, Vbr=Vbr, target=target)
    return _R4B_SHARED


def emit_r4b_lehmann(outdir):
    """R4b Rung 3: the Lehmann pencil — shift, matrices, tau brackets and upper bounds, for the auditor.

    Two emission rules matter here. (i) Every endpoint is carried exactly (an mpf is a dyadic rational), as
    everywhere in this directory. (ii) **The claimed upper bounds are the exact rational sup over the claimed
    tau bracket**, `-rho - 1/b`, not the prover's rounded mpf: `lehmann.upper_bounds` computes `-(rho + 1/b)`
    in round-to-nearest arithmetic, which can understate the certifiable sup by an ulp — the same reason `_up`
    exists. The certificate must claim only what its own data supports, so the sup is recomputed exactly from
    the emitted endpoints.
    """
    d = _r4b_lehmann_data()
    path = os.path.join(outdir, 'certificate-r4b-lehmann.json')
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(d['doc'], f, indent=2)
    return path, type('V', (), {'status': 'CERTIFIED', 'proved': True})()


def _exact_gersh_lower(GA, GB, j):
    """Gershgorin lower bound `lambda_min(G_A)/lambda_max(G_B)` over the leading j-by-j blocks, with the SCAN
    in exact rationals.

    The interval matrices are built by directed mpmath iv arithmetic, so their endpoints are valid dyadic
    bounds; the scan — row sums, min/max, the final quotient — is then done in Fractions with no rounding at
    all, reading the endpoints via `exact(X.a)`/`exact(X.b)` (lossless) rather than `lo()`/`hi()`, whose
    conversion to an ambient-precision mpf rounds to NEAREST and can overstate a lower bound by an ulp. Same
    failure family as the tau -> bound step (AL-008): the certificate must claim only what its data supports.
    """
    gmin = None
    for i in range(j):
        row = exact(GA[i][i].a)
        for k in range(j):
            if k != i:
                row -= max(abs(exact(GA[i][k].a)), abs(exact(GA[i][k].b)))
        gmin = row if gmin is None else min(gmin, row)
    gmax = None
    for i in range(j):
        row = exact(GB[i][i].b)
        for k in range(j):
            if k != i:
                row += max(abs(exact(GB[i][k].a)), abs(exact(GB[i][k].b)))
        gmax = row if gmax is None else max(gmax, row)
    if not (gmin > 0 and gmax > 0):
        raise SystemExit('r4b final: Gershgorin scan could not certify a positive lower bound at j = %d' % j)
    return gmin / gmax


def emit_r4b_final(outdir):
    """R4b Rung 4: the assembled two-sided enclosures `lambda_j in [L_j, U_j]`, self-contained for the auditor.

    The certificate carries the claimed enclosures, the lower-half trial vectors, and the complete pencil block
    of the Rung 3 certificate — the auditor re-derives everything from this one document (R4-AUDIT-CONTRACT.md
    section 1). The lower halves are re-evaluated here with the Gershgorin scan in exact rationals
    (`_exact_gersh_lower`); `certified_bracket`'s own mpf value is kept only as a drift alarm.
    """
    import problem_dg_profile as DGP
    from mpmath import iv as _iv
    d = _r4b_lehmann_data()
    J, Kbr, Vbr, target = d['J'], d['Kbr'], d['Vbr'], d['target']

    dps_saved = _iv.dps
    try:
        _iv.dps = target + 15
        Aiv = [[None] * Kbr for _ in range(Kbr)]
        for n in range(Kbr):
            for m in range(n, Kbr):
                e = DGP.A_entry_enclosure(n + 1, m + 1, target)
                Aiv[n][m] = e
                Aiv[m][n] = e
        Biv = [(_iv.mpf(n) * _iv.pi) ** 2 for n in range(1, Kbr + 1)]
        Viv = [[_iv.mpf(c) for c in vec] for vec in Vbr]        # an mpf is dyadic, so this embedding is exact
        GA = [[None] * J for _ in range(J)]
        GB = [[None] * J for _ in range(J)]
        for a in range(J):
            for b in range(J):
                sa = _iv.mpf(0)
                sb = _iv.mpf(0)
                for p in range(Kbr):
                    for q in range(Kbr):
                        sa = sa + Viv[a][p] * Aiv[p][q] * Viv[b][q]
                    sb = sb + Viv[a][p] * Biv[p] * Viv[b][p]
                GA[a][b] = sa
                GB[a][b] = sb
    finally:
        _iv.dps = dps_saved

    lower = [_exact_gersh_lower(GA, GB, j) for j in range(1, J + 1)]
    for j in range(J):                                           # drift alarm against the prover's own scan
        if abs(float(lower[j]) - float(d['br'][j][0])) > 1e-12:
            raise SystemExit('r4b final: exact Gershgorin scan drifted from certified_bracket at j = %d' % (j + 1))
        if not lower[j] < d['upper'][j]:
            raise SystemExit('r4b final: assembled pair disordered at j = %d' % (j + 1))

    leh = d['doc']
    path = os.path.join(outdir, 'certificate-r4b-final.json')
    doc = {
        'contract': C.CONTRACT_VERSION,
        'problem': 'r4b_final',
        'params': {'J': J, 'K_lower': Kbr},
        'enclosures': [[str(lower[j]), str(d['upper'][j])] for j in range(J)],
        'V_lower': leh['V_bracket'],
        'pencil': {k: leh[k] for k in ('params', 'audit_Ksum', 'rho', 'window', 'V', 'V_bracket',
                                       'matrices', 'tau', 'upper')},
        'claim': ('Certified two-sided enclosures lambda_j in [L_j, U_j] for the leading eigenvalues of the '
                  'Huang-Tong-Wei profile operator: lower halves by Courant-Fischer/Gershgorin on nested trial '
                  'prefixes, upper halves by Lehmann-Maehly. A statement about the spectrum of M only - not '
                  'about an eigenfunction, and not about any PDE.'),
        'notes': {'lower_halves': 'Gershgorin scan in exact rationals over directed-interval matrices; L_j '
                                  'uses the first j rows of V_lower',
                  'upper_halves': 'the exact rational sup -rho - 1/b over the embedded tau brackets',
                  'auditor_route': 'must re-derive both halves and the pairing; see R4-AUDIT-CONTRACT.md'},
    }
    import json as _json
    with open(path, 'w', encoding='utf-8') as f:
        _json.dump(doc, f, indent=2)
    return path, type('V', (), {'status': 'CERTIFIED', 'proved': True})()


def main(outdir='.'):
    os.makedirs(outdir, exist_ok=True)
    for fn in (emit_quadratic, emit_clm, emit_degregorio, emit_burgers, emit_r0, emit_r1a, emit_eigen, emit_r4b, emit_r4b_a2, emit_r4b_lehmann, emit_r4b_final):
        path, cert = fn(outdir)
        print('wrote %s   (%s)' % (os.path.basename(path), cert.status))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
