"""The sequence space ℓ¹_ν — Layer 3's setting, and the reason rigorous tail bounds are possible at all.

A Fourier series has infinitely many coefficients and a computer holds finitely many. Everything in a
computer-assisted proof of a PDE turns on controlling the ones you dropped. The device that makes it tractable is
the choice of space:

    a = (a_m)_{m ∈ ℤ},      ‖a‖_ν = Σ_{m ∈ ℤ} |a_m| ν^{|m|},      ν ≥ 1

Two properties earn their keep:

1. **It is a Banach algebra under convolution**: ‖a * b‖_ν ≤ ‖a‖_ν · ‖b‖_ν. Every quadratic nonlinearity in a PDE
   becomes a convolution, so this single inequality bounds all of them — including the part supported on modes you
   never computed. Without it, each nonlinear term would need its own bespoke tail estimate.
2. **A finite ν-norm encodes analyticity.** ‖a‖_ν < ∞ for ν > 1 means the coefficients decay at least like ν^{-|m|},
   i.e. the function extends analytically to a strip of half-width log ν. So the norm is not a technical device —
   the number ν is a *result*, a certified strip of analyticity for the solution.

Truncation convention
---------------------
A `Seq` holds coefficients for |m| ≤ M and represents a sequence whose entries vanish beyond M. Products are
computed exactly (the convolution of two width-M sequences has width 2M), so no truncation error is introduced by
this module; where truncation happens, it happens explicitly in the verifier and is accounted for by a bound.

Coefficients are complex intervals (`mpmath.iv.mpc`). Reality of the underlying function is *not* assumed here —
it is a property of particular sequences (a_{-m} = conj(a_m)), checked where it matters rather than baked in.
"""
from mpmath import iv, mp, mpf
from ivutil import ival, lo, hi

__all__ = ['Seq', 'cival', 'czero', 'cabs_hi']


def cival(re=0, im=0):
    """A complex interval from real and imaginary parts."""
    return iv.mpc(ival(re), ival(im))


def czero():
    return cival(0, 0)


def cabs_hi(z):
    """A rigorous upper bound on |z| for a complex interval z, as a plain mpf.

    mpmath's abs() on an interval complex returns an interval; the upper endpoint is the bound we want. Taking the
    upper endpoint is the only safe direction: a norm that under-estimates would make every subsequent bound
    unsound.
    """
    return hi(abs(z))


