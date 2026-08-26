"""Machine C, Rung 4 — the assembled two-sided enclosures, re-derived independently.

Implements `../R4-AUDIT-CONTRACT.md`, which is frozen. This module is deliberately **unoptimised**: explicit
rational arithmetic, small testable functions, deterministic output, no cache shared with the prover.

The last rung. Rungs 1–3 audited the ingredients — the Gram entries, `A₂` and its tail, the pencil and its
inertia counts — and this rung audits what is **assembled** from them. What is new here is not machinery:

  (a) **Per-`j` lower halves.** For each `j` the auditor forms `G_A = V_jᵀAV_j`, `G_B = V_jᵀBV_j` from the
      first `j` rows of the certificate's `V_lower`, with its own Gram entries and its own π, and certifies
      `λ_j ≥ λ_min(G_A)/λ_max(G_B)` by its own Gershgorin evaluation. Rung 3 audited only `L_J`, in its
      shift-window role; Courant–Fischer makes every prefix bound true regardless of prefix quality.
  (b) **The support check, two readings, no tuned slack.** Gershgorin is evaluated twice: every endpoint
      against the bound (the auditor's own `L_j^aud`), and every endpoint in the claim's favour (`L_j^gen`).
      Any sound evaluation over valid enclosures of these entries lies at or below `L_j^gen`, so a claimed
      `L_j` above it is unsupported by its own data — REJECT, whatever the true spectrum does.
  (c) **The pairing, independently.** The pencil is re-derived from the embedded block with the audited
      Rung 3 primitives, and the pairing `τ_{J+1−j} ↔ λ_j` is computed at THIS rung — an index slip in the
      prover's assembly and one in the Rung 3 audit would have to coincide to escape.
  (d) **The H6 envelope.** Every enclosure, claimed and own, must sit inside HTW's a priori bracket
      `(2/π²)(1/(jπ)) ≤ λ_j < 1/(jπ)`, evaluated with the auditor's own π — imported published mathematics
      used as a consistency envelope, never as a source of endpoints.

Dependencies are governed by the contract. `auditor_r4b` supplies `RI` and the Gram entries (Rung 1, audited);
`auditor_r4b_a2` supplies `Refusal` (Rung 2, audited); `auditor_r4b_lehmann` supplies the pencil machinery
(Rung 3, audited). Nothing from `problem_dg_profile`, `lehmann`, `sici`, `ivutil`, or `mpmath`. The audit
ladder is cumulative by construction: each rung stands on the audited rungs below it and on nothing else.
"""
import json
from fractions import Fraction

from auditor_r4b import RI, A_entry, pi_ri, ACCEPT, REJECT
from auditor_r4b_a2 import Refusal
import auditor_r4b_lehmann as R3L

__all__ = ['prepare', 'gershgorin_readings', 'own_upper_bounds', 'h6_envelope', 'audit_doc', 'audit_file']


def prepare(n_max):
    """Size the rational grid for the largest series argument this run will touch. Deterministic in n_max."""
    return R3L.prepare(n_max)


def _minmag(z):
    """Smallest magnitude the interval permits: 0 if it straddles zero, else the nearer endpoint."""
    if z.lo <= 0 <= z.hi:
        return Fraction(0)
    return min(abs(z.lo), abs(z.hi))


def _maxmag(z):
    return max(abs(z.lo), abs(z.hi))


def gershgorin_readings(V, K):
    """Build `G_A = VᵀAV`, `G_B = VᵀBV` from the auditor's own entries and return `(L_cons, L_gen)`.

    `L_cons` takes every interval endpoint AGAINST the bound — the auditor's own certified lower bound on
    `λ_j` for `j = len(V)`. `L_gen` takes every endpoint IN THE CLAIM'S FAVOUR — the largest value any sound
    Gershgorin evaluation over valid enclosures of these entries could produce. No slack parameter: the two
    readings are the outward and inward roundings of the same exact expression.

    REFUSES if the conservative reading cannot certify a positive bound.
    """
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

    def scan(diag_end, off_mag, gb_diag_end, gb_off_mag):
        gmin = None
        for i in range(J):
            row = diag_end(GA[i][i])
            for k in range(J):
                if k != i:
                    row -= off_mag(GA[i][k])
            gmin = row if gmin is None else min(gmin, row)
        gmax = None
        for i in range(J):
            row = gb_diag_end(GB[i][i])
            for k in range(J):
                if k != i:
                    row += gb_off_mag(GB[i][k])
            gmax = row if gmax is None else max(gmax, row)
        return gmin, gmax

    gmin_c, gmax_c = scan(lambda z: z.lo, _maxmag, lambda z: z.hi, _maxmag)
    gmin_g, gmax_g = scan(lambda z: z.hi, _minmag, lambda z: z.lo, _minmag)
    if not (gmin_c > 0 and gmax_c > 0):
        raise Refusal('Gershgorin could not certify a positive lower bound (gmin %s, gmax %s)'
                      % (gmin_c, gmax_c))
    if not gmax_g > 0:
        raise Refusal('generous Gershgorin reading has a non-positive denominator (gmax %s)' % gmax_g)
    return gmin_c / gmax_c, gmin_g / gmax_g


