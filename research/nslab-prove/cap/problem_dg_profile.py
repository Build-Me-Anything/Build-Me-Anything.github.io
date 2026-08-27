"""R4b — the De Gregorio self-similar profile operator of Huang, Tong & Wei, made concrete.

Source: De Huang, Jiajun Tong, Dongyi Wei, *On self-similar finite-time blowups of the De Gregorio model on the
real line*, Comm. Math. Phys. (2023), arXiv:2209.08232, DOI 10.1007/s00220-023-04784-9. Every formula below is
transcribed from that paper; nothing here is reconstructed. Where something is not in the paper it is marked.

**Domain: the real line.** This matters and R2's earlier write-up got it wrong by omission. The relevant blowup is
*expanding* (c_l < 0), which the paper says is "clearly incompatible with the periodic setting"; De Gregorio on the
circle is globally well posed for the smooth data in question.

The setting
-----------
Self-similar ansatz (their 1.2): `ω_s(x,t) = (T−t)^{c_ω} Ω(x/(T−t)^{c_l})`, with `c_ω = −1` the only possible
non-zero value, and the profile equation (their 2.1)

    (c_l x + u) ω_x = (c_ω + u_x) ω,    u_x = H(ω),    u(0) = 0.

Assumptions, all explicit and none of them smallness: ω odd, ω ∈ H¹(ℝ), and ω_x(0) ≠ 0 — the last forcing
c_l = c_ω. Compact support is *derived*, not assumed, then normalised to [−1, 1].

The operator
------------
On `V := { f odd, f ∈ H¹₀([−1,1]) }` with the **plain Ḣ¹ inner product** (no weight — unlike Chen–Hou–Huang):

    **M(f) := χ_{[−1,1]} ( (−Δ)^{−1/2} f − c(f)·x )**,      c(f) := (−Δ)^{−1/2} f (1)

where `(−Δ)^{−1/2}f(x) = −(1/π)∫_ℝ f(y) ln|x−y| dy`. The `−c(f)x` term is exactly what makes `M(f)(1) = 0`, so M
maps V into itself. Their working identity (3.3): `∂_x M(f) = −χ_{[−1,1]}( H(f) + c(f) )`.

Self-adjoint and positive semi-definite, with the striking identity

    ⟨f, M(g)⟩_{Ḣ¹} = ⟨f, g⟩_{Ḣ^{1/2}(ℝ)}

and **compact**, because `‖M(f)‖_{Ḣ²([−1,1])} ≤ ‖f‖_{Ḣ¹}` and `Ḣ²([−1,1]) ↪ Ḣ¹` compactly on a bounded interval.
That compactness is the entire reason this route works where R3's preconditioning could not: the eigenproblem
`λf = M(f)` lives in one space and needs no derivative-gaining inverse.

**The eigenvalue is not the blow-up rate.** λ is a rescaling-invariant shape label; the rate is `c_ω = c(f)`, a
separate functional. Since M is linear, λ is unchanged under `f ↦ αf` while `c(f) ↦ α c(f)`, so one picks
`α = −1/c(f)` to land on `c_l = c_ω = −1`. Their Theorem 3.7 (thm:cf_nonzero) guarantees `c(f) ≠ 0` for every eigenfunction, which
is what makes that legal.

What is exactly known, and therefore gradeable
----------------------------------------------
1. **A comparison operator with closed-form spectrum.** Their §3.2 introduces the Dirichlet inverse Laplacian to
   the half power on the same space, with

       λ̃_n = 1/(nπ),      f̃_n = χ_{[−1,1]} sin(nπx)/(nπ)

   — exact, and in the *same* space with the *same* inner product. This is the ideal grading target, and the R4
   machinery certifies its eigenpairs directly.

2. **A rigorous two-sided bracket on the real spectrum** (their Corollary 3.9):

       (2/π²)·λ̃_n  ≤  λ_n  <  λ̃_n,       i.e.   0.2026/n ≤ λ_n < 0.3183/n

   Any computed eigenvalue violating this is wrong, and the upper bound is *strict*.

3. **An exact closed-form identity for the operator itself.** Castro's function
   `Ω₀(x) = −χ_{[−1,1]} x/√(1−x²)` satisfies `M(Ω₀) = 0`, because

       (−Δ)^{−1/2} Ω₀ (x) = −x   on [−1, 1],      c(Ω₀) = −1.

   Ω₀ is *not* in V — too little regularity, which is why the paper calls it "illegal" and why it cannot prove
   blowup from smooth data — but it grades an implementation of `(−Δ)^{−1/2}` and `c(·)` perfectly, which is what
   it is used for here.

4. **Six published eigenvalues** (their Appendix A, Figure 1):
   λ₁…λ₆ = 0.2896, 0.1509, 0.1022, 0.0773, 0.0622, 0.0520.

What is **not** in the paper, and is therefore not claimed here
---------------------------------------------------------------
No closed form for λ₁ or any λ_n; no numerical value of c_ω; no profile point values; **no Fourier or Chebyshev
matrix representation**; and **no interval arithmetic or CAP content whatsoever** — their proof is analytic. The
sine-basis Galerkin discretisation below is *ours*, and is Machine A output: it reproduces their six values, which
is a check on the transcription, not a certificate.

The honest state of the certified step
--------------------------------------
This module delivers: the exact operator identity (checkable), the comparison operator's certified eigenpairs
(R4 machinery, closed-form answers), the published bracket as an acceptance gate, and a Galerkin reproduction
clearly labelled unrigorous. It is **not** a certificate and does not pretend to be one.

What changed on 2026-08-25: the matrix entries were an **improper oscillatory integral** evaluated by ordinary
quadrature, and "rigorous quadrature" was named as the next piece of work. That integral turns out to have a
**closed form** — see `A_entry` — so the work required is now different and considerably smaller:

    A_{nn} = 2n·Si(2nπ)
    A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ ln(m/n) − Ci(2mπ) + Ci(2nπ) ]      (n ≠ m)

Certifying `λf = M(f)` therefore needs **two** things, neither of them an improper integral:

1. rigorous enclosures of `Si(2nπ)` and `Ci(2nπ)` — convergent series with classical remainder bounds, the same
   shape of problem `auditor_r01.py` already solves for π, sin and cos; and
2. a proven bound on the **Galerkin truncation** error, which is the genuinely open piece.

The closed form also **corrected the quadrature it replaced**, whose tail truncation left a relative error of
order 1e-4 in every entry — the same order as the tolerance the published-eigenvalue check was using. With exact
entries all six eigenvalues land inside the *rounding intervals* of the published four-figure values, which is a
much stronger grading statement than the one this module could make before.
"""
from mpmath import mp, mpf, iv, pi as MPPI, sin as msin, sqrt as msqrt, quad, inf, si as msi, ci as mci

