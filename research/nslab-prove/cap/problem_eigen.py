"""R4 — certified eigenpairs of a compact operator, the route the literature actually uses for profile equations.

Why this exists, and why it is numbered after R3
------------------------------------------------
R3 implemented the textbook cure for derivative loss: precondition by a dissipative leading operator whose
inverse gains more derivatives than the nonlinearity loses. It works, it is graded against an exact answer, and it
stops dead at μ = 0 — which is where Euler and De Gregorio live.

A literature check (`research/nslab-prove/LITERATURE-CHECK.md`) then established that **this was the wrong door**.
No published proof in this family uses a derivative-gaining inverse. For *profile* equations the standard move is
to reformulate so the loss disappears: Huang, Tong & Wei obtain De Gregorio self-similar profiles as
**eigenfunctions of a compact self-adjoint operator** (CMP 2023, arXiv:2209.08232). A compact operator eigenproblem
is exactly the kind of object a radii-polynomial argument handles **in a single space** — no two-space machinery,
no derivative-gaining inverse, no invention required.

This module builds that machinery generally, and grades it against operators with **exactly known eigenpairs**.
The De Gregorio instantiation waits on the precise operator from the source; guessing it would be the fabrication
failure this project has already been caught committing once.

The formulation
---------------
An eigenvector is only defined up to scale, so `T v = λ v` alone has a one-parameter family of solutions and its
linearisation is singular along that direction — the same degeneracy that forced a phase condition at R2. The
standard fix is to append a normalisation and solve for the pair:

    **F(v, λ) = ( T v − λ v ,  ⟨v, w⟩ − 1 )**,   unknowns (v, λ) ∈ ℓ¹_ν × ℝ

with `w` a fixed sequence chosen so that `⟨v̄, w⟩ ≠ 0`. This is square, and the radii polynomial applies unchanged.

Derivatives, exactly:

    DF(v, λ)(h, δ) = ( T h − λ h − δ v ,  ⟨h, w⟩ )
    D²F[(h,δ),(k,ε)] = ( −δk − εh , 0 )

The second derivative is constant, and in the product norm ‖(v,λ)‖ := ‖v‖_ν + |λ| it satisfies
‖D²F[(h,δ),(k,ε)]‖ ≤ |δ|‖k‖ + |ε|‖h‖ ≤ ‖(h,δ)‖·‖(k,ε)‖, so **Z₂ = ‖A‖** — no problem-specific work at all.

Where compactness earns its keep
--------------------------------
The tail estimate is the whole point. Take A to be the exact inverse of the finite block on |m| ≤ N (plus the
scalar row/column), and **−1/λ̄ times the identity** on |m| > N — which is the right choice because out there
`DF ≈ −λ̄ I` whenever `T e_n` is small. Writing `t_n = T e_n` and splitting it into its parts inside and outside
the block, the tail column collapses to

    (I − A·DF)(e_n, 0) = −A_fin(t_n^{in}, 0) + (1/λ̄)·t_n^{out}

so, with `τ(n) := ‖T e_n‖_ν / ν^{|n|}`,

    **Z₁ tail ≤ ( ‖A_fin‖ + 1/|λ̄| ) · sup_{|n|>N} τ(n)**

and `τ(n) → 0` is precisely **compactness**. A merely bounded operator gives a τ that does not decay, the
supremum does not shrink with N, and nothing closes. That single line is why the compact reformulation is worth
making, and why it needs no derivative-gaining inverse.

Grading targets — exact eigenpairs, including one with a genuine infinite tail
------------------------------------------------------------------------------
`T = D + u⟨·, w⟩` with `D e_m = d_m e_m`, `d_m = 1/m²` (so D is compact: it is the norm limit of its truncations).

* **`w = e₁`, `u_m = ρ^m`.** The eigenvalue is **λ = d₁ + u₁ = 1 + ρ, exactly**, with eigenvector
  `v_m = ρ^m / (1 + ρ − 1/m²)`, normalised so `v₁ = 1`. Infinitely supported with geometric decay, so the tail
  bound is genuinely exercised; `‖v‖_ν < ∞` iff `ρν < 1`.
* **`u = w = e₁ + e₂`.** The secular equation `1 = Σ u_m w_m/(λ − d_m)` becomes `λ² − (13/4)λ + 3/2 = 0`, so
  **λ = (13 ± √73)/8, exactly algebraic**, with a finitely supported eigenvector.

Both are closed forms, so the certificate can be graded rather than admired — the same standard as CLM's T = 2 and
the Catalan coefficients.
"""
from mpmath import mp, mpf, sqrt as msqrt
from ell1 import Seq, cival, czero, cabs_hi
from ivutil import ival, lo, hi
import radiipoly


# ------------------------------------------------------------------------------------------------------------
# a compact operator, in the form the verifier needs
# ------------------------------------------------------------------------------------------------------------

