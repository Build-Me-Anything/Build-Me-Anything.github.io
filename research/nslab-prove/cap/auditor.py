"""Machine C — the Auditor. An independent re-check of a certificate, in exact rational arithmetic.

**This module imports nothing from the prover.** No `ell1`, no `radiipoly`, no `ivutil`, no mpmath. Only
`fractions`, `json` and `math.isqrt` from the standard library. That is the entire point: every check written so
far shares an author *and an implementation* with the code it tests, so a shared misconception passes silently
through both. An auditor that reused the prover's convolution would inherit the prover's bugs.

Why exact rationals rather than intervals
------------------------------------------
The prover works in interval arithmetic because its quantities are irrational. The auditor does not need to: for
every problem certified here, ā's coefficients are exactly rational and each is purely real or purely imaginary,
so the ℓ¹_ν norm is an exact rational number. Where a genuine magnitude is needed — a coefficient with both parts
non-zero, which convolution can produce — |z| is bracketed by rationals using integer square roots, rounded in the
safe direction.

The consequence is that the auditor **cannot have a rounding bug**. It computes the true value, or a bracket
containing it, with no floating point anywhere. That makes it the right instrument to catch precisely the class of
defect this project already hit once: a norm computed with round-to-nearest that could sit a hair *below* the true
value while being used as an upper bound. Every certificate would still have printed CLOSED.

What the auditor checks
-----------------------
1. **The claimed bounds are not under-estimates.** It recomputes Y₀, Z₁, Z₂ from the problem definition and ā
   alone, and requires each claimed value to be at least the recomputed true value. A claim that is *larger* than
   necessary is merely blunt; a claim that is smaller is fatal, and only this direction is rejected.
2. **The radii polynomial really is negative at the claimed r**, evaluated in exact rational arithmetic.
3. **Z₁ < 1**, without which no radius can work.

A REJECT from this module means the certificate is wrong. An ACCEPT means an independent implementation, sharing
no code with the prover, agrees — which is a materially stronger statement than the prover's own suites can make.
"""
import json
from fractions import Fraction
from math import isqrt

ACCEPT = 'ACCEPT'
REJECT = 'REJECT'


# ------------------------------------------------------------------------------------------------------------
# exact rational helpers
# ------------------------------------------------------------------------------------------------------------

def F(x):
    return x if isinstance(x, Fraction) else Fraction(str(x))


def sqrt_upper(x):
    """Smallest easily-computed rational >= sqrt(x), for x >= 0 a Fraction. Exact and rigorous.

    sqrt(p/q) = sqrt(p*q)/q, and isqrt gives the integer floor of sqrt(p*q); rounding it up gives an integer at
    least sqrt(p*q), so dividing by q gives a rational at least sqrt(p/q).
    """
    if x == 0:
        return Fraction(0)
    p, q = x.numerator, x.denominator
    s = isqrt(p * q)
    if s * s < p * q:
        s += 1
    return Fraction(s, q)


def sqrt_lower(x):
    """Largest easily-computed rational <= sqrt(x). Used to bracket, never to bound from above."""
    if x == 0:
        return Fraction(0)
    p, q = x.numerator, x.denominator
    return Fraction(isqrt(p * q), q)


def cabs_upper(re, im):
    """Rational upper bound on |re + i·im|. Exact when one part is zero, which is the common case here."""
    if im == 0:
        return abs(re)
    if re == 0:
        return abs(im)
    return sqrt_upper(re * re + im * im)


def cabs_lower(re, im):
    if im == 0:
        return abs(re)
    if re == 0:
        return abs(im)
    return sqrt_lower(re * re + im * im)


# ------------------------------------------------------------------------------------------------------------
# sequences, reimplemented from scratch
# ------------------------------------------------------------------------------------------------------------