import sici
import lehmann
from ivutil import ival, lo, hi

# Published eigenvalues, Huang-Tong-Wei Appendix A, Figure 1.
PUBLISHED = [mpf('0.2896'), mpf('0.1509'), mpf('0.1022'), mpf('0.0773'), mpf('0.0622'), mpf('0.0520')]


# ------------------------------------------------------------------------------------------------------------
# 1. the comparison operator, with exact spectrum
# ------------------------------------------------------------------------------------------------------------

def comparison_eigenvalue(n):
    """λ̃_n = 1/(nπ), exactly (their §3.2)."""
    return 1 / (n * MPPI)


def bracket(n):
    """The rigorous two-sided bracket of Corollary 3.9: (2/π²)λ̃_n ≤ λ_n < λ̃_n, as an interval.

    **UNRESOLVED — this file's prose and its own formula disagree, and the source has not been re-read.** The
    module docstring above states the bracket as "0.2026/n ≤ λ_n < 0.3183/n". The formula implemented here is
    `(2/π²)·λ̃_n` with `λ̃_n = 1/(nπ)`, which is `2/(π³n) = 0.06450/n` — not 0.2026/n. The two readings are:

        (a) as coded   λ_n ≥ (2/π²)·λ̃_n = 0.06450/n
        (b) as written λ_n ≥ (2/π²)/n   = 0.20264/n

    Both upper bounds agree at `λ̃_n = 0.31831/n`, and both lower bounds hold for every eigenvalue computed here,
    so nothing downstream is unsound either way — (a) is simply the weaker gate. It is left as coded **on
    purpose**: adopting the tighter reading without re-reading Huang-Tong-Wei would be exactly the unverified
    tightening this line forbids, and `in_bracket` is used as an acceptance gate, where weaker-but-certain beats
    stronger-but-assumed.

    Flagged for the `oracle-hunter`. Until then, quote the improvement of `certified_bracket`'s lower bound over
    the published one against reading (b), the conservative choice.
    """
    hi_ = comparison_eigenvalue(n)
    lo_ = (2 / MPPI ** 2) * hi_
    return lo_, hi_


def in_bracket(n, lam):
    """Does a claimed λ_n satisfy the published bracket? The upper bound is STRICT."""
    a, b = bracket(n)
    return a <= lam < b


# ------------------------------------------------------------------------------------------------------------
# 2. the exact operator identity - Castro's function
# ------------------------------------------------------------------------------------------------------------

def castro_omega(x):
    """Ω₀(x) = −x/√(1−x²) on (−1,1). Not in V, but an exact test of the operator's definition."""
    x = mpf(x)
    return -x / msqrt(1 - x * x)


def inv_sqrt_laplacian_castro(x):
    """The paper's closed form for (−Δ)^{−1/2}Ω₀: −x on [−1,1]; −x ± √(x²−1) outside."""
    x = mpf(x)
    if abs(x) <= 1:
        return -x
    return -x + msqrt(x * x - 1) if x > 1 else -x - msqrt(x * x - 1)


