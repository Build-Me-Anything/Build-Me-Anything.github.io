"""Interval helpers for the CAP machinery — the arithmetic layer (Layer 2 of the architecture).

Everything here is built on mpmath's `iv` interval type: arbitrary precision, outward rounding, so every computed
quantity is a bracket that provably contains the true value. mpmath is pure Python and slow. That is the right
trade at R0/R1, because the whole point of this layer is that a human can read every line and check it; a fast
library the reader has to trust is worth less here than a slow one they can audit.

Conventions
-----------
* An **interval** is `mpmath.iv.mpf`. `x.a` and `x.b` are its endpoints, `x.mid` its midpoint, `x.delta` its width.
* An **interval vector** is a Python list of intervals; an **interval matrix** a list of lists, row-major. mpmath
  has `iv.matrix`, but its arithmetic silently mixes point and interval semantics in places, and hand-rolled loops
  are easier to audit than a library's operator overloads. Speed is irrelevant at these sizes.
* Nothing in this module rounds, truncates or "cleans up" a result. If a bound is bad, it is reported as bad.

Numerical evidence only until a certificate closes; nothing here proves anything on its own.
"""
from mpmath import iv, mp, mpf

__all__ = ['setprec', 'ival', 'lo', 'hi', 'width', 'contains', 'subset', 'strict_subset', 'intersect',
           'hull', 'mag', 'mig', 'vec_sup', 'mat_sup_norm', 'matvec', 'matmul', 'eye', 'sub_vec', 'is_thin']


def lo(X):
    """Lower endpoint as a plain mpf. mpmath returns endpoints as thin intervals, which print as '[1.0, 1.0]'
    and compare oddly; anything leaving this layer for a report or a comparison should come through here."""
    return mpf(X.a)


def hi(X):
    """Upper endpoint as a plain mpf."""
    return mpf(X.b)


def width(X):
    """Width of the interval as a plain mpf."""
    return hi(X) - lo(X)


def intersect(X, Y):
    """Intersection of two intervals, or None if they are disjoint.

    Used to sharpen an enclosure: once a root is known to lie in both X and K(X), it lies in the intersection,
    so intersecting is always sound and never loses the root."""
    a, b = max(lo(X), lo(Y)), min(hi(X), hi(Y))
    return None if a > b else iv.mpf([a, b])


def setprec(dps=40):
    """Set working precision, in decimal digits, for both the interval and the point contexts."""
    iv.dps = dps
    mp.dps = dps


def ival(x, y=None):
    """Build an interval. `ival(a, b)` is [a, b]; `ival(a)` is the thin (degenerate) interval [a, a].

    Passing a Python float is safe: the float's exact binary value is used, so no rounding is hidden here. Passing
    a decimal *string* is safer still when the intended value is not a dyadic rational — ival('0.1') brackets the
    true 0.1, whereas ival(0.1) brackets the double nearest to it, which is a slightly different number.
    """
    if y is None:
        return iv.mpf(x)
    return iv.mpf([x, y])


def contains(X, x):
    """True if the point (or interval) x lies inside the interval X."""
    return x in X


def subset(X, Y):
    """True if X is contained in Y (endpoints may touch)."""
    return Y.a <= X.a and X.b <= Y.b


def strict_subset(X, Y):
    """True if X is contained in the *interior* of Y.

    This is the form the Krawczyk existence-and-uniqueness theorem needs. Touching endpoints are not enough: the
    theorem's contraction argument requires room on both sides, and accepting a touch would be exactly the kind of
    'close enough' that makes a verifier worthless.
    """
    return Y.a < X.a and X.b < Y.b


def hull(X, Y):
    """Smallest interval containing both X and Y."""
    return iv.mpf([min(X.a, Y.a), max(X.b, Y.b)])


def mag(X):
    """Magnitude: max |x| over x in X. An upper bound on the absolute value, as a point."""
    return max(abs(X.a), abs(X.b))


def mig(X):
    """Mignitude: min |x| over x in X. Zero if X straddles zero."""
    if X.a <= 0 <= X.b:
        return mpf(0)
    return min(abs(X.a), abs(X.b))


def is_thin(X, tol=None):
    """True if the interval has collapsed to (essentially) a point."""
    return X.delta.b == 0 if tol is None else X.delta.b <= tol


def vec_sup(v):
    """Sup-norm of an interval vector, as a point upper bound."""
    return max((mag(x) for x in v), default=mpf(0))


def mat_sup_norm(M):
    """Operator norm induced by the sup-norm: the largest absolute row sum, as a point upper bound."""
    best = mpf(0)
    for row in M:
        s = mpf(0)
        for x in row:
            s += mag(x)
        if s > best:
            best = s
    return best


def eye(n):
    """n-by-n interval identity."""
    return [[ival(1) if i == j else ival(0) for j in range(n)] for i in range(n)]


def matvec(M, v):
    """Interval matrix times interval vector."""
    out = []
    for row in M:
        s = ival(0)
        for a, b in zip(row, v):
            s = s + a * b
        out.append(s)
    return out


def matmul(A, B):
    """Interval matrix product."""
    n, k, m = len(A), len(B), len(B[0])
    out = [[ival(0) for _ in range(m)] for _ in range(n)]
    for i in range(n):
        for j in range(m):
            s = ival(0)
            for p in range(k):
                s = s + A[i][p] * B[p][j]
            out[i][j] = s
    return out


def sub_vec(u, v):
    """Elementwise interval subtraction."""
    return [a - b for a, b in zip(u, v)]
