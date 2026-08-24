"""R1, the real route — CLM through radii polynomials, and a certified lower bound on the blow-up time.

`clm.py` computed the blow-up time from the closed-form solution. That is a legitimate certified result, but it
uses the answer as the method, and none of it transfers to a problem whose answer nobody knows. This file redoes
R1 the way R2 and R3 would have to be done: a fixed-point equation in a sequence space, with the infinitely many
uncomputed modes controlled by a bound.

The formulation
---------------
The only structural fact used is CLM's defining reduction: with z = H(ω) + iω the equation becomes the *pointwise*
ODE z_t = z²/2, which integrates to the algebraic relation

    z(t) = z₀ + (t/2)·z(t)·z₀

— elementary, and derived from the equation rather than from the solution formula. In Fourier coefficients, with
q = t/2, this is a fixed-point equation in ℓ¹_ν:

    **F(a) = a − b − q·(a * b) = 0**,      b = ẑ₀,   a = ẑ(·, t).

For ω₀ = cos x: z₀ = sin x + i·cos x = i·e^{−ix}, so b has the single coefficient b₋₁ = i.

What closing the contraction proves
-----------------------------------
A certificate at (t, ν) says: the CLM solution at time t exists, its Fourier series converges in ℓ¹_ν, and it lies
within r of the computed ā. Since a finite ℓ¹_ν norm with ν > 1 means the coefficients decay like ν^{−|m|}, the
certificate also states that **ω(·, t) extends analytically to a strip of half-width log ν** — the weight is a
result, not bookkeeping.

Because a certificate exists for every t below a threshold, the run yields a **certified lower bound on T**.

The bound is sharp, and that is the grading
-------------------------------------------
The tail estimate below gives Z₁ = q·ν, so the contraction closes exactly when q·ν < 1, i.e. **t < 2/ν**. At ν = 1
that is t < 2, so the method certifies **T ≥ 2**. The exact answer is T = 2. The lower bound is therefore not
merely valid but *sharp* — the verifier's threshold coincides with the true radius of convergence, which is as
good as this kind of argument can be.

**Failure to close for t > 2/ν proves nothing.** A contraction that does not close is a statement about the test.
Blow-up itself is not established here; only existence up to a time, and hence a lower bound on T.
"""
from mpmath import mp, mpf
from ell1 import Seq, cival, czero, cabs_hi
from ivutil import ival, lo, hi
import radiipoly

FAILED = radiipoly.FAILED
CLOSED = radiipoly.CLOSED


def z0_cos():
    """ẑ₀ for ω₀ = cos x: z₀ = sin x + i cos x = i e^{−ix}, a single coefficient b₋₁ = i."""
    b = Seq(1)
    b[-1] = cival(0, 1)
    return b


def exact_a(N, q):
    """The exact coefficients a₋ₘ = i^m q^{m−1}, for grading only — never used inside the proof."""
    q = mpf(q)
    a = Seq(N)
    for m in range(1, N + 1):
        # i^m cycles i, -1, -i, 1
        r = [cival(0, 1), cival(-1, 0), cival(0, -1), cival(1, 0)][(m - 1) % 4]
        a[-m] = r * cival(q ** (m - 1), 0)
    return a


def numerical_solution(N, q):
    """ā from the recursion the fixed-point equation itself dictates: a₋₁ = i, a₋ₘ = q·i·a₋₍ₘ₋₁₎.

    This is Machine A: ordinary arithmetic, no claims made. It happens to be exact here, which costs nothing —
    the verifier does not know or care where ā came from.
    """
    q = mpf(q)
    a = Seq(N)
    prev = cival(0, 1)
    a[-1] = prev
    for m in range(2, N + 1):
        prev = prev * cival(0, 1) * cival(q, 0)
        a[-m] = prev
    return a


def F(a, b, q):
    """F(a) = a − b − q(a*b), computed exactly on the natural width."""
    conv = a.conv(b).scale(cival(mpf(q), 0))
    M = max(a.M, b.M, conv.M)
    return a.resized(M) - b.resized(M) - conv.resized(M)


