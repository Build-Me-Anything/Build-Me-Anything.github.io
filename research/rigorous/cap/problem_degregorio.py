"""R2 — De Gregorio, and the place where the machinery stops.

The equation on the circle:

    ω_t + u·ω_x = ω·u_x,        u_x = H(ω),        u of zero mean

so in Fourier, with a = ω̂:  û_m = −a_m/|m| (m ≠ 0), (u_x)^ = −i·sgn(m)·a_m = (Ha)_m, (ω_x)^ = i·m·a_m.

A steady state, exactly
-----------------------
ω = A·sin x is a steady state for every A. Check: H(sin x) = −cos x, so u_x = −A cos x and u = −A sin x; then
ω·u_x = −A² sin x cos x and u·ω_x = −A² sin x cos x, which cancel. That gives R2 the thing every rung in this
programme needs — **an externally known answer** — and it exercises code that R1 never touched: the derivative,
the antiderivative, the reality/oddness structure, and a genuinely nonlinear residual.

Two symmetries have to be removed before anything can be verified
------------------------------------------------------------------
F is homogeneous of degree 2, so F(λa) = λ²F(a) and the solution set is a *cone*: every steady state comes with a
one-parameter family. Euler's identity then gives DF(a)·a = 2F(a) = 0 at any solution, so **the linearisation is
singular in the direction of the solution itself** — the exact situation the R0 suite's degenerate-root test was
built to refuse. Translation is a second symmetry, removed by working in odd (sine-only) functions.

The amplitude is fixed by replacing the first equation with the phase condition b₁ = 1. That is standard practice
and it is also the honest reason the system below is not simply "the equation": a verifier applied to the raw
equation would correctly refuse forever.

**Where this stops, and why it is not a coding problem**
--------------------------------------------------------
The infinite-dimensional statement does **not** follow from what is computed here, and the obstruction is
structural rather than a matter of more modes or more precision.

F contains the transport term u·ω_x. In ℓ¹_ν its ν-norm is bounded by

    Σ_{j,k} (|a_j|/|j|)·|k|·|a_k|·ν^{|j|+|k|}  =  (Σ_j |a_j|ν^{|j|}/|j|) · ‖D a‖_ν

and ‖Da‖_ν = Σ|m||a_m|ν^{|m|} is **not** bounded by ‖a‖_ν — multiplication by m is an unbounded operator on
ℓ¹_ν for every ν. So F does not map ℓ¹_ν into itself: it maps a stronger space into a weaker one, losing one
derivative. The radii-polynomial argument as used at R1 assumes an operator on a single Banach space and does not
apply.

The fix is known and is not hard to state — a two-space Newton–Kantorovich, F : X → Y with an approximate inverse
A : Y → X that *gains* the derivative the transport term loses, plus a tail estimate showing the leading symbol of
DF really does grow like |m| with a sign that can be inverted. That is Layer 4 of the architecture document: the
part no computer supplies. Writing it down is a research step, and inventing it here — unchecked, against no known
answer — would produce a certificate that looks exactly like the sound ones and means nothing.

So R2 delivers what it can honestly deliver:

  1. the residual of the exact steady state, verified to be zero in interval arithmetic (a full end-to-end check
     of the Fourier, Hilbert, derivative and product code against a known answer);
  2. a **rigorous Krawczyk certificate for the Galerkin truncation** — a genuine theorem about the finite system,
     clearly labelled as such;
  3. this paragraph, which locates the wall precisely instead of asserting that one exists.

**The truncation has a parity condition, and it is not a bug**
--------------------------------------------------------------
Linearising about sin x couples mode m only to modes m +- 1, so DG is tridiagonal with a ZERO diagonal, and the
system splits into two independent blocks: the even-index equations involve only odd-index unknowns, and vice
versa. Invertibility therefore needs both blocks square, which happens only for **odd N**:

    N     even eqs   odd unknowns   square?    verdict
    4        2            1           no       INCONCLUSIVE
    5        2            2          yes       UNIQUE
    6        3            2           no       INCONCLUSIVE
    7        3            3          yes       UNIQUE
    8        4            3           no       INCONCLUSIVE
    9,11,13  n            n          yes       UNIQUE

The verifier refused at every even N, and it was right to: the Galerkin system really is singular there. A solver
that returned a least-squares answer instead would have produced a number at every N and hidden the structure
completely. Use odd N.
"""
from mpmath import mp, mpf
from ell1 import Seq, cival, czero, cabs_hi
from ivutil import ival, lo, hi
from krawczyk import verify_zero, refine, UNIQUE, INCONCLUSIVE


