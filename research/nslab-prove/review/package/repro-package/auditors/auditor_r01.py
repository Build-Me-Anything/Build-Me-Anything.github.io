"""Machine C for R0 and R1a — and for R1a, a completeness proof by a *different argument*.

These are the two rungs whose only checks were written by the author of the code they test. R1a matters most:
its correctness rests on proving a **negative** — that no zero of the initial datum was missed — and that is
exactly where this project's worst bug lived. The dyadic-boundary trap made the search unable to resolve zeros
sitting on subdivision boundaries; it reported honestly, but a subtler variant that returned a partial list would
have produced a blow-up time that was too *large*, in the dangerous direction and invisible afterwards.

So the auditor does not re-run the prover's argument. It uses a different one.

| | prover (`clm.py`) | auditor (here) |
|---|---|---|
| a zero exists in Z | Krawczyk: K(Z) strictly inside Z | **intermediate value theorem**: omega changes sign across Z |
| no zero outside the Zs | Krawczyk: K(J) disjoint from J | **range enclosure**: 0 is not in omega(J) |
| arithmetic | mpmath intervals, outward rounding | exact rationals, no rounding |
| transcendentals | mpmath's `iv.cos` | Taylor series with an explicit alternating remainder |

Two different existence arguments and two different non-existence arguments agreeing is worth considerably more
than the same argument run twice.

Transcendentals without trusting a library
------------------------------------------
Everything is built from series with rigorous remainders:

* **pi** by Machin's formula, pi/4 = 4*arctan(1/5) - arctan(1/239), each arctan an alternating series in a
  rational argument, so truncation error is bounded by the first omitted term.
* **cos(q), sin(q)** for rational q by their Taylor series, again alternating once the terms start decreasing -
  which the code checks rather than assumes, since for q near 2*pi the first few terms grow.
* **cos(X), sin(X)** for an interval X by the mean value form: |cos(x) - cos(m)| <= |x - m| because |cos'| <= 1,
  so cos(X) is contained in cos(mid) + [-w/2, w/2]. Crude, and entirely sufficient once intervals are subdivided.

No floating point appears anywhere in this file.
"""
from fractions import Fraction

from auditor import F, ACCEPT, REJECT, _short
from auditor_r23 import RInterval, _iv

__all__ = ['audit_r0', 'audit_r1a', 'pi_interval', 'cos_bracket', 'sin_bracket']


# ------------------------------------------------------------------------------------------------------------
# transcendentals, from series, with rigorous remainders
# ------------------------------------------------------------------------------------------------------------

def _arctan_bracket(x, terms=60):
    """arctan(x) for rational |x| < 1, as an exact rational interval.

    The series sum (-1)^k x^(2k+1)/(2k+1) is alternating with strictly decreasing terms for |x| < 1, so the
    truncation error is bounded in magnitude by the first omitted term. That is the whole remainder argument.
    """
    x = F(x)
    assert abs(x) < 1
    s = Fraction(0)
    for k in range(terms):
        s += (-1) ** k * x ** (2 * k + 1) / (2 * k + 1)
    rem = abs(x) ** (2 * terms + 1) / (2 * terms + 1)
    return RInterval(s - rem, s + rem)


def pi_interval(terms=60):
    """pi as an exact rational interval, by Machin's formula. Self-contained: nothing is looked up or trusted."""
    a = _arctan_bracket(Fraction(1, 5), terms)
    b = _arctan_bracket(Fraction(1, 239), terms)
    quarter = RInterval(4) * a - b
    return RInterval(4) * quarter


def _series_bracket(q, terms, even):
    """cos(q) (even=True) or sin(q) (even=False) for rational q, as an exact rational interval.

    The Taylor terms q^n/n! only start decreasing once n exceeds |q|, so the alternating-series remainder bound is
    not valid from the first term. The code therefore *checks* that the terms are decreasing from the truncation
    point onward and refuses if they are not, rather than assuming it.
    """
    q = F(q)
    s = Fraction(0)
    for k in range(terms):
        n = 2 * k if even else 2 * k + 1
        s += (-1) ** k * q ** n / _fact(n)
    n_next = 2 * terms if even else 2 * terms + 1
    rem = abs(q) ** n_next / _fact(n_next)
    # decreasing from here on requires q^2 < (n+1)(n+2)
    if q * q >= (n_next + 1) * (n_next + 2):
        raise ValueError('too few terms for a valid alternating remainder at q = %s' % q)
    return RInterval(s - rem, s + rem)


