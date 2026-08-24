"""R2 test suite — De Gregorio, graded against an exact steady state, and honest about where it stops.

What is being graded:

  * the **full Fourier pipeline** — Hilbert transform, derivative, the u-from-omega inversion, products — against
    the exact steady state omega = A sin x, whose residual must be *identically zero*. This is the strongest
    single check in the whole CAP tree: several independent pieces of code all have to be right for the residual
    to vanish, and any one of them being wrong shows up immediately;
  * that a **non**-solution has a non-zero residual, so the check above is not vacuous;
  * the **parity structure** of the Galerkin truncation, which decides for which N a certificate can exist at all;
  * a rigorous Krawczyk certificate for the truncated system at those N.

And what is NOT claimed: nothing here is a theorem about the De Gregorio PDE. See the module docstring for the
derivative-loss obstruction, which is structural and is not fixed by more modes.

Run:  python test_r2.py
"""
import sys
from mpmath import mp, mpf
from ivutil import ival, lo, hi, setprec
from ell1 import Seq, cival
import problem_degregorio as DG
from krawczyk import UNIQUE

setprec(35)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


# --------------------------------------------------------------------------------------------------------
print('\n[1] the exact steady state omega = A sin x has identically zero residual')
for A in (1, 3, -2):
    r = DG.residual_norm_of_exact(8, amplitude=A)
    check(f'A={A}: ||F(A sin x)|| = 0', r == 0, f'||F|| = {mp.nstr(r, 6)}')

print('\n[2] ... and the check is not vacuous: non-solutions have non-zero residual')
for extra, label in [(('0.3', 2), 'sin x + 0.3 sin 2x'), (('0.1', 3), 'sin x + 0.1 sin 3x')]:
    amp, mode = extra
    b = [mpf(0)] * 8
    b[0] = mpf(1)
    b[mode - 1] = mpf(amp)
    a = DG.sine_to_seq(b, 8)
    r = DG.F(a).norm('1.0')
    check(f'{label} has residual > 0', r > mpf('1e-6'), f'||F|| = {mp.nstr(r, 6)}')

print('\n[3] the velocity reconstruction is self-consistent: (u_x)^ must equal H(omega)')
a = DG.exact_steady(6, 2)
ux = DG.u_from_omega(a).deriv()
Ha = a.hilbert()
check('u_from_omega then d/dx reproduces the Hilbert transform', (ux - Ha).norm('1.0') < mpf('1e-30'),
      f'difference = {mp.nstr((ux - Ha).norm("1.0"), 6)}')

# --------------------------------------------------------------------------------------------------------
print('\n[4] the Galerkin parity structure decides which N can close')
# Linearising about sin x couples mode m only to m +- 1, so the system splits into two blocks; both are square
# only for odd N. The prediction is made from that structure alone, then compared with the verifier's verdict.
for N in (4, 5, 6, 7, 8, 9, 11):
    even_eqs = len([n for n in range(2, N + 1) if n % 2 == 0])
    odd_unknowns = len([n for n in range(3, N + 1) if n % 2 == 1])
    predicted = (even_eqs == odd_unknowns)
    v = DG.verify_galerkin(N=N)
    got = (v.status == UNIQUE)
    check(f'N={N}: predicted {"closes" if predicted else "singular"}, verifier says {v.status}',
          predicted == got, f'even-eqs={even_eqs} odd-unknowns={odd_unknowns}')

# --------------------------------------------------------------------------------------------------------
print('\n[5] the certificate encloses b = (1, 0, ..., 0), the exact steady state')
for N in (5, 7, 9):
    v = DG.verify_galerkin(N=N)
    if v.status == UNIQUE:
        ok = all(lo(c) <= 0 <= hi(c) for c in v.box)
        w = max(hi(c) - lo(c) for c in v.box)
        check(f'N={N}: enclosure contains the exact solution', ok, f'max width {mp.nstr(w, 6)}')
    else:
        check(f'N={N}: closes', False, v.status)

# --------------------------------------------------------------------------------------------------------
print('\n[6] the scaling symmetry really is there — DF(a)a = 2F(a) = 0 at a solution')
# Euler's identity for a degree-2 homogeneous map. If this failed, the phase condition would be unnecessary and
# the whole formulation would be wrong.
a = DG.exact_steady(8, 1)
lhs = DG.DF(a, a)
rhs = DG.F(a).scale(cival(2, 0))
check('DF(a)a = 2 F(a)', (lhs - rhs.resized(lhs.M)).norm('1.0') < mpf('1e-30'),
      f'difference = {mp.nstr((lhs - rhs.resized(lhs.M)).norm("1.0"), 6)}')
check('and both are zero at the steady state', lhs.norm('1.0') < mpf('1e-30'),
      'so the linearisation is singular along the solution: the phase condition is required, not optional')

print('\n' + ('R2: ALL PASS' if not FAILS else f'R2: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\nSCOPE: the certificates above are theorems about the Galerkin truncation, not about the De Gregorio PDE.')
sys.exit(1 if FAILS else 0)
