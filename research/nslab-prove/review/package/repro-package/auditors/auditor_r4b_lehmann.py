"""Machine C, Rung 3 — the Lehmann pencil and the inertia count, re-derived independently.

Implements `../R3-AUDIT-CONTRACT.md`, which is frozen. This module is deliberately **unoptimised**: explicit
rational arithmetic, small testable functions, deterministic output, no cache shared with the prover.

Four separations from the prover, per the contract:

  (a) **The A₂ tail is the vector form of (R2-T)**, not the prover's entry-asymptotics route. With
      `p_a[k] = Σ_l A_kl v_a[l]`, Parseval plus HTW's smoothing estimate (H3) give
          Σ_k p_a[k]² = ‖M w_a‖²_{Ḣ²} ≤ ‖w_a‖²_{Ḣ¹} = Σ_l v_a[l]²(lπ)²            (R3-T)
      so the tail bound (R3-D)/(R3-O) needs **no hypothesis `Ksum ≥ 2K` at all** — where the prover must
      refuse below 2K, this bound simply holds.
  (b) **Inertia by Jacobi's minor rule**, division-free cofactor determinants — sign changes in the sequence
      `1, D₁, …, D_n` of leading principal minors — not the prover's LDLᵀ pivots. `R ≻ 0` is *checked* by
      Sylvester's criterion, never asserted from the Gram form.
  (c) **Resolution-limited bisection**: an undecidable midpoint is probed at 1/2, 1/4, 3/4 of the interval and
      then the bracket *stops* — the auditor cannot narrow past its own interval widths, because every
      narrowing requires a certified count.
  (d) **The final arithmetic is exact**: the certificate's bracket endpoints are dyadic rationals, so
      `sup_{τ∈[a,b]} −(ρ + 1/τ) = −ρ − 1/b` is computed with no rounding whatever, and the shift window is
      re-derived from the auditor's own Machin π and its own Gershgorin bound.

Dependencies are governed by the contract. `auditor_r4b` supplies `RI` and the Gram entries (Rung 1, audited);
`auditor_r4b_a2` supplies `sqrt_upper` and `Refusal` (Rung 2, audited). Nothing from `lehmann`,
`problem_dg_profile`, `sici`, `ivutil`, or `mpmath`.
"""
import json
from fractions import Fraction

import auditor_r4b
from auditor_r4b import RI, A_entry, pi_ri, ACCEPT, REJECT
from auditor_r4b_a2 import sqrt_upper, Refusal

__all__ = ['prepare', 'build_matrices', 'vector_tail_from_parts', 'leading_minors', 'inertia_below',
           'certify_posdef', 'bracket_tau', 'audit_doc', 'audit_file']

SPAN_LO = Fraction(-(1 << 40))          # count here must certify as 0 (R ≻ 0 dominates)
SPAN_HI = Fraction(-1, 1 << 40)         # count here must certify as >= J
MIN_WIDTH = Fraction(1, 1 << 20)        # bisection target; the widths usually stop it first
MAX_ITER = 300
VACUITY_CEILING = Fraction(1)           # every eigenvalue of M is below 1/pi < 1; a bound above 1 is vacuous


def prepare(n_max):
    """Size the rational grid for the largest series argument this run will touch, x = 2*n_max*pi.

    Deterministic in n_max, so a run is reproducible; ambient state cannot move the output (AL-002/AL-004).
    """
    return auditor_r4b.set_precision_for(2 * n_max * 3.1416 + 1)


# ------------------------------------------------------------------------------------------------------------
# the matrices, from the auditor's own primitives
# ------------------------------------------------------------------------------------------------------------

def vector_tail_from_parts(majorant, partial, Ksum):
    """(R3-D) from its two ingredients, exposed separately so the refusal is independently testable.

    REFUSES if the partial sum already exceeds the (R3-T) majorant, which would falsify an imported hypothesis
    and means something upstream is wrong — reported, never clamped.
    """
    if majorant.hi < partial.lo:
        raise Refusal('partial sum %s exceeds the (R3-T) majorant %s, falsifying an imported hypothesis; '
                      'the auditor refuses rather than clamping' % (partial, majorant))
    resid_hi = majorant.hi - partial.lo
    denom_lo = ((RI(Ksum + 1) * pi_ri()) * (RI(Ksum + 1) * pi_ri())).lo
    if denom_lo <= 0:
        raise Refusal('non-positive denominator in (R3-D)')
    return max(Fraction(0), resid_hi / denom_lo)


