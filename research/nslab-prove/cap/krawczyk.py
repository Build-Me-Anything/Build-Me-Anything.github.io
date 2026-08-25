"""R0 — the Krawczyk operator: a root enclosure that returns a theorem, not an approximation.

This is the smallest complete instance of the whole CAP idea, and it is worth understanding before anything
larger. A floating-point Newton solve says "the residual got small". The Krawczyk test says "a zero exists in this
box, it is the only one there, and here is a smaller box containing it" — or it says nothing at all. There is no
third answer and no tolerance to tune.

The theorem
-----------
Let f : D ⊆ R^n → R^n be continuously differentiable, X ⊆ D an interval box, x̌ a point in X, and Y an invertible
real matrix (in practice an approximate inverse of Df(x̌)). Define the Krawczyk operator

    K(X) = x̌ − Y·f(x̌) + (I − Y·Df(X))·(X − x̌)

evaluated in interval arithmetic, where Df(X) is an interval enclosure of the Jacobian over the whole box. Then:

  * if K(X) ⊆ interior(X), f has **exactly one** zero in X, and that zero lies in K(X);
  * if K(X) ∩ X = ∅, f has **no** zero in X;
  * otherwise the test is inconclusive — which is a statement about the test, not about f.

The middle case is why this is a verifier and not a solver: it is allowed to fail, and failing is not evidence of
anything. Refining X or Y and retrying changes the *experiment*; it never changes the acceptance condition. That
is the frozen contract from the architecture document, at its smallest scale.

Why Y matters. If Y were exactly Df(x̌)^{-1} the term (I − Y·Df(X)) would be small whenever the box is small, and
the operator contracts. Y is only approximate, computed in ordinary floating point, and that is fine: Y's accuracy
affects only whether the test *closes*, never whether its conclusion is true. A bad Y wastes time. It cannot
produce a wrong theorem.

Numerical evidence only until a verdict of UNIQUE is returned; an INCONCLUSIVE result proves nothing.
"""
from mpmath import mp, mpf
from ivutil import (ival, lo, hi, width, strict_subset, subset, intersect, matvec, matmul, eye,
                    sub_vec, mag, vec_sup, setprec)

UNIQUE = 'UNIQUE'            # exactly one zero in X, enclosed by the returned box
NO_ZERO = 'NO_ZERO'          # provably no zero in X
INCONCLUSIVE = 'INCONCLUSIVE'  # the test did not close; says nothing about f


class Verdict:
    """The result of a Krawczyk test. Deliberately not a bool — a verifier that can be used as a truthy value
    invites `if verify(...)`, which silently treats INCONCLUSIVE as failure-to-exist. It is not."""

    def __init__(self, status, box=None, reason='', KX=None, X=None):
        self.status, self.box, self.reason, self.KX, self.X = status, box, reason, KX, X

    @property
    def proved(self):
        return self.status == UNIQUE

    def __repr__(self):
        if self.status == UNIQUE:
            w = max((width(b) / 2 for b in self.box), default=mpf(0)) if self.box else mpf(0)
            return f'<Verdict UNIQUE, enclosure half-width {mp.nstr(w, 5)}>'
        return f'<Verdict {self.status}: {self.reason}>'


def _empty_intersection(u, v):
    """True if the interval boxes u and v are disjoint in at least one coordinate."""
    return any(a.b < b.a or b.b < a.a for a, b in zip(u, v))


def krawczyk_step(f, Df, X, xcheck, Y):
    """One evaluation of K(X). All arguments and returns are interval objects; Y is a point matrix given as
    intervals (thin ones) so the arithmetic is uniform."""
    n = len(X)
    fx = f([ival(c) for c in xcheck])                      # f(x̌), enclosed — x̌ itself need not be representable
    J = Df(X)                                              # Jacobian over the WHOLE box, not at a point
    M = [[(ival(1) if i == j else ival(0)) - s for j, s in enumerate(row)]
         for i, row in enumerate(matmul(Y, J))]            # I − Y·Df(X)
    rad = sub_vec(X, [ival(c) for c in xcheck])            # X − x̌
    Yf = matvec(Y, fx)
    corr = matvec(M, rad)
    return [ival(xcheck[i]) - Yf[i] + corr[i] for i in range(n)]


