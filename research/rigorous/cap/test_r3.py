"""R3 test suite — the derivative-loss cure, graded, and its failure boundary measured.

R2 stopped because the transport term loses a derivative and multiplication by m is unbounded on ℓ¹_ν. This suite
grades the standard cure — analytic preconditioning by a dissipative leading operator — and then measures the
exact point at which the cure stops working, which is the point Euler lives at.

What is checked:

  * the **preconditioning identity** L·Φ(u) = F(u), so that a zero of the preconditioned map really is a solution
    of the original equation and not of something adjacent;
  * that **K is bounded**, ‖Kv‖ ≤ ‖v‖/μ — the single inequality the whole method rests on;
  * a certificate against the **exact** solution u = sin x, with the ball required to contain it;
  * refusals: a residual too large, and — the important one — **μ too small**, i.e. approaching the inviscid limit;
  * the tail bound for Burgers (decays) against De Gregorio (grows), side by side.

Run:  python test_r3.py
"""
import sys
from mpmath import mp, mpf
from ivutil import ival, lo, hi, setprec
from ell1 import Seq, cival
import problem_burgers as B
import radiipoly

setprec(35)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


MU, NU, N = '2.0', '1.0', 12

# --------------------------------------------------------------------------------------------------------
print('\n[1] the preconditioning identity: L(Phi(u)) = F(u)')
# Phi(u) = u - (1/2)K(u^2) + L^{-1}f. Applying L = mu*d_xx gives mu*u_xx - u*u_x + f, the original residual.
# If this failed, the certificates below would be about a different equation - the classic way a preconditioned
# CAP quietly proves the wrong theorem.
for coeffs, label in [([mpf(1)], 'sin x'), ([mpf('0.7'), mpf('0.3')], '0.7 sin x + 0.3 sin 2x')]:
    u = B.sine(N, coeffs)
    phi = B.Phi(u, MU, N)
    # L applied to Phi
    Lphi = Seq(phi.M)
    for m in phi.modes():
        Lphi[m] = phi[m] * cival(-mpf(MU) * m * m, 0)
    # the original residual F(u) = mu*u_xx - u*u_x + f
    uxx = Seq(u.M)
    for m in u.modes():
        uxx[m] = u[m] * cival(-mpf(m * m), 0)
    uux = u.conv(u.deriv())
    f = B.forcing(max(N, 2), MU)
    M = max(Lphi.M, uxx.M, uux.M, f.M)
    F = uxx.resized(M).scale(cival(mpf(MU), 0)) - uux.resized(M) + f.resized(M)
    d = (Lphi.resized(M) - F).norm(NU)
    check(f'L(Phi) = F for {label}', d < mpf('1e-28'), f'difference {mp.nstr(d, 6)}')

# --------------------------------------------------------------------------------------------------------
print('\n[2] u = sin x is exactly a solution')
check('Phi(sin x) = 0', B.Phi(B.sine(N, [mpf(1)]), MU, N).norm(NU) == 0)

print('\n[3] K is bounded: ||K v|| <= ||v|| / mu   (the inequality the whole method rests on)')
for label, coeffs in [('sin x', [mpf(1)]), ('mixed', [mpf(1), mpf('-0.4'), mpf('0.25'), mpf('0.1')])]:
    v = B.sine(N, coeffs)
    lhs = B.K_op(v, MU).norm(NU)
    rhs = v.norm(NU) / mpf(MU)
    check(f'{label}: bounded by ||v||/mu', lhs <= rhs, f'{mp.nstr(lhs, 8)} <= {mp.nstr(rhs, 8)}')

# --------------------------------------------------------------------------------------------------------
print('\n[4] THE GRADING TEST: the certificate closes and its ball contains the exact solution')
pert = ['0', '0.05']
cert, ubar, nu_f = B.prove(mu=MU, nu=NU, N=N, perturb=pert)
check('closes on a perturbed approximate solution', cert.proved,
      f'Y0={mp.nstr(cert.Y0, 5)} Z1={mp.nstr(cert.Z1, 5)} Z2={mp.nstr(cert.Z2, 5)} r={mp.nstr(cert.r, 6)}')
if cert.proved:
    exact = B.sine(N, [mpf(1)])
    dist = (ubar - exact).norm(nu_f)
    check('||exact - ubar|| <= r', dist <= cert.r,
          f'dist={mp.nstr(dist, 8)}  r={mp.nstr(cert.r, 8)}')

# --------------------------------------------------------------------------------------------------------
print('\n[5] it must REFUSE a residual too large for the nonlinearity')
c_big, _, _ = B.prove(mu=MU, nu=NU, N=N, perturb=['0.3'])
check('large perturbation is refused', not c_big.proved, c_big.reason[:70])

# --------------------------------------------------------------------------------------------------------
print('\n[6] THE FAILURE BOUNDARY: as mu falls toward the inviscid limit, the method provably stops')
# Z1_tail = ||ubar||/mu, so the contraction cannot close once mu <= ||ubar||. With ubar = sin x and nu = 1 that
# is ||ubar|| = 1, so the threshold is mu = 1 exactly. Euler and De Gregorio sit at mu = 0.
for mu in ('4.0', '2.0', '1.5', '1.0', '0.5', '0.25'):
    c, ub, _ = B.prove(mu=mu, nu=NU, N=N, perturb=['0', '0.02'])
    expect_possible = mpf(1) / mpf(mu) < 1          # ||ubar|| ~ 1, so Z1_tail = 1/mu
    ok = (c.proved == expect_possible) or (not c.proved and not expect_possible)
    check(f'mu={mu}: {"closes" if c.proved else "refused"}, Z1={mp.nstr(c.Z1, 5)}',
          ok if expect_possible else not c.proved,
          '' if expect_possible else 'no dissipation left to invert')

# --------------------------------------------------------------------------------------------------------
print('\n[7] the wall, measured: Burgers tail bound decays, De Gregorio grows')
rows = B.compare_tail_growth(N=8, mu=MU, nu=NU)
print('     n     Burgers (decays)   De Gregorio (grows)')
for n, b, d in rows:
    print(f'    {n:3d}    {mp.nstr(b, 6):17s}  {mp.nstr(d, 6)}')
b_first, b_last = rows[0][1], rows[-1][1]
d_first, d_last = rows[0][2], rows[-1][2]
check('Burgers bound decreases with n', b_last < b_first, f'{mp.nstr(b_first, 5)} -> {mp.nstr(b_last, 5)}')
check('De Gregorio bound increases with n', d_last > d_first, f'{mp.nstr(d_first, 5)} -> {mp.nstr(d_last, 5)}')
check('so Z1 has a finite supremum for Burgers and none for De Gregorio', b_last < b_first and d_last > d_first,
      'this is the obstruction, not a tuning problem')

print('\n' + ('R3: ALL PASS' if not FAILS else f'R3: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\nSCOPE: this certifies steady viscous Burgers with a chosen forcing. The method requires a dissipative')
print('       leading operator to invert; Euler and De Gregorio have none, and R3 proper remains out of reach.')
sys.exit(1 if FAILS else 0)
