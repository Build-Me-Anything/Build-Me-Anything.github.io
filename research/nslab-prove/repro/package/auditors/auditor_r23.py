"""Machine C, extended to R2 and R3 — still importing nothing from the prover.

`auditor.py` audits the two radii-polynomial certificates. R2 and R3 need more than that:

* **R3** is another radii polynomial, but for the *preconditioned* Burgers problem, so the bounds have to be
  re-derived through the operator K = (mu*d_xx)^-1 o d_x. Everything stays exactly rational.

* **R2 is a different theorem altogether.** It is a Krawczyk verdict — *K(X) is contained in the interior of X* —
  not a contraction radius, so re-checking it means recomputing an interval operator, not evaluating a
  polynomial. This module therefore carries a small **exact rational interval arithmetic**: endpoints are
  `Fraction`s and every operation is exact, so unlike the prover there is no outward rounding at all and no
  possibility of a rounding defect.

One deliberate difference from the prover, and it strengthens the check: for R2 the auditor **computes its own
preconditioner Y** by exact rational Gauss-Jordan rather than trusting the prover's. Y affects only whether the
test closes, never whether its conclusion is true, so an independent Y verifying the same containment is a
genuinely independent confirmation of the same theorem rather than a re-run of the same computation.

The De Gregorio residual is also re-derived from scratch here, in real sine-coefficient form, rather than through
the complex Fourier route the prover uses:

    omega = sum_j b_j sin(jx),   u_x = H(omega) = -sum b_j cos(jx),   u = -sum (b_j/j) sin(jx)

    omega*u_x - u*omega_x = -sum_{j,k} b_j b_k (1 - k/j) sin(jx)cos(kx)

and with sin(jx)cos(kx) = (1/2)[sin((j+k)x) + sin((j-k)x)], the coefficient of sin(nx) is

    F_n = -(1/2) sum_{j,k} b_j b_k (1 - k/j) * ( [j+k=n] + [j-k=n] - [k-j=n] )

Two independent derivations agreeing is the point; a shared algebra slip would otherwise pass through both.
"""
from fractions import Fraction

from auditor import F, ACCEPT, REJECT, RSeq, _short

__all__ = ['RInterval', 'audit_r2', 'audit_r3']


# ------------------------------------------------------------------------------------------------------------
# exact rational interval arithmetic
# ------------------------------------------------------------------------------------------------------------

class RInterval:
    """[lo, hi] with exact Fraction endpoints. No rounding anywhere, so no rounding can be wrong."""

    __slots__ = ('lo', 'hi')

    def __init__(self, lo, hi=None):
        lo = F(lo)
        hi = lo if hi is None else F(hi)
        if lo > hi:
            lo, hi = hi, lo
        self.lo, self.hi = lo, hi

    def __add__(self, o):
        o = _iv(o)
        return RInterval(self.lo + o.lo, self.hi + o.hi)

    def __sub__(self, o):
        o = _iv(o)
        return RInterval(self.lo - o.hi, self.hi - o.lo)

    def __neg__(self):
        return RInterval(-self.hi, -self.lo)

    def __mul__(self, o):
        o = _iv(o)
        p = (self.lo * o.lo, self.lo * o.hi, self.hi * o.lo, self.hi * o.hi)
        return RInterval(min(p), max(p))

    __rmul__ = __mul__
    __radd__ = __add__

    def strictly_inside(self, o):
        return o.lo < self.lo and self.hi < o.hi

    def width(self):
        return self.hi - self.lo

    def mid(self):
        return (self.lo + self.hi) / 2

    def __repr__(self):
        return '[%s, %s]' % (_short(self.lo), _short(self.hi))


def _iv(x):
    return x if isinstance(x, RInterval) else RInterval(x)


# ------------------------------------------------------------------------------------------------------------
# R2 - De Gregorio, re-derived in real sine coefficients
# ------------------------------------------------------------------------------------------------------------

def _dg_coeff_table(N):
    """c[n][(j,k)] with F_n = sum_{j,k} c[n][(j,k)] b_j b_k, exact rationals.

    Built from the sine-coefficient derivation in the module docstring - a different route from the prover's
    complex-Fourier convolution, so an index or sign slip in either is unlikely to be mirrored.
    """
    tab = [dict() for _ in range(N + 2)]
    for j in range(1, N + 1):
        for k in range(1, N + 1):
            w = -(Fraction(1, 2)) * (1 - Fraction(k, j))
            if w == 0:
                continue
            for n, sign in ((j + k, 1), (j - k, 1), (k - j, -1)):
                if 1 <= n <= N:
                    tab[n][(j, k)] = tab[n].get((j, k), Fraction(0)) + w * sign
    return tab


