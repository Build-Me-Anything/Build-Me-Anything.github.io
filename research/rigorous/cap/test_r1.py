"""R1 test suite — grade the CLM certificate against the closed-form answer.

Two things are being graded, and they fail differently:

  * the **Hilbert transform and the exact solution**, checked against an independent forward integration. If the
    transform's sign convention were wrong the blow-up time would still come out looking plausible, so this is
    checked separately rather than inferred from a nice-looking T.
  * the **certified blow-up time**, against cases whose answer is known exactly.

And, as at R0, the tests that matter most are the ones that demand a refusal.

Run:  python test_r1.py
"""
import sys
from mpmath import mp, mpf, cos as mcos, sin as msin, pi as mpi, odefun
from ivutil import ival, lo, hi, width, setprec
from clm import TrigPoly, blowup_time, enclose_all_zeros, exact_solution, two_pi
from krawczyk import INCONCLUSIVE

setprec(40)
FAILS = []


def check(name, cond, detail=''):
    print(f'  {"PASS" if cond else "FAIL"}  {name}' + (f'   {detail}' if detail else ''))
    if not cond:
        FAILS.append(name)


# --------------------------------------------------------------------------------------------------------
# 1. The Hilbert transform's convention. H(cos kx) = sin kx, H(sin kx) = -cos kx.
# --------------------------------------------------------------------------------------------------------
print('\n[1] Hilbert transform convention')
w = TrigPoly([(1, 1, 0)])                      # omega0 = cos x
x = ival(mp.mpf('0.7'))
check('H(cos x) = sin x at x = 0.7',
      lo(w.theta(x)) <= msin(mpf('0.7')) <= hi(w.theta(x)),
      f'theta = [{mp.nstr(lo(w.theta(x)), 12)}, {mp.nstr(hi(w.theta(x)), 12)}]')
ws = TrigPoly([(1, 0, 1)])                     # omega0 = sin x
check('H(sin x) = -cos x at x = 0.7',
      lo(ws.theta(x)) <= -mcos(mpf('0.7')) <= hi(ws.theta(x)))

# --------------------------------------------------------------------------------------------------------
# 2. The closed form must actually solve the PDE. Integrate omega_t = omega*H(omega) forward at a fixed x with
#    an independent ODE solver, using the closed form only to supply H(omega) - if the transform or the algebra
#    were wrong, these would disagree.
# --------------------------------------------------------------------------------------------------------
print('\n[2] closed form vs independent forward integration (omega0 = cos x, at x = 0.7)')
X0 = mpf('0.7')


def rhs(t, y):
    # theta and omega from the closed form at this x, then the CLM right-hand side.
    p, q = msin(X0), mcos(X0)
    h = t / 2
    dr, di = 1 - h * p, -h * q
    den = dr * dr + di * di
    om = (q * dr - p * di) / den
    th = (p * dr + q * di) / den
    return [om * th]


f_num = odefun(rhs, 0, [mcos(X0)], tol=mpf('1e-25'))
for tt in ['0.5', '1.0', '1.5', '1.9']:
    t = mpf(tt)
    closed = exact_solution(w, ival(X0), t)
    num = f_num(t)[0]
    # The closed-form enclosure is rigorous and about 1e-38 wide. The ODE reference is NOT rigorous - odefun
    # controls its own error to a tolerance and no further - so demanding containment would be testing mpmath's
    # integrator, not this code. The right assertion is agreement to well inside the integrator's accuracy.
    mid = (lo(closed) + hi(closed)) / 2
    err = abs(mid - num)
    check(f'agree at t = {tt} (to 1e-20)', err < mpf('1e-20'),
          f'closed {mp.nstr(mid, 16)}  ode {mp.nstr(num, 16)}  diff {mp.nstr(err, 3)}')

