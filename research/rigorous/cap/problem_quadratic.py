"""R1 machinery validation — a quadratic convolution equation whose solution is known in closed form.

    F(a) = a − b − μ (a * a) = 0,        b = e₁,        a supported on m ≥ 1.

In generating-function form, with A(x) = Σ a_m x^m, this is A = x + μA², whose solution is

    A(x) = (1 − √(1 − 4μx)) / (2μ)   =   Σ_{m≥1} C_{m−1} μ^{m−1} x^m

with C_n the Catalan numbers. So **a_m = C_{m−1} μ^{m−1}, exactly**, and the ℓ¹_ν norm is finite precisely when
4μν < 1 — the series' radius of convergence.

Why this problem, and not something that looks more like a PDE
--------------------------------------------------------------
It is the smallest thing that exercises every part of the verifier at once:

* genuinely **infinite-dimensional** — the solution has infinitely many non-zero modes;
* genuinely **quadratic**, so Z₂ > 0 and the nonlinear term of the radii polynomial is actually tested (the CLM
  problem next door is bilinear, and its Z₂ vanishes — it would leave that path untested);
* the **tail** must be bounded analytically, because the convolution of two width-N sequences has width 2N and the
  operator's columns beyond N are never computed;
* and the answer is known **exactly**, so the enclosure can be graded rather than admired.

Every quadratic PDE profile equation has this algebraic core. Getting it wrong here would be invisible in a
problem whose answer nobody knows.
"""
from mpmath import mp, mpf, binomial
from ell1 import Seq, cival, czero, cabs_hi
from ivutil import ival, lo, hi
import radiipoly


def catalan(n):
    """C_n = binomial(2n, n)/(n+1), exactly, as an mpf at the working precision."""
    return binomial(2 * n, n) / (n + 1)


def exact_coefficients(N, mu):
    """The true solution's first N coefficients, a_m = C_{m−1} μ^{m−1}."""
    mu = mpf(mu)
    return [catalan(m - 1) * mu ** (m - 1) for m in range(1, N + 1)]


def numerical_solution(N, mu):
    """ā by the defining recursion a₁ = 1, a_m = μ Σ_{j=1}^{m−1} a_j a_{m−j}.

    Computed in ordinary (non-interval) arithmetic on purpose: ā is Machine A's output, and its accuracy affects
    only whether the certificate closes, never whether it is true.
    """
    mu = mpf(mu)
    a = [mpf(0)] * (N + 1)
    a[1] = mpf(1)
    for m in range(2, N + 1):
        s = mpf(0)
        for j in range(1, m):
            s += a[j] * a[m - j]
        a[m] = mu * s
    seq = Seq(N)
    for m in range(1, N + 1):
        seq[m] = cival(a[m], 0)
    return seq


def F(a, mu, N_b=1):
    """F(a) = a − b − μ(a*a), exact on width 2·a.M."""
    mu_i = cival(mu, 0)
    q = a.conv(a).scale(mu_i)
    out = a.resized(q.M) - q
    out[N_b] = out[N_b] - cival(1, 0)     # subtract b = e_1
    return out


def _apply_A(v, Ainv_rows, N):
    """Apply the approximate inverse A to a sequence v.

    A is block-diagonal by construction: the numerically inverted (N x N) block on modes 1..N, and the **identity**
    on modes > N. The identity is the right tail choice here because DF(ā) = I − 2μ(ā * ·) is the identity plus a
    strictly mode-raising term, so it is already near-identity out in the tail.

    **A is injective**, which the radii-polynomial theorem requires and cannot check for itself. On the tail A is
    the identity. On the finite block it is the exact inverse of a matrix that is lower triangular with unit
    diagonal (see `build_A`), hence invertible. A block-diagonal operator with an invertible block and an identity
    block is injective.
    """
    out = Seq(v.M)
    for m in range(1, v.M + 1):
        if m <= N:
            s = czero()
            for n in range(1, N + 1):
                c = Ainv_rows[m - 1][n - 1]
                if c != 0:
                    s = s + v[n] * cival(c, 0)
            out[m] = s
        else:
            out[m] = v[m]
    return out