def u_from_omega(a):
    """û_m = −a_m/|m| for m ≠ 0, zero mean. Then (u_x)^ = i·m·û_m = −i·sgn(m)·a_m = H(ω), as required."""
    out = Seq(a.M)
    for m in a.modes():
        if m == 0:
            out[m] = czero()
        else:
            out[m] = a[m] * cival(mpf(-1) / abs(m), 0)
    return out


def B(x, y):
    """The bilinear form with F(a) = B(a, a):   B(x, y) = x·H(y) − u(x)·y_x."""
    return x.conv(y.hilbert()) - u_from_omega(x).conv(y.deriv())


def F(a):
    """Residual of the steady De Gregorio equation, ω·u_x − u·ω_x."""
    return B(a, a)


def DF(a, h):
    """The Frechet derivative applied to h. F is quadratic, so DF(a)h = B(h, a) + B(a, h) — exact, not a
    finite difference. A differenced Jacobian would be an approximation inside what is meant to be a proof."""
    return B(h, a) + B(a, h)


def sine_to_seq(b, N):
    """ω = Σ_{m=1..N} b_m sin(mx)  ->  Fourier coefficients. sin(mx) has â_m = 1/(2i) = −i/2, â_{−m} = +i/2."""
    a = Seq(N)
    for m in range(1, N + 1):
        bm = b[m - 1]
        a[m] = cival(0, mpf(-1) / 2) * cival(bm, 0)
        a[-m] = cival(0, mpf(1) / 2) * cival(bm, 0)
    return a


def seq_to_sine(a, N):
    """Inverse of sine_to_seq: f_n = 2i·â_n, real for a real odd function."""
    out = []
    for n in range(1, N + 1):
        out.append(cival(0, 2) * a[n])
    return out


def exact_steady(N, amplitude=1):
    """ω = amplitude·sin x as a Seq."""
    b = [mpf(0)] * N
    b[0] = mpf(amplitude)
    return sine_to_seq(b, N)


def residual_norm_of_exact(N=8, nu='1.0', amplitude=1):
    """‖F(A sin x)‖_ν — must be zero. The strongest single end-to-end check in this file."""
    return F(exact_steady(N, amplitude)).norm(nu)


# ------------------------------------------------------------------------------------------------------------
# The Galerkin system, and a rigorous certificate for it
# ------------------------------------------------------------------------------------------------------------

def galerkin_map(N):
    """Build G : R^{N-1} -> R^{N-1} for the truncated, phase-fixed system.

    Unknowns are b₂..b_N with b₁ ≡ 1 (the phase condition removing the scaling symmetry). Equations are the sine
    coefficients f₂..f_N of the residual, truncated to modes <= N. Restricting to sine series removes translation.

    Returned as (G, DG) taking and returning interval vectors, so the R0 Krawczyk machinery applies unchanged.
    """
    def _b(vec):
        return [ival(1)] + list(vec)

    def G(vec):
        a = _seq_from_intervals(_b(vec), N)
        f = seq_to_sine(F(a), N)
        return [_real_part(f[n - 1]) for n in range(2, N + 1)]

    def DG(vec):
        a = _seq_from_intervals(_b(vec), N)
        cols = []
        for m in range(2, N + 1):
            e = [ival(0)] * N
            e[m - 1] = ival(1)
            h = _seq_from_intervals(e, N)
            d = seq_to_sine(DF(a, h), N)
            cols.append([_real_part(d[n - 1]) for n in range(2, N + 1)])
        # cols[j] is the derivative w.r.t. unknown j; assemble row-major
        return [[cols[j][i] for j in range(N - 1)] for i in range(N - 1)]

    return G, DG


def _seq_from_intervals(bvec, N):
    a = Seq(N)
    half = cival(0, mpf(-1) / 2)
    for m in range(1, N + 1):
        bm = bvec[m - 1]
        a[m] = half * bm
        a[-m] = cival(0, mpf(1) / 2) * bm
    return a


def _real_part(z):
    """Real part of a complex interval as an interval."""
    return z.real


def verify_galerkin(N=6, radius='1e-3'):
    """Krawczyk certificate for the Galerkin system around b = (1, 0, ..., 0).

    A theorem about the truncated system: within the stated box there is exactly one solution of the N-mode,
    phase-fixed De Gregorio steady equation. It is **not** a theorem about the PDE — see the module docstring.
    """
    G, DG = galerkin_map(N)
    r = mpf(radius)
    X = [ival(-r, r) for _ in range(N - 1)]
    return refine(G, DG, X, shrinks=8)
