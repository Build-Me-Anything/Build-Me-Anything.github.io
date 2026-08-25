"""Layer 3 — the radii polynomial: turning three bounds into a theorem.

Given an approximate solution ā of F(a) = 0 and an approximate inverse A of DF(ā), define the Newton–like operator

    T(a) = a − A·F(a)

**Hypothesis (not optional): A must be injective, and A·F must map the space into itself.** Without injectivity a
fixed point of T need not be a zero of F at all — T(a) = a only gives A·F(a) = 0, which is F(a) = 0 only if A kills
nothing. An earlier version of this module relegated that to a parenthesis; a literature check found it stated as
a standing hypothesis in every careful source (Jaquette, Lessard & Takayasu, arXiv:2012.09734, Thm 3.5; Castelli,
Gameiro & Lessard, ARMA 228 (2018), Lemma 3.5), so it is promoted here. `verify()` cannot check it — it sees only
three numbers — so **the caller is responsible**, and each problem module now records why its A is injective.

Suppose then, on the closed ball B_r(ā) in some Banach space, that we have three **upper** bounds:

    ‖A·F(ā)‖               ≤ Y₀                     (how badly ā fails to solve the equation)
    ‖I − A·DF(ā)‖          ≤ Z₁                     (how far A is from a true inverse)
    ‖A·(DF(b) − DF(ā))‖    ≤ Z₂·r   for b ∈ B_r(ā)  (how fast the derivative moves across the ball)

Then for a ∈ B_r(ā),  ‖T(a) − ā‖ ≤ Y₀ + (Z₁ + Z₂ r) r, and T maps B_r into itself and contracts as soon as

    **p(r) := Z₂ r² − (1 − Z₁) r + Y₀ < 0.**

By the contraction mapping theorem F then has a **unique** zero in B_r(ā). That is the whole certificate: one
polynomial inequality, checkable by hand from three numbers.

Reading the three bounds
------------------------
Each failure mode points somewhere different, and the verifier reports which, because that is the only feedback
the architecture permits flowing back to the search:

    Y₀ too large  →  ā is not converged. Compute it better, or use more modes.
    Z₁ ≥ 1        →  A is a poor inverse, or the norm/weight ν is badly chosen. The test cannot close at any r.
    Z₂ too large  →  the nonlinearity is strong on this ball; only a smaller r can work, which needs a smaller Y₀.

Two conventions in the literature, and which one this is
--------------------------------------------------------
The r² coefficient differs by a factor of two between two common conventions, so the form has to be stated:

* **uniform-sup convention (this module).** Z₂ bounds ‖A(DF(b) − DF(ā))‖ ≤ Z₂·r uniformly over the ball, and the
  polynomial is Z₂r² − (1 − Z₁)r + Y₀ with the strict condition p(r) < 0. The contraction condition
  Z₁ + Z₂r < 1 then follows automatically and needs no separate hypothesis.
* **Lipschitz convention.** If Z₂ is a Lipschitz constant for the derivative and the Taylor remainder is
  integrated, the coefficient is ½Z₂ and a separate contraction condition must be imposed. RadiiPolynomial.jl
  uses this form and requires p(r) ≤ 0 *and* p′(r) < 0.

Every Z₂ computed in this project is a uniform-sup bound — for the quadratic problem, DF(b)h − DF(ā)h =
−2μ(b−ā)*h gives ‖A(DF(b)−DF(ā))‖ ≤ 2μ‖A‖·r directly — so this module's form is the right one for it. Mixing the
two would be conservative by a factor of two rather than wrong, but it would not be sharp and it would not be
comparable with published bounds.

A note on the Z₀/Z₁ split. The literature usually separates ‖I − A·A†‖ ≤ Z₀ from ‖A(A† − DF(ā))‖ ≤ Z₁, where A† is
an *approximation* of DF(ā): Z₀ is then a finite matrix norm and Z₁ carries the infinite tail. Taking A† = DF(ā)
exactly, as here, collapses both into one Z₁. That is legitimate and simpler, and it forfeits the computational
reason the split exists.

Rounding direction
------------------
Y₀, Z₁ and Z₂ must all be **upper** bounds. p(r) is increasing in each of them, so if p(r) < 0 holds for the
bounds it holds for the true quantities. That is the only place the arithmetic direction matters, and getting it
backwards would make every certificate worthless while changing nothing visible — so the radii polynomial is
evaluated in interval arithmetic and the verdict requires the *upper* endpoint of p(r) to be negative.
"""
from mpmath import mp, mpf
from ivutil import ival, lo, hi

CLOSED = 'CLOSED'
FAILED = 'FAILED'