class DiagPlusRankOne:
    """T v = D v + u·⟨v, w⟩ on one-sided sequences (modes m ≥ 1), with D diagonal.

    Compact whenever d_m → 0: D is then the norm limit of its finite truncations, and a rank-one operator is
    compact, so the sum is. The class exposes exactly what the verifier needs — the action, and a tail bound
    τ(n) ≥ ‖T e_n‖_ν / ν^n valid for every n beyond the computed block.
    """

    def __init__(self, d, u, w, M):
        """d: callable m -> d_m. u, w: dicts {mode: value}. M: working width."""
        self.d, self.u, self.w, self.M = d, dict(u), dict(w), M

    def inner_w(self, v):
        """⟨v, w⟩ with w real and finitely supported — a genuine functional, not a norm."""
        s = czero()
        for m, wm in self.w.items():
            s = s + v[m] * cival(mpf(wm), 0)
        return s

    def apply(self, v):
        out = Seq(max(v.M, self.M))
        for m in range(1, v.M + 1):
            out[m] = v[m] * cival(mpf(self.d(m)), 0)
        s = self.inner_w(v)
        for m, um in self.u.items():
            out[m] = out[m] + cival(mpf(um), 0) * s
        return out

    def tau(self, n, nu):
        """Upper bound on ‖T e_n‖_ν / ν^n for a single mode n.

        T e_n = d_n e_n + u·w_n, so the bound is |d_n| + |w_n|·‖u‖_ν/ν^n. With w finitely supported the second
        term vanishes for n beyond w's support and τ(n) = |d_n| → 0, which is the compactness the tail bound needs.
        """
        nu = mpf(nu)
        t = abs(mpf(self.d(n)))
        wn = self.w.get(n)
        if wn:
            un = mpf(0)
            for m, um in self.u.items():
                un += abs(mpf(um)) * nu ** m
            t += abs(mpf(wn)) * un / nu ** n
        return t

    def tail_sup(self, N, nu, probe=400):
        """sup over |n| > N of τ(n). For d_m = 1/m² this is attained at n = N+1 and decreases; the loop checks a
        window rather than assuming monotonicity, and the analytic tail beyond the window is bounded by the
        assumption that |d_m| is non-increasing there, which the caller must ensure."""
        return max(self.tau(n, nu) for n in range(N + 1, N + probe))


# ------------------------------------------------------------------------------------------------------------
# exact answers, for grading
# ------------------------------------------------------------------------------------------------------------

def exact_geometric(rho, N):
    """The exact eigenpair for d_m = 1/m², w = e₁, u_m = ρ^m:  λ = 1 + ρ,  v_m = ρ^m/(1 + ρ − 1/m²), v₁ = 1."""
    rho = mpf(rho)
    lam = 1 + rho
    v = Seq(N)
    for m in range(1, N + 1):
        v[m] = cival(rho ** m / (1 + rho - mpf(1) / (m * m)), 0)
    return v, lam


def exact_two_mode():
    """λ = (13 ± √73)/8 for d_m = 1/m², u = w = e₁ + e₂. Returned as (λ_minus, λ_plus)."""
    r = msqrt(mpf(73))
    return (13 - r) / 8, (13 + r) / 8


# ------------------------------------------------------------------------------------------------------------
# the verifier
# ------------------------------------------------------------------------------------------------------------

def _finite_matrix(T, vbar, lam, N):
    """DF(v̄, λ̄) restricted to modes 1..N plus the scalar unknown, as a real (N+1)² matrix.

    Rows 0..N-1 are the sequence equations at modes 1..N; row N is the phase condition. Columns likewise, with
    the last column the λ direction. Real arithmetic: these problems have real eigenpairs, and using the midpoint
    is legitimate because A only has to be an approximate inverse.
    """
    n = N + 1
    Mx = [[mpf(0)] * n for _ in range(n)]
    for j in range(1, N + 1):                       # column: perturb v_j
        e = Seq(N)
        e[j] = cival(1, 0)
        col = T.apply(e)
        for i in range(1, N + 1):
            val = mpf(lo(col[i].real))
            if i == j:
                val -= lam
            Mx[i - 1][j - 1] = val
        Mx[N][j - 1] = mpf(T.w.get(j, 0))           # phase row
    for i in range(1, N + 1):                       # column: perturb lambda
        Mx[i - 1][N] = -mpf(lo(vbar[i].real))
    Mx[N][N] = mpf(0)
    return Mx


def _invert(Mx):
    n = len(Mx)
    A = [row[:] + [mpf(1) if i == j else mpf(0) for j in range(n)] for i, row in enumerate(Mx)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(A[r][c]))
        if abs(A[p][c]) == 0:
            return None
        A[c], A[p] = A[p], A[c]
        dv = A[c][c]
        A[c] = [v / dv for v in A[c]]
        for r in range(n):
            if r == c or A[r][c] == 0:
                continue
            mlt = A[r][c]
            A[r] = [a - mlt * b for a, b in zip(A[r], A[c])]
    return [row[n:] for row in A]


