"""Lehmann–Maehly upper bounds for the eigenvalues of a compact positive operator, in interval arithmetic.

The complement to Rayleigh–Ritz. On `V`, Courant–Fischer gives `λ_j ≥ min` of the Rayleigh quotient over any
j-dimensional trial subspace — a **lower** bound needing no truncation estimate at all, which is what
`problem_dg_profile.certified_bracket` already uses. Nothing so cheap gives the other side. Lehmann does.

Prior art — none of this framework is new, and the file says so
---------------------------------------------------------------
Lower bounds by intermediate problems run Weinstein → Aronszajn → **Bazley–Fox** → Temple–Lehmann → Goerisch →
**Beattie–Greenlee**. In particular **truncation** of these constructions — which is what this module does — has
been a named subject since Bazley & Fox, *Truncations in the Method of Intermediate Problems for Lower Bounds to
Eigenvalues*, J. Res. NBS **65B**(2) (1961) 105–111, which already reduces the computation to matrix problems.
Beattie & Greenlee, *Convergence theorems for intermediate problems. II* (2002) supplies convergence theory for
the abstract methods.

Nothing here is a new theorem. What is problem-specific is the *instantiation* in `problem_dg_profile.py` — the
reduction of `A₂` to `AᵀB⁻¹A` for this operator and basis, and the explicit certified tail. See
`../LITERATURE-CHECK.md` for the search, including one rejected match worth knowing about: Beattie–Greenlee also
has a "Corollary 3.7", and it is **not** the Huang–Tong–Wei Corollary 3.7 this line cites.

The setting, and the sign that matters
--------------------------------------
Put `T = −M`. Since M is compact, self-adjoint and positive with `λ₁ ≥ λ₂ ≥ … → 0`, T is **bounded below** with
eigenvalues `−λ₁ ≤ −λ₂ ≤ … → 0` and essential spectrum `{0}`. Rayleigh–Ritz on T bounds `−λ_j` from above (i.e.
`λ_j` from below, as before); **Lehmann bounds the eigenvalues of T below a shift ρ from below**, which is
`λ_j` from **above**. That is the direction the truncation question needs.

Choosing ρ, and what it costs
-----------------------------
The hypothesis is that the number of eigenvalues of T below ρ is known — exactly J. Since those are
`−λ₁ … −λ_J`, this means `λ_{J+1} < −ρ < λ_J`, so it needs

  * a **lower** bound on `λ_J`  — ours, from `certified_bracket`; and
  * an **upper** bound on `λ_{J+1}` — Corollary 3.7 of the source.

So Lehmann does not remove the dependence on Corollary 3.7; it converts it from *the answer* into *an a priori
input*, and returns bounds far sharper than the corollary itself. That distinction is the whole value here, and
overstating it would be the kind of claim this line exists to avoid.

The matrices
------------
With trial vectors `w₁…w_n`,

    A₀ = [⟨w_i, w_j⟩],   A₁ = [⟨T w_i, w_j⟩],   A₂ = [⟨T w_i, T w_j⟩]

and, writing `L = A₁ − ρA₀` and `R = A₂ − 2ρA₁ + ρ²A₀ = [⟨(T−ρ)w_i, (T−ρ)w_j⟩] ≻ 0`, solve `L x = τ R x`. The
negative eigenvalues `τ₁ ≤ … ≤ τ_p < 0` give `ρ + 1/τ_k` as lower bounds for the eigenvalues of T below ρ. In our
signs: **negate and reverse**, and the result bounds `λ₁, λ₂, …` from above. The indexing was fixed by
experiment on an operator with a known spectrum before any of it was written down here.

**A₂ was the price, and it turned out to be cheap.** `A₀` and `A₁` are what `certified_bracket` already builds
(`A₁` is minus the certified `A_entry` matrix). `A₂ = ⟨M w_i, M w_j⟩_{Ḣ¹}` looked as though it needed M *applied*
to a trial function rather than tested against one — by the source's identity `∂_x M(f) = −χ(H(f) + c(f))`, the
integral `∫₋₁¹ (H w_i + c(w_i))(H w_j + c(w_j)) dx`, wanting the Hilbert transform of a truncated sine.

It does not. `M` maps `V` into `V` and `{s_k}` is a basis of `V`, so `A₂ = AᵀB⁻¹A` — see
`problem_dg_profile.A2_enclosure` and `lehmann_matrices`. That reduction is the problem-specific part of this
work; the machinery in this file is not. The Hilbert-transform route survives as an **independent cross-check**,
which is a better use for it: the certified interval contains the value that route computes.

Certified without an eigensolver
--------------------------------
Enclosing the τ rigorously would normally mean certified eigenvalues of an interval pencil. It does not have to:
since `R ≻ 0`, **Sylvester's law of inertia** says the number of pencil eigenvalues below `t` equals the number of
negative eigenvalues of `L − tR`, which an LDLᵀ factorisation counts. Done in interval arithmetic, a pivot whose
enclosure straddles zero makes the count unknowable — and `inertia_below` returns `None` rather than guessing,
so a bracket is either established or refused.
"""
from mpmath import iv, mp, mpf

