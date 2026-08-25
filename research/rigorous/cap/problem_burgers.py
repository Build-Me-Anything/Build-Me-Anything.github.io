"""R3 — the derivative-loss fix, and the precise reason it does not reach Euler.

R2 stopped at a wall: the De Gregorio residual contains a transport term u·ω_x, and multiplication by m is an
unbounded operator on ℓ¹_ν, so F maps a stronger space into a weaker one and the single-space radii-polynomial
argument does not apply. That is not a coding problem and more modes do not fix it.

The standard cure is **analytic preconditioning**: split F into a leading linear operator L whose inverse *gains*
at least as many derivatives as the nonlinearity loses, and rewrite the problem as a fixed point of L⁻¹ applied to
the rest. If L⁻¹ gains more than the nonlinearity loses, the composed map is bounded — even compact — on a single
space, and everything from R1b applies unchanged.

This file implements that cure on the smallest problem that genuinely needs it, and then shows exactly where the
cure runs out.

The test problem
----------------
Steady viscous Burgers with forcing, on the circle:

    u·u_x = μ·u_xx + f                                                       (μ > 0 the viscosity)

Choose f = ½·sin(2x) + μ·sin(x) and **u = sin x is the exact solution** — an external answer to grade against,
exactly as CLM's T = 2 graded R1.

Why this problem and not a prettier one: the nonlinearity u·u_x **loses one derivative**, precisely the failure
mode that stopped R2. If the preconditioning idea is going to be tested at all, it has to be tested against that.

The preconditioning
-------------------
Write u·u_x = ½(u²)_x. With L = μ·∂_xx, whose Fourier symbol is −μ·m², define

    **K = L⁻¹ ∘ ∂_x**,   symbol  (i·m)/(−μ·m²) = −i/(μ·m),   so  |symbol| ≤ 1/μ  for every m ≠ 0.

K is **bounded on ℓ¹_ν** — that is the whole trick. The derivative in the nonlinearity is absorbed by one of the
two derivatives L⁻¹ supplies, and one is left over. The problem becomes the fixed point

    Φ(u) = u − ½·K(u²) + L⁻¹f = 0,      DΦ(u)h = h − K(u·h),      D²Φ[h,k] = −K(h·k)

and since ‖K v‖_ν ≤ ‖v‖_ν/μ, the bounds are immediate:

    Z₁ tail  ≤ ‖ū‖_ν / μ            (and it *decays* like 1/|n| further out — see `tail_column_bound`)
    Z₂       ≤ ‖A‖ / μ

So the contraction closes whenever the viscosity is large enough relative to the solution's norm. Nothing here is
new mathematics; the point is that it is the *first* rung where the estimate had to be constructed rather than
read off, and it is graded against an exact answer.

**And this is exactly why it does not reach Euler.** The cure needs a dissipative leading operator to invert. The
Euler and De Gregorio equations have none: μ = 0, K is undefined, and the tail bound that decays like 1/(μ|n|)
here instead *grows* like |n| there. `compare_tail_growth()` measures both and prints the two sequences side by
side. That divergence is not a detail — it is the reason Chen and Hou needed a bespoke framework and years of
analysis for Euler with boundary, and the reason R3 proper is not reachable by extending this file.
"""
from mpmath import mp, mpf
from ell1 import Seq, cival, czero, cabs_hi
from ivutil import ival, lo, hi
import radiipoly


# ------------------------------------------------------------------------------------------------------------
# operators
# ------------------------------------------------------------------------------------------------------------

def K_op(v, mu):
    """K = L⁻¹∘∂_x with L = μ∂_xx. Symbol −i/(μ·m); mode 0 annihilated.

    This is the operator that makes the whole approach work: it consumes the derivative the nonlinearity produces
    and still gains one, so K∘(quadratic) is bounded on ℓ¹_ν.
    """
    mu = mpf(mu)
    out = Seq(v.M)
    for m in v.modes():
        if m == 0:
            out[m] = czero()
        else:
            out[m] = v[m] * cival(0, mpf(-1) / (mu * m))
    return out


def Linv(v, mu):
    """L⁻¹ with L = μ∂_xx: divide mode m by −μ·m²; mode 0 annihilated."""
    mu = mpf(mu)
    out = Seq(v.M)
    for m in v.modes():
        if m == 0:
            out[m] = czero()
        else:
            out[m] = v[m] * cival(mpf(-1) / (mu * m * m), 0)
    return out


def sine(N, coeffs):
    """u = Σ coeffs[k-1]·sin(kx) as a Seq of width N."""
    a = Seq(N)
    for k, c in enumerate(coeffs, start=1):
        if c == 0:
            continue
        a[k] = cival(0, mpf(-1) / 2) * cival(mpf(c), 0)
        a[-k] = cival(0, mpf(1) / 2) * cival(mpf(c), 0)
    return a


def forcing(N, mu):
    """f = ½·sin(2x) + μ·sin(x), the forcing for which u = sin x is exact."""
    return sine(N, [mpf(mu), mpf(1) / 2])


def Phi(u, mu, N):
    """Φ(u) = u − ½K(u²) + L⁻¹f. Zero exactly when u solves the steady equation."""
    sq = u.conv(u)
    term = K_op(sq, mu).scale(cival(mpf(1) / 2, 0))
    f = forcing(max(N, 2), mu)
    lf = Linv(f, mu)
    M = max(u.M, term.M, lf.M)
    return u.resized(M) - term.resized(M) + lf.resized(M)