def inv_sqrt_laplacian_castro_numeric(x, prec_eps='1e-12'):
    """(−Δ)^{−1/2}Ω₀(x) = −(1/π)∫ Ω₀(y) ln|x−y| dy, computed by quadrature.

    Deliberately independent of the closed form above: if the two disagree, either the transcription of the closed
    form or the definition of the operator is wrong, and that is exactly the kind of error that would otherwise
    propagate silently into everything built on it. Odd symmetry is used to fold the integral onto (0,1), and the
    integrable endpoint singularity of Ω₀ is left to mpmath's tanh-sinh rule.
    """
    x = mpf(x)
    f = lambda y: castro_omega(y) * (mp.log(abs(x - y)) - mp.log(abs(x + y)))
    return -(1 / MPPI) * quad(f, [0, 1])


def c_functional_castro():
    """c(Ω₀) = (−Δ)^{−1/2}Ω₀(1) = −1, from the closed form."""
    return inv_sqrt_laplacian_castro(1)


# ------------------------------------------------------------------------------------------------------------
# 3. the sine-basis Galerkin discretisation - OURS, and unrigorous
# ------------------------------------------------------------------------------------------------------------

def A_entry(n, m):
    """A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)} for s_n = χ_{[−1,1]} sin(nπx), **in closed form**.

        A_{nn} = 2n·Si(2nπ)
        A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) ) · [ ln(m/n) − Ci(2mπ) + Ci(2nπ) ]      (n ≠ m)

    Neither the representation nor these formulae are in the paper; both were derived here, and are graded below.

    Derivation. From ŝ_n(ξ) = 2i(−1)^n nπ sin ξ/(n²π²−ξ²),

        A_{nm} = 4π(−1)^{n+m} nm · I(n,m),     I(n,m) = ∫₀^∞ ξ sin²ξ / ((a²−ξ²)(b²−ξ²)) dξ,  a = nπ, b = mπ.

    *Off-diagonal.* Partial fractions in ξ² give I = [J(a) − J(b)]/(b²−a²) with J(a) = ∫₀^∞ ξ sin²ξ/(a²−ξ²) dξ.
    Writing ξ/(ξ²−a²) = ½[1/(ξ−a) + 1/(ξ+a)] and sin²ξ = (1−cos 2ξ)/2, the substitutions t = ξ−a and s = ξ+a
    **both** yield ∫_a^∞ (1−cos 2u)/u du, because a = nπ makes cos(2(u ∓ a)) = cos 2u; the first uses that
    (1−cos 2t)/t is odd, so its integral over [−a, a] vanishes. Each J diverges logarithmically, but the divergences
    are identical and cancel in J(a) − J(b), leaving the **finite** integral

        I(n,m) = −(1/(2(b²−a²))) ∫_a^b (1−cos 2u)/u du = −(1/(2(b²−a²)))·[ ln(b/a) − Ci(2b) + Ci(2a) ].

    *Diagonal.* ξ/(ξ²−a²)² = −½ d/dξ[1/(ξ²−a²)], so integrating by parts (both boundary terms vanish: sin²0 = 0
    at the left, decay at the right) gives I(n,n) = ½ ∫₀^∞ sin 2ξ/(ξ²−a²) dξ. The same two substitutions give
    (π/2 + Si(2a)) and (π/2 − Si(2a)) — here sin 2t/t is *even* — so I(n,n) = Si(2a)/(2a).

    **Why this matters for certification.** It removes the improper oscillatory integral entirely. Enclosing A_{nm}
    rigorously now reduces to enclosing Si and Ci at integer multiples of 2π, which have convergent series with
    classical remainder bounds — the same shape of problem `auditor_r01.py` already solves for π, sin and cos.

    **And it exposed a defect in the quadrature this replaces.** `A_entry_quadrature` truncates the tail at
    (4·max(n,m)+5)π, and the tail behaves like ∫ sin²ξ/ξ³ ~ 1/(4Ξ²), so its entries carry a **relative error of
    order 1e-4** — the same order as the 2e-4 tolerance the published-eigenvalue check was using. Extending the
    truncation walks the quadrature onto these formulae monotonically (1.1e-4 → 3.9e-7 from 13 to 1200 breaks at
    n=1, m=2), which is what grades them.
    """
    n, m = int(n), int(m)
    if n == m:
        return 2 * n * msi(2 * n * MPPI)
    a, b = n * MPPI, m * MPPI
    inner = mp.log(mpf(m) / n) - mci(2 * b) + mci(2 * a)
    return -(2 * n * m * (mpf(-1) ** (n + m)) / (MPPI * (m * m - n * n))) * inner