def own_upper_bounds(rho, brackets, J):
    """The pairing, computed at this rung: `U_j` from the bracket of `τ_{J+1−j}`, exact rationals throughout.

    `brackets[k−1]` encloses the k-th smallest pencil eigenvalue; `τ_{J+1−j}` bounds `λ_j`. Each bound is the
    exact sup `−ρ − 1/b` over its bracket, with Rung 3's refusal conditions (negativity, order, vacuity).
    """
    return [R3L.upper_bound_from_bracket(rho, *brackets[J - j]) for j in range(1, J + 1)]


def h6_envelope(j):
    """HTW's a priori bracket for `λ_j`, from the auditor's own π: certified-safe endpoints.

    Returns `(env_lo_hi, env_hi_lo)`: an upper bound on `(2/π²)(1/(jπ))` and a lower bound on `1/(jπ)`, so
    that `L ≥ env_lo_hi` certifies `L ≥ (2/π²)λ̃_j` and `U < env_hi_lo` cannot be certified unless it holds.
    """
    pi = pi_ri()
    env_lo = RI(2) / (RI(j) * pi * pi * pi)
    env_hi = RI(1) / (RI(j) * pi)
    return env_lo.hi, env_hi.lo


def _check_envelope(j, L, U, label, findings):
    """The enclosure must sit inside the H6 envelope; a violation falsifies something upstream and is fatal."""
    env_lo_hi, env_hi_lo = h6_envelope(j)
    if not L >= env_lo_hi:
        raise Refusal('%s enclosure for lambda_%d violates the H6 envelope below: L = %.10g < %.10g'
                      % (label, j, float(L), float(env_lo_hi)))
    if not U < env_hi_lo:
        raise Refusal('%s enclosure for lambda_%d violates the H6 envelope above: U = %.10g >= %.10g'
                      % (label, j, float(U), float(env_hi_lo)))
    findings.append('H6 envelope ok for %s lambda_%d — [%.10g, %.10g] inside [%.10g, %.10g]'
                    % (label, j, float(L), float(U), float(env_lo_hi), float(env_hi_lo)))


# ------------------------------------------------------------------------------------------------------------
# the audit
# ------------------------------------------------------------------------------------------------------------