def _apply_A(Afin, vec_seq, scal, lam, N):
    """Apply A to (sequence, scalar). Finite block by Afin; tail by −1/λ̄ times the identity."""
    n = N + 1
    inp = [mpf(lo(vec_seq[m].real)) for m in range(1, N + 1)] + [mpf(lo(scal.real))]
    out = [sum((Afin[i][j] * inp[j] for j in range(n)), mpf(0)) for i in range(n)]
    res = Seq(vec_seq.M)
    for m in range(1, N + 1):
        res[m] = cival(out[m - 1], 0)
    for m in range(N + 1, vec_seq.M + 1):
        res[m] = vec_seq[m] * cival(-1 / lam, 0)
    return res, out[N]


def bounds(T, vbar, lam, nu, N):
    """Y₀, Z₁, Z₂ for the eigenpair system, tail included."""
    nu, lam = mpf(nu), mpf(lam)
    Afin = _invert(_finite_matrix(T, vbar, lam, N))
    if Afin is None:
        return None, None, None, {'error': 'finite block singular; the phase vector w may be orthogonal to vbar'}

    # ---- Y0 ----
    resid = T.apply(vbar) - vbar.scale(cival(lam, 0))
    phase = T.inner_w(vbar) - cival(1, 0)
    rv, rs = _apply_A(Afin, resid, phase, lam, N)
    Y0 = rv.norm(nu) + abs(rs)

    # ---- ‖A_fin‖ in the product norm (sum norm on the pair) ----
    A_norm = mpf(0)
    n = N + 1
    for j in range(n):
        w = nu ** (j + 1) if j < N else mpf(1)
        s = mpf(0)
        for i in range(n):
            s += abs(Afin[i][j]) * (nu ** (i + 1) if i < N else mpf(1))
        v = s / w
        if v > A_norm:
            A_norm = v
    A_norm = max(A_norm, 1 / abs(lam))              # the tail block of A is −1/λ̄ · I

    # ---- Z1: finite columns, computed exactly ----
    Z1 = mpf(0)
    for j in range(1, N + 1):
        e = Seq(max(N, T.M))
        e[j] = cival(1, 0)
        dv = T.apply(e) - e.scale(cival(lam, 0))
        dphase = cival(mpf(T.w.get(j, 0)), 0)
        av, as_ = _apply_A(Afin, dv, dphase, lam, N)
        col = e.resized(av.M) - av
        val = (col.norm(nu) + abs(as_)) / nu ** j
        if val > Z1:
            Z1 = val
    # the lambda column
    dv = vbar.scale(cival(-1, 0))
    av, as_ = _apply_A(Afin, dv, czero(), lam, N)
    Z1 = max(Z1, av.norm(nu) + abs(1 - as_))

    # ---- Z1: the infinite tail, where compactness does the work ----
    tail = T.tail_sup(N, nu)
    Z1_tail = (A_norm + 1 / abs(lam)) * tail
    Z1 = max(Z1, Z1_tail)

    Z2 = A_norm
    return Y0, Z1, Z2, {'A_norm': mp.nstr(A_norm, 8), 'Z1_tail': mp.nstr(Z1_tail, 8),
                        'tail_sup_tau': mp.nstr(tail, 8), 'lambda': mp.nstr(lam, 12)}


def dyadic_instance(lam, vbase, dbase, M):
    """A compact eigenproblem in which **every quantity is a dyadic rational**, so the prover's mpf values and an
    auditor's Fractions denote the same numbers exactly.

    The geometric instance below cannot do this: its eigenvector is `v_m = ρ^m/(λ̄ − 1/m²)`, whose denominator
    carries the factor `11m² − 8` and is therefore not a power of two, so mpf rounds every entry and the residual
    is ~1e-45 rather than 0. That is harmless for the prover — it works in interval arithmetic — but it denies an
    exact-rational auditor any way to tell a real disagreement from a rounding artefact, which is the same trap
    `emit_certs.py` already documents for μ = 1/10.

    So this instance is built the other way round: **choose the eigenvector, then derive the operator.** Fix
    `v_m = vbase^−m` and `d_m = dbase^−m` (both dyadic, and `d_m → 0`, so T is compact), then *define*

        u_m := v_m·(λ̄ − d_m),      w := {1: vbase}

    Then ⟨v, w⟩ = vbase·v₁ = 1 satisfies the phase condition exactly, and

        (T v)_m = d_m v_m + u_m·⟨v, w⟩ = d_m v_m + v_m(λ̄ − d_m) = λ̄ v_m

    identically, for any λ̄ — the eigenpair is exact by construction rather than by a closed form that happens to
    be known. Everything in sight is a dyadic rational, so the residual is exactly zero and stays that way.

    This is the same move the quadratic problem makes at R1b, where μ = 1/8 keeps the Catalan coefficients dyadic.
    Returns (T, vbar) with vbar unperturbed.
    """
    lam = mpf(lam)
    T = DiagPlusRankOne(d=lambda m: mpf(1) / mpf(dbase) ** m,
                        u={m: (mpf(1) / mpf(vbase) ** m) * (lam - mpf(1) / mpf(dbase) ** m) for m in range(1, M + 1)},
                        w={1: vbase}, M=M)
    vbar = Seq(M)
    for m in range(1, M + 1):
        vbar[m] = cival(mpf(1) / mpf(vbase) ** m, 0)
    return T, vbar