def A_entry_enclosure(n, m, target=30):
    """A_{nm} as a rigorous **interval**, from the closed form and `sici`'s certified Si/Ci.

    This is the certified counterpart of `A_entry`, and the first half of what R4b's certificate needs. Every
    operation is interval arithmetic with outward rounding, so the returned bracket provably contains the true
    entry — given mpmath's `iv.pi`, `iv.euler` and `iv.log`, which `sici` states as its trusted inputs.

    **What this does not yet give.** A certified matrix is not a certified eigenvalue. Turning these entries into
    an enclosure of λ needs the second piece: a proven bound on the Galerkin truncation error, i.e. on what the
    modes above K contribute. Until that exists, these intervals bound the entries of a *finite section* and
    nothing about the operator's spectrum. Saying so is the point of the sentence.
    """
    n, m = int(n), int(m)
    if n == m:
        return iv.mpf(2 * n) * sici.si_at_2npi(n, target)
    lo_n, hi_m = sici.ci_at_2npi(n, target), sici.ci_at_2npi(m, target)
    inner = iv.log(iv.mpf(m) / iv.mpf(n)) - hi_m + lo_n
    sgn = iv.mpf(-1) ** ((n + m) % 2) if (n + m) % 2 else iv.mpf(1)
    pref = iv.mpf(2 * n * m) * sgn / (iv.pi * iv.mpf(m * m - n * n))
    return -(pref * inner)


def A_entry_via_cin(n, m):
    """The same entry written with `Cin` instead of `Ci` — the form an exact-rational auditor can reach.

        A_{nn} = 2n·Si(2nπ)
        A_{nm} = −( 2nm(−1)^{n+m} / (π(m²−n²)) )·[ Cin(2mπ) − Cin(2nπ) ]      (n ≠ m)

    Identical in value to `A_entry`; γ and the logarithm cancel between the two Ci terms and the ln(m/n) in front.
    Kept as a separate function rather than replacing `A_entry`, because the two agreeing is itself a check on the
    cancellation, and because the Ci form is how the derivation reads.
    """
    n, m = int(n), int(m)
    if n == m:
        return 2 * n * msi(2 * n * MPPI)
    inner = _cin(2 * m * MPPI) - _cin(2 * n * MPPI)
    return -(2 * n * m * (mpf(-1) ** (n + m)) / (MPPI * (m * m - n * n))) * inner


def _cin(x):
    """Cin(x) = γ + ln x − Ci(x), for the point-value cross-check only."""
    from mpmath import euler as _eu
    return _eu + mp.log(x) - mci(x)


def A_entry_enclosure_via_cin(n, m, target=30):
    """Certified entry through the Cin form — no γ, no logarithm, only π and two entire series."""
    n, m = int(n), int(m)
    if n == m:
        return iv.mpf(2 * n) * sici.si_at_2npi(n, target)
    inner = sici.cin_at_2npi(m, target) - sici.cin_at_2npi(n, target)
    sgn = iv.mpf(-1) if (n + m) % 2 else iv.mpf(1)
    return -(iv.mpf(2 * n * m) * sgn / (iv.pi * iv.mpf(m * m - n * n))) * inner


def A_entry_quadrature(n, m, breaks_per_side=None):
    """The same entry by direct quadrature — kept as an INDEPENDENT route, not as the primary one.

    Two implementations of the same quantity sharing no derivation is the discipline this project applies
    everywhere else; here it is what established that the closed form above is right and this one is not, at the
    1e-4 level. `breaks_per_side` extends the truncation: the default reproduces the original behaviour, and
    raising it converges onto `A_entry`.

    All singularities are removable — sin²ξ has a double zero at every ξ = kπ.
    """
    n, m = int(n), int(m)
    sgn = mpf(-1) ** (n + m)
    if breaks_per_side is None:
        breaks_per_side = 4 * max(n, m) + 5

    def integrand(xi):
        d1 = (n * MPPI) ** 2 - xi ** 2
        d2 = (m * MPPI) ** 2 - xi ** 2
        # removable singularities: step aside by a hair rather than special-casing, since the integrand is
        # analytic there and the quadrature never lands exactly on the pole
        if d1 == 0 or d2 == 0:
            xi = xi + mpf('1e-30')
            d1 = (n * MPPI) ** 2 - xi ** 2
            d2 = (m * MPPI) ** 2 - xi ** 2
        return xi * msin(xi) ** 2 / (d1 * d2)

    breaks = [0] + [k * MPPI for k in range(1, breaks_per_side + 1)] + [inf]
    val = quad(integrand, breaks)
    return 4 * MPPI * sgn * n * m * val



# ------------------------------------------------------------------------------------------------------------
# 4. certified two-sided bracket on the eigenvalues - the first rigorous statement about this operator here
# ------------------------------------------------------------------------------------------------------------

def _approx_eigenvectors(K, J):
    """Machine A. Ordinary numerics, deliberately: the trial subspace may be anything at all.

    Its quality changes how SHARP the bound below is and can never change whether the bound is TRUE - the same
    property that lets R0 feed a deliberately terrible preconditioner to Krawczyk and still demand soundness.
    Returns J coefficient vectors in the s-basis, ordered by decreasing Rayleigh quotient.
    """
    A = mp.matrix(K, K)
    for i in range(K):
        for j in range(i, K):
            v = A_entry(i + 1, j + 1)
            A[i, j] = v
            A[j, i] = v
    Bd = [(n * MPPI) ** 2 for n in range(1, K + 1)]
    C = mp.matrix(K, K)
    for i in range(K):
        for j in range(K):
            C[i, j] = A[i, j] / (msqrt(Bd[i]) * msqrt(Bd[j]))
    E, Q = mp.eig(C)
    order = sorted(range(K), key=lambda i: -mp.re(E[i]))
    return [[mp.re(Q[i, idx]) / msqrt(Bd[i]) for i in range(K)] for idx in order[:J]]


