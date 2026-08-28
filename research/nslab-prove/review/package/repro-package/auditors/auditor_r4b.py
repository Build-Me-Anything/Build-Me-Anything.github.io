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

# Endpoints are rounded outward to a multiple of 2^-PREC_BITS after every operation.
#
# THE PRECISION MUST SCALE WITH x, AND A FIXED VALUE IS WRONG. This was found the hard way (AUDIT-LOG AL-004).
# With PREC_BITS fixed at 512, entries were exact to 5e-41 up to k ≈ 40, degraded at k = 50, and at k = 60
# returned an interval of width 1e7 around a true value of 0.043 — a vacuous enclosure, not a wrong one, but
# useless and initially mistaken for a tail-bound failure.
#
# The mechanism: the Si/Cin series for x = 2kπ has terms peaking near e^x, about 1e163 at k = 60. In
# `term = term * ratio(k)` the *absolute* rounding error of `ratio` (about 2^-PREC) is multiplied by the term's
# magnitude, so the accumulated width is roughly (max term) x 2^-PREC. Fixed absolute rounding is therefore
# catastrophic precisely where the cancellation is largest.
#
# So the grid is sized from x: enough bits to cover e^x, plus the target digits, plus margin for accumulation.
PREC_BITS = 512
_SCALE = 1 << PREC_BITS


def set_precision_for(x_hi, target_digits=45, margin_bits=96):
    """Size the rounding grid for a series argument up to `x_hi`. Returns the bits chosen.

    e^x needs x/ln 2 bits before any target digits survive; the rest is the target and an allowance for
    accumulation over the ~2x terms the series takes. Deterministic in `x_hi`, so a run is reproducible.
    """
    global PREC_BITS, _SCALE, _PI
    need = int(float(x_hi) / math.log(2)) + int(target_digits * 3.33) + margin_bits
    need = max(512, need)
    if need == PREC_BITS and _PI is not None:
        return PREC_BITS          # idempotent: same grid, keep the deterministic cache (repeat audits reuse it)
    PREC_BITS = need
    _SCALE = 1 << PREC_BITS
    _CACHE.clear()
    # pi must be recomputed too, and with enough Machin terms. Leaving the cached pi in place was half of AL-004:
    # the grid grew while pi stayed at its original ~170 digits, so pi silently became the limiting factor and the
    # symptom looked like a tail-bound failure rather than a constant that had not been re-derived.
    _PI = None
    return PREC_BITS


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
    """pi as a rational interval, with the Machin term count sized to the current grid.

    arctan(1/5) gains about 2*log10(5) = 1.4 digits per term, so D digits needs ~D/1.4 terms; PREC_BITS/3 + 60 is
    comfortably above that at every precision used here.
    """
    global _PI
    if _PI is None:
        p = pi_interval(PREC_BITS // 3 + 60)
        _PI = RI(p.lo, p.hi)
    return _PI


def _at_2npi(n, which, tol):
    key = (n, which)
    if key not in _CACHE:
        x = RI(2 * n) * pi_ri()
        xhi = float(x.hi) + 1e-9
        _CACHE[key] = si(x, xhi, tol) if which == 'si' else cin(x, xhi, tol)
    return _CACHE[key]


VACUOUS_WIDTH = Fraction(1, 1000)


def A_entry(n, m, tol=Fraction(1, 10 ** 40)):
    """A_{nm} by Lemma 1′ — the Cin form, so no γ and no logarithm are needed anywhere.

    REFUSES a vacuous enclosure. An interval of width 1e7 around a value of 0.04 is sound and useless, and
    returning it silently is how AL-004 was nearly read as a tail-bound failure instead of a precision failure.
    """
    n, m = int(n), int(m)
    if n == m:
        out = RI(2 * n) * _at_2npi(n, 'si', tol)
    else:
        inner = _at_2npi(m, 'cin', tol) - _at_2npi(n, 'cin', tol)
        sgn = -1 if (n + m) % 2 else 1
        out = -(RI(2 * n * m * sgn) / (pi_ri() * RI(m * m - n * n)) * inner)
    if out.width() > VACUOUS_WIDTH:
        raise ValueError('A_%d,%d enclosure has width %.3g at PREC_BITS=%d — sound but vacuous; raise the '
                         'precision with set_precision_for() rather than accepting it'
                         % (n, m, float(out.width()), PREC_BITS))
    return out


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