def build_matrices(V, K, Ksum):
    """A₀, A₁, A₂ for the trial vectors, every entry the auditor's own certified interval.

    `V` is a list of J coefficient vectors (exact rationals, length K). `Ksum` is the auditor's own truncation
    — no `Ksum ≥ 2K` hypothesis, see (R3-T).
    """
    J = len(V)
    pi = pi_ri()
    pi2 = pi * pi

    p = []                                              # p_a[k] = sum_l A_kl v_a[l]
    for a in range(J):
        col = []
        for k in range(1, Ksum + 1):
            s = RI(0)
            for l in range(1, K + 1):
                s = s + A_entry(k, l) * RI(V[a][l - 1])
            col.append(s)
        p.append(col)

    T = []                                              # (R3-D) per vector
    for a in range(J):
        maj = RI(0)
        for l in range(1, K + 1):
            maj = maj + RI(V[a][l - 1]) * RI(V[a][l - 1]) * RI(l * l) * pi2
        part = RI(0)
        for k in range(Ksum):
            part = part + p[a][k] * p[a][k]
        T.append(vector_tail_from_parts(maj, part, Ksum))

    A0 = [[None] * J for _ in range(J)]
    A1 = [[None] * J for _ in range(J)]
    A2 = [[None] * J for _ in range(J)]
    for a in range(J):
        for b in range(J):
            s0 = RI(0)
            for l in range(1, K + 1):
                s0 = s0 + RI(V[a][l - 1]) * RI(V[b][l - 1]) * RI(l * l) * pi2
            s1 = RI(0)
            for k in range(1, K + 1):
                s1 = s1 + RI(V[a][k - 1]) * p[b][k - 1]
            s2 = RI(0)
            for k in range(1, Ksum + 1):
                s2 = s2 + p[a][k - 1] * p[b][k - 1] / (RI(k * k) * pi2)
            tail = sqrt_upper(T[a] * T[b])              # (R3-O)
            A0[a][b] = s0
            A1[a][b] = RI(0) - s1
            A2[a][b] = RI(s2.lo - tail, s2.hi + tail, raw=True)
    return A0, A1, A2


# ------------------------------------------------------------------------------------------------------------
# inertia by Jacobi's minor rule — division-free, refusing where a minor cannot be signed
# ------------------------------------------------------------------------------------------------------------

def leading_minors(S, n):
    """Leading principal minors D_1..D_n by cofactor expansion. Deliberately explicit; J is small."""
    if n > 4:
        raise Refusal('leading_minors is written out explicitly for n <= 4; extend it deliberately, not implicitly')
    out = []
    if n >= 1:
        out.append(S[0][0])
    if n >= 2:
        out.append(S[0][0] * S[1][1] - S[0][1] * S[1][0])
    if n >= 3:
        out.append(S[0][0] * (S[1][1] * S[2][2] - S[1][2] * S[2][1])
                   - S[0][1] * (S[1][0] * S[2][2] - S[1][2] * S[2][0])
                   + S[0][2] * (S[1][0] * S[2][1] - S[1][1] * S[2][0]))
    if n >= 4:
        def det3(r, c):
            i0, i1, i2 = r
            j0, j1, j2 = c
            return (S[i0][j0] * (S[i1][j1] * S[i2][j2] - S[i1][j2] * S[i2][j1])
                    - S[i0][j1] * (S[i1][j0] * S[i2][j2] - S[i1][j2] * S[i2][j0])
                    + S[i0][j2] * (S[i1][j0] * S[i2][j1] - S[i1][j1] * S[i2][j0]))
        rows = (1, 2, 3)
        d4 = RI(0)
        sign = 1
        for jcol in range(4):
            cols = tuple(c for c in range(4) if c != jcol)
            term = S[0][jcol] * det3(rows, cols)
            d4 = d4 + (term if sign > 0 else RI(0) - term)
            sign = -sign
        out.append(d4)
    return out