from ivutil import lo, hi

__all__ = ['inertia_below', 'bracket_tau', 'upper_bounds']


def inertia_below(L, R, t, n):
    """Number of eigenvalues of the pencil (L, R) strictly below `t`, or None if interval arithmetic cannot tell.

    R ≻ 0, so by Sylvester's law of inertia this is the count of negative eigenvalues of `L − tR`, which symmetric
    LDLᵀ delivers as the number of negative pivots. No eigensolver, and no square roots.
    """
    S = [[L[i][j] - iv.mpf(t) * R[i][j] for j in range(n)] for i in range(n)]
    neg = 0
    for k in range(n):
        piv = S[k][k]
        if lo(piv) < 0 < hi(piv) or (lo(piv) == 0 and hi(piv) == 0):
            return None                      # the sign of this pivot is not decided; refuse rather than guess
        if hi(piv) < 0:
            neg += 1
        for i in range(k + 1, n):
            f = S[i][k] / piv
            for j in range(k, n):
                S[i][j] = S[i][j] - f * S[k][j]
    return neg


def bracket_tau(L, R, n, k, lo_guess, hi_guess, steps=200):
    """Rigorous bracket on the k-th smallest pencil eigenvalue (k = 1 is the most negative), by bisection on
    the inertia count. Returns (a, b) with the eigenvalue provably in [a, b], or None if it cannot be isolated."""
    a, b = mpf(lo_guess), mpf(hi_guess)
    if inertia_below(L, R, a, n) is None or inertia_below(L, R, b, n) is None:
        return None
    if not (inertia_below(L, R, a, n) < k <= inertia_below(L, R, b, n)):
        return None
    for _ in range(steps):
        m = (a + b) / 2
        c = inertia_below(L, R, m, n)
        if c is None:
            break
        if c < k:
            a = m
        else:
            b = m
        if b - a < mpf('1e-30'):
            break
    return a, b


def upper_bounds(A0, A1, A2, rho, J, n, span=None):
    """Certified upper bounds on λ₁ … λ_J, given the three Lehmann matrices as intervals and a valid shift ρ.

    ρ must satisfy `λ_{J+1} < −ρ < λ_J`; the caller establishes that from a certified lower bound on λ_J and a
    published upper bound on λ_{J+1}, and this function does not re-derive it. Returns a list of J upper bounds,
    or None in a slot the bisection could not isolate.
    """
    rho = mpf(rho)
    L = [[A1[i][j] - iv.mpf(rho) * A0[i][j] for j in range(n)] for i in range(n)]
    R = [[A2[i][j] - iv.mpf(2 * rho) * A1[i][j] + iv.mpf(rho ** 2) * A0[i][j] for j in range(n)] for i in range(n)]

    span = span or (mpf('-1e12'), mpf('-1e-12'))
    out = []
    for k in range(1, J + 1):
        br = bracket_tau(L, R, n, k, span[0], span[1])
        if br is None:
            out.append(None)
            continue
        a, b = br
        # tau in [a, b], both negative. rho + 1/tau is a LOWER bound on an eigenvalue of T = -M, so -(rho + 1/tau)
        # is an UPPER bound on the corresponding lambda. 1/tau is increasing in tau over the negatives, so the
        # weakest (largest) value of -(rho + 1/tau) comes from the endpoint giving the smallest rho + 1/tau.
        cand = [-(rho + 1 / a), -(rho + 1 / b)]
        out.append(max(cand))
    out.reverse()          # tau_1 (most negative) bounds the SMALLEST lambda below rho; reverse to index by j
    return out