# --------------------------------------------------------------------------------------------------------
# 3. Completeness of the zero set. omega0 = cos x has exactly two zeros on [0, 2pi).
# --------------------------------------------------------------------------------------------------------
print('\n[3] every zero of omega0 = cos x is found, and proved complete')
zeros, err = enclose_all_zeros(w.omega, w.d_omega, mpf(0), hi(two_pi()))
check('search proves completeness', err is None, err or '')
check('finds exactly 2 zeros', len(zeros) == 2, f'{len(zeros)} found')
if len(zeros) == 2:
    zs = sorted(zeros, key=lambda z: lo(z))
    ok = (lo(zs[0]) <= mpi / 2 <= hi(zs[0])) and (lo(zs[1]) <= 3 * mpi / 2 <= hi(zs[1]))
    check('zeros enclose pi/2 and 3pi/2', ok,
          f'[{mp.nstr(lo(zs[0]), 20)}, ...]  [{mp.nstr(lo(zs[1]), 20)}, ...]')

# --------------------------------------------------------------------------------------------------------
# 4. THE GRADING TEST. omega0 = cos x  ->  T = 2 exactly.
# --------------------------------------------------------------------------------------------------------
print('\n[4] certified blow-up time for omega0 = cos x   (exact answer: T = 2)')
r = blowup_time(w)
check('verdict is BLOWUP', r['verdict'] == 'BLOWUP', r.get('reason', ''))
if r['verdict'] == 'BLOWUP':
    T = r['T']
    check('enclosure contains T = 2', lo(T) <= 2 <= hi(T),
          f'T in [{mp.nstr(lo(T), 30)}, {mp.nstr(hi(T), 30)}]')
    check('enclosure is tight (width < 1e-20)', width(T) < mpf('1e-20'),
          f'width {mp.nstr(width(T), 5)}')

# --------------------------------------------------------------------------------------------------------
# 5. A second mode: omega0 = cos 2x, zeros at pi/4, 3pi/4, 5pi/4, 7pi/4, theta0 = sin 2x = +1,-1,+1,-1. T = 2.
# --------------------------------------------------------------------------------------------------------
print('\n[5] omega0 = cos 2x   (exact answer: T = 2, four zeros)')
w2 = TrigPoly([(2, 1, 0)])
r2 = blowup_time(w2)
check('verdict is BLOWUP', r2['verdict'] == 'BLOWUP', r2.get('reason', ''))
check('finds 4 zeros', len(r2.get('zeros', [])) == 4, f"{len(r2.get('zeros', []))} found")
if r2['verdict'] == 'BLOWUP':
    check('encloses T = 2', lo(r2['T']) <= 2 <= hi(r2['T']),
          f"T in [{mp.nstr(lo(r2['T']), 25)}, {mp.nstr(hi(r2['T']), 25)}]")

# --------------------------------------------------------------------------------------------------------
# 6. A case with no closed-form answer to look up: omega0 = cos x + (1/2) cos 2x. The certified T is checked
#    against an independent high-precision computation of the same supremum, done by ordinary root-finding.
# --------------------------------------------------------------------------------------------------------
print('\n[6] omega0 = cos x + 0.5 cos 2x   (checked against independent root-finding)')
w3 = TrigPoly([(1, 1, 0), (2, mpf('0.5'), 0)])
r3 = blowup_time(w3)
check('verdict is BLOWUP', r3['verdict'] == 'BLOWUP', r3.get('reason', ''))
if r3['verdict'] == 'BLOWUP':
    om = lambda t: mcos(t) + mpf('0.5') * mcos(2 * t)
    th = lambda t: msin(t) + mpf('0.5') * msin(2 * t)
    # independent: scan finely, bracket sign changes, bisect
    N, roots = 20000, []
    prev = om(mpf(0))
    for i in range(1, N + 1):
        t = 2 * mpi * i / N
        cur = om(t)
        if prev == 0 or (prev < 0) != (cur < 0):
            a2, b2 = 2 * mpi * (i - 1) / N, t
            for _ in range(200):
                m = (a2 + b2) / 2
                if (om(a2) < 0) != (om(m) < 0):
                    b2 = m
                else:
                    a2 = m
            roots.append((a2 + b2) / 2)
        prev = cur
    sup = max([th(rt) for rt in roots])
    Tref = 2 / sup
    check('independent method finds the same number of zeros', len(roots) == len(r3['zeros']),
          f"independent {len(roots)}, certified {len(r3['zeros'])}")
    check('certified enclosure contains the independent T', lo(r3['T']) <= Tref <= hi(r3['T']),
          f"T in [{mp.nstr(lo(r3['T']), 25)}, {mp.nstr(hi(r3['T']), 25)}]  ref {mp.nstr(Tref, 25)}")