def _signed(d):
    """+1 or -1 if the interval's sign is certified, else None."""
    if d.lo > 0:
        return 1
    if d.hi < 0:
        return -1
    return None


def inertia_below(L, R, t, n):
    """Number of eigenvalues of the pencil (L, R) strictly below `t`, or None if a minor cannot be signed.

    Jacobi's rule: with S = L - tR symmetric and all leading principal minors certified nonzero, the count of
    negative eigenvalues of S equals the sign changes in `1, D_1, ..., D_n`. Valid as an eigenvalue count for
    the pencil because R ≻ 0 (certified separately by `certify_posdef`).
    """
    tt = RI(t)
    S = [[L[i][j] - tt * R[i][j] for j in range(n)] for i in range(n)]
    prev = 1
    changes = 0
    for d in leading_minors(S, n):
        s = _signed(d)
        if s is None:
            return None
        if s != prev:
            changes += 1
        prev = s
    return changes


def certify_posdef(R, n):
    """Sylvester's criterion: all leading principal minors certified strictly positive, else REFUSE."""
    for i, d in enumerate(leading_minors(R, n)):
        if not d.lo > 0:
            raise Refusal('R is not certified positive definite: leading minor D_%d = %s' % (i + 1, d))


def bracket_tau(L, R, n, k, a=SPAN_LO, b=SPAN_HI):
    """Certified bracket on the k-th smallest pencil eigenvalue, by bisection on the auditor's own counts.

    On an undecidable midpoint, probes 1/2, 1/4, 3/4 of the interval; if none decides, the bracket stops there
    — resolution-limited by construction, per contract §3(c). REFUSES if the span-end counts do not certify
    as `count(a) < k <= count(b)`.
    """
    ca = inertia_below(L, R, a, n)
    cb = inertia_below(L, R, b, n)
    if ca is None or cb is None:
        raise Refusal('span-end inertia count undecidable at tau_%d (counts %s, %s)' % (k, ca, cb))
    if not (ca < k <= cb):
        raise Refusal('span does not isolate tau_%d: count(%s) = %d, count(%s) = %d'
                      % (k, float(a), ca, float(b), cb))
    it = 0
    while b - a > MIN_WIDTH and it < MAX_ITER:
        it += 1
        decided = False
        for frac in (Fraction(1, 2), Fraction(1, 4), Fraction(3, 4)):
            m = a + (b - a) * frac
            c = inertia_below(L, R, m, n)
            if c is not None:
                if c < k:
                    a = m
                else:
                    b = m
                decided = True
                break
        if not decided:
            break                                       # the widths certify nothing sharper; stop, don't guess
    return a, b


def upper_bound_from_bracket(rho, a, b):
    """sup over τ ∈ [a, b] of −(ρ + 1/τ), exactly: the sup sits at b since −(ρ+1/τ) is increasing in τ.

    REFUSES unless the bracket is certified negative and ordered — dividing by an interval that touches zero
    is exactly the undecided-sign case the contract forbids converting into a number.
    """
    if not (a <= b):
        raise Refusal('bracket endpoints out of order: [%s, %s]' % (a, b))
    if not b < 0:
        raise Refusal('bracket upper endpoint %s is not certified negative; no bound follows' % b)
    U = -rho - Fraction(1, 1) / b
    if U > VACUITY_CEILING:
        raise Refusal('upper bound %.6g exceeds %s — sound but vacuous (every eigenvalue of M is below 1/pi); '
                      'a resolution collapse must be a refusal, never an agreement' % (float(U), VACUITY_CEILING))
    return U


# ------------------------------------------------------------------------------------------------------------
# the audit
# ------------------------------------------------------------------------------------------------------------