def bounds(abar, b, q, nu, N):
    """The three bounds for the CLM fixed point, tail included.

    The problem is **bilinear** — F is linear in a for fixed b — so D²F = 0 and **Z₂ = 0** exactly. That is why
    the quadratic validation problem next door exists: it is the one that tests the Z₂ path, which this one leaves
    untouched.

    **Y₀ = ‖A F(ā)‖.** With ā the truncated recursion, F(ā) vanishes on every computed mode and leaves exactly one
    residual, at mode −(N+1), of size q·|ā₋ₙ|. Finite and explicit.

    **Z₁ = ‖I − A·DF(ā)‖** with DF(ā)h = h − q(b*h), and b a single mode, so b*eₙ = i·e₍ₙ₋₁₎ — the operator simply
    shifts. For the tail columns:

      * n < −N: both n and n−1 lie in the tail where A is the identity, so the column is q·i·e₍ₙ₋₁₎ with ν-norm
        q·ν^{|n|+1}; dividing by ν^{|n|} gives **q·ν**, uniformly.
      * n > N: the shifted mode is n−1, so the column norm over ν^{|n|} is **q/ν ≤ q·ν**.

    So the whole infinite tail costs one number, **q·ν**, and the contraction closes precisely when q·ν < 1. That
    single inequality is the entire blow-up criterion this route produces.
    """
    nu = mpf(nu)
    q = mpf(q)
    w = lambda n: nu ** abs(n)

    # A is the identity here: DF(ā) = I − q(b * ·) is already near-identity when qν < 1, and using the identity
    # keeps every bound explicit. A better A would sharpen Y0 slightly and change nothing structural.
    Fa = F(abar, b, q)
    Y0 = Fa.norm(nu)

    Z1_finite = mpf(0)
    for n in range(-N, N + 1):
        if n == 0:
            continue
        en = Seq(N + 2)
        en[n] = cival(1, 0)
        DFen = en - en.conv(b).scale(cival(q, 0)).resized(en.M)
        col = en.resized(max(en.M, DFen.M)) - DFen.resized(max(en.M, DFen.M))
        v = col.norm(nu) / w(n)
        if v > Z1_finite:
            Z1_finite = v
    Z1_tail = q * nu
    Z1 = max(Z1_finite, Z1_tail)
    return Y0, Z1, mpf(0), {'Z1_finite': mp.nstr(Z1_finite, 8), 'Z1_tail': mp.nstr(Z1_tail, 8),
                            'q': mp.nstr(q, 8), 'nu': mp.nstr(nu, 8)}


def prove_at(t, nu='1.0', N=30):
    """Certify existence of the CLM solution at time t in ℓ¹_ν."""
    q = mpf(t) / 2
    b = z0_cos()
    abar = numerical_solution(N, q)
    Y0, Z1, Z2, extra = bounds(abar, b, q, nu, N)
    cert = radiipoly.verify(Y0, Z1, Z2)
    cert.extra.update(extra)
    cert.extra.update({'problem': 'CLM at fixed time: a = b + (t/2)(a*b), omega0 = cos x',
                       't': mp.nstr(mpf(t), 10), 'N': N,
                       'statement': ('The CLM solution at this time exists and its Fourier series converges in '
                                     'ell^1_nu; with nu > 1 that is analyticity in a strip of half-width log(nu). '
                                     'This is a statement about the CLM equation only.')})
    return cert, abar


def certified_lower_bound_on_T(nu='1.0', N=30, t_lo='0.1', t_hi='4.0', steps=60):
    """Bisect on t to find the largest time at which the contraction still closes.

    The returned number is a **certified lower bound on the blow-up time**: existence is proved at t_ok, so
    T > t_ok. Nothing here proves blow-up at any time — the failure side of the bisection is a statement about the
    test, not about the equation, and is reported as such.
    """
    a, bnd = mpf(t_lo), mpf(t_hi)
    if not prove_at(a, nu, N)[0].proved:
        return None, 'the contraction does not close even at t_lo'
    for _ in range(steps):
        m = (a + bnd) / 2
        if prove_at(m, nu, N)[0].proved:
            a = m
        else:
            bnd = m
    return a, f'existence certified at t = {mp.nstr(a, 12)}; the test first fails by t = {mp.nstr(bnd, 12)}'