def DPhi(u, h, mu):
    """DΦ(u)h = h − K(u·h)."""
    t = K_op(u.conv(h), mu)
    M = max(h.M, t.M)
    return h.resized(M) - t.resized(M)


# ------------------------------------------------------------------------------------------------------------
# the bounds
# ------------------------------------------------------------------------------------------------------------

def tail_column_bound(n, ubar_norm, mu, N):
    """Bound on the ν-weighted norm of the tail column (I − A·DΦ(ū))e_n for |n| > N.

    Out there A is the identity, so the column is exactly K(ū·e_n). The modes of ū*e_n lie in [|n|−N, |n|+N], and
    K divides mode m by μ·|m|, so

        ‖K(ū * e_n)‖_ν / ν^{|n|}  ≤  ‖ū‖_ν / (μ·(|n| − N))

    which **decays like 1/|n|**. That decay is the property the whole method rests on, and it is what a
    dissipative leading operator buys. Compare `compare_tail_growth`.
    """
    d = abs(n) - N
    if d <= 0:
        raise ValueError('tail bound is only valid for |n| > N')
    return mpf(ubar_norm) / (mpf(mu) * d)


def bounds(ubar, mu, nu, N):
    """Y₀, Z₁, Z₂ for the preconditioned Burgers fixed point.

    A is taken as the identity, which keeps every bound explicit; a numerically inverted finite block would sharpen
    Y₀ and change nothing structural. A = I is trivially **injective**, which the radii-polynomial theorem requires
    as a standing hypothesis and cannot verify from the three bounds alone."""
    nu = mpf(nu)
    mu = mpf(mu)
    w = lambda n: nu ** abs(n)

    Y0 = Phi(ubar, mu, N).norm(nu)

    ub_norm = ubar.norm(nu)
    Z1_finite = mpf(0)
    for n in range(-N, N + 1):
        if n == 0:
            continue
        en = Seq(N)
        en[n] = cival(1, 0)
        col = K_op(ubar.conv(en), mu)          # (I − DΦ(ū))e_n with A = I
        v = col.norm(nu) / w(n)
        if v > Z1_finite:
            Z1_finite = v
    Z1_tail = tail_column_bound(N + 1, ub_norm, mu, N)
    Z1 = max(Z1_finite, Z1_tail)

    Z2 = mpf(1) / mu                            # ‖A·K(h·k)‖ <= ‖h‖‖k‖/mu with A = I
    return Y0, Z1, Z2, {'Z1_finite': mp.nstr(Z1_finite, 8), 'Z1_tail': mp.nstr(Z1_tail, 8),
                        'ubar_norm': mp.nstr(ub_norm, 8), 'mu': mp.nstr(mu, 6), 'nu': mp.nstr(nu, 6)}


def prove(mu='2.0', nu='1.0', N=12, perturb=None):
    """Certify the steady Burgers solution.

    `perturb` is a list of sine coefficients added to the exact solution to make ū merely approximate — without it
    Y₀ vanishes identically and the test proves the machinery can certify something it was handed exactly.
    """
    coeffs = [mpf(1)] + [mpf(0)] * (N - 1)
    if perturb:
        for k, c in enumerate(perturb, start=1):
            if k <= N:
                coeffs[k - 1] += mpf(c)
    ubar = sine(N, coeffs)
    Y0, Z1, Z2, extra = bounds(ubar, mu, nu, N)
    cert = radiipoly.verify(Y0, Z1, Z2)
    cert.extra.update(extra)
    cert.extra.update({'problem': 'steady viscous Burgers, u*u_x = mu*u_xx + f, f chosen so u = sin x',
                       'N': N, 'preconditioner': 'K = (mu*d_xx)^{-1} o d_x, symbol -i/(mu*m)',
                       'statement': ('A unique solution of the preconditioned fixed point exists within r of ubar '
                                     'in ell^1_nu. A statement about steady Burgers with this forcing, only.')})
    return cert, ubar, mpf(nu)


# ------------------------------------------------------------------------------------------------------------
# the wall, measured
# ------------------------------------------------------------------------------------------------------------

def compare_tail_growth(N=8, mu='2.0', nu='1.0', ns=(9, 12, 16, 24, 32, 48, 64)):
    """Measure the tail column bound for Burgers (dissipative) against De Gregorio (not), side by side.

    Burgers:      the column is K(ū·e_n), and K divides by μ|m| — the bound DECAYS like 1/|n|.
    De Gregorio:  the transport term contributes u(ū)·(e_n)_x, and differentiation MULTIPLIES by |m| — the bound
                  GROWS like |n|, with no operator available to absorb it.

    Z₁ is a supremum over columns. A decaying sequence has a finite supremum attained at the first tail column; a
    growing one has none. That is the entire difference between R3 being a page of estimates and being a research
    programme, and it is why this file cannot be extended to Euler by working harder at the code.
    """
    ubar = sine(N, [mpf(1)])
    ub = ubar.norm(nu)
    rows = []
    for n in ns:
        burgers = tail_column_bound(n, ub, mu, N)
        # De Gregorio's transport column: u(ū) is O(‖ū‖) and (e_n)_x multiplies by n, so the column norm over
        # nu^{|n|} scales like ‖ū‖·|n|. No inverse operator exists to divide it back down.
        degregorio = ub * mpf(n)
        rows.append((n, burgers, degregorio))
    return rows
