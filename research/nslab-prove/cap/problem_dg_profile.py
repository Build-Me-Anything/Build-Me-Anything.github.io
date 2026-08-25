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
`α = −1/c(f)` to land on `c_l = c_ω = −1`. Their Theorem 3.5 guarantees `c(f) ≠ 0` for every eigenfunction, which
is what makes that legal.

What is exactly known, and therefore gradeable
----------------------------------------------
1. **A comparison operator with closed-form spectrum.** Their §3.2 introduces the Dirichlet inverse Laplacian to
   the half power on the same space, with

       λ̃_n = 1/(nπ),      f̃_n = χ_{[−1,1]} sin(nπx)/(nπ)

   — exact, and in the *same* space with the *same* inner product. This is the ideal grading target, and the R4
   machinery certifies its eigenpairs directly.

2. **A rigorous two-sided bracket on the real spectrum** (their Corollary 3.7):

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
Certifying `λf = M(f)` needs rigorous enclosures of the matrix entries `A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)}`, which
are improper integrals, plus a proven bound on their tail. Neither exists here yet. So this module delivers: the
exact operator identity (checkable), the comparison operator's certified eigenpairs (R4 machinery, closed-form
answers), the published bracket as an acceptance gate, and a Galerkin reproduction clearly labelled unrigorous.
The rigorous quadrature is the next piece of work, and naming it is more useful than pretending it is done.
"""
from mpmath import mp, mpf, pi as MPPI, sin as msin, sqrt as msqrt, quad, inf
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
    """The rigorous two-sided bracket of Corollary 3.7: (2/π²)λ̃_n ≤ λ_n < λ̃_n, as an interval."""
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

def _A_entry(n, m):
    """A_{nm} = ⟨s_n, s_m⟩_{Ḣ^{1/2}(ℝ)} for s_n = χ_{[−1,1]} sin(nπx).

    From ŝ_n(ξ) = 2i(−1)^n nπ sin ξ/(n²π²−ξ²),

        A_{nm} = 4π(−1)^{n+m} nm ∫₀^∞ ξ sin²ξ / ((n²π²−ξ²)(m²π²−ξ²)) dξ

    All singularities are removable — sin²ξ has a double zero at every ξ = kπ. **This representation is not in the
    paper**; it was derived here and is validated only by reproducing their six published eigenvalues. The
    quadrature below is ordinary, not rigorous, so nothing computed from it is a certificate.
    """
    n, m = int(n), int(m)
    sgn = mpf(-1) ** (n + m)

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

    breaks = [0] + [k * MPPI for k in range(1, 4 * max(n, m) + 6)] + [inf]
    val = quad(integrand, breaks)
    return 4 * MPPI * sgn * n * m * val


def galerkin_eigenvalues(K=8):
    """Largest K eigenvalues of M by Galerkin projection onto span{s_1..s_K}.

    Solves A c = λ diag(n²π²) c. The mass matrix is diagonal because ⟨s_n, s_m⟩_{Ḣ¹} = n²π² δ_{nm}. Converges
    monotonically from below, being a Galerkin approximation of a supremum.

    **Machine A output.** No claim of rigour: the entries come from ordinary quadrature.
    """
    A = mp.matrix(K, K)
    for i in range(K):
        for j in range(i, K):
            v = _A_entry(i + 1, j + 1)
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