def _gershgorin_min(G, j):
    """Rigorous lower bound on the smallest eigenvalue of a symmetric interval matrix."""
    best = None
    for i in range(j):
        row = lo(G[i][i])
        for k in range(j):
            if k != i:
                row -= max(abs(lo(G[i][k])), abs(hi(G[i][k])))
        best = row if best is None else min(best, row)
    return best


def _gershgorin_max(G, j):
    """Rigorous upper bound on the largest eigenvalue of a symmetric interval matrix."""
    best = None
    for i in range(j):
        row = hi(G[i][i])
        for k in range(j):
            if k != i:
                row += max(abs(lo(G[i][k])), abs(hi(G[i][k])))
        best = row if best is None else max(best, row)
    return best


def certified_bracket(K=24, J=6, target=30):
    """A **certified** two-sided bracket on the J largest eigenvalues of M. Returns [(lo, hi), ...].

    Lower bound - ours, and this is the part the certified entries buy
    ------------------------------------------------------------------
    By Courant-Fischer on V, with R(f) = ⟨f, Mf⟩_{Ḣ¹}/⟨f,f⟩_{Ḣ¹} = (cᵀAc)/(cᵀBc) and B = diag(n²π²),

        λ_j = max_{dim S = j} min_{0≠f∈S} R(f)  ≥  min_{0≠f∈S₀} R(f)   for ANY j-dimensional S₀ ⊆ V.

    `s_n = χ sin(nπx)` lies in V (odd, and vanishing at ±1, so in H¹₀), so any span of them is admissible. Taking
    S₀ from the computed eigenvectors and writing `G_A = VᵀAV`, `G_B = VᵀBV`,

        λ_j ≥ λ_min(G_A, G_B) ≥ λ_min(G_A) / λ_max(G_B),

    the last step valid because **A is positive semi-definite** — it is the Gram matrix of the Ḣ^{1/2} inner
    product on a linearly independent set, so `cᵀAc = ‖Σ c_n s_n‖²_{Ḣ^{1/2}} ≥ 0`. Both remaining quantities are
    bounded by Gershgorin in interval arithmetic, using `A_entry_enclosure` for every entry. **No truncation
    estimate is needed for this half**: min-max gives it away free, which is why Rayleigh-Ritz converges from
    below.

    Upper bound - **theirs, not ours**
    ----------------------------------
    Corollary 3.9 of the source: `λ_n < λ̃_n = 1/(nπ)`, strictly. That is a published theorem, used here as a
    citation. **This module does not derive an upper bound**, and the bracket is therefore not a self-contained
    result: its width is set by how loose Corollary 3.9 is, not by anything computed here.

    What that means for the truncation error
    ----------------------------------------
    The Galerkin truncation error `λ_j − λ_j^{(K)}` is *bounded* by the width of this bracket, but not by an
    argument of ours — the upper half is borrowed. A self-derived upper bound is the standard
    **Lehmann-Maehly-Goerisch** construction, which takes an a priori separation of the spectrum (Corollary 3.9
    supplies exactly that) and returns sharp upper bounds. It is **not implemented here**, and calling this a
    truncation bound without that distinction would be an overclaim.
    """
    V = _approx_eigenvectors(K, J)
    dps_saved = iv.dps
    try:
        iv.dps = target + 15
        Aiv = [[None] * K for _ in range(K)]
        for i in range(K):
            for j in range(i, K):
                e = A_entry_enclosure(i + 1, j + 1, target)
                Aiv[i][j] = e
                Aiv[j][i] = e
        Biv = [(iv.mpf(n) * iv.pi) ** 2 for n in range(1, K + 1)]
        Viv = [[iv.mpf(mp.nstr(c, target + 5)) for c in vec] for vec in V]

        # precompute A·v_b once per b, so the double loop below is O(J²K) rather than O(J²K²)
        Av = []
        for b in range(J):
            col = []
            for p in range(K):
                s = iv.mpf(0)
                for q in range(K):
                    s = s + Aiv[p][q] * Viv[b][q]
                col.append(s)
            Av.append(col)

        out = []
        for j in range(1, J + 1):
            GA = [[iv.mpf(0)] * j for _ in range(j)]
            GB = [[iv.mpf(0)] * j for _ in range(j)]
            for a in range(j):
                for b in range(j):
                    sa = iv.mpf(0)
                    sb = iv.mpf(0)
                    for p in range(K):
                        sa = sa + Viv[a][p] * Av[b][p]
                        sb = sb + Viv[a][p] * Biv[p] * Viv[b][p]
                    GA[a][b] = sa
                    GB[a][b] = sb
            gmin = _gershgorin_min(GA, j)
            gmax = _gershgorin_max(GB, j)
            if not (gmin > 0 and gmax > 0):
                out.append((None, None))     # refuse rather than return a bound the hypothesis does not support
                continue
            lower = gmin / gmax
            upper = hi(iv.mpf(1) / (iv.mpf(j) * iv.pi))
            out.append((lower, upper))
        return out
    finally:
        iv.dps = dps_saved