def _dg_G(vec, N, tab):
    """G(vec) for the phase-fixed Galerkin system: b_1 = 1, unknowns b_2..b_N, equations F_2..F_N."""
    b = [_iv(1)] + [_iv(v) for v in vec]
    out = []
    for n in range(2, N + 1):
        s = RInterval(0)
        for (j, k), c in tab[n].items():
            s = s + RInterval(c) * b[j - 1] * b[k - 1]
        out.append(s)
    return out


def _dg_DG(vec, N, tab):
    """Exact Jacobian: dF_n/db_m = sum_k (c[n][(m,k)] + c[n][(k,m)]) b_k."""
    b = [_iv(1)] + [_iv(v) for v in vec]
    rows = []
    for n in range(2, N + 1):
        row = []
        for m in range(2, N + 1):
            s = RInterval(0)
            for k in range(1, N + 1):
                c = tab[n].get((m, k), Fraction(0)) + tab[n].get((k, m), Fraction(0))
                if c != 0:
                    s = s + RInterval(c) * b[k - 1]
            row.append(s)
        rows.append(row)
    return rows


def _rational_inverse(Amid):
    """Exact Gauss-Jordan inverse of a rational matrix. Returns None if singular."""
    n = len(Amid)
    A = [row[:] + [Fraction(1) if i == j else Fraction(0) for j in range(n)] for i, row in enumerate(Amid)]
    for c in range(n):
        piv = None
        for r in range(c, n):
            if A[r][c] != 0:
                piv = r
                break
        if piv is None:
            return None
        A[c], A[piv] = A[piv], A[c]
        d = A[c][c]
        A[c] = [v / d for v in A[c]]
        for r in range(n):
            if r == c or A[r][c] == 0:
                continue
            m = A[r][c]
            A[r] = [a - m * b for a, b in zip(A[r], A[c])]
    return [row[n:] for row in A]


def audit_r2(doc):
    """Re-check a De Gregorio Galerkin certificate by recomputing the Krawczyk operator exactly."""
    findings = []
    N = int(doc['params']['N'])
    box = [RInterval(F(a), F(b)) for a, b in doc['box']]
    if len(box) != N - 1:
        return REJECT, ['REJECT: box has %d entries, expected %d for N=%d' % (len(box), N - 1, N)]

    tab = _dg_coeff_table(N)
    xcheck = [b.mid() for b in box]

    # The auditor builds its OWN preconditioner, exactly. Y affects only whether the test closes.
    Jmid = [[e.mid() for e in row] for row in _dg_DG([RInterval(x) for x in xcheck], N, tab)]
    Y = _rational_inverse(Jmid)
    if Y is None:
        return REJECT, ['REJECT: the Jacobian at the box midpoint is singular, so no Krawczyk test can be '
                        'formed here. For this system that happens at even N.']

    # K(X) = xcheck - Y*G(xcheck) + (I - Y*DG(X))*(X - xcheck)
    n = N - 1
    Gx = _dg_G([RInterval(x) for x in xcheck], N, tab)
    J = _dg_DG(box, N, tab)
    YG = [sum((RInterval(Y[i][j]) * Gx[j] for j in range(n)), RInterval(0)) for i in range(n)]
    M = []
    for i in range(n):
        row = []
        for j in range(n):
            s = RInterval(0)
            for p in range(n):
                s = s + RInterval(Y[i][p]) * J[p][j]
            row.append((RInterval(1) if i == j else RInterval(0)) - s)
        M.append(row)
    rad = [box[i] - RInterval(xcheck[i]) for i in range(n)]
    KX = []
    for i in range(n):
        s = RInterval(0)
        for j in range(n):
            s = s + M[i][j] * rad[j]
        KX.append(RInterval(xcheck[i]) + (-YG[i]) + s)

    inside = all(KX[i].strictly_inside(box[i]) for i in range(n))
    if not inside:
        bad = [i + 2 for i in range(n) if not KX[i].strictly_inside(box[i])]
        findings.append('REJECT: K(X) is not strictly inside X; component(s) %s escape. The Krawczyk hypothesis '
                        'does not hold on this box.' % bad)
    else:
        findings.append('K(X) strictly inside X verified in exact rational interval arithmetic '
                        '(max K width %s)' % _short(max(k.width() for k in KX)))

    # the exact steady state omega = sin x means all offsets are zero; the box must contain it
    if doc.get('claims_contains_zero', True):
        if not all(b.lo <= 0 <= b.hi for b in box):
            findings.append('REJECT: the box does not contain 0, which is the exact steady state omega = sin x.')
        else:
            findings.append('box contains the exact solution (all offsets zero)')

    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    return verdict, findings


