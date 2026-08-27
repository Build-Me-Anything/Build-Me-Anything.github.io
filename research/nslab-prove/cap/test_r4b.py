"""R4b test suite — the De Gregorio profile operator, graded against Huang-Tong-Wei.

This is the first time this project's rigorous line touches the actual De Gregorio profile problem with numbers
that can be compared against a paper. Four externally-known things are used, and each grades a different piece:

  * **Castro's exact identity** M(Ω₀) = 0, with (−Δ)^{−1/2}Ω₀ = −x on [−1,1] and c(Ω₀) = −1 — grades the
    transcription of the OPERATOR itself, independently of any eigenvalue;
  * the **comparison spectrum** λ̃_n = 1/(nπ), exact, in the same space with the same inner product;
  * the **rigorous two-sided bracket** (2/π²)λ̃_n ≤ λ_n < λ̃_n (their Corollary 3.9) — an acceptance gate any
    computed eigenvalue must pass, with a strict upper bound;
  * the **six published eigenvalues** 0.2896, 0.1509, 0.1022, 0.0773, 0.0622, 0.0520.

What is NOT claimed: the Galerkin computation is ordinary numerics. Certifying λf = M(f) needs rigorous enclosures
of the matrix entries A_{nm} — improper integrals — plus a proven tail bound, and neither exists yet.

Run:  python test_r4b.py     (about a minute; the quadrature is the slow part)
"""
import sys
from mpmath import mp, mpf, pi as MPPI
from mpmath import iv
import problem_dg_profile as P
import sici
import lehmann
from ivutil import lo, hi

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
    check(f'lambda_{i+1} inside the Corollary 3.9 bracket', P.in_bracket(i + 1, ev8[i]),
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
# `terms` is a FLOOR, not a cap - the summation continues until the hypothesis holds AND the first omitted term
# is negligible - so the refusal is provoked with max_terms, which caps it.
refused = False
try:
    sici.si(50, max_terms=5)
except ValueError:
    refused = True
check('si() refuses when capped before the terms provably decrease', refused)
refused_useless = False
try:
    sici.si(50, max_terms=60)      # past the hypothesis (2k+3 > 50 at k = 24) but the term is still huge
except ValueError:
    refused_useless = True
check('si() refuses a bound that would be sound but uselessly wide', refused_useless)
ok_when_enough = True
try:
    sici.si(50)
except ValueError:
    ok_when_enough = False
check('si() returns a bound when left to run to convergence', ok_when_enough)

print('\n[12] the matrix entries as certified intervals')
for (n, m) in [(1, 1), (2, 2), (1, 2), (2, 3), (3, 7), (1, 12)]:
    e = P.A_entry_enclosure(n, m)
    v = P.A_entry(n, m)
    check(f'A_{n},{m} enclosure contains the closed-form value',
          mpf(e.a) <= v <= mpf(e.b), f'width {mp.nstr(mpf(e.b) - mpf(e.a), 3)}')


print('\n[13] A CERTIFIED two-sided bracket on the six eigenvalues')
# The lower half is ours and is the payoff of the certified entries: by Courant-Fischer on V, ANY j-dimensional
# trial subspace of V gives lambda_j >= min of the Rayleigh quotient over it, so Rayleigh-Ritz bounds from below
# with no truncation estimate at all. The upper half is Corollary 3.9 of the source, used as a citation - this
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
# Quoted against the CONSERVATIVE reading of Corollary 3.9 - see the warning in P.bracket, where this file's
# prose and its own formula disagree about whether the published lower bound is 0.2026/n or 0.06450/n. Using the
# tighter of the two makes this claim harder to satisfy, which is the right direction when the source has not
# been re-read.
for j, (lo_, hi_) in enumerate(BR, start=1):
    published_lower = (2 / MPPI ** 2) / j
    check(f'lambda_{j}: certified lower beats the published lower', lo_ > published_lower,
          f'{mp.nstr(lo_, 8)} > {mp.nstr(published_lower, 8)}  (x{mp.nstr(lo_ / published_lower, 3)})')


print('\n[15] LEHMANN-MAEHLY: the machinery, graded on the comparison operator')
# The complement to Rayleigh-Ritz - upper bounds where Courant-Fischer gives only lower ones. Graded on the
# source's comparison operator M~, where M~ s_n = lambda~_n s_n makes all three Lehmann matrices exact and the
# spectrum is known in closed form. Trial vectors are perturbed eigenvectors, so the method has to work.
#
# NOTE this test cannot show Lehmann beating Corollary 3.9, because on M~ the corollary is an EQUALITY by
# construction - lambda~_n IS that operator's spectrum. What it shows is that the bounds are VALID and that they
# converge as the trial space improves, which is what grades an implementation.
LK, LJ = 12, 4
LLAM = [mpf(1) / (k * MPPI) for k in range(1, LK + 1)]
LB = [(k * MPPI) ** 2 for k in range(1, LK + 1)]


def _lehmann_run(eps):
    C = []
    for j in range(LJ):
        v = [mpf(0)] * LK
        v[j] = mpf(1)
        for i in range(LK):
            if i != j:
                v[i] = mpf(eps) / (1 + abs(i - j))
        C.append(v)
    A0 = [[iv.mpf(0)] * LJ for _ in range(LJ)]
    A1 = [[iv.mpf(0)] * LJ for _ in range(LJ)]
    A2 = [[iv.mpf(0)] * LJ for _ in range(LJ)]
    for a in range(LJ):
        for b in range(LJ):
            s0 = s1 = s2 = iv.mpf(0)
            for n in range(LK):
                w = iv.mpf(C[a][n]) * iv.mpf(C[b][n]) * iv.mpf(LB[n])
                s0 = s0 + w
                s1 = s1 - iv.mpf(LLAM[n]) * w
                s2 = s2 + iv.mpf(LLAM[n]) ** 2 * w
            A0[a][b], A1[a][b], A2[a][b] = s0, s1, s2
    rho = -(LLAM[3] + LLAM[4]) / 2
    return lehmann.upper_bounds(A0, A1, A2, rho, LJ, LJ), rho


# the shift's hypothesis: exactly LJ eigenvalues of T = -M~ below rho, i.e. lambda_5 < -rho < lambda_4
_, rho_used = _lehmann_run('0.05')
check('the shift rho satisfies its hypothesis (lambda_5 < -rho < lambda_4)',
      LLAM[4] < -rho_used < LLAM[3], f'-rho = {mp.nstr(-rho_used, 8)}')

gaps = []
for eps, label in (('0.3', 'crude'), ('0.05', 'better'), ('0.005', 'good')):
    ub, _ = _lehmann_run(eps)
    ok = all(u is not None and u >= LLAM[j] for j, u in enumerate(ub))
    check(f'{label} trial space: every Lehmann bound is a genuine UPPER bound', ok,
          '' if ok else str([mp.nstr(u, 8) if u else None for u in ub]))
    gaps.append(max((u - LLAM[j]) / LLAM[j] for j, u in enumerate(ub) if u is not None))

check('the bounds sharpen as the trial space improves', gaps[0] > gaps[1] > gaps[2],
      f'worst relative gap {mp.nstr(gaps[0], 3)} -> {mp.nstr(gaps[1], 3)} -> {mp.nstr(gaps[2], 3)}')
check('sharpening is quadratic in the trial-space error, as Lehmann predicts',
      gaps[2] < gaps[1] / 20 and gaps[1] < gaps[0] / 20)

print('\n[16] the inertia count must REFUSE rather than guess')
# The bracket is established by Sylvester inertia counting through an interval LDL^T. A pivot whose enclosure
# straddles zero makes the sign - and so the count - undecidable, and inertia_below returns None there. A bisection
# that treated None as a number would silently return a bracket resting on a coin flip.
A0d = [[iv.mpf(1) if i == j else iv.mpf(0) for j in range(2)] for i in range(2)]
A1d = [[iv.mpf(0) for _ in range(2)] for _ in range(2)]
A2d = [[iv.mpf(1) if i == j else iv.mpf(0) for j in range(2)] for i in range(2)]
singular_t = lehmann.inertia_below(A0d, A0d, 1, 2)      # L - tR = 0 exactly: every pivot straddles nothing but 0
check('inertia_below returns None when a pivot cannot be signed', singular_t is None,
      f'got {singular_t}')
check('inertia_below counts correctly when the pivots are decided',
      lehmann.inertia_below(A1d, A2d, mpf('0.5'), 2) == 2)
check('bracket_tau refuses when the requested index is not bracketed',
      lehmann.bracket_tau(A1d, A2d, 2, 1, mpf('-10'), mpf('-5')) is None)


print('\n[17] A2 = A^T B^-1 A: the Lehmann matrix, with no Hilbert transform')
# M maps V into V and {s_k} is a basis of V, so M s_m = sum_k c_km s_k with c_nm = A_nm/(n^2 pi^2), giving
# A2_ij = sum_k A_ki A_kj/(k^2 pi^2). The object that blocked Lehmann is the matrix already certified, and the
# tail bound on that sum IS the Galerkin truncation bound this rung was missing - the two open problems were one.
#
# The reference values come from a genuinely INDEPENDENT route: A2 computed from the operator instead, via the
# source's identity d_x M(f) = -chi(H f + c(f)) with c(f) = -(1/2) int H f, which needs the Hilbert transform of
# a truncated sine and a nested principal-value quadrature. Computed at dps=15, so they are good to ~1e-10.
A2_REF = {(1, 1): '0.818798671591', (1, 2): '0.123900951841',
          (2, 2): '0.913366238315', (2, 3): '0.06869751436'}
for (i, j), r in A2_REF.items():
    e = P.A2_enclosure(i, j)
    check(f'A2_{i},{j} encloses the independently computed value',
          lo(e) <= mpf(r) <= hi(e), f'[{mp.nstr(lo(e), 10)}, {mp.nstr(hi(e), 10)}] vs {r}')

e_ij, e_ji = P.A2_enclosure(1, 3), P.A2_enclosure(3, 1)
check('A2 is symmetric', lo(e_ij) <= hi(e_ji) and lo(e_ji) <= hi(e_ij))

print('\n[18] the truncation tail is bounded, and the bound behaves')
widths = [hi(P.A2_enclosure(1, 1, K=K)) - lo(P.A2_enclosure(1, 1, K=K)) for K in (40, 80, 160)]
check('the enclosure narrows as K grows', widths[0] > widths[1] > widths[2],
      f'{mp.nstr(widths[0], 3)} -> {mp.nstr(widths[1], 3)} -> {mp.nstr(widths[2], 3)}')
t1, t2 = P.A2_tail_bound(1, 1, 40), P.A2_tail_bound(1, 1, 160)
check('the tail bound itself falls like K^-3 (four-fold K, ~64-fold drop)',
      hi(t2) * 30 < hi(t1), f'{mp.nstr(hi(t1), 3)} -> {mp.nstr(hi(t2), 3)}')

refused = False
try:
    P.A2_tail_bound(4, 4, 5)          # K < 2*max(i,j): the entry bound does not hold for every term
except ValueError:
    refused = True
check('A2_tail_bound refuses when K is too small for its own entry bound', refused)

print('\n[19] the two lemmas the tail bound rests on')
# |Ci(x)| <= 2/x, from Ci(x) = sin(x)/x - int_x^inf sin t/t^2 dt. Checked against the certified Ci enclosures.
for x in (2, 10, 60, 150):
    b = P._ci_tail_bound(x)
    c = sici.ci(x)
    check(f'|Ci({x})| <= 2/{x}', max(abs(lo(c)), abs(hi(c))) <= hi(b),
          f'|Ci| = {mp.nstr(max(abs(lo(c)), abs(hi(c))), 4)} <= {mp.nstr(hi(b), 4)}')

# and the blunt entry bound must actually bound the entry, for every k >= 2m
for m in (1, 2, 3):
    ok = True
    for k in (2 * m, 3 * m, 10 * m, 40 * m):
        if abs(P.A_entry(k, m)) > hi(P.A_entry_abs_bound(k, m)):
            ok = False
    check(f'|A_k,{m}| <= A_entry_abs_bound for k = 2m, 3m, 10m, 40m', ok)


print('\n[20] LEHMANN ON M: certified UPPER bounds, and the bracket closed from both sides')
# The payoff. Feeding A2 = A^T B^-1 A through Lehmann gives upper bounds on lambda_j for the REAL operator, so
# the enclosure no longer borrows Corollary 3.9 for its answer. The corollary is still load-bearing, but only as
# an a priori input for choosing the shift - it supplies lambda_{J+1} < 1/((J+1)pi), which with our certified
# lower bound on lambda_J establishes the hypothesis "exactly J eigenvalues of T = -M lie below rho".
UB, RHO, WIN = P.certified_upper_bounds(K=8, J=3, Ksum=80)
BR3 = P.certified_bracket(K=16, J=3)

check('the shift window is non-empty (Cor 3.9 on lambda_4 below our lower bound on lambda_3)',
      WIN[0] < WIN[1], f'-rho in [{mp.nstr(WIN[0], 8)}, {mp.nstr(WIN[1], 8)}), used {mp.nstr(-RHO, 8)}')
check('the shift actually lies in its own window', WIN[0] <= -RHO < WIN[1])

for j in range(3):
    check(f'lambda_{j+1}: a Lehmann upper bound was isolated', UB[j] is not None)
for j in range(3):
    check(f'lambda_{j+1}: upper bound is above our certified lower bound', BR3[j][0] <= UB[j],
          f'[{mp.nstr(BR3[j][0], 10)}, {mp.nstr(UB[j], 10)}]  width {mp.nstr(UB[j] - BR3[j][0], 4)}')
for j in range(3):
    cor = 1 / ((j + 1) * MPPI)
    check(f'lambda_{j+1}: Lehmann BEATS Corollary 3.9', UB[j] < cor,
          f'{mp.nstr(UB[j], 10)} < {mp.nstr(cor, 10)}')
for j in range(3):
    pub = P.PUBLISHED[j]
    plo, phi = pub - mpf('0.00005'), pub + mpf('0.00005')
    check(f'lambda_{j+1}: the two-sided bracket is consistent with the published value',
          BR3[j][0] <= phi and UB[j] >= plo)

# Careful with this one - there are TWO published numbers and they are different objects. lambda~_n = 1/(n pi)
# is an a priori UPPER BOUND, not an estimate of lambda_n. The Appendix-A values 0.2896, 0.1509, ... ARE
# estimates, printed to four decimals. The check below is against the SECOND: our certified width is narrower
# than the +-5e-5 implied by how precisely they printed their own estimate. It is NOT a claim about 1/pi, and
# NOT a claim that their underlying mathematics is good only to four decimals.
check('lambda_1: certified width is below the precision at which the Appendix-A estimate is printed',
      UB[0] - BR3[0][0] < mpf('0.0001'),
      f'width {mp.nstr(UB[0] - BR3[0][0], 4)} vs the +-5e-5 implied by the printed {mp.nstr(P.PUBLISHED[0], 4)}')

refused = False
try:
    P.certified_upper_bounds(K=8, J=3, Ksum=10)     # Ksum < 2K: the vector tail bound does not hold
except ValueError:
    refused = True
check('certified_upper_bounds refuses when Ksum is too small for the vector tail bound', refused)


print('\n' + ('R4b: ALL PASS' if not FAILS else f'R4b: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\n[21] the Cin form: gamma and the logarithm cancel, which is what unblocks Machine C')
# Ci(x) = gamma + ln x - Cin(x). In the entry bracket [ln(m/n) - Ci(2m pi) + Ci(2n pi)] both gamma AND the
# logarithm cancel, leaving Cin(2m pi) - Cin(2n pi). Cin is ENTIRE with a pure alternating power series, so an
# auditor importing only fractions/json/math can reach it from a rigorously enclosed pi - which auditor_r01.py
# already builds. It cannot reach gamma or ln that way. The obstacle to auditing R4b was how the closed form was
# WRITTEN, not the mathematics.
for (n, m) in [(1, 1), (1, 2), (2, 3), (3, 7), (1, 12)]:
    a, b = P.A_entry(n, m), P.A_entry_via_cin(n, m)
    check(f'A_{n},{m}: the Ci form and the Cin form agree', abs(a - b) <= abs(a) * mpf('1e-20'),
          f'rel diff {mp.nstr(abs(a - b) / abs(a), 3)}')
for (n, m) in [(1, 1), (2, 3), (1, 12)]:
    e = P.A_entry_enclosure_via_cin(n, m)
    check(f'A_{n},{m}: the Cin-form enclosure contains the value', lo(e) <= P.A_entry(n, m) <= hi(e),
          f'width {mp.nstr(hi(e) - lo(e), 3)}')
c1 = sici.cin_at_2npi(3)
with mp.workdps(60):
    ref = mp.euler + mp.log(6 * mp.pi) - mp.ci(6 * mp.pi)
    ok = mpf(c1.a) <= ref <= mpf(c1.b)
check('Cin(6 pi) enclosure contains gamma + ln x - Ci(x) computed independently', ok)


print('\nSCOPE. The Galerkin eigenvalues are ORDINARY numerics. What is CERTIFIED is this:')
print('  * A_{nm} are closed forms in Si and Ci, and sici.py encloses those rigorously.')
print('  * A2 = A^T B^-1 A needs no Hilbert transform; its truncation tail is bounded in closed form.')
print('  * certified_bracket gives LOWER bounds by Courant-Fischer, needing no truncation estimate at all.')
print('  * certified_upper_bounds gives UPPER bounds by Lehmann-Maehly, beating Corollary 3.9 on every')
print('    one, with the bracket on lambda_1 narrower than the published four-figure value own precision.')
print('')
print('STILL BORROWED: Corollary 3.9 fixes the SHIFT. It supplies lambda_{J+1} < 1/((J+1)pi), which with')
print('  our lower bound on lambda_J establishes Lehmann hypothesis that exactly J eigenvalues of T = -M')
print('  lie below rho. It is an a priori INPUT now rather than the answer - an improvement, not an')
print('  elimination, and writing it up as an elimination would be the overclaim this line polices.')
print('')
print('NOT CLAIMED: none of this is a statement about the PDE. It bounds the SPECTRUM of M. The')
print('  self-similar profile statement needs the eigenFUNCTION and the functional c(f), and neither is')
print('  enclosed here. Nothing above says anything about De Gregorio blow-up, on any domain.')

sys.exit(1 if FAILS else 0)
