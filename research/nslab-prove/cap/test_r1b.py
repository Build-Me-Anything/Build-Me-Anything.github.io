"""R1b test suite — the radii-polynomial route, graded against exact answers.

This is the machinery that transfers upward, so it is graded harder than R1a. Three things are checked:

  * the **Banach algebra** inequality ‖a*b‖ <= ‖a‖‖b‖ actually holds for the convolution as implemented — every
    tail bound in the verifier rests on it;
  * the **quadratic** problem, whose exact solution is the Catalan sequence, so both the certificate AND the
    enclosure radius can be graded. This is the only problem here with Z2 > 0, i.e. the only one that tests the
    nonlinear term of the radii polynomial;
  * **CLM**, where the certified lower bound on the blow-up time must come out at the exact T = 2.

And the refusals: bounds that are not upper bounds, Z1 >= 1, and a residual too large for the nonlinearity.

Run:  python test_r1b.py
"""
import sys
from mpmath import mp, mpf
from ivutil import ival, lo, hi, setprec
from ell1 import Seq, cival, banach_algebra_witness
import radiipoly
import problem_quadratic as PQ
import problem_clm_fourier as CF

setprec(40)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


# --------------------------------------------------------------------------------------------------------
print('\n[1] the Banach algebra inequality, on which every tail bound rests')
# Mixed signs, so the inequality is strict and a sign or index slip in conv() would break it.
c = Seq(3); c[1] = cival(1, 0); c[2] = cival(-1, 0); c[3] = cival(1, 0)
d = Seq(3); d[1] = cival(1, 0); d[2] = cival(1, 0); d[3] = cival(-1, 0)
n1, n2 = banach_algebra_witness(c, d, mpf('1.2'))
check('||a*b|| <= ||a||*||b|| (strict case)', n1 <= n2, f'{mp.nstr(n1, 8)} <= {mp.nstr(n2, 8)}')
# Complex, with the Hilbert transform in the mix
e = Seq(2); e[1] = cival(0, 1); e[-1] = cival(0, -1); e[2] = cival('0.5', '0.25')
n3, n4 = banach_algebra_witness(e, e.hilbert(), mpf('1.1'))
check('holds for complex data through hilbert()', n3 <= n4, f'{mp.nstr(n3, 8)} <= {mp.nstr(n4, 8)}')

# --------------------------------------------------------------------------------------------------------
print('\n[2] the recursion reproduces the exact Catalan solution')
mu = '0.1'
a10 = PQ.numerical_solution(10, mu)
ex10 = PQ.exact_coefficients(10, mu)
ok = all(abs(lo(a10[m].real) - ex10[m - 1]) < mpf('1e-30') for m in range(1, 11))
check('a_m = C_{m-1} mu^{m-1}', ok)

# --------------------------------------------------------------------------------------------------------
print('\n[3] quadratic problem: the certificate closes, and Y0 falls with N')
certs = {}
for N in (10, 20, 30):
    cert, abar, _, mu_f, nu_f = PQ.prove(N=N)
    certs[N] = (cert, abar, mu_f, nu_f)
    check(f'N={N} closes', cert.proved, f'Y0={mp.nstr(cert.Y0, 4)} Z1={mp.nstr(cert.Z1, 5)} '
                                       f'Z2={mp.nstr(cert.Z2, 5)} r={mp.nstr(cert.r, 5)}')
check('Y0 decreases geometrically with N',
      certs[30][0].Y0 < certs[20][0].Y0 < certs[10][0].Y0,
      f'{mp.nstr(certs[10][0].Y0, 4)} -> {mp.nstr(certs[20][0].Y0, 4)} -> {mp.nstr(certs[30][0].Y0, 4)}')

# --------------------------------------------------------------------------------------------------------
print('\n[4] THE GRADING TEST: the certified ball really contains the exact solution')
for N in (10, 20, 30):
    cert, abar, mu_f, nu_f = certs[N]
    M = 4 * N
    ex = Seq(M)
    for m in range(1, M + 1):
        ex[m] = cival(PQ.catalan(m - 1) * mu_f ** (m - 1), 0)
    dist = (ex - abar.resized(M)).norm(nu_f)
    check(f'N={N}: ||exact - abar|| <= r', dist <= cert.r,
          f'dist={mp.nstr(dist, 8)}  r={mp.nstr(cert.r, 8)}  ratio={mp.nstr(cert.r / dist, 8)}')

# --------------------------------------------------------------------------------------------------------
print('\n[5] CLM through radii polynomials: Z1 = (t/2)*nu, exactly as the tail estimate predicts')
for t, nu in [('1.0', '1.0'), ('1.5', '1.2'), ('1.7', '1.15')]:
    c, _ = CF.prove_at(t, nu, N=25)
    pred = mpf(t) / 2 * mpf(nu)
    check(f't={t} nu={nu}: closes with Z1 = {mp.nstr(pred, 6)}',
          c.proved and abs(c.Z1 - pred) < mpf('1e-25'), f'Z1={mp.nstr(c.Z1, 10)}')

# --------------------------------------------------------------------------------------------------------
print('\n[6] THE GRADING TEST: certified lower bound on T equals the exact T = 2')
t_ok, msg = CF.certified_lower_bound_on_T(nu='1.0', N=60, steps=45)
check('T >= 2 certified', t_ok is not None and abs(t_ok - 2) < mpf('1e-10'),
      f'T >= {mp.nstr(t_ok, 14)}   (exact T = 2)')
for nu in ('1.05', '1.2'):
    t_nu, _ = CF.certified_lower_bound_on_T(nu=nu, N=60, steps=45)
    pred = 2 / mpf(nu)
    check(f'nu={nu}: threshold matches 2/nu', abs(t_nu - pred) < mpf('1e-10'),
          f'{mp.nstr(t_nu, 14)} vs {mp.nstr(pred, 14)}')

# --------------------------------------------------------------------------------------------------------
print('\n[7] the two independent R1 routes agree on T')
from clm import TrigPoly, blowup_time
r_closed = blowup_time(TrigPoly([(1, 1, 0)]))
check('closed-form route gives T = 2', r_closed['verdict'] == 'BLOWUP' and lo(r_closed['T']) <= 2 <= hi(r_closed['T']),
      f"T in [{mp.nstr(lo(r_closed['T']), 22)}, {mp.nstr(hi(r_closed['T']), 22)}]")
check('radii-polynomial route agrees (>= 2)', t_ok is not None and t_ok >= 2 - mpf('1e-10'),
      'two independent methods, same answer')

# --------------------------------------------------------------------------------------------------------
print('\n[8] the verifier must REFUSE')
check('Z1 >= 1 is refused', not radiipoly.verify(mpf('1e-9'), mpf('1.0'), mpf('0.1')).proved,
      radiipoly.verify(mpf('1e-9'), mpf('1.0'), mpf('0.1')).reason[:60])
check('a residual too large for the nonlinearity is refused',
      not radiipoly.verify(mpf('10'), mpf('0.5'), mpf('1.0')).proved,
      radiipoly.verify(mpf('10'), mpf('0.5'), mpf('1.0')).reason[:60])
check('a negative bound is refused', not radiipoly.verify(mpf('-1'), mpf('0.5'), mpf('0.1')).proved)
c_bad, _ = CF.prove_at('2.01', '1.0', N=25)
check('CLM past the threshold is refused', not c_bad.proved, f'Z1={mp.nstr(c_bad.Z1, 6)}')

print('\n' + ('R1b: ALL PASS' if not FAILS else f'R1b: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