# ------------------------------------------------------------------------------------------------------------
# R3 - preconditioned Burgers
# ------------------------------------------------------------------------------------------------------------

def _burgers_seq(sine_coeffs):
    """u = sum c_k sin(kx) as an RSeq of exact complex rationals: mode k gets -i c/2, mode -k gets +i c/2."""
    a = RSeq()
    for k, c in enumerate(sine_coeffs, start=1):
        c = F(c)
        if c == 0:
            continue
        a.set(k, Fraction(0), -c / 2)
        a.set(-k, Fraction(0), c / 2)
    return a


def _apply_symbol(a, fn):
    """Multiply mode m by the complex rational fn(m) = (re, im); mode 0 annihilated."""
    out = RSeq()
    for m, (re, im) in a.d.items():
        if m == 0:
            continue
        sr, si = fn(m)
        out.set(m, re * sr - im * si, re * si + im * sr)
    return out


def audit_r3(doc):
    """Re-check the preconditioned Burgers certificate: recompute Y0, Z1, Z2 exactly and re-verify p(r) < 0."""
    findings = []
    N = int(doc['params']['N'])
    mu = F(doc['params']['mu'])
    nu = F(doc['params']['nu'])
    coeffs = [F(c) for c in doc['ubar_sine']]

    u = _burgers_seq(coeffs)
    # K: symbol -i/(mu*m);  Linv: symbol -1/(mu*m^2)
    K = lambda s: _apply_symbol(s, lambda m: (Fraction(0), -Fraction(1, 1) / (mu * m)))
    Linv = lambda s: _apply_symbol(s, lambda m: (-Fraction(1, 1) / (mu * m * m), Fraction(0)))

    # forcing f = mu*sin x + (1/2) sin 2x, for which u = sin x is exact
    f = _burgers_seq([mu, Fraction(1, 2)])

    # Phi(u) = u - (1/2) K(u^2) + Linv(f)
    sq = u.conv(u)
    half_K = K(sq).scaled(Fraction(1, 2))
    Phi = u - half_K + Linv(f)
    Y0_lo, Y0_hi = Phi.norm_lower(nu), Phi.norm_upper(nu)

    ub = u.norm_upper(nu)
    Z1_tail = ub / mu               # tail column bound at |n| = N+1
    Z2_min = Fraction(1) / mu       # with A = identity

    Y0 = F(doc['bounds']['Y0'])
    Z1 = F(doc['bounds']['Z1'])
    Z2 = F(doc['bounds']['Z2'])
    r = F(doc['r'])

    if Y0 < Y0_lo:
        findings.append('REJECT: Y0 = %s is BELOW the true residual norm (>= %s).' % (_short(Y0), _short(Y0_lo)))
    else:
        findings.append('Y0 ok: claimed %s, independently computed %s' % (_short(Y0), _short(Y0_hi)))

    if Z1 < Z1_tail:
        findings.append('REJECT: Z1 = %s is BELOW the tail bound %s; the infinite tail is uncovered.'
                        % (_short(Z1), _short(Z1_tail)))
    else:
        findings.append('Z1 ok: claimed %s, tail requires >= %s' % (_short(Z1), _short(Z1_tail)))

    if Z2 < Z2_min:
        findings.append('REJECT: Z2 = %s is BELOW 1/mu = %s.' % (_short(Z2), _short(Z2_min)))
    else:
        findings.append('Z2 ok: claimed %s, minimum %s' % (_short(Z2), _short(Z2_min)))

    if Z1 >= 1:
        findings.append('REJECT: Z1 = %s >= 1; no radius can work. (This is the inviscid limit: Z1 = ||u||/mu.)'
                        % _short(Z1))

    if r <= 0:
        findings.append('REJECT: r = %s is not positive.' % _short(r))
    else:
        p = Z2 * r * r - (1 - Z1) * r + Y0
        if p >= 0:
            findings.append('REJECT: p(r) = %s is not negative at r = %s.' % (_short(p), _short(r)))
        else:
            findings.append('p(r) < 0 verified exactly: p(%s) = %s' % (_short(r), _short(p)))

    verdict = REJECT if any(f.startswith('REJECT') for f in findings) else ACCEPT
    return verdict, findings


DISPATCH = {'degregorio_galerkin': audit_r2, 'burgers': audit_r3}


def audit(doc):
    p = doc.get('problem')
    if p not in DISPATCH:
        return REJECT, ['REJECT: unknown problem "%s"' % p]
    return DISPATCH[p](doc)
