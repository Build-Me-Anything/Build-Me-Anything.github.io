"""R1 — Constantin–Lax–Majda: a certified blow-up time.

The equation, on the circle:

    ω_t = ω · H(ω)                                                                                   (CLM, 1985)

where H is the Hilbert transform. It is the standard first rung for blow-up work because it linearises exactly.

Why it linearises
-----------------
Write θ = H(ω). The Tricomi identity H(f)H(g) − fg = H(f·H(g) + g·H(f)) with f = g = ω gives

    H(ω·H(ω)) = ½(θ² − ω²)

and applying H to the equation therefore yields θ_t = ½(θ² − ω²). Setting **z = θ + iω**,

    z_t = θ_t + i ω_t = ½(θ² − ω²) + i·ωθ = ½(θ + iω)² = ½ z²

which is a *pointwise* ODE in x, with solution

    z(x, t) = z₀(x) / (1 − (t/2)·z₀(x)),        z₀ = H(ω₀) + i ω₀.

The solution is smooth exactly as long as the denominator never vanishes. It vanishes when z₀(x) = 2/t — a real,
positive value — so blow-up happens at

    **T = 2 / sup{ θ₀(x) : ω₀(x) = 0 and θ₀(x) > 0 }**

and T = ∞ if no such x exists.

What has to be rigorous
-----------------------
That formula turns the blow-up time into a constrained supremum, and computing it *soundly* needs three things,
none of which a floating-point search provides:

1. **Every** zero of ω₀ must be found. Miss one and T is over-estimated — the run would report a later blow-up
   than the truth, which is the dangerous direction. So the search must prove it has found them all, by covering
   the whole circle with boxes that are each either proved zero-free or proved to hold exactly one zero.
2. Each zero must be *enclosed*, not located, so that θ₀ evaluated there is an interval.
3. The supremum and the final division must be done in interval arithmetic.

Step 1 is where this rung earns its keep: it is the first time the machinery has to prove a *negative* — that
nothing was missed — and that is the part of a CAP that is easy to get wrong and impossible to spot afterwards.

Grading target
--------------
For ω₀ = cos x we have H(cos x) = sin x, so ω₀ vanishes at π/2 and 3π/2 where θ₀ = +1 and −1. The supremum is 1
and **T = 2, exactly**. The certified enclosure must contain 2 and be tight. That is this rung's Taylor–Green.

Numerical evidence only: a certificate here is about the CLM equation, not about Navier–Stokes.
"""
from mpmath import mp, mpf
from mpmath import iv
from ivutil import ival, lo, hi, width, setprec, mag
from krawczyk import verify_zero, refine, UNIQUE, NO_ZERO, INCONCLUSIVE

TWO_PI_STR = '6.283185307179586476925286766559005768394338798750211641949889'


def two_pi():
    """2π as an interval, from mpmath's own constant at the working precision."""
    return ival(mp.mpf(2) * mp.pi)


class TrigPoly:
    """A real, mean-zero trigonometric polynomial  ω(x) = Σ_{k≥1} a_k cos(kx) + b_k sin(kx).

    Coefficients are given as (k, a_k, b_k) triples. Mean-zero is required: the Hilbert transform annihilates
    constants, so a non-zero mean would make θ ill-defined as an inverse and break the identity above.
    """

    def __init__(self, terms):
        self.terms = [(int(k), ival(a), ival(b)) for k, a, b in terms]
        if any(k <= 0 for k, _, _ in self.terms):
            raise ValueError('modes must have k >= 1; a mean-zero field has no k = 0 term')

    def omega(self, X):
        """ω(X), enclosed."""
        s = ival(0)
        for k, a, b in self.terms:
            kx = ival(k) * X
            s = s + a * iv.cos(kx) + b * iv.sin(kx)
        return s

    def d_omega(self, X):
        """ω'(X), enclosed."""
        s = ival(0)
        for k, a, b in self.terms:
            kx = ival(k) * X
            s = s + ival(k) * (b * iv.cos(kx) - a * iv.sin(kx))
        return s

    def theta(self, X):
        """θ = H(ω), enclosed.

        On the circle H(e^{ikx}) = −i·sgn(k)·e^{ikx}, which in real form is H(cos kx) = sin kx and
        H(sin kx) = −cos kx for k ≥ 1. So the transform is a coefficient swap, exact and free of error.
        """
        s = ival(0)
        for k, a, b in self.terms:
            kx = ival(k) * X
            s = s + a * iv.sin(kx) - b * iv.cos(kx)
        return s


# Split ratio for the subdivision. NOT 1/2, and the reason is a real defect this suite caught.
#
# Bisecting [0, 2pi] puts box boundaries at 2pi*k/2^d. The zeros of cos x are at pi/2 and 3pi/2 - which are
# exactly 2pi/4 and 3*2pi/4, dyadic fractions of the domain. A zero sitting on a shared boundary is on the
# ENDPOINT of both neighbouring boxes, so K(X) can never lie strictly inside X (uniqueness fails) and the box is
# never provably empty either. Bisection cannot escape it at any depth: the search span whatever the budget and
# then, correctly, reported that it could not prove completeness.
#
# The golden-ratio conjugate is irrational, so no zero can stay on a boundary through repeated splits. This is a
# standard remedy in interval root-finding, and the failure it fixes is worth recording: the test case that broke
# was the CLEANEST one (omega0 = cos x, exact answer T = 2), while the untidy case with non-dyadic roots passed.
# Grading against a known answer is what surfaced it; a suite of only 'realistic' cases would have shipped it.
GOLDEN = '0.6180339887498948482045868343656381177203091798057628621354486'