class Certificate:
    """The output of the verifier. Carries the numbers a reader needs to re-check the claim by hand."""

    def __init__(self, status, Y0, Z1, Z2, r=None, r_interval=None, reason='', extra=None):
        self.status, self.Y0, self.Z1, self.Z2 = status, Y0, Z1, Z2
        self.r, self.r_interval, self.reason = r, r_interval, reason
        self.extra = extra or {}

    @property
    def proved(self):
        return self.status == CLOSED

    def as_dict(self):
        """The `certificate.json` payload from the architecture document."""
        d = {'verdict': self.status,
             'bounds': {'Y0': mp.nstr(self.Y0, 12), 'Z1': mp.nstr(self.Z1, 12), 'Z2': mp.nstr(self.Z2, 12)},
             'radii_polynomial': 'p(r) = Z2*r^2 - (1 - Z1)*r + Y0',
             'reason': self.reason}
        if self.r is not None:
            d['r'] = mp.nstr(self.r, 12)
            d['interval'] = [mp.nstr(self.r_interval[0], 12), mp.nstr(self.r_interval[1], 12)]
        d.update({k: v for k, v in self.extra.items()})
        return d

    def __repr__(self):
        if self.proved:
            return (f'<CLOSED  r={mp.nstr(self.r, 6)}  Y0={mp.nstr(self.Y0, 4)} '
                    f'Z1={mp.nstr(self.Z1, 4)} Z2={mp.nstr(self.Z2, 4)}>')
        return f'<FAILED  {self.reason}>'


def _p_upper(r, Y0, Z1, Z2):
    """Upper endpoint of p(r), evaluated in interval arithmetic."""
    R = ival(r)
    val = ival(Z2) * R * R - (ival(1) - ival(Z1)) * R + ival(Y0)
    return hi(val)


def verify(Y0, Z1, Z2, r_max=None):
    """Close the contraction, or explain why not.

    Returns a Certificate. On success `r` is (close to) the smallest radius for which p(r) < 0 — the sharpest
    enclosure the three bounds support — and `r_interval` is the full range of valid radii.
    """
    Y0, Z1, Z2 = mpf(Y0), mpf(Z1), mpf(Z2)
    for nm, v in (('Y0', Y0), ('Z1', Z1), ('Z2', Z2)):
        if v < 0:
            return Certificate(FAILED, Y0, Z1, Z2, reason=f'{nm} is negative; bounds must be upper bounds')

    if Z1 >= 1:
        return Certificate(FAILED, Y0, Z1, Z2,
                           reason=f'Z1 = {mp.nstr(Z1, 6)} >= 1: A is not close enough to an inverse, or the '
                                  f'weight nu is wrong. No r can work.')

    if Z2 == 0:
        # Linear problem: p(r) = Y0 - (1 - Z1) r, negative for r > Y0/(1 - Z1).
        r0 = Y0 / (1 - Z1)
        r = r0 * mpf('1.0000000001') + mpf('1e-300')
        if _p_upper(r, Y0, Z1, Z2) >= 0:
            return Certificate(FAILED, Y0, Z1, Z2, reason='linear case: p(r) not verified negative')
        return Certificate(CLOSED, Y0, Z1, Z2, r=r, r_interval=(r, mpf('inf')),
                           reason='linear (Z2 = 0); any larger radius also works')

    disc = (1 - Z1) ** 2 - 4 * Z2 * Y0
    if disc <= 0:
        return Certificate(FAILED, Y0, Z1, Z2,
                           reason=f'discriminant (1-Z1)^2 - 4*Z2*Y0 = {mp.nstr(disc, 6)} <= 0: the residual Y0 is '
                                  f'too large for this nonlinearity. Converge the approximate solution further.')

    s = mp.sqrt(disc)
    r_minus = ((1 - Z1) - s) / (2 * Z2)
    r_plus = ((1 - Z1) + s) / (2 * Z2)

    # Nudge inward and VERIFY rather than trusting the closed-form roots: the quadratic formula is evaluated in
    # ordinary arithmetic, and a certificate must not rest on it. The check below is the actual proof step.
    r = r_minus * mpf('1.000001') + mpf('1e-300')
    if r_max is not None and r > r_max:
        return Certificate(FAILED, Y0, Z1, Z2, reason=f'r = {mp.nstr(r, 6)} exceeds the requested cap {r_max}')
    if _p_upper(r, Y0, Z1, Z2) >= 0:
        # Walk outward a little; the roots are simple so this converges immediately when disc > 0.
        ok = False
        for k in range(60):
            r = r * mpf('1.05')
            if r < r_plus and _p_upper(r, Y0, Z1, Z2) < 0:
                ok = True
                break
        if not ok:
            return Certificate(FAILED, Y0, Z1, Z2, reason='no radius verified with p(r) < 0 in interval arithmetic')
    return Certificate(CLOSED, Y0, Z1, Z2, r=r, r_interval=(r_minus, r_plus),
                       reason=f'p(r) < 0 verified at r = {mp.nstr(r, 8)}')


def operator_norm_columns(columns, nu, weights):
    """‖M‖ for an operator on ℓ¹_ν given column by column.

    In ℓ¹ the induced operator norm is the largest column sum; with the weight ν^{|m|} it is

        ‖M‖ = sup_n  ‖M e_n‖_ν / ν^{|n|}

    `columns` is an iterable of (index n, ν-norm of M e_n); `weights` maps n to ν^{|n|}. Returned as a plain mpf
    upper bound over the columns supplied — the caller is responsible for bounding every column NOT supplied,
    which for an infinite-dimensional operator is the whole difficulty and is never done here.
    """
    best = mpf(0)
    for n, colnorm in columns:
        v = mpf(colnorm) / weights(n)
        if v > best:
            best = v
    return best
