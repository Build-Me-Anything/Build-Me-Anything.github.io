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
from mpmath import mp, mpf

MU = '0.125'      # 1/8
NU = '1.5'        # 3/2
T = '1.0'         # q = 1/2
QN = 30           # modes for the quadratic problem
CN = 25           # modes for CLM


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


def main(outdir='.'):
    os.makedirs(outdir, exist_ok=True)
    for fn in (emit_quadratic, emit_clm):
        path, cert = fn(outdir)
        print('wrote %s   (%s)' % (os.path.basename(path), cert.status))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