def enclose_all_zeros(f, df, a, b, max_depth=40, min_width=None):
    """Find **every** zero of f on [a, b], with proof that none was missed.

    Recursively subdivide. On each box the Krawczyk test must return one of:
      * NO_ZERO   — the box is discarded, provably empty;
      * UNIQUE    — the box is recorded, with its enclosure;
      * anything else — the box is split and both halves retried.

    If a box reaches `max_depth` still inconclusive, the whole search **fails**. It does not return a partial list.
    A list of zeros that might be missing one is worse than no list, because the caller cannot tell the difference
    and the resulting supremum would be silently too small.

    Returns (zeros, None) on success, or (partial, reason) on failure.
    """
    F = lambda V: [f(V[0])]
    DF = lambda V: [[df(V[0])]]
    zeros, stack, unresolved = [], [(ival(a, b), 0)], []

    while stack:
        box, depth = stack.pop()
        v = verify_zero(F, DF, [box])
        if v.status == NO_ZERO:
            continue
        if v.status == UNIQUE:
            zeros.append(v.box[0])
            continue
        if depth >= max_depth:
            unresolved.append(box)
            continue
        # Split off-centre (see GOLDEN above) so that a zero cannot persist on a box boundary.
        left, right = lo(box), hi(box)
        m = left + (right - left) * mpf(GOLDEN)
        if not (left < m < right):          # the box has collapsed to arithmetic resolution
            unresolved.append(box)
            continue
        stack.append((ival(left, m), depth + 1))
        stack.append((ival(m, right), depth + 1))

    if unresolved:
        return zeros, (f'{len(unresolved)} box(es) unresolved at depth {max_depth}; '
                       'the zero set is NOT proved complete')
    return _dedupe(zeros), None


def _dedupe(zeros):
    """Merge enclosures that overlap.

    Two boxes meeting at a shared boundary can each enclose what is really the same zero. Merging is sound: the
    union of two overlapping enclosures of the same root still encloses it. Leaving duplicates would not corrupt
    the supremum - theta is evaluated on the enclosure either way - but it would misreport the zero COUNT, and a
    count is one of the few things a reader can check independently.
    """
    out = []
    for z in sorted(zeros, key=lambda w: lo(w)):
        if out and lo(z) <= hi(out[-1]):
            out[-1] = ival(lo(out[-1]), max(hi(out[-1]), hi(z)))
        else:
            out.append(z)
    return out


def blowup_time(w, max_depth=40):
    """Certified enclosure of the CLM blow-up time for initial data ω₀ = w.

    Returns a dict carrying the verdict, the enclosure of T, the enclosed zeros of ω₀ and the value of θ₀ at each.
    A failure to prove the zero set complete yields verdict 'INCONCLUSIVE' and no time — never a number with a
    caveat attached.
    """
    zeros, err = enclose_all_zeros(w.omega, w.d_omega, mpf(0), hi(two_pi()), max_depth=max_depth)
    if err:
        return {'verdict': INCONCLUSIVE, 'reason': err, 'zeros': zeros}

    # θ₀ at each zero of ω₀. Each is an interval, because the zero itself is only enclosed.
    thetas = [(z, w.theta(z)) for z in zeros]

    # The supremum over the POSITIVE ones. A zero whose θ-enclosure straddles 0 cannot be classified, and is
    # reported rather than assumed away: it might or might not contribute, and either way the sup is not proved.
    positive, straddling = [], []
    for z, th in thetas:
        if lo(th) > 0:
            positive.append((z, th))
        elif hi(th) > 0:
            straddling.append((z, th))

    if straddling:
        return {'verdict': INCONCLUSIVE, 'zeros': zeros, 'thetas': thetas,
                'reason': f'{len(straddling)} zero(s) have theta enclosures straddling 0; '
                          'the supremum cannot be decided at this precision'}
    if not positive:
        return {'verdict': 'NO_BLOWUP', 'zeros': zeros, 'thetas': thetas,
                'reason': 'theta is negative at every zero of omega, so the denominator never vanishes'}

    # sup of the enclosures: lower bound is the largest lower endpoint, upper bound the largest upper endpoint.
    sup_lo = max(lo(th) for _, th in positive)
    sup_hi = max(hi(th) for _, th in positive)
    S = ival(sup_lo, sup_hi)
    T = ival(2) / S
    return {'verdict': 'BLOWUP', 'T': T, 'sup_theta': S, 'zeros': zeros, 'thetas': thetas,
            'argmax': [z for z, th in positive if hi(th) >= sup_lo]}


def exact_solution(w, X, t):
    """ω(x, t) from the closed form, in interval arithmetic — used only to cross-check the machinery.

    z = z₀/(1 − (t/2)z₀) with z₀ = θ₀ + iω₀; ω = Im z. Written out in real arithmetic so that no complex interval
    type is needed: with z₀ = p + iq and D = 1 − (t/2)z₀ = (1 − tp/2) − i(tq/2),

        Im(z₀/D) = (q·Re D + p·Im D_conj_sign...) — expanded explicitly below to avoid sign slips.
    """
    p, q = w.theta(X), w.omega(X)
    h = ival(t) / ival(2)
    dr = ival(1) - h * p            # Re D
    di = -h * q                     # Im D
    den = dr * dr + di * di
    # z₀/D = (p + iq)(dr − i·di)/|D|²  ->  Im = (q·dr − p·di)/|D|²
    return (q * dr - p * di) / den