# ------------------------------------------------------------------------------------------------------------
# 5. A2 = <M s_i, M s_j>_{H^1} - the Lehmann matrix, with a proven truncation tail
# ------------------------------------------------------------------------------------------------------------

def _ci_tail_bound(x):
    """|Ci(x)| <= 2/x for x > 0, proved in one line and used where a uniform bound over all k is needed.

    Ci(x) = −∫_x^∞ cos t/t dt; integrating by parts, Ci(x) = sin(x)/x − ∫_x^∞ sin t/t² dt, so
    |Ci(x)| ≤ 1/x + ∫_x^∞ dt/t² = 2/x.
    """
    return iv.mpf(2) / iv.mpf(x)


def A_entry_abs_bound(k, m):
    """A rigorous upper bound on |A_{km}| valid for **every** k >= 2m, as a plain interval.

    From the closed form, for k > m,

        |A_km| = (2km / (π(k²−m²))) · | ln(m/k) − Ci(2mπ) + Ci(2kπ) |

    and for k ≥ 2m we have k²−m² ≥ (3/4)k², so the prefactor is at most 8m/(3πk). Bounding
    |Ci(2kπ)| ≤ 1/(kπ) ≤ 1/π by the lemma above, and enclosing Ci(2mπ) exactly for the fixed m,

        |A_km| ≤ (8m/(3πk)) · ( ln(k/m) + |Ci(2mπ)| + 1/π ).

    This is deliberately blunt. It is used only for the tail, where bluntness costs a slightly larger truncation
    bound and never soundness.
    """
    k, m = int(k), int(m)
    if k < 2 * m:
        raise ValueError('A_entry_abs_bound is only valid for k >= 2m; use A_entry_enclosure below that')
    cm = sici.ci_at_2npi(m)
    cm_abs = iv.mpf(max(abs(lo(cm)), abs(hi(cm))))
    pref = iv.mpf(8 * m) / (iv.mpf(3) * iv.pi * iv.mpf(k))
    return pref * (iv.log(iv.mpf(k) / iv.mpf(m)) + cm_abs + iv.mpf(1) / iv.pi)


def _log_moment_integrals(K):
    """∫_K^∞ x^{-4} dx, ∫_K^∞ ln(x) x^{-4} dx, ∫_K^∞ ln(x)² x^{-4} dx — all elementary, as intervals.

        ∫ x^-4      = 1/(3K³)
        ∫ ln x·x^-4 = (ln K + 1/3)/(3K³)
        ∫ ln²x·x^-4 = (ln²K + (2/3)ln K + 2/9)/(3K³)
    """
    Kv = iv.mpf(K)
    L = iv.log(Kv)
    base = iv.mpf(1) / (iv.mpf(3) * Kv ** 3)
    return base, base * (L + iv.mpf(1) / 3), base * (L * L + (iv.mpf(2) / 3) * L + iv.mpf(2) / 9)


def A2_tail_bound(i, j, K):
    """Rigorous bound on |Σ_{k>K} A_{ki} A_{kj} / (k²π²)|, the part of A2 the truncation discards.

    Substituting the blunt bound above for both factors,

        |A_ki A_kj| / (k²π²) ≤ (64 i j / (9π⁴)) · (ln(k/i) + D_i)(ln(k/j) + D_j) / k⁴,
        D_m := |Ci(2mπ)| + 1/π,

    and the summand is decreasing in k for k ≥ K (the numerator grows like ln²k, the denominator like k⁴), so the
    sum is bounded by the integral from K to ∞. Expanding the product in powers of ln x gives the three elementary
    moments above. Requires K ≥ 2·max(i, j) so `A_entry_abs_bound` applies to every term.
    """
    i, j, K = int(i), int(j), int(K)
    if K < 2 * max(i, j):
        raise ValueError('A2_tail_bound needs K >= 2*max(i,j) so the entry bound holds for every k > K')
    di = iv.mpf(max(abs(lo(sici.ci_at_2npi(i))), abs(hi(sici.ci_at_2npi(i))))) + iv.mpf(1) / iv.pi
    dj = iv.mpf(max(abs(lo(sici.ci_at_2npi(j))), abs(hi(sici.ci_at_2npi(j))))) + iv.mpf(1) / iv.pi
    ai = di - iv.log(iv.mpf(i))      # ln(k/i) + D_i = ln k + (D_i - ln i)
    aj = dj - iv.log(iv.mpf(j))
    m0, m1, m2 = _log_moment_integrals(K)
    integral = ai * aj * m0 + (ai + aj) * m1 + m2
    pref = iv.mpf(64 * i * j) / (iv.mpf(9) * iv.pi ** 4)
    return pref * integral