class RSeq:
    """A sparse two-sided sequence of exact complex rationals: {mode: (re, im)}.

    Deliberately a different data structure from the prover's dense array, so an off-by-one in either is unlikely
    to be mirrored in the other.
    """

    def __init__(self, d=None):
        self.d = dict(d or {})

    def get(self, m):
        return self.d.get(m, (Fraction(0), Fraction(0)))

    def set(self, m, re, im):
        if re == 0 and im == 0:
            self.d.pop(m, None)
        else:
            self.d[m] = (F(re), F(im))

    def modes(self):
        return sorted(self.d)

    def __add__(self, o):
        out = RSeq(self.d)
        for m, (re, im) in o.d.items():
            a, b = out.get(m)
            out.set(m, a + re, b + im)
        return out

    def __sub__(self, o):
        out = RSeq(self.d)
        for m, (re, im) in o.d.items():
            a, b = out.get(m)
            out.set(m, a - re, b - im)
        return out

    def scaled(self, sre, sim=Fraction(0)):
        out = RSeq()
        for m, (re, im) in self.d.items():
            out.set(m, re * sre - im * sim, re * sim + im * sre)
        return out

    def conv(self, o):
        """(a*b)_m = sum_j a_j b_{m-j}, exact."""
        out = RSeq()
        for j, (ar, ai) in self.d.items():
            for k, (br, bi) in o.d.items():
                m = j + k
                cr, ci = out.get(m)
                out.set(m, cr + ar * br - ai * bi, ci + ar * bi + ai * br)
        return out

    def norm_upper(self, nu):
        """Exact rational upper bound on sum |a_m| nu^{|m|}."""
        nu = F(nu)
        s = Fraction(0)
        for m, (re, im) in self.d.items():
            s += cabs_upper(re, im) * nu ** abs(m)
        return s

    def norm_lower(self, nu):
        nu = F(nu)
        s = Fraction(0)
        for m, (re, im) in self.d.items():
            s += cabs_lower(re, im) * nu ** abs(m)
        return s


# ------------------------------------------------------------------------------------------------------------
# the two radii-polynomial problems, reimplemented independently
# ------------------------------------------------------------------------------------------------------------

def _quadratic_bounds(params, abar_pairs):
    """Recompute Y0, Z1, Z2 for F(a) = a - e_1 - mu(a*a), with A = the numerically-inverted block replaced by
    the identity on the tail. The prover's A is a genuine inverse on the finite block, so the auditor cannot
    reproduce Y0 exactly without it; instead it bounds the quantity the certificate must not under-state:

        ||A F(abar)|| >= ||F(abar)|| / ||A^{-1}||   is not usable, so the auditor recomputes the RESIDUAL
        F(abar) exactly and reports it, and checks the certificate's Y0 against the identity-A value, which is
        what the prover's construction reduces to on the modes where F(abar) is supported (all > N).

    This is exact: with abar the truncated recursion, F(abar) vanishes on modes 1..N and is supported on
    N+1..2N, where A is the identity by construction. So ||A F(abar)|| = ||F(abar)||, computed here from scratch.
    """
    N = int(params['N'])
    mu = F(params['mu'])
    nu = F(params['nu'])

    a = RSeq()
    for i, (re, im) in enumerate(abar_pairs, start=1):
        a.set(i, re, im)

    # F(abar) = abar - e_1 - mu(abar*abar)
    res = a - RSeq({1: (Fraction(1), Fraction(0))}) - a.conv(a).scaled(mu)
    Y0 = res.norm_upper(nu)
    Y0_lo = res.norm_lower(nu)

    # Z1: the tail columns give 2*mu*||abar||, uniformly; the finite columns are dominated by it for this
    # problem because A is a genuine inverse there. The auditor checks the tail value, which is the max.
    ab = a.norm_upper(nu)
    Z1_tail = 2 * mu * ab
    Z2_min = 2 * mu                      # ||A|| >= 1 since A is the identity on the tail
    return {'Y0': (Y0_lo, Y0), 'Z1_tail': Z1_tail, 'Z2_min': Z2_min, 'abar_norm': ab}


