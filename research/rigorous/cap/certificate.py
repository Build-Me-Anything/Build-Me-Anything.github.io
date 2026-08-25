"""The frozen contract, made real: emit a certificate an independent auditor can re-check.

The architecture document specifies `certificate.json` as the interface between Machine B (the Verifier) and
Machine C (the Auditor). Until now it existed only as a paragraph. This module writes it.

The design rule that matters
----------------------------
Everything the auditor needs must be in the file **as exact rational numbers**, not as decimal approximations of
mpmath values. If the certificate carried `"0.1"` the auditor would have to decide what that meant, and its answer
would differ from the prover's in the last bits — so a genuine disagreement and a formatting artefact would look
identical. Carrying `"1/10"` removes the question: the auditor recomputes from the same exact inputs by a
different route, and any disagreement is real.

For the same reason ā is emitted as exact rationals rather than read back out of the interval objects. The
approximate solution is Machine A's output and its exact value is known by construction — the recursion that
produced it is rational — so there is no reason to round-trip it through floating point.

What a certificate does NOT contain
-----------------------------------
Any part of the prover's reasoning. The auditor must be able to reach the same verdict from the problem
definition, ā, and the claimed bounds alone. If it needed the prover's intermediate quantities it would be
checking arithmetic, not checking the claim.
"""
import json
from fractions import Fraction

CONTRACT_VERSION = '1.0'


def frac(x):
    """Coerce to an exact Fraction. Accepts int, Fraction, or a string like '1/10' or '0.1'."""
    if isinstance(x, Fraction):
        return x
    if isinstance(x, int):
        return Fraction(x)
    return Fraction(str(x))


def _fs(x):
    return str(frac(x))


def write(path, problem, params, abar, bounds, r, claim, notes=None):
    """Write a certificate.

    problem : short identifier the auditor dispatches on ('quadratic', 'clm')
    params  : dict of exact rational parameters (N is an int)
    abar    : list of (re, im) exact rationals, indexed as the problem defines
    bounds  : dict with Y0, Z1, Z2 as upper bounds (rationals)
    r       : the radius at which p(r) < 0 was verified
    claim   : the theorem, in prose, including what it is NOT about
    """
    doc = {
        'contract': CONTRACT_VERSION,
        'problem': problem,
        'params': {k: (v if isinstance(v, int) else _fs(v)) for k, v in params.items()},
        'abar': [[_fs(re), _fs(im)] for re, im in abar],
        'bounds': {k: _fs(v) for k, v in bounds.items()},
        'r': _fs(r),
        'radii_polynomial': 'p(r) = Z2*r^2 - (1 - Z1)*r + Y0 ;  CLOSED requires p(r) < 0 and Z1 < 1',
        'claim': claim,
        'notes': notes or {},
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=2)
    return doc


def read(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ------------------------------------------------------------------------------------------------------------
# exact rational reconstructions of the two radii-polynomial problems' approximate solutions
# ------------------------------------------------------------------------------------------------------------

def catalan(n):
    """C_n = (2n)! / (n! (n+1)!), exactly, by the product formula - integers throughout."""
    c = 1
    for k in range(n):
        c = c * 2 * (2 * k + 1) // (k + 2)
    return c


def quadratic_abar(N, mu):
    """ā for F(a) = a - e_1 - mu(a*a): a_m = C_{m-1} mu^{m-1}, exactly rational.

    Indexed m = 1..N, returned as (re, im) pairs. Every entry is real.
    """
    mu = frac(mu)
    return [(catalan(m - 1) * mu ** (m - 1), Fraction(0)) for m in range(1, N + 1)]


def clm_abar(N, q):
    """ā for CLM's fixed point with omega0 = cos x: a_{-m} = i^m q^{m-1}, exactly rational.

    Returned as (re, im) pairs for m = 1..N, meaning the coefficient at Fourier mode -m. i^m cycles
    i, -1, -i, 1, so every entry is purely real or purely imaginary and no irrational ever appears.
    """
    q = frac(q)
    out = []
    for m in range(1, N + 1):
        p = q ** (m - 1)
        cyc = (m - 1) % 4
        if cyc == 0:
            out.append((Fraction(0), p))       # i
        elif cyc == 1:
            out.append((-p, Fraction(0)))      # -1
        elif cyc == 2:
            out.append((Fraction(0), -p))      # -i
        else:
            out.append((p, Fraction(0)))       # 1
    return out