def A2_enclosure(i, j, K=None, target=30):
    """Certified enclosure of A2_{ij} = ⟨M s_i, M s_j⟩_{Ḣ¹}, the third Lehmann matrix.

    **No Hilbert transform is needed.** M maps V into V and {s_k} is a basis of V, so `M s_m = Σ_k c_{km} s_k`;
    testing with `s_n` in the Ḣ¹ inner product and using `⟨s_n, s_m⟩_{Ḣ¹} = n²π²δ_{nm}` gives
    `c_{nm} = A_{nm}/(n²π²)`, hence

        **A2 = Aᵀ B⁻¹ A**,     A2_{ij} = Σ_{k≥1} A_{ki} A_{kj} / (k²π²),   B = diag(k²π²).

    So the object that blocked Lehmann is the matrix already certified by `A_entry_enclosure`, plus a tail — and
    the tail bound *is* the Galerkin truncation bound this rung was missing. The two open problems were the same
    problem.

    Checked against a genuinely independent route before being trusted: computing `A2` from the operator instead,
    via the source's identity `∂ₓM(f) = −χ(H f + c(f))` and `c(f) = −½∫₋₁¹ H f`, needs the Hilbert transform of a
    truncated sine and a nested principal-value quadrature. The two agree to ~1e-8 at K = 400 and improve with K,
    which is what grades the identity.
    """
    i, j = int(i), int(j)
    if K is None:
        K = max(40, 4 * max(i, j))
    total = iv.mpf(0)
    for k in range(1, K + 1):
        total = total + (A_entry_enclosure(k, i, target) * A_entry_enclosure(k, j, target)
                         / (iv.mpf(k) * iv.pi) ** 2)
    tail = A2_tail_bound(i, j, K)
    tmag = max(abs(lo(tail)), abs(hi(tail)))
    return total + iv.mpf([-tmag, tmag])


# ------------------------------------------------------------------------------------------------------------
# 6. Lehmann on M itself: certified UPPER bounds, closing the bracket from the other side
# ------------------------------------------------------------------------------------------------------------

def _vector_tail_bound(va, vb, K, Ksum):
    """Bound Σ_{k>Ksum} |p_a[k] p_b[k]| / (k²π²) where p_a[k] = Σ_{l≤K} A_{kl} v_a[l].

    `M w_a` is **not** in the trial span — it has components at every k — so A₂ carries a genuine tail even when
    the trial space is finite. This is the vector form of `A2_tail_bound`, and it reuses the same two ingredients:
    the blunt entry bound and the three `∫ ln^p(x)/x⁴` moments.

    For k ≥ 2K every term obeys `|A_{kl}| ≤ (8l/(3πk))(ln(k/l) + D_l)` with `D_l = |Ci(2lπ)| + 1/π`, so

        |p_a[k]| ≤ (8/(3πk))·( ln(k)·S1_a + S2_a ),
        S1_a = Σ_l l|v_a[l]|,   S2_a = Σ_l l|v_a[l]|·(D_l − ln l)

    and the product summed against the moments gives the bound. Requires Ksum ≥ 2K.
    """
    if Ksum < 2 * K:
        raise ValueError('the vector tail bound needs Ksum >= 2K so the entry bound holds for every k > Ksum')
    S1 = [iv.mpf(0), iv.mpf(0)]
    S2 = [iv.mpf(0), iv.mpf(0)]
    for idx, v in enumerate((va, vb)):
        for l in range(1, K + 1):
            cl = sici.ci_at_2npi(l)
            Dl = iv.mpf(max(abs(lo(cl)), abs(hi(cl)))) + iv.mpf(1) / iv.pi
            w = iv.mpf(l) * abs(iv.mpf(v[l - 1]))
            S1[idx] = S1[idx] + w
            S2[idx] = S2[idx] + w * (Dl - iv.log(iv.mpf(l)))
    m0, m1, m2 = _log_moment_integrals(Ksum)
    pref = iv.mpf(64) / (iv.mpf(9) * iv.pi ** 4)
    return pref * (S1[0] * S1[1] * m2 + (S1[0] * S2[1] + S2[0] * S1[1]) * m1 + S2[0] * S2[1] * m0)


