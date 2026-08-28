"""Machine C, Rung 2 — `A₂ = AᵀB⁻¹A` and its tail, re-derived independently.

Implements `../R2-AUDIT-CONTRACT.md`, which is frozen. This module is deliberately **unoptimised**: explicit
rational arithmetic, small testable functions, deterministic output, no cache shared with the prover.

**The tail is not the prover's argument.** The prover bounds it through the asymptotics of the entries —
`|Ci(x)| ≤ 2/x`, then `|A_km| ≤ (8m/3πk)(ln(k/m) + D_m)` for `k ≥ 2m`, then three `∫ln^p(x)/x⁴` moments. None of
that appears here. This module goes through the operator's own smoothing estimate instead:

    Σ_{k≥1} A_ki² = ‖M s_i‖²_{Ḣ²} ≤ ‖s_i‖²_{Ḣ¹} = (iπ)²                                      (R2-T)
    T_i(K) := Σ_{k>K} A_ki²/(kπ)² ≤ [ (iπ)² − Σ_{k≤K} A_ki² ] / ((K+1)π)²                     (R2-D)
    |R_ij(K)| ≤ √( T_i(K)·T_j(K) )                                                            (R2-O)

(R2-T) is HTW's compactness hypothesis (H3) plus Parseval in the `s`-basis. Convergence therefore follows from a
**finite analytic bound**, not from a decay rate — so the contract's convergence and enclosure obligations
separate completely, and the geometric majorant its example suggests is not needed (and does not exist here: the
entries decay algebraically).

Consequence worth stating: this bound falls like `K⁻²` where the prover's falls like `K⁻³`, so the auditor is
20–38× blunter. That is expected and is the point. Only disjointness is fatal.

Dependencies are governed by the contract. `auditor_r4b` supplies `RI` and the Gram entries — Rung 1, already
audited, and itself free of prover code. `math.isqrt` gives certified square roots by integer arithmetic; no
floating-point `sqrt` is used anywhere.
"""
import json
from fractions import Fraction
from math import isqrt

import auditor_r4b
from auditor_r4b import RI, A_entry, pi_ri, ACCEPT, REJECT

__all__ = ['sqrt_upper', 'partial_sum_sq', 'diag_tail_bound', 'a2_enclosure', 'audit_doc', 'Refusal']


class Refusal(Exception):
    """No third state. Raised where the contract says REFUSE, never converted into a numeric decision."""


def sqrt_upper(x):
    """Smallest easily-computed rational ≥ √x, by integer square root. Exact, and no floating point.

    √(p/q) = √(pq)/q, and `isqrt` gives ⌊√(pq)⌋; rounding it up gives an integer ≥ √(pq).
    """
    if x < 0:
        raise Refusal('square root of a negative quantity: %s' % x)
    if x == 0:
        return Fraction(0)
    p, q = x.numerator, x.denominator
    s = isqrt(p * q)
    if s * s < p * q:
        s += 1
    return Fraction(s, q)


def _check_interval(z, where):
    if z.lo > z.hi:
        raise Refusal('endpoints out of order at %s: %s' % (where, z))
    return z


def prepare(K):
    """Size the rational grid for the largest series argument this run will touch, x = 2*K*pi.

    Contract section 6 says do not optimise; this is not an optimisation but a correctness precondition, and it
    is deterministic in K so the run stays reproducible. See AUDIT-LOG AL-004.
    """
    return auditor_r4b.set_precision_for(2 * K * 3.1416 + 1)


def partial_sum_sq(i, K):
    """Σ_{k≤K} A_ki², as an interval. Also the quantity (R2-T) bounds."""
    tot = RI(0)
    for k in range(1, K + 1):
        a = A_entry(k, i)
        tot = tot + a * a
    return _check_interval(tot, 'partial_sum_sq')


def diag_tail_bound(i, K):
    """(R2-D): an upper bound on `T_i(K) = Σ_{k>K} A_ki²/(kπ)²`, as a non-negative rational.

    REFUSES if the partial sum already exceeds `(iπ)²`, which would falsify (R2-T) and mean something upstream is
    wrong — the auditor reports that rather than clamping it to zero.
    """
    pi2 = pi_ri() * pi_ri()
    total_bound = RI(i * i) * pi2                       # (i pi)^2, as an interval
    S = partial_sum_sq(i, K)
    resid_hi = total_bound.hi - S.lo                    # largest the residual could be
    if total_bound.hi < S.lo:
        raise Refusal('partial sum Sum_{k<=%d} A_k%d^2 exceeds (i*pi)^2, falsifying (R2-T); '
                      'the auditor refuses rather than clamping' % (K, i))
    denom_lo = ((RI(K + 1) * pi_ri()) * (RI(K + 1) * pi_ri())).lo
    if denom_lo <= 0:
        raise Refusal('non-positive denominator in (R2-D)')
    return max(Fraction(0), resid_hi / denom_lo)


def a2_enclosure(i, j, K):
    """(A₂)_ij as a certified interval: finite sum ± the (R2-O) tail. Both uncertainties tracked separately."""
    S = RI(0)
    for k in range(1, K + 1):
        num = A_entry(k, i) * A_entry(k, j)
        den = (RI(k) * pi_ri()) * (RI(k) * pi_ri())
        S = S + num / den
    Ti, Tj = diag_tail_bound(i, K), diag_tail_bound(j, K)
    R = sqrt_upper(Ti * Tj)
    return _check_interval(RI(S.lo - R, S.hi + R), 'a2_enclosure'), S, R


# ------------------------------------------------------------------------------------------------------------
# the audit
# ------------------------------------------------------------------------------------------------------------

def audit_doc(doc, K=None):
    """Re-derive each claimed A₂ entry and check consistency. Disjointness is the fatal case."""
    if doc.get('problem') != 'r4b_a2':
        return REJECT, ['REJECT: unknown problem %r; the auditor will not accept what it cannot recompute'
                        % doc.get('problem')]
    K = K or int(doc.get('audit_K', 120))
    bits = prepare(K)
    findings_pre = ['grid sized to %d bits for K = %d' % (bits, K)]
    findings = list(findings_pre)
    bad = False
    for key in sorted(doc['a2']):
        i, j = (int(t) for t in key.split(','))
        clo, chi = doc['a2'][key]
        try:
            mine, S, R = a2_enclosure(i, j, K)
        except Refusal as e:
            bad = True
            findings.append('REJECT: A2_%d,%d — %s' % (i, j, e))
            continue
        theirs = RI(Fraction(clo), Fraction(chi), raw=True)
        if not mine.overlaps(theirs):
            bad = True
            findings.append('REJECT: A2_%d,%d disjoint — auditor [%.17g, %.17g], prover [%.17g, %.17g]'
                            % (i, j, float(mine.lo), float(mine.hi), float(theirs.lo), float(theirs.hi)))
        else:
            findings.append('A2_%d,%d ok — auditor width %.3g (tail %.3g), prover width %.3g'
                            % (i, j, float(mine.width()), float(R), float(theirs.width())))
    return (REJECT if bad else ACCEPT), findings


def audit_file(path, K=None):
    with open(path, encoding='utf-8') as f:
        return audit_doc(json.load(f), K)
