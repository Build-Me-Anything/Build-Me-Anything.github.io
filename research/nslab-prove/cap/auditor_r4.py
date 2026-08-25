"""Machine C for R4 — an independent re-check of a compact-operator eigenpair certificate, in exact rationals.

**Imports `fractions`, `json` and `math` and nothing else.** No `ell1`, no `radiipoly`, no `problem_eigen`, no
mpmath — a structural test in `test_audit.py` asserts it. The reason is the one that justifies Machine C at all:
every suite in `cap/` shares an author *and* an implementation with the code it tests, so a shared misconception
passes through both. R4 and R4b were, until this file existed, the only rungs with no independent check.

How this audit differs from the prover's argument
--------------------------------------------------
The prover builds `DF(v̄, λ̄)` as an (N+1)² real matrix, inverts it numerically by Gauss–Jordan to get the
preconditioner A, and evaluates every bound through interval arithmetic. **None of that is reproduced here.**
This module never forms a matrix and never inverts anything. It reconstructs the operator from the certificate's
parameters, computes the residual of the certificate's own ā in exact rational arithmetic, and uses the one part
of A that is known in closed form — `−1/λ̄` times the identity above mode N — to reach Y₀ directly.

That is possible only because the certificate is emitted on the **dyadic instance** with its perturbation placed
**above N**; `emit_certs.emit_eigen` explains both choices, and neither is a convenience. On the geometric
instance (`d_m = 1/m²`) the eigenvector is not dyadic, so prover and auditor would not denote the same numbers and
a 1e-45 disagreement could not be told from a real one. That instance therefore remains prover-checked only, and
this file does not pretend otherwise.

What is checked, and in which direction
---------------------------------------
1. **Structure.** ν/vbase < 1, without which ‖v̄‖_ν diverges and the claim is vacuous; the phase condition
   ⟨v̄, w⟩ = 1; and the eigen relation itself on the unperturbed modes.
2. **Y₀ is not an under-estimate.** Recomputed exactly from ā and the reconstructed operator. The operator is
   rebuilt from `params`, never from ā, so altering a coefficient of ā changes the residual and is caught.
3. **Z₂ ≥ 1/λ̄** and **Z₁ ≥ 2·τ(N+1)/λ̄**, both A-independent lower bounds implied by A's tail block.
4. **Z₁ < 1**, and **p(r) < 0** in exact arithmetic.

Only under-estimates are rejected. A bound larger than necessary is blunt, not wrong, and blunt certificates are
accepted — the same asymmetry as `auditor.py`.
"""
import json
from fractions import Fraction

ACCEPT = 'ACCEPT'
REJECT = 'REJECT'


def F(x):
    return x if isinstance(x, Fraction) else Fraction(str(x))


def _short(x, digits=8):
    if x.denominator == 1:
        return str(x.numerator)
    return '%.*g' % (digits, x.numerator / x.denominator)


def recompute(params, abar):
    """Rebuild the operator from `params` alone and return the exact residual of `abar`.

    The operator is defined by the certificate's parameters:  d_m = dbase^-m,  u_m = vbase^-m (lam - d_m),
    w = {1: vbase}.  Deliberately NOT read off ā — if u were derived from ā, a tampered ā would move the operator
    with it and the residual would stay zero, which is precisely the tamper this check has to catch.
    """
    N = int(params['N']); M = int(params['M'])
    lam = F(params['lam']); nu = F(params['nu'])
    vbase = int(params['vbase']); dbase = int(params['dbase'])

    d = [None] + [Fraction(1, dbase ** m) for m in range(1, M + 1)]
    u = [None] + [Fraction(1, vbase ** m) * (lam - d[m]) for m in range(1, M + 1)]

    s = vbase * abar[0][0]                       # <v, w> with w = {1: vbase}
    phase_res = s - 1

    res = [None] + [abar[m - 1][0] * (d[m] - lam) + u[m] * s for m in range(1, M + 1)]

    tail_norm = sum((abs(res[m]) * nu ** m for m in range(N + 1, M + 1)), Fraction(0))
    head_norm = sum((abs(res[m]) * nu ** m for m in range(1, N + 1)), Fraction(0))

    return {
        'N': N, 'M': M, 'lam': lam, 'nu': nu, 'vbase': vbase, 'dbase': dbase,
        'phase_res': phase_res, 'head_norm': head_norm, 'tail_norm': tail_norm,
        # A is -(1/lam) * identity above N, so a residual confined above N maps through a known closed form.
        'Y0_true': tail_norm / lam,
        'Z2_min': 1 / lam,
        # tau(n) = |d_n| for n beyond w's support, decreasing, so sup over n > N is tau(N+1); A's tail block
        # contributes 1/lam and ||A|| >= 1/lam, giving Z1 >= (1/lam + 1/lam) * tau(N+1).
        'Z1_tail_min': 2 * Fraction(1, dbase ** (N + 1)) / lam,
    }