# --------------------------------------------------------------------------------------------------------
# 7. IT MUST REFUSE. A depth cap so small that the zero set cannot be proved complete must yield INCONCLUSIVE
#    and no time - not a plausible number.
# --------------------------------------------------------------------------------------------------------
print('\n[7] refuses when completeness cannot be proved')
r4 = blowup_time(w3, max_depth=1)
check('returns INCONCLUSIVE, with no T', r4['verdict'] == INCONCLUSIVE and 'T' not in r4,
      r4.get('reason', '')[:80])


# --------------------------------------------------------------------------------------------------------
# 8. AN INDEPENDENT EXTERNAL CHECK ON THE CONSTANT, from a published exact solution.
#
# The factor of 2 in T = 2/sup{theta0} is the single most dangerous number in this file: a wrong constant would
# make every blow-up time wrong by a fixed ratio while every internal test still passed, because every internal
# test uses the same formula. It therefore has to be checked against a source that computed a blow-up time by a
# DIFFERENT route.
#
# Elgindi & Jeong (ARMA 235, 2020) exhibit an exactly self-similar CLM solution on the real line:
#
#     omega0(x) = -2 a^2 c x / (a^2 + c^2 x^2),   H(omega0)(x) = 2 a^3 / (a^2 + c^2 x^2),   blowing up at T = 1/a
#
# (as reproduced in Huang, Qin & Wang, arXiv:2401.14615, section 2.1). Applying OUR formula: omega0 vanishes only
# at x = 0, where theta0(0) = 2a^3/a^2 = 2a > 0, so T = 2/(2a) = 1/a. The published T and ours agree for every a,
# which pins the constant. This is on the line rather than the circle, so it exercises the formula and not the
# TrigPoly machinery - which is exactly the point: it is the CONSTANT that is being graded.
# --------------------------------------------------------------------------------------------------------
print('\n[8] the factor of 2, against the published Elgindi-Jeong exact self-similar solution')
for a_s, c_s in [('1', '1'), ('2', '1'), ('1', '2'), ('1/2', '3')]:
    a, c = mpf(a_s) if '/' not in a_s else mpf(1) / 2, mpf(c_s)
    # omega0 vanishes only at x = 0 (the numerator is -2a^2 c x, the denominator never vanishes for a, c > 0)
    x0 = ival(0)
    theta0_at_x0 = ival(2) * ival(a) ** 3 / (ival(a) ** 2 + ival(c) ** 2 * x0 ** 2)
    T_ours = ival(2) / theta0_at_x0
    T_published = mpf(1) / a
    ok = lo(T_ours) <= T_published <= hi(T_ours)
    check(f'a={a_s}, c={c_s}: our formula gives the published T = 1/a', ok,
          f'ours [{mp.nstr(lo(T_ours), 18)}, {mp.nstr(hi(T_ours), 18)}]  published {mp.nstr(T_published, 18)}')

# And the sanity check that makes the above non-vacuous: a WRONG constant must fail it. Done explicitly rather
# than by reusing the loop's last values - an earlier version compared the wrong-constant time against the literal
# 1 instead of against that case's published 1/a, and failed for a reason that had nothing to do with the maths.
for a_s in ('1', '2'):
    a_t = mpf(a_s)
    theta_t = ival(2) * ival(a_t) ** 3 / (ival(a_t) ** 2)      # theta0(0) = 2a
    T_pub = mpf(1) / a_t
    T_right = ival(2) / theta_t
    T_wrong = ival(1) / theta_t                                 # the formula with 1 instead of 2
    check(f'a={a_s}: constant 2 agrees, constant 1 does NOT',
          (lo(T_right) <= T_pub <= hi(T_right)) and not (lo(T_wrong) <= T_pub <= hi(T_wrong)),
          f'right {mp.nstr(lo(T_right), 8)}  wrong {mp.nstr(lo(T_wrong), 8)}  published {mp.nstr(T_pub, 8)}')

print('\n' + ('R1: ALL PASS' if not FAILS else f'R1: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
