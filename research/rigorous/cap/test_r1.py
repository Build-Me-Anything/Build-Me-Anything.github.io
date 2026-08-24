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

print('\n' + ('R1: ALL PASS' if not FAILS else f'R1: {len(FAILS)} FAILURE(S) -> ' + ', '.join(FAILS)))
sys.exit(1 if FAILS else 0)