def build_A(abar, mu, N):
    """Numerically invert DF(ā) restricted to modes 1..N.

    DF(ā)h = h − 2μ(ā * h), so on modes 1..N the matrix is M[m][n] = δ_{mn} − 2μ·ā_{m−n}: **lower triangular with
    unit diagonal**, hence always invertible and invertible stably by forward substitution. That is a property of
    this problem, not a general one, and it is why no pivoting appears here.
    """
    mu = mpf(mu)
    abar_re = [mpf(0)] * (N + 1)
    for m in range(1, N + 1):
        abar_re[m] = mpf(lo(abar[m].real))
    M = [[mpf(0)] * N for _ in range(N)]
    for m in range(1, N + 1):
        for n in range(1, N + 1):
            v = mpf(1) if m == n else mpf(0)
            d = m - n
            if 1 <= d <= N:
                v -= 2 * mu * abar_re[d]
            M[m - 1][n - 1] = v
    # forward substitution, column by column
    Ainv = [[mpf(0)] * N for _ in range(N)]
    for col in range(N):
        e = [mpf(0)] * N
        e[col] = mpf(1)
        x = [mpf(0)] * N
        for i in range(N):
            s = e[i]
            for j in range(i):
                s -= M[i][j] * x[j]
            x[i] = s / M[i][i]
        for i in range(N):
            Ainv[i][col] = x[i]
    return Ainv


def bounds(abar, Ainv, mu, nu, N):
    """The three bounds, with the tail handled analytically.

    **Y₀ = ‖A F(ā)‖_ν.** F(ā) is supported on modes 1..2N and computed exactly, so this is a finite sum.

    **Z₁ = ‖I − A·DF(ā)‖_ν**, an operator on all of ℓ¹_ν, so every column must be bounded — including the
    infinitely many with n > N, which are never computed:

      * n ≤ N: the column is computed exactly. DF(ā)e_n = e_n − 2μ(ā*e_n) has support in {n} ∪ [n+1, n+N], A is
        applied honestly (finite block below N, identity above), and the column's ν-norm divided by ν^n is taken.
      * n > N: **every** mode in DF(ā)e_n then lies above N, where A is the identity. So the column collapses to
        (I − A·DF(ā))e_n = 2μ(ā * e_n), whose norm is at most 2μ‖ā‖_ν·ν^n. Dividing by ν^n gives the bound
        **2μ‖ā‖_ν, uniformly in n** — one number covering infinitely many columns. That is the tail estimate, and
        it is the only step in this file that a computer could not have discovered.

    **Z₂ = 2μ‖A‖_ν.** Since D²F[h,k] = −2μ(h*k) and ℓ¹_ν is a Banach algebra, ‖A·D²F[h,k]‖ ≤ 2μ‖A‖·‖h‖·‖k‖ — the
    algebra property doing in one line what would otherwise be a separate estimate per term.
    """
    nu = mpf(nu)
    w = lambda n: nu ** abs(n)

    # ---- Y0 ----
    Fa = F(abar, mu)
    Y0 = _apply_A(Fa, Ainv, N).norm(nu)

    # ---- Z1: finite columns ----
    Z1 = mpf(0)
    for n in range(1, N + 1):
        en = Seq(max(N, n))
        en[n] = cival(1, 0)
        DFen = en.resized(n + N) - abar.conv(en).scale(cival(2 * mpf(mu), 0))
        col = en.resized(DFen.M) - _apply_A(DFen, Ainv, N)
        v = col.norm(nu) / w(n)
        if v > Z1:
            Z1 = v
    # ---- Z1: the tail columns, all of them, in one bound ----
    Z1_tail = 2 * mpf(mu) * abar.norm(nu)
    Z1 = max(Z1, Z1_tail)

    # ---- Z2 ----
    A_norm = mpf(1)                     # identity on the tail contributes exactly 1
    for n in range(1, N + 1):
        en = Seq(N)
        en[n] = cival(1, 0)
        v = _apply_A(en, Ainv, N).norm(nu) / w(n)
        if v > A_norm:
            A_norm = v
    Z2 = 2 * mpf(mu) * A_norm

    return Y0, Z1, Z2, {'Z1_finite': mp.nstr(Z1, 8), 'Z1_tail': mp.nstr(Z1_tail, 8),
                        'A_norm': mp.nstr(A_norm, 8), 'abar_norm': mp.nstr(abar.norm(nu), 8)}


def prove(N=25, mu='0.1', nu='1.5'):
    """Run the whole chain and return (certificate, ā, N, μ, ν)."""
    abar = numerical_solution(N, mu)
    Ainv = build_A(abar, mu, N)
    Y0, Z1, Z2, extra = bounds(abar, Ainv, mu, nu, N)
    cert = radiipoly.verify(Y0, Z1, Z2)
    cert.extra.update(extra)
    cert.extra.update({'problem': 'a = b + mu*(a*a), b = e_1', 'N': N, 'mu': str(mu), 'nu': str(nu),
                       'statement': ('A unique solution of F(a)=0 exists within r of the computed abar in '
                                     'ell^1_nu. This is a statement about this algebraic equation only.')})
    return cert, abar, N, mpf(mu), mpf(nu)