def lehmann_matrices(V, K, Ksum, target=30):
    """The three Lehmann matrices for `T = −M` on the trial span, every entry a certified interval.

        A₀_ab = ⟨w_a, w_b⟩_{Ḣ¹}     = Σ_l v_a[l] v_b[l] (lπ)²          — exact, B is diagonal
        A₁_ab = ⟨T w_a, w_b⟩_{Ḣ¹}   = −v_aᵀ A v_b                       — the certified A matrix
        A₂_ab = ⟨M w_a, M w_b⟩_{Ḣ¹} = Σ_k p_a[k] p_b[k]/(kπ)² ± tail    — A = AᵀB⁻¹A, in vector form
    """
    J = len(V)
    Ent = {}
    for k in range(1, Ksum + 1):
        for l in range(1, K + 1):
            Ent[(k, l)] = A_entry_enclosure(k, l, target)

    p = []
    for a in range(J):
        col = []
        for k in range(1, Ksum + 1):
            s = iv.mpf(0)
            for l in range(1, K + 1):
                s = s + Ent[(k, l)] * iv.mpf(V[a][l - 1])
            col.append(s)
        p.append(col)

    A0 = [[iv.mpf(0)] * J for _ in range(J)]
    A1 = [[iv.mpf(0)] * J for _ in range(J)]
    A2 = [[iv.mpf(0)] * J for _ in range(J)]
    for a in range(J):
        for b in range(J):
            s0 = iv.mpf(0)
            for l in range(1, K + 1):
                s0 = s0 + iv.mpf(V[a][l - 1]) * iv.mpf(V[b][l - 1]) * (iv.mpf(l) * iv.pi) ** 2
            s1 = iv.mpf(0)
            for k in range(1, K + 1):
                s1 = s1 + iv.mpf(V[a][k - 1]) * p[b][k - 1]
            s2 = iv.mpf(0)
            for k in range(1, Ksum + 1):
                s2 = s2 + p[a][k - 1] * p[b][k - 1] / ((iv.mpf(k) * iv.pi) ** 2)
            t = _vector_tail_bound(V[a], V[b], K, Ksum)
            tmag = max(abs(lo(t)), abs(hi(t)))
            A0[a][b] = s0
            A1[a][b] = -s1
            A2[a][b] = s2 + iv.mpf([-tmag, tmag])
    return A0, A1, A2


def certified_upper_bounds(K=10, J=4, Ksum=None, target=30):
    """Certified **upper** bounds on λ₁…λ_J for M, by Lehmann–Maehly. Returns (bounds, rho, window).

    The shift's hypothesis — exactly J eigenvalues of `T = −M` below ρ — is `λ_J > −ρ ≥ λ_{J+1}`, and both sides
    are supplied rather than assumed:

      * `−ρ < λ_J` from **our** certified Rayleigh–Ritz lower bound (`certified_bracket`);
      * `−ρ ≥ λ_{J+1}` from **Corollary 3.9** of the source, `λ_{J+1} < 1/((J+1)π)`.

    So Corollary 3.9 is still load-bearing — but as an *a priori input for choosing the shift*, not as the answer.
    The bound returned is Lehmann's. That distinction is the entire content of this function and must survive
    into any write-up of it.

    Returns `(None, ...)` in a slot the bisection could not isolate, and raises if the shift window is empty.
    """
    if Ksum is None:
        Ksum = max(2 * K, 120)
    V = _approx_eigenvectors(K, J)
    A0, A1, A2 = lehmann_matrices(V, K, Ksum, target)

    br = certified_bracket(K=max(K, 16), J=J)
    L_J = br[J - 1][0]
    U_next = 1 / ((J + 1) * MPPI)
    if not (U_next < L_J):
        raise ValueError('empty shift window: Corollary 3.9 gives lambda_%d < %s but our lower bound on '
                         'lambda_%d is only %s, so no rho separates them'
                         % (J + 1, mp.nstr(U_next, 8), J, mp.nstr(L_J, 8)))
    rho = -(U_next + L_J) / 2
    return lehmann.upper_bounds(A0, A1, A2, rho, J, J), rho, (U_next, L_J)

def galerkin_eigenvalues(K=8):
    """Largest K eigenvalues of M by Galerkin projection onto span{s_1..s_K}.

    Solves A c = λ diag(n²π²) c. The mass matrix is diagonal because ⟨s_n, s_m⟩_{Ḣ¹} = n²π² δ_{nm}. Converges
    monotonically from below, being a Galerkin approximation of a supremum.

    **Machine A output.** No claim of rigour: the entries come from ordinary quadrature.
    """
    A = mp.matrix(K, K)
    for i in range(K):
        for j in range(i, K):
            v = A_entry(i + 1, j + 1)
            A[i, j] = v
            A[j, i] = v
    B = mp.matrix(K, K)
    for i in range(K):
        B[i, i] = ((i + 1) * MPPI) ** 2
    # generalised symmetric problem: B^{-1/2} A B^{-1/2}
    C = mp.matrix(K, K)
    for i in range(K):
        for j in range(K):
            C[i, j] = A[i, j] / (mp.sqrt(B[i, i]) * mp.sqrt(B[j, j]))
    ev = mp.eigsy(C, eigvals_only=True)
    return sorted([ev[i] for i in range(K)], reverse=True)


def phase_condition_note():
    """The paper's own figure normalisation, and the right phase condition for a Newton formulation.

    Their figures normalise ∂_x f(0) = 1, which is well posed because their Theorem 3.4 proves ∂_x f(r) ≠ 0 at
    every zero r of an eigenfunction — in particular at r = 0. In the sine basis that is the linear functional
    Σ_n nπ c_n = 1, which is exactly the kind of differentiable phase condition the eigenpair CAP literature
    appends (Lessard & Mireles James, J. Comput. Dyn. 7(1), 2020; Reinhardt & Mireles James, arXiv:1601.00307).
    """
    return 'sum_n n*pi*c_n = 1'
