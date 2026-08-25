"""Rigorous enclosures of the sine and cosine integrals, by convergent series with a proved remainder.

This is the first of the two pieces R4b's certificate needs. `problem_dg_profile.A_entry` reduced the matrix
entries `A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}` to closed forms in `Si(2nπ)` and `Ci(2nπ)`, which removed an improper
oscillatory integral from the certification path. What replaced it is this: bracket `Si` and `Ci` at those points.

Why the *convergent* series and not the asymptotic one
------------------------------------------------------
At `x = 2nπ` the standard auxiliary-function form collapses beautifully — `Si(2nπ) = π/2 − f(2nπ)` and
`Ci(2nπ) = −g(2nπ)`, because `cos 2nπ = 1` and `sin 2nπ = 0` — and it is tempting. But `f` and `g` are given by
**divergent** asymptotic expansions whose rigorous remainder theory is a citation exercise, and this project has
already been caught once asserting a method the literature does not use. The Maclaurin series below converge for
every `x`, and their remainder is the Leibniz bound: elementary, self-contained, and provable in a paragraph.

The cost is cancellation, and it is paid in precision rather than in rigour. The largest term of the series for
`Si(x)` is of order `e^x/√(2πx)`, so at `x = 2·24·π ≈ 150.8` intermediate terms reach ~1e65 while the answer is
~1.57. That is not a difficulty for interval arithmetic — it is *visible* in the width of the result — it simply
means the working precision must exceed the cancellation. `_working_dps` sizes it from `x` rather than hoping.

The series, and the remainder
-----------------------------
    Si(x)  = Σ_{k≥0} (−1)^k a_k,      a_k = x^{2k+1} / ((2k+1)·(2k+1)!)
    Cin(x) = Σ_{k≥1} (−1)^{k+1} b_k,  b_k = x^{2k} / (2k·(2k)!)
    Ci(x)  = γ + ln x − Cin(x)

Both are alternating with positive terms, so **once the terms are decreasing** the truncation error is bounded by
the first omitted term. The condition is elementary rather than asymptotic:

    a_{k+1}/a_k = x²(2k+1) / ((2k+2)(2k+3)²) < x²(2k+2) / ((2k+2)(2k+3)²) = (x/(2k+3))²

so **`2k+3 > x` forces `a_{k+1} < a_k`**, and since `2k+3` grows with `k` it stays forced for every larger `k`.
Likewise `b_{k+1}/b_k < (x/(2k+2))²`, so `2k+2 > x` suffices there. Both functions therefore refuse to return a
bound until they have summed past that index — `_enclose` raises rather than quietly applying Leibniz where its
hypothesis does not hold, on the same principle as `Verdict` not being a boolean.

What is taken on trust
----------------------
`iv.pi`, `iv.euler` and `iv.log` — mpmath's own directed-rounding enclosures of π, the Euler–Mascheroni constant
and the logarithm. Everything else here is built from them by interval arithmetic. That dependency is stated
rather than hidden: an auditor re-deriving these results in exact rationals would have to supply its own π and γ
with proved remainders, exactly as `auditor_r01.py` already does for π, sin and cos. **That auditor does not exist
yet, so nothing in this module is independently checked.**

Numerical evidence only until a certificate closes; nothing here proves anything about Navier–Stokes.
"""
import math

from mpmath import iv, mp, mpf

__all__ = ['si', 'ci', 'si_at_2npi', 'ci_at_2npi', 'working_dps']


def working_dps(x, target=30):
    """Decimal digits needed so the series' internal cancellation does not eat the answer.

    The largest term is ~e^x/√(2πx), so log10 of it is ~x/ln 10. Carrying that many digits *plus* the target
    leaves the target intact. The margin of 20 covers the accumulated rounding of a few hundred interval
    operations, which is far more than they use.
    """
    return int(float(x) / math.log(10)) + target + 20