def prove_dyadic(lam='1.375', nu='1.5', N=14, vbase=2, dbase=4, kpert=20, cexp=None):
    """Certify the dyadic instance, optionally with an exact perturbation at mode `kpert`.

    The perturbation is placed **beyond N on purpose**. A is the exact inverse of the finite block on modes ≤ N
    and −1/λ̄ times the identity beyond it, so a residual supported only above N is mapped by a part of A that is
    known in closed form. Y₀ is then `|c(d_k − λ̄)|·ν^k/λ̄` exactly — a number an auditor can reach **without the
    preconditioner**, which is what makes this certificate independently checkable at all. Perturb at a mode ≤ N
    and Y₀ depends on the numerically inverted block, which no independent implementation can reproduce.
    """
    lam = mpf(lam); M = 3 * N
    T, vbar = dyadic_instance(lam, vbase, dbase, M)
    # cexp is an EXPONENT, not a value: the perturbation is 2^-cexp, built here rather than parsed from a decimal
    # string. The first version took c='1.4901161193847656e-08', meaning 2^-26, and that string is 2^-26 truncated
    # at 17 digits - so the prover perturbed by one number while the certificate recorded another, and every bound
    # was computed for a slightly different abar than an auditor would read. auditor_r4.py rejected it on its first
    # run over a relative 1.7e-17 in Y0. Taking an integer exponent removes the possibility rather than papering
    # over it, and is the same discipline as mu = 1/8 elsewhere in this directory.
    if cexp is not None:
        vbar[kpert] = vbar[kpert] + cival(mpf(1) / 2 ** cexp, 0)
    Y0, Z1, Z2, extra = bounds(T, vbar, lam, nu, N)
    if Y0 is None:
        return radiipoly.Certificate(radiipoly.FAILED, 0, 0, 0, reason=extra['error']), T, vbar, lam
    cert = radiipoly.verify(Y0, Z1, Z2)
    cert.extra.update(extra)
    cert.extra.update({'problem': 'compact eigenpair, dyadic instance: d_m = dbase^-m, v_m = vbase^-m, u_m = v_m(lam - d_m)',
                       'lambda_exact': mp.nstr(lam, 12), 'N': N, 'kpert': kpert,
                       'statement': ('A unique eigenpair (v, lambda) of this compact operator exists within r of '
                                     '(vbar, lambdabar) in ell^1_nu x R, with the phase condition <v,w> = 1. A '
                                     'statement about this operator only.')})
    return cert, T, vbar, lam


def prove_geometric(rho='0.4', nu='1.5', N=14, perturb=None):
    """Certify the exact eigenpair of D + u⟨·,e₁⟩ with u_m = ρ^m. λ = 1 + ρ exactly."""
    rho = mpf(rho)
    M = 3 * N
    T = DiagPlusRankOne(d=lambda m: mpf(1) / (m * m), u={m: rho ** m for m in range(1, M + 1)},
                        w={1: 1}, M=M)
    vbar, lam = exact_geometric(rho, M)
    if perturb:
        for k, c in perturb.items():
            vbar[k] = vbar[k] + cival(mpf(c), 0)
    Y0, Z1, Z2, extra = bounds(T, vbar, lam, nu, N)
    if Y0 is None:
        return radiipoly.Certificate(radiipoly.FAILED, 0, 0, 0, reason=extra['error']), T, vbar, lam
    cert = radiipoly.verify(Y0, Z1, Z2)
    cert.extra.update(extra)
    cert.extra.update({'problem': 'compact eigenpair, T = D + u<.,e1>, d_m = 1/m^2, u_m = rho^m',
                       'rho': mp.nstr(rho, 8), 'N': N,
                       'statement': ('A unique eigenpair (v, lambda) of this compact operator exists within r of '
                                     '(vbar, lambdabar) in ell^1_nu x R, with the phase condition <v,w> = 1. A '
                                     'statement about this operator only.')})
    return cert, T, vbar, lam