def _gershgorin_lower(V, K):
    """The auditor's own Courant–Fischer lower bound on λ_J: λ_min(VᵀAV)/λ_max(VᵀBV), Gershgorin both times."""
    J = len(V)
    pi2 = pi_ri() * pi_ri()
    GA = [[None] * J for _ in range(J)]
    GB = [[None] * J for _ in range(J)]
    for a in range(J):
        for b in range(J):
            sa = RI(0)
            sb = RI(0)
            for n in range(1, K + 1):
                for m in range(1, K + 1):
                    sa = sa + RI(V[a][n - 1]) * A_entry(n, m) * RI(V[b][m - 1])
                sb = sb + RI(V[a][n - 1]) * RI(V[b][n - 1]) * RI(n * n) * pi2
            GA[a][b] = sa
            GB[a][b] = sb
    gmin = None
    for i in range(J):
        row = GA[i][i].lo
        for k in range(J):
            if k != i:
                row -= max(abs(GA[i][k].lo), abs(GA[i][k].hi))
        gmin = row if gmin is None else min(gmin, row)
    gmax = None
    for i in range(J):
        row = GB[i][i].hi
        for k in range(J):
            if k != i:
                row += max(abs(GB[i][k].lo), abs(GB[i][k].hi))
        gmax = row if gmax is None else max(gmax, row)
    if not (gmin > 0 and gmax > 0):
        raise Refusal('Gershgorin could not certify a positive lower bound (gmin %s, gmax %s)' % (gmin, gmax))
    return gmin / gmax


def _check_window(rho, J, L_J_own):
    """Shift admissibility (5.1), re-derived: −ρ ≥ 1/((J+1)π) by the auditor's π, and −ρ < the auditor's L_J."""
    neg_rho = -rho
    h6_hi = Fraction(1, 1) / ((RI(J + 1) * pi_ri()).lo)          # an upper bound on 1/((J+1)pi)
    if not neg_rho >= h6_hi:
        raise Refusal('shift fails (H6): -rho = %.8g < %.8g >= 1/((J+1)pi)' % (float(neg_rho), float(h6_hi)))
    if not neg_rho < L_J_own:
        raise Refusal('shift fails the lower half: -rho = %.8g is not below the auditor lower bound %.8g on '
                      'lambda_%d' % (float(neg_rho), float(L_J_own), J))


