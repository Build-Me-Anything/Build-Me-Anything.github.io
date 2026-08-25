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
import sici

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

print('\n[7] THE GRADING TEST FOR THE CLOSED FORM: it must agree with independent quadrature')
# The closed form (Si/Ci) and the direct quadrature share no derivation, so agreement grades both. The default
# quadrature truncates the tail at (4 max(n,m)+5) pi and the tail is ~1/(4 Xi^2), so it carries a RELATIVE ERROR
# OF ORDER 1e-4 - the same order as the 2e-4 tolerance section [4] uses. Extending the truncation must therefore
# walk the quadrature ONTO the closed form; if it walked away, the closed form would be wrong.
for (n, m) in [(1, 2), (2, 3), (1, 4)]:
    cf = P.A_entry(n, m)
    errs = [abs(P.A_entry_quadrature(n, m, b) - cf) / abs(cf) for b in (13, 120, 600)]
    check(f'A_{n}{m}: quadrature converges onto the closed form as the tail is extended',
          errs[0] > errs[1] > errs[2] and errs[2] < mpf('1e-5'),
          f'rel err {mp.nstr(errs[0], 3)} -> {mp.nstr(errs[1], 3)} -> {mp.nstr(errs[2], 3)}')
for n in (1, 3):
    cf = P.A_entry(n, n)
    errs = [abs(P.A_entry_quadrature(n, n, b) - cf) / abs(cf) for b in (13, 600)]
    check(f'A_{n}{n} = 2n*Si(2n*pi): quadrature converges onto it', errs[1] < errs[0] and errs[1] < mpf('1e-5'),
          f'rel err {mp.nstr(errs[0], 3)} -> {mp.nstr(errs[1], 3)}')

print('\n[8] with exact entries, every eigenvalue lies inside the PUBLISHED ROUNDING INTERVAL')
# The paper quotes four decimals, so a published 0.2896 means [0.28955, 0.28965]. Landing inside that is a far
# stronger statement than agreeing to 2e-4, and it only became available once the entries stopped carrying the
# quadrature tail error. This is the check that would catch a transcription error the loose one would not.
ev16 = P.galerkin_eigenvalues(24)   # K=16 clears the interval by only 7e-9 on lambda_2; K=24 by 6.9e-6
for i in range(6):
    pub = P.PUBLISHED[i]
    lo_, hi_ = pub - mpf('0.00005'), pub + mpf('0.00005')
    check(f'lambda_{i+1} inside the rounding interval of {mp.nstr(pub, 4)}', lo_ <= ev16[i] <= hi_,
          f'ours {mp.nstr(ev16[i], 9)} in [{mp.nstr(lo_, 6)}, {mp.nstr(hi_, 6)}]')


print('\n[9] RIGOROUS enclosures of Si and Ci, by convergent series with a proved remainder')
# The first of the two pieces the R4b certificate needs. Graded against mpmath's own si/ci, which share no
# implementation with sici.py: mpmath uses asymptotic and continued-fraction machinery, this uses the Maclaurin
# series with a Leibniz bound. Containment of an independently computed value is the check that matters.
#
# The comparison is made at 60 digits ON PURPOSE. These enclosures are ~1e-50 wide, which is NARROWER than this
# suite's ambient 35-digit working precision, so at the ambient precision both endpoints and the reference round
# to the same number and the containment test degenerates. A first version of this block did exactly that and
# reported four failures that were entirely an artefact of comparing a tight interval at loose precision.
def encloses(interval, ref_fn, x):
    with mp.workdps(60):
        ref = ref_fn(mpf(x))
        return mpf(interval.a) <= ref <= mpf(interval.b)


def iv_width(interval):
    with mp.workdps(60):
        return mpf(interval.b) - mpf(interval.a)


for x in (1, 5, 20, 50):
    e = sici.si(x)
    check(f'Si({x}) enclosure contains mpmath, width {mp.nstr(iv_width(e), 3)}',
          encloses(e, mp.si, x) and iv_width(e) < mpf('1e-40'))
for x in (1, 5, 20, 50):
    e = sici.ci(x)
    check(f'Ci({x}) enclosure contains mpmath, width {mp.nstr(iv_width(e), 3)}',
          encloses(e, mp.ci, x) and iv_width(e) < mpf('1e-40'))

print('\n[10] at the points R4b actually needs them: x = 2n*pi')
for n in (1, 2, 8, 24):
    es, ec = sici.si_at_2npi(n), sici.ci_at_2npi(n)
    with mp.workdps(60):
        x = 2 * n * mp.pi
        ok = (mpf(es.a) <= mp.si(x) <= mpf(es.b)) and (mpf(ec.a) <= mp.ci(x) <= mpf(ec.b))
    check(f'Si and Ci at 2*{n}*pi both enclose mpmath', ok,
          f'widths {mp.nstr(iv_width(es), 3)} / {mp.nstr(iv_width(ec), 3)}')

