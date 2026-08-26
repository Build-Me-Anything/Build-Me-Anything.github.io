"""Machine C for R4b — the Gram matrix re-derived in exact rationals, with no special functions available.

**Imports `fractions`, `json` and `math`, plus `auditor_r01` for π. Nothing else** — no mpmath, no `sici`, no
`problem_dg_profile`; a structural test asserts it. This is the auditor for the tightest result in the line, which
until now was also its least independently checked.

Why this could not be written before
------------------------------------
The prover reaches the Gram matrix through `Ci`, and `Ci(x) = γ + ln x − Cin(x)` needs the Euler–Mascheroni
constant and a logarithm. An auditor restricted to `fractions`/`json`/`math` can supply neither. Lemma 1′ of the
statement document removes both: in the entry's bracket the `γ` cancels between the two `Ci` terms and the `ln`
cancels against the leading `ln(m/n)`, leaving

    A_{nn} = 2n·Si(2nπ),
    A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ Cin(2mπ) − Cin(2nπ) ],      n ≠ m,

and `Si`, `Cin` are **entire**, with pure alternating power series. So the whole matrix needs π and two convergent
series. π comes from `auditor_r01.pi_interval` — Machin's formula, self-contained, and already the auditor's own.

What makes this an audit rather than a re-run
---------------------------------------------
* **Different representation.** The prover evaluates `Ci`; this evaluates `Cin`. Their agreement is a check on the
  cancellation, not a repetition of it.
* **Different arithmetic.** The prover uses mpmath interval floats with directed rounding. This uses rational
  endpoints, rounded **outward to a fixed dyadic denominator** so numerators stay bounded — rounding that only
  ever widens, so it cannot make an enclosure wrong, only blunter.
* **Different constants.** π by Machin's arctan series with a proved alternating remainder, not `iv.pi`.

Only one direction is fatal. If the prover's interval and this one are disjoint, one of them is wrong. If this one
is wider and contains the prover's, that is agreement — the auditor being blunter is expected and costs nothing.

**A failure to reproduce is a result, not something to tune.**
"""
import json
import math
from fractions import Fraction

from auditor_r01 import pi_interval

ACCEPT = 'ACCEPT'
REJECT = 'REJECT'

# Endpoints are rounded outward to a multiple of 2^-PREC_BITS after every operation. The series for Si(2nπ) has
# terms peaking near e^x/√(2πx) — about 3e20 at n = 8 — so roughly 70 digits vanish to cancellation before the
# answer appears. 512 bits ≈ 154 digits leaves ample margin, and keeps every integer small enough to be fast.
PREC_BITS = 512
_SCALE = 1 << PREC_BITS


def _floor_q(x):
    return Fraction(math.floor(x * _SCALE), _SCALE)


def _ceil_q(x):
    return Fraction(-math.floor(-x * _SCALE), _SCALE)


class RI:
    """[lo, hi] with Fraction endpoints, rounded OUTWARD to 2^-PREC_BITS. Widening only; never narrowing."""

    __slots__ = ('lo', 'hi')

    def __init__(self, lo, hi=None, raw=False):
        lo = Fraction(lo)
        hi = lo if hi is None else Fraction(hi)
        if lo > hi:
            lo, hi = hi, lo
        self.lo, self.hi = (lo, hi) if raw else (_floor_q(lo), _ceil_q(hi))

    def __add__(self, o):
        o = _ri(o)
        return RI(self.lo + o.lo, self.hi + o.hi)

    def __sub__(self, o):
        o = _ri(o)
        return RI(self.lo - o.hi, self.hi - o.lo)

    def __neg__(self):
        return RI(-self.hi, -self.lo)

    def __mul__(self, o):
        o = _ri(o)
        p = (self.lo * o.lo, self.lo * o.hi, self.hi * o.lo, self.hi * o.hi)
        return RI(min(p), max(p))

    def __truediv__(self, o):
        o = _ri(o)
        if o.lo <= 0 <= o.hi:
            raise ZeroDivisionError('interval divisor straddles zero; the auditor refuses rather than guessing')
        p = (self.lo / o.lo, self.lo / o.hi, self.hi / o.lo, self.hi / o.hi)
        return RI(min(p), max(p))

    __rmul__ = __mul__
    __radd__ = __add__

    def mag(self):
        return max(abs(self.lo), abs(self.hi))

    def width(self):
        return self.hi - self.lo

    def contains(self, x):
        return self.lo <= Fraction(x) <= self.hi

    def overlaps(self, o):
        return self.lo <= o.hi and o.lo <= self.hi

    def __repr__(self):
        return '[%.17g, %.17g]' % (self.lo, self.hi)