def audit_doc(doc, Ksum=None):
    """Re-derive the whole Lehmann step from the certificate's trial vectors and compare. Disjointness is fatal.

    Ordered so the cheap refusals come first: a claim that is inconsistent with its own data (an understated
    bound) or an inadmissible shift is rejected before any series is summed.
    """
    if doc.get('problem') != 'r4b_lehmann':
        return REJECT, ['REJECT: unknown problem %r; the auditor will not accept what it cannot recompute'
                        % doc.get('problem')]
    K = int(doc['params']['K'])
    J = int(doc['params']['J'])
    Ksum = Ksum or int(doc.get('audit_Ksum', 80))
    Kbr = int(doc['params']['K_bracket'])
    findings = []
    rho = Fraction(doc['rho'])
    V = [[Fraction(c) for c in row] for row in doc['V']]
    Vbr = [[Fraction(c) for c in row] for row in doc['V_bracket']]
    if len(V) != J or any(len(row) != K for row in V):
        return REJECT, findings + ['REJECT: trial-vector shape does not match params']

    # 1. claim-internal exact recheck, pure rational arithmetic, no grid needed: the claimed U_j must be at
    #    least the exact sup -rho - 1/b over the certificate's OWN bracket, or the claim is unsupported by its
    #    own data whatever the true spectrum does.
    bad = False
    claim_sups = []
    for k in range(1, J + 1):
        ca, cb_ = Fraction(doc['tau'][k - 1][0]), Fraction(doc['tau'][k - 1][1])
        try:
            claim_sups.append(upper_bound_from_bracket(rho, ca, cb_))
        except Refusal as e:
            return REJECT, findings + ['REJECT: claimed tau_%d bracket — %s' % (k, e)]
        j = J + 1 - k                                    # tau_k (k-th most negative) bounds lambda_{J+1-k}
        U_claim = Fraction(doc['upper'][j - 1])
        if U_claim < claim_sups[-1]:
            bad = True
            findings.append('REJECT: U_%d = %.10g is below the exact sup %.10g over the certificate\'s own '
                            'bracket — the claim is unsupported by its own data'
                            % (j, float(U_claim), float(claim_sups[-1])))
    if bad:
        return REJECT, findings
    findings.append('exact recheck ok — every claimed U_j is >= the exact sup over its own bracket')

    bits = prepare(max(Ksum, Kbr))
    findings.append('grid sized to %d bits for Ksum = %d' % (bits, Ksum))

    try:
        # 2. shift admissibility, from the auditor's own pi and its own Gershgorin bound
        L_J_own = _gershgorin_lower(Vbr, Kbr)
        _check_window(rho, J, L_J_own)
        findings.append('shift window ok — -rho = %.8g in [%.8g, %.8g)'
                        % (float(-rho), float(Fraction(1, 1) / ((RI(J + 1) * pi_ri()).lo)), float(L_J_own)))

        # 3. the three matrices, from the auditor's own entries and its own (R3-T) tail
        A0, A1, A2 = build_matrices(V, K, Ksum)
    except Refusal as e:
        return REJECT, findings + ['REJECT: %s' % e]
    for name, own in (('A0', A0), ('A1', A1), ('A2', A2)):
        claimed = doc['matrices'][name]
        for a in range(J):
            for b in range(J):
                theirs = RI(Fraction(claimed[a][b][0]), Fraction(claimed[a][b][1]), raw=True)
                if not own[a][b].overlaps(theirs):
                    bad = True
                    findings.append('REJECT: %s_%d,%d disjoint — auditor %s, prover [%.17g, %.17g]'
                                    % (name, a, b, own[a][b], float(theirs.lo), float(theirs.hi)))
        if not bad:
            findings.append('%s ok — max auditor width %.3g'
                            % (name, max(float(own[a][b].width()) for a in range(J) for b in range(J))))
    if bad:
        return REJECT, findings

    # 3. the pencil: R ≻ 0 certified, then the auditor's own resolution-limited brackets
    rr = RI(rho, raw=True)
    Lm = [[A1[i][j] - rr * A0[i][j] for j in range(J)] for i in range(J)]
    Rm = [[A2[i][j] - RI(2) * rr * A1[i][j] + rr * rr * A0[i][j] for j in range(J)] for i in range(J)]
    try:
        certify_posdef(Rm, J)
        findings.append('R certified positive definite by Sylvester criterion')
        cb = inertia_below(Lm, Rm, SPAN_HI, J)
        if cb is None or cb < J:
            raise Refusal('count of negative pencil eigenvalues is %s, expected >= %d' % (cb, J))
        own_brackets = []
        for k in range(1, J + 1):
            a, b = bracket_tau(Lm, Rm, J, k)
            own_brackets.append((a, b))
            findings.append('tau_%d own bracket [%.8g, %.8g] width %.3g' % (k, float(a), float(b), float(b - a)))
    except Refusal as e:
        return REJECT, findings + ['REJECT: %s' % e]

    # 4. compare: overlap on every bracket; exact recheck of every claimed bound; own bound non-vacuous
    for k in range(1, J + 1):
        ca, cb_ = Fraction(doc['tau'][k - 1][0]), Fraction(doc['tau'][k - 1][1])
        oa, ob = own_brackets[k - 1]
        if cb_ < oa or ob < ca:
            bad = True
            findings.append('REJECT: tau_%d disjoint — auditor [%.8g, %.8g], prover [%.8g, %.8g]'
                            % (k, float(oa), float(ob), float(ca), float(cb_)))
            continue
        try:
            own_U = upper_bound_from_bracket(rho, oa, ob)
            claim_sup = upper_bound_from_bracket(rho, ca, cb_)
        except Refusal as e:
            bad = True
            findings.append('REJECT: tau_%d — %s' % (k, e))
            continue
        j = J + 1 - k                                    # tau_k (k-th most negative) bounds lambda_{J+1-k}
        U_claim = Fraction(doc['upper'][j - 1])
        if U_claim < claim_sup:
            bad = True
            findings.append('REJECT: U_%d = %.10g is below the exact sup %.10g over the certificate\'s own '
                            'bracket — the claim is unsupported by its own data' % (j, float(U_claim), float(claim_sup)))
        else:
            findings.append('lambda_%d ok — claimed U %.8g, exact sup of claim %.8g, auditor own U %.8g'
                            % (j, float(U_claim), float(claim_sup), float(own_U)))
    return (REJECT if bad else ACCEPT), findings


def audit_file(path, Ksum=None):
    with open(path, encoding='utf-8') as f:
        return audit_doc(json.load(f), Ksum)