def verify_zero(f, Df, X, xcheck=None, Y=None):
    """Apply the Krawczyk test to the box X.

    f, Df take an interval vector and return (respectively) an interval vector and an interval matrix. X is an
    interval vector. xcheck defaults to the midpoint of X; Y defaults to an approximate inverse of the midpoint
    Jacobian, computed in ordinary floating point.
    """
    n = len(X)
    if xcheck is None:
        xcheck = [x.mid for x in X]
    if Y is None:
        try:
            Y = _approx_inverse(Df([ival(c) for c in xcheck]), n)
        except ZeroDivisionError as e:
            # The Jacobian is singular at the midpoint, so no preconditioner exists there and the operator cannot
            # be formed. That is a failure of the TEST, not a statement about f - a double root, or simply a badly
            # centred box, both land here. Returning INCONCLUSIVE keeps the distinction; raising would have thrown
            # away the only honest answer.
            return Verdict(INCONCLUSIVE, X=X, reason=f'no preconditioner: {e}')
    KX = krawczyk_step(f, Df, X, xcheck, Y)

    if _empty_intersection(KX, X):
        return Verdict(NO_ZERO, reason='K(X) is disjoint from X', KX=KX, X=X)
    if all(strict_subset(k, x) for k, x in zip(KX, X)):
        # K(X) inside the interior of X: existence and uniqueness both follow, and K(X) is a sharper enclosure.
        return Verdict(UNIQUE, box=sharpen(f, Df, KX), KX=KX, X=X)
    touching = all(subset(k, x) for k, x in zip(KX, X))
    return Verdict(INCONCLUSIVE, KX=KX, X=X,
                   reason=('K(X) ⊆ X but touches the boundary — existence follows, uniqueness does not'
                           if touching else 'K(X) escapes X; try a smaller box or a better Y'))


def sharpen(f, Df, box, iters=40):
    """Tighten an enclosure that is already known to contain a unique zero.

    Iterate B <- K(B) intersect B. The intersection step is what makes this sound: the root lies in B by
    hypothesis and in K(B) by the theorem, so it lies in both, and the enclosure can only shrink. If a step fails
    to improve, or the operator cannot be formed, the previous enclosure is returned unchanged - never widened.

    This is the interval-Newton iteration, and it is the reason a certified enclosure can reach the precision of
    the arithmetic rather than the width of the box you happened to start from.
    """
    cur = list(box)
    for _ in range(iters):
        mid = [b.mid for b in cur]
        try:
            Y = _approx_inverse(Df([ival(c) for c in mid]), len(cur))
            K = krawczyk_step(f, Df, cur, mid, Y)
        except ZeroDivisionError:
            return cur
        nxt = []
        for k, c in zip(K, cur):
            t = intersect(k, c)
            if t is None:
                return cur          # should be impossible if the hypothesis held; refuse to act on it either way
            nxt.append(t)
        before = max(width(c) for c in cur)
        after = max(width(c) for c in nxt)
        cur = nxt
        if after >= before * mpf('0.99'):
            break
    return cur


def _approx_inverse(J, n):
    """Approximate inverse of the midpoint of an interval Jacobian, by Gauss-Jordan in ordinary arithmetic.

    Deliberately non-rigorous: Y only has to be a good preconditioner. Its errors cost sharpness, never soundness,
    because the interval arithmetic in krawczyk_step accounts for whatever Y actually is.
    """
    A = [[mpf(J[i][j].mid) for j in range(n)] for i in range(n)]
    I = [[mpf(1) if i == j else mpf(0) for j in range(n)] for i in range(n)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(A[r][c]))
        if abs(A[p][c]) == 0:
            raise ZeroDivisionError('midpoint Jacobian is singular; supply Y explicitly')
        A[c], A[p] = A[p], A[c]
        I[c], I[p] = I[p], I[c]
        d = A[c][c]
        A[c] = [v / d for v in A[c]]
        I[c] = [v / d for v in I[c]]
        for r in range(n):
            if r == c:
                continue
            m = A[r][c]
            if m == 0:
                continue
            A[r] = [a - m * b for a, b in zip(A[r], A[c])]
            I[r] = [a - m * b for a, b in zip(I[r], I[c])]
    return [[ival(I[i][j]) for j in range(n)] for i in range(n)]


def refine(f, Df, X, xcheck=None, Y=None, shrinks=12, factor=mpf('0.5')):
    """Try the test, and on an inconclusive result shrink the box about its midpoint and try again.

    This is the only kind of feedback the architecture permits: it changes the *input* box, never the acceptance
    condition. A run that ends INCONCLUSIVE after every shrink has proved nothing, and says so.
    """
    cur = list(X)
    for k in range(shrinks + 1):
        v = verify_zero(f, Df, cur, xcheck, Y)
        if v.status in (UNIQUE, NO_ZERO):
            v.reason = f'closed after {k} shrink(s)'
            return v
        mid = [x.mid for x in cur]
        cur = [ival(m - factor * (m - x.a), m + factor * (x.b - m)) for m, x in zip(mid, cur)]
        xcheck = None
        Y = None
    return Verdict(INCONCLUSIVE, reason=f'still inconclusive after {shrinks} shrinks', X=cur)