def _enclose(x, terms, first, ratio, need_index, tol=None, max_terms=200000):
    """Sum an alternating series in interval arithmetic and bound the tail by the first omitted term.

    `first`   : the k = start term, as an interval
    `ratio`   : callable k -> the interval factor taking term k to term k+1
    `need_index`: callable k -> True once the Leibniz hypothesis is established from index k onward

    Raises ValueError rather than returning a bound whose hypothesis has not been met. A bound that assumes
    monotonicity it has not checked is not a weaker bound, it is a false one.
    """
    tol = tol if tol is not None else mpf(10) ** (-(mp.dps - 10))
    total = iv.mpf(0)
    term = first
    sign = 1
    k = 0
    # Summing a FIXED number of terms is wrong for large x and was a real defect: the terms peak near k ~ x/2 at
    # magnitude ~e^x, so a count adequate at x = 150 leaves the first omitted term at ~1e21 when x = 1000. The
    # Leibniz padding was still SOUND - the enclosure honestly contained the answer - but its width was 1e21,
    # which is useless rather than wrong. Caught by A2_enclosure at K = 160. So the loop now runs until the term
    # is genuinely negligible AND the hypothesis holds, with `terms` as a floor rather than the stopping rule.
    for k in range(min(terms, max_terms)):
        total = total + (term if sign > 0 else -term)
        term = term * ratio(k)
        sign = -sign
    while k + 1 < max_terms and (not need_index(k + 1) or abs(term) > tol):
        k += 1
        total = total + (term if sign > 0 else -term)
        term = term * ratio(k)
        sign = -sign
    terms = k + 1
    if not need_index(terms):
        raise ValueError('series truncated at k=%d before the terms are provably decreasing; the Leibniz '
                         'remainder does not apply here and no bound is returned' % terms)
    if abs(term) > tol:
        raise ValueError('after %d terms the first omitted term is still %s > tol; the Leibniz bound would be '
                         'sound but useless, so no bound is returned rather than a vacuous one'
                         % (terms, mp.nstr(mpf(abs(term).b), 4)))
    # |remainder| <= |first omitted term|, so widen symmetrically by it
    mag = iv.mpf(abs(term))
    pad = iv.mpf([-mag.b, mag.b])
    return total + pad


def si(x, target=30, terms=None, max_terms=200000):
    """Enclosure of Si(x) = ∫₀^x sin t / t dt, for x >= 0 an interval or a real."""
    X = iv.mpf(x)
    xhi = float(mpf(X.b))
    dps_saved = iv.dps
    try:
        iv.dps = working_dps(xhi, target)
        X = iv.mpf(x)
        n = terms if terms is not None else int(xhi) + 4 * target + 30
        x2 = X * X
        # a_0 = x ; a_{k+1}/a_k = x^2 (2k+1) / ((2k+2)(2k+3)^2)
        ratio = lambda k: x2 * iv.mpf(2 * k + 1) / (iv.mpf(2 * k + 2) * iv.mpf(2 * k + 3) ** 2)
        # hypothesis: 2k+3 > x from index k onward
        need = lambda k: (2 * k + 3) > xhi
        out = _enclose(X, n, X, ratio, need, tol=mpf(10) ** (-(target + 12)), max_terms=max_terms)
        return iv.mpf([out.a, out.b])
    finally:
        iv.dps = dps_saved


def cin(x, target=30, terms=None, max_terms=200000):
    """Enclosure of Cin(x) = ∫₀^x (1 − cos t)/t dt, the entire part of −Ci."""
    X = iv.mpf(x)
    xhi = float(mpf(X.b))
    dps_saved = iv.dps
    try:
        iv.dps = working_dps(xhi, target)
        X = iv.mpf(x)
        n = terms if terms is not None else int(xhi) + 4 * target + 30
        x2 = X * X
        # b_1 = x^2/4 ; b_{k+1}/b_k = x^2 (2k) / ((2k+1)(2k+2)^2), with k starting at 1
        first = x2 / iv.mpf(4)
        ratio = lambda j: x2 * iv.mpf(2 * (j + 1)) / (iv.mpf(2 * (j + 1) + 1) * iv.mpf(2 * (j + 1) + 2) ** 2)
        need = lambda j: (2 * (j + 1) + 2) > xhi
        out = _enclose(X, n, first, ratio, need, tol=mpf(10) ** (-(target + 12)), max_terms=max_terms)
        return iv.mpf([out.a, out.b])
    finally:
        iv.dps = dps_saved


def ci(x, target=30, terms=None, max_terms=200000):
    """Enclosure of Ci(x) = γ + ln x − Cin(x), for x > 0."""
    X = iv.mpf(x)
    xhi = float(mpf(X.b))
    dps_saved = iv.dps
    try:
        iv.dps = working_dps(xhi, target)
        val = iv.euler + iv.log(iv.mpf(x)) - cin(x, target, terms, max_terms)
        return iv.mpf([val.a, val.b])
    finally:
        iv.dps = dps_saved


def si_at_2npi(n, target=30):
    """Enclosure of Si(2nπ) — the quantity A_{nn} = 2n·Si(2nπ) needs."""
    dps_saved = iv.dps
    try:
        iv.dps = working_dps(2 * n * 3.15 + 1, target)
        x = iv.mpf(2 * n) * iv.pi
        return si(x, target)
    finally:
        iv.dps = dps_saved


def ci_at_2npi(n, target=30):
    """Enclosure of Ci(2nπ) — the quantity the off-diagonal A_{nm} needs."""
    dps_saved = iv.dps
    try:
        iv.dps = working_dps(2 * n * 3.15 + 1, target)
        x = iv.mpf(2 * n) * iv.pi
        return ci(x, target)
    finally:
        iv.dps = dps_saved