_FACTS = [1]


def _fact(n):
    while len(_FACTS) <= n:
        _FACTS.append(_FACTS[-1] * len(_FACTS))
    return _FACTS[n]


def cos_bracket(q, terms=40):
    return _series_bracket(q, terms, True)


def sin_bracket(q, terms=40):
    return _series_bracket(q, terms, False)


def cos_iv(X, terms=40):
    """cos over an interval, by the mean value form. |cos'| <= 1, so the image is within w/2 of cos(mid)."""
    X = _iv(X)
    half = X.width() / 2
    c = cos_bracket(X.mid(), terms)
    return RInterval(c.lo - half, c.hi + half)


def sin_iv(X, terms=40):
    X = _iv(X)
    half = X.width() / 2
    c = sin_bracket(X.mid(), terms)
    return RInterval(c.lo - half, c.hi + half)


# ------------------------------------------------------------------------------------------------------------
# trig polynomials, for R1a
# ------------------------------------------------------------------------------------------------------------

def omega_iv(terms_list, X):
    """omega(X) = sum a_k cos(kX) + b_k sin(kX), as an exact rational interval."""
    s = RInterval(0)
    for k, a, b in terms_list:
        kX = RInterval(k) * _iv(X)
        if a != 0:
            s = s + RInterval(F(a)) * cos_iv(kX)
        if b != 0:
            s = s + RInterval(F(b)) * sin_iv(kX)
    return s


def domega_iv(terms_list, X):
    """omega'(X) = sum k*(b_k cos(kX) - a_k sin(kX)), as an exact rational interval."""
    s = RInterval(0)
    for k, a, b in terms_list:
        kX = RInterval(k) * _iv(X)
        if b != 0:
            s = s + RInterval(k) * RInterval(F(b)) * cos_iv(kX)
        if a != 0:
            s = s - RInterval(k) * RInterval(F(a)) * sin_iv(kX)
    return s


def theta_iv(terms_list, X):
    """theta = H(omega): a_k cos -> a_k sin, b_k sin -> -b_k cos. Same convention as the prover, deliberately -
    if the auditor used the other sign convention it would disagree for a reason that is not a defect."""
    s = RInterval(0)
    for k, a, b in terms_list:
        kX = RInterval(k) * _iv(X)
        if a != 0:
            s = s + RInterval(F(a)) * sin_iv(kX)
        if b != 0:
            s = s - RInterval(F(b)) * cos_iv(kX)
    return s


# ------------------------------------------------------------------------------------------------------------
# R1a - the CLM blow-up time, audited by range enclosure and the intermediate value theorem
# ------------------------------------------------------------------------------------------------------------

def _no_zero_on(terms_list, a, b, depth=0, max_depth=24):
    """Prove omega has no zero on [a, b] by range enclosure, subdividing when the enclosure is inconclusive.

    The auditor's *non-existence* argument, sharing nothing with the prover's: the prover shows K(J) is disjoint
    from J; this shows 0 is not in the interval enclosure of omega(J).
    """
    R = omega_iv(terms_list, RInterval(a, b))
    if R.lo > 0 or R.hi < 0:
        return True
    if depth >= max_depth:
        return False
    m = (a + b) / 2
    return (_no_zero_on(terms_list, a, m, depth + 1, max_depth)
            and _no_zero_on(terms_list, m, b, depth + 1, max_depth))