def audit_doc(doc, Ksum=None):
    """Re-derive both halves and the pairing from the certificate's own data and compare. Disjointness is fatal.

    Ordered so the cheap refusals come first: structure, then the exact-rational support checks that need no
    grid at all, then the grid-backed lower halves, then the expensive pencil re-derivation.
    """
    if doc.get('problem') != 'r4b_final':
        return REJECT, ['REJECT: unknown problem %r; the auditor will not accept what it cannot recompute'
                        % doc.get('problem')]
    findings = []

    # 0. structure
    J = int(doc['params']['J'])
    Klow = int(doc['params']['K_lower'])
    enc = [(Fraction(a), Fraction(b)) for a, b in doc['enclosures']]
    Vlow = [[Fraction(c) for c in row] for row in doc['V_lower']]
    pencil = doc['pencil']
    rho = Fraction(pencil['rho'])
    Kp = int(pencil['params']['K'])
    Kbr = int(pencil['params']['K_bracket'])
    Ksum = Ksum or int(pencil.get('audit_Ksum', 80))
    if len(enc) != J or len(Vlow) != J or any(len(row) != Klow for row in Vlow):
        return REJECT, findings + ['REJECT: enclosure or trial-vector shape does not match params']
    Vp = [[Fraction(c) for c in row] for row in pencil['V']]
    Vbr = [[Fraction(c) for c in row] for row in pencil['V_bracket']]
    if len(Vp) != J or any(len(row) != Kp for row in Vp) or len(Vbr) != J or any(len(row) != Kbr for row in Vbr):
        return REJECT, findings + ['REJECT: pencil trial-vector shape does not match pencil params']
    for j in range(1, J + 1):
        L, U = enc[j - 1]
        if not L <= U:
            return REJECT, findings + ['REJECT: claimed pair for lambda_%d is disordered: [%.10g, %.10g]'
                                       % (j, float(L), float(U))]
    findings.append('structure ok — %d ordered pairs, trial shapes consistent' % J)

    # 1. upper support, exact rationals, no grid: each claimed U_j must be >= the exact sup -rho - 1/b over
    #    the certificate's OWN tau bracket, or the claim is unsupported by its own data whatever the true
    #    spectrum does.
    bad = False
    for j in range(1, J + 1):
        k = J + 1 - j
        a, b = Fraction(pencil['tau'][k - 1][0]), Fraction(pencil['tau'][k - 1][1])
        try:
            sup = R3L.upper_bound_from_bracket(rho, a, b)
        except Refusal as e:
            return REJECT, findings + ['REJECT: embedded tau_%d bracket — %s' % (k, e)]
        if enc[j - 1][1] < sup:
            bad = True
            findings.append('REJECT: U_%d = %.10g is below the exact sup %.10g over the certificate\'s own '
                            'bracket — the claim is unsupported by its own data' % (j, float(enc[j - 1][1]), float(sup)))
    if bad:
        return REJECT, findings
    findings.append('upper support ok — every claimed U_j is >= the exact sup over its own tau bracket')

    bits = prepare(max(Ksum, Kbr, Klow))
    findings.append('grid sized to %d bits for Ksum = %d' % (bits, Ksum))

    try:
        # 2. per-j lower halves from the certificate's own trial prefixes, with the two-reading support check
        L_own = []
        for j in range(1, J + 1):
            L_cons, L_gen = gershgorin_readings(Vlow[:j], Klow)
            if enc[j - 1][0] > L_gen:
                return REJECT, findings + [
                    'REJECT: L_%d = %.10g exceeds the generous Gershgorin reading %.10g of its own data — '
                    'the claim is unsupported whatever the true spectrum does'
                    % (j, float(enc[j - 1][0]), float(L_gen))]
            L_own.append(L_cons)
            findings.append('L_%d ok — claimed %.10g, own %.10g, generous %.10g'
                            % (j, float(enc[j - 1][0]), float(L_cons), float(L_gen)))

        # 3. the claimed enclosures against the H6 envelope, own pi
        for j in range(1, J + 1):
            _check_envelope(j, enc[j - 1][0], enc[j - 1][1], 'claimed', findings)

        # 4. shift admissibility from the auditor's own pi and its own Gershgorin on the bracket vectors
        L_J_own, _ = gershgorin_readings(Vbr, Kbr)
        neg_rho = -rho
        h6_hi = Fraction(1, 1) / ((RI(J + 1) * pi_ri()).lo)
        if not neg_rho >= h6_hi:
            raise Refusal('shift fails (H6): -rho = %.8g < %.8g >= 1/((J+1)pi)' % (float(neg_rho), float(h6_hi)))
        if not neg_rho < L_J_own:
            raise Refusal('shift fails the lower half: -rho = %.8g is not below the auditor lower bound %.8g '
                          'on lambda_%d' % (float(neg_rho), float(L_J_own), J))
        findings.append('shift window ok — -rho = %.8g in [%.8g, %.8g)'
                        % (float(neg_rho), float(h6_hi), float(L_J_own)))

        # 5. the pencil re-derived through the audited Rung 3 primitives, own Ksum, own brackets
        A0, A1, A2 = R3L.build_matrices(Vp, Kp, Ksum)
        rr = RI(rho, raw=True)
        Lm = [[A1[i][j] - rr * A0[i][j] for j in range(J)] for i in range(J)]
        Rm = [[A2[i][j] - RI(2) * rr * A1[i][j] + rr * rr * A0[i][j] for j in range(J)] for i in range(J)]
        R3L.certify_posdef(Rm, J)
        findings.append('R certified positive definite by Sylvester criterion')
        cb = R3L.inertia_below(Lm, Rm, R3L.SPAN_HI, J)
        if cb is None or cb < J:
            raise Refusal('count of negative pencil eigenvalues is %s, expected >= %d' % (cb, J))
        brackets = []
        for k in range(1, J + 1):
            a, b = R3L.bracket_tau(Lm, Rm, J, k)
            brackets.append((a, b))
            findings.append('tau_%d own bracket [%.8g, %.8g] width %.3g' % (k, float(a), float(b), float(b - a)))

        # 6. the pairing, computed at this rung, and the auditor's own two-sided enclosures
        U_own = own_upper_bounds(rho, brackets, J)
        for j in range(1, J + 1):
            if not L_own[j - 1] <= U_own[j - 1]:
                raise Refusal('the auditor\'s own halves cross at lambda_%d: L %.10g > U %.10g'
                              % (j, float(L_own[j - 1]), float(U_own[j - 1])))
            _check_envelope(j, L_own[j - 1], U_own[j - 1], 'own', findings)
    except Refusal as e:
        return REJECT, findings + ['REJECT: %s' % e]

    # 7. final comparison: the claimed pair must overlap the auditor's own two-sided enclosure
    for j in range(1, J + 1):
        Lc, Uc = enc[j - 1]
        Lo, Uo = L_own[j - 1], U_own[j - 1]
        if Uc < Lo or Uo < Lc:
            bad = True
            findings.append('REJECT: lambda_%d disjoint — auditor [%.10g, %.10g], claimed [%.10g, %.10g]'
                            % (j, float(Lo), float(Uo), float(Lc), float(Uc)))
        else:
            findings.append('lambda_%d ok — claimed [%.10g, %.10g], own [%.10g, %.10g]'
                            % (j, float(Lc), float(Uc), float(Lo), float(Uo)))
    return (REJECT if bad else ACCEPT), findings


def audit_file(path, Ksum=None):
    with open(path, encoding='utf-8') as f:
        return audit_doc(json.load(f), Ksum)