def _ri(x):
    return x if isinstance(x, RI) else RI(x)


# ------------------------------------------------------------------------------------------------------------
# the two entire series, with the Leibniz remainder and its hypothesis checked
# ------------------------------------------------------------------------------------------------------------

def _alternating(first, ratio, need, tol, max_terms=4000):
    """Sum an alternating series and pad by the first omitted term.

    Refuses in both directions the prover refuses in: before the terms are provably decreasing (`need`), and when
    the first omitted term is still above `tol`, where the Leibniz bound would be sound but vacuous.
    """
    total = RI(0)
    term = first
    sign = 1
    k = 0
    while k < max_terms:
        total = total + (term if sign > 0 else -term)
        term = term * ratio(k)
        sign = -sign
        k += 1
        if need(k) and term.mag() <= tol:
            break
    else:
        raise ValueError('series did not converge to tol within %d terms' % max_terms)
    if not need(k):
        raise ValueError('terms not provably decreasing at k=%d; Leibniz does not apply' % k)
    pad = term.mag()
    return RI(total.lo - pad, total.hi + pad)


def si(x, xhi, tol):
    """Si(x) = Σ (−1)^k x^{2k+1}/((2k+1)(2k+1)!).  `xhi` is a float upper bound on x, for the hypothesis 2k+3 > x."""
    x2 = x * x
    ratio = lambda k: x2 * RI(2 * k + 1) / RI((2 * k + 2) * (2 * k + 3) ** 2)
    return _alternating(x, ratio, lambda k: (2 * k + 3) > xhi, tol)


def cin(x, xhi, tol):
    """Cin(x) = Σ_{k≥1} (−1)^{k+1} x^{2k}/(2k(2k)!).  Hypothesis 2k+2 > x."""
    x2 = x * x
    first = x2 / RI(4)
    ratio = lambda j: x2 * RI(2 * (j + 1)) / RI((2 * (j + 1) + 1) * (2 * (j + 1) + 2) ** 2)
    return _alternating(first, ratio, lambda j: (2 * (j + 1) + 2) > xhi, tol)


_PI = None
_CACHE = {}


def pi_ri():
    global _PI
    if _PI is None:
        p = pi_interval(120)
        _PI = RI(p.lo, p.hi)
    return _PI


def _at_2npi(n, which, tol):
    key = (n, which)
    if key not in _CACHE:
        x = RI(2 * n) * pi_ri()
        xhi = float(x.hi) + 1e-9
        _CACHE[key] = si(x, xhi, tol) if which == 'si' else cin(x, xhi, tol)
    return _CACHE[key]


def A_entry(n, m, tol=Fraction(1, 10 ** 40)):
    """A_{nm} by Lemma 1′ — the Cin form, so no γ and no logarithm are needed anywhere."""
    n, m = int(n), int(m)
    if n == m:
        return RI(2 * n) * _at_2npi(n, 'si', tol)
    inner = _at_2npi(m, 'cin', tol) - _at_2npi(n, 'cin', tol)
    sgn = -1 if (n + m) % 2 else 1
    return -(RI(2 * n * m * sgn) / (pi_ri() * RI(m * m - n * n)) * inner)


# ------------------------------------------------------------------------------------------------------------
# the audit
# ------------------------------------------------------------------------------------------------------------

def audit_entries(claimed, tol=Fraction(1, 10 ** 40)):
    """Re-derive each claimed Gram entry and check consistency.

    `claimed` maps (n, m) -> (lo, hi) as exact rationals, the prover's certified interval. Returns
    (verdict, findings). Disjoint intervals are the fatal case; the auditor being wider is expected.
    """
    findings = []
    bad = False
    for (n, m), (clo, chi) in sorted(claimed.items()):
        mine = A_entry(n, m, tol)
        theirs = RI(Fraction(clo), Fraction(chi), raw=True)
        if not mine.overlaps(theirs):
            bad = True
            findings.append('REJECT: A_%d,%d disjoint — auditor %s, prover [%.17g, %.17g]'
                            % (n, m, mine, float(theirs.lo), float(theirs.hi)))
        else:
            findings.append('A_%d,%d ok — auditor width %.3g, prover width %.3g'
                            % (n, m, float(mine.width()), float(theirs.width())))
    return (REJECT if bad else ACCEPT), findings


def audit_file(path):
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    return audit_doc(doc)


def audit_doc(doc):
    if doc.get('problem') != 'r4b_gram':
        return REJECT, ['REJECT: unknown problem %r; the auditor will not accept what it cannot recompute'
                        % doc.get('problem')]
    claimed = {(int(k.split(',')[0]), int(k.split(',')[1])): v for k, v in doc['gram'].items()}
    return audit_entries(claimed)
