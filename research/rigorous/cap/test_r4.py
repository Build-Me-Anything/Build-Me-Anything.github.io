"""R4 test suite — certified eigenpairs of a compact operator, graded against exact answers.

This is the route the literature uses for self-similar profile equations, and it is the one that does not need a
derivative-gaining inverse. The suite grades three things:

  * the certificate closes and its ball contains the **exact** eigenpair;
  * the **tail bound shrinks like τ(n)**, which is compactness — and the discriminating test is that a merely
    BOUNDED operator, identical in every other respect, **fails**;
  * the refusals: a phase vector orthogonal to the eigenvector, a wrong eigenvalue, a residual too large.

Run:  python test_r4.py
"""
import sys
from mpmath import mp, mpf
from ivutil import ival, lo, hi, setprec
from ell1 import Seq, cival
import problem_eigen as E
import radiipoly

setprec(35)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


RHO, NU = '0.4', '1.5'

# --------------------------------------------------------------------------------------------------------
print('\n[1] the exact eigenpair really is one (checked before anything is certified)')
M = 40
rho = mpf(RHO)
T = E.DiagPlusRankOne(d=lambda m: mpf(1) / (m * m), u={m: rho ** m for m in range(1, M + 1)}, w={1: 1}, M=M)
v, lam = E.exact_geometric(RHO, M)
res = (T.apply(v) - v.scale(cival(lam, 0))).norm('1.0')
check('||T v - lambda v|| = 0 to truncation', res < mpf('1e-30'), f'residual {mp.nstr(res, 6)}')
check('lambda = 1 + rho exactly', lam == 1 + rho, f'{mp.nstr(lam, 12)}')
check('phase condition <v, w> = 1 holds', abs(lo(T.inner_w(v).real) - 1) < mpf('1e-30'))

# --------------------------------------------------------------------------------------------------------
print('\n[2] the certificate closes, and the tail bound shrinks like tau(n) = 1/(N+1)^2 -- i.e. compactness')
certs = {}
for N in (8, 12, 16):
    c, Tn, vn, ln = E.prove_geometric(rho=RHO, nu=NU, N=N)
    certs[N] = c
    tau_expected = mpf(1) / ((N + 1) ** 2)
    got = mpf(c.extra['tail_sup_tau'])
    check(f'N={N}: closes, and tau matches 1/(N+1)^2', c.proved and abs(got - tau_expected) < mpf('1e-8'),
          f'Z1={mp.nstr(c.Z1, 5)}  tau={mp.nstr(got, 6)} vs {mp.nstr(tau_expected, 6)}')
check('Z1 decreases as N grows (the tail is being squeezed)',
      certs[16].Z1 < certs[12].Z1 < certs[8].Z1,
      f'{mp.nstr(certs[8].Z1, 5)} -> {mp.nstr(certs[12].Z1, 5)} -> {mp.nstr(certs[16].Z1, 5)}')

# --------------------------------------------------------------------------------------------------------
print('\n[3] THE DISCRIMINATING TEST: a merely BOUNDED operator must fail')
# Identical in every respect except d_m = 1 instead of 1/m^2. The operator is still bounded, still rank-one plus
# diagonal, still has an eigenvalue - but it is NOT compact, tau(n) does not decay, and Z1_tail cannot be made
# small by taking more modes. If this closed, the tail bound would not be measuring what it claims to.
Mb = 40
Tb = E.DiagPlusRankOne(d=lambda m: mpf(1), u={m: rho ** m for m in range(1, Mb + 1)}, w={1: 1}, M=Mb)
vb = Seq(Mb)
for m in range(1, Mb + 1):
    vb[m] = cival(rho ** m, 0)
worst = None
for N in (8, 16, 24):
    Y0, Z1, Z2, extra = E.bounds(Tb, vb, mpf(1) + rho, NU, N)
    if Y0 is None:
        continue
    c = radiipoly.verify(Y0, Z1, Z2)
    worst = (N, c, extra)
    check(f'N={N}: bounded-but-not-compact operator is REFUSED', not c.proved,
          f'Z1={mp.nstr(Z1, 6)} (tau stays at {mp.nstr(mpf(extra["tail_sup_tau"]), 4)})')

# --------------------------------------------------------------------------------------------------------
print('\n[4] THE GRADING TEST: a perturbed approximate eigenpair, ball must contain the exact one')
pert = {3: '0.002', 5: '-0.001'}
c, Tp, vp, lp = E.prove_geometric(rho=RHO, nu=NU, N=14, perturb=pert)
check('closes on a perturbed eigenvector', c.proved,
      f'Y0={mp.nstr(c.Y0, 5)} Z1={mp.nstr(c.Z1, 5)} r={mp.nstr(c.r, 6)}')
if c.proved:
    vex, lex = E.exact_geometric(RHO, vp.M)
    dist = (vp - vex).norm(NU)          # lambda is unperturbed, so the pair distance is the vector distance
    check('||exact - approximate|| <= r', dist <= c.r,
          f'dist={mp.nstr(dist, 8)}  r={mp.nstr(c.r, 8)}')

# --------------------------------------------------------------------------------------------------------
print('\n[5] the second exact answer: algebraic eigenvalues (13 +/- sqrt(73))/8')
lm, lp2 = E.exact_two_mode()
# verify by substitution into the secular equation 1 = sum u_m w_m / (lambda - d_m), u = w = e1 + e2
for name, L in (('lambda_-', lm), ('lambda_+', lp2)):
    sec = 1 / (L - 1) + 1 / (L - mpf(1) / 4)
    check(f'{name} satisfies the secular equation', abs(sec - 1) < mpf('1e-28'),
          f'{mp.nstr(L, 14)}  ->  sum = {mp.nstr(sec, 14)}')
check('and they are the roots of 4*lambda^2 - 13*lambda + 6 = 0',
      abs(4 * lm * lm - 13 * lm + 6) < mpf('1e-28') and abs(4 * lp2 * lp2 - 13 * lp2 + 6) < mpf('1e-28'))

# --------------------------------------------------------------------------------------------------------
print('\n[6] it must REFUSE')
# A phase vector orthogonal to the eigenvector makes the finite block singular: <v,w> = 0 cannot be normalised to 1.
Tz = E.DiagPlusRankOne(d=lambda m: mpf(1) / (m * m), u={m: rho ** m for m in range(1, 41)}, w={30: 1}, M=40)
vz, lz = E.exact_geometric(RHO, 40)
Y0, Z1, Z2, extra = E.bounds(Tz, vz, lz, NU, 6)
check('a phase vector outside the computed block is refused', Y0 is None or not radiipoly.verify(Y0, Z1, Z2).proved,
      extra.get('error', '')[:70] or f'Z1={mp.nstr(Z1, 5)}')

# A badly wrong eigenvalue
c_bad, _, _, _ = E.prove_geometric(rho=RHO, nu=NU, N=12, perturb={1: '5.0'})
check('a badly perturbed eigenvector is refused', not c_bad.proved, c_bad.reason[:70])

# nu too large for the geometric decay: rho*nu >= 1 means the exact eigenvector is not even in the space
check('nu beyond the radius of convergence is refused',
      not E.prove_geometric(rho=RHO, nu='3.0', N=12)[0].proved,
      'rho*nu = 1.2 >= 1, so the exact eigenvector has infinite norm')

print('\n' + ('R4: ALL PASS' if not FAILS else f'R4: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
print('\nSCOPE: these certify eigenpairs of the stated model operators. The De Gregorio instantiation awaits the')
print('       precise operator from Huang-Tong-Wei; guessing it would be a fabrication, not a proof.')
sys.exit(1 if FAILS else 0)