class Seq:
    """A two-sided sequence (a_m) for |m| <= M, with complex interval entries.

    Indexing is by the mathematical mode number m, not by array position: `s[m]` for -M <= m <= M, and 0 outside.
    """

    __slots__ = ('M', 'c')

    def __init__(self, M, coeffs=None):
        self.M = int(M)
        n = 2 * self.M + 1
        self.c = list(coeffs) if coeffs is not None else [czero() for _ in range(n)]
        if len(self.c) != n:
            raise ValueError(f'expected {n} coefficients for M={M}, got {len(self.c)}')

    # ---- element access ---------------------------------------------------------------------------------
    def __getitem__(self, m):
        if -self.M <= m <= self.M:
            return self.c[m + self.M]
        return czero()

    def __setitem__(self, m, v):
        if not (-self.M <= m <= self.M):
            raise IndexError(f'mode {m} outside |m| <= {self.M}')
        self.c[m + self.M] = v

    def modes(self):
        return range(-self.M, self.M + 1)

    # ---- vector space -----------------------------------------------------------------------------------
    def copy(self):
        return Seq(self.M, list(self.c))

    def resized(self, M2):
        """Same sequence viewed with a different truncation width. Growing pads with zeros (exact); shrinking
        DISCARDS coefficients and is therefore only valid where the caller accounts for what was dropped."""
        out = Seq(M2)
        for m in range(-min(self.M, M2), min(self.M, M2) + 1):
            out[m] = self[m]
        return out

    def __add__(self, other):
        M = max(self.M, other.M)
        out = Seq(M)
        for m in out.modes():
            out[m] = self[m] + other[m]
        return out

    def __sub__(self, other):
        M = max(self.M, other.M)
        out = Seq(M)
        for m in out.modes():
            out[m] = self[m] - other[m]
        return out

    def scale(self, alpha):
        """Multiply by a scalar (real or complex interval)."""
        out = Seq(self.M)
        for m in self.modes():
            out[m] = self[m] * alpha
        return out

    # ---- the algebra ------------------------------------------------------------------------------------
    def conv(self, other):
        """Discrete convolution (a * b)_m = Σ_j a_j b_{m-j}, computed exactly on width M1 + M2.

        This is the product of the underlying functions: if a and b are the Fourier coefficients of f and g, then
        a * b are those of f·g. No truncation happens here.
        """
        M = self.M + other.M
        out = Seq(M)
        for m in out.modes():
            s = czero()
            j0 = max(-self.M, m - other.M)
            j1 = min(self.M, m + other.M)
            for j in range(j0, j1 + 1):
                s = s + self[j] * other[m - j]
            out[m] = s
        return out

    def deriv(self):
        """Coefficients of f'(x): multiply mode m by i·m."""
        out = Seq(self.M)
        for m in self.modes():
            out[m] = self[m] * cival(0, m)
        return out

    def hilbert(self):
        """Coefficients of H(f): multiply mode m by -i·sgn(m); mode 0 is annihilated.

        Same convention as clm.py — H(cos kx) = sin kx for k >= 1 — so the two rungs cannot disagree about the
        transform, which is the kind of silent inconsistency that would make both look right and be wrong.
        """
        out = Seq(self.M)
        for m in self.modes():
            if m == 0:
                out[m] = czero()
            else:
                out[m] = self[m] * cival(0, -1 if m > 0 else 1)
        return out

    def antideriv(self):
        """Coefficients of the zero-mean antiderivative: divide mode m != 0 by i·m; mode 0 set to zero."""
        out = Seq(self.M)
        for m in self.modes():
            if m == 0:
                out[m] = czero()
            else:
                out[m] = self[m] / cival(0, m)
        return out

    # ---- norms ------------------------------------------------------------------------------------------
    def norm(self, nu, above=None):
        """‖a‖_ν = Σ |a_m| ν^{|m|}, as a rigorous **upper** bound (plain mpf).

        Accumulated in INTERVAL arithmetic, and the upper endpoint returned.

        This is not fussiness. A first version summed in ordinary mpf, which rounds to nearest, so the result
        could sit a fraction below the true norm - and every bound in radiipoly.py must be an upper bound or the
        certificate means nothing. The bug was caught by `banach_algebra_witness`: with all-positive coefficients
        the identity ‖a*b‖ = ‖a‖‖b‖ holds exactly, and the two sides came out differing in the last bits, in the
        wrong direction. Nothing else in the pipeline would have noticed, and every certificate would still have
        printed CLOSED.

        `above` restricts the sum to modes with |m| > above.
        """
        NU = ival(nu)
        s = ival(0)
        for m in self.modes():
            if above is not None and abs(m) <= above:
                continue
            am = cabs_hi(self[m])
            if am != 0:
                s = s + ival(am) * NU ** abs(m)
        return hi(s)

    def tail_norm(self, nu, M0):
        """The part of ‖a‖_ν carried by modes with |m| > M0, as an upper bound."""
        return self.norm(nu, above=M0)

    def is_real(self, tol=mpf('1e-25')):
        """Check the reality condition a_{-m} = conj(a_m) to a tolerance — a diagnostic, not an assumption."""
        for m in range(0, self.M + 1):
            d = self[-m] - iv.conj(self[m])
            if cabs_hi(d) > tol:
                return False
        return True

    def __repr__(self):
        return f'<Seq M={self.M}>'


def banach_algebra_witness(a, b, nu):
    """Return (‖a*b‖, ‖a‖·‖b‖) so a caller (or a test) can see the algebra inequality actually holding.

    Included because ‖a*b‖ <= ‖a‖‖b‖ is the single inequality every tail bound in the verifier leans on. It is
    quoted in every paper and it is worth *checking numerically* rather than trusting, since a sign or index slip
    in `conv` would break it and nothing else in the pipeline would notice.
    """
    return a.conv(b).norm(nu), a.norm(nu) * b.norm(nu)