print('\n[11] it must REFUSE where the Leibniz hypothesis has not been established')
# The remainder bound is valid only once the terms are decreasing, which needs 2k+3 > x. Truncating earlier and
# applying it anyway would not be a weaker bound, it would be a false one - so the module raises instead.
refused = False
try:
    sici.si(50, terms=5)
except ValueError:
    refused = True
check('si() refuses to bound a series truncated before the terms provably decrease', refused)
ok_when_enough = True
try:
    sici.si(50, terms=200)
except ValueError:
    ok_when_enough = False
check('si() returns a bound once enough terms are summed', ok_when_enough)

print('\n[12] the matrix entries as certified intervals')
for (n, m) in [(1, 1), (2, 2), (1, 2), (2, 3), (3, 7), (1, 12)]:
    e = P.A_entry_enclosure(n, m)
    v = P.A_entry(n, m)
    check(f'A_{n},{m} enclosure contains the closed-form value',
          mpf(e.a) <= v <= mpf(e.b), f'width {mp.nstr(mpf(e.b) - mpf(e.a), 3)}')


print('\n[13] A CERTIFIED two-sided bracket on the six eigenvalues')
# The lower half is ours and is the payoff of the certified entries: by Courant-Fischer on V, ANY j-dimensional
# trial subspace of V gives lambda_j >= min of the Rayleigh quotient over it, so Rayleigh-Ritz bounds from below
# with no truncation estimate at all. The upper half is Corollary 3.7 of the source, used as a citation - this
# module derives no upper bound, and the bracket's width is set by how loose that corollary is.
BR = P.certified_bracket(K=16, J=6)
for j, (lo_, hi_) in enumerate(BR, start=1):
    check(f'lambda_{j}: a bracket was produced rather than a refusal', lo_ is not None and hi_ is not None)
for j, (lo_, hi_) in enumerate(BR, start=1):
    check(f'lambda_{j} bracket is non-empty and ordered', lo_ < hi_,
          f'[{mp.nstr(lo_, 10)}, {mp.nstr(hi_, 10)})')
# The published values are rounded to four decimals, so 0.0773 stands for the interval [0.07725, 0.07735] and
# comparing a certified bound against the rounded NUMBER is a category error. It bit here: the certified lower
# bound for lambda_4 is 0.0773064, which exceeds the printed 0.0773 while sitting comfortably inside what 0.0773
# actually denotes - our bound is sharper than the published value's own precision. The check is therefore that
# the certified bracket INTERSECTS the rounding interval.
for j, (lo_, hi_) in enumerate(BR, start=1):
    pub = P.PUBLISHED[j - 1]
    plo, phi = pub - mpf('0.00005'), pub + mpf('0.00005')
    check(f'lambda_{j}: the certified bracket is consistent with the published value',
          lo_ <= phi and hi_ >= plo,
          f'[{mp.nstr(lo_, 9)}, {mp.nstr(hi_, 9)}) meets [{mp.nstr(plo, 6)}, {mp.nstr(phi, 6)}]')
for j, (lo_, hi_) in enumerate(BR, start=1):
    ev = P.galerkin_eigenvalues(16)[j - 1]
    check(f'lambda_{j}: the certified lower bound does not exceed the Rayleigh-Ritz value',
          lo_ <= ev, f'{mp.nstr(lo_, 10)} <= {mp.nstr(ev, 10)}')

print('\n[14] the certified lower bound must BEAT the published one, or it is not worth having')
# Quoted against the CONSERVATIVE reading of Corollary 3.7 - see the warning in P.bracket, where this file's
# prose and its own formula disagree about whether the published lower bound is 0.2026/n or 0.06450/n. Using the
# tighter of the two makes this claim harder to satisfy, which is the right direction when the source has not
# been re-read.
for j, (lo_, hi_) in enumerate(BR, start=1):
    published_lower = (2 / MPPI ** 2) / j
    check(f'lambda_{j}: certified lower beats the published lower', lo_ > published_lower,
          f'{mp.nstr(lo_, 8)} > {mp.nstr(published_lower, 8)}  (x{mp.nstr(lo_ / published_lower, 3)})')


print('\n' + ('R4b: ALL PASS' if not FAILS else f'R4b: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\nSCOPE: the Galerkin numbers are ORDINARY numerics, not a certificate. What IS established here is that')
print('       the operator is transcribed correctly and our discretisation reproduces the paper.')
print('       The A_{nm} are CLOSED FORMS in Si and Ci, enclosed rigorously by sici.py, and certified_bracket')
print('       turns them into a genuine two-sided bracket on lambda_1..lambda_6. But the LOWER half is ours')
print('       (Courant-Fischer, no truncation estimate needed) and the UPPER half is Corollary 3.7 of the')
print('       source, used as a citation. No upper bound is derived here, so the Galerkin truncation error is')
print('       bounded by the bracket width without an argument of ours. Lehmann-Maehly-Goerisch is the route')
print('       to a self-derived upper bound; it is NOT implemented.')
sys.exit(1 if FAILS else 0)