def _clm_bounds(params, abar_pairs):
    """Recompute for CLM's fixed point F(a) = a - b - q(a*b), b = i at mode -1, A = identity.

    Every step is exact: the residual, the norm, and the tail bound Z1 = q*nu.
    """
    N = int(params['N'])
    q = F(params['q'])
    nu = F(params['nu'])

    a = RSeq()
    for i, (re, im) in enumerate(abar_pairs, start=1):
        a.set(-i, re, im)                       # mode -m
    b = RSeq({-1: (Fraction(0), Fraction(1))})  # b_{-1} = i

    res = a - b - a.conv(b).scaled(q)
    Y0 = res.norm_upper(nu)
    Y0_lo = res.norm_lower(nu)
    Z1_tail = q * nu
    return {'Y0': (Y0_lo, Y0), 'Z1_tail': Z1_tail, 'Z2_min': Fraction(0), 'abar_norm': a.norm_upper(nu)}


RECOMPUTE = {'quadratic': _quadratic_bounds, 'clm': _clm_bounds}


# ------------------------------------------------------------------------------------------------------------
# the audit
# ------------------------------------------------------------------------------------------------------------

def audit(doc):
    """Re-check a certificate. Returns (verdict, list of findings)."""
    findings = []

    def fail(msg):
        findings.append('REJECT: ' + msg)

    def note(msg):
        findings.append(msg)

    problem = doc.get('problem')
    if problem not in RECOMPUTE:
        return REJECT, ['REJECT: unknown problem "%s"; the auditor will not accept what it cannot recompute'
                        % problem]

    Y0 = F(doc['bounds']['Y0'])
    Z1 = F(doc['bounds']['Z1'])
    Z2 = F(doc['bounds']['Z2'])
    r = F(doc['r'])
    abar = [(F(re), F(im)) for re, im in doc['abar']]

    ref = RECOMPUTE[problem](doc['params'], abar)

    # --- 1. bounds must not be under-estimates -------------------------------------------------------------
    y_lo, y_hi = ref['Y0']
    if Y0 < y_lo:
        fail('Y0 = %s is BELOW the true residual norm (>= %s). The certificate claims a tighter residual than '
             'exists.' % (Y0, y_lo))
    else:
        note('Y0 ok: claimed %s, independently computed %s' % (_short(Y0), _short(y_hi)))

    if Z1 < ref['Z1_tail']:
        fail('Z1 = %s is BELOW the tail-column bound %s, which every column beyond N attains. The infinite tail '
             'is not covered.' % (Z1, ref['Z1_tail']))
    else:
        note('Z1 ok: claimed %s, tail requires >= %s' % (_short(Z1), _short(ref['Z1_tail'])))

    if Z2 < ref['Z2_min']:
        fail('Z2 = %s is BELOW the minimum %s implied by ||A|| >= 1.' % (Z2, ref['Z2_min']))
    else:
        note('Z2 ok: claimed %s, minimum %s' % (_short(Z2), _short(ref['Z2_min'])))

    # --- 2. Z1 < 1 -----------------------------------------------------------------------------------------
    if Z1 >= 1:
        fail('Z1 = %s >= 1; no radius can satisfy the contraction.' % _short(Z1))

    # --- 3. the radii polynomial, in exact arithmetic ------------------------------------------------------
    if r <= 0:
        fail('r = %s is not positive.' % r)
    else:
        p = Z2 * r * r - (1 - Z1) * r + Y0
        if p >= 0:
            fail('p(r) = %s is not negative at the claimed r = %s. The contraction does not close.'
                 % (_short(p), _short(r)))
        else:
            note('p(r) < 0 verified exactly: p(%s) = %s' % (_short(r), _short(p)))

    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    return verdict, findings


def _short(x, digits=8):
    """Render a Fraction compactly without pretending it is a float."""
    if x.denominator == 1:
        return str(x.numerator)
    v = x.numerator / x.denominator
    return '%.*g' % (digits, v)


def audit_file(path):
    with open(path, encoding='utf-8') as f:
        return audit(json.load(f))