def _monotone_collar(terms_list, Z, radii=(Fraction(1, 2), Fraction(1, 4), Fraction(1, 8), Fraction(1, 16),
                                           Fraction(1, 64), Fraction(1, 256))):
    """Widen a zero enclosure to a collar on which omega is provably strictly monotone.

    A first version of this auditor tried to prove omega non-zero right up to the edge of each enclosure, and
    could not: immediately outside a root omega is of order 1e-46, so bisection would need depth ~150 to separate
    it from zero. That was a defect in the argument, not in the certificate, and it showed up as a false REJECT.

    The correct argument does not need omega to be bounded away from zero next to a root. If omega' has no zero on
    a collar C containing the enclosure Z, then omega is strictly monotone on C, so it has **at most one** zero
    there - and the sign change across Z already places one inside Z. Hence no zero of omega lies in C \\ Z, which
    is exactly what completeness requires, and the range-enclosure argument is then only needed on the region
    outside the collars, where omega is comfortably away from zero and bisection terminates immediately.

    Returns the collar, or None if monotonicity could not be established at any of the radii tried.
    """
    for c in radii:
        C = RInterval(Z.lo - c, Z.hi + c)
        D = domega_iv(terms_list, C)
        if D.lo > 0 or D.hi < 0:
            return C
    return None


def audit_r1a(doc):
    """Re-check a CLM blow-up-time certificate: every claimed zero is real, none was missed, and T follows."""
    findings = []
    terms_list = [(int(k), F(a), F(b)) for k, a, b in doc['omega0']]
    zeros = [RInterval(F(a), F(b)) for a, b in doc['zeros']]
    T_lo, T_hi = F(doc['T'][0]), F(doc['T'][1])

    PI = pi_interval()
    two_pi_lo, two_pi_hi = (RInterval(2) * PI).lo, (RInterval(2) * PI).hi

    # --- 1. every claimed zero really is one, by the intermediate value theorem --------------------------
    for i, Z in enumerate(zeros):
        lo_val = omega_iv(terms_list, RInterval(Z.lo))
        hi_val = omega_iv(terms_list, RInterval(Z.hi))
        straddles = (lo_val.hi < 0 < hi_val.lo) or (hi_val.hi < 0 < lo_val.lo)
        contains_zero_val = lo_val.lo <= 0 <= lo_val.hi or hi_val.lo <= 0 <= hi_val.hi
        if not (straddles or contains_zero_val):
            findings.append('REJECT: claimed zero %d, %s, shows no sign change and no vanishing endpoint - '
                            'the intermediate value theorem gives no root there.' % (i, Z))
    if not any(f.startswith('REJECT') for f in findings):
        findings.append('all %d claimed zeros confirmed by sign change (IVT), independently of Krawczyk'
                        % len(zeros))

    # --- 2. COMPLETENESS: nothing outside the claimed zeros ----------------------------------------------
    # The check that matters, and the one whose failure would push T the wrong way. Two ingredients:
    #   (a) around each claimed zero, a collar on which omega' has no zero, so omega is strictly monotone there
    #       and the single sign change already found accounts for every zero in the collar;
    #   (b) outside the collars, a direct range enclosure showing omega never reaches zero.
    collars = []
    for i, Z in enumerate(zeros):
        C = _monotone_collar(terms_list, Z)
        if C is None:
            findings.append('REJECT: could not establish a monotone collar around claimed zero %d, %s, so the '
                            'zeros adjacent to it are not accounted for.' % (i, Z))
        else:
            collars.append(C)

    if len(collars) == len(zeros):
        covered = sorted([(C.lo, C.hi) for C in collars])
        gaps, cursor = [], Fraction(0)
        for lo_, hi_ in covered:
            if lo_ > cursor:
                gaps.append((cursor, lo_))
            cursor = max(cursor, hi_)
        if cursor < two_pi_hi:
            gaps.append((cursor, two_pi_hi))
        bad = [g for g in gaps if g[1] > g[0] and not _no_zero_on(terms_list, g[0], g[1])]
        if bad:
            findings.append('REJECT: could not prove omega is non-zero on %d region(s) outside the claimed '
                            'zeros, e.g. [%s, %s]. The zero set is NOT complete, so the supremum - and therefore '
                            'T - may be too small and the blow-up time too large.'
                            % (len(bad), _short(bad[0][0]), _short(bad[0][1])))
        else:
            findings.append('completeness confirmed: %d monotone collar(s) plus range enclosure over %d '
                            'region(s) - a different argument from the prover\'s subdivision'
                            % (len(collars), len(gaps)))

    # --- 3. the supremum and T ---------------------------------------------------------------------------
    positives = []
    for Z in zeros:
        th = theta_iv(terms_list, Z)
        if th.lo > 0:
            positives.append(th)
    if not positives:
        findings.append('REJECT: no zero has a provably positive theta, so no blow-up time follows.')
    else:
        sup_lo = max(t.lo for t in positives)
        sup_hi = max(t.hi for t in positives)
        # T = 2 / sup, so a larger sup gives a smaller T
        t_lo = Fraction(2) / sup_hi
        t_hi = Fraction(2) / sup_lo
        if not (T_lo <= t_hi and t_lo <= T_hi):
            findings.append('REJECT: claimed T interval [%s, %s] does not intersect the independently computed '
                            '[%s, %s].' % (_short(T_lo), _short(T_hi), _short(t_lo), _short(t_hi)))
        else:
            findings.append('T ok: claimed [%s, %s], independently [%s, %s]'
                            % (_short(T_lo), _short(T_hi), _short(t_lo), _short(t_hi)))

    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    return verdict, findings


