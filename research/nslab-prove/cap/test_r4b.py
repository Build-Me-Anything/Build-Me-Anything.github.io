"""R4b test suite — the De Gregorio profile operator, graded against Huang-Tong-Wei.

This is the first time this project's rigorous line touches the actual De Gregorio profile problem with numbers
that can be compared against a paper. Four externally-known things are used, and each grades a different piece:

  * **Castro's exact identity** M(Ω₀) = 0, with (−Δ)^{−1/2}Ω₀ = −x on [−1,1] and c(Ω₀) = −1 — grades the
    transcription of the OPERATOR itself, independently of any eigenvalue;
  * the **comparison spectrum** λ̃_n = 1/(nπ), exact, in the same space with the same inner product;
  * the **rigorous two-sided bracket** (2/π²)λ̃_n ≤ λ_n < λ̃_n (their Corollary 3.7) — an acceptance gate any
    computed eigenvalue must pass, with a strict upper bound;
  * the **six published eigenvalues** 0.2896, 0.1509, 0.1022, 0.0773, 0.0622, 0.0520.

What is NOT claimed: the Galerkin computation is ordinary numerics. Certifying λf = M(f) needs rigorous enclosures
of the matrix entries A_{nm} — improper integrals — plus a proven tail bound, and neither exists yet.

Run:  python test_r4b.py     (about a minute; the quadrature is the slow part)
"""
import sys
from mpmath import mp, mpf, pi as MPPI
import problem_dg_profile as P

mp.dps = 20
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


# --------------------------------------------------------------------------------------------------------
print('\n[1] Castro\'s exact identity grades the OPERATOR, before any eigenvalue is computed')
# (-Delta)^{-1/2} Omega_0 = -x on [-1,1]. The closed form is the paper's; the quadrature is an independent
# evaluation of the defining integral. If these disagree, either the transcription or the definition is wrong,
# and the error would propagate silently into everything built on it.
for x in ('0.3', '0.6', '-0.45', '0.8'):
    cf = P.inv_sqrt_laplacian_castro(x)
    nq = P.inv_sqrt_laplacian_castro_numeric(x)
    check(f'x={x}: closed form matches the defining integral', abs(cf - nq) < mpf('2e-3'),
          f'closed {mp.nstr(cf, 10)}  quad {mp.nstr(nq, 10)}  diff {mp.nstr(abs(cf - nq), 3)}')
check('closed form is exactly -x on [-1,1]',
      all(P.inv_sqrt_laplacian_castro(v) == -mpf(v) for v in ('0.1', '0.5', '0.9', '-0.7')))
check('c(Omega_0) = -1 exactly, as the paper states', P.c_functional_castro() == -1,
      mp.nstr(P.c_functional_castro(), 10))

# --------------------------------------------------------------------------------------------------------
print('\n[2] the comparison operator has the exact spectrum 1/(n*pi)')
for n in (1, 2, 5, 10):
    check(f'lambda~_{n} = 1/({n}pi)', P.comparison_eigenvalue(n) == 1 / (n * MPPI),
          mp.nstr(P.comparison_eigenvalue(n), 12))

# --------------------------------------------------------------------------------------------------------
print('\n[3] the published bracket, and it must have teeth')
for n in range(1, 7):
    a, b = P.bracket(n)
    pub = P.PUBLISHED[n - 1]
    check(f'n={n}: published lambda_{n} lies in [{mp.nstr(a, 5)}, {mp.nstr(b, 5)})', P.in_bracket(n, pub),
          f'published {mp.nstr(pub, 6)}')
# the upper bound is STRICT: lambda~_n itself must be rejected
check('the bracket rejects lambda~_n itself (upper bound is strict)',
      not P.in_bracket(1, P.comparison_eigenvalue(1)), 'strictness matters - it is a theorem, not a convenience')
check('the bracket rejects a value below the lower bound', not P.in_bracket(1, mpf('0.01')))
check('the bracket rejects a value above the upper bound', not P.in_bracket(1, mpf('0.5')))

# --------------------------------------------------------------------------------------------------------
print('\n[4] THE GRADING TEST: our sine-basis Galerkin reproduces their six published eigenvalues')
ev8 = P.galerkin_eigenvalues(8)
for i in range(6):
    lam, pub = ev8[i], P.PUBLISHED[i]
    check(f'lambda_{i+1} agrees with {mp.nstr(pub, 4)} to 2e-4', abs(lam - pub) < mpf('2e-4'),
          f'ours {mp.nstr(lam, 8)}  published {mp.nstr(pub, 4)}  diff {mp.nstr(abs(lam - pub), 3)}')

print('\n[5] every computed eigenvalue must pass the published bracket')
for i in range(6):
    check(f'lambda_{i+1} inside the Corollary 3.7 bracket', P.in_bracket(i + 1, ev8[i]),
          f'{mp.nstr(ev8[i], 8)}')

print('\n[6] Galerkin converges monotonically from below, as a projected supremum must')
ev4 = P.galerkin_eigenvalues(4)
ok = all(ev4[i] < ev8[i] for i in range(4)) and all(ev8[i] < P.bracket(i + 1)[1] for i in range(4))
check('K=4 values lie below K=8 values, and both below the upper bracket', ok,
      f'lambda_1: {mp.nstr(ev4[0], 8)} -> {mp.nstr(ev8[0], 8)} < {mp.nstr(P.bracket(1)[1], 8)}')

print('\n' + ('R4b: ALL PASS' if not FAILS else f'R4b: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\nSCOPE: the Galerkin numbers are ORDINARY numerics, not a certificate. Certifying lambda*f = M(f) needs')
print('       rigorous enclosures of A_{nm} and a proven tail bound; neither exists yet. What IS established here')
print('       is that the operator is transcribed correctly and our discretisation reproduces the paper.')
sys.exit(1 if FAILS else 0)