def audit(doc):
    """Re-check an R4 eigenpair certificate. Returns (verdict, findings)."""
    findings = []

    def fail(msg):
        findings.append('REJECT: ' + msg)

    if doc.get('problem') != 'eigen_dyadic':
        return REJECT, ['REJECT: unknown problem "%s"; the auditor will not accept what it cannot recompute'
                        % doc.get('problem')]

    p = doc['params']
    Y0 = F(doc['bounds']['Y0']); Z1 = F(doc['bounds']['Z1']); Z2 = F(doc['bounds']['Z2'])
    r = F(doc['r'])
    abar = [(F(re), F(im)) for re, im in doc['abar']]

    if len(abar) != int(p['M']):
        return REJECT, ['REJECT: abar has %d entries, params say M = %s' % (len(abar), p['M'])]
    if any(im != 0 for _re, im in abar):
        return REJECT, ['REJECT: this instance is real; a non-zero imaginary part means the certificate is not '
                        'the object the auditor knows how to recompute']

    ref = recompute(p, abar)
    lam, nu, vbase, dbase, N = ref['lam'], ref['nu'], ref['vbase'], ref['dbase'], ref['N']

    # --- 1. structure ---------------------------------------------------------------------------------------
    if nu * Fraction(1, vbase) >= 1:
        fail('nu/vbase = %s >= 1, so ||vbar||_nu diverges and the certificate is about nothing.'
             % _short(nu * Fraction(1, vbase)))
    if ref['phase_res'] != 0:
        fail('the phase condition <vbar, w> = 1 fails by %s; the system the bounds describe is not this one.'
             % _short(ref['phase_res']))
    if lam <= 0:
        fail('lambda = %s must be positive here: A uses -1/lambda on the tail.' % _short(lam))

    # --- 2. the residual must be confined above N, or Y0 is not auditable -----------------------------------
    if ref['head_norm'] != 0:
        fail('the residual does not vanish on modes 1..%d (norm there = %s). Y0 would then depend on the '
             'prover numerically inverted block, which this auditor deliberately cannot reproduce, so the '
             'certificate is not independently checkable and is not accepted.'
             % (N, _short(ref['head_norm'])))
    else:
        # --- 3. Y0 must not be an under-estimate ------------------------------------------------------------
        if Y0 < ref['Y0_true']:
            fail('Y0 = %s is BELOW the true value %s. The certificate claims a smaller residual than abar '
                 'actually has, which is the fatal direction.' % (_short(Y0), _short(ref['Y0_true'])))

    # --- 4. A-independent lower bounds on Z1 and Z2 ---------------------------------------------------------
    if Z2 < ref['Z2_min']:
        fail('Z2 = %s is BELOW the minimum %s implied by ||A|| >= 1/lambda.' % (_short(Z2), _short(ref['Z2_min'])))
    if Z1 < ref['Z1_tail_min']:
        fail('Z1 = %s is BELOW the tail contribution %s that compactness alone forces.'
             % (_short(Z1), _short(ref['Z1_tail_min'])))

    # --- 5. the contraction itself --------------------------------------------------------------------------
    if Z1 >= 1:
        fail('Z1 = %s >= 1; no radius can satisfy the contraction.' % _short(Z1))
    if r <= 0:
        fail('r = %s must be positive.' % _short(r))
    pr = Z2 * r * r - (1 - Z1) * r + Y0
    if pr >= 0:
        fail('p(r) = %s is not negative at the claimed r = %s.' % (_short(pr), _short(r)))

    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    if verdict == ACCEPT:
        findings.append('Y0 recomputed exactly: %s (claimed %s)' % (_short(ref['Y0_true']), _short(Y0)))
        findings.append('p(r) = %s < 0, Z1 = %s < 1' % (_short(pr), _short(Z1)))
    return verdict, findings


def audit_file(path):
    with open(path, encoding='utf-8') as f:
        return audit(json.load(f))


if __name__ == '__main__':
    import sys
    v, fs = audit_file(sys.argv[1] if len(sys.argv) > 1 else 'certs/certificate-r4-eigen.json')
    print(v)
    for f in fs:
        print('  ' + f)
    sys.exit(0 if v == ACCEPT else 1)
