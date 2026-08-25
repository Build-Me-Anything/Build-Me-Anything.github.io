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


def main(outdir='.'):
    os.makedirs(outdir, exist_ok=True)
    for fn in (emit_quadratic, emit_clm, emit_degregorio, emit_burgers, emit_r0, emit_r1a):
        path, cert = fn(outdir)
        print('wrote %s   (%s)' % (os.path.basename(path), cert.status))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