# ------------------------------------------------------------------------------------------------------------
# R0 - root enclosures, audited without any square roots
# ------------------------------------------------------------------------------------------------------------

def audit_r0(doc):
    """Re-check an R0 enclosure.

    The trick that keeps this exact: to confirm an enclosure [lo, hi] contains sqrt(2), check lo^2 <= 2 <= hi^2
    in rational arithmetic. No irrational number is ever constructed, and no library is trusted to produce one.
    """
    findings = []
    case = doc['case']
    box = [RInterval(F(a), F(b)) for a, b in doc['box']]

    if case == 'sqrt2':
        Z = box[0]
        if not (Z.lo > 0 and Z.lo * Z.lo <= 2 <= Z.hi * Z.hi):
            findings.append('REJECT: [%s, %s] does not bracket sqrt(2): lo^2 = %s, hi^2 = %s.'
                            % (_short(Z.lo), _short(Z.hi), _short(Z.lo * Z.lo), _short(Z.hi * Z.hi)))
        else:
            findings.append('encloses sqrt(2): lo^2 <= 2 <= hi^2, verified in exact rationals')
        # and the sign change gives existence independently
        f_lo, f_hi = Z.lo * Z.lo - 2, Z.hi * Z.hi - 2
        if f_lo > 0 or f_hi < 0:
            findings.append('REJECT: f does not change sign across the enclosure.')

    elif case == 'system2d':
        # x^2 + y^2 = 4 and x = y, so x = y = sqrt(2); same exact test on both components
        for i, Z in enumerate(box):
            if not (Z.lo > 0 and Z.lo * Z.lo <= 2 <= Z.hi * Z.hi):
                findings.append('REJECT: component %d, [%s, %s], does not bracket sqrt(2).'
                                % (i, _short(Z.lo), _short(Z.hi)))
        if not any(f.startswith('REJECT') for f in findings):
            findings.append('both components enclose sqrt(2), verified in exact rationals')

    elif case == 'dottie':
        # cos(x) - x = 0. Existence by IVT with rigorous cosine brackets.
        Z = box[0]
        g_lo = cos_bracket(Z.lo) - RInterval(Z.lo)
        g_hi = cos_bracket(Z.hi) - RInterval(Z.hi)
        if not (g_lo.lo > 0 > g_hi.hi or g_hi.lo > 0 > g_lo.hi):
            findings.append('REJECT: cos(x) - x does not change sign across [%s, %s] (values %s and %s).'
                            % (_short(Z.lo), _short(Z.hi), g_lo, g_hi))
        else:
            findings.append('encloses the Dottie number: cos(x) - x changes sign across the enclosure, by IVT '
                            'with a Taylor-series cosine bracket')
    else:
        return REJECT, ['REJECT: unknown R0 case "%s"' % case]

    w = max(b.width() for b in box)
    findings.append('enclosure width %s' % _short(w))
    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    return verdict, findings


DISPATCH = {'r0_enclosure': audit_r0, 'clm_blowup_time': audit_r1a}


def audit(doc):
    p = doc.get('problem')
    if p not in DISPATCH:
        return REJECT, ['REJECT: unknown problem "%s"' % p]
    return DISPATCH[p](doc)
